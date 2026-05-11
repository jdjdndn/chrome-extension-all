/**
 * 资源加速器核心引擎
 * 负责插件管理、事件协调、配置管理、错误边界
 */

export class ResourceAcceleratorCore {
  constructor(config = {}) {
    this.config = config
    this.state = {
      initialized: false,
      plugins: new Map(),
      eventListeners: new Map(),
      caches: new Map(),
      degradedModules: new Set(), // 降级模块集合
      errorLog: [], // 错误日志
    }

    // 降级策略
    this.fallbackStrategies = new Map()

    // 绑定方法
    this.emit = this.emit.bind(this)
    this.on = this.on.bind(this)
    this.off = this.off.bind(this)
    this.handleError = this.handleError.bind(this)
  }

  /**
   * 注册降级策略
   * @param {string} moduleName - 模块名称
   * @param {Function} fallback - 降级函数
   */
  registerFallback(moduleName, fallback) {
    this.fallbackStrategies.set(moduleName, fallback)
    console.log(`[ResourceAcceleratorCore] Fallback registered: ${moduleName}`)
  }

  /**
   * 全局错误处理
   * @param {Error} error - 错误对象
   * @param {string} moduleName - 模块名称
   * @param {Object} context - 上下文信息
   */
  handleError(error, moduleName, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      module: moduleName,
      error: error.message,
      stack: error.stack,
      context,
    }

    // 记录错误日志
    this.state.errorLog.push(errorRecord)
    if (this.state.errorLog.length > 100) {
      this.state.errorLog.shift()
    }

    console.error(`[ResourceAcceleratorCore] Error in ${moduleName}:`, error)

    // 触发错误事件
    this.emit('error', errorRecord)

    // 尝试降级
    const fallback = this.fallbackStrategies.get(moduleName)
    if (fallback) {
      try {
        this.state.degradedModules.add(moduleName)
        const result = fallback(error, context)

        // 发送降级通知
        this.emit('module:degraded', {
          module: moduleName,
          fallback: true,
          timestamp: Date.now(),
        })

        return result
      } catch (fallbackError) {
        console.error(`[ResourceAcceleratorCore] Fallback failed for ${moduleName}:`, fallbackError)
        this._disableModule(moduleName)
      }
    } else {
      this._disableModule(moduleName)
    }

