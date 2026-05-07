// ========== 站点脚本工厂 ==========
// 统一工厂模式创建和管理站点脚本实例

;(function () {
  'use strict'

  if (window.SiteFactory) {
    console.log('[SiteFactory] 已存在，跳过初始化')
    return
  }

  /**
   * SiteScriptFactory - 站点脚本工厂
   * 功能：
   * 1. 统一注册和管理站点脚本类
   * 2. 根据域名自动检测和创建实例
   * 3. 支持优先级和覆盖机制
   */
  const SiteScriptFactory = {
    // 注册的站点类
    sites: new Map(),

    // 域名映射（支持通配符）
    domainMap: new Map(),

    // 当前活跃的站点实例
    activeInstances: new Map(),

    // 默认配置
    defaultOptions: {
      autoInit: true,
      localServerEnabled: true,
      localServerUrl: 'http://localhost:3000',
    },

    /**
     * 注册站点脚本类
     * @param {string} name - 站点名称
     * @param {class} SiteClass - 站点类（需继承 SiteBase）
     * @param {object} options - 配置选项
     */
    register(name, SiteClass, options = {}) {
      if (!SiteClass || typeof SiteClass !== 'function') {
        console.error(`[SiteFactory] 无效的站点类: ${name}`)
        return false
      }

      const config = {
        name,
        SiteClass,
        priority: options.priority || 0,
        domains: options.domains || [],
        patterns: options.patterns || [],
        enabled: options.enabled !== false,
      }

      this.sites.set(name, config)

      // 建立域名映射
      for (const domain of config.domains) {
        this.domainMap.set(domain, name)
      }

      console.log(`[SiteFactory] 注册站点: ${name}, 域名: ${config.domains.join(', ')}`)
      return true
    },

    /**
     * 批量注册站点
     * @param {object} sites - { name: { class, options } }
     */
    registerAll(sites) {
      for (const [name, config] of Object.entries(sites)) {
        this.register(name, config.class, config.options)
      }
    },

    /**
     * 注销站点
     * @param {string} name - 站点名称
     */
    unregister(name) {
      const config = this.sites.get(name)
      if (!config) return false

      // 清理域名映射
      for (const domain of config.domains) {
        this.domainMap.delete(domain)
      }

      // 清理实例
      this.activeInstances.delete(name)

      return this.sites.delete(name)
    },

    /**
     * 根据域名查找站点名称
     * @param {string} domain - 域名
     * @returns {string|null}
     */
    findSiteName(domain) {
      // 1. 精确匹配
      if (this.domainMap.has(domain)) {
        return this.domainMap.get(domain)
      }

      // 2. 去掉 www. 前缀匹配
      const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain
      if (this.domainMap.has(normalizedDomain)) {
        return this.domainMap.get(normalizedDomain)
      }

      // 3. 添加 www. 前缀匹配
      const wwwDomain = `www.${normalizedDomain}`
      if (this.domainMap.has(wwwDomain)) {
        return this.domainMap.get(wwwDomain)
      }

      // 4. 模式匹配（支持通配符）
      for (const [name, config] of this.sites) {
        for (const pattern of config.patterns) {
          if (this.matchPattern(domain, pattern)) {
            return name
          }
        }
      }

      return null
    },

    /**
     * 通配符模式匹配
     * @param {string} domain - 域名
     * @param {string} pattern - 模式（支持 * 通配符）
     * @returns {boolean}
     */
    matchPattern(domain, pattern) {
      if (pattern === '*') return true

      // 转换为正则表达式
      const regexStr = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*')
      const regex = new RegExp(`^${regexStr}$`, 'i')
      return regex.test(domain)
    },

    /**
     * 创建站点实例
     * @param {string} name - 站点名称
     * @param {object} options - 实例选项
     * @returns {object|null}
     */
    create(name, options = {}) {
      const config = this.sites.get(name)
      if (!config || !config.enabled) {
        console.warn(`[SiteFactory] 站点未找到或已禁用: ${name}`)
        return null
      }

      try {
        const mergedOptions = {
          ...this.defaultOptions,
          ...options,
        }

        const instance = new config.SiteClass(mergedOptions)

        // 记录活跃实例
        this.activeInstances.set(name, instance)

        console.log(`[SiteFactory] 创建站点实例: ${name}`)
        return instance
      } catch (error) {
        console.error(`[SiteFactory] 创建站点实例失败: ${name}`, error)
        return null
      }
    },

    /**
     * 自动检测并创建站点实例
     * @param {string} domain - 域名（可选，默认当前页面域名）
     * @returns {object|null}
     */
    async autoCreate(domain) {
      const targetDomain = domain || this.getCurrentDomain()
      if (!targetDomain) {
        console.warn('[SiteFactory] 无法获取当前域名')
        return null
      }

      const siteName = this.findSiteName(targetDomain)
      if (!siteName) {
        console.log(`[SiteFactory] 未找到匹配的站点: ${targetDomain}`)
        return null
      }

      const instance = this.create(siteName)
      if (instance && this.defaultOptions.autoInit) {
        await instance.init()
      }

      return instance
    },

    /**
     * 获取当前页面域名
     * @returns {string}
     */
    getCurrentDomain() {
      if (typeof DOMUtils !== 'undefined' && DOMUtils.getCurrentDomain) {
        return DOMUtils.getCurrentDomain()
      }
      try {
        return new URL(window.location.href).hostname
      } catch {
        return ''
      }
    },

    /**
     * 获取活跃实例
     * @param {string} name - 站点名称
     * @returns {object|null}
     */
    getInstance(name) {
      return this.activeInstances.get(name) || null
    },

    /**
     * 获取所有活跃实例
     * @returns {Map}
     */
    getAllInstances() {
      return new Map(this.activeInstances)
    },

    /**
     * 销毁实例
     * @param {string} name - 站点名称
     */
    async destroy(name) {
      const instance = this.activeInstances.get(name)
      if (!instance) return false

      try {
        // 调用实例的清理方法
        if (typeof instance.cleanup === 'function') {
          await instance.cleanup()
        }

        this.activeInstances.delete(name)
        console.log(`[SiteFactory] 销毁站点实例: ${name}`)
        return true
      } catch (error) {
        console.error(`[SiteFactory] 销毁站点实例失败: ${name}`, error)
        return false
      }
    },

    /**
     * 销毁所有实例
     */
    async destroyAll() {
      const names = Array.from(this.activeInstances.keys())
      for (const name of names) {
        await this.destroy(name)
      }
    },

    /**
     * 获取已注册站点列表
     * @returns {array}
     */
    listSites() {
      return Array.from(this.sites.entries()).map(([name, config]) => ({
        name,
        domains: config.domains,
        patterns: config.patterns,
        priority: config.priority,
        enabled: config.enabled,
      }))
    },

    /**
     * 检查域名是否有匹配的站点
     * @param {string} domain - 域名
     * @returns {boolean}
     */
    hasSite(domain) {
      return this.findSiteName(domain) !== null
    },

    /**
     * 启用/禁用站点
     * @param {string} name - 站点名称
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(name, enabled) {
      const config = this.sites.get(name)
      if (!config) return false
      config.enabled = enabled
      console.log(`[SiteFactory] ${enabled ? '启用' : '禁用'}站点: ${name}`)
      return true
    },

    /**
     * 导出配置
     */
    exportConfig() {
      return {
        sites: this.listSites(),
        defaultOptions: { ...this.defaultOptions },
      }
    },
  }

  // 导出
  window.SiteFactory = SiteScriptFactory

  console.log('[SiteFactory] 站点脚本工厂已加载')
})()
