// ========== 服务层抽象 ==========
// 统一封装与 Background 的通信，提供缓存、重试等能力

;(function () {
  'use strict'

  if (window.Services) {
    console.log('[Services] 已存在，跳过初始化')
    return
  }

  /**
   * 消息缓存管理器
   */
  const MessageCache = {
    cache: new Map(),
    defaultTTL: 60000, // 1分钟

    get(key) {
      const item = this.cache.get(key)
      if (!item) return null

      if (Date.now() - item.timestamp > item.ttl) {
        this.cache.delete(key)
        return null
      }

      return item.data
    },

    set(key, data, ttl = this.defaultTTL) {
      this.cache.set(key, {
        data,
        timestamp: Date.now(),
        ttl,
      })
    },

    invalidate(prefix) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(prefix)) {
          this.cache.delete(key)
        }
      }
    },

    clear() {
      this.cache.clear()
    },
  }

  /**
   * 消息重试管理器
   */
  const MessageRetry = {
    maxRetries: 3,
    retryDelay: 1000,

    async execute(fn, retries = this.maxRetries) {
      let lastError

      for (let i = 0; i < retries; i++) {
        try {
          const result = await fn()
          return result
        } catch (error) {
          lastError = error
          if (i < retries - 1) {
            await new Promise((r) => setTimeout(r, this.retryDelay * (i + 1)))
          }
        }
      }

      throw lastError
    },
  }

  /**
   * 发送消息到 Background
   */
  async function sendToBackground(type, data, options = {}) {
    const { cache = true, cacheTTL, retry = true } = options

    // 检查缓存
    const cacheKey = `${type}:${JSON.stringify(data)}`
    if (cache) {
      const cached = MessageCache.get(cacheKey)
      if (cached) {
        console.log(`[Services] 使用缓存: ${type}`)
        return cached
      }
    }

    // 发送消息
    const send = async () => {
      // 优先使用 EventBus
      if (typeof EventBus !== 'undefined' && EventBus.getState?.()?.isReady) {
        return await EventBus.request(type, data, { timeout: 5000 })
      }

      // 降级到原生 API
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        return await chrome.runtime.sendMessage({ type, ...data })
      }

      throw new Error('无法发送消息：无扩展上下文')
    }

    try {
      const result = retry ? await MessageRetry.execute(send) : await send()

      // 缓存结果
      if (cache && result?.success) {
        MessageCache.set(cacheKey, result, cacheTTL)
      }

      return result
    } catch (error) {
      console.error(`[Services] 发送失败: ${type}`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 服务层定义
   */
  const Services = {
    // ========== 域名管理服务 ==========
    domain: {
      /**
       * 获取当前域名
       */
      getCurrent() {
        return window.location?.hostname || null
      },

      /**
       * 检查域名是否被阻止
       */
      async checkBlocked(currentDomain, requestDomain) {
        return sendToBackground(
          'CHECK_DOMAIN_BLOCKED',
          {
            currentDomain,
            requestDomain,
          },
          { cache: false }
        )
      },

      /**
       * 添加阻止域名
       */
      async block(domain) {
        MessageCache.invalidate('CHECK_DOMAIN')
        return sendToBackground('ADD_BLOCKED_DOMAIN', { domain }, { cache: false })
      },

      /**
       * 移除阻止域名
       */
      async unblock(domain) {
        MessageCache.invalidate('CHECK_DOMAIN')
        return sendToBackground('REMOVE_BLOCKED_DOMAIN', { domain }, { cache: false })
      },

      /**
       * 获取阻止域名列表
       */
      async listBlocked() {
        return sendToBackground('GET_BLOCKED_DOMAINS', {}, { cache: true, cacheTTL: 30000 })
      },

      /**
       * 注册域名阻止规则
       */
      async registerBlocked(domain, blockedDomains) {
        MessageCache.invalidate('CHECK_DOMAIN')
        return sendToBackground(
          'REGISTER_BLOCKED_DOMAINS',
          {
            domain,
            blockedDomains,
          },
          { cache: false }
        )
      },
    },

    // ========== 设置管理服务 ==========
    settings: {
      /**
       * 获取设置
       */
      async get(key) {
        const result = await sendToBackground('STORAGE_GET', {
          keys: key,
          area: 'sync',
        })
        return result?.success ? result.data?.[key] : null
      },

      /**
       * 保存设置
       */
      async set(key, value) {
        MessageCache.invalidate('STORAGE_GET')
        return sendToBackground(
          'STORAGE_SET',
          {
            data: { [key]: value },
            area: 'sync',
          },
          { cache: false }
        )
      },

      /**
       * 获取调试模式状态
       */
      async getDebugMode() {
        return sendToBackground('GET_DEBUG_MODE', {}, { cache: true, cacheTTL: 60000 })
      },

      /**
       * 设置调试模式
       */
      async setDebugMode(enabled) {
        MessageCache.invalidate('GET_DEBUG_MODE')
        return sendToBackground('SET_DEBUG_MODE', { enabled }, { cache: false })
      },
    },

    // ========== 隐藏元素服务 ==========
    hideElements: {
      /**
       * 获取默认隐藏选择器
       */
      async getDefaultSelectors() {
        return sendToBackground('GET_DEFAULT_HIDE_SELECTORS', {}, { cache: true })
      },

      /**
       * 获取当前隐藏选择器
       */
      async getCurrentSelectors() {
        return sendToBackground('GET_CURRENT_HIDE_SELECTORS', {}, { cache: false })
      },

      /**
       * 更新隐藏元素设置
       */
      async update(enabled, selectors) {
        MessageCache.invalidate('GET_CURRENT_HIDE')
        return sendToBackground('UPDATE_HIDE_ELEMENTS', { enabled, selectors }, { cache: false })
      },

      /**
       * 获取设置
       */
      async getSettings() {
        return sendToBackground('GET_HIDE_ELEMENTS_SETTINGS', {}, { cache: false })
      },

      /**
       * 添加隐藏选择器
       */
      async addSelector(selector) {
        MessageCache.invalidate('GET_HIDE')
        return sendToBackground('ADD_HIDE_SELECTOR', { selector }, { cache: false })
      },

      /**
       * 移除隐藏选择器
       */
      async removeSelector(selector) {
        MessageCache.invalidate('GET_HIDE')
        return sendToBackground('REMOVE_HIDE_SELECTOR', { selector }, { cache: false })
      },
    },

    // ========== 扩展信息服务 ==========
    extension: {
      /**
       * 获取扩展信息
       */
      async getInfo() {
        return sendToBackground('GET_EXTENSION_INFO', {}, { cache: true, cacheTTL: 300000 })
      },

      /**
       * 切换扩展状态
       */
      async toggle(enabled, debugMode = false) {
        MessageCache.invalidate('GET_EXTENSION')
        return sendToBackground('TOGGLE_EXTENSION', { enabled, debugMode }, { cache: false })
      },

      /**
       * 获取性能指标
       */
      async getPerformance() {
        return sendToBackground('GET_PERFORMANCE', {}, { cache: false })
      },

      /**
       * 获取健康状态
       */
      async getHealth() {
        return sendToBackground('GET_HEALTH', {}, { cache: false })
      },
    },

    // ========== Mock 服务 ==========
    mock: {
      /**
       * 注册 Mock 规则
       */
      async register(url, response, statusCode = 200) {
        return sendToBackground('REGISTER_MOCK', { url, response, statusCode }, { cache: false })
      },

      /**
       * 取消 Mock
       */
      async unregister(url) {
        return sendToBackground('UNREGISTER_MOCK', { url }, { cache: false })
      },

      /**
       * 获取所有 Mock 规则
       */
      async list() {
        return sendToBackground('GET_MOCK_RULES', {}, { cache: false })
      },

      /**
       * 清空所有 Mock
       */
      async clear() {
        return sendToBackground('CLEAR_MOCK_RULES', {}, { cache: false })
      },

      /**
       * 检查 URL 是否有 Mock
       */
      async check(url) {
        return sendToBackground('CHECK_MOCK', { url }, { cache: true })
      },
    },

    // ========== 内存信息服务 ==========
    memory: {
      /**
       * 获取页面内存信息
       */
      async getInfo() {
        return sendToBackground('GET_MEMORY_INFO', {}, { cache: false })
      },

      /**
       * 清理 Cookies
       */
      async cleanCookies() {
        return sendToBackground('CLEANUP_COOKIES', {}, { cache: false })
      },

      /**
       * 清除浏览数据
       */
      async clearBrowsingData(since, dataTypes) {
        return sendToBackground('CLEAR_BROWSING_DATA', { since, dataTypes }, { cache: false })
      },
    },

    // ========== 工具方法 ==========
    utils: {
      /**
       * 清除所有缓存
       */
      clearCache() {
        MessageCache.clear()
      },

      /**
       * 清除指定前缀的缓存
       */
      invalidateCache(prefix) {
        MessageCache.invalidate(prefix)
      },

      /**
       * 直接发送消息（无缓存）
       */
      async send(type, data) {
        return sendToBackground(type, data, { cache: false })
      },
    },
  }

  // 导出
  window.Services = Services

  console.log('[Services] 服务层模块已加载')
})()
