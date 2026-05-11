/**
 * 缓存管理插件
 * 提供统一的缓存管理接口、LRU淘汰、热点标记
 */

import { Plugin } from './Plugin.js'

export class CachePlugin extends Plugin {
  static get meta() {
    return {
      name: 'CachePlugin',
      version: '1.0.0',
      description: '统一缓存管理和淘汰策略',
      author: 'ResourceAccelerator',
      dependencies: [],
    }
  }

  static get defaultConfig() {
    return {
      enabled: true,
      maxSize: 50 * 1024 * 1024, // 50MB
      maxEntries: 500,
      evictionPolicy: 'weighted-lru',
      ttl: 30 * 60 * 1000, // 30分钟
      hotThreshold: 'dynamic', // 或数字如3
      protectList: ['favicon.ico', 'logo.png', 'avatar'],
      stats: {
        enabled: true,
        sampleRate: 0.1,
      },
    }
  }

  async init() {
    this.caches = new Map()
    this.globalStats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      writes: 0,
    }

    this.log('info', 'init', {
      maxSize: this.options.maxSize,
      evictionPolicy: this.options.evictionPolicy,
      hotThreshold: this.options.hotThreshold,
    })
  }

  async destroy() {
    this.caches.forEach((cache) => cache.data.clear())
    this.caches.clear()
  }

  /**
   * 创建命名缓存
   */
  createCache(name, options = {}) {
    const config = {
      maxSize: options.maxSize || this.options.maxSize,
      maxEntries: options.maxEntries || this.options.maxEntries,
      ttl: options.ttl || this.options.ttl,
      evictionPolicy: options.evictionPolicy || this.options.evictionPolicy,
      hotThreshold: options.hotThreshold || this.options.hotThreshold,
      protectList: options.protectList || this.options.protectList,
    }

    const cache = {
      data: new Map(),
      config,
      stats: {
        hits: 0,
        misses: 0,
        evictions: 0,
        writes: 0,
        hotProtected: 0,
      },
      currentSize: 0,
    }

    this.caches.set(name, cache)

    return this._createCacheInterface(name, cache)
  }

  /**
   * 获取命名缓存
   */
  getCache(name) {
    const cache = this.caches.get(name)
    if (!cache) {
      return null
    }

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
      stats: () => this._getStats(cache),
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
      (cache.currentSize + entrySize > cache.config.maxSize ||
        cache.data.size >= cache.config.maxEntries) &&
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
      accessCount: 1,
      isHot: false,
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
    // 先更新热点标记
    this._updateHotMarkers(cache)

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

      this.emit('cache:evicted', {
        key: evictKey,
        policy,
        size: entry?.size,
        wasHot: entry?.isHot,
      })
    }
  }

  /**
   * 更新热点标记
   */
  _updateHotMarkers(cache) {
    const threshold = cache.config.hotThreshold

    // 动态热点判定
    if (threshold === 'dynamic') {
      // 计算平均访问次数
      let totalAccess = 0
      let count = 0

      for (const entry of cache.data.values()) {
        totalAccess += entry.accessCount || 1
        count++
      }

      const avgAccess = count > 0 ? totalAccess / count : 1
      const hotThreshold = avgAccess * 2

      // 标记热点
      for (const entry of cache.data.values()) {
        entry.isHot = (entry.accessCount || 1) >= hotThreshold
      }
    } else {
      // 静态阈值
      const hotThreshold = typeof threshold === 'number' ? threshold : 3

      for (const entry of cache.data.values()) {
        entry.isHot = (entry.accessCount || 1) >= hotThreshold
      }
    }
  }

  /**
   * 检查是否受保护
   */
  _isProtected(key, cache) {
    const protectList = cache.config.protectList || []

    for (const pattern of protectList) {
      if (key.includes(pattern)) {
        return true
      }
    }

    return false
  }

  /**
   * 加权LRU淘汰
   */
  _weightedLRUEvict(cache) {
    const now = Date.now()
    let minScore = Infinity
    let evictKey = null

    for (const [key, entry] of cache.data.entries()) {
      // 跳过热点和保护列表
      if (entry.isHot || this._isProtected(key, cache)) {
        cache.stats.hotProtected++
        continue
      }

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

    // 如果所有条目都被保护，使用普通LRU
    if (!evictKey) {
      return this._lruEvict(cache)
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
      // 跳过热点和保护列表
      if (entry.isHot || this._isProtected(key, cache)) {
        continue
      }

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
      // 跳过热点和保护列表
      if (entry.isHot || this._isProtected(key, cache)) {
        continue
      }

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
      // 跳过热点和保护列表
      if (entry.isHot || this._isProtected(key, cache)) {
        continue
      }

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

    // 计算热点数量
    let hotCount = 0
    for (const entry of cache.data.values()) {
      if (entry.isHot) {
        hotCount++
      }
    }

    return {
      ...cache.stats,
      size: cache.currentSize,
      entries: cache.data.size,
      hitRate: total > 0 ? cache.stats.hits / total : 0,
      hotEntries: hotCount,
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
      hitRate: total > 0 ? this.globalStats.hits / total : 0,
    }
  }
}
