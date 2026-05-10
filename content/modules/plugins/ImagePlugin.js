/**
 * 图片处理插件示例
 * 展示如何使用插件架构实现图片压缩、延迟加载等功能
 */

import { Plugin } from './Plugin.js'

export class ImagePlugin extends Plugin {
  static get meta() {
    return {
      name: 'ImagePlugin',
      version: '1.0.0',
      description: '图片压缩、延迟加载、格式转换',
      author: 'ResourceAccelerator',
      dependencies: ['CachePlugin', 'WorkerPlugin']
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
        nearbyThreshold: 1 // 1屏
      }
    }
  }

  async init() {
    // 获取依赖插件
    this.cachePlugin = this.getPlugin('CachePlugin')
    this.workerPlugin = this.getPlugin('WorkerPlugin')

    // 创建图片专用缓存
    this.cache = this.createCache('images', {
      maxSize: 200,
      ttl: 30 * 60 * 1000 // 30分钟
    })

    // 初始化延迟加载观察器
    if (this.options.lazyLoad) {
      this._initLazyLoadObserver()
    }

    // 监听图片资源事件
    this.on('resource:image', this.handle.bind(this))

    this.log('info', 'init', {
      compress: this.options.compress,
      lazyLoad: this.options.lazyLoad
    })
  }

  async destroy() {
    if (this.lazyLoadObserver) {
      this.lazyLoadObserver.disconnect()
    }
    this.cache?.clear()
    this.log('info', 'destroy')
  }

  /**
   * 处理图片资源
   * @param {Object} data - { element, url }
   */
  async handle(data) {
    if (!this.enabled || !data) return null

    const { element, url } = data

    // 1. 检查缓存
    const cached = this.cache?.get(url)
    if (cached) {
      this.log('debug', 'cache_hit', { url })
      return cached
    }

    // 2. 位置检测
    const position = this._getPosition(element)

    // 3. 根据位置区域处理
    switch (position.zone) {
      case 'inViewport':
        // 视口内：立即加载+压缩
        return this._processImmediate(element, url, position.priority)

      case 'nearby':
        // 视口附近：延迟加载+压缩
        return this._processDeferred(element, url, position.priority)

      case 'far':
        // 远离视口：清空src，加入观察器
        return this._processLazy(element, url)

      default:
        return null
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

    const distanceToViewport = rect.top < 0
      ? -rect.top
      : rect.top > viewportHeight
        ? rect.top - viewportHeight
        : 0

    if (distanceToViewport === 0) {
      return { zone: 'inViewport', priority: 0, distance: 0 }
    }

    if (distanceToViewport <= threshold) {
      return {
        zone: 'nearby',
        priority: 10 + Math.floor((distanceToViewport / viewportHeight) * 10),
        distance: distanceToViewport
      }
    }

    return { zone: 'far', priority: 100, distance: distanceToViewport }
  }

  /**
   * 立即处理（视口内）
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

    // 加入压缩队列
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
   * 后台压缩
   */
  async _compressInBackground(element, url, priority) {
    try {
      const result = await this.workerPlugin.compressImage(url, {
        quality: this.options.quality,
        maxWidth: this.options.maxWidth,
        priority
      })

      if (result?.dataUrl && !element.dataset.compressed) {
        element.src = result.dataUrl
        element.dataset.compressed = 'true'

        // 缓存压缩结果
        this.cache?.set(url, result.dataUrl)

        this.log('debug', 'compressed', {
          url,
          originalSize: result.originalSize,
          compressedSize: result.compressedSize
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

    const threshold = this.options.positionAware?.nearbyThreshold || 1
    const rootMargin = `${threshold * 100}% 0px`

    this.lazyLoadObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target
          const url = img.dataset.lazySrc

          if (url) {
            img.src = url
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
    }, { rootMargin })

    this.log('info', 'lazy_load_observer_init', { threshold })
  }
}
