/**
 * LoadScheduler - 脚本加载调度器
 * 优化加载时机：
 * 1. 关键模块（资源加速器及其依赖）立即加载
 * 2. 非关键模块在浏览器空闲时加载
 */

(function () {
  'use strict'

  if (window.LoadScheduler) {
    console.log('[LoadScheduler] 已存在，跳过初始化')
    return
  }

  // ========== 配置 ==========
  const CONFIG = {
    // 空闲任务超时时间（ms）- 统一 aggressive 策略
    idleTimeout: 100,
    // 最大并发空闲任务数
    maxConcurrentIdle: 1,
    // 调试模式
    debug: false,
    // 强制执行阈值（ms）
    forceExecuteTimeout: 300,
  }

  // ========== 状态 ==========
  const state = {
    // 已加载的模块
    loaded: new Set(),
    // 等待空闲加载的任务队列
    idleQueue: [],
    // 正在执行的空闲任务
    executingIdle: new Set(),
    // 浏览器是否空闲
    isIdle: false,
    // 空闲回调 ID
    idleCallbackId: null,
    // MutationObserver 监听器
    observer: null,
    // 事件监听器引用（用于清理）
    interactionListeners: [],
    interactionTimer: null,
    // 性能监控指标
    performanceMetrics: {
      // 模块加载耗时记录 { moduleName: duration }
      moduleLoadTimes: {},
      // 空闲任务统计
      idleTasks: {
        total: 0,
        completed: 0,
        timedOut: 0,
      },
      // 关键路径耗时
      criticalPath: {
        schedulerInitTime: 0,
        firstIdleTime: 0,
      },
    },
  }

  // ========== 工具函数 ==========

  /**
   * 安全执行回调
   */
  async function safeExecute(name, callback) {
    try {
      const result = callback()
      if (result instanceof Promise) {
        await result
      }
    } catch (err) {
      log(`"${name}" 执行错误: ${err.message}`, 'error')
    }
  }

  /**
   * 日志输出
   */
  function log(message, level = 'info') {
    if (!CONFIG.debug && level !== 'error') {
      return
    }

    const prefix = '[LoadScheduler]'
    switch (level) {
      case 'error':
        console.error(prefix, message)
        break
      case 'warn':
        console.warn(prefix, message)
        break
      default:
        if (CONFIG.debug) {
          console.log(prefix, message)
        }
    }
  }

  // ========== 空闲检测 ==========

  /**
   * 请求空闲回调（兼容性封装）
   */
  function requestIdle(callback, options = {}) {
    // 优先使用 scheduler.postTask（Chrome 94+）
    if (typeof scheduler !== 'undefined' && scheduler.postTask) {
      return scheduler
        .postTask(callback, {
          priority: 'user-visible',
        })
        .catch(() => {
          // 降级到 requestIdleCallback
          _fallbackRequestIdle(callback, options)
        })
    }

    // 降级到 requestIdleCallback
    return _fallbackRequestIdle(callback, options)
  }

  /**
   * requestIdleCallback 降级方案
   */
  function _fallbackRequestIdle(callback, options) {
    if (typeof requestIdleCallback !== 'undefined') {
      return requestIdleCallback(callback, {
        timeout: options.timeout || CONFIG.idleTimeout,
      })
    }

    // 最终降级：setTimeout
    return setTimeout(() => {
      callback({ didTimeout: false, timeRemaining: () => 50 })
    }, options.timeout || CONFIG.idleTimeout)
  }

  /**
   * 启动空闲任务调度
   */
  function startIdleScheduler() {
    if (state.idleCallbackId !== null) {
      return
    }

    function scheduleIdle(deadline) {
      // 检查是否有空闲时间
      const hasTime =
        deadline && typeof deadline.timeRemaining === 'function'
          ? deadline.timeRemaining() > 10
          : true

      if (hasTime && state.idleQueue.length > 0) {
        // 执行空闲任务
        const task = state.idleQueue.shift()
        state.executingIdle.add(task.name)

        log(`执行空闲任务: ${task.name}`)
        const startTime = performance.now()
        safeExecute(task.name, task.callback)
        const duration = performance.now() - startTime
        state.performanceMetrics.moduleLoadTimes[task.name] = duration
        state.performanceMetrics.idleTasks.completed++

        if (CONFIG.debug) {
          log(`空闲任务 "${task.name}" 执行耗时: ${duration.toFixed(2)}ms`)
        }

        state.executingIdle.delete(task.name)
      }

      // 继续调度
      if (state.idleQueue.length > 0) {
        state.idleCallbackId = requestIdle(scheduleIdle, {
          timeout: CONFIG.idleTimeout,
        })
      } else {
        state.idleCallbackId = null
        log('空闲任务队列已清空')
      }
    }

    // 开始调度
    state.idleCallbackId = requestIdle(scheduleIdle, {
      timeout: CONFIG.idleTimeout,
    })

    log('空闲调度器已启动')
  }

  /**
   * 监听页面活动状态
   */
  function observePageActivity() {
    // 监听用户交互事件
    const interactionEvents = ['mousedown', 'keydown', 'touchstart', 'scroll']

    function onInteraction() {
      state.isIdle = false
      if (state.interactionTimer) {
        clearTimeout(state.interactionTimer)
      }

      // 用户交互后 1 秒视为空闲
      state.interactionTimer = setTimeout(() => {
        state.isIdle = true
        log('页面进入空闲状态')
      }, 1000)
    }

    // 保存监听器引用并添加监听器
    interactionEvents.forEach((event) => {
      document.addEventListener(event, onInteraction, { passive: true })
      state.interactionListeners.push({ event, listener: onInteraction, target: document })
    })

    // 初始状态：空闲
    state.isIdle = true
  }

  /**
   * 销毁 LoadScheduler
   * 清理所有事件监听器、定时器和空闲回调
   */
  function destroy() {
    // 清理空闲回调
    if (state.idleCallbackId !== null) {
      if (typeof cancelIdleCallback !== 'undefined') {
        cancelIdleCallback(state.idleCallbackId)
      }
      state.idleCallbackId = null
    }

    // 清理交互定时器
    if (state.interactionTimer) {
      clearTimeout(state.interactionTimer)
      state.interactionTimer = null
    }

    // 清理事件监听器
    state.interactionListeners.forEach(({ event, listener, target }) => {
      target.removeEventListener(event, listener)
    })
    state.interactionListeners = []

    // 清理 MutationObserver
    if (state.observer) {
      state.observer.disconnect()
      state.observer = null
    }

    // 清空队列
    state.idleQueue = []
    state.executingIdle.clear()
    state.loaded.clear()

    log('LoadScheduler 已销毁')
  }

  // ========== 公共 API ==========

  /**
   * 注册关键模块（立即加载）
   * @param {string} name - 模块名称
   * @param {Function} callback - 加载回调
   */
  function registerCritical(name, callback) {
    if (state.loaded.has(name)) {
      log(`关键模块 "${name}" 已加载`)
      return
    }

    log(`注册关键模块: ${name}`)
    state.loaded.add(name)

    // 性能监控：记录模块加载耗时
    const startTime = performance.now()
    safeExecute(name, callback)
    const duration = performance.now() - startTime
    state.performanceMetrics.moduleLoadTimes[name] = duration

    if (CONFIG.debug) {
      log(`模块 "${name}" 加载耗时: ${duration.toFixed(2)}ms`)
    }
  }

  /**
   * 注册空闲模块（浏览器空闲时加载）
   * @param {string} name - 模块名称
   * @param {Function} callback - 加载回调
   * @param {object} options - 选项
   */
  function registerIdle(name, callback, options = {}) {
    if (state.loaded.has(name)) {
      log(`空闲模块 "${name}" 已加载`)
      return
    }

    const { priority = 0, dependencies = [], _retryCount = 0 } = options

    log(`注册空闲模块: ${name} (优先级: ${priority})`)

    // 检查依赖
    const missingDeps = dependencies.filter((dep) => !state.loaded.has(dep))
    if (missingDeps.length > 0) {
      if (_retryCount >= 30) {
        log(`模块 "${name}" 依赖始终未满足，放弃: ${missingDeps.join(', ')}`, 'error')
        return
      }
      log(`模块 "${name}" 等待依赖: ${missingDeps.join(', ')}`)
      // 延迟检查依赖
      setTimeout(
        () => registerIdle(name, callback, { ...options, _retryCount: _retryCount + 1 }),
        100
      )
      return
    }

    // 添加到空闲队列（按优先级排序）
    state.idleQueue.push({ name, callback, priority })
    state.idleQueue.sort((a, b) => b.priority - a.priority)

    state.loaded.add(name)
    state.performanceMetrics.idleTasks.total++

    // 启动调度器
    startIdleScheduler()
  }

  /**
   * 注册延迟模块（DOMContentLoaded 后加载）
   * @param {string} name - 模块名称
   * @param {Function} callback - 加载回调
   */
  function registerDeferred(name, callback) {
    if (state.loaded.has(name)) {
      log(`延迟模块 "${name}" 已加载`)
      return
    }

    log(`注册延迟模块: ${name}`)
    state.loaded.add(name)

    function loadWhenReady() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          safeExecute(name, callback)
        })
      } else {
        safeExecute(name, callback)
      }
    }

    loadWhenReady()
  }

  /**
   * 检查模块是否已加载
   * @param {string} name - 模块名称
   */
  function isLoaded(name) {
    return state.loaded.has(name)
  }

  /**
   * 获取队列状态
   */
  function getStats() {
    return {
      loaded: Array.from(state.loaded),
      idleQueueLength: state.idleQueue.length,
      executingIdle: Array.from(state.executingIdle),
      isIdle: state.isIdle,
    }
  }

  /**
   * 获取性能监控指标
   */
  function getPerformanceMetrics() {
    return {
      moduleLoadTimes: { ...state.performanceMetrics.moduleLoadTimes },
      idleTasks: { ...state.performanceMetrics.idleTasks },
      criticalPath: { ...state.performanceMetrics.criticalPath },
    }
  }

  /**
   * 设置调试模式
   * @param {boolean} enabled - 是否启用
   */
  function setDebug(enabled) {
    CONFIG.debug = enabled
    log(`调试模式 ${enabled ? '已启用' : '已禁用'}`)
  }

  // ========== 自动触发懒加载 ==========

  /**
   * 注入脚本到页面
   */
  function injectScript(url) {
    return new Promise((resolve) => {
      function inject() {
        if (!chrome?.runtime?.getURL) {
          log('非 Chrome 扩展环境，跳过脚本加载', 'warn')
          resolve()
          return
        }

        const script = document.createElement('script')
        script.src = chrome.runtime.getURL(url)
        script.onload = () => {
          log(`${url} 加载完成`)
          script.remove()
          resolve()
        }
        script.onerror = (e) => {
          log(`${url} 加载失败: ${e.message || e.type}`, 'error')
          script.remove()
          resolve()
        }
        ;(document.head || document.documentElement).appendChild(script)
      }

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inject, { once: true })
      } else {
        inject()
      }
    })
  }

  /**
   * 加载 core-t1a-bundle.js（资源拦截基础设施：CDN映射+DOM监听）
   * 在浏览器空闲时首先加载，体积小、初始化快
   */
  function loadCoreT1aBundle() {
    if (state.loaded.has('core-t1a-bundle')) {
      log('core-t1a-bundle 已加载')
      return Promise.resolve()
    }

    state.loaded.add('core-t1a-bundle')
    log('加载 core-t1a-bundle（资源拦截基础设施）')
    return injectScript('content/core-t1a-bundle.js')
  }

  /**
   * 加载 core-t1b-bundle.js（资源加速器主模块）
   * 在 core-t1a 完成后加载，包含资源加速器等重型模块
   */
  function loadCoreT1bBundle() {
    if (state.loaded.has('core-t1b-bundle')) {
      log('core-t1b-bundle 已加载')
      return Promise.resolve()
    }

    state.loaded.add('core-t1b-bundle')
    log('加载 core-t1b-bundle（资源加速器主模块）')
    return injectScript('content/core-t1b-bundle.js')
  }

  /**
   * 加载 core-t2-bundle.js（基础设施模块）
   * 在 core-t1b 加载完成后加载
   */
  function loadCoreT2Bundle() {
    if (state.loaded.has('core-t2-bundle')) {
      log('core-t2-bundle 已加载')
      return Promise.resolve()
    }

    state.loaded.add('core-t2-bundle')
    log('加载 core-t2-bundle（基础设施模块）')
    return injectScript('content/core-t2-bundle.js')
  }

  /**
   * 加载 core-t3-bundle.js（辅助功能模块）
   * 在 DOMContentLoaded 后加载
   */
  function loadCoreT3Bundle() {
    if (state.loaded.has('core-t3-bundle')) {
      log('core-t3-bundle 已加载')
      return Promise.resolve()
    }

    state.loaded.add('core-t3-bundle')
    log('加载 core-t3-bundle（辅助功能模块）')
    return injectScript('content/core-t3-bundle.js')
  }

  /**
   * 触发分层懒加载
   * 在浏览器空闲时按优先级加载各层 bundle
   * 由 critical.js 入口调用
   */
  function triggerLazyLoad() {
    if (state.loaded.has('core-t1a-bundle')) {
      log('分层 bundle 已在队列中')
      return
    }

    log('注册分层 bundle 懒加载任务')

    // Tier 1a: 立即加载（资源拦截基础设施，体积小、优先级最高）
    registerIdle('core-t1a-bundle', loadCoreT1aBundle, {
      priority: 20,
    })

    // Tier 1b: 空闲加载（资源加速器主模块，依赖 T1a）
    registerIdle('core-t1b-bundle', loadCoreT1bBundle, {
      priority: 19,
      dependencies: ['core-t1a-bundle'],
    })

    // Tier 2: 空闲加载（基础设施，依赖 T1b）
    registerIdle('core-t2-bundle', loadCoreT2Bundle, {
      priority: 10,
      dependencies: ['core-t1b-bundle'],
    })

    // Tier 3: 延迟加载（辅助功能，依赖 T2）
    registerIdle('core-t3-bundle', loadCoreT3Bundle, {
      priority: 5,
      dependencies: ['core-t2-bundle'],
    })
  }

  // ========== 初始化 ==========

  // 监听页面活动
  observePageActivity()

  // 导出
  window.LoadScheduler = {
    registerCritical,
    registerIdle,
    registerDeferred,
    triggerLazyLoad,
    loadCoreT1aBundle,
    loadCoreT1bBundle,
    loadCoreT2Bundle,
    loadCoreT3Bundle,
    isLoaded,
    getStats,
    getPerformanceMetrics,
    setDebug,
    destroy,
  }

  console.log('[LoadScheduler] 加载调度器已初始化')
})()
