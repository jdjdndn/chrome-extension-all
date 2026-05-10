// ========== 站点脚本基类 ==========
// 提供站点脚本的通用能力

(function () {
  'use strict'

  if (window.SiteBase) {
    console.log('[SiteBase] 已存在，跳过初始化')
    return
  }

  /**
   * 站点脚本基类
   * 使用方法:
   * class MySite extends SiteBase {
   *   constructor() {
   *     super({
   *       domain: 'example.com',
   *       styleTagId: 'my-site-hide-style',
   *       defaultSelectors: ['.ad-banner'],
   *       localServerEnabled: true
   *     });
   *   }
   *
   *   customInit() {
   *     // 自定义初始化逻辑
   *   }
   * }
   */
  class SiteBase {
    constructor(options = {}) {
      const {
        domain = '',
        styleTagId = 'site-hide-style',
        defaultSelectors = [],
        blockedDomains = [],
        localServerEnabled = true,
        localServerUrl = 'http://localhost:3000',
      } = options

      this.domain = domain
      this.styleTagId = styleTagId
      this.defaultSelectors = [...defaultSelectors]
      this.blockedDomains = [...blockedDomains]
      this.localServerEnabled = localServerEnabled
      this.localServerUrl = localServerUrl

      // 状态
      this.state = {
        currentSelectors: [],
        localServerAvailable: false,
        initialized: false,
      }

      // 防止重复初始化
      this.initKey = `${domain}_site_loaded`
    }

    /**
     * 初始化站点脚本
     */
    async init() {
      if (window[this.initKey]) {
        console.log(`[${this.domain}] 脚本已加载，跳过`)
        return false
      }
      window[this.initKey] = true

      console.log(`[${this.domain}] 开始初始化...`)

      try {
        // 1. 检测本地服务
        if (this.localServerEnabled) {
          this.state.localServerAvailable = await this.checkLocalServer()
        }

        // 2. 注册阻止域名
        await this.registerBlockedDomains()

        // 3. 加载设置
        await this.loadSettings()

        // 4. 自定义初始化
        await this.customInit()

        // 5. 应用隐藏元素
        await this.applyHideElements()

        this.state.initialized = true
        console.log(`[${this.domain}] 初始化完成`)
        return true
      } catch (error) {
        console.error(`[${this.domain}] 初始化失败:`, error)
        return false
      }
    }

    /**
     * 检测本地服务是否可用
     */
    async checkLocalServer() {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 1000)

        const response = await fetch(`${this.localServerUrl}/health`, {
          signal: controller.signal,
        })
        clearTimeout(timeoutId)

        return response.ok
      } catch {
        return false
      }
    }

    /**
     * 注册阻止域名到 Background
     */
    async registerBlockedDomains() {
      if (this.blockedDomains.length === 0) {return}

      try {
        // 优先使用 Services
        if (typeof Services !== 'undefined') {
          await Services.domain.registerBlocked(this.domain, this.blockedDomains)
        } else if (typeof MessagingUtils !== 'undefined') {
          await MessagingUtils.registerBlockedDomains(this.domain, this.blockedDomains)
        }
        console.log(`[${this.domain}] 已注册 ${this.blockedDomains.length} 个阻止域名`)
      } catch (error) {
        console.warn(`[${this.domain}] 注册阻止域名失败:`, error.message)
      }
    }

    /**
     * 加载设置（子类可重写）
     */
    async loadSettings() {
      // 基类默认实现：从存储加载选择器
      const selectors = await this.loadSelectors()
      this.state.currentSelectors = selectors
    }

    /**
     * 自定义初始化（子类重写）
     */
    async customInit() {
      // 子类实现
    }

    /**
     * 加载选择器（优先级：服务器 > 存储 > 默认）
     */
    async loadSelectors() {
      const selectors = []

      // 1. 从本地服务器加载
      if (this.state.localServerAvailable) {
        const serverSelectors = await this.loadFromServer('selectors')
        if (Array.isArray(serverSelectors) && serverSelectors.length > 0) {
          selectors.push(...serverSelectors)
          console.log(`[${this.domain}] 从服务器加载 ${serverSelectors.length} 个选择器`)
        }
      }

      // 2. 从存储加载用户自定义
      const storedSelectors = await this.loadSelectorsFromStorage()
      if (Array.isArray(storedSelectors)) {
        selectors.push(...storedSelectors)
      }

      // 3. 添加默认选择器
      selectors.push(...this.defaultSelectors)

      // 去重
      return [...new Set(selectors)]
    }

    /**
     * 从存储加载选择器
     */
    async loadSelectorsFromStorage() {
      try {
        if (typeof Services !== 'undefined') {
          const settings = await Services.hideElements.getSettings()
          return settings?.selectors || []
        }

        if (typeof StorageUtils !== 'undefined') {
          const settings = await StorageUtils.getDomainSettings('hideElementsSettings', this.domain)
          return settings?.selectors || []
        }

        return []
      } catch {
        return []
      }
    }

    /**
     * 从本地服务器加载数据
     */
    async loadFromServer(path) {
      if (!this.state.localServerAvailable) {return null}

      try {
        const response = await fetch(`${this.localServerUrl}/api/data/${path}/${this.domain}`)
        if (!response.ok) {return null}

        const data = await response.json()
        return data?.success ? data.data : null
      } catch {
        return null
      }
    }

    /**
     * 保存数据到本地服务器
     */
    async saveToServer(path, data) {
      if (!this.state.localServerAvailable) {return false}

      try {
        const response = await fetch(`${this.localServerUrl}/api/data/${path}/${this.domain}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        return response.ok
      } catch {
        return false
      }
    }

    /**
     * 应用隐藏元素
     */
    async applyHideElements() {
      const selectors = this.state.currentSelectors

      if (!selectors || selectors.length === 0) {
        this.removeHideStyle()
        return
      }

      this.applyHideStyle(selectors)
      console.log(`[${this.domain}] 已应用 ${selectors.length} 个隐藏选择器`)
    }

    /**
     * 应用隐藏样式
     */
    applyHideStyle(selectors) {
      // 使用 DOMUtils 如果可用
      if (typeof DOMUtils !== 'undefined') {
        DOMUtils.applyHideStyle(this.styleTagId, selectors)
        return
      }

      // 降级实现
      let styleEl = document.getElementById(this.styleTagId)
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = this.styleTagId
        ;(document.head || document.documentElement).appendChild(styleEl)
      }

      const css = selectors
        .filter((s) => s && s.trim())
        .map((s) => `${s} { display: none !important; }`)
        .join('\n')

      styleEl.textContent = css
    }

    /**
     * 移除隐藏样式
     */
    removeHideStyle() {
      const styleEl = document.getElementById(this.styleTagId)
      if (styleEl) {
        styleEl.remove()
      }
    }

    /**
     * 更新隐藏元素
     */
    async updateHideElements(enabled, selectors) {
      if (enabled && selectors && selectors.length > 0) {
        this.state.currentSelectors = [...new Set([...this.defaultSelectors, ...selectors])]
        this.applyHideStyle(this.state.currentSelectors)
      } else {
        this.state.currentSelectors = [...this.defaultSelectors]
        this.applyHideStyle(this.state.currentSelectors)
      }

      // 保存到存储
      await this.saveSelectorsToStorage(this.state.currentSelectors)

      console.log(`[${this.domain}] 更新隐藏元素: ${this.state.currentSelectors.length} 个选择器`)
    }

    /**
     * 保存选择器到存储
     */
    async saveSelectorsToStorage(selectors) {
      try {
        if (typeof Services !== 'undefined') {
          await Services.hideElements.update(true, selectors)
        } else if (typeof StorageUtils !== 'undefined') {
          await StorageUtils.setDomainSettings('hideElementsSettings', this.domain, {
            enabled: true,
            selectors,
          })
        }
      } catch (error) {
        console.warn(`[${this.domain}] 保存选择器失败:`, error.message)
      }
    }

    /**
     * 创建消息处理器
     */
    createMessageHandler(handlers) {
      const handlerId = `${this.domain}_handler`

      if (typeof MessagingUtils !== 'undefined') {
        MessagingUtils.createMessageHandler(handlerId, {
          GET_DEFAULT_HIDE_SELECTORS: () => ({
            success: true,
            selectors: this.defaultSelectors,
          }),
          GET_CURRENT_HIDE_SELECTORS: () => ({
            success: true,
            selectors: this.state.currentSelectors,
          }),
          UPDATE_HIDE_ELEMENTS: (message) => {
            this.updateHideElements(message.enabled, message.selectors)
            return { success: true }
          },
          ...handlers,
        })
      }
    }

    /**
     * 导出配置
     */
    exportConfig() {
      return {
        domain: this.domain,
        defaultSelectors: this.defaultSelectors,
        blockedDomains: this.blockedDomains,
        localServerAvailable: this.state.localServerAvailable,
        currentSelectors: this.state.currentSelectors,
      }
    }
  }

  // 导出
  window.SiteBase = SiteBase

  console.log('[SiteBase] 站点脚本基类已加载')
})()
