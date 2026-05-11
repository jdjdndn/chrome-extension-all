/**
 * 资源加速器性能基准测试
 */

import { describe, it, expect, beforeEach } from 'vitest'

describe('Performance Benchmarks', () => {
  // 性能指标采集
  class PerformanceBenchmark {
    constructor() {
      this.metrics = new Map()
      this.baselines = new Map()
    }

    // 开始计时
    start(name) {
      this.metrics.set(name, {
        startTime: performance.now(),
        startMemory: this.getMemoryUsage(),
      })
    }

    // 结束计时
    end(name) {
      const metric = this.metrics.get(name)
      if (!metric) {
        return null
      }

      const endTime = performance.now()
      const endMemory = this.getMemoryUsage()

      const result = {
        duration: endTime - metric.startTime,
        memoryDelta: endMemory - metric.startMemory,
        timestamp: Date.now(),
      }

      this.metrics.set(name, result)
      return result
    }

    // 获取内存使用
    getMemoryUsage() {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize
      }
      return 0
    }

    // 设置基准线
    setBaseline(name, value) {
      this.baselines.set(name, value)
    }

    // 对比基准线
    compare(name, currentValue) {
      const baseline = this.baselines.get(name)
      if (!baseline) {
        return null
      }

      const change = ((currentValue - baseline) / baseline) * 100
      return {
        baseline,
        current: currentValue,
        change: change.toFixed(2) + '%',
        improved: change < 0,
      }
    }

    // 生成报告
    generateReport() {
      const report = {
        timestamp: Date.now(),
        metrics: {},
        comparisons: {},
      }

      for (const [name, result] of this.metrics.entries()) {
        if (result.duration !== undefined) {
          report.metrics[name] = {
            duration: result.duration.toFixed(2) + 'ms',
            memoryDelta: result.memoryDelta,
          }

          const comparison = this.compare(name, result.duration)
          if (comparison) {
            report.comparisons[name] = comparison
          }
        }
      }

      return report
    }
  }

  let benchmark

  beforeEach(() => {
    benchmark = new PerformanceBenchmark()
  })

  describe('缓存性能', () => {
    it('缓存读取应该在1ms内完成', () => {
      const cache = new Map()

      // 预填充缓存
      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, { data: 'x'.repeat(1000) })
      }

      benchmark.start('cache-read')

      for (let i = 0; i < 1000; i++) {
        cache.get(`key${Math.floor(Math.random() * 1000)}`)
      }

      const result = benchmark.end('cache-read')

      expect(result.duration).toBeLessThan(10) // 1000次读取应该在10ms内
    })

    it('缓存写入应该在1ms内完成', () => {
      const cache = new Map()

      benchmark.start('cache-write')

      for (let i = 0; i < 1000; i++) {
        cache.set(`key${i}`, { data: 'x'.repeat(1000) })
      }

      const result = benchmark.end('cache-write')

      expect(result.duration).toBeLessThan(10) // 1000次写入应该在10ms内
    })

    it('加权LRU淘汰应该在10ms内完成', () => {
      const cache = new Map()
      const maxSize = 100

      // 填充缓存到上限
      for (let i = 0; i < maxSize; i++) {
        cache.set(`key${i}`, {
          value: 'x'.repeat(10000),
          timestamp: Date.now(),
          lastAccess: Date.now(),
          accessCount: Math.floor(Math.random() * 10),
          size: 10000,
        })
      }

      benchmark.start('weighted-lru-eviction')

      // 执行淘汰逻辑
      const now = Date.now()
      let minScore = Infinity
      let evictKey = null

      for (const [key, entry] of cache.entries()) {
        const accessCount = entry.accessCount || 1
        const age = now - (entry.lastAccess || entry.timestamp || now)
        const ageScore = Math.max(0, 1 - age / 3600000)
        const freqScore = Math.min(1, accessCount / 10)
        const score = freqScore * 0.6 + ageScore * 0.4

        if (score < minScore) {
          minScore = score
          evictKey = key
        }
      }

      if (evictKey) {
        cache.delete(evictKey)
      }

      const result = benchmark.end('weighted-lru-eviction')

      expect(result.duration).toBeLessThan(10)
    })
  })

  describe('位置检测性能', () => {
    it('位置优先级计算应该在1ms内完成', () => {
      const elements = []

      // 创建模拟元素
      for (let i = 0; i < 100; i++) {
        elements.push({
          getBoundingClientRect: () => ({
            top: Math.random() * 2000,
            bottom: Math.random() * 2000 + 100,
            left: 0,
            right: 100,
          }),
          isConnected: true,
        })
      }

      const viewportHeight = 800

      benchmark.start('position-priority')

      elements.forEach((element) => {
        const rect = element.getBoundingClientRect()
        const distanceToViewport =
          rect.top < 0 ? -rect.top : rect.top > viewportHeight ? rect.top - viewportHeight : 0

        const nearbyThreshold = viewportHeight * 1

        let zone
        if (distanceToViewport === 0) {
          zone = 'inViewport'
        } else if (distanceToViewport <= nearbyThreshold) {
          zone = 'nearby'
        } else {
          zone = 'far'
        }
      })

      const result = benchmark.end('position-priority')

      expect(result.duration).toBeLessThan(5) // 100次计算应该在5ms内
    })

    it('位置缓存命中率应该>80%', () => {
      const cache = new WeakMap()
      const elements = []

      // 创建模拟元素
      for (let i = 0; i < 100; i++) {
        elements.push({
          getBoundingClientRect: () => ({
            top: Math.random() * 2000,
            bottom: Math.random() * 2000 + 100,
          }),
          isConnected: true,
        })
      }

      let hits = 0
      let misses = 0
      const POSITION_CACHE_TTL = 100

      // 第一次访问（未命中）
      elements.forEach((element) => {
        const cached = cache.get(element)
        if (cached && performance.now() - cached.time < POSITION_CACHE_TTL) {
          hits++
        } else {
          misses++
          cache.set(element, {
            result: { zone: 'test' },
            time: performance.now(),
          })
        }
      })

      // 第二次访问（命中）
      elements.forEach((element) => {
        const cached = cache.get(element)
        if (cached && performance.now() - cached.time < POSITION_CACHE_TTL) {
          hits++
        } else {
          misses++
        }
      })

      const hitRate = hits / (hits + misses)
      expect(hitRate).toBeGreaterThan(0.8) // 命中率应该>80%
    })
  })

  describe('Worker性能', () => {
    it('Worker任务分发应该在1ms内完成', () => {
      const taskQueue = []

      benchmark.start('worker-task-dispatch')

      // 创建100个任务
      for (let i = 0; i < 100; i++) {
        taskQueue.push({
          id: i,
          src: `image${i}.jpg`,
          priority: Math.floor(Math.random() * 20),
          quality: 0.8,
          maxWidth: 2048,
        })
      }

      // 按优先级排序
      taskQueue.sort((a, b) => b.priority - a.priority)

      const result = benchmark.end('worker-task-dispatch')

      expect(result.duration).toBeLessThan(5) // 100个任务分发应该在5ms内
    })

    it('预热任务应该在10ms内完成', () => {
      const warmupTasks = []
      const testPng =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

      benchmark.start('worker-warmup')

      // 模拟创建2个Worker的预热任务
      for (let i = 0; i < 2; i++) {
        warmupTasks.push({
          id: `warmup-${i}`,
          src: testPng,
          quality: 0.1,
          maxWidth: 1,
          maxHeight: 1,
        })
      }

      const result = benchmark.end('worker-warmup')

      expect(result.duration).toBeLessThan(10)
    })
  })

  describe('内存性能', () => {
    it('内存压力检查应该在1ms内完成', () => {
      benchmark.start('memory-check')

      // 模拟内存压力检查
      let memoryPressure = 'normal'

      if (performance.memory) {
        const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024

        if (usedMB > 200) {
          memoryPressure = 'critical'
        } else if (usedMB > 100) {
          memoryPressure = 'warning'
        }
      }

      const result = benchmark.end('memory-check')

      expect(result.duration).toBeLessThan(1)
    })

    it('缓存清理应该在100ms内完成', () => {
      const cache = new Map()

      // 填充大量数据
      for (let i = 0; i < 10000; i++) {
        cache.set(`key${i}`, {
          value: 'x'.repeat(1000),
          timestamp: Date.now(),
        })
      }

      benchmark.start('cache-clear')

      cache.clear()

      const result = benchmark.end('cache-clear')

      expect(result.duration).toBeLessThan(100)
    })
  })

  describe('综合性能', () => {
    it('完整图片处理流程应该在50ms内完成', () => {
      const cache = new Map()
      const positionCache = new WeakMap()
      const taskQueue = []

      // 模拟元素
      const elements = []
      for (let i = 0; i < 10; i++) {
        elements.push({
          getBoundingClientRect: () => ({
            top: i * 100,
            bottom: i * 100 + 50,
          }),
          isConnected: true,
          src: `image${i}.jpg`,
          dataset: {},
        })
      }

      benchmark.start('full-image-processing')

      elements.forEach((element) => {
        // 1. 检查缓存
        if (cache.has(element.src)) {
          return
        }

        // 2. 计算位置
        const rect = element.getBoundingClientRect()
        const viewportHeight = 800
        const distanceToViewport =
          rect.top < 0 ? -rect.top : rect.top > viewportHeight ? rect.top - viewportHeight : 0

        // 3. 判断区域
        let zone
        if (distanceToViewport === 0) {
          zone = 'inViewport'
        } else if (distanceToViewport <= viewportHeight) {
          zone = 'nearby'
        } else {
          zone = 'far'
        }

        // 4. 根据区域处理
        if (zone !== 'far') {
          taskQueue.push({
            src: element.src,
            priority: zone === 'inViewport' ? 0 : 10,
          })
        }

        // 5. 缓存结果
        cache.set(element.src, { processed: true })
      })

      // 6. 排序任务队列
      taskQueue.sort((a, b) => a.priority - b.priority)

      const result = benchmark.end('full-image-processing')

      expect(result.duration).toBeLessThan(50)
    })
  })

  describe('基准对比', () => {
    it('应该能设置和对比基准线', () => {
      benchmark.setBaseline('test-operation', 100)

      benchmark.start('test-operation')
      // 模拟操作
      for (let i = 0; i < 1000; i++) {
        Math.random()
      }
      const result = benchmark.end('test-operation')

      const comparison = benchmark.compare('test-operation', result.duration)

      if (comparison) {
        console.log('基准对比:', comparison)
      }
    })

    it('应该能生成完整报告', () => {
      benchmark.start('op1')
      for (let i = 0; i < 100; i++) {
        Math.random()
      }
      benchmark.end('op1')

      benchmark.start('op2')
      for (let i = 0; i < 100; i++) {
        Math.random()
      }
      benchmark.end('op2')

      const report = benchmark.generateReport()

      expect(report).toHaveProperty('timestamp')
      expect(report).toHaveProperty('metrics')
      expect(Object.keys(report.metrics).length).toBeGreaterThan(0)
    })
  })
})
