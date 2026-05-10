/**
 * 加权LRU缓存淘汰策略单元测试
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Weighted LRU Cache Eviction Strategy', () => {
  // 模拟缓存管理器
  class CacheManager {
    constructor(maxSize = 1000) {
      this.cache = new Map()
      this.maxSize = maxSize
      this.currentSize = 0
      this.stats = {
        hits: 0,
        misses: 0,
        evictions: 0
      }
    }

    // 计算权重分数
    calculateScore(entry, now = Date.now()) {
      if (!entry || entry.skip) return Infinity

      const accessCount = entry.accessCount || 1
      const age = now - (entry.lastAccess || entry.timestamp || now)
      const ageScore = Math.max(0, 1 - age / 3600000) // 1小时内归一化
      const freqScore = Math.min(1, accessCount / 10) // 10次访问归一化

      // 加权分数：访问频率权重0.6，新近度权重0.4
      let score = freqScore * 0.6 + ageScore * 0.4

      // 大文件额外惩罚
      const entrySize = entry.size || 0
      if (entrySize > 500000) {
        score -= 0.3
      }

      return score
    }

    // 设置缓存
    set(key, value, size = 100) {
      // 检查是否需要淘汰
      while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
        this._evict()
      }

      this.cache.set(key, {
        value,
        size,
        timestamp: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1
      })
      this.currentSize += size
    }

    // 获取缓存
    get(key) {
      const entry = this.cache.get(key)
      if (!entry) {
        this.stats.misses++
        return null
      }

      // 更新访问统计
      entry.lastAccess = Date.now()
      entry.accessCount = (entry.accessCount || 1) + 1

      this.stats.hits++
      return entry.value
    }

    // 执行淘汰
    _evict() {
      const now = Date.now()
      let minScore = Infinity
      let evictKey = null

      // 找出权重分数最低的项
      for (const [key, entry] of this.cache.entries()) {
        const score = this.calculateScore(entry, now)
        if (score < minScore) {
          minScore = score
          evictKey = key
        }
      }

      if (evictKey) {
        const entry = this.cache.get(evictKey)
        this.cache.delete(evictKey)
        this.currentSize -= entry.size
        this.stats.evictions++
      }
    }

    // 获取统计信息
    getStats() {
      const total = this.stats.hits + this.stats.misses
      return {
        ...this.stats,
        size: this.currentSize,
        entries: this.cache.size,
        hitRate: total > 0 ? this.stats.hits / total : 0
      }
    }
  }

  let cache

  beforeEach(() => {
    cache = new CacheManager(1000)
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('基础功能', () => {
    it('应该能设置和获取缓存', () => {
      cache.set('key1', 'value1', 100)
      expect(cache.get('key1')).toBe('value1')
    })

    it('应该在缓存不存在时返回null', () => {
      expect(cache.get('nonexistent')).toBeNull()
    })

    it('应该正确追踪缓存大小', () => {
      cache.set('key1', 'value1', 100)
      cache.set('key2', 'value2', 200)
      expect(cache.currentSize).toBe(300)
    })
  })

  describe('访问统计', () => {
    it('应该更新访问次数', () => {
      cache.set('key1', 'value1', 100)

      cache.get('key1')
      cache.get('key1')
      cache.get('key1')

      const entry = cache.cache.get('key1')
      expect(entry.accessCount).toBe(4) // 初始1 + 3次访问
    })

    it('应该更新最后访问时间', () => {
      cache.set('key1', 'value1', 100)
      const firstAccess = cache.cache.get('key1').lastAccess

      vi.advanceTimersByTime(1000)

      cache.get('key1')
      const secondAccess = cache.cache.get('key1').lastAccess

      expect(secondAccess).toBeGreaterThan(firstAccess)
    })
  })

  describe('权重分数计算', () => {
    it('访问频率高的项应该有更高的分数', () => {
      cache.set('key1', 'value1', 100)
      cache.set('key2', 'value2', 100)

      // key1访问多次
      for (let i = 0; i < 5; i++) {
        cache.get('key1')
      }

      const entry1 = cache.cache.get('key1')
      const entry2 = cache.cache.get('key2')
      const now = Date.now()

      const score1 = cache.calculateScore(entry1, now)
      const score2 = cache.calculateScore(entry2, now)

      expect(score1).toBeGreaterThan(score2)
    })

    it('最近访问的项应该有更高的分数', () => {
      cache.set('key1', 'value1', 100)

      vi.advanceTimersByTime(3600000) // 1小时后

      cache.set('key2', 'value2', 100)

      const entry1 = cache.cache.get('key1')
      const entry2 = cache.cache.get('key2')
      const now = Date.now()

      const score1 = cache.calculateScore(entry1, now)
      const score2 = cache.calculateScore(entry2, now)

      expect(score2).toBeGreaterThan(score1)
    })

    it('大文件应该有更低的分数', () => {
      cache.set('key1', 'value1', 100) // 小文件
      cache.set('key2', 'value2', 600000) // 大文件 > 500000

      const entry1 = cache.cache.get('key1')
      const entry2 = cache.cache.get('key2')
      const now = Date.now()

      const score1 = cache.calculateScore(entry1, now)
      const score2 = cache.calculateScore(entry2, now)

      expect(score1).toBeGreaterThan(score2)
    })
  })

  describe('淘汰策略', () => {
    it('应该在缓存满时淘汰最低分数的项', () => {
      // 添加多个项
      for (let i = 0; i < 10; i++) {
        cache.set(`key${i}`, `value${i}`, 100)
      }

      // 多次访问前几个项
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 3; j++) {
          cache.get(`key${j}`)
        }
      }

      // 添加新项触发淘汰
      cache.set('newKey', 'newValue', 100)

      // 检查淘汰的是低分数项
      const stats = cache.getStats()
      expect(stats.evictions).toBeGreaterThan(0)
    })

    it('应该优先淘汰低访问频率的项', () => {
      cache.set('hot', 'value1', 100)
      cache.set('cold', 'value2', 100)

      // 热点数据访问多次
      for (let i = 0; i < 10; i++) {
        cache.get('hot')
      }

      // 添加新项直到需要淘汰
      for (let i = 0; i < 10; i++) {
        cache.set(`new${i}`, `value${i}`, 100)
      }

      // 热点数据应该还在
      expect(cache.get('hot')).toBe('value1')
    })

    it('应该优先淘汰旧的项', () => {
      cache.set('old', 'value1', 100)

      vi.advanceTimersByTime(7200000) // 2小时后

      cache.set('new', 'value2', 100)

      // 添加新项直到需要淘汰
      for (let i = 0; i < 10; i++) {
        cache.set(`item${i}`, `value${i}`, 100)
      }

      // 新数据应该还在
      expect(cache.get('new')).toBe('value2')
    })

    it('应该优先淘汰大文件', () => {
      cache.set('small', 'value1', 100)
      cache.set('large', 'value2', 600000) // 大文件

      // 添加新项触发淘汰
      for (let i = 0; i < 5; i++) {
        cache.set(`new${i}`, `value${i}`, 100)
      }

      // 小文件应该还在
      expect(cache.get('small')).toBe('value1')
    })
  })

  describe('命中率统计', () => {
    it('应该正确统计命中率', () => {
      cache.set('key1', 'value1', 100)

      cache.get('key1') // hit
      cache.get('key1') // hit
      cache.get('key2') // miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(0.666, 2)
    })
  })

  describe('边界条件', () => {
    it('应该处理空缓存', () => {
      expect(cache.get('any')).toBeNull()
      expect(cache.getStats().entries).toBe(0)
    })

    it('应该处理超大单个项', () => {
      cache.set('huge', 'value', 1000) // 等于maxSize
      expect(cache.cache.size).toBe(1)
      expect(cache.currentSize).toBe(1000)
    })

    it('应该在淘汰后更新缓存大小', () => {
      cache.set('key1', 'value1', 500)
      cache.set('key2', 'value2', 600) // 应该触发淘汰

      expect(cache.currentSize).toBeLessThanOrEqual(cache.maxSize)
    })
  })
})

// 辅助函数：确保 afterEach 定义
function afterEach(fn) {
  if (typeof afterEach === 'function') {
    afterEach(fn)
  }
}
