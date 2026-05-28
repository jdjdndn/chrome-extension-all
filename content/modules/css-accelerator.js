/**
 * CSS加速器模块
 * 用国内CDN替换常见CSS框架，加速资源加载
 * 复用JSReplacer的MutationObserver+拦截模式
 */

(function () {
  'use strict'

  if (window.CSSAccelerator) {
    console.log('[CSSAccelerator] 已存在，跳过初始化')
    return
  }

  const LOG_PREFIX = '[CSSAccelerator]'

  class CSSAccelerator {
    constructor(options = {}) {
      this.enabled = options.enabled !== false
      this.excludePatterns = options.excludePatterns || []
      this.reportEnabled = options.reportEnabled !== false

      // 统计数据
      this.stats = {
        total: 0,
        replaced: 0,
        skipped: 0,
        errors: 0,
        degraded: false,
        details: [],
      }

      // 内部状态
      this._observer = null
      this._unsubscribe = null
      this._processedLinks = new WeakSet()

      console.log(`${LOG_PREFIX} 模块初始化完成`)
    }

    /**
     * 初始化
     */
    init() {
      if (!this.enabled) {
        console.log(`${LOG_PREFIX} 模块已禁用`)
        return
      }

      this._processExistingLinks()
      this._setupMutationObserver()

      console.log(`${LOG_PREFIX} 初始化完成，开始监听`)
    }

    /**
     * 处理已存在的link标签
     */
    _processExistingLinks() {
      const links = document.querySelectorAll('link[rel="stylesheet"]')
      links.forEach((link) => this.processLink(link))
    }

    /**
     * 监听动态 link 插入
     * 使用 UnifiedDOMWatcher 统一管理
     */
    _setupMutationObserver() {
      // 检查 UnifiedDOMWatcher 是否可用
      if (!window.UnifiedDOMWatcher) {
        console.warn(`${LOG_PREFIX} UnifiedDOMWatcher 未加载，跳过监听`)
        return
      }

      // 使用 UnifiedDOMWatcher 订阅，NORMAL 优先级
      this._unsubscribe = window.UnifiedDOMWatcher.subscribe(
        (mutations) => {
          mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
              if (node.tagName === 'LINK' && node.rel === 'stylesheet') {
                this.processLink(node)
              }
              if (node.querySelectorAll) {
                const links = node.querySelectorAll('link[rel="stylesheet"]')
                links.forEach((link) => this.processLink(link))
              }
            })
          })
        },
        {
          priority: window.UnifiedDOMWatcher.Priority.NORMAL,
          name: 'CSSAccelerator',
          filter: (mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0,
        }
      )
    }

    /**
     * 处理单个link标签
     */
    processLink(link) {
      if (!this.enabled) {
        return
      }

      const url = link.href
      if (!url) {
        return
      }

      if (this._processedLinks.has(link)) {
        return
      }
      this._processedLinks.add(link)

      this.stats.total++

      if (this._shouldExclude(url)) {
        this.stats.skipped++
        return
      }

      if (this._isTargetCDN(url)) {
        this.stats.skipped++
        return
      }

      const match = window.CDNMappings?.matchCSS(url)
      if (!match) {
        this.stats.skipped++
        return
      }

      try {
        const originalHref = link.href
        link.href = match.cdnUrl

        this.stats.replaced++
        console.log(`${LOG_PREFIX} 替换: ${match.name}`)
        console.log(`  原始: ${originalHref}`)
        console.log(`  CDN: ${match.cdnUrl}`)

        this._reportReplacement(match)

        this.stats.details.push({
          name: match.name,
          original: originalHref,
          cdn: match.cdnUrl,
          time: Date.now(),
        })
      } catch (error) {
        this.stats.errors++
        console.error(`${LOG_PREFIX} 替换失败:`, error)
        if (this.stats.errors >= 5 && !this.stats.degraded) {
          this.stats.degraded = true
          this.stats.degradationReason = 'too_many_errors'
          this.stats.degradationTime = Date.now()
          console.warn(`${LOG_PREFIX} 错误次数过多，模块已降级`)
        }
      }
    }

    _isTargetCDN(url) {
      return ['cdn.bootcdn.net', 'fonts.font.im', 'fonts.loli.net'].some((cdn) => url.includes(cdn))
    }

    _shouldExclude(url) {
      if (!url || typeof url !== 'string') {
        return true
      }

      const defaultExcludes = [
        /^chrome-extension:/i,
        /^moz-extension:/i,
        /^about:/i,
        /^data:/i,
        /^javascript:/i,
        /\/local\//i,
        /\/internal\//i,
      ]

      if (defaultExcludes.some((pattern) => pattern.test(url))) {
        return true
      }
      return this.excludePatterns.some((pattern) => pattern.test(url))
    }

    _reportReplacement(match) {
      if (!this.reportEnabled) {
        return
      }

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'CSS_ACCELERATOR_STATS',
            data: {
              name: match.name,
              originalUrl: match.originalUrl,
              cdnUrl: match.cdnUrl,
              cdnName: match.cdnName,
              timestamp: Date.now(),
            },
          })
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 上报失败:`, error.message)
      }
    }

    getStats() {
      return { ...this.stats, enabled: this.enabled }
    }

    enable() {
      this.enabled = true
      console.log(`${LOG_PREFIX} 模块已启用`)
    }

    disable() {
      this.enabled = false
      console.log(`${LOG_PREFIX} 模块已禁用`)
    }

    destroy() {
      // 取消 UnifiedDOMWatcher 订阅
      if (this._unsubscribe) {
        this._unsubscribe()
        this._unsubscribe = null
      }

      // 停止 MutationObserver（兼容旧逻辑）
      if (this._observer) {
        this._observer.disconnect()
        this._observer = null
      }

      this.enabled = false
      this._processedLinks = new WeakSet()
      console.log(`${LOG_PREFIX} 模块已销毁`)
    }

    /**
     * 尝试从降级状态恢复
     */
    async attemptRecovery() {
      if (!this.stats.degraded) {
        console.log(`${LOG_PREFIX} 模块未降级，无需恢复`)
        return false
      }

      try {
        // 重新启用
        this.enabled = true

        // 重新设置监听
        this._setupMutationObserver()

        // 清除降级标记
        this.stats.degraded = false
        delete this.stats.degradationReason
        delete this.stats.degradationTime

        console.log(`${LOG_PREFIX} 从降级状态恢复成功`)
        return true
      } catch (error) {
        console.error(`${LOG_PREFIX} 恢复失败:`, error)
        this.enabled = false
        return false
      }
    }
  }

  window.CSSAccelerator = CSSAccelerator

  console.log('[CSSAccelerator] CSS加速器模块已加载')
})()
