/**
 * 资源加速器主模块
 * 统一管理JS替换、字体替换、CSS加速、图片优化、资源预加载、资源去重
 * 支持替换结果缓存持久化(带TTL过期)
 *
 * 空闲模块优化：
 * - CDN 映射表保持立即加载（用于资源拦截）
 * - 配置加载、缓存加载、页面缓存应用延迟到 requestIdleCallback
 * - 初始化阻塞时间 <50ms
 */

(function () {
  'use strict'

  const LOG_PREFIX = '[ResourceAccelerator]'

  // 单例守卫：防止 bundle 被多次评估（双入口/多 frame）导致重复注册 DOMContentLoaded
  if (window.__resourceAcceleratorLoaded) {
    console.log(`${LOG_PREFIX} 已加载，跳过重复评估`)
    return
  }
  window.__resourceAcceleratorLoaded = true
  const CACHE_KEY = 'resourceAcceleratorCache'
  const CONFIG_KEY = 'resourceAcceleratorConfig'
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000 // 7天过期
  const CACHE_SAVE_DELAY = 500 // debounce 500ms
  const STATS_KEY = 'resourceAcceleratorStats'
  const MAX_ERROR_RECORDS = 10 // 最近错误记录最大条目数

  // ========== 分级缓存配置 ==========
  const CACHE_SIZE_CONFIG = {
    // 小文件缓存（<10KB）：内存优先
    small: {
      maxSize: 200,
      threshold: 10 * 1024, // 10KB
    },
    // 中文件缓存（10-100KB）：LRU淘汰
    medium: {
      maxSize: 100,
      threshold: 100 * 1024, // 100KB
    },
    // 大文件缓存（>100KB）：仅缓存URL映射
    large: {
      maxSize: 50, // URL映射条目数
      threshold: Infinity, // 无上限
    },
  }

  // ========== LRU淘汰算法配置 ==========
  const LRU_CONFIG = {
    // 时间衰减因子（毫秒），越小衰减越快
    decayFactor: 24 * 60 * 60 * 1000, // 1天
    // 访问次数权重
    accessWeight: 0.6,
    // 时间衰减权重
    timeWeight: 0.4,
    // 最小分数阈值（低于此分数的条目优先淘汰）
    minScoreThreshold: 0.1,
  }

  // ========== 缓存预热配置 ==========
  const CACHE_WARMUP_CONFIG = {
    // 高频CDN资源列表（预热用）
    highFrequencyCDNs: [
      'cdn.jsdelivr.net',
      'unpkg.com',
      'cdnjs.cloudflare.com',
      'fonts.googleapis.com',
    ],
    // 预热最大条目数
    maxWarmupEntries: 50,
    // 预热间隔（毫秒）
    warmupInterval: 5 * 60 * 1000, // 5分钟
    // 是否启用预热
    enabled: true,
  }

  // ========== 缓存统计配置 ==========
  /**
   * 错误级别枚举
   */
  const ErrorLevel = {
    FATAL: 'fatal', // 致命错误：模块完全不可用
    SEVERE: 'severe', // 严重错误：核心功能受损
    MINOR: 'minor', // 轻微错误：不影响核心功能
  }

  /**
   * ErrorHandler - 统一错误处理器
   * 负责：
   * 1. 错误分级（致命/严重/轻微）
   * 2. 错误上下文收集
   * 3. 错误上报到 background
   * 4. 模块级错误处理器注册
   * 5. 错误统计
   */
  class ErrorHandler {
    constructor(owner) {
      this.owner = owner
      this.moduleHandlers = new Map() // 模块名 -> 错误处理函数
      this.errorRecords = [] // 最近 MAX_ERROR_RECORDS 条错误记录
      this.errorStats = {
        total: 0,
        fatal: 0,
        severe: 0,
        minor: 0,
        byModule: {}, // 按模块统计
      }
    }

    /**
     * 注册模块级错误处理器
     * @param {string} moduleName - 模块名称
     * @param {Function} handler - 错误处理函数
     */
    register(moduleName, handler) {
      if (typeof handler !== 'function') {
        console.warn(`${LOG_PREFIX} ErrorHandler: 无效的处理器，模块 ${moduleName}`)
        return
      }
      this.moduleHandlers.set(moduleName, handler)
    }

    /**
     * 注销模块级错误处理器
     * @param {string} moduleName - 模块名称
     */
    unregister(moduleName) {
      this.moduleHandlers.delete(moduleName)
    }

    /**
     * 处理错误
     * @param {Error|string} error - 错误对象或错误消息
     * @param {Object} context - 错误上下文
     * @param {string} context.module - 模块名称
     * @param {string} context.operation - 操作名称
     * @param {string} context.level - 错误级别
     * @param {any} context.data - 额外数据
     */
    handle(error, context = {}) {
      const {
        module = 'unknown',
        operation = 'unknown',
        level = ErrorLevel.MINOR,
        data = null,
      } = context

      // 构建错误记录
      const errorRecord = {
        timestamp: Date.now(),
        module,
        operation,
        level,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
        data,
        url: window.location?.href || '',
      }

      // 更新统计
      this._updateStats(errorRecord)

      // 记录到最近错误列表
      this._recordError(errorRecord)

      // 控制台输出（根据级别）
      this._logError(errorRecord)

      // 调用模块级处理器
      const moduleHandler = this.moduleHandlers.get(module)
      if (moduleHandler) {
        try {
          moduleHandler(error, errorRecord)
        } catch (handlerError) {
          console.error(`${LOG_PREFIX} 模块处理器执行失败 (${module}):`, handlerError)
        }
      }

      // 上报到 background
      this._reportToBackground(errorRecord)

      return errorRecord
    }

    /**
     * 更新错误统计
     */
    _updateStats(record) {
      this.errorStats.total++
      this.errorStats[record.level] = (this.errorStats[record.level] || 0) + 1

      if (!this.errorStats.byModule[record.module]) {
        this.errorStats.byModule[record.module] = { total: 0, fatal: 0, severe: 0, minor: 0 }
      }
      this.errorStats.byModule[record.module].total++
      this.errorStats.byModule[record.module][record.level]++
    }

    /**
     * 记录错误到最近错误列表
     */
    _recordError(record) {
      this.errorRecords.push(record)
      // 超过上限时移除最旧的
      if (this.errorRecords.length > MAX_ERROR_RECORDS) {
        this.errorRecords.shift()
      }
    }

    /**
     * 控制台输出错误
     */
    _logError(record) {
      const prefix = `${LOG_PREFIX}[${record.module}]`
      const msg = `${record.operation}: ${record.message}`

      switch (record.level) {
        case ErrorLevel.FATAL:
          console.error(`${prefix} [FATAL] ${msg}`, record.data || '')
          break
        case ErrorLevel.SEVERE:
          console.error(`${prefix} [SEVERE] ${msg}`, record.data || '')
          break
        case ErrorLevel.MINOR:
        default:
          console.warn(`${prefix} [MINOR] ${msg}`, record.data || '')
          break
      }
    }

    /**
     * 上报错误到 background
     */
    _reportToBackground(record) {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'RESOURCE_ACCELERATOR_ERROR',
            data: record,
          })
        }
      } catch (error) {
        // 扩展上下文无效时静默失败
      }
    }

    /**
     * 获取错误统计
     */
    getStats() {
      return {
        ...this.errorStats,
        recentErrors: this.errorRecords.slice(-5), // 最近5条错误
      }
    }

    /**
     * 清除错误记录
     */
    clear() {
      this.errorRecords = []
      this.errorStats = {
        total: 0,
        fatal: 0,
        severe: 0,
        minor: 0,
        byModule: {},
      }
    }
  }

  /**
   * 降级状态管理器
   * 跟踪模块的降级状态，支持恢复
   */
  class DegradationManager {
    constructor() {
      this.degradedModules = new Map() // 模块名 -> 降级状态
    }

    /**
     * 记录模块降级
     * @param {string} moduleName - 模块名称
     * @param {string} reason - 降级原因
     * @param {Object} state - 降级前的状态快照
     */
    record(moduleName, reason, state = null) {
      this.degradedModules.set(moduleName, {
        reason,
        state,
        degradedAt: Date.now(),
        recoveredAt: null,
      })
      console.log(`${LOG_PREFIX}[DegradationManager] ${moduleName} 已降级: ${reason}`)
    }

    /**
     * 记录模块恢复
     * @param {string} moduleName - 模块名称
     */
    recover(moduleName) {
      const record = this.degradedModules.get(moduleName)
      if (record) {
        record.recoveredAt = Date.now()
        console.log(`${LOG_PREFIX}[DegradationManager] ${moduleName} 已恢复`)
      }
    }

    /**
     * 检查模块是否已降级
     * @param {string} moduleName - 模块名称
     */
    isDegraded(moduleName) {
      const record = this.degradedModules.get(moduleName)
      return record && !record.recoveredAt
    }

    /**
     * 获取降级状态
     */
    getStats() {
      const stats = {}
      this.degradedModules.forEach((record, name) => {
        stats[name] = {
          degraded: !record.recoveredAt,
          reason: record.reason,
          degradedAt: record.degradedAt,
          recoveredAt: record.recoveredAt,
        }
      })
      return stats
    }

    /**
     * 清除所有降级记录
     */
    clear() {
      this.degradedModules.clear()
    }

    /**
     * 执行模块降级（通用逻辑）
     * @param {Object} module - 模块实例
     * @param {string} moduleName - 模块名称
     * @param {string} reason - 降级原因
     * @param {Object} cleanupConfig - 清理配置
     * @param {string[]} cleanupConfig.listenerProperties - 需要清理的监听器属性名列表
     * @param {string} cleanupConfig.disableMethod - 禁用方法名（默认 'disable'）
     */
    degradeModule(module, moduleName, reason, cleanupConfig = {}) {
      const {
        listenerProperties = [
          '_unsubscribe',
          '_observer',
          '_videoUnsubscribe',
          '_videoObserver',
          '_mutationObserver',
        ],
        disableMethod = 'disable',
      } = cleanupConfig

      // 记录降级前的状态
      const prevState = module.getStats ? module.getStats() : null

      // 禁用模块
      if (typeof module[disableMethod] === 'function') {
        try {
          module[disableMethod]()
        } catch (error) {
          console.warn(`${LOG_PREFIX}[DegradationManager] 模块 ${moduleName} 禁用失败:`, error)
        }
      } else if ('enabled' in module) {
        module.enabled = false
      }

      // 清理监听器
      for (const prop of listenerProperties) {
        if (module[prop]) {
          try {
            if (typeof module[prop] === 'function') {
              module[prop]()
            } else if (module[prop].disconnect) {
              module[prop].disconnect()
            }
          } catch (error) {
            // 忽略清理错误
          }
          module[prop] = null
        }
      }

      // 记录降级状态
      this.record(moduleName, reason, prevState)

      console.log(`${LOG_PREFIX}[DegradationManager] ${moduleName} 降级完成，保留统计数据`)
    }
  }

  /**
   * ListenerTracker - 事件监听器追踪器
   * 记录所有事件监听器，便于销毁时统一清理
   */
  class ListenerTracker {
    constructor() {
      // 使用 WeakMap 存储，避免阻止元素被垃圾回收
      this._listeners = new WeakMap()
      // 额外使用数组存储 { target, type, listener, options } 用于清理
      this._listenerList = []
    }

    /**
     * 记录事件监听器
     * @param {EventTarget} target - 目标对象
     * @param {string} type - 事件类型
     * @param {Function} listener - 监听器
     * @param {Object|boolean} options - 选项
     */
    track(target, type, listener, options) {
      // 存储到 WeakMap
      if (!this._listeners.has(target)) {
        this._listeners.set(target, new Map())
      }
      const targetMap = this._listeners.get(target)
      if (!targetMap.has(type)) {
        targetMap.set(type, new Set())
      }
      targetMap.get(type).add(listener)

      // 存储到列表（用于清理）
      this._listenerList.push({ target, type, listener, options })
    }

    /**
     * 检测是否为 Chrome 扩展事件对象
     * @param {Object} target - 目标对象
     * @returns {boolean}
     */
    _isChromeEvent(target) {
      return (
        typeof target?.addListener === 'function' && typeof target?.removeListener === 'function'
      )
    }

    /**
     * 添加事件监听器并自动追踪
     * @param {EventTarget|Object} target - 目标对象（DOM EventTarget 或 Chrome 事件对象）
     * @param {string|Function} typeOrListener - 事件类型（DOM）或监听器（Chrome 事件）
     * @param {Function|Object} listenerOrOptions - 监听器（DOM）或选项（Chrome 事件）
     * @param {Object} options - 选项（仅 DOM）
     */
    add(target, typeOrListener, listenerOrOptions, options) {
      if (this._isChromeEvent(target)) {
        // Chrome 扩展事件 API: target.addListener(listener)
        const listener = typeOrListener
        target.addListener(listener)
        this.track(target, 'chromeEvent', listener, null)
      } else {
        // 标准 DOM EventTarget API
        const type = typeOrListener
        const listener = listenerOrOptions
        target.addEventListener(type, listener, options)
        this.track(target, type, listener, options)
      }
    }

    /**
     * 移除单个事件监听器
     */
    remove(target, type, listener) {
      if (this._isChromeEvent(target)) {
        target.removeListener(listener)
      } else {
        target.removeEventListener(type, listener)
      }

      // 从列表中移除
      const index = this._listenerList.findIndex(
        (item) => item.target === target && item.type === type && item.listener === listener
      )
      if (index !== -1) {
        this._listenerList.splice(index, 1)
      }
    }

    /**
     * 清理所有监听器
     */
    cleanup() {
      let cleaned = 0
      for (const { target, type, listener, options } of this._listenerList) {
        try {
          if (this._isChromeEvent(target)) {
            target.removeListener(listener)
          } else {
            target.removeEventListener(type, listener)
          }
          cleaned++
        } catch (error) {
          // 忽略已销毁的目标
        }
      }
      this._listenerList = []
      console.log(`${LOG_PREFIX} 清理事件监听器: ${cleaned} 个`)
      return cleaned
    }

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        totalListeners: this._listenerList.length,
        byTarget: this._listenerList.reduce((acc, { target }) => {
          const key = target?.constructor?.name || 'unknown'
          acc[key] = (acc[key] || 0) + 1
          return acc
        }, {}),
      }
    }
  }

  /**
   * 默认配置
   */
  const DEFAULT_CONFIG = {
    enabled: true,
    jsReplace: true,
    fontReplace: true,
    cssReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8,
    imageMinSize: 51200,
    lazyLoadThreshold: 200,
    preloadEnabled: true,
    dedupEnabled: true,
    excludeDomains: [],
    excludeUrls: [],
    cacheEnabled: true,
  }

  /**
   * 空对象模式：用于替换被跳过的模块，避免空指针错误
   */
  const NOOP_MODULE = {
    process: () => {},
    processLink: () => {},
    processScript: () => {},
    init: () => Promise.resolve(),
    destroy: () => {},
    enable: () => {},
    disable: () => {},
    getStats: () => ({
      total: 0,
      replaced: 0,
      skipped: 0,
      errors: 0,
      details: [],
      enabled: false,
      skippedByDetector: true,
    }),
    enabled: false,
    _processedLinks: { has: () => true, add: () => {} },
    _processedScripts: { has: () => true, add: () => {} },
    stats: { total: 0, replaced: 0, skipped: 0, errors: 0, details: [] },
  }

  /**
   * ResourceAccelerator - 资源加速器主类
   */
  class ResourceAccelerator {
    constructor(options = {}) {
      this.config = { ...DEFAULT_CONFIG, ...options }

      // 错误处理器和降级管理器
      this.errorHandler = new ErrorHandler(this)
      this.degradationManager = new DegradationManager()

      // 监听器追踪器
      this.listenerTracker = new ListenerTracker()

      // 缓存数据 - 分级缓存结构
      this.cache = {
        js: {
          small: {}, // 小文件缓存（<10KB）
          medium: {}, // 中文件缓存（10-100KB）
          large: {}, // 大文件缓存（>100KB）- 仅URL映射
        },
        fonts: {
          small: {},
          medium: {},
          large: {},
        },
        css: {
          small: {},
          medium: {},
          large: {},
        },
        timestamp: Date.now(),
        lastSaved: 0,
      }

      // 缓存统计追踪
      this._cacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        warmups: 0,
        bySize: {
          small: { hits: 0, misses: 0, evictions: 0 },
          medium: { hits: 0, misses: 0, evictions: 0 },
          large: { hits: 0, misses: 0, evictions: 0 },
        },
        byType: {
          js: { hits: 0, misses: 0, evictions: 0 },
          fonts: { hits: 0, misses: 0, evictions: 0 },
          css: { hits: 0, misses: 0, evictions: 0 },
        },
        lastResetTime: Date.now(),
        totalSize: 0,
      }

      // 缓存迁移监控
      this._migrationMonitor = {
        totalAttempts: 0, // 总迁移尝试次数
        successes: 0, // 成功次数
        failures: 0, // 失败次数
        rollbacks: 0, // 回退次数
        failureReasons: {}, // 失败原因统计 {reason: count}
        lastMigrationTime: 0, // 最后迁移时间
      }

      // URL解析缓存（LRU）
      this._urlParseCache = new Map()
      this._urlParseCacheMaxSize = 100

      // 缓存预热队列
      this._cacheWarmupQueue = []
      this._cacheWarmupTimer = null

      // debounce定时器
      this._cacheSaveTimer = null
      this._statsSaveTimer = null

      // 累计统计(持久化用)
      this._cumulativeStats = {
        totalJsReplaced: 0,
        totalFontsReplaced: 0,
        totalCssReplaced: 0,
        totalImagesOptimized: 0,
        totalDedupRemoved: 0,
      }

      // 子模块实例
      this.modules = {
        jsReplacer: null,
        fontReplacer: null,
        cssAccelerator: null,
        imageOptimizer: null,
        preloader: null,
        deduplicator: null,
      }

      // 统计数据
      this.stats = {
        js: { total: 0, replaced: 0, cached: 0, errors: 0 },
        fonts: { total: 0, replaced: 0, cached: 0, errors: 0 },
        css: { total: 0, replaced: 0, cached: 0, errors: 0 },
        images: { lazyLoaded: 0, compressed: 0, skipped: 0 },
        preload: { preloaded: 0, prefetched: 0 },
        dedup: { scripts: 0, styles: 0, removed: 0 },
      }

      // 页面优化检测相关
      this._detector = null
      this._skipper = null
      this._skippedOptimizations = {}
      this._detectionErrors = 0

      // CDN健康探测控制标志
      this._healthProbeStopped = false

      // requestIdleCallback 返回值存储（用于销毁时清理）
      this._idleCallbackIds = []

      // setTimeout 降级路径的 timeoutId 存储（用于销毁时清理）
      this._pendingTimeoutIds = []

      // 缓存应用控制标志
      this._applyCacheAborted = false

      // 原始方法备份
      this._originalProcessScript = null
      this._originalProcessLink = null

      // 性能监控指标
      this._performanceMetrics = {
        marks: {},
        measures: {},
        cacheHits: 0,
        cacheMisses: 0,
        replacements: {
          js: { total: 0, success: 0, totalTime: 0 },
          fonts: { total: 0, success: 0, totalTime: 0 },
          css: { total: 0, success: 0, totalTime: 0 },
        },
      }

      console.log(`${LOG_PREFIX} 模块初始化完成`)
    }

    /**
     * 性能标记
     * @param {string} name - 标记名称
     */
    _mark(name) {
      try {
        performance.mark(`RA_${name}_start`)
        this._performanceMetrics.marks[`${name}_start`] = performance.now()
      } catch (e) {
        // 忽略性能API不可用的情况
      }
    }

    /**
     * 性能测量
     * @param {string} name - 测量名称
     */
    _measure(name) {
      try {
        performance.mark(`RA_${name}_end`)
        performance.measure(`RA_${name}`, `RA_${name}_start`, `RA_${name}_end`)
        const measure = performance.getEntriesByName(`RA_${name}`, 'measure')[0]
        this._performanceMetrics.measures[name] = measure.duration
        // 清理marks
        performance.clearMarks(`RA_${name}_start`)
        performance.clearMarks(`RA_${name}_end`)
        performance.clearMeasures(`RA_${name}`)
      } catch (e) {
        // 忽略性能API不可用的情况
      }
    }

    /**
     * 记录缓存命中
     */
    _recordCacheHit() {
      this._performanceMetrics.cacheHits++
    }

    /**
     * 记录缓存未命中
     */
    _recordCacheMiss() {
      this._performanceMetrics.cacheMisses++
    }

    /**
     * 记录替换性能
     * @param {string} type - 替换类型 (js/fonts/css)
     * @param {boolean} success - 是否成功
     * @param {number} duration - 耗时（毫秒）
     */
    _recordReplacement(type, success, duration) {
      if (!this._performanceMetrics.replacements[type]) {
        return
      }
      const record = this._performanceMetrics.replacements[type]
      record.total++
      if (success) {
        record.success++
        record.totalTime += duration
      }
    }

    /**
     * 初始化
     *
     * 空闲模块策略：
     * - 立即执行：页面优化检测、CDN健康探测、子模块初始化、统计监听（使用默认配置）
     * - 延迟执行：配置加载、缓存加载、页面缓存应用、累计统计加载
     *
     * CDN 映射表已在 cdn-mappings.js 中立即加载，子模块可立即使用
     */
    init() {
      if (!this.config.enabled) {
        console.log(`${LOG_PREFIX} 模块已禁用`)
        return
      }

      // 性能标记：初始化开始
      this._mark('init')

      // ========== 立即执行（不阻塞主线程）==========

      // 1. 页面优化状态检测（检测页面已有优化，避免重复执行）
      this._detectPageOptimizations()

      // 2. 后台探测CDN健康(不阻塞初始化，CDN映射表已立即加载)
      // 已取消：主动探测在弱网/CSP/AdBlock 环境产生大量 ✗ 噪音且无收益。
      // 实际加载失败时由 _handleLoadError → markUnhealthy 反应式标记。
      // this._probeCDNHealth()

      // 3. 初始化子模块（使用默认配置，配置加载后会同步更新）
      // 如果检测到页面已有优化，会跳过相应模块
      this._mark('initModules')
      this.initModules()
      this._measure('initModules')

      // 4. 监听统计消息
      this.listenStats()

      console.log(`${LOG_PREFIX} 初始化完成（关键路径）`)

      // 性能标记：初始化结束（不包含延迟加载）
      this._measure('init')

      // ========== 延迟到浏览器空闲时执行（不阻塞首屏渲染）==========
      // 配置、缓存等 storage I/O 操作延迟到 requestIdleCallback，
      // 减少初始化阻塞时间，确保 <50ms
      this._loadDeferredResources()
    }

    /**
     * 页面优化状态检测
     * 检测页面是否已使用CDN、懒加载、预加载、字体优化等
     * 检测失败时执行全部优化（降级策略）
     */
    _detectPageOptimizations() {
      // 检查 PageOptimizationDetector 是否可用
      if (!window.PageOptimizationDetector) {
        console.warn(`${LOG_PREFIX} PageOptimizationDetector 未加载，跳过检测`)
        this._detectionErrors++
        return
      }

      try {
        // 创建检测器并执行检测
        this._detector = new window.PageOptimizationDetector()
        this._detector.init()

        // 创建优化跳过决策器
        if (window.OptimizationSkipper) {
          this._skipper = new window.OptimizationSkipper(this._detector, {
            cdnSkipThreshold: 0.6,
            lazyLoadSkipThreshold: 0.7,
            fontOptSkipThreshold: 0.5,
          })

          // 记录跳过的优化
          this._skippedOptimizations = {
            jsReplace: this._skipper.shouldSkip('jsReplace'),
            fontReplace: this._skipper.shouldSkip('fontReplace'),
            cssReplace: this._skipper.shouldSkip('cssReplace'),
            imageLazyLoad: this._skipper.shouldSkip('imageLazyLoad'),
            preload: this._skipper.shouldSkip('preload'),
          }

          console.log(`${LOG_PREFIX} 页面优化检测完成`, {
            skipped: this._skipper.getSkippedOptimizations(),
            active: this._skipper.getActiveOptimizations(),
          })
        }
      } catch (error) {
        // 降级：检测失败时执行全部优化
        console.warn(`${LOG_PREFIX} 页面优化检测失败，执行全部优化:`, error.message)
        this._detectionErrors++
        this._skippedOptimizations = {}
      }
    }

    /**
     * 在浏览器空闲时加载配置和缓存
     * 优化：将非关键的 chrome.storage I/O 延迟到 requestIdleCallback，
     * 避免阻塞主线程，确保初始化阻塞时间 <50ms
     *
     * 执行顺序：
     * 1. 加载配置 → 2. 同步配置到子模块 → 3. 加载缓存 → 4. 应用缓存到页面 → 5. 加载累计统计
     */
    _loadDeferredResources() {
      const deferredWork = async () => {
        try {
          // 1. 加载配置
          this._mark('loadConfig')
          await this.loadConfig()
          this._measure('loadConfig')

          // 2. 配置加载完成后，同步更新子模块（子模块已在 initModules 中用默认配置初始化）
          this._syncModulesConfig()

          // 3. 加载缓存
          this._mark('loadCache')
          await this.loadCache()
          this._measure('loadCache')

          // 4. 先用缓存替换页面中已存在的资源
          this._mark('applyCacheToPage')
          this._applyCacheToPage()
          this._measure('applyCacheToPage')

          // 5. 加载累计统计
          this._mark('loadCumulativeStats')
          await this._loadCumulativeStats()
          this._measure('loadCumulativeStats')

          // 6. 启动缓存预热（利用空闲时间预热高频CDN资源）
          if (CACHE_WARMUP_CONFIG.enabled) {
            this._startCacheWarmup()
          }

          console.log(`${LOG_PREFIX} 空闲资源加载完成`, {
            jsCacheCount:
              Object.keys(this.cache.js.small || {}).length +
              Object.keys(this.cache.js.medium || {}).length +
              Object.keys(this.cache.js.large || {}).length,
            fontCacheCount:
              Object.keys(this.cache.fonts.small || {}).length +
              Object.keys(this.cache.fonts.medium || {}).length +
              Object.keys(this.cache.fonts.large || {}).length,
          })
        } catch (error) {
          console.warn(`${LOG_PREFIX} 空闲资源加载失败:`, error.message)
        }
      }

      // 使用 requestIdleCallback 延迟执行，降级使用 setTimeout
      if (typeof requestIdleCallback !== 'undefined') {
        const idleId = requestIdleCallback(deferredWork, { timeout: 5000 })
        this._idleCallbackIds.push(idleId)
      } else {
        const timeoutId = setTimeout(deferredWork, 0)
        this._pendingTimeoutIds.push(timeoutId)
      }
    }

    /**
     * 启动缓存预热
     * 利用浏览器空闲时间预热高频CDN资源
     */
    _startCacheWarmup() {
      if (!CACHE_WARMUP_CONFIG.enabled) {
        return
      }

      // 收集页面中需要预热的高频CDN资源
      const warmupTargets = this._collectWarmupTargets()
      if (warmupTargets.length === 0) {
        return
      }

      // 限制预热数量
      const targetsToWarmup = warmupTargets.slice(0, CACHE_WARMUP_CONFIG.maxWarmupEntries)

      console.log(`${LOG_PREFIX} 缓存预热: 发现 ${targetsToWarmup.length} 个高频CDN资源`)

      // 使用 requestIdleCallback 逐个预热
      const warmupNext = (index) => {
        if (index >= targetsToWarmup.length) {
          console.log(`${LOG_PREFIX} 缓存预热完成`)
          return
        }

        const target = targetsToWarmup[index]

        // 检查是否已缓存
        const cachedEntry = this._getCacheEntry(target.type, target.url)
        if (cachedEntry) {
          // 已缓存，跳过
          warmupNext(index + 1)
          return
        }

        // 使用 requestIdleCallback 预热
        if (typeof requestIdleCallback !== 'undefined') {
          const idleId = requestIdleCallback(
            () => {
              this._warmupSingleResource(target)
                .then(() => {
                  warmupNext(index + 1)
                })
                .catch(() => {
                  warmupNext(index + 1)
                })
            },
            { timeout: 1000 }
          )
          this._idleCallbackIds.push(idleId)
        } else {
          // 降级：使用 setTimeout
          const timeoutId = setTimeout(() => {
            this._removePendingTimeout(timeoutId)
            this._warmupSingleResource(target)
              .then(() => {
                warmupNext(index + 1)
              })
              .catch(() => {
                warmupNext(index + 1)
              })
          }, 100)
          this._pendingTimeoutIds.push(timeoutId)
        }
      }

      // 开始预热
      warmupNext(0)
    }

    /**
     * 收集预热目标
     * @returns {Array} 预热目标列表
     */
    _collectWarmupTargets() {
      const targets = []

      // 扫描页面中的 script 和 link 标签
      const scripts = document.querySelectorAll('script[src]')
      const links = document.querySelectorAll('link[rel="stylesheet"]')

      // 收集 JS 资源
      scripts.forEach((script) => {
        const url = script.src
        if (this._isHighFrequencyCDN(url)) {
          targets.push({ type: 'js', url })
        }
      })

      // 收集 CSS 资源
      links.forEach((link) => {
        const url = link.href
        if (this._isHighFrequencyCDN(url)) {
          targets.push({ type: 'css', url })
        }
      })

      // 收集字体资源
      const fontLinks = document.querySelectorAll('link[rel="preload"][as="font"]')
      fontLinks.forEach((link) => {
        const url = link.href
        if (this._isHighFrequencyCDN(url)) {
          targets.push({ type: 'fonts', url })
        }
      })

      return targets
    }

    /**
     * 检查是否为高频CDN资源
     * @param {string} url - 资源URL
     * @returns {boolean}
     */
    _isHighFrequencyCDN(url) {
      if (!url) {
        return false
      }

      try {
        const urlObj = new URL(url)
        return CACHE_WARMUP_CONFIG.highFrequencyCDNs.some((cdn) => urlObj.hostname.includes(cdn))
      } catch {
        return false
      }
    }

    /**
     * 预热单个资源
     * @param {Object} target - 预热目标
     * @returns {Promise}
     */
    async _warmupSingleResource(target) {
      try {
        // 使用 fetch 预热（不处理响应，仅触发网络请求）
        const response = await fetch(target.url, {
          method: 'HEAD', // 使用 HEAD 方法减少带宽消耗
          cache: 'force-cache', // 强制使用缓存
        })

        if (response.ok) {
          // 预热成功，更新缓存统计
          this._cacheStats.warmups++
          console.log(`${LOG_PREFIX} 缓存预热成功: ${target.url}`)
        }
      } catch (error) {
        // 预热失败，静默处理
        console.log(`${LOG_PREFIX} 缓存预热失败: ${target.url}`, error.message)
      }
    }
    /**
     * 同步配置到子模块（不触发保存）
     * 用于配置从 storage 加载完成后，更新已用默认配置初始化的子模块
     */
    _syncModulesConfig() {
      if (this.modules.jsReplacer) {
        this.modules.jsReplacer.enabled = this.config.jsReplace && this.config.enabled
      }
      if (this.modules.fontReplacer) {
        this.modules.fontReplacer.enabled = this.config.fontReplace && this.config.enabled
      }
      if (this.modules.cssAccelerator) {
        this.modules.cssAccelerator.enabled = this.config.cssReplace && this.config.enabled
      }
      if (this.modules.imageOptimizer) {
        if (this.config.imageLazyLoad) {
          this.modules.imageOptimizer.enableLazyLoad()
        } else {
          this.modules.imageOptimizer.disableLazyLoad()
        }
        if (this.config.imageCompress) {
          this.modules.imageOptimizer.enableCompress()
        } else {
          this.modules.imageOptimizer.disableCompress()
        }
      }
      if (this.modules.preloader) {
        this.modules.preloader.enabled = this.config.preloadEnabled && this.config.enabled
      }
      if (this.modules.deduplicator) {
        this.modules.deduplicator.enabled = this.config.dedupEnabled && this.config.enabled
      }
    }

    /**
     * 加载配置
     */
    async loadConfig() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(CONFIG_KEY)
          if (result[CONFIG_KEY]) {
            this.config = { ...DEFAULT_CONFIG, ...result[CONFIG_KEY] }
            console.log(`${LOG_PREFIX} 配置已加载`)
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 加载配置失败:`, error.message)
      }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ [CONFIG_KEY]: this.config })
          console.log(`${LOG_PREFIX} 配置已保存`)
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 保存配置失败:`, error.message)
      }
    }

    /**
     * 加载缓存（支持双格式兼容 + 异步迁移）
     */
    async loadCache() {
      try {
        if (!this.config.cacheEnabled) {
          return
        }

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(CACHE_KEY)
          if (result[CACHE_KEY]) {
            const loaded = result[CACHE_KEY]

            // TTL过期检查
            const now = Date.now()
            if (loaded.timestamp && now - loaded.timestamp > CACHE_TTL) {
              console.log(`${LOG_PREFIX} 缓存已过期，清除`)
              this.cache = {
                js: { small: {}, medium: {}, large: {} },
                fonts: { small: {}, medium: {}, large: {} },
                css: { small: {}, medium: {}, large: {} },
                timestamp: now,
                lastSaved: 0,
              }
              return
            }

            const format = this._detectCacheFormat(loaded)

            // 新格式：直接使用
            if (format === 'new') {
              this.cache = loaded
            }
            // 旧格式：立即兼容读取 + 后台异步迁移
            else if (format === 'legacy') {
              console.log(`${LOG_PREFIX} 检测到旧格式缓存，启用兼容模式`)

              // 保留旧缓存作为备份
              this._legacyCacheBackup = loaded

              // 立即使用旧格式（兼容读取）
              this.cache = loaded

              // 后台异步迁移，不阻塞主流程
              this._scheduleBackgroundMigration(loaded)
            }
            // 空缓存或未知格式
            else {
              console.log(`${LOG_PREFIX} 缓存格式: ${format}`)
              this.cache = loaded
            }

            const cacheSizeStats = this._getCacheSizeStats()
            console.log(`${LOG_PREFIX} 缓存已加载`, {
              format,
              total: cacheSizeStats.total,
              small: cacheSizeStats.small.count,
              medium: cacheSizeStats.medium.count,
              large: cacheSizeStats.large.count,
            })
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 加载缓存失败:`, error.message)
      }
    }

    /**
     * 后台异步迁移（不阻塞主流程）
     * @param {Object} legacyCache - 旧格式缓存
     */
    _scheduleBackgroundMigration(legacyCache) {
      // 使用 requestIdleCallback 在浏览器空闲时迁移
      if (typeof requestIdleCallback !== 'undefined') {
        const idleId = requestIdleCallback(() => {
          this._executeMigration(legacyCache)
        })
        this._idleCallbackIds.push(idleId)
      } else {
        // 降级：延迟执行
        const timeoutId = setTimeout(() => {
          this._removePendingTimeout(timeoutId)
          this._executeMigration(legacyCache)
        }, 1000)
        this._pendingTimeoutIds.push(timeoutId)
      }
    }

    /**
     * 执行迁移（带回退机制）
     * @param {Object} legacyCache - 旧格式缓存
     */
    _executeMigration(legacyCache) {
      this._migrationMonitor.totalAttempts++
      this._migrationMonitor.lastMigrationTime = Date.now()

      try {
        const newCache = this._migrateLegacyCache(legacyCache)

        // 校验新缓存
        if (!this._validateMigratedCache(newCache, legacyCache)) {
          throw new Error('validation_failed')
        }

        // 迁移成功
        this._migrationMonitor.successes++
        this.cache = newCache

        // 清除备份
        this._legacyCacheBackup = null

        console.log(`${LOG_PREFIX} 缓存迁移成功`)
        this._logMigrationReport()
      } catch (error) {
        // 迁移失败，回退到旧格式
        this._migrationMonitor.failures++
        const reason = error.message || 'unknown'
        this._migrationMonitor.failureReasons[reason] =
          (this._migrationMonitor.failureReasons[reason] || 0) + 1

        // 回退
        this._migrationMonitor.rollbacks++
        this.cache = this._legacyCacheBackup || legacyCache

        console.warn(`${LOG_PREFIX} 缓存迁移失败，已回退:`, reason)
        this._logMigrationReport()
      }
    }

    /**
     * 校验迁移后的缓存
     * @param {Object} newCache - 新格式缓存
     * @param {Object} legacyCache - 旧格式缓存
     * @returns {boolean} 校验是否通过
     */
    _validateMigratedCache(newCache, legacyCache) {
      try {
        // 检查新格式结构
        if (!newCache.js?.small || !newCache.fonts?.small || !newCache.css?.small) {
          return false
        }

        // 检查条目数是否一致（允许少量误差）
        const legacyCount = this._countCacheEntries(legacyCache)
        const newCount = this._countCacheEntries(newCache)

        // 允许5%的误差（某些无效条目可能被过滤）
        const tolerance = Math.ceil(legacyCount * 0.05)
        if (Math.abs(legacyCount - newCount) > tolerance) {
          console.warn(`${LOG_PREFIX} 缓存迁移校验失败: 条目数不一致 ${legacyCount} -> ${newCount}`)
          return false
        }

        return true
      } catch (error) {
        console.warn(`${LOG_PREFIX} 缓存校验异常:`, error.message)
        return false
      }
    }

    /**
     * 统计缓存条目数
     * @param {Object} cache - 缓存对象
     * @returns {number} 条目总数
     */
    _countCacheEntries(cache) {
      let count = 0

      const countType = (typeCache) => {
        if (!typeCache || typeof typeCache !== 'object') {
          return
        }
        // 新格式
        if (typeCache.small) {
          count += Object.keys(typeCache.small || {}).length
          count += Object.keys(typeCache.medium || {}).length
          count += Object.keys(typeCache.large || {}).length
        } else {
          // 旧格式
          count += Object.keys(typeCache).length
        }
      }

      countType(cache.js)
      countType(cache.fonts)
      countType(cache.css)

      return count
    }

    /**
     * 输出迁移监控报告
     */
    _logMigrationReport() {
      const m = this._migrationMonitor
      const successRate =
        m.totalAttempts > 0 ? ((m.successes / m.totalAttempts) * 100).toFixed(1) : 0
      const rollbackRate =
        m.totalAttempts > 0 ? ((m.rollbacks / m.totalAttempts) * 100).toFixed(1) : 0

      console.log(
        `${LOG_PREFIX} 缓存迁移报告:
  尝试: ${m.totalAttempts}
  成功: ${m.successes} (${successRate}%)
  失败: ${m.failures}
  回退: ${m.rollbacks} (${rollbackRate}%)
  失败原因:`,
        m.failureReasons
      )
    }

    /**
     * 迁移旧格式缓存到分级缓存
     * @param {Object} legacyCache - 旧格式缓存
     * @returns {Object} 分级缓存
     */
    _migrateLegacyCache(legacyCache) {
      const newCache = {
        js: { small: {}, medium: {}, large: {} },
        fonts: { small: {}, medium: {}, large: {} },
        css: { small: {}, medium: {}, large: {} },
        timestamp: legacyCache.timestamp || Date.now(),
        lastSaved: legacyCache.lastSaved || 0,
      }

      // 迁移 JS 缓存
      if (legacyCache.js && typeof legacyCache.js === 'object') {
        for (const [key, value] of Object.entries(legacyCache.js)) {
          const sizeCategory = this._estimateFileSize(key)
          if (typeof value === 'string') {
            // 旧格式：直接存储 URL 字符串
            newCache.js[sizeCategory][key] = {
              url: value,
              _accessTime: legacyCache.timestamp || Date.now(),
              _accessCount: 1,
              _size: 0,
              _sizeCategory: sizeCategory,
            }
          } else if (value && typeof value === 'object') {
            // 已经是新格式
            newCache.js[sizeCategory][key] = value
          }
        }
      }

      // 迁移 Fonts 缓存
      if (legacyCache.fonts && typeof legacyCache.fonts === 'object') {
        for (const [key, value] of Object.entries(legacyCache.fonts)) {
          const sizeCategory = this._estimateFileSize(key)
          if (typeof value === 'string') {
            newCache.fonts[sizeCategory][key] = {
              url: value,
              _accessTime: legacyCache.timestamp || Date.now(),
              _accessCount: 1,
              _size: 0,
              _sizeCategory: sizeCategory,
            }
          } else if (value && typeof value === 'object') {
            newCache.fonts[sizeCategory][key] = value
          }
        }
      }

      // CSS 缓存可能不存在于旧格式中
      if (legacyCache.css && typeof legacyCache.css === 'object') {
        for (const [key, value] of Object.entries(legacyCache.css)) {
          const sizeCategory = this._estimateFileSize(key)
          if (typeof value === 'string') {
            newCache.css[sizeCategory][key] = {
              url: value,
              _accessTime: legacyCache.timestamp || Date.now(),
              _accessCount: 1,
              _size: 0,
              _sizeCategory: sizeCategory,
            }
          } else if (value && typeof value === 'object') {
            newCache.css[sizeCategory][key] = value
          }
        }
      }

      console.log(`${LOG_PREFIX} 缓存迁移完成`)
      return newCache
    }

    /**
     * 保存缓存(debounce批量写入 + LRU淘汰)
     */
    saveCache() {
      if (!this.config.cacheEnabled) {
        return
      }

      // LRU淘汰: 超过上限时清理最旧的条目
      this._evictCache('js')
      this._evictCache('fonts')
      this._evictCache('css')

      if (this._cacheSaveTimer) {
        clearTimeout(this._cacheSaveTimer)
      }

      this._cacheSaveTimer = setTimeout(async () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            this.cache.timestamp = Date.now()
            this.cache.lastSaved = Date.now()
            await chrome.storage.local.set({ [CACHE_KEY]: this.cache })
            console.log(`${LOG_PREFIX} 缓存已保存`)
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} 保存缓存失败:`, error.message)
        }
        this._cacheSaveTimer = null
      }, CACHE_SAVE_DELAY)
    }

    /**
     * LRU淘汰: 超过MAX_CACHE_ENTRIES时移除最旧条目
     * 优化：使用 requestIdleCallback 延迟执行，减少主线程阻塞
     */
    _evictCache(type) {
      const performEviction = () => {
        const cache = this.cache[type]
        if (!cache || typeof cache !== 'object') {
          return
        }

        // 遍历所有大小分类进行淘汰
        for (const sizeCategory of ['small', 'medium', 'large']) {
          const entries = cache[sizeCategory]
          if (!entries || typeof entries !== 'object') {
            continue
          }

          const maxSize = this._getMaxCacheEntries(sizeCategory)
          const keys = Object.keys(entries)

          if (keys.length <= maxSize) {
            continue
          }

          // 计算需要淘汰的数量
          const toRemove = keys.length - maxSize

          // 收集所有条目的LRU分数
          const entriesWithScore = []
          for (const key of keys) {
            const entry = entries[key]
            if (entry && typeof entry === 'object') {
              const score = this._calculateLRUScore(entry)
              entriesWithScore.push({ key, score, entry })
            } else if (typeof entry === 'string') {
              // 旧格式条目，视为最低分
              entriesWithScore.push({ key, score: 0, entry: null })
            }
          }

          // 按分数排序（低分在前，优先淘汰）
          entriesWithScore.sort((a, b) => a.score - b.score)

          // 淘汰低分条目
          let removed = 0
          for (let i = 0; i < toRemove && i < entriesWithScore.length; i++) {
            const { key, entry } = entriesWithScore[i]

            // 保留带版本号的精确匹配，优先删除 URL 全路径 key
            if (key.startsWith('http') || !entry) {
              delete entries[key]
              removed++
              this._cacheStats.evictions++
              this._cacheStats.bySize[sizeCategory].evictions++
              this._cacheStats.byType[type].evictions++
            }
          }

          // 如果还有剩余淘汰名额，删除非精确匹配的条目
          if (removed < toRemove) {
            for (let i = 0; i < entriesWithScore.length && removed < toRemove; i++) {
              const { key } = entriesWithScore[i]
              if (!key.startsWith('http')) {
                delete entries[key]
                removed++
                this._cacheStats.evictions++
                this._cacheStats.bySize[sizeCategory].evictions++
                this._cacheStats.byType[type].evictions++
              }
            }
          }

          if (removed > 0) {
            console.log(`${LOG_PREFIX} ${type}.${sizeCategory}缓存淘汰 ${removed} 条`)
          }
        }
      }

      // 使用 requestIdleCallback 延迟执行
      if (typeof requestIdleCallback !== 'undefined') {
        const idleId = requestIdleCallback(performEviction, { timeout: 5000 })
        this._idleCallbackIds.push(idleId)
      } else {
        // 降级：使用 setTimeout，16ms延迟配合渲染节奏
        const timeoutId = setTimeout(performEviction, 16)
        this._pendingTimeoutIds.push(timeoutId)
      }
    }
    /**
     * 生成缓存键（带LRU缓存优化）
     */
    getCacheKey(url) {
      if (!url || typeof url !== 'string') {
        return null
      }

      // 检查缓存
      if (this._urlParseCache.has(url)) {
        // LRU: 删除后重新插入，更新访问顺序
        const cached = this._urlParseCache.get(url)
        this._urlParseCache.delete(url)
        this._urlParseCache.set(url, cached)
        return cached
      }

      // 解析URL
      let result
      try {
        const urlObj = new URL(url)
        result = urlObj.hostname + urlObj.pathname
      } catch {
        result = url
      }

      // LRU淘汰：超过容量时删除最旧的条目
      if (this._urlParseCache.size >= this._urlParseCacheMaxSize) {
        const oldestKey = this._urlParseCache.keys().next().value
        this._urlParseCache.delete(oldestKey)
      }

      // 存入缓存
      this._urlParseCache.set(url, result)
      return result
    }

    /**
     * 估算文件大小分类
     * @param {string} url - 资源URL
     * @param {number} contentLength - 响应内容长度（可选）
     * @returns {string} 'small' | 'medium' | 'large'
     */
    _estimateFileSize(url, contentLength = null) {
      // 如果有明确的内容长度，直接使用
      if (contentLength !== null && contentLength !== undefined) {
        if (contentLength < CACHE_SIZE_CONFIG.small.threshold) {
          return 'small'
        }
        if (contentLength < CACHE_SIZE_CONFIG.medium.threshold) {
          return 'medium'
        }
        return 'large'
      }

      // 基于URL特征估算
      try {
        const urlObj = new URL(url)
        const pathname = urlObj.pathname.toLowerCase()

        // 常见小文件类型
        if (
          pathname.endsWith('.css') ||
          pathname.endsWith('.js') ||
          pathname.endsWith('.json') ||
          pathname.endsWith('.svg') ||
          pathname.endsWith('.woff') ||
          pathname.endsWith('.woff2') ||
          pathname.endsWith('.ttf') ||
          pathname.endsWith('.eot')
        ) {
          return 'small'
        }

        // 常见中等文件类型
        if (
          pathname.endsWith('.png') ||
          pathname.endsWith('.jpg') ||
          pathname.endsWith('.jpeg') ||
          pathname.endsWith('.gif') ||
          pathname.endsWith('.webp') ||
          pathname.endsWith('.mp4') ||
          pathname.endsWith('.woff') ||
          pathname.endsWith('.woff2')
        ) {
          return 'medium'
        }

        // 常见大文件类型
        if (
          pathname.endsWith('.mp4') ||
          pathname.endsWith('.webm') ||
          pathname.endsWith('.zip') ||
          pathname.endsWith('.tar.gz')
        ) {
          return 'large'
        }

        // 默认归类为小文件
        return 'small'
      } catch {
        return 'small'
      }
    }

    /**
     * 获取文件大小分类的最大条目数
     * @param {string} sizeCategory - 文件大小分类
     * @returns {number}
     */
    _getMaxCacheEntries(sizeCategory) {
      const config = CACHE_SIZE_CONFIG[sizeCategory]
      return config ? config.maxSize : 100
    }

    /**
     * 计算LRU分数（基于访问次数+时间衰减）
     * @param {Object} entry - 缓存条目
     * @returns {number} 分数（0-1，越高越应该保留）
     */
    _calculateLRUScore(entry) {
      if (!entry) {
        return 0
      }

      const now = Date.now()
      const accessCount = entry._accessCount || 0
      const accessTime = entry._accessTime || 0

      // 访问次数分数（归一化到0-1）
      const accessScore = Math.min(accessCount / 100, 1)

      // 时间衰减分数（越新访问分数越高）
      const timeSinceLastAccess = now - accessTime
      const timeDecay = Math.exp(-timeSinceLastAccess / LRU_CONFIG.decayFactor)

      // 综合分数
      const score = accessScore * LRU_CONFIG.accessWeight + timeDecay * LRU_CONFIG.timeWeight

      return score
    }

    /**
     * 获取缓存条目（支持分级缓存）
     * @param {string} type - 缓存类型（js/fonts/css）
     * @param {string} url - 资源URL
     * @param {number} contentLength - 响应内容长度（可选）
     * @returns {Object|null} 缓存条目
     */
    /**
     * 检测缓存格式
     * @param {Object} cache - 缓存对象
     * @returns {string} 'new' | 'legacy' | 'empty' | 'unknown'
     */
    _detectCacheFormat(cache) {
      if (!cache) {
        return 'empty'
      }
      if (cache.js?.small) {
        return 'new'
      } // 新格式：分级缓存
      if (cache.js && typeof cache.js === 'object') {
        return 'legacy'
      } // 旧格式：平铺存储
      return 'unknown'
    }

    /**
     * 双格式兼容读取缓存条目
     * @param {string} type - 缓存类型（js/fonts/css）
     * @param {string} url - 资源URL
     * @param {number} contentLength - 响应内容长度（可选）
     * @returns {Object|null} 缓存条目或null
     */
    _getCacheEntry(type, url, contentLength = null) {
      if (!this.config.cacheEnabled || !url) {
        return null
      }

      const cacheKey = this.getCacheKey(url)
      if (!cacheKey) {
        return null
      }

      const format = this._detectCacheFormat(this.cache)

      // 新格式：分级缓存读取
      if (format === 'new') {
        const sizeCategory = this._estimateFileSize(url, contentLength)
        const cache = this.cache[type]

        if (!cache || !cache[sizeCategory]) {
          return null
        }

        // 尝试精确匹配（带版本号的key）
        if (cache[sizeCategory][cacheKey]) {
          return cache[sizeCategory][cacheKey]
        }

        // 尝试URL全路径匹配
        if (cache[sizeCategory][url]) {
          return cache[sizeCategory][url]
        }

        return null
      }

      // 旧格式：平铺存储读取（兼容模式）
      if (format === 'legacy') {
        const cache = this.cache[type]
        if (!cache || typeof cache !== 'object') {
          return null
        }

        // 旧格式直接用key或URL读取
        if (cache[cacheKey]) {
          // 如果是字符串，包装成对象返回
          if (typeof cache[cacheKey] === 'string') {
            return {
              url: cache[cacheKey],
              _accessTime: Date.now(),
              _accessCount: 1,
              _size: 0,
              _sizeCategory: 'small',
            }
          }
          return cache[cacheKey]
        }

        if (cache[url]) {
          if (typeof cache[url] === 'string') {
            return {
              url: cache[url],
              _accessTime: Date.now(),
              _accessCount: 1,
              _size: 0,
              _sizeCategory: 'small',
            }
          }
          return cache[url]
        }

        return null
      }

      return null
    }

    /**
     * 设置缓存条目（支持分级缓存）
     * @param {string} type - 缓存类型（js/fonts/css）
     * @param {string} url - 资源URL
     * @param {string} cdnUrl - CDN URL
     * @param {number} contentLength - 响应内容长度（可选）
     */
    _setCacheEntry(type, url, cdnUrl, contentLength = null) {
      if (!this.config.cacheEnabled || !url || !cdnUrl) {
        return
      }

      const cacheKey = this.getCacheKey(url)
      if (!cacheKey) {
        return
      }

      const sizeCategory = this._estimateFileSize(url, contentLength)
      const cache = this.cache[type]

      if (!cache[sizeCategory]) {
        return
      }

      // 存储到对应的大小分类（entry记录双key以便联动淘汰）
      const entry = {
        url: cdnUrl,
        _cacheKey: cacheKey,
        _accessTime: Date.now(),
        _accessCount: 1,
        _size: contentLength || 0,
        _sizeCategory: sizeCategory,
      }

      cache[sizeCategory][cacheKey] = entry
      cache[sizeCategory][url] = entry

      // 更新统计
      this._cacheStats.totalSize++
    }

    /**
     * 记录缓存访问（更新访问统计）
     * @param {string} type - 缓存类型（js/fonts/css）
     * @param {string} url - 资源URL
     * @param {boolean} isHit - 是否命中
     */
    _recordCacheAccess(type, url, isHit) {
      if (!this.config.cacheEnabled) {
        return
      }

      const cacheKey = this.getCacheKey(url)
      if (!cacheKey) {
        return
      }

      const sizeCategory = this._estimateFileSize(url)
      const cache = this.cache[type]

      if (!cache[sizeCategory]) {
        return
      }

      // 更新访问统计
      const entry = cache[sizeCategory][cacheKey] || cache[sizeCategory][url]
      if (entry) {
        entry._accessTime = Date.now()
        entry._accessCount = (entry._accessCount || 0) + 1
      }

      // 更新全局统计
      if (isHit) {
        this._cacheStats.hits++
        this._cacheStats.bySize[sizeCategory].hits++
        this._cacheStats.byType[type].hits++
      } else {
        this._cacheStats.misses++
        this._cacheStats.bySize[sizeCategory].misses++
        this._cacheStats.byType[type].misses++
      }
    }

    /**
     * 获取缓存命中率
     * @returns {number} 命中率（0-1）
     */
    _getCacheHitRate() {
      const total = this._cacheStats.hits + this._cacheStats.misses
      return total > 0 ? this._cacheStats.hits / total : 0
    }

    /**
     * 从 _pendingTimeoutIds 中移除已执行的 timeoutId
     */
    _removePendingTimeout(id) {
      const idx = this._pendingTimeoutIds.indexOf(id)
      if (idx !== -1) {
        this._pendingTimeoutIds.splice(idx, 1)
      }
    }

    /**
     * 获取分级缓存统计
     * @returns {Object} 分级缓存统计
     */
    _getCacheSizeStats() {
      const stats = {
        small: { count: 0, limit: CACHE_SIZE_CONFIG.small.maxSize },
        medium: { count: 0, limit: CACHE_SIZE_CONFIG.medium.maxSize },
        large: { count: 0, limit: CACHE_SIZE_CONFIG.large.maxSize },
        total: 0,
      }

      for (const type of ['js', 'fonts', 'css']) {
        const cache = this.cache[type]
        if (!cache) {
          continue
        }

        // 按 entry 对象引用去重（cacheKey 和 url 指向同一 entry），避免 /2 在 cacheKey===url 时偏低
        for (const size of ['small', 'medium', 'large']) {
          const bucket = cache[size]
          if (!bucket) {
            continue
          }
          stats[size].count += new Set(Object.values(bucket)).size
        }
      }

      stats.total = stats.small.count + stats.medium.count + stats.large.count
      return stats
    }

    /**
     * 应用缓存到页面已存在的资源
     * 优化：使用分块处理，每处理一批让出主线程，减少 INP
     */
    _applyCacheToPage() {
      if (!this.config.cacheEnabled) {
        return
      }

      // 重置中止标志
      this._applyCacheAborted = false

      const CHUNK_SIZE = 10

      // 分块处理函数
      const processInChunks = async (items, processor) => {
        for (let i = 0; i < items.length; i += CHUNK_SIZE) {
          // 检查中止标志
          if (this._applyCacheAborted) {
            console.log(`${LOG_PREFIX} 缓存应用已中止`)
            return
          }
          const chunk = items.slice(i, i + CHUNK_SIZE)
          chunk.forEach(processor)
          // 让出主线程 - 使用 requestIdleCallback 优化 INP
          await new Promise((resolve) => {
            if (typeof requestIdleCallback !== 'undefined') {
              requestIdleCallback(resolve, { timeout: 100 })
            } else {
              setTimeout(resolve, 16) // 降级：~60fps
            }
          })
        }
      }

      // 处理已存在的script标签
      const jsCacheStats = this._getCacheSizeStats()
      if (this.config.jsReplace && jsCacheStats.total > 0) {
        const scripts = document.querySelectorAll('script[src]')
        processInChunks(Array.from(scripts), (script) => {
          const originalUrl = script.src
          const cachedEntry = this._getCacheEntry('js', originalUrl)
          if (cachedEntry) {
            const cachedUrl = cachedEntry.url || cachedEntry
            if (originalUrl !== cachedUrl) {
              script.src = cachedUrl
              this.stats.js.cached++
              this._recordCacheAccess('js', originalUrl, true)
              console.log(`${LOG_PREFIX} 页面缓存命中(JS): ${cachedUrl}`)
            }
          } else {
            this._recordCacheAccess('js', originalUrl, false)
          }
        })
      }

      // 处理已存在的link标签
      const fontCacheStats = this._getCacheSizeStats()
      if (this.config.fontReplace && fontCacheStats.total > 0) {
        const links = document.querySelectorAll('link[rel="stylesheet"]')
        processInChunks(Array.from(links), (link) => {
          const originalUrl = link.href
          const cachedEntry = this._getCacheEntry('fonts', originalUrl)
          if (cachedEntry) {
            const cachedUrl = cachedEntry.url || cachedEntry
            if (originalUrl !== cachedUrl) {
              link.href = cachedUrl
              this.stats.fonts.cached++
              this._recordCacheAccess('fonts', originalUrl, true)
              console.log(`${LOG_PREFIX} 页面缓存命中(字体): ${cachedUrl}`)
            }
          } else {
            this._recordCacheAccess('fonts', originalUrl, false)
          }
        })
      }
    }

    /**
     * 初始化子模块
     * 如果检测到页面已有优化，会使用空对象模式跳过相应模块
     * 如果模块初始化失败，会执行降级操作
     */
    initModules() {
      // 检查当前域名是否被排除
      if (this._isDomainExcluded()) {
        console.log(`${LOG_PREFIX} 当前域名在排除列表中，跳过初始化`)
        return
      }

      const excludePatterns = this._buildExcludePatterns()

      // JS替换模块
      if (this.config.jsReplace && window.JSReplacer) {
        // 检查是否应该跳过
        if (this._skippedOptimizations.jsReplace) {
          this.modules.jsReplacer = NOOP_MODULE
          console.log(`${LOG_PREFIX} 跳过JS替换（页面已使用CDN）`)
        } else {
          try {
            this.modules.jsReplacer = new window.JSReplacer({
              enabled: this.config.enabled,
              excludePatterns,
            })
            this.modules.jsReplacer.init()
            this._wrapJSReplacer()
            // 注册错误处理器
            this._registerModuleErrorHandler('jsReplacer')
          } catch (error) {
            this.errorHandler.handle(error, {
              module: 'jsReplacer',
              operation: 'init',
              level: ErrorLevel.SEVERE,
              data: { config: this.config.jsReplace },
            })
            this._degradeModule('jsReplacer', '初始化失败: ' + error.message)
          }
        }
      }

      // 字体替换模块
      if (this.config.fontReplace && window.FontReplacer) {
        // 检查是否应该跳过
        if (this._skippedOptimizations.fontReplace) {
          this.modules.fontReplacer = NOOP_MODULE
          console.log(`${LOG_PREFIX} 跳过字体替换（页面已优化字体）`)
        } else {
          try {
            this.modules.fontReplacer = new window.FontReplacer({
              enabled: this.config.enabled,
              excludePatterns,
            })
            this.modules.fontReplacer.init()
            this._wrapFontReplacer()
            // 注册错误处理器
            this._registerModuleErrorHandler('fontReplacer')
          } catch (error) {
            this.errorHandler.handle(error, {
              module: 'fontReplacer',
              operation: 'init',
              level: ErrorLevel.SEVERE,
              data: { config: this.config.fontReplace },
            })
            this._degradeModule('fontReplacer', '初始化失败: ' + error.message)
          }
        }
      }

      // CSS加速模块
      if (this.config.cssReplace && window.CSSAccelerator) {
        // 检查是否应该跳过
        if (this._skippedOptimizations.cssReplace) {
          this.modules.cssAccelerator = NOOP_MODULE
          console.log(`${LOG_PREFIX} 跳过CSS加速（页面已使用CDN）`)
        } else {
          try {
            this.modules.cssAccelerator = new window.CSSAccelerator({
              enabled: this.config.enabled,
              excludePatterns,
            })
            this.modules.cssAccelerator.init()
            this._wrapCSSAccelerator()
            // 注册错误处理器
            this._registerModuleErrorHandler('cssAccelerator')
          } catch (error) {
            this.errorHandler.handle(error, {
              module: 'cssAccelerator',
              operation: 'init',
              level: ErrorLevel.SEVERE,
              data: { config: this.config.cssReplace },
            })
            this._degradeModule('cssAccelerator', '初始化失败: ' + error.message)
          }
        }
      }

      // 图片优化模块
      if ((this.config.imageLazyLoad || this.config.imageCompress) && window.ImageOptimizer) {
        // 检查是否应该跳过懒加载（压缩功能不受影响）
        if (this._skippedOptimizations.imageLazyLoad && !this.config.imageCompress) {
          this.modules.imageOptimizer = NOOP_MODULE
          console.log(`${LOG_PREFIX} 跳过图片优化（页面已有懒加载）`)
        } else {
          try {
            this.modules.imageOptimizer = new window.ImageOptimizer({
              // 如果检测到页面已有懒加载，禁用懒加载但保留压缩功能
              lazyLoadEnabled:
                this.config.imageLazyLoad && !this._skippedOptimizations.imageLazyLoad,
              lazyLoadThreshold: this.config.lazyLoadThreshold,
              compressEnabled: this.config.imageCompress,
              compressQuality: this.config.imageQuality,
              compressMinSize: this.config.imageMinSize,
            })
            this.modules.imageOptimizer.init()
            // 注册错误处理器
            this._registerModuleErrorHandler('imageOptimizer')
          } catch (error) {
            this.errorHandler.handle(error, {
              module: 'imageOptimizer',
              operation: 'init',
              level: ErrorLevel.SEVERE,
              data: {
                config: {
                  lazyLoad: this.config.imageLazyLoad,
                  compress: this.config.imageCompress,
                },
              },
            })
            this._degradeModule('imageOptimizer', '初始化失败: ' + error.message)
          }
        }
      }

      // 资源预加载模块
      if (this.config.preloadEnabled && window.ResourcePreloader) {
        // 检查是否应该跳过
        if (this._skippedOptimizations.preload) {
          this.modules.preloader = NOOP_MODULE
          console.log(`${LOG_PREFIX} 跳过资源预加载（页面已有预加载）`)
        } else {
          try {
            this.modules.preloader = new window.ResourcePreloader({
              enabled: this.config.enabled,
              preloadJS: this.config.jsReplace,
              preloadCSS: this.config.cssReplace,
              preloadFonts: this.config.fontReplace,
              excludePatterns,
            })
            this.modules.preloader.init()
            // 注册错误处理器
            this._registerModuleErrorHandler('preloader')
          } catch (error) {
            this.errorHandler.handle(error, {
              module: 'preloader',
              operation: 'init',
              level: ErrorLevel.MINOR, // 预加载失败不影响核心功能
              data: { config: this.config.preloadEnabled },
            })
            this._degradeModule('preloader', '初始化失败: ' + error.message)
          }
        }
      }

      // 资源去重模块（始终启用，不受检测影响）
      if (this.config.dedupEnabled && window.ResourceDeduplicator) {
        try {
          this.modules.deduplicator = new window.ResourceDeduplicator({
            enabled: this.config.enabled,
            dedupJS: this.config.jsReplace,
            dedupCSS: this.config.cssReplace,
            excludePatterns,
          })
          this.modules.deduplicator.init()
          // 注册错误处理器
          this._registerModuleErrorHandler('deduplicator')
        } catch (error) {
          this.errorHandler.handle(error, {
            module: 'deduplicator',
            operation: 'init',
            level: ErrorLevel.MINOR, // 去重失败不影响核心功能
            data: { config: this.config.dedupEnabled },
          })
          this._degradeModule('deduplicator', '初始化失败: ' + error.message)
        }
      }
    }

    /**
     * 为模块注册错误处理器
     * @param {string} moduleName - 模块名称
     */
    _registerModuleErrorHandler(moduleName) {
      this.errorHandler.register(moduleName, (error, record) => {
        // 根据错误级别决定是否降级
        if (record.level === ErrorLevel.FATAL || record.level === ErrorLevel.SEVERE) {
          // 累计错误次数，超过阈值则降级
          const moduleStats = this.errorHandler.errorStats.byModule[moduleName]
          if (moduleStats && moduleStats.severe >= 3) {
            this._degradeModule(moduleName, '累计严重错误超过阈值')
          }
        }
      })
    }

    /**
     * 执行模块降级
     * @param {string} moduleName - 模块名称
     * @param {string} reason - 降级原因
     */
    _degradeModule(moduleName, reason) {
      const module = this.modules[moduleName]
      if (!module || module === NOOP_MODULE) {
        return
      }

      // 模块清理配置映射
      const cleanupConfigs = {
        jsReplacer: {
          listenerProperties: ['_unsubscribe', '_observer', '_originalCreateElement'],
          disableMethod: 'disable',
        },
        fontReplacer: {
          listenerProperties: ['_unsubscribe', '_observer'],
          disableMethod: 'disable',
        },
        cssAccelerator: {
          listenerProperties: ['_unsubscribe', '_observer'],
          disableMethod: 'disable',
        },
        imageOptimizer: {
          listenerProperties: [
            'observer',
            '_unsubscribe',
            '_videoUnsubscribe',
            '_videoObserver',
            '_mutationObserver',
          ],
          disableMethod: 'disableLazyLoad',
        },
        preloader: {
          listenerProperties: [],
          disableMethod: 'disable',
        },
        deduplicator: {
          listenerProperties: [],
          disableMethod: 'disable',
        },
      }

      const cleanupConfig = cleanupConfigs[moduleName] || {
        listenerProperties: [],
        disableMethod: 'disable',
      }

      // 使用 DegradationManager 的公共降级方法
      try {
        this.degradationManager.degradeModule(module, moduleName, reason, cleanupConfig)
      } catch (error) {
        console.warn(`${LOG_PREFIX} 模块 ${moduleName} 降级失败:`, error)
        // 降级失败时，至少记录降级状态
        const prevState = module.getStats ? module.getStats() : null
        this.degradationManager.record(moduleName, reason, prevState)
      }

      // 替换为 NOOP_MODULE
      this.modules[moduleName] = NOOP_MODULE
    }

    /**
     * 尝试恢复降级的模块
     * @param {string} moduleName - 模块名称
     */
    _recoverModule(moduleName) {
      if (!this.degradationManager.isDegraded(moduleName)) {
        return
      }

      // 重新初始化模块
      const initMethod = {
        jsReplacer: () => this.config.jsReplace && window.JSReplacer,
        fontReplacer: () => this.config.fontReplace && window.FontReplacer,
        cssAccelerator: () => this.config.cssReplace && window.CSSAccelerator,
        imageOptimizer: () =>
          (this.config.imageLazyLoad || this.config.imageCompress) && window.ImageOptimizer,
        preloader: () => this.config.preloadEnabled && window.ResourcePreloader,
        deduplicator: () => this.config.dedupEnabled && window.ResourceDeduplicator,
      }

      const checkMethod = initMethod[moduleName]
      if (checkMethod && checkMethod()) {
        try {
          // 临时移除模块以触发重新初始化
          this.modules[moduleName] = null
          // 只初始化这一个模块
          this._initSingleModule(moduleName)
          // 记录恢复
          this.degradationManager.recover(moduleName)
        } catch (error) {
          this.errorHandler.handle(error, {
            module: moduleName,
            operation: 'recover',
            level: ErrorLevel.SEVERE,
          })
        }
      }
    }

    /**
     * 初始化单个模块（用于恢复）
     */
    _initSingleModule(moduleName) {
      const excludePatterns = this._buildExcludePatterns()

      switch (moduleName) {
        case 'jsReplacer':
          if (this.config.jsReplace && window.JSReplacer) {
            this.modules.jsReplacer = new window.JSReplacer({
              enabled: this.config.enabled,
              excludePatterns,
            })
            this.modules.jsReplacer.init()
            this._wrapJSReplacer()
          }
          break
        case 'fontReplacer':
          if (this.config.fontReplace && window.FontReplacer) {
            this.modules.fontReplacer = new window.FontReplacer({
              enabled: this.config.enabled,
              excludePatterns,
            })
            this.modules.fontReplacer.init()
            this._wrapFontReplacer()
          }
          break
        case 'cssAccelerator':
          if (this.config.cssReplace && window.CSSAccelerator) {
            this.modules.cssAccelerator = new window.CSSAccelerator({
              enabled: this.config.enabled,
              excludePatterns,
            })
            this.modules.cssAccelerator.init()
            this._wrapCSSAccelerator()
          }
          break
        case 'imageOptimizer':
          if ((this.config.imageLazyLoad || this.config.imageCompress) && window.ImageOptimizer) {
            this.modules.imageOptimizer = new window.ImageOptimizer({
              lazyLoadEnabled: this.config.imageLazyLoad,
              lazyLoadThreshold: this.config.lazyLoadThreshold,
              compressEnabled: this.config.imageCompress,
              compressQuality: this.config.imageQuality,
              compressMinSize: this.config.imageMinSize,
            })
            this.modules.imageOptimizer.init()
          }
          break
        case 'preloader':
          if (this.config.preloadEnabled && window.ResourcePreloader) {
            this.modules.preloader = new window.ResourcePreloader({
              enabled: this.config.enabled,
              preloadJS: this.config.jsReplace,
              preloadCSS: this.config.cssReplace,
              preloadFonts: this.config.fontReplace,
              excludePatterns,
            })
            this.modules.preloader.init()
          }
          break
        case 'deduplicator':
          if (this.config.dedupEnabled && window.ResourceDeduplicator) {
            this.modules.deduplicator = new window.ResourceDeduplicator({
              enabled: this.config.enabled,
              dedupJS: this.config.jsReplace,
              dedupCSS: this.config.cssReplace,
              excludePatterns,
            })
            this.modules.deduplicator.init()
          }
          break
      }
    }

    /**
     * 检查当前域名是否被排除
     */
    _isDomainExcluded() {
      const hostname = window.location.hostname
      return this.config.excludeDomains.some(
        (domain) => hostname === domain || hostname.endsWith('.' + domain)
      )
    }

    /**
     * 构建排除模式
     */
    _buildExcludePatterns() {
      const patterns = []

      // 添加URL排除规则
      this.config.excludeUrls.forEach((url) => {
        try {
          patterns.push(new RegExp(url.replace(/\*/g, '.*'), 'i'))
        } catch {
          // 忽略无效正则
        }
      })

      return patterns
    }

    /**
     * 后台探测所有CDN健康状态(不阻塞主流程)
     * 优化：
     * - 使用 requestIdleCallback + setTimeout 递归调度，避免 setInterval 在用户交互时触发
     * - 自适应探测间隔：健康CDN延长间隔，不健康CDN缩短间隔
     */
    _probeCDNHealth() {
      if (!window.CDNMappings?.CDNHealthProbe) {
        return
      }

      const allCdnIds = window.CDNMappings.CDN_SOURCES.filter((c) => c.format !== 'font').map(
        (c) => c.id
      )

      // 并发锁：防止多次 probeAll 叠加成 fetch 风暴
      this._probeInflight = false
      const safeProbeAll = async () => {
        if (this._probeInflight || this._healthProbeStopped) {
          return
        }
        this._probeInflight = true
        try {
          await window.CDNMappings.CDNHealthProbe.probeAll(allCdnIds)
        } catch (e) {
          console.warn(`${LOG_PREFIX} CDN 探测失败:`, e?.message)
        } finally {
          this._probeInflight = false
        }
      }

      // 延迟探测，不阻塞页面初始化
      setTimeout(() => {
        safeProbeAll().then(() => {
          console.log(`${LOG_PREFIX} CDN健康探测完成`)
        })
      }, 2000)

      // 使用 requestIdleCallback + setTimeout 递归调度，避免 setInterval 在用户交互时触发
      const scheduleHealthProbe = () => {
        // 检查停止标志，控制调度循环
        if (this._healthProbeStopped) {
          return
        }

        // 获取自适应探测间隔（基于各CDN健康状态计算最短间隔，内部已保底 30s）
        const probeInterval = this._getAdaptiveProbeInterval(allCdnIds)

        this._healthProbeTimer = setTimeout(() => {
          // 再次检查停止标志
          if (this._healthProbeStopped) {
            return
          }

          if (typeof requestIdleCallback !== 'undefined') {
            const idleId = requestIdleCallback(
              async () => {
                // 执行前检查停止标志
                if (this._healthProbeStopped) {
                  return
                }
                await safeProbeAll()
                // 递归调度下一次探测（先检查停止标志）
                if (!this._healthProbeStopped) {
                  scheduleHealthProbe()
                }
              },
              { timeout: 10000 }
            )
            // 存储 requestIdleCallback ID
            this._idleCallbackIds.push(idleId)
          } else {
            // 降级：直接执行
            safeProbeAll().then(() => {
              if (!this._healthProbeStopped) {
                scheduleHealthProbe()
              }
            })
          }
        }, probeInterval)
      }

      // 首次调度
      scheduleHealthProbe()
    }

    /**
     * 计算自适应探测间隔
     * 基于所有CDN的健康状态，取最短的间隔作为下次探测间隔
     * @param {string[]} cdnIds
     * @returns {number} 探测间隔(ms)
     */
    _getAdaptiveProbeInterval(cdnIds) {
      const probe = window.CDNMappings?.CDNHealthProbe
      if (!probe) {
        return 5 * 60 * 1000
      } // 默认5分钟

      // 收集所有CDN的建议间隔
      const intervals = cdnIds.map((id) => probe.getAdaptiveInterval(id))

      // 取最短间隔，确保不健康CDN能被及时探测
      const minInterval = Math.min(...intervals)

      // 添加随机偏移（±10%），避免所有扩展同时探测
      const jitter = minInterval * 0.1
      const offset = (Math.random() * 2 - 1) * jitter

      return Math.max(Math.round(minInterval + offset), 30 * 1000) // 最小30秒
    }

    /**
     * 资源加载失败时尝试降级到下一个CDN
     * 优化：
     * - 记录详细的降级日志（原CDN、新CDN、剩余降级数）
     * - 降级失败时记录完整错误信息
     */
    _handleLoadError(element, match, originalUrl) {
      if (!match?.fallbackUrls?.length || !window.CDNMappings?.CDNHealthProbe) {
        if (!window.CDNMappings?.CDNHealthProbe) {
          console.warn(`${LOG_PREFIX} CDNHealthProbe 不可用，无法降级: ${originalUrl}`)
        }
        return false
      }

      const failedCdnId = match.cdnId
      const failedCdnName = window.CDNMappings.CDN_BY_ID[failedCdnId]?.name || failedCdnId

      // 标记当前CDN不可用
      if (failedCdnId) {
        window.CDNMappings.CDNHealthProbe.markUnhealthy(failedCdnId)
      }

      // 尝试下一个降级CDN（不修改原数组）
      const fallbackCopy = match.fallbackUrls
      if (!match._fallbackIndex) {
        match._fallbackIndex = 0
      }
      const next = fallbackCopy[match._fallbackIndex]
      match._fallbackIndex++
      if (!next) {
        console.warn(
          `${LOG_PREFIX} 无可用降级CDN，原始URL: ${originalUrl}，失败CDN: ${failedCdnName}`
        )
        return false
      }

      const nextCdnName = window.CDNMappings.CDN_BY_ID[next.cdnId]?.name || next.cdnId
      const remaining = match.fallbackUrls.length

      console.log(
        `${LOG_PREFIX} 降级: ${failedCdnName} → ${nextCdnName} ` +
          `(剩余${remaining}个降级CDN), 原始: ${originalUrl}`
      )

      if (element.tagName === 'SCRIPT') {
        element.src = next.url
      } else if (element.tagName === 'LINK') {
        element.href = next.url
      } else {
        console.warn(`${LOG_PREFIX} 不支持的元素类型: ${element.tagName}, URL: ${originalUrl}`)
        return false
      }

      // 更新缓存（使用分级缓存 API，避免旧格式污染）
      const cacheType = element.tagName === 'SCRIPT' ? 'js' : 'css'
      if (this.config.cacheEnabled) {
        this._setCacheEntry(cacheType, originalUrl, next.url)
        this.saveCache()
      }

      // 绑定下次失败的降级
      this._bindFallback(element, match, originalUrl)
      return true
    }

    /**
     * 绑定资源加载失败的降级处理
     */
    _bindFallback(element, match, originalUrl) {
      const self = this
      const failedCdnName = window.CDNMappings?.CDN_BY_ID[match.cdnId]?.name || match.cdnId

      element.addEventListener(
        'error',
        function onError() {
          element.removeEventListener('error', onError)
          if (!self._handleLoadError(element, match, originalUrl)) {
            // 所有降级都失败，恢复原始URL
            console.warn(
              `${LOG_PREFIX} 所有CDN降级失败，恢复原始URL: ${originalUrl} ` +
                `(最后失败CDN: ${failedCdnName})`
            )
            if (element.tagName === 'SCRIPT') {
              element.src = originalUrl
            } else if (element.tagName === 'LINK') {
              element.href = originalUrl
            }
          }
        },
        { once: true }
      )
    }

    /**
     * 包装JSReplacer的processScript方法，添加缓存逻辑
     */
    _wrapJSReplacer() {
      if (!this.modules.jsReplacer) {
        return
      }

      this._originalProcessScript = this.modules.jsReplacer.processScript.bind(
        this.modules.jsReplacer
      )
      const self = this

      this.modules.jsReplacer.processScript = function (script) {
        if (!self.config.enabled) {
          return
        }

        const url = script.src
        if (!url) {
          return
        }

        // 避免重复处理
        if (self.modules.jsReplacer._processedScripts.has(script)) {
          return
        }

        // 1. 先查缓存（使用分级缓存）
        const cachedEntry = self._getCacheEntry('js', url)
        if (cachedEntry) {
          const cachedUrl = cachedEntry.url || cachedEntry
          if (script.src !== cachedUrl) {
            script.src = cachedUrl
            self.stats.js.cached++
            self._recordCacheAccess('js', url, true)
            self._recordCacheHit()
            self.modules.jsReplacer._processedScripts.add(script)
            console.log(`${LOG_PREFIX} 缓存命中(JS): ${cachedUrl}`)
          }
          return
        }

        // 2. 缓存未命中，走原逻辑
        self._recordCacheAccess('js', url, false)
        self._recordCacheMiss()
        const startTime = performance.now()
        const statsBefore = self.modules.jsReplacer.stats.replaced
        self._originalProcessScript(script)
        const duration = performance.now() - startTime

        // 3. 如果替换成功，保存到缓存 + 绑定降级
        const success = self.modules.jsReplacer.stats.replaced > statsBefore
        self._recordReplacement('js', success, duration)
        if (self.config.cacheEnabled && success) {
          const details = self.modules.jsReplacer.stats.details
          const detail = details[details.length - 1]
          if (detail && detail.original && detail.cdn) {
            // 使用分级缓存存储
            self._setCacheEntry('js', detail.original, detail.cdn)
            self.saveCache()

            // 匹配结果含降级信息时绑定error降级
            const match = window.CDNMappings?.matchJSLibrary(detail.original)
            if (match?.fallbackUrls?.length) {
              match.cdnUrl = detail.cdn
              self._bindFallback(script, match, detail.original)
            }
          }
        }
      }
    }

    /**
     * 包装FontReplacer的processLink方法，添加缓存逻辑
     */
    /**
     * 包装FontReplacer的processLink方法，添加缓存逻辑
     */
    _wrapFontReplacer() {
      if (!this.modules.fontReplacer) {
        return
      }

      this._originalProcessLink = this.modules.fontReplacer.processLink.bind(
        this.modules.fontReplacer
      )
      const self = this

      this.modules.fontReplacer.processLink = function (link) {
        if (!self.config.enabled) {
          return
        }

        const url = link.href
        if (!url) {
          return
        }

        // 避免重复处理
        if (self.modules.fontReplacer._processedLinks.has(link)) {
          return
        }

        // 1. 先查缓存（使用分级缓存）
        const cachedEntry = self._getCacheEntry('fonts', url)
        if (cachedEntry) {
          const cachedUrl = cachedEntry.url || cachedEntry
          if (link.href !== cachedUrl) {
            link.href = cachedUrl
            self.stats.fonts.cached++
            self._recordCacheAccess('fonts', url, true)
            self._recordCacheHit()
            self.modules.fontReplacer._processedLinks.add(link)
            console.log(`${LOG_PREFIX} 缓存命中(字体): ${cachedUrl}`)
          }
          return
        }

        // 2. 缓存未命中，走原逻辑
        self._recordCacheAccess('fonts', url, false)
        self._recordCacheMiss()
        const startTime = performance.now()
        const statsBefore = self.modules.fontReplacer.stats.replaced
        self._originalProcessLink(link)
        const duration = performance.now() - startTime

        // 3. 如果替换成功，保存到缓存
        const success = self.modules.fontReplacer.stats.replaced > statsBefore
        self._recordReplacement('fonts', success, duration)
        if (self.config.cacheEnabled && success) {
          const details = self.modules.fontReplacer.stats.details
          const detail = details[details.length - 1]
          if (detail && detail.original && detail.cdn) {
            // 使用分级缓存存储
            self._setCacheEntry('fonts', detail.original, detail.cdn)
            self.saveCache()
          }
        }
      }
    }

    /**
     * 包装CSSAccelerator的processLink方法，添加缓存逻辑
     */
    _wrapCSSAccelerator() {
      if (!this.modules.cssAccelerator) {
        return
      }

      const origProcess = this.modules.cssAccelerator.processLink.bind(this.modules.cssAccelerator)
      this._originalProcessCSSLink = origProcess
      const self = this

      this.modules.cssAccelerator.processLink = function (link) {
        if (!self.config.enabled) {
          return
        }

        const url = link.href
        if (!url) {
          return
        }

        if (self.modules.cssAccelerator._processedLinks.has(link)) {
          return
        }

        // 查缓存（使用分级缓存）
        const cachedEntry = self._getCacheEntry('css', url)
        if (cachedEntry) {
          const cachedUrl = cachedEntry.url || cachedEntry
          if (link.href !== cachedUrl) {
            link.href = cachedUrl
            self.stats.css.cached++
            self._recordCacheAccess('css', url, true)
            self._recordCacheHit()
            self.modules.cssAccelerator._processedLinks.add(link)
            console.log(`${LOG_PREFIX} 缓存命中(CSS): ${cachedUrl}`)
          }
          return
        }

        // 缓存未命中
        self._recordCacheAccess('css', url, false)
        self._recordCacheMiss()
        const startTime = performance.now()
        const statsBefore = self.modules.cssAccelerator.stats.replaced
        origProcess(link)
        const duration = performance.now() - startTime

        // 保存到缓存 + 绑定降级
        const success = self.modules.cssAccelerator.stats.replaced > statsBefore
        self._recordReplacement('css', success, duration)
        if (self.config.cacheEnabled && success) {
          const details = self.modules.cssAccelerator.stats.details
          const detail = details[details.length - 1]
          if (detail && detail.original && detail.cdn) {
            // 使用分级缓存存储
            self._setCacheEntry('css', detail.original, detail.cdn)
            self.saveCache()

            // 绑定error降级
            const match = window.CDNMappings?.matchCSS(detail.original)
            if (match?.fallbackUrls?.length) {
              match.cdnUrl = detail.cdn
              self._bindFallback(link, match, detail.original)
            }
          }
        }
      }
    }

    /**
     * 监听统计消息和配置更新
     * 使用 ListenerTracker 追踪监听器，便于销毁时清理
     */
    listenStats() {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        // 创建监听器函数并保存引用
        this._messageListener = (message, sender, sendResponse) => {
          // 处理配置更新
          if (message.type === 'RESOURCE_ACCELERATOR_CONFIG') {
            this.updateConfig(message.data)
            return false
          }

          // 返回统计信息
          if (message.type === 'RESOURCE_ACCELERATOR_GET_STATS') {
            sendResponse(this.getStats())
            return true
          }

          // 清除缓存
          if (message.type === 'RESOURCE_ACCELERATOR_CLEAR_CACHE') {
            this.clearCache().then(() => sendResponse({ cleared: true }))
            return true
          }

          // 处理统计消息
          this.updateStats(message)
          return false
        }

        // 使用 ListenerTracker 添加并追踪监听器
        this.listenerTracker.add(chrome.runtime.onMessage, this._messageListener)
      }
    }

    /**
     * 更新统计
     */
    updateStats(message) {
      if (!message || !message.type) {
        return
      }

      switch (message.type) {
        case 'JS_REPLACER_STATS':
          this.stats.js.replaced++
          this._cumulativeStats.totalJsReplaced++
          break
        case 'FONT_REPLACER_STATS':
          this.stats.fonts.replaced++
          this._cumulativeStats.totalFontsReplaced++
          break
        case 'CSS_ACCELERATOR_STATS':
          this.stats.css.replaced++
          this._cumulativeStats.totalCssReplaced++
          break
        default:
          break
      }

      this._saveCumulativeStats()
    }

    /**
     * 加载累计统计
     */
    async _loadCumulativeStats() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(STATS_KEY)
          if (result[STATS_KEY]) {
            this._cumulativeStats = { ...this._cumulativeStats, ...result[STATS_KEY] }
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 加载累计统计失败:`, error.message)
      }
    }

    /**
     * 保存累计统计(debounce)
     */
    _saveCumulativeStats() {
      if (this._statsSaveTimer) {
        clearTimeout(this._statsSaveTimer)
      }

      this._statsSaveTimer = setTimeout(async () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({ [STATS_KEY]: this._cumulativeStats })
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} 保存累计统计失败:`, error.message)
        }
        this._statsSaveTimer = null
      }, CACHE_SAVE_DELAY)
    }

    /**
     * 获取统计信息
     */
    getStats() {
      const jsStats = this.modules.jsReplacer?.getStats() || this.stats.js
      const fontStats = this.modules.fontReplacer?.getStats() || this.stats.fonts
      const cssStats = this.modules.cssAccelerator?.getStats() || this.stats.css
      const imageStats = this.modules.imageOptimizer?.getStats() || this.stats.images
      const preloadStats = this.modules.preloader?.getStats() || this.stats.preload
      const dedupStats = this.modules.deduplicator?.getStats() || this.stats.dedup

      // 获取分级缓存统计
      const cacheSizeStats = this._getCacheSizeStats()

      // CDN探测统计
      const cdnProbeStats = this._getCDNProbeStats()

      return {
        enabled: this.config.enabled,
        js: { ...jsStats, cached: this.stats.js.cached },
        fonts: { ...fontStats, cached: this.stats.fonts.cached },
        css: { ...cssStats, cached: this.stats.css.cached },
        images: imageStats,
        preload: preloadStats,
        dedup: dedupStats,
        cache: {
          // 分级缓存统计
          sizeStats: cacheSizeStats,
          // 命中率统计
          hitRate: this._getCacheHitRate(),
          hitRatePercent: (this._getCacheHitRate() * 100).toFixed(1) + '%',
          hits: this._cacheStats.hits,
          misses: this._cacheStats.misses,
          // 淘汰统计
          evictions: this._cacheStats.evictions,
          bySize: this._cacheStats.bySize,
          byType: this._cacheStats.byType,
          // 预热统计
          warmups: this._cacheStats.warmups,
          // 缓存大小统计
          totalSize: this._cacheStats.totalSize,
          timestamp: this.cache.timestamp,
        },
        // CDN探测统计
        cdnProbe: cdnProbeStats,
        // 页面优化检测相关统计
        detection: {
          enabled: !!this._detector,
          detectionErrors: this._detectionErrors,
          skippedOptimizations: { ...this._skippedOptimizations },
          detectorStats: this._detector?.getStats() || null,
          skipperStats: this._skipper?.getSkipStats() || null,
        },
        // 错误和降级统计
        errors: this.errorHandler.getStats(),
        degradation: this.degradationManager.getStats(),
        // 监听器统计
        listeners: this.listenerTracker?.getStats() || null,
        // 性能监控指标
        performance: this._getPerformanceMetrics(),
      }
    }

    /**
     * 获取CDN探测统计
     * @returns {Object} CDN探测统计数据
     */
    _getCDNProbeStats() {
      if (!window.CDNMappings?.CDNHealthProbe) {
        return { enabled: false }
      }
      return window.CDNMappings.CDNHealthProbe.getProbeStats()
    }

    /**
     * 获取性能监控指标
     */
    _getPerformanceMetrics() {
      const m = this._performanceMetrics
      const cacheTotal = m.cacheHits + m.cacheMisses

      // 计算各类型替换的平均耗时
      const avgTimes = {}
      for (const [type, record] of Object.entries(m.replacements)) {
        avgTimes[type] = record.success > 0 ? record.totalTime / record.success : 0
      }

      return {
        // 关键路径耗时（毫秒）
        initDuration: m.measures.init || 0,
        initModulesDuration: m.measures.initModules || 0,
        loadConfigDuration: m.measures.loadConfig || 0,
        loadCacheDuration: m.measures.loadCache || 0,
        applyCacheToPageDuration: m.measures.applyCacheToPage || 0,
        loadCumulativeStatsDuration: m.measures.loadCumulativeStats || 0,
        // 缓存统计
        cacheHits: m.cacheHits,
        cacheMisses: m.cacheMisses,
        cacheHitRate: cacheTotal > 0 ? ((m.cacheHits / cacheTotal) * 100).toFixed(1) + '%' : 'N/A',
        // 替换统计
        replacements: {
          js: {
            total: m.replacements.js.total,
            success: m.replacements.js.success,
            successRate:
              m.replacements.js.total > 0
                ? ((m.replacements.js.success / m.replacements.js.total) * 100).toFixed(1) + '%'
                : 'N/A',
            avgDuration: avgTimes.js.toFixed(2) + 'ms',
          },
          fonts: {
            total: m.replacements.fonts.total,
            success: m.replacements.fonts.success,
            successRate:
              m.replacements.fonts.total > 0
                ? ((m.replacements.fonts.success / m.replacements.fonts.total) * 100).toFixed(1) +
                  '%'
                : 'N/A',
            avgDuration: avgTimes.fonts.toFixed(2) + 'ms',
          },
          css: {
            total: m.replacements.css.total,
            success: m.replacements.css.success,
            successRate:
              m.replacements.css.total > 0
                ? ((m.replacements.css.success / m.replacements.css.total) * 100).toFixed(1) + '%'
                : 'N/A',
            avgDuration: avgTimes.css.toFixed(2) + 'ms',
          },
        },
        // 图片处理统计（从 ImageOptimizer 获取）
        imageProcessing: this.modules.imageOptimizer?.compressorPool
          ? this.modules.imageOptimizer.compressorPool.getStats()
          : null,
      }
    }

    /**
     * 更新配置
     */
    async updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig }
      await this.saveConfig()

      // 同步更新子模块
      if (this.modules.jsReplacer) {
        this.modules.jsReplacer.enabled = this.config.jsReplace && this.config.enabled
      }
      if (this.modules.fontReplacer) {
        this.modules.fontReplacer.enabled = this.config.fontReplace && this.config.enabled
      }
      if (this.modules.cssAccelerator) {
        this.modules.cssAccelerator.enabled = this.config.cssReplace && this.config.enabled
      }
      if (this.modules.imageOptimizer) {
        if (this.config.imageLazyLoad) {
          this.modules.imageOptimizer.enableLazyLoad()
        } else {
          this.modules.imageOptimizer.disableLazyLoad()
        }
        if (this.config.imageCompress) {
          this.modules.imageOptimizer.enableCompress()
        } else {
          this.modules.imageOptimizer.disableCompress()
        }
      }
      if (this.modules.preloader) {
        this.modules.preloader.enabled = this.config.preloadEnabled && this.config.enabled
      }
      if (this.modules.deduplicator) {
        this.modules.deduplicator.enabled = this.config.dedupEnabled && this.config.enabled
      }

      console.log(`${LOG_PREFIX} 配置已更新`, newConfig)
    }

    /**
     * 清除缓存
     */
    async clearCache() {
      this.cache = {
        js: { small: {}, medium: {}, large: {} },
        fonts: { small: {}, medium: {}, large: {} },
        css: { small: {}, medium: {}, large: {} },
        timestamp: Date.now(),
        lastSaved: 0,
      }

      // 重置缓存统计
      this._cacheStats = {
        hits: 0,
        misses: 0,
        evictions: 0,
        warmups: 0,
        bySize: {
          small: { hits: 0, misses: 0, evictions: 0 },
          medium: { hits: 0, misses: 0, evictions: 0 },
          large: { hits: 0, misses: 0, evictions: 0 },
        },
        byType: {
          js: { hits: 0, misses: 0, evictions: 0 },
          fonts: { hits: 0, misses: 0, evictions: 0 },
          css: { hits: 0, misses: 0, evictions: 0 },
        },
        lastResetTime: Date.now(),
        totalSize: 0,
      }

      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.remove(CACHE_KEY)
        }
        console.log(`${LOG_PREFIX} 缓存已清除`)
      } catch (error) {
        console.warn(`${LOG_PREFIX} 清除缓存失败:`, error.message)
      }
    }

    /**
     * 启用模块
     */
    enable() {
      this.config.enabled = true

      // 跳过 NOOP_MODULE
      if (this.modules.jsReplacer && this.modules.jsReplacer !== NOOP_MODULE) {
        this.modules.jsReplacer.enable()
      }
      if (this.modules.fontReplacer && this.modules.fontReplacer !== NOOP_MODULE) {
        this.modules.fontReplacer.enable()
      }
      if (this.modules.cssAccelerator && this.modules.cssAccelerator !== NOOP_MODULE) {
        this.modules.cssAccelerator.enable()
      }
      if (this.modules.imageOptimizer && this.modules.imageOptimizer !== NOOP_MODULE) {
        this.modules.imageOptimizer.init()
      }
      if (this.modules.preloader && this.modules.preloader !== NOOP_MODULE) {
        this.modules.preloader.enable()
      }
      if (this.modules.deduplicator && this.modules.deduplicator !== NOOP_MODULE) {
        this.modules.deduplicator.enable()
      }

      console.log(`${LOG_PREFIX} 模块已启用`)
    }

    /**
     * 禁用模块
     */
    disable() {
      this.config.enabled = false

      // 跳过 NOOP_MODULE
      if (this.modules.jsReplacer && this.modules.jsReplacer !== NOOP_MODULE) {
        this.modules.jsReplacer.disable()
      }
      if (this.modules.fontReplacer && this.modules.fontReplacer !== NOOP_MODULE) {
        this.modules.fontReplacer.disable()
      }
      if (this.modules.cssAccelerator && this.modules.cssAccelerator !== NOOP_MODULE) {
        this.modules.cssAccelerator.disable()
      }
      if (this.modules.imageOptimizer && this.modules.imageOptimizer !== NOOP_MODULE) {
        this.modules.imageOptimizer.disableLazyLoad()
      }
      if (this.modules.preloader && this.modules.preloader !== NOOP_MODULE) {
        this.modules.preloader.disable()
      }
      if (this.modules.deduplicator && this.modules.deduplicator !== NOOP_MODULE) {
        this.modules.deduplicator.disable()
      }

      console.log(`${LOG_PREFIX} 模块已禁用`)
    }

    /**
     * 销毁模块
     */
    destroy() {
      // 恢复原始方法
      if (this._originalProcessScript && this.modules.jsReplacer) {
        this.modules.jsReplacer.processScript = this._originalProcessScript
      }
      if (this._originalProcessLink && this.modules.fontReplacer) {
        this.modules.fontReplacer.processLink = this._originalProcessLink
      }
      if (this._originalProcessCSSLink && this.modules.cssAccelerator) {
        this.modules.cssAccelerator.processLink = this._originalProcessCSSLink
      }

      // 销毁子模块（跳过 NOOP_MODULE）
      const moduleNames = [
        'jsReplacer',
        'fontReplacer',
        'cssAccelerator',
        'imageOptimizer',
        'preloader',
        'deduplicator',
      ]
      moduleNames.forEach((name) => {
        if (this.modules[name] && this.modules[name] !== NOOP_MODULE) {
          this.modules[name].destroy()
        }
        this.modules[name] = null
      })

      // 清理debounce定时器
      if (this._cacheSaveTimer) {
        clearTimeout(this._cacheSaveTimer)
        this._cacheSaveTimer = null
      }
      if (this._statsSaveTimer) {
        clearTimeout(this._statsSaveTimer)
        this._statsSaveTimer = null
      }

      // 清理CDN健康探测定时器
      if (this._healthProbeTimer) {
        clearTimeout(this._healthProbeTimer)
        this._healthProbeTimer = null
      }

      // 设置停止标志，防止递归调度继续执行
      this._healthProbeStopped = true

      // 设置缓存应用中止标志
      this._applyCacheAborted = true

      // 清理所有 requestIdleCallback
      if (this._idleCallbackIds && this._idleCallbackIds.length > 0) {
        this._idleCallbackIds.forEach((idleId) => {
          if (typeof cancelIdleCallback !== 'undefined') {
            cancelIdleCallback(idleId)
          }
        })
        this._idleCallbackIds = []
      }

      // 清理所有 setTimeout 降级路径
      if (this._pendingTimeoutIds && this._pendingTimeoutIds.length > 0) {
        this._pendingTimeoutIds.forEach((id) => clearTimeout(id))
        this._pendingTimeoutIds = []
      }

      // 清理所有事件监听器
      if (this.listenerTracker) {
        this.listenerTracker.cleanup()
      }

      // 重置状态
      this.config.enabled = false
      this._originalProcessScript = null
      this._originalProcessLink = null
      this._originalProcessCSSLink = null
      this._messageListener = null

      // 清理检测器和跳过器
      this._detector = null
      this._skipper = null
      this._skippedOptimizations = {}

      console.log(`${LOG_PREFIX} 模块已销毁`)
    }
  }

  // 导出
  window.ResourceAccelerator = ResourceAccelerator

  // 自动初始化
  const autoInit = () => {
    if (window.resourceAcceleratorInstance) {
      console.log(`${LOG_PREFIX} 已存在实例，跳过自动初始化`)
      return
    }

    const accelerator = new ResourceAccelerator()
    try {
      accelerator.init()
      window.resourceAcceleratorInstance = accelerator
    } catch (error) {
      console.error(`${LOG_PREFIX} 自动初始化失败:`, error)
    }
  }

  // 根据文档状态选择初始化时机
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit, { once: true })
  } else {
    // 延迟初始化，确保其他模块已加载
    setTimeout(autoInit, 0)
  }
})()
