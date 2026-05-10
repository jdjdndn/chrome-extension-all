// ========== 模块热插拔管理 ==========
// 支持动态加载/卸载模块

(function () {
  'use strict'

  if (window.ModuleManager) {
    console.log('[ModuleManager] 已存在，跳过初始化')
    return
  }

  /**
   * ModuleManager - 模块管理器
   * 功能：
   * 1. 动态加载/卸载模块
   * 2. 模块依赖管理
   * 3. 模块状态追踪
   */
  const ModuleManager = {
    // 已加载的模块
    modules: new Map(),

    // 模块注册表
    registry: {},

    // 正在加载的模块
    loading: new Set(),

    /**
     * 注册模块
     * @param {object} moduleConfig - 模块配置
     */
    register(moduleConfig) {
      const { id, name, path, dependencies = [], priority = 0, autoLoad = true } = moduleConfig

      if (this.registry[id]) {
        console.warn(`[ModuleManager] 模块已注册: ${id}`)
        return false
      }

      this.registry[id] = {
        id,
        name,
        path,
        dependencies,
        priority,
        autoLoad,
        loaded: false,
      }

      console.log(`[ModuleManager] 注册模块: ${name} (${id})`)
      return true
    },

    /**
     * 批量注册模块
     * @param {array} modules - 模块数组
     */
    registerAll(modules) {
      for (const module of modules) {
        this.register(module)
      }
    },

    /**
     * 加载模块
     * @param {string} moduleId - 模块ID
     * @param {object} options - 选项
     */
    async load(moduleId, options = {}) {
      const config = this.registry[moduleId]
      if (!config) {
        console.error(`[ModuleManager] 模块未注册: ${moduleId}`)
        return { success: false, error: '模块未注册' }
      }

      if (this.modules.has(moduleId)) {
        return { success: true, message: '模块已加载' }
      }

      if (this.loading.has(moduleId)) {
        console.warn(`[ModuleManager] 模块正在加载: ${moduleId}`)
        return { success: false, error: '模块正在加载' }
      }

      this.loading.add(moduleId)

      try {
        // 1. 加载依赖
        for (const depId of config.dependencies) {
          const depResult = await this.load(depId)
          if (!depResult.success) {
            throw new Error(`依赖加载失败: ${depId}`)
          }
        }

        // 2. 加载模块脚本
        await this._loadScript(config.path)

        // 3. 初始化模块
        const moduleInstance = await this._initializeModule(moduleId, options)

        // 4. 保存实例
        this.modules.set(moduleId, {
          config,
          instance: moduleInstance,
          loadedAt: Date.now(),
        })

        config.loaded = true
        this.loading.delete(moduleId)

        console.log(`[ModuleManager] 模块加载完成: ${config.name}`)
        return { success: true, module: moduleInstance }
      } catch (error) {
        this.loading.delete(moduleId)
        console.error(`[ModuleManager] 模块加载失败: ${moduleId}`, error)
        return { success: false, error: error.message }
      }
    },

    /**
     * 卸载模块
     * @param {string} moduleId - 模块ID
     */
    async unload(moduleId) {
      const module = this.modules.get(moduleId)
      if (!module) {
        console.warn(`[ModuleManager] 模块未加载: ${moduleId}`)
        return { success: false, error: '模块未加载' }
      }

      try {
        // 1. 检查是否有其他模块依赖此模块
        for (const [id, m] of this.modules) {
          if (m.config.dependencies.includes(moduleId)) {
            console.warn(`[ModuleManager] 模块 ${id} 依赖 ${moduleId}，无法卸载`)
            return { success: false, error: `模块 ${id} 依赖此模块` }
          }
        }

        // 2. 调用销毁方法
        if (module.instance && typeof module.instance.destroy === 'function') {
          await module.instance.destroy()
        }

        // 3. 移除模块
        this.modules.delete(moduleId)
        module.config.loaded = false

        console.log(`[ModuleManager] 模块已卸载: ${module.config.name}`)
        return { success: true }
      } catch (error) {
        console.error(`[ModuleManager] 模块卸载失败: ${moduleId}`, error)
        return { success: false, error: error.message }
      }
    },

    /**
     * 重新加载模块
     * @param {string} moduleId - 模块ID
     */
    async reload(moduleId) {
      console.log(`[ModuleManager] 重新加载模块: ${moduleId}`)

      await this.unload(moduleId)
      return await this.load(moduleId)
    },

    /**
     * 加载脚本
     * @param {string} path - 脚本路径
     */
    async _loadScript(path) {
      return new Promise((resolve, reject) => {
        // 检查脚本是否已存在
        const existingScript = document.querySelector(`script[src="${path}"]`)
        if (existingScript) {
          resolve()
          return
        }

        const script = document.createElement('script')
        script.src = chrome.runtime.getURL(path)
        script.type = 'text/javascript'

        script.onload = () => {
          resolve()
        }

        script.onerror = () => {
          reject(new Error(`脚本加载失败: ${path}`))
        }
        ;(document.head || document.documentElement).appendChild(script)
      })
    },

    /**
     * 初始化模块
     */
    async _initializeModule(moduleId, options) {
      // 查找全局对象
      const globalMap = {
        store: 'AppStore',
        services: 'Services',
        pipeline: 'Pipeline',
        'site-factory': 'SiteFactory',
        'plugin-system': 'PluginSystem',
        'config-manager': 'ConfigManager',
        'selector-merger': 'SelectorMerger',
        'keyword-manager': 'KeywordManager',
        'rule-manager': 'RuleManager',
        'cache-manager': 'CacheManager',
        batch: 'BatchOps',
        'history-manager': 'HistoryManager',
        'rule-conflict': 'RuleConflictDetector',
        'debug-panel': 'DebugPanel',
        'lazy-loader': 'LazyLoader',
        'input-validator': 'InputValidator',
        'security-manager': 'SecurityManager',
        'config-migrator': 'ConfigMigrator',
        'extension-api': 'ExtensionAPI',
      }

      const globalName = globalMap[moduleId]
      if (globalName && window[globalName]) {
        const instance = window[globalName]
        if (typeof instance.init === 'function') {
          await instance.init(options)
        }
        return instance
      }

      return null
    },

    /**
     * 获取模块
     * @param {string} moduleId - 模块ID
     */
    get(moduleId) {
      return this.modules.get(moduleId)?.instance || null
    },

    /**
     * 检查模块是否已加载
     * @param {string} moduleId - 模块ID
     */
    isLoaded(moduleId) {
      return this.modules.has(moduleId)
    },

    /**
     * 获取所有已加载的模块
     */
    getLoadedModules() {
      return Array.from(this.modules.entries()).map(([id, m]) => ({
        id,
        name: m.config.name,
        loadedAt: m.loadedAt,
      }))
    },

    /**
     * 按优先级加载所有自动加载的模块
     */
    async loadAll() {
      const autoLoadModules = Object.values(this.registry)
        .filter((m) => m.autoLoad)
        .sort((a, b) => b.priority - a.priority)

      const results = []
      for (const module of autoLoadModules) {
        const result = await this.load(module.id)
        results.push({ id: module.id, ...result })
      }

      return results
    },

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        totalRegistered: Object.keys(this.registry).length,
        totalLoaded: this.modules.size,
        currentlyLoading: this.loading.size,
      }
    },
  }

  // 导出
  window.ModuleManager = ModuleManager

  console.log('[ModuleManager] 模块管理器已加载')
})()
