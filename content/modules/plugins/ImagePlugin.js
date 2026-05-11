/**
 * 图片处理插件
 * 支持压缩、延迟加载、首屏优化、滚动预测
 */

import { Plugin } from './Plugin.js'

export class ImagePlugin extends Plugin {
  static get meta() {
    return {
      name: 'ImagePlugin',
      version: '1.0.0',
      description: '图片压缩、延迟加载、位置感知',
      author: 'ResourceAccelerator',
      dependencies: ['CachePlugin', 'WorkerPlugin'],
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      compress: true,
      lazyLoad: true,
      quality: 0.8,
      minSize: 102400, // 100KB
      maxWidth: 2048,
      positionAware: {
        enabled: true,
        rootMargin: '200px 0px',
        threshold: [0, 0.1, 0.5, 1],
        nearbyThreshold: 1, // 1屏
      },
      firstScreen: {
        enabled: true,
        maxImages: 10,
        timeout: 1000, // DOMContentLoaded后1秒
      },
      scrollPrediction: {
        enabled: true,
        maxPredictions: 5,
        velocityThreshold: 3000, // px/s
      },
    }
  }

  async init() {
    // 获取依赖插件
    this.cachePlugin = this.getPlugin('CachePlugin')
    this.workerPlugin = this.getPlugin('WorkerPlugin')

    // 创建图片专用缓存
    this.cache = this.createCache('images', {
      maxSize: 200,
      ttl: 30 * 60 * 1000,
    })

    // 首屏图片列表
    this.firstScreenImages = []
    this.firstScreenCaptured = false

    // 优先级队列
    this.priorityQueue = []

    // 滚动状态
    this.scrollState = {
      lastScrollY: window.scrollY,
      lastTime: Date.now(),
      velocity: 0,
      direction: 'none',
    }

    // 初始化延迟加载观察器
    if (this.options.lazyLoad) {
      this._initLazyLoadObserver()
    }

    // 初始化首屏检测
    if (this.options.firstScreen?.enabled) {
      this._initFirstScreenDetection()
    }

    // 初始化滚动预测
    if (this.options.scrollPrediction?.enabled) {
      this._initScrollPrediction()
    }

    // 监听图片资源事件
    this.on('resource:image', this.handle.bind(this))

    this.log('info', 'init', {
      compress: this.options.compress,
      lazyLoad: this.options.lazyLoad,
      firstScreen: this.options.firstScreen?.enabled,
      scrollPrediction: this.options.scrollPrediction?.enabled,
    })
  }

  async destroy() {
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect()
    }

    if (this.scrollListener) {
      window.removeEventListener('scroll', this.scrollListener)
    }

    if (this.firstScreenTimer) {
      clearTimeout(this.firstScreenTimer)
    }

    this.cache?.clear()
    this.priorityQueue = []
    this.firstScreenImages = []

