// ========== 图片优化模块 ==========
// 实现图片懒加载和本地压缩

(function () {
  'use strict'

  if (window.ImageOptimizer) {
    console.log('[ImageOptimizer] 已存在，跳过初始化')
    return
  }

  /**
   * ImageCompressorPool - Web Worker 图片压缩池
   * 使用 OffscreenCanvas 在后台线程压缩图片，避免阻塞主线程
   *
   * 新增功能：
   * - Worker 生命周期管理（创建时间、状态、心跳检测）
   * - 崩溃自动重启机制（最多3次，间隔递增 1s/2s/4s）
   * - 任务失败重试队列（最多3次）
   * - 健康状态监控
   */
  class ImageCompressorPool {
    constructor(workerCount = 2) {
      this.workerCount = workerCount
      this.workers = []
      this.taskQueue = []
      this.pendingTasks = new Map()
      this.taskId = 0
      this.isDestroyed = false

      // 任务重试队列
      this.retryQueue = []
      this.maxRetries = 3

      // 健康监控配置
      this.healthCheckInterval = null
      this.healthCheckIntervalMs = 5000 // 5秒检测一次（优化：更快发现问题）

      // 性能监控指标
      this._performanceMetrics = {
        totalCompressTime: 0,
        compressCount: 0,
        avgCompressTime: 0,
        queueLengthPeak: 0,
        workerUtilization: 0,
        busyTime: 0,
        totalTime: 0,
      }

      // 统计数据
      this.stats = {
        totalTasks: 0,
        successfulTasks: 0,
        failedTasks: 0,
        retriedTasks: 0,
        workerRestarts: 0,
        workerCrashes: 0,
      }

      this._initWorkers()
      this._startHealthCheck()
    }

    /**
     * 初始化 Worker 池
     */
    _initWorkers() {
      const workerPath = chrome.runtime.getURL('content/workers/image-compressor.worker.js')

      for (let i = 0; i < this.workerCount; i++) {
        this._createWorker(i, workerPath)
      }

      console.log(`[ImageCompressorPool] 已创建 ${this.workers.length} 个 Worker`)
    }

    /**
     * 创建单个 Worker
     */
    _createWorker(index, workerPath) {
      try {
        const worker = new Worker(workerPath)
        const now = Date.now()

        const workerInfo = {
          worker,
          index,
          busy: false,
          status: 'healthy', // healthy, unhealthy, restarting
          createdAt: now,
          lastHeartbeat: now,
          crashCount: 0,
          restartCount: 0,
          taskCount: 0,
          errorCount: 0,
        }

        worker.onmessage = (e) => this._handleWorkerMessage(e, index)
        worker.onerror = (e) => this._handleWorkerError(e, index)

        this.workers[index] = workerInfo

        console.log(`[ImageCompressorPool] Worker ${index} 创建成功`)
        return true
      } catch (error) {
        console.warn(`[ImageCompressorPool] Worker ${index} 创建失败:`, error.message)
        this.workers[index] = null
        return false
      }
    }

    /**
     * 处理 Worker 消息
     */
    _handleWorkerMessage(e, workerIndex) {
      const workerInfo = this.workers[workerIndex]
      if (!workerInfo) {
        return
      }

      const { type, id, success, dataUrl, originalSize, compressedSize, error, retryable, status } =
        e.data

      // 处理心跳响应
      if (type === 'pong') {
        workerInfo.lastHeartbeat = Date.now()
        workerInfo.status = 'healthy'
        return
      }

      // 处理健康状态消息
      if (type === 'health_status') {
        workerInfo.status = status || 'unhealthy'
        console.warn(`[ImageCompressorPool] Worker ${workerIndex} 状态变更:`, status, e.data.reason)
        return
      }

      // 处理状态查询响应
      if (type === 'status_response') {
        // 可以用于调试
        console.log(`[ImageCompressorPool] Worker ${workerIndex} 状态:`, e.data.status)
        return
      }

      // 处理压缩任务结果
      const task = this.pendingTasks.get(id)
      if (!task) {
        return
      }

      this.pendingTasks.delete(id)

      // 更新统计
      workerInfo.taskCount++
      workerInfo.busy = false

      // 记录压缩耗时
      const compressDuration = task.createdAt ? Date.now() - task.createdAt : 0
      this._performanceMetrics.totalCompressTime += compressDuration
      this._performanceMetrics.compressCount++
      this._performanceMetrics.avgCompressTime =
        this._performanceMetrics.compressCount > 0
          ? this._performanceMetrics.totalCompressTime / this._performanceMetrics.compressCount
          : 0

      if (success && dataUrl) {
        this.stats.successfulTasks++
        task.resolve({
          dataUrl,
          originalSize,
          compressedSize,
        })
      } else {
        workerInfo.errorCount++
        this.stats.failedTasks++

        // 检查是否需要重试
        if (retryable && task.retryCount < this.maxRetries) {
          console.log(
            `[ImageCompressorPool] 任务 ${id} 将重试 (${task.retryCount + 1}/${this.maxRetries})`
          )
          this.stats.retriedTasks++
          this.retryQueue.push({
            ...task,
            retryCount: (task.retryCount || 0) + 1,
          })
        } else {
          task.reject(new Error(error || '压缩失败'))
        }
      }

      // 处理下一个任务
      this._processQueue()
    }

    /**
     * 处理 Worker 错误
     */
    _handleWorkerError(e, workerIndex) {
      const workerInfo = this.workers[workerIndex]
      if (!workerInfo) {
        return
      }

      console.error(`[ImageCompressorPool] Worker ${workerIndex} 错误:`, e.message)

      workerInfo.busy = false
      workerInfo.status = 'unhealthy'
      workerInfo.crashCount++
      this.stats.workerCrashes++

      // 将 taskQueue 中的任务转移到 retryQueue（避免任务丢失）
      while (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()
        if (task.retryCount < this.maxRetries) {
          this.retryQueue.push({
            ...task,
            retryCount: (task.retryCount || 0) + 1,
          })
          this.stats.retriedTasks++
          console.log(`[ImageCompressorPool] 任务 ${task.id} 已转移到重试队列`)
        }
      }

      // 尝试重启 Worker
      this._restartWorker(workerIndex)

      // 处理下一个任务
      this._processQueue()
    }

    /**
     * 重启 Worker（带限制和递增间隔）
     */
    _restartWorker(workerIndex) {
      const workerInfo = this.workers[workerIndex]
      if (!workerInfo) {
        return
      }

      // 限制最大重启次数
      const maxRestarts = 3
      if (workerInfo.restartCount >= maxRestarts) {
        console.error(
          `[ImageCompressorPool] Worker ${workerIndex} 已达最大重启次数 (${maxRestarts})，停止重启`
        )
        workerInfo.status = 'unhealthy'
        return
      }

      // 递增重启间隔：1s, 2s, 4s
      const delay = Math.pow(2, workerInfo.restartCount) * 1000

      console.log(`[ImageCompressorPool] Worker ${workerIndex} 将在 ${delay / 1000}s 后重启...`)

      workerInfo.status = 'restarting'

      setTimeout(() => {
        if (this.isDestroyed) {
          return
        }

        // 终止旧 Worker
        try {
          workerInfo.worker.terminate()
        } catch {
          // ignore
        }

        // 创建新 Worker
        const workerPath = chrome.runtime.getURL('content/workers/image-compressor.worker.js')
        try {
          const worker = new Worker(workerPath)
          worker.onmessage = (e) => this._handleWorkerMessage(e, workerIndex)
          worker.onerror = (e) => this._handleWorkerError(e, workerIndex)

          workerInfo.worker = worker
          workerInfo.busy = false
          workerInfo.status = 'healthy'
          workerInfo.restartCount++
          workerInfo.createdAt = Date.now()
          workerInfo.lastHeartbeat = Date.now()

          this.stats.workerRestarts++

          console.log(
            `[ImageCompressorPool] Worker ${workerIndex} 重启成功 (第 ${workerInfo.restartCount} 次)`
          )

          // 重启后处理重试队列
          this._processRetryQueue()
        } catch (error) {
          console.warn(`[ImageCompressorPool] Worker ${workerIndex} 重启失败:`, error.message)
          workerInfo.status = 'unhealthy'
        }
      }, delay)
    }

    /**
     * 获取空闲 Worker
     */
    _getAvailableWorker() {
      return this.workers.find((w) => !w.busy)
    }

    /**
     * 处理任务队列
     */
    _processQueue() {
      if (this.taskQueue.length === 0) {
        return
      }

      // 更新队列长度峰值
      if (this.taskQueue.length > this._performanceMetrics.queueLengthPeak) {
        this._performanceMetrics.queueLengthPeak = this.taskQueue.length
      }

      const workerInfo = this._getAvailableWorker()
      if (!workerInfo) {
        return
      }

      // 按优先级排序
      this.taskQueue.sort((a, b) => b.priority - a.priority)

      const task = this.taskQueue.shift()
      workerInfo.busy = true

      // 发送任务到 Worker
      workerInfo.worker.postMessage({
        type: 'compress',
        id: task.id,
        src: task.src,
        quality: task.quality,
        maxWidth: task.maxWidth,
        maxHeight: task.maxHeight,
        isCors: task.isCors,
        priority: task.priority,
      })
    }

    /**
     * 处理重试队列
     */
    _processRetryQueue() {
      if (this.retryQueue.length === 0) {
        return
      }

      const workerInfo = this._getAvailableWorker()
      if (!workerInfo) {
        return
      }

      const task = this.retryQueue.shift()
      workerInfo.busy = true

      workerInfo.worker.postMessage({
        type: 'compress',
        id: task.id,
        src: task.src,
        quality: task.quality,
        maxWidth: task.maxWidth,
        maxHeight: task.maxHeight,
        isCors: task.isCors,
        priority: task.priority,
      })
    }

    /**
     * 启动健康检测
     */
    _startHealthCheck() {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
      }

      this.healthCheckInterval = setInterval(() => {
        this._performHealthCheck()
      }, this.healthCheckIntervalMs)

      // 首次检测延迟1秒（优化：更快发现问题）
      setTimeout(() => this._performHealthCheck(), 1000)
    }

    /**
     * 执行健康检测
     */
    _performHealthCheck() {
      if (this.isDestroyed) {
        return
      }

      this.workers.forEach((workerInfo, index) => {
        if (!workerInfo || workerInfo.status === 'restarting') {
          return
        }

        const heartbeatAge = Date.now() - workerInfo.lastHeartbeat
        const timeout = 10000 // 10秒无心跳视为不健康（优化：更快发现异常）

        if (heartbeatAge > timeout) {
          console.warn(
            `[ImageCompressorPool] Worker ${index} 心跳超时 (${(heartbeatAge / 1000).toFixed(0)}s)`
          )
          workerInfo.status = 'unhealthy'
          this._restartWorker(index)
        } else {
          // 发送心跳检测
          workerInfo.worker.postMessage({ type: 'ping', id: Date.now() })
        }
      })
    }

    /**
     * 检查是否跨域 URL
     */
    _isCorsUrl(url) {
      if (!url || url.startsWith('data:')) {
        return false
      }
      try {
        const urlObj = new URL(url, location.href)
        return urlObj.origin !== location.origin
      } catch {
        return true
      }
    }

    /**
     * 压缩图片
     * @param {string} src - 图片 URL
     * @param {object} options - 压缩选项
     * @param {number} options.quality - 压缩质量 (0-1)
     * @param {number} options.maxWidth - 最大宽度
     * @param {number} options.maxHeight - 最大高度
     * @param {number} options.priority - 优先级 (0-10, 高优先级任务优先处理)
     * @returns {Promise<{dataUrl: string, originalSize: number, compressedSize: number}>}
     */
    async compress(src, options = {}) {
      if (this.isDestroyed) {
        throw new Error('ImageCompressorPool 已销毁')
      }

      const { quality = 0.8, maxWidth = 1920, maxHeight = 1920, priority = 0 } = options

      const id = ++this.taskId
      const isCors = this._isCorsUrl(src)

      this.stats.totalTasks++

      return new Promise((resolve, reject) => {
        this.pendingTasks.set(id, {
          src,
          quality,
          maxWidth,
          maxHeight,
          isCors,
          priority,
          resolve,
          reject,
          retryCount: 0,
          createdAt: Date.now(),
        })

        // 高优先级任务直接处理，低优先级进队列
        if (priority >= 5) {
          const workerInfo = this._getAvailableWorker()
          if (workerInfo) {
            workerInfo.busy = true
            workerInfo.worker.postMessage({
              type: 'compress',
              id,
              src,
              quality,
              maxWidth,
              maxHeight,
              isCors,
              priority,
            })
          } else {
            // 所有 Worker 都忙，进队列等待
            this.taskQueue.push({ id, src, quality, maxWidth, maxHeight, isCors, priority })
          }
        } else {
          // 普通优先级进队列
          this.taskQueue.push({ id, src, quality, maxWidth, maxHeight, isCors, priority })
          this._processQueue()
        }
      })
    }

    /**
     * 检查 Worker 健康状态
     * @returns {Promise<object>} 健康状态报告
     */
    async healthCheck() {
      const results = await Promise.all(
        this.workers.map(
          (workerInfo, index) =>
            new Promise((resolve) => {
              if (!workerInfo) {
                resolve({ index, healthy: false, reason: 'not_exists' })
                return
              }

              const timeout = setTimeout(() => {
                resolve({
                  index,
                  healthy: false,
                  reason: 'timeout',
                  status: workerInfo.status,
                  lastHeartbeat: workerInfo.lastHeartbeat,
                })
              }, 1000)

              const handler = (e) => {
                if (e.data.type === 'pong') {
                  clearTimeout(timeout)
                  workerInfo.worker.removeEventListener('message', handler)
                  resolve({
                    index,
                    healthy: true,
                    status: workerInfo.status,
                    uptime: Date.now() - workerInfo.createdAt,
                    taskCount: workerInfo.taskCount,
                    errorCount: workerInfo.errorCount,
                    crashCount: workerInfo.crashCount,
                    restartCount: workerInfo.restartCount,
                  })
                }
              }

              workerInfo.worker.addEventListener('message', handler)
              workerInfo.worker.postMessage({ type: 'ping', id: Date.now() })
            })
        )
      )

      return {
        healthy: results.filter((r) => r.healthy).length,
        total: this.workers.length,
        workers: results,
      }
    }

    /**
     * 获取详细统计信息
     */
    getStats() {
      const workerStats = this.workers.map((w, i) => ({
        index: i,
        status: w ? w.status : 'not_exists',
        busy: w ? w.busy : false,
        uptime: w ? Date.now() - w.createdAt : 0,
        taskCount: w ? w.taskCount : 0,
        errorCount: w ? w.errorCount : 0,
        crashCount: w ? w.crashCount : 0,
        restartCount: w ? w.restartCount : 0,
      }))

      return {
        pool: {
          workerCount: this.workerCount,
          activeWorkers: this.workers.filter((w) => w && w.status !== 'unhealthy').length,
          pendingTasks: this.pendingTasks.size,
          queueLength: this.taskQueue.length,
          retryQueueLength: this.retryQueue.length,
        },
        tasks: {
          total: this.stats.totalTasks,
          successful: this.stats.successfulTasks,
          failed: this.stats.failedTasks,
          retried: this.stats.retriedTasks,
        },
        workers: workerStats,
        events: {
          crashes: this.stats.workerCrashes,
          restarts: this.stats.workerRestarts,
        },
        performance: {
          avgCompressTime: this._performanceMetrics.avgCompressTime.toFixed(2) + 'ms',
          totalCompressTime: this._performanceMetrics.totalCompressTime + 'ms',
          compressCount: this._performanceMetrics.compressCount,
          queueLengthPeak: this._performanceMetrics.queueLengthPeak,
        },
      }
    }

    /**
     * 销毁 Worker 池
     */
    destroy() {
      this.isDestroyed = true

      // 停止健康检测
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval)
        this.healthCheckInterval = null
      }

      // 拒绝所有待处理任务
      for (const [id, task] of this.pendingTasks) {
        task.reject(new Error('ImageCompressorPool 已销毁'))
      }
      this.pendingTasks.clear()

      // 清空队列
      this.taskQueue = []
      this.retryQueue = []

      // 终止所有 Worker
      for (const workerInfo of this.workers) {
        if (!workerInfo) {
          continue
        }
        try {
          workerInfo.worker.terminate()
        } catch {
          // ignore
        }
      }
      this.workers = []

      console.log('[ImageCompressorPool] 已销毁')
    }
  }

  // 导出 ImageCompressorPool
  window.ImageCompressorPool = ImageCompressorPool

  /**
   * ImageOptimizer - 图片/视频优化器
   * 功能：
   * 1. 懒加载 - IntersectionObserver实现(图片+视频)
   * 2. 本地压缩 - Web Worker + OffscreenCanvas
   * 3. WebP支持检测
   */
  class ImageOptimizer {
    constructor(options = {}) {
      // 懒加载配置
      this.lazyLoadThreshold = options.lazyLoadThreshold || 200
      this.lazyLoadEnabled = options.lazyLoadEnabled !== false

      // 压缩配置
      this.compressQuality = options.compressQuality || 0.8
      this.compressMinSize = options.compressMinSize || 51200 // 50KB
      this.compressEnabled = options.compressEnabled || false

      // 排除选择器
      this.excludeSelectors = options.excludeSelectors || [
        'img[data-no-lazy]',
        '.no-lazy img',
        'img[loading="eager"]',
      ]

      // 内部状态
      this.observer = null
      this._mutationObserver = null
      this._unsubscribe = null
      this._videoUnsubscribe = null
      this._videoObserver = null
      this._processedVideos = null
      this.processedImages = new WeakSet()
      this.stats = {
        lazyLoaded: 0,
        compressed: 0,
        skipped: 0,
        videosLazyLoaded: 0,
        compressionErrors: 0,
      }

      // WebP支持
      this._webpSupported = null

      // Worker 压缩池
      this.compressorPool = null
    }

    /**
     * 初始化
     */
    init() {
      if (this.lazyLoadEnabled) {
        this.initLazyLoad()
        this._initVideoLazyLoad()
      }

      // 初始化 Worker 压缩池
      if (this.compressEnabled) {
        try {
          this.compressorPool = new ImageCompressorPool(2)
        } catch (error) {
          console.warn('[ImageOptimizer] Worker 压缩池初始化失败，将使用主线程压缩:', error.message)
        }
      }

      console.log('[ImageOptimizer] 初始化完成', {
        lazyLoad: this.lazyLoadEnabled,
        compress: this.compressEnabled,
        workerPool: this.compressorPool ? 'enabled' : 'disabled',
      })
    }

    /**
     * 初始化懒加载
     */
    initLazyLoad() {
      if (this.observer) {
        this.observer.disconnect()
      }

      this.observer = new IntersectionObserver((entries) => this._handleIntersection(entries), {
        rootMargin: `${this.lazyLoadThreshold}px 0px`,
        threshold: 0.01,
      })

      // 观察现有图片
      this._observeImages()

      // 监听DOM变化
      this._watchDOM()

      console.log('[ImageOptimizer] 懒加载已启用')
    }

    /**
     * 处理交集变化
     * 优化：使用 requestIdleCallback 延迟非可视区图片处理，减少主线程阻塞
     */
    _handleIntersection(entries) {
      const visibleEntries = []
      const idleEntries = []

      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target
          // 可视区（rootMargin 范围内）的图片及时处理
          // 即将完全进入视口的图片用 requestIdleCallback 延迟
          if (entry.intersectionRatio >= 0.5 || el.tagName === 'VIDEO') {
            visibleEntries.push(el)
          } else {
            idleEntries.push(el)
          }
          this.observer.unobserve(el)
        }
      })

      // 立即处理高可视区图片和视频
      visibleEntries.forEach((el) => {
        if (el.tagName === 'VIDEO') {
          this._loadVideo(el)
        } else {
          this.loadImage(el)
        }
      })

      // 低可视区图片延迟到空闲时处理
      if (idleEntries.length > 0) {
        const processIdleEntries = () => {
          idleEntries.forEach((el) => {
            if (el.tagName === 'VIDEO') {
              this._loadVideo(el)
            } else {
              this.loadImage(el)
            }
          })
        }

        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(processIdleEntries, { timeout: 1000 })
        } else {
          // 降级：使用 setTimeout
          setTimeout(processIdleEntries, 0)
        }
      }
    }

    /**
     * 观察页面图片
     */
    _observeImages() {
      const images = document.querySelectorAll('img')
      images.forEach((img) => {
        if (this.shouldProcess(img)) {
          this.prepareLazyLoad(img)
          this.observer.observe(img)
        }
      })
    }

    /**
     * 监听 DOM 变化
     * 使用 UnifiedDOMWatcher 统一管理
     */
    _watchDOM() {
      // 检查 UnifiedDOMWatcher 是否可用
      if (!window.UnifiedDOMWatcher) {
        console.warn('[ImageOptimizer] UnifiedDOMWatcher 未加载，使用独立 MutationObserver')

        // 降级：使用独立 MutationObserver
        if (this._mutationObserver) {
          this._mutationObserver.disconnect()
        }

        this._mutationObserver = new MutationObserver((mutations) => {
          this._handleImageMutations(mutations)
        })

        this._mutationObserver.observe(document.body, {
          childList: true,
          subtree: true,
        })
        return
      }

      // 使用 UnifiedDOMWatcher 订阅图片变化
      this._unsubscribe = window.UnifiedDOMWatcher.subscribe(
        (mutations) => {
          this._handleImageMutations(mutations)
        },
        {
          priority: window.UnifiedDOMWatcher.Priority.NORMAL,
          name: 'ImageOptimizer-images',
          filter: (mutation) => {
            if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
              return false
            }
            for (const node of mutation.addedNodes) {
              if (node.nodeType !== 1) {
                continue
              }
              const tag = node.tagName
              if (tag === 'IMG' || tag === 'VIDEO') {
                return true
              }
              // 跳过本扩展内部节点
              if (node.dataset?.ycInternal === '1') {
                continue
              }
              if (node.querySelector?.('img, video')) {
                return true
              }
            }
            return false
          },
        }
      )
    }

    /**
     * 处理图片 DOM 变更
     */
    _handleImageMutations(mutations) {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'IMG' && this.shouldProcess(node)) {
            this.prepareLazyLoad(node)
            this.observer.observe(node)
          }
          // 检查子元素
          if (node.querySelectorAll) {
            const imgs = node.querySelectorAll('img')
            imgs.forEach((img) => {
              if (this.shouldProcess(img)) {
                this.prepareLazyLoad(img)
                this.observer.observe(img)
              }
            })
          }
        })
      })
    }

    /**
     * 准备懒加载
     * 保存原始src到data-src，设置占位图
     */
    prepareLazyLoad(img) {
      if (this.processedImages.has(img)) {
        return
      }
      if (!img.src || img.dataset.src) {
        return
      }

      // 保存原始src
      img.dataset.src = img.src

      // 设置占位图 (1x1透明像素)
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

      // 添加懒加载标记
      img.dataset.lazyLoading = 'true'

      this.processedImages.add(img)
    }

    /**
     * 判断URL是否同源
     */
    _isSameOrigin(url) {
      try {
        const imgUrl = new URL(url, location.href)
        return imgUrl.origin === location.origin
      } catch {
        return false
      }
    }

    /**
     * 加载图片
     * @param {HTMLImageElement} img - 图片元素
     * @param {number} priority - 优先级 (0-10, 高优先级任务优先处理)
     */
    async loadImage(img, priority = 5) {
      const originalSrc = img.dataset.src
      if (!originalSrc) {
        return
      }

      try {
        // 跨域图片跳过压缩，避免CORS错误
        const sameOrigin = this._isSameOrigin(originalSrc)
        if (this.compressEnabled && sameOrigin && (await this._shouldCompress(originalSrc))) {
          const compressedUrl = await this.compressImage(originalSrc, priority)
          if (compressedUrl) {
            img.src = compressedUrl
            this.stats.compressed++
          } else {
            img.src = originalSrc
          }
        } else {
          img.src = originalSrc
        }

        img.dataset.lazyLoading = 'false'
        img.dataset.lazyLoaded = 'true'
        this.stats.lazyLoaded++
      } catch (error) {
        img.src = originalSrc
      }
    }

    /**
     * 判断是否需要压缩
     */
    async _shouldCompress(url) {
      // 检查文件大小
      try {
        const response = await fetch(url, { method: 'HEAD' })
        const contentLength = response.headers.get('content-length')
        if (contentLength && parseInt(contentLength) < this.compressMinSize) {
          return false
        }
      } catch {
        // 无法获取大小，默认压缩
      }
      return true
    }

    /**
     * 压缩图片
     * 优先使用 Web Worker，失败时回退到主线程 Canvas API
     * @param {string} url - 图片 URL
     * @param {number} priority - 优先级 (0-10, 高优先级任务优先处理)
     * @returns {Promise<string>} - 压缩后的 Blob URL 或 dataUrl
     */
    async compressImage(url, priority = 0) {
      // 优先使用 Worker 压缩
      if (this.compressorPool) {
        try {
          const result = await this.compressorPool.compress(url, {
            quality: this.compressQuality,
            maxWidth: 1920,
            maxHeight: 1920,
            priority,
          })
          console.log(`[ImageOptimizer] Worker 压缩成功: ${url}`, {
            originalSize: result.originalSize,
            compressedSize: result.compressedSize,
            ratio: ((result.compressedSize / result.originalSize) * 100).toFixed(1) + '%',
          })
          return result.dataUrl
        } catch (error) {
          console.warn('[ImageOptimizer] Worker 压缩失败，回退到主线程:', error.message)
          this.stats.compressionErrors++
        }
      }

      // 回退到主线程压缩
      return this._compressOnMainThread(url)
    }

    /**
     * 主线程压缩（回退方案）
     */
    async _compressOnMainThread(url) {
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')

            // 计算压缩尺寸
            let { width, height } = img
            const maxSize = 1920

            if (width > maxSize || height > maxSize) {
              const ratio = Math.min(maxSize / width, maxSize / height)
              width = Math.floor(width * ratio)
              height = Math.floor(height * ratio)
            }

            canvas.width = width
            canvas.height = height

            // 绘制
            ctx.drawImage(img, 0, 0, width, height)

            // 确定格式
            const format = this.supportsWebP() ? 'image/webp' : 'image/jpeg'
            const quality = this.compressQuality

            // 转换为Blob
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const blobUrl = URL.createObjectURL(blob)
                  resolve(blobUrl)
                } else {
                  reject(new Error('压缩失败'))
                }
              },
              format,
              quality
            )
          } catch (error) {
            reject(error)
          }
        }

        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = url
      })
    }

    /**
     * 检测WebP支持
     */
    supportsWebP() {
      if (this._webpSupported !== null) {
        return this._webpSupported
      }

      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = 1
      this._webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0
      return this._webpSupported
    }

    /**
     * 检查是否应处理该图片
     */
    shouldProcess(img) {
      // 已处理
      if (this.processedImages.has(img)) {
        return false
      }

      // 无src
      if (!img.src && !img.dataset.src) {
        return false
      }

      // data URI 跳过
      if (img.src && img.src.startsWith('data:')) {
        return false
      }

      // 检查排除选择器
      for (const selector of this.excludeSelectors) {
        if (img.matches(selector)) {
          this.stats.skipped++
          return false
        }
      }

      return true
    }

    /**
     * 获取统计信息
     */
    getStats() {
      return { ...this.stats }
    }

    /**
     * 启用懒加载
     */
    enableLazyLoad() {
      this.lazyLoadEnabled = true
      this.initLazyLoad()
    }

    /**
     * 禁用懒加载
     */
    disableLazyLoad() {
      this.lazyLoadEnabled = false
      if (this.observer) {
        this.observer.disconnect()
        this.observer = null
      }

      // 取消 UnifiedDOMWatcher 订阅
      if (this._unsubscribe) {
        this._unsubscribe()
        this._unsubscribe = null
      }
      if (this._videoUnsubscribe) {
        this._videoUnsubscribe()
        this._videoUnsubscribe = null
      }

      // 停止独立 MutationObserver
      if (this._mutationObserver) {
        this._mutationObserver.disconnect()
        this._mutationObserver = null
      }
      if (this._videoObserver) {
        this._videoObserver.disconnect()
        this._videoObserver = null
      }
    }

    /**
     * 启用压缩
     */
    enableCompress() {
      this.compressEnabled = true
    }

    /**
     * 禁用压缩
     */
    disableCompress() {
      this.compressEnabled = false
    }

    /**
     * 初始化视频懒加载
     */
    _initVideoLazyLoad() {
      this._processedVideos = new WeakSet()

      // 处理已有视频
      document.querySelectorAll('video').forEach((v) => this._prepareVideo(v))

      // 使用 UnifiedDOMWatcher 监听动态添加
      if (window.UnifiedDOMWatcher) {
        this._videoUnsubscribe = window.UnifiedDOMWatcher.subscribe(
          (mutations) => {
            mutations.forEach((mutation) => {
              mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'VIDEO') {
                  this._prepareVideo(node)
                }
                if (node.querySelectorAll) {
                  node.querySelectorAll('video').forEach((v) => this._prepareVideo(v))
                }
              })
            })
          },
          {
            priority: window.UnifiedDOMWatcher.Priority.NORMAL,
            name: 'ImageOptimizer-videos',
            filter: (mutation) => {
              if (mutation.type !== 'childList' || mutation.addedNodes.length === 0) {
                return false
              }
              for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) {
                  continue
                }
                if (node.tagName === 'VIDEO') {
                  return true
                }
                if (node.dataset?.ycInternal === '1') {
                  continue
                }
                if (node.querySelector?.('video')) {
                  return true
                }
              }
              return false
            },
          }
        )
      } else {
        // 降级：使用独立 MutationObserver
        this._videoObserver = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.nodeName === 'VIDEO') {
                this._prepareVideo(node)
              }
              if (node.querySelectorAll) {
                node.querySelectorAll('video').forEach((v) => this._prepareVideo(v))
              }
            })
          })
        })

        this._videoObserver.observe(document.body, { childList: true, subtree: true })
      }

      // 视频懒加载的 IntersectionObserver(复用图片的)
      this._observeVideos()
    }

    /**
     * 观察视频元素
     */
    _observeVideos() {
      document.querySelectorAll('video').forEach((v) => {
        if (!this._processedVideos.has(v)) {
          if (this.observer) {
            this.observer.observe(v)
          }
        }
      })
    }

    /**
     * 准备视频懒加载
     */
    _prepareVideo(video) {
      if (this._processedVideos.has(video)) {
        return
      }

      // 保存原始 src/poster
      const sources = video.querySelectorAll('source')
      if (sources.length === 0 && !video.src) {
        return
      }

      // 已有 preload 设置则跳过
      if (video.preload === 'none') {
        return
      }

      // 保存原始 src
      if (video.src) {
        video.dataset.src = video.src
        video.src = ''
      }
      sources.forEach((source, i) => {
        if (source.src) {
          source.dataset.src = source.src
          source.src = ''
        }
      })

      // 设置 preload='none' 阻止自动加载
      video.preload = 'none'
      video.dataset.videoLazyLoading = 'true'
      this._processedVideos.add(video)

      // 用 IntersectionObserver 恢复
      if (this.observer) {
        this.observer.observe(video)
      }
    }

    /**
     * 加载懒加载的视频
     */
    _loadVideo(video) {
      if (!video.dataset.videoLazyLoading) {
        return
      }

      // 恢复 source src
      video.querySelectorAll('source').forEach((source) => {
        if (source.dataset.src) {
          source.src = source.dataset.src
          delete source.dataset.src
        }
      })

      // 恢复 video src
      if (video.dataset.src) {
        video.src = video.dataset.src
        delete video.dataset.src
      }

      video.dataset.videoLazyLoading = 'false'
      video.dataset.videoLazyLoaded = 'true'
      video.load()
      this.stats.videosLazyLoaded++
    }

    /**
     * 销毁
     */
    destroy() {
      this.disableLazyLoad()

      // 取消 UnifiedDOMWatcher 订阅
      if (this._unsubscribe) {
        this._unsubscribe()
        this._unsubscribe = null
      }
      if (this._videoUnsubscribe) {
        this._videoUnsubscribe()
        this._videoUnsubscribe = null
      }

      // 停止独立 Observer
      if (this._videoObserver) {
        this._videoObserver.disconnect()
        this._videoObserver = null
      }
      if (this._mutationObserver) {
        this._mutationObserver.disconnect()
        this._mutationObserver = null
      }

      // 销毁压缩池
      if (this.compressorPool) {
        this.compressorPool.destroy()
        this.compressorPool = null
      }

      this._processedVideos = new WeakSet()
      this.processedImages = new WeakSet()
      this.stats = {
        lazyLoaded: 0,
        compressed: 0,
        skipped: 0,
        videosLazyLoaded: 0,
        compressionErrors: 0,
      }
      console.log('[ImageOptimizer] 已销毁')
    }

    /**
     * 优雅降级
     * 分级降级：可单独禁用压缩或懒加载
     * @param {string} reason - 降级原因
     * @param {Object} options - 降级选项
     * @param {boolean} options.disableCompress - 是否禁用压缩
     * @param {boolean} options.disableLazyLoad - 是否禁用懒加载
     */
    gracefulDegradation(reason, options = {}) {
      console.warn(`[ImageOptimizer] 执行降级: ${reason}`)

      // 记录降级前的状态
      const prevState = { ...this.stats }

      // 根据选项执行分级降级
      if (options.disableCompress !== false) {
        // 禁用压缩
        this.compressEnabled = false
        console.log('[ImageOptimizer] 已禁用图片压缩')

        // 销毁压缩池
        if (this.compressorPool) {
          try {
            this.compressorPool.destroy()
          } catch {}
          this.compressorPool = null
        }
      }

      if (options.disableLazyLoad) {
        // 完全禁用懒加载
        this.lazyLoadEnabled = false
        console.log('[ImageOptimizer] 已禁用懒加载')

        // 停止所有 Observer
        if (this.observer) {
          try {
            this.observer.disconnect()
          } catch {}
          this.observer = null
        }

        if (this._unsubscribe) {
          try {
            this._unsubscribe()
          } catch {}
          this._unsubscribe = null
        }

        if (this._videoUnsubscribe) {
          try {
            this._videoUnsubscribe()
          } catch {}
          this._videoUnsubscribe = null
        }

        if (this._videoObserver) {
          try {
            this._videoObserver.disconnect()
          } catch {}
          this._videoObserver = null
        }

        if (this._mutationObserver) {
          try {
            this._mutationObserver.disconnect()
          } catch {}
          this._mutationObserver = null
        }
      }

      // 记录降级状态
      this.stats.degraded = true
      this.stats.degradationReason = reason
      this.stats.degradationTime = Date.now()
      this.stats.previousState = prevState
      this.stats.degradationOptions = options

      console.log('[ImageOptimizer] 降级完成，保留统计数据')
    }

    /**
     * 尝试从降级状态恢复
     * @param {Object} options - 恢复选项
     * @param {boolean} options.recoverCompress - 是否恢复压缩
     * @param {boolean} options.recoverLazyLoad - 是否恢复懒加载
     */
    async attemptRecovery(options = {}) {
      if (!this.stats.degraded) {
        console.log('[ImageOptimizer] 模块未降级，无需恢复')
        return false
      }

      try {
        const result = { compress: false, lazyLoad: false }

        // 恢复压缩功能
        if (
          options.recoverCompress !== false &&
          this.stats.degradationOptions?.disableCompress !== false
        ) {
          this.compressEnabled = true

          // 重新初始化压缩池
          try {
            this.compressorPool = new ImageCompressorPool(2)
            result.compress = true
            console.log('[ImageOptimizer] 压缩功能已恢复')
          } catch (error) {
            console.warn('[ImageOptimizer] 压缩池恢复失败:', error)
          }
        }

        // 恢复懒加载功能
        if (options.recoverLazyLoad && this.stats.degradationOptions?.disableLazyLoad) {
          this.lazyLoadEnabled = true

          // 重新初始化懒加载
          try {
            this.initLazyLoad()
            this._initVideoLazyLoad()
            result.lazyLoad = true
            console.log('[ImageOptimizer] 懒加载功能已恢复')
          } catch (error) {
            console.warn('[ImageOptimizer] 懒加载恢复失败:', error)
          }
        }

        // 清除降级标记（至少恢复了一项功能）
        if (result.compress || result.lazyLoad) {
          if (!this.compressEnabled && !this.lazyLoadEnabled) {
            // 两项功能都没有恢复，保持降级状态
            return false
          }

          this.stats.degraded = false
          delete this.stats.degradationReason
          delete this.stats.degradationTime
          delete this.stats.degradationOptions

          console.log('[ImageOptimizer] 从降级状态恢复成功')
          return true
        }

        return false
      } catch (error) {
        console.error('[ImageOptimizer] 恢复失败:', error)
        return false
      }
    }
  }

  // 导出
  window.ImageOptimizer = ImageOptimizer

  console.log('[ImageOptimizer] 图片优化模块已加载')
})()
