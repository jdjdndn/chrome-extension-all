/**
 * 统一 DOM 监听器
 * 单例模式，统一管理所有 MutationObserver 回调
 * 解决多个模块独立监听导致的性能问题
 */

(function () {
  'use strict'

  if (window.UnifiedDOMWatcher) {
    console.log('[UnifiedDOMWatcher] 已存在，跳过初始化')
    return
  }

  const LOG_PREFIX = '[UnifiedDOMWatcher]'

  /**
   * 优先级枚举
   * CRITICAL: 立即执行，不延迟（预加载等关键操作）
   * HIGH: 高优先级，使用 requestAnimationFrame
   * NORMAL: 普通优先级，使用 requestIdleCallback
   * LOW: 低优先级，延迟执行
   */
  const Priority = {
    CRITICAL: 'critical', // 立即执行，影响 LCP
    HIGH: 'high', // RAF 执行
    NORMAL: 'normal', // requestIdleCallback
    LOW: 'low', // 延迟执行
  }

  class UnifiedDOMWatcherImpl {
    constructor() {
      // 单例标志
      this._initialized = false

      // MutationObserver 实例
      this._observer = null

      // 订阅者映射 { callback -> subscriberInfo }
      this._subscribers = new Map()

      // 批量处理队列
      this._pendingMutations = []
      this._rafId = null
      this._ricId = null
      this._isProcessing = false

      // 防抖配置
      this._debounceDelay = 16 // 约 60fps

      // 暂停标志
      this._paused = false

      // 统计数据
      this.stats = {
        totalMutations: 0,
        processedBatches: 0,
        subscriberCount: 0,
        memoryUsage: {
          lastCheckTime: 0,
          peakMutations: 0,
        },
      }
    }

    /**
     * 初始化监听器
     */
    _init() {
      if (this._initialized) {return}

      // document_start 阶段 document.documentElement 可能为 null
      // 等待 DOM 可用后再初始化
      const target = document.documentElement || document.body
      if (!target) {
        // DOM 还未准备好，使用 document 监听到有元素后重试
        const docObserver = new MutationObserver(() => {
          const newTarget = document.documentElement || document.body
          if (newTarget) {
            docObserver.disconnect()
            this._init()
          }
        })
        docObserver.observe(document, { childList: true, subtree: true })
        return
      }

      this._observer = new MutationObserver((mutations) => {
        this._handleMutations(mutations)
      })

      // 监听 document.documentElement，与原有模块一致
      this._observer.observe(target, {
        childList: true,
        subtree: true,
      })

      this._initialized = true
      console.log(`${LOG_PREFIX} 初始化完成`)
    }

    /**
     * 订阅 DOM 变化
     * @param {Function} callback - 回调函数 (mutations) => void
     * @param {Object} options - 配置选项
     * @param {string} options.priority - 优先级 (critical/high/normal/low)
     * @param {string} options.name - 订阅者名称（用于调试）
     * @param {Function} options.filter - 过滤函数 (mutation) => boolean
     * @returns {Function} 取消订阅函数
     */
    subscribe(callback, options = {}) {
      if (typeof callback !== 'function') {
        console.error(`${LOG_PREFIX} subscribe 需要函数参数`)
        return () => {}
      }

      // 自动初始化
      if (!this._initialized) {
        this._init()
      }

      const priority = options.priority || Priority.NORMAL
      const name = options.name || callback.name || 'anonymous'
      const filter = options.filter || null

      const subscriberInfo = {
        callback,
        priority,
        name,
        filter,
        callCount: 0,
        lastAccessTime: Date.now(),
      }

      this._subscribers.set(callback, subscriberInfo)
      this.stats.subscriberCount = this._subscribers.size

      console.log(`${LOG_PREFIX} 订阅者注册: ${name} (优先级: ${priority})`)

      // 返回取消订阅函数
      return () => this.unsubscribe(callback)
    }

    /**
     * 取消订阅
     * @param {Function} callback - 原回调函数
     */
    unsubscribe(callback) {
      const info = this._subscribers.get(callback)
      if (info) {
        console.log(`${LOG_PREFIX} 订阅者取消: ${info.name}`)
        this._subscribers.delete(callback)
        this.stats.subscriberCount = this._subscribers.size
      }
    }

    /**
     * 处理 MutationObserver 回调
     */
    _handleMutations(mutations) {
      this.stats.totalMutations += mutations.length

      // 暂停状态不处理
      if (this._paused) {return}

      // 收集所有变更
      this._pendingMutations.push(...mutations)

      // 按优先级分发
      this._dispatchByPriority(mutations)
    }

    /**
     * 按优先级分发变更
     */
    _dispatchByPriority(mutations) {
      // 分组：优先级 -> 订阅者列表
      const criticalSubscribers = []
      const highSubscribers = []
      const normalSubscribers = []
      const lowSubscribers = []

      for (const [callback, info] of this._subscribers) {
        switch (info.priority) {
          case Priority.CRITICAL:
            criticalSubscribers.push(info)
            break
          case Priority.HIGH:
            highSubscribers.push(info)
            break
          case Priority.LOW:
            lowSubscribers.push(info)
            break
          default:
            normalSubscribers.push(info)
        }
      }

      // 1. CRITICAL: 立即执行（不影响 LCP）
      if (criticalSubscribers.length > 0) {
        this._executeSubscribers(criticalSubscribers, mutations)
      }

      // 2. HIGH: requestAnimationFrame
      if (highSubscribers.length > 0) {
        if (this._rafId) {
          cancelAnimationFrame(this._rafId)
        }
        this._rafId = requestAnimationFrame(() => {
          this._executeSubscribers(highSubscribers, mutations)
          this._rafId = null
        })
      }

      // 3. NORMAL: requestIdleCallback
      if (normalSubscribers.length > 0) {
        this._scheduleIdle(normalSubscribers, mutations)
      }

      // 4. LOW: 延迟执行
      if (lowSubscribers.length > 0) {
        setTimeout(() => {
          this._executeSubscribers(lowSubscribers, mutations)
        }, 100)
      }
    }

    /**
     * 使用 requestIdleCallback 调度
     */
    _scheduleIdle(subscribers, mutations) {
      const execute = (deadline) => {
        // 如果时间不够，分批处理
        const remaining = deadline.timeRemaining()
        if (remaining < 5) {
          // 时间不足，继续调度
          this._ricId = requestIdleCallback(execute)
          return
        }

        this._executeSubscribers(subscribers, mutations)
        this._ricId = null
      }

      // 清除之前的调度
      if (this._ricId) {
        cancelIdleCallback(this._ricId)
      }

      this._ricId = requestIdleCallback(execute)
    }

    /**
     * 执行订阅者回调
     */
    _executeSubscribers(subscribers, mutations) {
      const now = Date.now()
      for (const info of subscribers) {
        try {
          // 应用过滤器
          let filteredMutations = mutations
          if (info.filter) {
            filteredMutations = mutations.filter(info.filter)
            if (filteredMutations.length === 0) {continue}
          }

          info.callback(filteredMutations)
          info.callCount++
          info.lastAccessTime = now
        } catch (error) {
          console.error(`${LOG_PREFIX} 订阅者 [${info.name}] 执行错误:`, error)
        }
      }

      this.stats.processedBatches++

      // 更新内存使用统计
      if (this._pendingMutations.length > this.stats.memoryUsage.peakMutations) {
        this.stats.memoryUsage.peakMutations = this._pendingMutations.length
      }
      this.stats.memoryUsage.lastCheckTime = now
    }

    /**
     * 暂停监听
     */
    pause() {
      this._paused = true
      console.log(`${LOG_PREFIX} 已暂停`)
    }

    /**
     * 恢复监听
     */
    resume() {
      this._paused = false
      console.log(`${LOG_PREFIX} 已恢复`)
    }

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        ...this.stats,
        subscribers: Array.from(this._subscribers.values()).map((info) => ({
          name: info.name,
          priority: info.priority,
          callCount: info.callCount,
          lastAccessTime: info.lastAccessTime,
        })),
      }
    }

    /**
     * 销毁实例
     */
    destroy() {
      // 停止 MutationObserver
      if (this._observer) {
        this._observer.disconnect()
        this._observer = null
      }

      // 取消所有调度
      if (this._rafId) {
        cancelAnimationFrame(this._rafId)
        this._rafId = null
      }
      if (this._ricId) {
        cancelIdleCallback(this._ricId)
        this._ricId = null
      }

      // 清理状态
      this._subscribers.clear()
      this._pendingMutations = []
      this._initialized = false
      this._paused = false

      console.log(`${LOG_PREFIX} 已销毁`)
    }
  }

  // 创建单例
  const instance = new UnifiedDOMWatcherImpl()

  // 导出 API
  window.UnifiedDOMWatcher = {
    subscribe: (callback, options) => instance.subscribe(callback, options),
    unsubscribe: (callback) => instance.unsubscribe(callback),
    pause: () => instance.pause(),
    resume: () => instance.resume(),
    destroy: () => instance.destroy(),
    getStats: () => instance.getStats(),
    Priority,
  }

  console.log(`${LOG_PREFIX} 统一 DOM 监听器已加载`)
})()
