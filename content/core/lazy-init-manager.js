/**
 * LazyInitManager - 懒初始化管理器
 * 按需加载功能模块，减少非激活 tab 的资源消耗
 *
 * 分层初始化策略：
 * - L1 基础层：立即初始化（EventBus、Logger、Storage）
 * - L2 核心层：懒初始化（Store、Services、Pipeline 等）
 * - L3 DevTools 层：DevTools 打开时初始化
 * - L4 功能层：首次使用时初始化
 */

(function () {
  'use strict'

  if (window.LazyInitManager) {
    console.log('[LazyInitManager] 已存在，跳过初始化')
    return
  }

  // 初始化状态
  const initState = {
    // 是否已激活
    activated: false,
    // 激活来源
    activationSource: null,
    // 各层初始化状态
    layers: {
      L1: { initialized: true, name: '基础层' }, // L1 立即初始化
      L2: { initialized: false, name: '核心层' },
      L3: { initialized: false, name: 'DevTools层' },
      L4: { initialized: false, name: '功能层' },
    },
    // 待执行的初始化回调
    pendingCallbacks: {
      L2: [],
      L3: [],
      L4: [],
    },
  }

  const LazyInitManager = {
    /**
     * 检查是否已激活
     */
    isActivated() {
      return initState.activated
    },

    /**
     * 检查某层是否已初始化
     * @param {string} layer - 层级 (L1, L2, L3, L4)
     */
    isLayerInitialized(layer) {
      return initState.layers[layer]?.initialized || false
    },

    /**
     * 注册初始化回调
     * @param {string} layer - 层级
     * @param {Function} callback - 初始化回调
     * @param {string} name - 回调名称（用于调试）
     */
    registerInitCallback(layer, callback, name = 'unnamed') {
      if (!initState.pendingCallbacks[layer]) {
        console.warn(`[LazyInitManager] 未知层级: ${layer}`)
        return
      }

      // 如果该层已初始化，直接执行
      if (initState.layers[layer].initialized) {
        console.log(`[LazyInitManager] ${layer} 已初始化，直接执行: ${name}`)
        callback()
        return
      }

      initState.pendingCallbacks[layer].push({ callback, name })
      console.log(`[LazyInitManager] 注册 ${layer} 初始化回调: ${name}`)
    },

    /**
     * 激活扩展（触发初始化）
     * @param {string} source - 激活来源
     */
    async activate(source = 'unknown') {
      if (initState.activated) {
        console.log(`[LazyInitManager] 已激活，跳过 (来源: ${source})`)
        return { alreadyActivated: true }
      }

      console.log(`[LazyInitManager] 激活扩展 (来源: ${source})`)
      initState.activated = true
      initState.activationSource = source

      // 初始化 L2 核心层
      await this._initLayer('L2')

      // 如果是 DevTools 激活，同时初始化 L3
      if (source === 'devtools') {
        await this._initLayer('L3')
      }

      return { activated: true, source }
    },

    /**
     * 初始化指定层
     * @param {string} layer - 层级
     */
    async _initLayer(layer) {
      const layerState = initState.layers[layer]
      if (!layerState) {
        console.warn(`[LazyInitManager] 未知层级: ${layer}`)
        return
      }

      if (layerState.initialized) {
        return
      }

      console.log(`[LazyInitManager] 初始化 ${layer} (${layerState.name})`)
      layerState.initialized = true

      // 执行所有待处理的回调
      const callbacks = initState.pendingCallbacks[layer] || []
      initState.pendingCallbacks[layer] = []

      for (const { callback, name } of callbacks) {
        try {
          await callback()
          console.log(`[LazyInitManager] ${layer} 回调执行完成: ${name}`)
        } catch (error) {
          console.error(`[LazyInitManager] ${layer} 回调执行失败: ${name}`, error)
        }
      }
    },

    /**
     * 初始化功能层（L4）- 首次使用时调用
     * @param {string} featureName - 功能名称
     */
    async initFeature(featureName) {
      if (!initState.activated) {
        // 如果未激活，先激活
        await this.activate('feature-' + featureName)
      }

      if (!initState.layers.L4.initialized) {
        await this._initLayer('L4')
      }

      console.log(`[LazyInitManager] 功能初始化: ${featureName}`)
    },

    /**
     * DevTools 打开时调用
     */
    async onDevToolsOpen() {
      if (!initState.activated) {
        await this.activate('devtools')
      }
      await this._initLayer('L3')
    },

    /**
     * 获取状态
     */
    getState() {
      return {
        activated: initState.activated,
        activationSource: initState.activationSource,
        layers: Object.entries(initState.layers).reduce((obj, [key, val]) => {
          obj[key] = {
            initialized: val.initialized,
            pendingCount: initState.pendingCallbacks[key]?.length || 0,
          }
          return obj
        }, {}),
      }
    },

    /**
     * 重置状态（用于测试）
     */
    _reset() {
      initState.activated = false
      initState.activationSource = null
      for (const key of Object.keys(initState.layers)) {
        if (key !== 'L1') {
          initState.layers[key].initialized = false
        }
      }
      initState.pendingCallbacks = { L2: [], L3: [], L4: [] }
    },
  }

  // 导出
  window.LazyInitManager = LazyInitManager

  console.log('[LazyInitManager] 懒初始化管理器已加载')
})()
