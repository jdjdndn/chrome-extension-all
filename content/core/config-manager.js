// ========== 配置管理器 ==========
// 统一管理所有配置，支持导入导出、版本控制、默认值

(function () {
  'use strict'

  if (window.ConfigManager) {
    console.log('[ConfigManager] 已存在，跳过初始化')
    return
  }

  /**
   * ConfigManager - 配置管理器
   * 功能：
   * 1. 统一配置存储和访问
   * 2. 默认值和类型验证
   * 3. 配置变更监听
   * 4. 导入导出和版本控制
   */
  const ConfigManager = {
    // 配置存储
    config: {},

    // 默认配置
    defaults: {},

    // 配置模式定义（用于验证）
    schemas: {},

    // 变更监听器
    listeners: [],

    // 配置历史
    history: [],
    maxHistory: 50,

    // 版本信息
    version: '1.0.0',

    // 初始化状态
    initialized: false,

    /**
     * 初始化配置管理器
     * @param {object} options - 配置选项
     */
    async init(options = {}) {
      if (this.initialized) {return true}

      const {
        storageKey = 'appConfig',
        storageArea = 'local',
        defaults = {},
        schemas = {},
      } = options

      this.storageKey = storageKey
      this.storageArea = storageArea
      this.defaults = defaults
      this.schemas = schemas

      // 从存储加载配置
      await this._loadFromStorage()

      // 合并默认值
      this.config = this._mergeDefaults(this.config, this.defaults)

      this.initialized = true
      console.log('[ConfigManager] 初始化完成')
      return true
    },

    /**
     * 从存储加载配置
     */
    async _loadFromStorage() {
      try {
        if (typeof StorageUtils !== 'undefined') {
          const result = await StorageUtils.getLocal(this.storageKey)
          this.config = result?.[this.storageKey] || {}
        } else if (typeof chrome !== 'undefined' && chrome.storage) {
          const result = await new Promise((resolve) => {
            chrome.storage[this.storageArea].get(this.storageKey, resolve)
          })
          this.config = result?.[this.storageKey] || {}
        }
      } catch (error) {
        console.error('[ConfigManager] 加载配置失败:', error)
        this.config = {}
      }
    },

    /**
     * 保存配置到存储
     */
    async _saveToStorage() {
      try {
        if (typeof StorageUtils !== 'undefined') {
          await StorageUtils.setLocal({ [this.storageKey]: this.config })
        } else if (typeof chrome !== 'undefined' && chrome.storage) {
          await new Promise((resolve) => {
            chrome.storage[this.storageArea].set({ [this.storageKey]: this.config }, resolve)
          })
        }
      } catch (error) {
        console.error('[ConfigManager] 保存配置失败:', error)
      }
    },

    /**
     * 合并默认值
     */
    _mergeDefaults(config, defaults) {
      const result = { ...defaults }
      for (const key of Object.keys(config)) {
        if (typeof config[key] === 'object' && !Array.isArray(config[key]) && defaults[key]) {
          result[key] = this._mergeDefaults(config[key], defaults[key])
        } else {
          result[key] = config[key]
        }
      }
      return result
    },

    /**
     * 获取配置
     * @param {string} path - 配置路径（如 'settings.enabled'）
     * @param {any} defaultValue - 默认值
     * @returns {any}
     */
    get(path, defaultValue = undefined) {
      if (!path) {return this.config}

      const keys = path.split('.')
      let value = this.config

      for (const key of keys) {
        if (value === null || value === undefined || typeof value !== 'object') {
          return defaultValue
        }
        value = value[key]
      }

      return value !== undefined ? value : defaultValue
    },

    /**
     * 设置配置
     * @param {string} path - 配置路径
     * @param {any} value - 值
     * @param {object} options - 选项
     */
    async set(path, value, options = {}) {
      const { silent = false, validate = true } = options

      // 验证
      if (validate && !this._validate(path, value)) {
        console.warn(`[ConfigManager] 配置验证失败: ${path}`)
        return false
      }

      // 记录历史
      this._recordHistory(path, value)

      // 设置值
      const keys = path.split('.')
      const lastKey = keys.pop()
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) {obj[key] = {}}
        return obj[key]
      }, this.config)

      const oldValue = target[lastKey]
      target[lastKey] = value

      // 保存
      await this._saveToStorage()

      // 通知监听器
      if (!silent) {
        this._notifyListeners(path, value, oldValue)
      }

      return true
    },

    /**
     * 批量设置配置
     * @param {object} updates - 配置更新
     */
    async setAll(updates, options = {}) {
      for (const [path, value] of Object.entries(updates)) {
        await this.set(path, value, { ...options, silent: true })
      }

      if (!options.silent) {
        this._notifyListeners('*', updates, null)
      }
    },

    /**
     * 验证配置
     * @param {string} path - 配置路径
     * @param {any} value - 值
     */
    _validate(path, value) {
      const schema = this.schemas[path]
      if (!schema) {return true}

      // 类型验证
      if (schema.type) {
        const actualType = Array.isArray(value) ? 'array' : typeof value
        if (actualType !== schema.type) {
          return false
        }
      }

      // 枚举验证
      if (schema.enum && !schema.enum.includes(value)) {
        return false
      }

      // 范围验证
      if (typeof value === 'number') {
        if (schema.min !== undefined && value < schema.min) {return false}
        if (schema.max !== undefined && value > schema.max) {return false}
      }

      // 自定义验证
      if (schema.validate && typeof schema.validate === 'function') {
        return schema.validate(value)
      }

      return true
    },

    /**
     * 注册配置模式
     * @param {string} path - 配置路径
     * @param {object} schema - 模式定义
     */
    registerSchema(path, schema) {
      this.schemas[path] = schema
    },

    /**
     * 监听配置变更
     * @param {function} callback - 回调函数
     * @param {string} path - 监听路径（可选）
     * @returns {function} 取消监听函数
     */
    watch(callback, path = null) {
      const listener = { callback, path }
      this.listeners.push(listener)
      return () => {
        this.listeners = this.listeners.filter((l) => l !== listener)
      }
    },

    /**
     * 通知监听器
     */
    _notifyListeners(path, newValue, oldValue) {
      for (const listener of this.listeners) {
        if (!listener.path || listener.path === path || path === '*') {
          try {
            listener.callback(path, newValue, oldValue)
          } catch (error) {
            console.error('[ConfigManager] 监听器回调错误:', error)
          }
        }
      }
    },

    /**
     * 记录历史
     */
    _recordHistory(path, value) {
      this.history.push({
        path,
        value,
        timestamp: Date.now(),
      })

      if (this.history.length > this.maxHistory) {
        this.history.shift()
      }
    },

    /**
     * 获取历史记录
     */
    getHistory(path) {
      if (path) {
        return this.history.filter((h) => h.path === path)
      }
      return [...this.history]
    },

    /**
     * 回滚配置
     * @param {number} steps - 回滚步数
     */
    async rollback(steps = 1) {
      const historyIndex = this.history.length - steps
      if (historyIndex < 0) {return false}

      const targetHistory = this.history.slice(0, historyIndex)
      this.history = []

      // 重建配置
      for (const record of targetHistory) {
        await this.set(record.path, record.value, { silent: true })
      }

      console.log(`[ConfigManager] 已回滚 ${steps} 步`)
      return true
    },

    /**
     * 导出配置
     * @param {object} options - 导出选项
     */
    export(options = {}) {
      const { includeHistory = false, format = 'json' } = options

      const data = {
        version: this.version,
        timestamp: Date.now(),
        config: { ...this.config },
      }

      if (includeHistory) {
        data.history = [...this.history]
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
     * 导入配置
     * @param {string|object} data - 配置数据
     * @param {object} options - 导入选项
     */
    async import(data, options = {}) {
      const { merge = false, validate = true } = options

      try {
        let parsed
        if (typeof data === 'string') {
          if (data.startsWith('{')) {
            parsed = JSON.parse(data)
          } else {
            parsed = JSON.parse(atob(data))
          }
        } else {
          parsed = data
        }

        if (!parsed.config) {
          throw new Error('无效的配置格式')
        }

        // 合并或替换
        if (merge) {
          this.config = this._mergeDefaults(parsed.config, this.config)
        } else {
          this.config = this._mergeDefaults(parsed.config, this.defaults)
        }

        // 保存
        await this._saveToStorage()

        // 恢复历史
        if (parsed.history) {
          this.history = parsed.history
        }

        console.log('[ConfigManager] 配置导入成功')
        return true
      } catch (error) {
        console.error('[ConfigManager] 配置导入失败:', error)
        return false
      }
    },

    /**
     * 重置配置
     * @param {string} path - 配置路径（可选，不传则重置全部）
     */
    async reset(path) {
      if (path) {
        const defaultValue = this._getDefaultValue(path)
        await this.set(path, defaultValue)
      } else {
        this.config = this._deepClone(this.defaults)
        await this._saveToStorage()
        this._notifyListeners('*', this.config, null)
      }

      console.log(`[ConfigManager] 配置已重置: ${path || '全部'}`)
    },

    /**
     * 获取默认值
     */
    _getDefaultValue(path) {
      const keys = path.split('.')
      let value = this.defaults

      for (const key of keys) {
        if (value === null || value === undefined) {return undefined}
        value = value[key]
      }

      return value
    },

    /**
     * 深度克隆
     */
    _deepClone(obj) {
      return JSON.parse(JSON.stringify(obj))
    },

    /**
     * 获取配置快照
     */
    getSnapshot() {
      return {
        config: this._deepClone(this.config),
        history: [...this.history],
        timestamp: Date.now(),
      }
    },

    /**
     * 获取配置信息
     */
    getInfo() {
      return {
        version: this.version,
        initialized: this.initialized,
        configKeys: Object.keys(this.config),
        historyCount: this.history.length,
        listenerCount: this.listeners.length,
      }
    },
  }

  // ========== 预定义默认配置 ==========
  ConfigManager.defaults = {
    // 扩展设置
    settings: {
      enabled: true,
      debugMode: false,
      version: '1.0.0',
    },

    // 隐藏元素
    hideElements: {
      enabled: true,
      selectors: [],
    },

    // 域名管理
    domains: {
      blocked: [],
      allowed: [],
    },

    // 关键词过滤
    keywords: {
      notInterested: [],
      groups: {},
    },

    // 本地服务器
    localServer: {
      enabled: true,
      url: 'http://localhost:3000',
      timeout: 5000,
    },

    // UI 配置
    ui: {
      theme: 'light',
      language: 'zh-CN',
      notifications: true,
    },

    // AI 配置
    ai: {
      // 多轮思考配置
      multiThinking: {
        enabled: false, // 是否启用多轮思考
        rounds: 3, // 思考轮数（1-5）
      },
    },
  }

  // ========== 预定义配置模式 ==========
  ConfigManager.schemas = {
    'settings.enabled': { type: 'boolean' },
    'settings.debugMode': { type: 'boolean' },
    'hideElements.enabled': { type: 'boolean' },
    'hideElements.selectors': { type: 'array' },
    'domains.blocked': { type: 'array' },
    'localServer.enabled': { type: 'boolean' },
    'localServer.timeout': { type: 'number', min: 1000, max: 30000 },
    'ui.theme': { type: 'string', enum: ['light', 'dark', 'auto'] },
    'ai.multiThinking.enabled': { type: 'boolean' },
    'ai.multiThinking.rounds': { type: 'number', min: 1, max: 5 },
  }

  // 导出
  window.ConfigManager = ConfigManager

  console.log('[ConfigManager] 配置管理器已加载')
})()