    return null
  }

  /**
   * 禁用模块
   * @param {string} moduleName - 模块名称
   */
  _disableModule(moduleName) {
    this.state.degradedModules.add(moduleName)

    this.emit('module:disabled', {
      module: moduleName,
      reason: 'error',
      timestamp: Date.now(),
    })

    console.warn(`[ResourceAcceleratorCore] Module disabled: ${moduleName}`)
  }

  /**
   * 检查模块是否可用
   * @param {string} moduleName - 模块名称
   * @returns {boolean}
   */
  isModuleAvailable(moduleName) {
    return !this.state.degradedModules.has(moduleName)
  }

  /**
   * 安全执行（带错误边界）
   * @param {string} moduleName - 模块名称
   * @param {Function} fn - 执行函数
   * @param {Object} context - 上下文
   * @returns {any}
   */
  async safeExecute(moduleName, fn, context = {}) {
    if (!this.isModuleAvailable(moduleName)) {
      console.warn(`[ResourceAcceleratorCore] Module ${moduleName} is disabled, skipping`)
      return null
    }

    try {
      return await fn()
    } catch (error) {
      return this.handleError(error, moduleName, context)
    }
  }

  /**
   * 注册插件
   * @param {Function} PluginClass - 插件类
   * @param {Object} options - 插件配置
   * @returns {Object} 插件实例
   */
  registerPlugin(PluginClass, options = {}) {
    const meta = PluginClass.meta

    if (!meta || !meta.name) {
      throw new Error('Plugin must have static meta.name property')
    }

    // 检查依赖
    const dependencies = meta.dependencies || []
    for (const dep of dependencies) {
      if (!this.state.plugins.has(dep)) {
        throw new Error(`Plugin ${meta.name} depends on ${dep}, but not registered`)
      }
    }

    // 合并配置
    const pluginConfig = { ...PluginClass.defaultConfig, ...options }

    // 创建实例
    const plugin = new PluginClass(this, pluginConfig)

    this.state.plugins.set(meta.name, plugin)

    console.log(`[ResourceAcceleratorCore] Plugin registered: ${meta.name}`)

    return plugin
  }

  /**
   * 获取插件实例
   * @param {string} name - 插件名称
   * @returns {Object|null} 插件实例
   */
  getPlugin(name) {
    return this.state.plugins.get(name) || null
  }

  /**
   * 初始化所有插件
   */
  async init() {
    if (this.state.initialized) {
      console.warn('[ResourceAcceleratorCore] Already initialized')
      return
    }

    // 按依赖顺序初始化
    const initOrder = this._resolveInitOrder()

    for (const name of initOrder) {
      const plugin = this.state.plugins.get(name)
      if (plugin && typeof plugin.init === 'function') {
        try {
          await plugin.init()
          console.log(`[ResourceAcceleratorCore] Plugin initialized: ${name}`)
        } catch (error) {
          this.handleError(error, name, { phase: 'init' })
        }
      }
    }

    this.state.initialized = true
    console.log('[ResourceAcceleratorCore] All plugins initialized')
  }

  /**
   * 销毁所有插件
   */
  async destroy() {
    const destroyOrder = [...this.state.plugins.keys()].reverse()

    for (const name of destroyOrder) {
      const plugin = this.state.plugins.get(name)
      if (plugin && typeof plugin.destroy === 'function') {
        try {
          await plugin.destroy()
          console.log(`[ResourceAcceleratorCore] Plugin destroyed: ${name}`)
        } catch (error) {
          console.error(`[ResourceAcceleratorCore] Failed to destroy plugin ${name}:`, error)
        }
      }
    }

    this.state.plugins.clear()
    this.state.eventListeners.clear()
    this.state.caches.clear()
    this.state.degradedModules.clear()
    this.state.errorLog = []
    this.state.initialized = false

    console.log('[ResourceAcceleratorCore] All plugins destroyed')
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {any} data - 事件数据
   */
  emit(event, data) {
    const listeners = this.state.eventListeners.get(event)
    if (!listeners) {
      return
    }

    listeners.forEach((listener) => {
      try {
        listener(data)
      } catch (error) {
        console.error(`[ResourceAcceleratorCore] Event listener error for ${event}:`, error)
      }
    })
  }

  /**
   * 监听事件
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   * @returns {Function} 取消监听函数
   */
  on(event, handler) {
    if (!this.state.eventListeners.has(event)) {
      this.state.eventListeners.set(event, new Set())
    }

    this.state.eventListeners.get(event).add(handler)

    // 返回取消监听函数
    return () => this.off(event, handler)
  }

  /**
   * 取消监听
   * @param {string} event - 事件名称
   * @param {Function} handler - 处理函数
   */
  off(event, handler) {
    const listeners = this.state.eventListeners.get(event)
    if (listeners) {
      listeners.delete(handler)
    }
  }

  /**
   * 创建缓存
   * @param {string} name - 缓存名称
   * @param {Object} options - 缓存配置
   * @returns {Object} 缓存接口
   */
  createCache(name, options = {}) {
    const cache = {
      data: new Map(),
      maxSize: options.maxSize || 100,
      ttl: options.ttl || 0,
      stats: {
        hits: 0,
        misses: 0,
        evictions: 0,
      },
    }

    this.state.caches.set(name, cache)

    return this._createCacheInterface(cache)
  }

  /**
   * 获取缓存
   * @param {string} name - 缓存名称
   * @returns {Object|null} 缓存接口
   */
  getCache(name) {
    const cache = this.state.caches.get(name)
    if (!cache) {
      return null
    }

    return this._createCacheInterface(cache)
  }

  /**
   * 创建缓存接口
   * @private
   */
  _createCacheInterface(cache) {
    return {
      get: (key) => {
        const item = cache.data.get(key)

        if (!item) {
          cache.stats.misses++
          return null
        }

        // 检查过期
        if (cache.ttl > 0 && Date.now() - item.time > cache.ttl) {
          cache.data.delete(key)
          cache.stats.misses++
          return null
        }

        cache.stats.hits++
        return item.value
      },

      set: (key, value) => {
        // LRU淘汰
        if (cache.data.size >= cache.maxSize) {
          const oldest = cache.data.keys().next().value
          cache.data.delete(oldest)
          cache.stats.evictions++
        }

        cache.data.set(key, {
          value,
          time: Date.now(),
        })
      },

      delete: (key) => {
        return cache.data.delete(key)
      },

      clear: () => {
        cache.data.clear()
      },

      stats: () => {
        const total = cache.stats.hits + cache.stats.misses
        return {
          ...cache.stats,
          size: cache.data.size,
          hitRate: total > 0 ? cache.stats.hits / total : 0,
        }
      },
    }
  }

  /**
   * 获取健康状态
   * @returns {Object}
   */
  getHealthStatus() {
    return {
      initialized: this.state.initialized,
      plugins: this.state.plugins.size,
      degradedModules: Array.from(this.state.degradedModules),
      recentErrors: this.state.errorLog.slice(-10),
    }
  }

  /**
   * 解析插件初始化顺序（拓扑排序）
   * @private
   */
  _resolveInitOrder() {
    const order = []
    const visited = new Set()
    const visiting = new Set()

    const visit = (name) => {
      if (visited.has(name)) {
        return
      }
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`)
      }

      visiting.add(name)

      const plugin = this.state.plugins.get(name)
      if (!plugin) {
        return
      }

      const meta = plugin.constructor.meta
      const dependencies = meta?.dependencies || []

      for (const dep of dependencies) {
        visit(dep)
      }

      visiting.delete(name)
      visited.add(name)
      order.push(name)
    }

    for (const name of this.state.plugins.keys()) {
      visit(name)
    }

    return order
  }
}
