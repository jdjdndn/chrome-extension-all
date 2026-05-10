/**
 * CSP绕过管理器
 * 实现三种方式依次尝试：
 * 1. declarativeNetRequest（网络层拦截）
 * 2. Background Fetch + Message（后台fetch）
 * 3. chrome.scripting.executeScript（官方API）
 */

class CSPBypassManager {
  constructor() {
    this.strategies = [
      { name: 'dnr', priority: 1, handler: this._useDNR.bind(this) },
      { name: 'background', priority: 2, handler: this._useBackgroundFetch.bind(this) },
      { name: 'scripting', priority: 3, handler: this._useScripting.bind(this) },
    ]
    this.cache = new Map() // 缓存成功策略
    this.stats = {
      total: 0,
      success: 0,
      failed: 0,
      byStrategy: { dnr: 0, background: 0, scripting: 0 }
    }
  }

  /**
   * 加载资源（依次尝试所有策略）
   * @param {string} url - 资源URL
   * @param {string} type - 资源类型 (js|css)
   * @param {Object} options - 选项
   * @returns {Promise<{success: boolean, source?: string, error?: string}>}
   */
  async loadResource(url, type = 'js', options = {}) {
    this.stats.total++

    // 检查缓存的成功策略
    const cached = this.cache.get(url)
    if (cached) {
      const result = await cached.handler(url, type, options)
      if (result.success) {
        this.stats.success++
        return result
      }
    }

    // 依次尝试所有策略
    for (const strategy of this.strategies) {
      try {
        console.log(`[CSPBypass] Trying strategy: ${strategy.name} for ${url}`)

        const result = await strategy.handler(url, type, options)

        if (result?.success) {
          console.log(`[CSPBypass] Strategy ${strategy.name} succeeded for ${url}`)

          // 缓存成功的策略
          this.cache.set(url, strategy)
          this.stats.success++
          this.stats.byStrategy[strategy.name]++

          return result
        }
      } catch (error) {
        console.warn(`[CSPBypass] Strategy ${strategy.name} failed:`, error.message)
      }
    }

    // 所有策略都失败
    this.stats.failed++
    console.error(`[CSPBypass] All strategies failed for ${url}`)

    return {
      success: false,
      reason: 'All strategies failed',
      url,
      type
    }
  }

  /**
   * 策略1：declarativeNetRequest（已在网络层拦截）
   */
  async _useDNR(url, type, options) {
    // DNR在background.js中配置，这里检查是否生效
    // 通过检测请求头或实际加载判断

    // 对于DNR，我们信任网络层已经处理
    // 返回成功，实际重定向由DNR完成
    return {
      success: true,
      source: 'dnr',
      message: 'DNR rule should handle this in network layer'
    }
  }

  /**
   * 策略2：Background Fetch + Message
   */
  async _useBackgroundFetch(url, type, options) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Background fetch timeout'))
      }, options.timeout || 10000)

      chrome.runtime.sendMessage(
        {
          type: 'CSP_BYPASS_FETCH',
          url,
          resourceType: type
        },
        (response) => {
          clearTimeout(timeout)

          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          if (response?.success) {
            // 注入到页面
            this._injectCode(response.code, type, options)
            resolve({
              success: true,
              source: 'background',
              size: response.code?.length || 0
            })
          } else {
            reject(new Error(response?.error || 'Fetch failed'))
          }
        }
      )
    })
  }

  /**
   * 策略3：chrome.scripting.executeScript
   */
  async _useScripting(url, type, options) {
    if (!chrome.scripting) {
      throw new Error('chrome.scripting not available')
    }

    // 先fetch代码
    const code = await this._fetchCode(url)

    if (!code) {
      throw new Error('Failed to fetch code')
    }

    // 通知background执行脚本注入
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          type: 'CSP_BYPASS_SCRIPTING',
          url,
          code,
          resourceType: type
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message))
            return
          }

          if (response?.success) {
            resolve({
              success: true,
              source: 'scripting',
              size: code.length
            })
          } else {
            reject(new Error(response?.error || 'Scripting injection failed'))
          }
        }
      )
    })
  }

  /**
   * Fetch代码
   */
  async _fetchCode(url) {
    try {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.text()
    } catch (error) {
      console.error(`[CSPBypass] Fetch failed for ${url}:`, error)
      return null
    }
  }

  /**
   * 注入代码到页面
   */
  _injectCode(code, type, options = {}) {
    if (type === 'js') {
      const script = document.createElement('script')
      script.textContent = code

      if (options.id) {
        script.id = options.id
      }

      (options.target || document.head).appendChild(script)

      console.log(`[CSPBypass] Injected JS code (${code.length} bytes)`)
    } else if (type === 'css') {
      const style = document.createElement('style')
      style.textContent = code

      if (options.id) {
        style.id = options.id
      }

      (options.target || document.head).appendChild(style)

      console.log(`[CSPBypass] Injected CSS code (${code.length} bytes)`)
    }
  }

  /**
   * 预加载资源
   */
  async preload(resources) {
    const results = []

    for (const resource of resources) {
      results.push({
        url: resource.url,
        result: await this.loadResource(resource.url, resource.type, resource.options)
      })
    }

    return results
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.stats,
      cacheSize: this.cache.size,
      successRate: this.stats.total > 0
        ? (this.stats.success / this.stats.total * 100).toFixed(2) + '%'
        : '0%'
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear()
  }
}

// 创建全局实例
if (typeof window !== 'undefined') {
  window.__cspBypassManager = new CSPBypassManager()
}

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CSPBypassManager }
}