    this.log('info', 'destroy')
  }

  /**
   * 处理图片资源
   */
  async handle(data) {
    if (!this.enabled || !data) {
      return null
    }

    const { element, url } = data

    // 检查缓存
    const cached = this.cache?.get(url)
    if (cached) {
      this.log('debug', 'cache_hit', { url })
      return cached
    }

    // 检查是否首屏图片
    if (this._isFirstScreenImage(element)) {
      return this._processImmediate(element, url, 0)
    }

    // 位置检测
    const position = this._getPosition(element)

    // 根据位置区域处理
    switch (position.zone) {
      case 'inViewport':
        return this._processImmediate(element, url, position.priority)

      case 'nearby':
        return this._processDeferred(element, url, position.priority)

      case 'far':
        return this._processLazy(element, url)

      default:
        return null
    }
  }

  /**
   * 初始化首屏检测
   */
  _initFirstScreenDetection() {
    // DOMContentLoaded后开始采集首屏图片
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        this._captureFirstScreenImages()
      })
    } else {
      this._captureFirstScreenImages()
    }
  }

  /**
   * 采集首屏图片
   */
  _captureFirstScreenImages() {
    if (this.firstScreenCaptured) {
      return
    }

    const maxImages = this.options.firstScreen?.maxImages || 10
    const timeout = this.options.firstScreen?.timeout || 1000

    // 收集当前视口内的图片
    const collectImages = () => {
      const images = document.querySelectorAll('img[src]:not([data-lazy])')
      const viewportHeight = window.innerHeight

      let count = 0
      for (const img of images) {
        const rect = img.getBoundingClientRect()
        if (rect.top < viewportHeight && rect.bottom > 0) {
          this.firstScreenImages.push(img)
          img.dataset.firstScreen = 'true'
          count++
          if (count >= maxImages) {
            break
          }
        }
      }

      this.log('info', 'first_screen_captured', { count })
    }

    collectImages()

    // 设置超时，超时后停止采集
    this.firstScreenTimer = setTimeout(() => {
      this.firstScreenCaptured = true
    }, timeout)
  }

  /**
   * 检查是否首屏图片
   */
  _isFirstScreenImage(element) {
    return element.dataset.firstScreen === 'true' || this.firstScreenImages.includes(element)
  }

  /**
   * 初始化滚动预测
   */
  _initScrollPrediction() {
    this.scrollListener = this._handleScroll.bind(this)
    window.addEventListener('scroll', this.scrollListener, { passive: true })
  }

  /**
   * 处理滚动事件
   */
  _handleScroll() {
    const now = Date.now()
    const scrollY = window.scrollY
    const deltaY = scrollY - this.scrollState.lastScrollY
    const deltaTime = now - this.scrollState.lastTime

    if (deltaTime > 0) {
      this.scrollState.velocity = (Math.abs(deltaY) / deltaTime) * 1000 // px/s
      this.scrollState.direction = deltaY > 0 ? 'down' : deltaY < 0 ? 'up' : 'none'
    }

    this.scrollState.lastScrollY = scrollY
    this.scrollState.lastTime = now

    // 快速滚动时不预测
    const velocityThreshold = this.options.scrollPrediction?.velocityThreshold || 3000
    if (this.scrollState.velocity > velocityThreshold) {
      return
    }

    // 触发预测加载
    this._predictAndPreload()
  }

  /**
   * 预测并预加载
   */
  _predictAndPreload() {
    const maxPredictions = this.options.scrollPrediction?.maxPredictions || 5
    const viewportHeight = window.innerHeight
    const scrollY = window.scrollY

    // 预测未来1秒的位置
    const predictedScrollY =
      scrollY + this.scrollState.velocity * (this.scrollState.direction === 'down' ? 1 : -1)

    // 找出可能进入视口的图片
    const candidates = []
    const images = document.querySelectorAll('img[data-lazy-src]:not([data-loaded])')

    for (const img of images) {
      const rect = img.getBoundingClientRect()
      const absoluteTop = rect.top + scrollY
      const predictedTop = absoluteTop - predictedScrollY

      // 检查是否在预测视口范围内
      if (predictedTop < viewportHeight + viewportHeight && predictedTop > -viewportHeight) {
        candidates.push({
          element: img,
          distance: Math.abs(predictedTop),
          url: img.dataset.lazySrc,
        })
      }

      if (candidates.length >= maxPredictions) {
        break
      }
    }

    // 按距离排序，优先预加载最近的
    candidates.sort((a, b) => a.distance - b.distance)

    for (const candidate of candidates.slice(0, maxPredictions)) {
      this._preloadImage(candidate.element, candidate.url)
    }
  }

  /**
   * 预加载图片（低优先级）
   */
  async _preloadImage(element, url) {
    if (element.dataset.preloaded) {
      return
    }

    element.dataset.preloaded = 'true'

    try {
      // 使用低优先级预加载
      const response = await fetch(url, { priority: 'low' })
      const blob = await response.blob()

      // 创建预加载URL
      const objectUrl = URL.createObjectURL(blob)
      element.dataset.preloadUrl = objectUrl

      this.log('debug', 'preload', { url })
    } catch (error) {
      // 预加载失败，忽略
    }
  }

  /**
   * 获取元素位置信息
   */
  _getPosition(element) {
    if (!element || !element.isConnected) {
      return { zone: 'far', priority: 100, distance: Infinity }
    }

    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const threshold = (this.options.positionAware?.nearbyThreshold || 1) * viewportHeight

    const distanceToViewport =
      rect.top < 0 ? -rect.top : rect.top > viewportHeight ? rect.top - viewportHeight : 0

    // 计算距离奖励
    let distanceBonus = 0
    if (distanceToViewport === 0) {
      distanceBonus = 100 // 视口内
    } else if (distanceToViewport < 500) {
      distanceBonus = 50
    } else if (distanceToViewport < 1000) {
      distanceBonus = 20
    }

    if (distanceToViewport === 0) {
      return { zone: 'inViewport', priority: 0 - distanceBonus, distance: 0 }
    }

    if (distanceToViewport <= threshold) {
      return {
        zone: 'nearby',
        priority: 10 - distanceBonus,
        distance: distanceToViewport,
      }
    }

    return { zone: 'far', priority: 100 - distanceBonus, distance: distanceToViewport }
  }

  /**
   * 立即处理（视口内/首屏）
   */
  async _processImmediate(element, url, priority) {
    // 设置高优先级
    if ('fetchPriority' in element) {
      element.fetchPriority = 'high'
    }
    element.loading = 'eager'

    // 后台压缩
    if (this.options.compress && this.workerPlugin) {
      this._compressInBackground(element, url, priority)
    }

    this.log('debug', 'immediate', { url, priority })
    return { processed: true, zone: 'inViewport' }
  }

  /**
   * 延迟处理（视口附近）
   */
  async _processDeferred(element, url, priority) {
    element.loading = 'lazy'
    if ('fetchPriority' in element) {
      element.fetchPriority = 'auto'
    }

    // 加入优先级队列
    this._addToPriorityQueue(element, url, priority)

    // 后台压缩
    if (this.options.compress && this.workerPlugin) {
      this._compressInBackground(element, url, priority)
    }

    this.log('debug', 'deferred', { url, priority })
    return { processed: true, zone: 'nearby' }
  }

  /**
   * 懒加载处理（远离视口）
   */
  _processLazy(element, url) {
    // 清空src，保存原始URL
    if (!element.dataset.lazySrc) {
      element.dataset.lazySrc = url
      element.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    }

    if ('fetchPriority' in element) {
      element.fetchPriority = 'low'
    }
    element.loading = 'lazy'

    // 加入观察器
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.observe(element)
    }

    this.log('debug', 'lazy', { url })
    return { processed: true, zone: 'far' }
  }

  /**
   * 添加到优先级队列
   */
  _addToPriorityQueue(element, url, priority) {
    this.priorityQueue.push({ element, url, priority, timestamp: Date.now() })
    this.priorityQueue.sort((a, b) => a.priority - b.priority)

    // 限制队列大小
    if (this.priorityQueue.length > 50) {
      this.priorityQueue = this.priorityQueue.slice(0, 50)
    }
  }

  /**
   * 后台压缩
   */
  async _compressInBackground(element, url, priority) {
    try {
      const result = await this.workerPlugin.compressImage(url, {
        quality: this.options.quality,
        maxWidth: this.options.maxWidth,
        priority,
      })

      if (result?.dataUrl && !element.dataset.compressed) {
        element.src = result.dataUrl
        element.dataset.compressed = 'true'

        // 缓存压缩结果
        this.cache?.set(url, result.dataUrl)

        this.log('debug', 'compressed', {
          url,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize,
        })
      }
    } catch (error) {
      this.log('warn', 'compress_failed', { url, error: error.message })
    }
  }

  /**
   * 初始化延迟加载观察器
   */
  _initLazyLoadObserver() {
    if (typeof IntersectionObserver === 'undefined') {
      this.log('warn', 'intersection_observer_not_supported')
      return
    }

    const { rootMargin = '200px 0px', threshold = [0, 0.1, 0.5, 1] } =
      this.options.positionAware || {}

    this.lazyLoadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target
            const url = img.dataset.lazySrc || img.dataset.preloadUrl

            if (url) {
              img.src = url
              img.dataset.loaded = 'true'
              delete img.dataset.lazySrc

              // 触发压缩
              if (this.options.compress) {
                const position = this._getPosition(img)
                this._compressInBackground(img, url, position.priority)
              }

              this.emit('image:lazyLoaded', { element: img, url })
            }

            this.lazyLoadObserver.unobserve(img)
          }
        })
      },
      { rootMargin, threshold }
    )

    this.log('info', 'lazy_load_observer_init', { rootMargin, threshold })
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      firstScreenImages: this.firstScreenImages.length,
      queueLength: this.priorityQueue.length,
      scrollVelocity: this.scrollState.velocity,
      scrollDirection: this.scrollState.direction,
    }
  }
}
