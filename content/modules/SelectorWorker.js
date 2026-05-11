/**
 * Web Worker 选择器计算模块
 * 在独立线程中进行复杂的选择器计算，避免阻塞主线程
 *
 * Manifest V3 兼容：使用 chrome.runtime.getURL() 加载独立 Worker 文件
 * 避免 CSP 限制导致的 Blob URL 创建失败
 */
(function () {
  'use strict'

  // 确定性属性白名单（用于元素数据提取）
  const STABLE_ATTRIBUTES = new Set([
    'type',
    'role',
    'data-type',
    'data-role',
    'data-kind',
    'data-variant',
    'data-size',
    'data-testid',
    'data-test',
    'data-id',
    'lang',
    'dir',
    'target',
    'rel',
    'colspan',
    'rowspan',
    'scope',
    'disabled',
    'readonly',
    'required',
    'checked',
    'multiple',
  ])

  // 默认超时时间（毫秒）
  const DEFAULT_TIMEOUT = 5000

  class SelectorWorker {
    constructor(options = {}) {
      this.worker = null
      this.pendingTasks = new Map()
      this.taskIdCounter = 0
      this._isAvailable = false
      this._timeout = options.timeout || DEFAULT_TIMEOUT
      this.init()
    }

    init() {
      // 使用统一 Worker 创建工具
      this.worker = this._createWorker()
      this._isAvailable = this.worker !== null
    }

    /**
     * 创建 Worker 实例
     * @private
     */
    _createWorker() {
      try {
        // 检查环境支持
        if (typeof Worker === 'undefined' || typeof chrome === 'undefined' || !chrome.runtime) {
          console.warn('[SelectorWorker] 环境不支持 Worker')
          return null
        }

        const workerUrl = chrome.runtime.getURL('content/workers/selector.worker.js')
        const worker = new Worker(workerUrl)

        worker.onmessage = (e) => {
          const { type, taskId, result, error } = e.data
          const task = this.pendingTasks.get(taskId)
          if (task) {
            this.pendingTasks.delete(taskId)
            // 清理超时定时器
            if (task.timeout) {
              clearTimeout(task.timeout)
            }
            if (type === 'RESULT') {
              task.resolve(result)
            } else if (type === 'ERROR') {
              task.reject(new Error(error))
            }
          }
        }

        worker.onerror = (e) => {
          // 检测 CSP 错误
          if (e.message && e.message.includes('Content Security Policy')) {
            console.warn('[SelectorWorker] Worker 被 CSP 阻止，禁用选择器 Worker 功能')
            this._isAvailable = false
            return
          }
          // 已禁用时不处理
          if (!this._isAvailable) {
            return
          }
          console.error('[SelectorWorker] Worker error:', e)
          // 尝试重建 Worker
          this._handleWorkerError(e)
        }

        return worker
      } catch (e) {
        console.warn('[SelectorWorker] Worker 初始化失败:', e.message)
        return null
      }
    }

    /**
     * 处理 Worker 错误并尝试降级
     * @private
     */
    _handleWorkerError() {
      // 如果 Worker 崩溃，尝试重建
      if (this.worker && this.pendingTasks.size > 0) {
        console.log('[SelectorWorker] 尝试重建 Worker...')
        const newWorker = this._createWorker()
        if (newWorker) {
          this.worker = newWorker
          // 重新发送待处理任务
          for (const [, task] of this.pendingTasks) {
            this.worker.postMessage(task.message)
          }
        }
      }
    }

    /**
     * 检查 Worker 是否可用
     */
    isAvailable() {
      return this._isAvailable && this.worker !== null
    }

    /**
     * 主线程降级计算选择器
     * @private
     */
    _fallbackGenerateSelector(element) {
      if (!element || !element.tagName) {
        return null
      }

      const tag = element.tagName.toLowerCase()
      const id = element.id

      if (id && !id.includes(' ') && !/^\d/.test(id)) {
        return { selector: '#' + CSS.escape(id), strategy: 'id', score: 100 }
      }

      if (element.className && typeof element.className === 'string') {
        const classes = element.className
          .trim()
          .split(' ')
          .filter((c) => c && !/^(css-|styled-|sc-|js-|_)/.test(c))
        if (classes.length > 0) {
          return { selector: tag + '.' + CSS.escape(classes[0]), strategy: 'class', score: 85 }
        }
      }

      return { selector: tag, strategy: 'tag', score: 20 }
    }

    /**
     * 创建带超时的任务
     * @private
     */
    _createTask(config) {
      return new Promise((resolve, reject) => {
        const taskId = ++this.taskIdCounter
        const { type, data } = config

        // 设置超时
        const timeout = setTimeout(() => {
          this.pendingTasks.delete(taskId)
          reject(new Error('Worker timeout'))
        }, this._timeout)

        const message = { type, data, taskId }

        this.pendingTasks.set(taskId, { resolve, reject, message, timeout })
        this.worker.postMessage(message)
      })
    }

    /**
     * 生成选择器
     */
    generateSelector(element) {
      // 降级：Worker 不可用时使用主线程计算
      if (!this.isAvailable()) {
        return Promise.resolve(this._fallbackGenerateSelector(element))
      }

      const data = this._extractElementData(element)
      return this._createTask({ type: 'GENERATE_SELECTOR', data })
    }

    /**
     * 批量生成选择器
     */
    batchGenerate(elements) {
      // 降级：Worker 不可用时使用主线程计算
      if (!this.isAvailable()) {
        return Promise.resolve(elements.map((el) => this._fallbackGenerateSelector(el)))
      }

      const data = elements.map((el) => this._extractElementData(el))
      return this._createTask({ type: 'BATCH_GENERATE', data: { elements: data } })
    }

    /**
     * 生成合并选择器
     */
    generateMergedSelector(elements) {
      // 降级：Worker 不可用时返回第一个元素的选择器
      if (!this.isAvailable()) {
        if (!elements || elements.length === 0) {
          return Promise.resolve(null)
        }
        return Promise.resolve(this._fallbackGenerateSelector(elements[0]))
      }

      const data = elements.map((el) => this._extractElementData(el))
      return this._createTask({ type: 'GENERATE_MERGED_SELECTOR', data: { elements: data } })
    }

    /**
     * 分析选择器质量
     */
    analyzeQuality(selector) {
      // 降级：Worker 不可用时返回基础分析
      if (!this.isAvailable()) {
        return Promise.resolve(this._fallbackAnalyzeQuality(selector))
      }

      return this._createTask({ type: 'ANALYZE_QUALITY', data: { selector } })
    }

    /**
     * 主线程降级分析选择器质量
     * @private
     */
    _fallbackAnalyzeQuality(selector) {
      const analysis = { score: 50, issues: [], suggestions: [], details: {} }
      if (!selector) {
        analysis.issues.push('选择器为空')
        analysis.score = 0
        return analysis
      }
      if (selector.startsWith('#')) {
        analysis.score += 30
        analysis.details.hasId = true
      }
      if (selector.includes(':nth')) {
        analysis.issues.push('使用了位置选择器')
        analysis.score -= 15
      }
      analysis.score = Math.max(0, Math.min(100, analysis.score))
      return analysis
    }

    /**
     * 提取元素数据（用于传递给 Worker）
     */
    _extractElementData(element) {
      if (!element || !element.tagName) {
        return null
      }

      const tag = element.tagName.toLowerCase()
      const id = element.id || null

      // 提取 class
      const classes = []
      if (element.className && typeof element.className === 'string') {
        const allClasses = element.className.trim().split(' ')
        for (const c of allClasses) {
          if (c && !/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|data-|ep-)/.test(c)) {
            classes.push(c)
          }
        }
      }

      // 提取属性
      const attributes = []
      if (element.attributes) {
        for (const attr of element.attributes) {
          if (
            STABLE_ATTRIBUTES.has(attr.name) &&
            attr.value &&
            attr.value.length < 50 &&
            !/^\d+$/.test(attr.value)
          ) {
            attributes.push({ name: attr.name, value: attr.value })
          }
        }
      }

      // 构建路径
      const path = []
      let current = element.parentElement
      while (current && current !== document.documentElement && path.length < 4) {
        const t = current.tagName.toLowerCase()
        const c =
          current.className && typeof current.className === 'string'
            ? current.className
                .trim()
                .split(' ')
                .find((c) => !/^(css-|styled-|sc-|js-|_)/.test(c))
            : null

        if (c) {
          path.unshift(t + '.' + c)
        } else {
          path.unshift(t)
        }
        current = current.parentElement
      }

      // 计算 nth-of-type
      let nthOfType = 0
      const parent = element.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === element.tagName)
        if (siblings.length > 1) {
          nthOfType = siblings.indexOf(element) + 1
        }
      }

      return { tag, id, classes, attributes, path, nthOfType }
    }

    /**
     * 销毁
     */
    destroy() {
      if (this.worker) {
        this.worker.terminate()
        this.worker = null
      }
      // 拒绝所有 pending 任务
      for (const [, task] of this.pendingTasks) {
        if (task.reject) {
          task.reject(new Error('Worker destroyed'))
        }
        if (task.timeout) {
          clearTimeout(task.timeout)
        }
      }
      this.pendingTasks.clear()
    }
  }

  // 导出
  window.SelectorWorker = SelectorWorker
})()
