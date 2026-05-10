/**
 * 性能监控插件
 * 采集和报告性能指标
 */

import { Plugin } from './Plugin.js'

export class MonitorPlugin extends Plugin {
  static get meta() {
    return {
      name: 'MonitorPlugin',
      version: '1.0.0',
      description: '性能指标采集和报告',
      author: 'ResourceAccelerator',
      dependencies: []
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
        memory: true
      },
      sampleRate: 0.1, // 10%采样
      reportInterval: 60000 // 1分钟
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
      memory: null
    }

    this.observers = []

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

    // 定期报告
    if (this.options.reportInterval > 0) {
      this._startReporting()
    }

    this.log('info', 'init', {
      metrics: Object.keys(this.options.metrics).filter(k => this.options.metrics[k])
    })
  }

  async destroy() {
    this.observers.forEach(observer => observer.disconnect?.())
    this.observers = []

    if (this.reportTimer) {
      clearInterval(this.reportTimer)
    }
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
          url: lastEntry.url
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
          eventType: firstInput.name
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
          loadComplete: navigation.loadEventEnd
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
    if (!this.options.metrics.resourceTiming) return

    try {
      const resources = performance.getEntriesByType('resource')

      this.metrics.resourceTiming = resources.slice(-50).map(entry => ({
        name: entry.name,
        duration: entry.duration,
        size: entry.transferSize,
        type: entry.initiatorType
      }))

      this.emit('metric:resources', {
        count: resources.length,
        totalSize: resources.reduce((sum, r) => sum + (r.transferSize || 0), 0)
      })
    } catch (error) {
      this.log('warn', 'resource_timing_failed', { error: error.message })
    }
  }

  /**
   * 采集内存使用
   */
  _collectMemoryUsage() {
    if (!this.options.metrics.memory || !performance.memory) return

    this.metrics.memory = {
      usedJSHeapSize: performance.memory.usedJSHeapSize,
      totalJSHeapSize: performance.memory.totalJSHeapSize,
      jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
    }

    this.emit('metric:memory', this.metrics.memory)
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

      // 可以在这里发送到服务器
      // this._sendReport(report)
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
        fcp: this.metrics.fcp
      },
      memory: this.metrics.memory,
      resourceCount: this.metrics.resourceTiming.length
    }
  }

  /**
   * 获取Core Web Vitals评分
   */
  getWebVitalsScore() {
    return {
      lcp: this._scoreLCP(this.metrics.lcp),
      fid: this._scoreFID(this.metrics.fid),
      cls: this._scoreCLS(this.metrics.cls)
    }
  }

  _scoreLCP(value) {
    if (!value) return null
    if (value <= 2500) return 'good'
    if (value <= 4000) return 'needs-improvement'
    return 'poor'
  }

  _scoreFID(value) {
    if (!value) return null
    if (value <= 100) return 'good'
    if (value <= 300) return 'needs-improvement'
    return 'poor'
  }

  _scoreCLS(value) {
    if (value <= 0.1) return 'good'
    if (value <= 0.25) return 'needs-improvement'
    return 'poor'
  }
}
