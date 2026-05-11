/**
 * 性能监控插件
 * 采集和报告性能指标、内存监控、监听器泄漏检测
 */

import { Plugin } from './Plugin.js'
import { toastWarning } from '../../utils/toast.js'

export class MonitorPlugin extends Plugin {
  static get meta() {
    return {
      name: 'MonitorPlugin',
      version: '1.0.0',
      description: '性能指标采集、内存监控、监听器泄漏检测',
      author: 'ResourceAccelerator',
      dependencies: [],
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      metrics: {
        lcp: true,
        fid: true,
        cls: true,
        ttfb: true,
        fcp: true,
        resourceTiming: true,
        memory: true,
      },
      sampleRate: 0.1,
      reportInterval: 60000,
      memoryMonitor: {
        enabled: true,
        interval: 30000,
        warningThreshold: 100 * 1024 * 1024, // 100MB
        criticalThreshold: 200 * 1024 * 1024, // 200MB
      },
      listenerTracker: {
        enabled: true,
        checkInterval: 300000, // 5分钟
        leakThreshold: 30000, // 30秒
      },
    }
  }

  async init() {
    this.metrics = {
      lcp: null,
      fid: null,
      cls: 0,
      ttfb: null,
      fcp: null,
      resourceTiming: [],
      memory: null,
    }

    this.observers = []
    this.listenerRegistry = new Map() // 监听器注册表
    this.memoryTimer = null
    this.listenerCheckTimer = null

    // 初始化性能观察器
    if (this.options.metrics.lcp) {
      this._observeLCP()
    }

    if (this.options.metrics.fid) {
      this._observeFID()
    }

    if (this.options.metrics.cls) {
      this._observeCLS()
    }

    // 启动内存监控
    if (this.options.memoryMonitor?.enabled) {
      this._startMemoryMonitor()
    }

    // 启动监听器泄漏检测
    if (this.options.listenerTracker?.enabled) {
      this._startListenerTracking()
    }

    // 定期报告
    if (this.options.reportInterval > 0) {
      this._startReporting()
    }

    this.log('info', 'init', {
      metrics: Object.keys(this.options.metrics).filter((k) => this.options.metrics[k]),
      memoryMonitor: this.options.memoryMonitor?.enabled,
      listenerTracker: this.options.listenerTracker?.enabled,
    })
  }

  async destroy() {
    this.observers.forEach((observer) => observer.disconnect?.())
    this.observers = []

    if (this.reportTimer) {
      clearInterval(this.reportTimer)
    }

    if (this.memoryTimer) {
      clearInterval(this.memoryTimer)
    }

    if (this.listenerCheckTimer) {
      clearInterval(this.listenerCheckTimer)
    }

    this.listenerRegistry.clear()
  }

