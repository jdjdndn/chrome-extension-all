/**
 * 缓存管理插件
 * 提供统一的缓存管理接口
 */

import { Plugin } from './Plugin.js'

export class CachePlugin extends Plugin {
  static get meta() {
    return {
      name: 'CachePlugin',
      version: '1.0.0',
      description: '统一缓存管理和淘汰策略',
      author: 'ResourceAccelerator',
      dependencies: []
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      maxSize: 50 * 1024 * 1024, // 50MB
      evictionPolicy: 'weighted-lru', // weighted-lru | lru | lfu | fifo
      ttl: 30 * 60 * 1000, // 30分钟
      stats: {
        enabled: true,
        sampleRate: 0.1
      }
    }
  }

  async init() {
    this.caches = new Map()
    this.globalStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      writes: 0
    }

    this.log('info', 'init', {
      maxSize: this.options.maxSize,
      evictionPolicy: this.options.evictionPolicy
    })
  }

  async destroy() {
    this.caches.forEach(cache => cache.data.clear())
    this.caches.clear()
  }

  /**
   * 创建命名缓存
   */
  createCache(name, options = {}) {
    const config = {
      maxSize: options.maxSize || 1000,
      ttl: options.ttl || this.options.ttl,
      evictionPolicy: options.evictionPolicy || this.options.evictionPolicy
    }

    const cache = {
      data: new Map(),
      config,
      stats: {
        hits: 0,
        misses: 0,
        evictions: 0,
        writes: 0
      },
      currentSize: 0
    }

    this.caches.set(name, cache)

    return this._createCacheInterface(name, cache)
  }

  /**
   * 获取命名缓存
   */
  getCache(name) {
    const cache = this.caches.get(name)
    if (!cache) return null

    return this._createCacheInterface(name, cache)
  }

  /**
   * 创建缓存接口
   */
  _createCacheInterface(name, cache) {
    return {
      get: (key) => this._get(name, cache, key),
      set: (key, value, size) => this._set(name, cache, key, value, size),
      delete: (key) => this._delete(cache, key),
      clear: () => this._clear(cache),
      stats: () => this._getStats(cache)
    }
  }

  /**
   * 获取缓存值
   */
  _get(name, cache, key) {
    const entry = cache.data.get(key)

    if (!entry) {
      cache.stats.misses++
      this.globalStats.misses++
      return null
    }

    // 检查过期
    if (cache.config.ttl > 0 && Date.now() - entry.timestamp > cache.config.ttl) {
      cache.data.delete(key)
      cache.currentSize -= entry.size || 0
      cache.stats.misses++
      this.globalStats.misses++
      return null
    }

    // 更新访问统计
    entry.lastAccess = Date.now()
    entry.accessCount = (entry.accessCount || 1) + 1

    cache.stats.hits++
    this.globalStats.hits++

    return entry.value
  }

  /**
   * 设置缓存值
   */
  _set(name, cache, key, value, size = 0) {
    const entrySize = size || this._estimateSize(value)

    // 检查是否需要淘汰
    while (
      cache.currentSize + entrySize > cache.config.maxSize &&
      cache.data.size > 0
    ) {
      this._evict(cache)
    }

    // 添加或更新
    const existing = cache.data.get(key)
    if (existing) {
      cache.currentSize -= existing.size || 0
    }

    cache.data.set(key, {
      value,
      size: entrySize,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1
    })

    cache.currentSize += entrySize
    cache.stats.writes++
    this.globalStats.writes++
  }

  /**
   * 删除缓存值
   */
  _delete(cache, key) {
    const entry = cache.data.get(key)
    if (entry) {
      cache.currentSize -= entry.size || 0
      cache.data.delete(key)
      return true
    }
    return false
  }

  /**
   * 清空缓存
   */
  _clear(cache) {
    cache.data.clear()
    cache.currentSize = 0
  }

  /**
   * 执行淘汰
   */
  _evict(cache) {
    const policy = cache.config.evictionPolicy
    let evictKey = null

    switch (policy) {
      case 'weighted-lru':
        evictKey = this._weightedLRUEvict(cache)
        break
      case 'lru':
        evictKey = this._lruEvict(cache)
        break
      case 'lfu':
        evictKey = this._lfuEvict(cache)
        break
      case 'fifo':
        evictKey = this._fifoEvict(cache)
        break
      default:
        evictKey = this._lruEvict(cache)
    }

    if (evictKey) {
      const entry = cache.data.get(evictKey)
      cache.data.delete(evictKey)
      cache.currentSize -= entry?.size || 0
      cache.stats.evictions++
      this.globalStats.evictions++

      this.emit('cache:evicted', { key: evictKey, policy })
    }
  }

  /**
   * 加权LRU淘汰
   */
  _weightedLRUEvict(cache) {
    const now = Date.now()
    let minScore = Infinity
    let evictKey = null

    for (const [key, entry] of cache.data.entries()) {
      const accessCount = entry.accessCount || 1
      const age = now - (entry.lastAccess || entry.timestamp || now)
      const ageScore = Math.max(0, 1 - age / 3600000)
      const freqScore = Math.min(1, accessCount / 10)

      let score = freqScore * 0.6 + ageScore * 0.4

      // 大文件惩罚
      if (entry.size > 500000) {
        score -= 0.3
      }

      if (score < minScore) {
        minScore = score
        evictKey = key
      }
    }

    return evictKey
  }

  /**
   * LRU淘汰
   */
  _lruEvict(cache) {
    let oldest = null
    let evictKey = null

    for (const [key, entry] of cache.data.entries()) {
      if (!oldest || entry.lastAccess < oldest.lastAccess) {
        oldest = entry
        evictKey = key
      }
    }

    return evictKey
  }

  /**
   * LFU淘汰
   */
  _lfuEvict(cache) {
    let minCount = Infinity
    let evictKey = null

    for (const [key, entry] of cache.data.entries()) {
      const count = entry.accessCount || 1
      if (count < minCount) {
        minCount = count
        evictKey = key
      }
    }

    return evictKey
  }

  /**
   * FIFO淘汰
   */
  _fifoEvict(cache) {
    let oldest = null
    let evictKey = null

    for (const [key, entry] of cache.data.entries()) {
      if (!oldest || entry.timestamp < oldest.timestamp) {
        oldest = entry
        evictKey = key
      }
    }

    return evictKey
  }

  /**
   * 估算值大小
   */
  _estimateSize(value) {
    if (typeof value === 'string') {
      return value.length * 2
    }
    try {
      return JSON.stringify(value).length * 2
    } catch {
      return 1000
    }
  }

  /**
   * 获取统计信息
   */
  _getStats(cache) {
    const total = cache.stats.hits + cache.stats.misses
    return {
      ...cache.stats,
      size: cache.currentSize,
      entries: cache.data.size,
      hitRate: total > 0 ? cache.stats.hits / total : 0
    }
  }

  /**
   * 获取全局统计
   */
  getGlobalStats() {
    const total = this.globalStats.hits + this.globalStats.misses
    return {
      ...this.globalStats,
      caches: this.caches.size,
      hitRate: total > 0 ? this.globalStats.hits / total : 0
    }
  }
}
