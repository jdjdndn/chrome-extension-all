// ========== 插件系统 ==========
// 为站点脚本提供插件化扩展能力

;(function () {
  'use strict'

  if (window.PluginSystem) {
    console.log('[PluginSystem] 已存在，跳过初始化')
    return
  }

  /**
   * PluginSystem - 插件系统
   * 功能：
   * 1. 插件注册和管理
   * 2. 生命周期钩子
   * 3. 插件依赖处理
   * 4. 插件配置管理
   */
  const PluginSystem = {
    // 已注册的插件
    plugins: new Map(),

    // 插件实例
    instances: new Map(),

    // 钩子队列
    hooks: {
      beforeInit: [],
      afterInit: [],
      beforeApply: [],
      afterApply: [],
      beforeCleanup: [],
      afterCleanup: [],
      onError: [],
    },

    // 插件分类
    categories: {
      selector: '选择器增强',
      keyword: '关键词处理',
      ui: '界面增强',
      network: '网络请求',
      storage: '存储扩展',
      analytics: '数据分析',
      other: '其他',
    },

    /**
     * 注册插件
     * @param {object} plugin - 插件定义
     * @returns {boolean}
     */
    register(plugin) {
      if (!plugin || !plugin.name) {
        console.error('[PluginSystem] 无效的插件定义')
        return false
      }

      if (this.plugins.has(plugin.name)) {
        console.warn(`[PluginSystem] 插件已存在: ${plugin.name}`)
        return false
      }

      // 验证插件结构
      const validatedPlugin = this.validatePlugin(plugin)
      if (!validatedPlugin) return false

      this.plugins.set(plugin.name, validatedPlugin)
      console.log(`[PluginSystem] 注册插件: ${plugin.name} v${plugin.version || '1.0.0'}`)
      return true
    },

    /**
     * 验证插件结构
     * @param {object} plugin - 插件定义
     * @returns {object|null}
     */
    validatePlugin(plugin) {
      const required = ['name']
      for (const field of required) {
        if (!plugin[field]) {
          console.error(`[PluginSystem] 插件缺少必需字段: ${field}`)
          return null
        }
      }

      return {
        name: plugin.name,
        version: plugin.version || '1.0.0',
        description: plugin.description || '',
        category: plugin.category || 'other',
        dependencies: plugin.dependencies || [],
        priority: plugin.priority || 0,
        enabled: plugin.enabled !== false,
        settings: plugin.settings || {},
        hooks: plugin.hooks || {},
        methods: plugin.methods || {},
        init: plugin.init || (() => {}),
        cleanup: plugin.cleanup || (() => {}),
      }
    },

    /**
     * 批量注册插件
     * @param {array} plugins - 插件数组
     */
    registerAll(plugins) {
      for (const plugin of plugins) {
        this.register(plugin)
      }
    },

    /**
     * 初始化插件
     * @param {string} name - 插件名称
     * @param {object} context - 上下文（通常是站点实例）
     * @param {object} options - 选项
     */
    async initPlugin(name, context = {}, options = {}) {
      const plugin = this.plugins.get(name)
      if (!plugin || !plugin.enabled) {
        console.warn(`[PluginSystem] 插件未找到或已禁用: ${name}`)
        return null
      }

      // 检查依赖
      const depsReady = await this.checkDependencies(name)
      if (!depsReady) {
        console.error(`[PluginSystem] 插件依赖未满足: ${name}`)
        return null
      }

      try {
        // 执行 beforeInit 钩子
        await this.executeHook('beforeInit', { plugin, context })

        // 创建插件实例
        const instance = {
          name: plugin.name,
          version: plugin.version,
          context,
          settings: { ...plugin.settings, ...options.settings },
          methods: {},
        }

        // 绑定方法
        for (const [methodName, method] of Object.entries(plugin.methods)) {
          instance.methods[methodName] = method.bind(instance)
        }

        // 调用插件初始化
        await plugin.init.call(instance, context, options)

        // 注册插件钩子
        for (const [hookName, handler] of Object.entries(plugin.hooks)) {
          if (this.hooks[hookName]) {
            this.hooks[hookName].push({ plugin: name, handler: handler.bind(instance) })
          }
        }

        // 保存实例
        this.instances.set(name, instance)

        // 执行 afterInit 钩子
        await this.executeHook('afterInit', { plugin, instance, context })

        console.log(`[PluginSystem] 插件初始化完成: ${name}`)
        return instance
      } catch (error) {
        console.error(`[PluginSystem] 插件初始化失败: ${name}`, error)
        await this.executeHook('onError', { plugin, error, phase: 'init' })
        return null
      }
    },

    /**
     * 检查插件依赖
     * @param {string} name - 插件名称
     * @returns {boolean}
     */
    async checkDependencies(name) {
      const plugin = this.plugins.get(name)
      if (!plugin || !plugin.dependencies.length) return true

      for (const dep of plugin.dependencies) {
        const depName = typeof dep === 'string' ? dep : dep.name
        if (!this.plugins.has(depName)) {
          console.warn(`[PluginSystem] 缺少依赖: ${depName}`)
          return false
        }
        if (!this.instances.has(depName)) {
          // 尝试初始化依赖
          await this.initPlugin(depName)
        }
      }
      return true
    },

    /**
     * 执行钩子
     * @param {string} hookName - 钩子名称
     * @param {object} data - 数据
     */
    async executeHook(hookName, data) {
      const hookQueue = this.hooks[hookName]
      if (!hookQueue || !hookQueue.length) return

      for (const { plugin, handler } of hookQueue) {
        try {
          await handler(data)
        } catch (error) {
          console.error(`[PluginSystem] 钩子执行失败: ${hookName} (${plugin})`, error)
        }
      }
    },

    /**
     * 获取插件实例
     * @param {string} name - 插件名称
     * @returns {object|null}
     */
    getInstance(name) {
      return this.instances.get(name) || null
    },

    /**
     * 调用插件方法
     * @param {string} pluginName - 插件名称
     * @param {string} methodName - 方法名称
     * @param {any} args - 参数
     */
    async call(pluginName, methodName, ...args) {
      const instance = this.instances.get(pluginName)
      if (!instance || !instance.methods[methodName]) {
        console.warn(`[PluginSystem] 方法未找到: ${pluginName}.${methodName}`)
        return null
      }

      try {
        return await instance.methods[methodName](...args)
      } catch (error) {
        console.error(`[PluginSystem] 方法调用失败: ${pluginName}.${methodName}`, error)
        return null
      }
    },

    /**
     * 销毁插件实例
     * @param {string} name - 插件名称
     */
    async destroy(name) {
      const instance = this.instances.get(name)
      const plugin = this.plugins.get(name)
      if (!instance || !plugin) return false

      try {
        await this.executeHook('beforeCleanup', { plugin, instance })

        // 调用插件清理方法
        await plugin.cleanup.call(instance)

        // 移除钩子
        for (const hookName of Object.keys(this.hooks)) {
          this.hooks[hookName] = this.hooks[hookName].filter((h) => h.plugin !== name)
        }

        this.instances.delete(name)

        await this.executeHook('afterCleanup', { plugin, instance })

        console.log(`[PluginSystem] 插件已销毁: ${name}`)
        return true
      } catch (error) {
        console.error(`[PluginSystem] 插件销毁失败: ${name}`, error)
        return false
      }
    },

    /**
     * 启用/禁用插件
     * @param {string} name - 插件名称
     * @param {boolean} enabled - 是否启用
     */
    setEnabled(name, enabled) {
      const plugin = this.plugins.get(name)
      if (!plugin) return false
      plugin.enabled = enabled
      console.log(`[PluginSystem] ${enabled ? '启用' : '禁用'}插件: ${name}`)
      return true
    },

    /**
     * 获取插件列表
     * @param {string} category - 分类（可选）
     * @returns {array}
     */
    listPlugins(category) {
      const plugins = Array.from(this.plugins.values())
      if (category) {
        return plugins.filter((p) => p.category === category)
      }
      return plugins
    },

    /**
     * 获取分类列表
     * @returns {object}
     */
    getCategories() {
      return { ...this.categories }
    },

    /**
     * 导出插件配置
     */
    exportConfig() {
      return {
        plugins: this.listPlugins().map((p) => ({
          name: p.name,
          version: p.version,
          enabled: p.enabled,
          settings: p.settings,
        })),
        instances: Array.from(this.instances.keys()),
      }
    },
  }

  // ========== 预置插件 ==========

  // 选择器优化插件
  PluginSystem.register({
    name: 'selectorOptimizer',
    version: '1.0.0',
    description: '选择器优化和去重',
    category: 'selector',
    priority: 10,
    methods: {
      /**
       * 优化选择器列表
       */
      optimize(selectors) {
        if (!Array.isArray(selectors)) return []

        return selectors
          .filter((s) => s && typeof s === 'string' && s.trim())
          .map((s) => s.trim())
          .filter((s, i, arr) => arr.indexOf(s) === i) // 去重
          .sort((a, b) => a.length - b.length) // 按长度排序
      },

      /**
       * 检测选择器冲突
       */
      detectConflicts(selectors) {
        const conflicts = []
        for (let i = 0; i < selectors.length; i++) {
          for (let j = i + 1; j < selectors.length; j++) {
            if (selectors[i].includes(selectors[j]) || selectors[j].includes(selectors[i])) {
              conflicts.push([selectors[i], selectors[j]])
            }
          }
        }
        return conflicts
      },
    },
  })

  // 关键词分组插件
  PluginSystem.register({
    name: 'keywordGrouper',
    version: '1.0.0',
    description: '关键词分组管理',
    category: 'keyword',
    priority: 5,
    settings: {
      groups: {},
    },
    methods: {
      /**
       * 添加关键词到分组
       */
      addToGroup(groupName, keywords) {
        if (!this.settings.groups[groupName]) {
          this.settings.groups[groupName] = []
        }
        const words = Array.isArray(keywords) ? keywords : [keywords]
        this.settings.groups[groupName] = [
          ...new Set([...this.settings.groups[groupName], ...words]),
        ]
        return this.settings.groups[groupName]
      },

      /**
       * 从分组移除关键词
       */
      removeFromGroup(groupName, keywords) {
        if (!this.settings.groups[groupName]) return []
        const words = Array.isArray(keywords) ? keywords : [keywords]
        this.settings.groups[groupName] = this.settings.groups[groupName].filter(
          (k) => !words.includes(k)
        )
        return this.settings.groups[groupName]
      },

      /**
       * 获取分组关键词
       */
      getGroup(groupName) {
        return this.settings.groups[groupName] || []
      },

      /**
       * 获取所有分组
       */
      getAllGroups() {
        return { ...this.settings.groups }
      },

      /**
       * 搜索关键词
       */
      search(keyword) {
        const results = []
        for (const [group, keywords] of Object.entries(this.settings.groups)) {
          const matches = keywords.filter((k) => k.includes(keyword))
          if (matches.length > 0) {
            results.push({ group, matches })
          }
        }
        return results
      },
    },
  })

  // 性能监控插件
  PluginSystem.register({
    name: 'performanceMonitor',
    version: '1.0.0',
    description: '性能监控和统计',
    category: 'analytics',
    priority: 0,
    settings: {
      metrics: {},
      history: [],
      maxHistory: 100,
    },
    methods: {
      /**
       * 记录性能指标
       */
      record(name, value) {
        if (!this.settings.metrics[name]) {
          this.settings.metrics[name] = { count: 0, total: 0, min: Infinity, max: 0 }
        }
        const metric = this.settings.metrics[name]
        metric.count++
        metric.total += value
        metric.min = Math.min(metric.min, value)
        metric.max = Math.max(metric.max, value)
        metric.avg = metric.total / metric.count
      },

      /**
       * 获取指标统计
       */
      getStats(name) {
        return this.settings.metrics[name] || null
      },

      /**
       * 记录时间
       */
      time(label) {
        this._timers = this._timers || {}
        this._timers[label] = performance.now()
      },

      /**
       * 结束计时
       */
      timeEnd(label) {
        if (!this._timers?.[label]) return null
        const elapsed = performance.now() - this._timers[label]
        this.record(label, elapsed)
        delete this._timers[label]
        return elapsed
      },

      /**
       * 导出报告
       */
      getReport() {
        return {
          metrics: { ...this.settings.metrics },
          timestamp: Date.now(),
        }
      },
    },
  })

  // 规则导入导出插件
  PluginSystem.register({
    name: 'ruleExporter',
    version: '1.0.0',
    description: '规则导入导出管理',
    category: 'storage',
    priority: 0,
    methods: {
      /**
       * 导出规则
       */
      export(rules, format = 'json') {
        const data = {
          version: '1.0',
          timestamp: Date.now(),
          rules,
        }

        switch (format) {
          case 'json':
            return JSON.stringify(data, null, 2)
          case 'base64':
            return btoa(JSON.stringify(data))
          default:
            return data
        }
      },

      /**
       * 导入规则
       */
      import(data, format = 'json') {
        try {
          let parsed
          switch (format) {
            case 'json':
              parsed = JSON.parse(data)
              break
            case 'base64':
              parsed = JSON.parse(atob(data))
              break
            default:
              parsed = data
          }

          if (!parsed.rules) {
            throw new Error('无效的规则格式')
          }

          return parsed.rules
        } catch (error) {
          console.error('[PluginSystem] 规则导入失败:', error)
          return null
        }
      },

      /**
       * 验证规则格式
       */
      validate(rules) {
        const errors = []
        if (!rules || typeof rules !== 'object') {
          errors.push('规则必须是一个对象')
          return { valid: false, errors }
        }

        // 验证选择器
        if (rules.selectors && !Array.isArray(rules.selectors)) {
          errors.push('selectors 必须是数组')
        }

        // 验证关键词
        if (rules.keywords && typeof rules.keywords !== 'object') {
          errors.push('keywords 必须是对象')
        }

        return { valid: errors.length === 0, errors }
      },
    },
  })

  // 导出
  window.PluginSystem = PluginSystem

  console.log(
    '[PluginSystem] 插件系统已加载，预置插件:',
    PluginSystem.listPlugins()
      .map((p) => p.name)
      .join(', ')
  )
})()