  /**
   * 观察LCP（Largest Contentful Paint）
   */
  _observeLCP() {
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const lastEntry = entries[entries.length - 1]

        this.metrics.lcp = lastEntry.startTime

        this.emit('metric:lcp', {
          value: lastEntry.startTime,
          element: lastEntry.element?.tagName,
          url: lastEntry.url,
        })
      })

      observer.observe({ type: 'largest-contentful-paint', buffered: true })
      this.observers.push(observer)
    } catch (error) {
      this.log('warn', 'lcp_observe_failed', { error: error.message })
    }
  }

  /**
   * 观察FID（First Input Delay）
   */
  _observeFID() {
    try {
      const observer = new PerformanceObserver((entryList) => {
        const entries = entryList.getEntries()
        const firstInput = entries[0]

        this.metrics.fid = firstInput.processingStart - firstInput.startTime

        this.emit('metric:fid', {
          value: this.metrics.fid,
          eventType: firstInput.name,
        })
      })

      observer.observe({ type: 'first-input', buffered: true })
      this.observers.push(observer)
    } catch (error) {
      this.log('warn', 'fid_observe_failed', { error: error.message })
    }
  }

  /**
   * 观察CLS（Cumulative Layout Shift）
   */
  _observeCLS() {
    try {
      let clsValue = 0

      const observer = new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
            this.metrics.cls = clsValue

            this.emit('metric:cls', { value: clsValue })
          }
        }
      })

      observer.observe({ type: 'layout-shift', buffered: true })
      this.observers.push(observer)
    } catch (error) {
      this.log('warn', 'cls_observe_failed', { error: error.message })
    }
  }

  /**
   * 采集TTFB和FCP
   */
  _collectNavigationTiming() {
    try {
      const navigation = performance.getEntriesByType('navigation')[0]

      if (navigation) {
        this.metrics.ttfb = navigation.responseStart - navigation.requestStart
        this.metrics.fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime

        this.emit('metric:navigation', {
          ttfb: this.metrics.ttfb,
          fcp: this.metrics.fcp,
          domContentLoaded: navigation.domContentLoadedEventEnd,
          loadComplete: navigation.loadEventEnd,
        })
      }
    } catch (error) {
      this.log('warn', 'navigation_timing_failed', { error: error.message })
    }
  }

  /**
   * 采集资源计时
   */
  _collectResourceTiming() {
    if (!this.options.metrics.resourceTiming) {
      return
    }

    try {
      const resources = performance.getEntriesByType('resource')

      this.metrics.resourceTiming = resources.slice(-50).map((entry) => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
        type: entry.initiatorType,
      }))

      this.emit('metric:resources', {
        count: resources.length,
        totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0),
      })
    } catch (error) {
      this.log('warn', 'resource_timing_failed', { error: error.message })
    }
  }

  /**
   * 采集内存使用
   */
  _collectMemoryUsage() {
    if (!this.options.metrics.memory || !performance.memory) {
      return
    }

    this.metrics.memory = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
    }

    this.emit('metric:memory', this.metrics.memory)
  }

  /**
   * 启动内存监控
   */
  _startMemoryMonitor() {
    const { interval = 30000, warningThreshold, criticalThreshold } = this.options.memoryMonitor

    this.memoryTimer = setInterval(() => {
      this._collectMemoryUsage()

      if (this.metrics.memory) {
        const usedHeap = this.metrics.memory.usedJSHeapSize

        // 检查阈值
        if (usedHeap > criticalThreshold) {
          this.log('error', 'memory_critical', {
            usedHeap: Math.round(usedHeap / 1024 / 1024) + 'MB',
          })
          this.emit('memory:critical', { usedHeap })
          toastWarning('内存占用过高，建议刷新页面', { duration: 0 })
        } else if (usedHeap > warningThreshold) {
          this.log('warn', 'memory_warning', {
            usedHeap: Math.round(usedHeap / 1024 / 1024) + 'MB',
          })
          this.emit('memory:warning', { usedHeap })

          // 触发强制清理
          this._forceCleanup()
        }
      }
    }, interval)
  }

  /**
   * 强制清理内存
   */
  _forceCleanup() {
    this.emit('memory:force_cleanup')

    this.log('info', 'force_cleanup_triggered')

    // 尝试触发GC（如果可用）
    if (typeof gc === 'function') {
      try {
        gc()
        this.log('info', 'gc_triggered')
      } catch (error) {
        // GC不可用，忽略
      }
    }
  }

  /**
   * 启动监听器泄漏检测
   */
  _startListenerTracking() {
    const { checkInterval = 300000, leakThreshold = 30000 } = this.options.listenerTracker

    this.listenerCheckTimer = setInterval(() => {
      this._checkListenerLeaks(leakThreshold)
    }, checkInterval)
  }

  /**
   * 注册监听器（供外部调用）
   */
  registerListener(target, type, handler, options = {}) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`

    this.listenerRegistry.set(id, {
      target,
      type,
      handler,
      timestamp: Date.now(),
      options,
    })

    // 返回注销函数
    return () => {
      this.listenerRegistry.delete(id)
    }
  }

  /**
   * 检查监听器泄漏
   */
  _checkListenerLeaks(leakThreshold) {
    const now = Date.now()
    const leaked = []

    for (const [id, entry] of this.listenerRegistry.entries()) {
      // 检查目标是否仍在DOM中
      const isConnected = entry.target?.isConnected ?? true

      if (!isConnected && now - entry.timestamp > leakThreshold) {
        leaked.push({ id, ...entry })

        // 自动移除泄漏的监听器
        try {
          entry.target.removeEventListener(entry.type, entry.handler, entry.options)
          this.listenerRegistry.delete(id)
        } catch (error) {
          // 忽略移除失败
        }
      }
    }

    if (leaked.length > 0) {
      this.log('warn', 'listener_leaks_detected', {
        count: leaked.length,
        types: [...new Set(leaked.map((l) => l.type))],
      })

      this.emit('listener:leaks', { count: leaked.length, leaked })
    }

    return leaked
  }

  /**
   * 获取监听器统计
   */
  getListenerStats() {
    const stats = {
      total: this.listenerRegistry.size,
      byType: {},
      potentialLeaks: 0,
    }

    const now = Date.now()
    const leakThreshold = this.options.listenerTracker?.leakThreshold || 30000

    for (const entry of this.listenerRegistry.values()) {
      stats.byType[entry.type] = (stats.byType[entry.type] || 0) + 1

      if (!entry.target?.isConnected && now - entry.timestamp > leakThreshold) {
        stats.potentialLeaks++
      }
    }

    return stats
  }

  /**
   * 开始定期报告
   */
  _startReporting() {
    // 初始采集
    this._collectNavigationTiming()
    this._collectResourceTiming()
    this._collectMemoryUsage()

    // 定期报告
    this.reportTimer = setInterval(() => {
      this._collectResourceTiming()
      this._collectMemoryUsage()

      const report = this.getReport()

      this.emit('metric:report', report)
    }, this.options.reportInterval)
  }

  /**
   * 获取性能报告
   */
  getReport() {
    return {
      timestamp: Date.now(),
      url: location.href,
      metrics: {
        lcp: this.metrics.lcp,
        fid: this.metrics.fid,
        cls: this.metrics.cls,
        ttfb: this.metrics.ttfb,
        fcp: this.metrics.fcp,
      },
      memory: this.metrics.memory,
      resourceCount: this.metrics.resourceTiming.length,
      listenerStats: this.getListenerStats(),
    }
  }

  /**
   * 获取Core Web Vitals评分
   */
  getWebVitalsScore() {
    return {
      lcp: this._scoreLCP(this.metrics.lcp),
      fid: this._scoreFID(this.metrics.fid),
      cls: this._scoreCLS(this.metrics.cls),
    }
  }

  _scoreLCP(value) {
    if (!value) {
      return null
    }
    if (value <= 2500) {
      return 'good'
    }
    if (value <= 4000) {
      return 'needs-improvement'
    }
    return 'poor'
  }

  _scoreFID(value) {
    if (!value) {
      return null
    }
    if (value <= 100) {
      return 'good'
    }
    if (value <= 300) {
      return 'needs-improvement'
    }
    return 'poor'
  }

  _scoreCLS(value) {
    if (value <= 0.1) {
      return 'good'
    }
    if (value <= 0.25) {
      return 'needs-improvement'
    }
    return 'poor'
  }
}
