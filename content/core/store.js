// ========== 统一状态管理 Store ==========
// 类似 Redux 的轻量级状态管理，集成 StorageBridge

;(function () {
  'use strict'

  if (window.AppStore) {
    console.log('[Store] 已存在，跳过初始化')
    return
  }

  /**
   * Store - 统一状态管理器
   * 功能：
   * 1. 单一数据源管理应用状态
   * 2. 自动持久化到 Chrome Storage
   * 3. 状态变更通知订阅者
   * 4. 支持 reducer 模式处理状态变更
   */
  const Store = {
    // 当前状态
    state: {},

    // Reducer 映射
    reducers: new Map(),

    // 订阅者列表
    subscribers: [],

    // 中间件列表
    middlewares: [],

    // 初始化状态
    initialized: false,

    // 存储区域
    storageArea: 'local',
    storageKey: 'appState',

    /**
     * 初始化 Store
     * @param {object} options - 配置选项
     * @returns {Promise<boolean>}
     */
    async init(options = {}) {
      if (this.initialized) return true

      const { storageArea = 'local', storageKey = 'appState', initialState = {} } = options

      this.storageArea = storageArea
      this.storageKey = storageKey

      try {
        // 从存储恢复状态
        const saved = await this._loadFromStorage()
        this.state = { ...initialState, ...saved }

        // 监听存储变化（跨上下文同步）
        this._setupStorageWatcher()

        this.initialized = true
        console.log('[Store] 初始化完成，状态:', this.state)
        return true
      } catch (error) {
        console.error('[Store] 初始化失败:', error)
        this.state = initialState
        return false
      }
    },

    /**
     * 从存储加载状态
     */
    async _loadFromStorage() {
      // 优先使用 StorageBridge
      if (typeof StorageBridge !== 'undefined') {
        const result = await StorageBridge.get(this.storageKey, this.storageArea)
        return result?.[this.storageKey] || {}
      }

      // 降级到原生 API
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve) => {
          chrome.storage[this.storageArea].get(this.storageKey, (result) => {
            resolve(result?.[this.storageKey] || {})
          })
        })
      }

      return {}
    },

    /**
     * 保存状态到存储
     */
    async _saveToStorage() {
      // 优先使用 StorageBridge
      if (typeof StorageBridge !== 'undefined') {
        await StorageBridge.set({ [this.storageKey]: this.state }, this.storageArea)
        return
      }

      // 降级到原生 API
      if (typeof chrome !== 'undefined' && chrome.storage) {
        return new Promise((resolve) => {
          chrome.storage[this.storageArea].set({ [this.storageKey]: this.state }, resolve)
        })
      }
    },

    /**
     * 设置存储变化监听
     */
    _setupStorageWatcher() {
      if (typeof StorageBridge !== 'undefined') {
        StorageBridge.watch(
          this.storageKey,
          (newState) => {
            if (newState && JSON.stringify(newState) !== JSON.stringify(this.state)) {
              this.state = newState
              this._notifySubscribers('STORAGE_SYNC')
            }
          },
          this.storageArea
        )
        return
      }

      // 降级到原生监听
      if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.onChanged.addListener((changes, areaName) => {
          if (areaName === this.storageArea && changes[this.storageKey]) {
            const newState = changes[this.storageKey].newValue
            if (newState && JSON.stringify(newState) !== JSON.stringify(this.state)) {
              this.state = newState
              this._notifySubscribers('STORAGE_SYNC')
            }
          }
        })
      }
    },

    /**
     * 注册 Reducer
     * @param {string} type - Action 类型
     * @param {function} reducer - (state, payload) => newState
     */
    register(type, reducer) {
      this.reducers.set(type, reducer)
      console.log(`[Store] 注册 Reducer: ${type}`)
    },

    /**
     * 批量注册 Reducers
     * @param {object} reducers - { type: reducer }
     */
    registerAll(reducers) {
      for (const [type, reducer] of Object.entries(reducers)) {
        this.register(type, reducer)
      }
    },

    /**
     * 添加中间件
     * @param {function} middleware - (action, next) => void
     */
    use(middleware) {
      this.middlewares.push(middleware)
    },

    /**
     * 派发 Action
     * @param {object} action - { type: string, payload: any }
     */
    async dispatch(action) {
      if (!action || !action.type) {
        console.warn('[Store] 无效的 Action:', action)
        return
      }

      // 执行中间件
      let currentAction = action
      for (const middleware of this.middlewares) {
        const result = await middleware(currentAction)
        if (result === false) return // 中间件拦截
        if (result) currentAction = result
      }

      const reducer = this.reducers.get(currentAction.type)
      if (!reducer) {
        console.warn(`[Store] 未找到 Reducer: ${currentAction.type}`)
        return
      }

      try {
        const oldState = { ...this.state }
        this.state = reducer(this.state, currentAction.payload)

        // 持久化
        await this._saveToStorage()

        // 通知订阅者
        this._notifySubscribers(currentAction.type, oldState)

        console.log(`[Store] Action 处理完成: ${currentAction.type}`)
      } catch (error) {
        console.error(`[Store] Action 处理失败: ${currentAction.type}`, error)
      }
    },

    /**
     * 订阅状态变化
     * @param {function} callback - (state, actionType) => void
     * @returns {function} 取消订阅函数
     */
    subscribe(callback) {
      this.subscribers.push(callback)
      return () => {
        this.subscribers = this.subscribers.filter((cb) => cb !== callback)
      }
    },

    /**
     * 通知订阅者
     */
    _notifySubscribers(actionType, oldState = null) {
      for (const callback of this.subscribers) {
        try {
          callback(this.state, actionType, oldState)
        } catch (error) {
          console.error('[Store] 订阅者回调错误:', error)
        }
      }
    },

    /**
     * 获取状态
     * @param {string} path - 状态路径 (如 'settings.enabled')
     * @returns {any}
     */
    get(path) {
      if (!path) return this.state

      return path.split('.').reduce((obj, key) => {
        return obj?.[key]
      }, this.state)
    },

    /**
     * 设置状态（直接修改，不经过 reducer）
     * @param {string} path - 状态路径
     * @param {any} value - 新值
     */
    async set(path, value) {
      const keys = path.split('.')
      const lastKey = keys.pop()
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) obj[key] = {}
        return obj[key]
      }, this.state)

      target[lastKey] = value
      await this._saveToStorage()
      this._notifySubscribers('DIRECT_SET')
    },

    /**
     * 重置状态
     * @param {object} initialState - 初始状态
     */
    async reset(initialState = {}) {
      this.state = initialState
      await this._saveToStorage()
      this._notifySubscribers('RESET')
    },

    /**
     * 获取完整状态快照
     */
    getSnapshot() {
      return JSON.parse(JSON.stringify(this.state))
    },
  }

  // 导出
  window.AppStore = Store

  // ========== 预定义 Reducers ==========

  /**
   * 设置相关 Reducers
   */
  const settingsReducers = {
    // 更新单个设置
    SETTINGS_UPDATE: (state, payload) => ({
      ...state,
      settings: { ...state.settings, ...payload },
    }),

    // 切换启用状态
    SETTINGS_TOGGLE: (state, payload) => ({
      ...state,
      settings: { ...state.settings, enabled: payload ?? !state.settings?.enabled },
    }),

    // 设置调试模式
    SETTINGS_SET_DEBUG: (state, payload) => ({
      ...state,
      settings: { ...state.settings, debugMode: payload },
    }),

    // 重置设置
    SETTINGS_RESET: (state) => ({
      ...state,
      settings: { enabled: false, debugMode: false },
    }),
  }

  /**
   * 隐藏元素相关 Reducers
   */
  const hideElementsReducers = {
    // 更新隐藏元素设置
    HIDE_ELEMENTS_UPDATE: (state, payload) => ({
      ...state,
      hideElements: {
        ...state.hideElements,
        enabled: payload.enabled ?? state.hideElements?.enabled,
        selectors: payload.selectors ?? state.hideElements?.selectors,
      },
    }),

    // 添加选择器
    HIDE_ELEMENTS_ADD_SELECTOR: (state, payload) => {
      const currentSelectors = state.hideElements?.selectors || []
      const newSelectors = Array.isArray(payload) ? payload : [payload]
      return {
        ...state,
        hideElements: {
          ...state.hideElements,
          selectors: [...new Set([...currentSelectors, ...newSelectors])],
        },
      }
    },

    // 移除选择器
    HIDE_ELEMENTS_REMOVE_SELECTOR: (state, payload) => {
      const currentSelectors = state.hideElements?.selectors || []
      const removeSelectors = Array.isArray(payload) ? payload : [payload]
      return {
        ...state,
        hideElements: {
          ...state.hideElements,
          selectors: currentSelectors.filter((s) => !removeSelectors.includes(s)),
        },
      }
    },

    // 切换隐藏元素启用状态
    HIDE_ELEMENTS_TOGGLE: (state, payload) => ({
      ...state,
      hideElements: {
        ...state.hideElements,
        enabled: payload ?? !state.hideElements?.enabled,
      },
    }),

    // 清空选择器
    HIDE_ELEMENTS_CLEAR: (state) => ({
      ...state,
      hideElements: { ...state.hideElements, selectors: [] },
    }),
  }

  /**
   * 域名管理相关 Reducers
   */
  const domainReducers = {
    // 添加阻止域名
    DOMAIN_BLOCK_ADD: (state, payload) => {
      const blockedDomains = state.blockedDomains || []
      const newDomains = Array.isArray(payload) ? payload : [payload]
      return {
        ...state,
        blockedDomains: [...new Set([...blockedDomains, ...newDomains])],
      }
    },

    // 移除阻止域名
    DOMAIN_BLOCK_REMOVE: (state, payload) => {
      const blockedDomains = state.blockedDomains || []
      const removeDomains = Array.isArray(payload) ? payload : [payload]
      return {
        ...state,
        blockedDomains: blockedDomains.filter((d) => !removeDomains.includes(d)),
      }
    },

    // 设置阻止域名列表
    DOMAIN_BLOCK_SET: (state, payload) => ({
      ...state,
      blockedDomains: Array.isArray(payload) ? payload : [],
    }),

    // 清空阻止域名
    DOMAIN_BLOCK_CLEAR: (state) => ({
      ...state,
      blockedDomains: [],
    }),
  }

  /**
   * 关键词管理相关 Reducers
   */
  const keywordsReducers = {
    // 添加关键词
    KEYWORDS_ADD: (state, payload) => {
      const keywords = state.keywords || {}
      const category = payload.category || 'default'
      const currentKeywords = keywords[category] || []
      const newKeywords = Array.isArray(payload.words) ? payload.words : [payload.words]
      return {
        ...state,
        keywords: {
          ...keywords,
          [category]: [...new Set([...currentKeywords, ...newKeywords])],
        },
      }
    },

    // 移除关键词
    KEYWORDS_REMOVE: (state, payload) => {
      const keywords = state.keywords || {}
      const category = payload.category || 'default'
      const currentKeywords = keywords[category] || []
      const removeKeywords = Array.isArray(payload.words) ? payload.words : [payload.words]
      return {
        ...state,
        keywords: {
          ...keywords,
          [category]: currentKeywords.filter((k) => !removeKeywords.includes(k)),
        },
      }
    },

    // 设置关键词列表
    KEYWORDS_SET: (state, payload) => {
      const keywords = state.keywords || {}
      const category = payload.category || 'default'
      return {
        ...state,
        keywords: {
          ...keywords,
          [category]: Array.isArray(payload.words) ? payload.words : [],
        },
      }
    },

    // 清空某类关键词
    KEYWORDS_CLEAR: (state, payload) => {
      const keywords = state.keywords || {}
      const category = payload?.category || 'default'
      return {
        ...state,
        keywords: {
          ...keywords,
          [category]: [],
        },
      }
    },
  }

  /**
   * UI 状态相关 Reducers
   */
  const uiReducers = {
    // 设置加载状态
    UI_SET_LOADING: (state, payload) => ({
      ...state,
      ui: { ...state.ui, loading: payload },
    }),

    // 设置错误信息
    UI_SET_ERROR: (state, payload) => ({
      ...state,
      ui: { ...state.ui, error: payload },
    }),

    // 清除错误
    UI_CLEAR_ERROR: (state) => ({
      ...state,
      ui: { ...state.ui, error: null },
    }),

    // 设置通知
    UI_SET_NOTIFICATION: (state, payload) => ({
      ...state,
      ui: {
        ...state.ui,
        notification: {
          type: payload.type || 'info',
          message: payload.message,
          timestamp: Date.now(),
        },
      },
    }),

    // 清除通知
    UI_CLEAR_NOTIFICATION: (state) => ({
      ...state,
      ui: { ...state.ui, notification: null },
    }),
  }

  // 自动注册所有预定义 Reducers
  Store.registerAll({
    ...settingsReducers,
    ...hideElementsReducers,
    ...domainReducers,
    ...keywordsReducers,
    ...uiReducers,
  })

  console.log('[Store] 状态管理模块已加载，已注册 Reducers:', Store.reducers.size)
})()
