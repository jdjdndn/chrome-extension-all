/**
 * ScriptLoader - 脚本依赖管理器
 * 参考 Tampermonkey 的依赖管理机制
 *
 * 功能：
 * 1. 依赖声明：脚本声明其依赖项
 * 2. 初始化队列：缓存未执行的初始化调用
 * 3. 事件驱动：依赖就绪时自动执行队列
 *
 * 使用方式：
 * // 在脚本头部声明依赖
 * ScriptLoader.declare({
 *   name: 'douyin-script',
 *   dependencies: ['EventBus', 'MessagingUtils', 'DOMUtils'],
 *   onReady: () => initDouyinScript()
 * });
 *
 * // 或者在代码中等待依赖
 * await ScriptLoader.waitFor(['EventBus', 'MessagingUtils']);
 */

;(function () {
  'use strict'

  // 防止重复加载
  if (window.ScriptLoader) {
    console.log('[ScriptLoader] 已加载，跳过')
    return
  }

  // ========== 内部状态 ==========
  const state = {
    // 已就绪的模块 { moduleName: true }
    readyModules: new Set(),
    // 等待中的脚本队列 { name, dependencies, callback, resolve }
    pendingScripts: [],
    // 已注册的脚本 { name: true }
    registeredScripts: new Set(),
    // 调试模式
    debugMode: false,
  }

  // ========== 核心方法 ==========

  /**
   * 声明脚本及其依赖
   * @param {Object} options - 配置选项
   * @param {string} options.name - 脚本名称（唯一标识）
   * @param {string[]} options.dependencies - 依赖模块列表
   * @param {Function} options.onReady - 依赖就绪后的回调
   * @param {boolean} options.autoInit - 是否自动初始化（默认 true）
   * @returns {Promise<boolean>} 是否立即执行
   */
  function declare(options) {
    const { name, dependencies = [], onReady, autoInit = true } = options

    // 检查是否已注册
    if (state.registeredScripts.has(name)) {
      log(`脚本 "${name}" 已注册，跳过`)
      return Promise.resolve(false)
    }

    state.registeredScripts.add(name)
    log(`声明脚本: ${name}, 依赖: [${dependencies.join(', ')}]`)

    // 检查依赖是否全部就绪
    const missingDeps = dependencies.filter((dep) => !isModuleReady(dep))

    if (missingDeps.length === 0) {
      // 所有依赖已就绪，立即执行
      log(`脚本 "${name}" 依赖已就绪，立即执行`)
      if (autoInit && onReady) {
        safeExecute(name, onReady)
      }
      return Promise.resolve(true)
    }

    // 依赖未就绪，加入等待队列
    log(`脚本 "${name}" 等待依赖: [${missingDeps.join(', ')}]`)

    return new Promise((resolve) => {
      state.pendingScripts.push({
        name,
        dependencies,
        missingDeps: new Set(missingDeps),
        callback: onReady,
        resolve,
        autoInit,
      })
    })
  }

  /**
   * 等待指定模块就绪
   * @param {string[]} modules - 模块名称列表
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>} 是否成功
   */
  function waitFor(modules, timeout = 10000) {
    return new Promise((resolve) => {
      const missingModules = modules.filter((m) => !isModuleReady(m))

      if (missingModules.length === 0) {
        resolve(true)
        return
      }

      const startTime = Date.now()
      const checkInterval = 50

      const check = () => {
        // 检查超时
        if (Date.now() - startTime > timeout) {
          log(`等待模块超时: [${missingModules.join(', ')}]`, 'warn')
          resolve(false)
          return
        }

        // 检查是否全部就绪
        const stillMissing = missingModules.filter((m) => !isModuleReady(m))

        if (stillMissing.length === 0) {
          resolve(true)
        } else {
          setTimeout(check, checkInterval)
        }
      }

      setTimeout(check, checkInterval)
    })
  }

  /**
   * 标记模块为就绪状态
   * @param {string} moduleName - 模块名称
   */
  function markReady(moduleName) {
    if (state.readyModules.has(moduleName)) {
      return
    }

    state.readyModules.add(moduleName)
    log(`模块就绪: ${moduleName}`)

    // 触发等待中的脚本检查
    processPendingScripts()
  }

  /**
   * 检查模块是否就绪
   * @param {string} moduleName - 模块名称
   * @returns {boolean}
   */
  function isModuleReady(moduleName) {
    // 先检查内部状态
    if (state.readyModules.has(moduleName)) {
      return true
    }

    // 特殊处理：检查全局对象是否存在
    const globalCheckers = {
      EventBus: () =>
        typeof window.EventBus !== 'undefined' && window.EventBus.getState?.()?.isReady,
      MessagingUtils: () => typeof window.MessagingUtils !== 'undefined',
      DOMUtils: () => typeof window.DOMUtils !== 'undefined',
      StorageUtils: () => typeof window.StorageUtils !== 'undefined',
      LazyLoader: () => typeof window.LazyLoader !== 'undefined',
      SiteBase: () => typeof window.SiteBase !== 'undefined',
      LazyInitManager: () => typeof window.LazyInitManager !== 'undefined',
    }

    const checker = globalCheckers[moduleName]
    if (checker && checker()) {
      // 自动标记为就绪
      state.readyModules.add(moduleName)
      return true
    }

    return false
  }

  /**
   * 处理等待中的脚本
   */
  function processPendingScripts() {
    if (state.pendingScripts.length === 0) {
      return
    }

    const toExecute = []
    const toRemove = []

    // 检查每个等待中的脚本
    for (const script of state.pendingScripts) {
      // 更新缺失依赖列表
      for (const dep of script.missingDeps) {
        if (isModuleReady(dep)) {
          script.missingDeps.delete(dep)
        }
      }

      // 检查是否所有依赖都已就绪
      if (script.missingDeps.size === 0) {
        toExecute.push(script)
        toRemove.push(script)
      }
    }

    // 从队列中移除
    for (const script of toRemove) {
      const index = state.pendingScripts.indexOf(script)
      if (index > -1) {
        state.pendingScripts.splice(index, 1)
      }
    }

    // 执行就绪的脚本
    for (const script of toExecute) {
      log(`脚本 "${script.name}" 依赖已就绪，开始执行`)
      if (script.autoInit && script.callback) {
        safeExecute(script.name, script.callback)
      }
      script.resolve(true)
    }
  }

  /**
   * 安全执行回调
   */
  function safeExecute(name, callback) {
    try {
      const result = callback()
      if (result instanceof Promise) {
        result.catch((err) => log(`脚本 "${name}" 执行错误: ${err.message}`, 'error'))
      }
    } catch (err) {
      log(`脚本 "${name}" 执行错误: ${err.message}`, 'error')
    }
  }

  /**
   * 日志输出
   */
  function log(message, level = 'info') {
    if (!state.debugMode && level !== 'error') return

    const prefix = '[ScriptLoader]'
    switch (level) {
      case 'error':
        console.error(prefix, message)
        break
      case 'warn':
        console.warn(prefix, message)
        break
      default:
        console.log(prefix, message)
    }
  }

  /**
   * 获取当前状态（调试用）
   */
  function getState() {
    return {
      readyModules: Array.from(state.readyModules),
      pendingScripts: state.pendingScripts.map((s) => ({
        name: s.name,
        missingDeps: Array.from(s.missingDeps),
      })),
      registeredScripts: Array.from(state.registeredScripts),
    }
  }

  /**
   * 启用调试模式
   */
  function enableDebug() {
    state.debugMode = true
    log('调试模式已启用')
  }

  // ========== 初始化队列系统 ==========

  /**
   * 创建初始化队列
   * 用于缓存依赖未就绪时的初始化调用
   *
   * @param {string} queueName - 队列名称
   * @returns {Object} 队列操作接口
   */
  function createInitQueue(queueName) {
    const queue = []
    let isProcessing = false

    return {
      /**
       * 添加初始化调用到队列
       * @param {Function} fn - 初始化函数
       * @param {string} description - 描述
       */
      enqueue(fn, description = '') {
        queue.push({ fn, description, timestamp: Date.now() })
        log(`队列 "${queueName}" 添加: ${description || '匿名函数'}`)
      },

      /**
       * 执行队列中的所有初始化调用
       */
      async process() {
        if (isProcessing || queue.length === 0) return

        isProcessing = true
        log(`队列 "${queueName}" 开始处理，共 ${queue.length} 项`)

        while (queue.length > 0) {
          const item = queue.shift()
          try {
            await item.fn()
            log(`队列 "${queueName}" 执行完成: ${item.description}`)
          } catch (err) {
            log(`队列 "${queueName}" 执行失败: ${item.description} - ${err.message}`, 'error')
          }
        }

        isProcessing = false
        log(`队列 "${queueName}" 处理完成`)
      },

      /**
       * 获取队列长度
       */
      get length() {
        return queue.length
      },

      /**
       * 清空队列
       */
      clear() {
        queue.length = 0
      },
    }
  }

  // ========== 导出接口 ==========
  window.ScriptLoader = {
    declare,
    waitFor,
    markReady,
    isModuleReady,
    getState,
    enableDebug,
    createInitQueue,
  }

  // 标记 ScriptLoader 自身为就绪
  state.readyModules.add('ScriptLoader')

  console.log('[ScriptLoader] 模块已加载')
})()
