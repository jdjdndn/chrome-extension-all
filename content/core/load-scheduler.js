/**
 * LoadScheduler - 脚本加载调度器
 * 优化加载时机：
 * 1. 关键模块（资源加速器及其依赖）立即加载
 * 2. 非关键模块在浏览器空闲时加载
 */

(function () {
  'use strict';

  if (window.LoadScheduler) {
    console.log('[LoadScheduler] 已存在，跳过初始化');
    return;
  }

  // ========== 配置 ==========
  const CONFIG = {
    // 空闲任务超时时间（ms）
    idleTimeout: 2000,
    // 最大并发空闲任务数
    maxConcurrentIdle: 3,
    // 调试模式
    debug: false
  };

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
    observer: null
  };

  // ========== 工具函数 ==========

  /**
   * 安全执行回调
   */
  function safeExecute(name, callback) {
    try {
      const result = callback();
      if (result instanceof Promise) {
        result.catch(err => log(`"${name}" 执行错误: ${err.message}`, 'error'));
      }
    } catch (err) {
      log(`"${name}" 执行错误: ${err.message}`, 'error');
    }
  }

  /**
   * 日志输出
   */
  function log(message, level = 'info') {
    if (!CONFIG.debug && level !== 'error') return;

    const prefix = '[LoadScheduler]';
    switch (level) {
      case 'error':
        console.error(prefix, message);
        break;
      case 'warn':
        console.warn(prefix, message);
        break;
      default:
        if (CONFIG.debug) console.log(prefix, message);
    }
  }

  // ========== 空闲检测 ==========

  /**
   * 请求空闲回调（兼容性封装）
   */
  function requestIdle(callback, options = {}) {
    // 优先使用 scheduler.postTask（Chrome 94+）
    if (typeof scheduler !== 'undefined' && scheduler.postTask) {
      return scheduler.postTask(callback, {
        priority: 'user-visible',
        delay: options.timeout || CONFIG.idleTimeout
      }).then(() => {
        callback({ didTimeout: false, timeRemaining: () => 50 });
      }).catch(() => {
        // 降级到 requestIdleCallback
        _fallbackRequestIdle(callback, options);
      });
    }

    // 降级到 requestIdleCallback
    return _fallbackRequestIdle(callback, options);
  }

  /**
   * requestIdleCallback 降级方案
   */
  function _fallbackRequestIdle(callback, options) {
    if (typeof requestIdleCallback !== 'undefined') {
      return requestIdleCallback(callback, {
        timeout: options.timeout || CONFIG.idleTimeout
      });
    }

    // 最终降级：setTimeout
    return setTimeout(() => {
      callback({ didTimeout: false, timeRemaining: () => 50 });
    }, options.timeout || CONFIG.idleTimeout);
  }

  /**
   * 启动空闲任务调度
   */
  function startIdleScheduler() {
    if (state.idleCallbackId !== null) return;

    function scheduleIdle(deadline) {
      // 检查是否有空闲时间
      const hasTime = deadline && typeof deadline.timeRemaining === 'function'
        ? deadline.timeRemaining() > 10
        : true;

      if (hasTime && state.idleQueue.length > 0) {
        // 执行空闲任务
        const task = state.idleQueue.shift();
        state.executingIdle.add(task.name);

        log(`执行空闲任务: ${task.name}`);
        safeExecute(task.name, task.callback);

        state.executingIdle.delete(task.name);
      }

      // 继续调度
      if (state.idleQueue.length > 0) {
        state.idleCallbackId = requestIdle(scheduleIdle, {
          timeout: CONFIG.idleTimeout
        });
      } else {
        state.idleCallbackId = null;
        log('空闲任务队列已清空');
      }
    }

    // 开始调度
    state.idleCallbackId = requestIdle(scheduleIdle, {
      timeout: CONFIG.idleTimeout
    });

    log('空闲调度器已启动');
  }

  /**
   * 监听页面活动状态
   */
  function observePageActivity() {
    // 监听用户交互事件
    const interactionEvents = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    let interactionTimer = null;

    function onInteraction() {
      state.isIdle = false;
      if (interactionTimer) clearTimeout(interactionTimer);

      // 用户交互后 1 秒视为空闲
      interactionTimer = setTimeout(() => {
        state.isIdle = true;
        log('页面进入空闲状态');
      }, 1000);
    }

    interactionEvents.forEach(event => {
      document.addEventListener(event, onInteraction, { passive: true });
    });

    // 初始状态：空闲
    state.isIdle = true;
  }

  // ========== 公共 API ==========

  /**
   * 注册关键模块（立即加载）
   * @param {string} name - 模块名称
   * @param {Function} callback - 加载回调
   */
  function registerCritical(name, callback) {
    if (state.loaded.has(name)) {
      log(`关键模块 "${name}" 已加载`);
      return;
    }

    log(`注册关键模块: ${name}`);
    state.loaded.add(name);
    safeExecute(name, callback);
  }

  /**
   * 注册空闲模块（浏览器空闲时加载）
   * @param {string} name - 模块名称
   * @param {Function} callback - 加载回调
   * @param {object} options - 选项
   */
  function registerIdle(name, callback, options = {}) {
    if (state.loaded.has(name)) {
      log(`空闲模块 "${name}" 已加载`);
      return;
    }

    const { priority = 0, dependencies = [] } = options;

    log(`注册空闲模块: ${name} (优先级: ${priority})`);

    // 检查依赖
    const missingDeps = dependencies.filter(dep => !state.loaded.has(dep));
    if (missingDeps.length > 0) {
      log(`模块 "${name}" 等待依赖: ${missingDeps.join(', ')}`);
      // 延迟检查依赖
      setTimeout(() => registerIdle(name, callback, options), 100);
      return;
    }

    // 添加到空闲队列（按优先级排序）
    state.idleQueue.push({ name, callback, priority });
    state.idleQueue.sort((a, b) => b.priority - a.priority);

    state.loaded.add(name);

    // 启动调度器
    startIdleScheduler();
  }

  /**
   * 注册延迟模块（DOMContentLoaded 后加载）
   * @param {string} name - 模块名称
   * @param {Function} callback - 加载回调
   */
  function registerDeferred(name, callback) {
    if (state.loaded.has(name)) {
      log(`延迟模块 "${name}" 已加载`);
      return;
    }

    log(`注册延迟模块: ${name}`);
    state.loaded.add(name);

    function loadWhenReady() {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          safeExecute(name, callback);
        });
      } else {
        safeExecute(name, callback);
      }
    }

    loadWhenReady();
  }

  /**
   * 检查模块是否已加载
   * @param {string} name - 模块名称
   */
  function isLoaded(name) {
    return state.loaded.has(name);
  }

  /**
   * 获取队列状态
   */
  function getStats() {
    return {
      loaded: Array.from(state.loaded),
      idleQueueLength: state.idleQueue.length,
      executingIdle: Array.from(state.executingIdle),
      isIdle: state.isIdle
    };
  }

  /**
   * 设置调试模式
   * @param {boolean} enabled - 是否启用
   */
  function setDebug(enabled) {
    CONFIG.debug = enabled;
    log(`调试模式 ${enabled ? '已启用' : '已禁用'}`);
  }

  // ========== 初始化 ==========

  // 监听页面活动
  observePageActivity();

  // 导出
  window.LoadScheduler = {
    registerCritical,
    registerIdle,
    registerDeferred,
    isLoaded,
    getStats,
    setDebug
  };

  console.log('[LoadScheduler] 加载调度器已初始化');
})();
