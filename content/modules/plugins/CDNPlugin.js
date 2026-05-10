/**
 * CDN替换插件示例
 * 展示如何实现CDN URL替换功能
 */

import { Plugin } from './Plugin.js'

export class CDNPlugin extends Plugin {
  static get meta() {
    return {
      name: 'CDNPlugin',
      version: '1.0.0',
      description: 'CDN URL替换和健康检查',
      author: 'ResourceAccelerator',
      dependencies: []
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      healthCheck: {
        enabled: true,
        interval: 60000, // 1分钟
        timeout: 5000
      },
      fallback: true // 回退到原始URL
    }
  }

  async init() {
    // CDN映射表
    this.cdnMappings = new Map()
    this.cdnHealth = new Map()

    // 加载CDN配置
    await this._loadCDNConfig()

    // 启动健康检查
    if (this.options.healthCheck?.enabled) {
      this._startHealthCheck()
    }

    this.log('info', 'init', {
      cdns: this.cdnMappings.size,
      healthCheck: this.options.healthCheck?.enabled
    })
  }

  async destroy() {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer)
    }
    this.cdnMappings.clear()
    this.cdnHealth.clear()
  }

  /**
   * 替换URL为CDN URL
   * @param {string} url - 原始URL
   * @param {string} type - 资源类型 (js|css|font|image)
   * @returns {string|null} CDN URL或null
   */
  replace(url, type) {
    if (!this.enabled || !url) return null

    // 查找匹配的CDN映射
    for (const [cdnId, mapping] of this.cdnMappings.entries()) {
      if (this._matchesPattern(url, mapping.patterns)) {
        // 检查CDN健康状态
        const health = this.cdnHealth.get(cdnId)
        if (health && !health.healthy && this.options.fallback) {
          this.log('debug', 'cdn_unhealthy', { cdnId, url })
          continue
        }

        // 执行替换
        const cdnUrl = this._replaceUrl(url, mapping)
        if (cdnUrl) {
          this.log('debug', 'cdn_replaced', { from: url, to: cdnUrl, cdnId })
          return cdnUrl
        }
      }
    }

    return null
  }

  /**
   * 检查URL是否匹配模式
   */
  _matchesPattern(url, patterns) {
    if (!patterns || !Array.isArray(patterns)) return false

    return patterns.some(pattern => {
      if (typeof pattern === 'string') {
        return url.includes(pattern)
      }
      if (pattern instanceof RegExp) {
        return pattern.test(url)
      }
      return false
    })
  }

  /**
   * 执行URL替换
   */
  _replaceUrl(url, mapping) {
    try {
      const urlObj = new URL(url)

      // 替换域名
      if (mapping.host) {
        urlObj.host = mapping.host
      }

      // 替换路径
      if (mapping.pathReplace) {
        urlObj.pathname = urlObj.pathname.replace(
          mapping.pathReplace.from,
          mapping.pathReplace.to
        )
      }

      return urlObj.toString()
    } catch {
      return null
    }
  }

  /**
   * 加载CDN配置
   */
  async _loadCDNConfig() {
    // 示例CDN配置
    const cdnConfig = {
      'cdnjs': {
        host: 'cdnjs.cloudflare.com',
        patterns: [
          'cdnjs.cloudflare.com',
          'ajax.googleapis.com'
        ],
        priority: 1
      },
      'unpkg': {
        host: 'unpkg.com',
        patterns: [
          'unpkg.com',
          /npm\.jsdelivr\.net/
        ],
        priority: 2
      },
      'jsdelivr': {
        host: 'cdn.jsdelivr.net',
        patterns: [
          'cdn.jsdelivr.net',
          'fastly.jsdelivr.net'
        ],
        priority: 1
      }
    }

    for (const [id, config] of Object.entries(cdnConfig)) {
      this.cdnMappings.set(id, config)
      this.cdnHealth.set(id, { healthy: true, rtt: 0 })
    }
  }

  /**
   * 启动健康检查
   */
  _startHealthCheck() {
    this.healthCheckTimer = setInterval(() => {
      this._checkCDNHealth()
    }, this.options.healthCheck.interval)
  }

  /**
   * 检查CDN健康状态
   */
  async _checkCDNHealth() {
    for (const [cdnId, mapping] of this.cdnMappings.entries()) {
      try {
        const startTime = Date.now()

        // 发送探测请求
        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          this.options.healthCheck.timeout
        )

        const response = await fetch(`https://${mapping.host}/`, {
          method: 'HEAD',
          mode: 'no-cors',
          signal: controller.signal
        })

        clearTimeout(timeoutId)

        const rtt = Date.now() - startTime

        this.cdnHealth.set(cdnId, {
          healthy: true,
          rtt,
          lastCheck: Date.now()
        })

        this.emit('cdn:health', { cdnId, healthy: true, rtt })
      } catch (error) {
        this.cdnHealth.set(cdnId, {
          healthy: false,
          error: error.message,
          lastCheck: Date.now()
        })

        this.emit('cdn:health', { cdnId, healthy: false })
        this.log('warn', 'cdn_health_check_failed', { cdnId, error: error.message })
      }
    }
  }

  /**
   * 获取CDN健康状态
   */
  getHealthStatus() {
    const status = {}

    for (const [cdnId, health] of this.cdnHealth.entries()) {
      status[cdnId] = health
    }

    return status
  }
}
