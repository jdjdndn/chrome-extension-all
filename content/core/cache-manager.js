// ========== 缓存管理器 ==========
// 智能缓存管理，支持多种缓存策略

(function () {
  'use strict'

  if (window.CacheManager) {
    console.log('[CacheManager] 已存在，跳过初始化')
    return
  }

  /**
   * CacheManager - 缓存管理器
   * 功能：
   * 1. 多种缓存策略（TTL, LRU, LFU）
   * 2. 自动失效和清理
   * 3. 缓存统计和监控
   */
  const CacheManager = {
    // 缓存存储
    caches: new Map(),

    // 默认配置
    defaultConfig: {
      maxSize: 100,
      ttl: 5 * 60 * 1000, // 5分钟
      strategy: 'ttl', // ttl | lru | lfu
      autoClean: true,
      cleanInterval: 60 * 1000, // 1分钟
    },

    // 统计信息
    stats: {
      hits: 0,
      misses: 0,
      evictions: 0,
      cleanups: 0,
    },

    // 清理定时器
    _cleanTimer: null,

    /**
     * 创建或获取缓存实例
     * @param {string} name - 缓存名称
     * @param {object} config - 缓存配置
     * @returns {object}
     */
    create(name, config = {}) {
      if (this.caches.has(name)) {
        return this.caches.get(name)
      }

      const cacheConfig = { ...this.defaultConfig, ...config }
      const cache = {
        name,
        config: cacheConfig,
        data: new Map(),
        accessLog: new Map(), // 用于 LRU/LFU
        stats: { hits: 0, misses: 0, sets: 0, deletes: 0 },
      }

      this.caches.set(name, cache)
      console.log(`[CacheManager] 创建缓存: ${name}`, cacheConfig)

      // 启动自动清理
      if (cacheConfig.autoClean && !this._cleanTimer) {
        this._startAutoClean()
      }

      return this._createCacheInterface(cache)
    },

    /**
     * 创建缓存接口
     */
    _createCacheInterface(cache) {
      const self = this

      return {
        /**
         * 获取缓存值
         */
        get(key) {
          return self._get(cache, key)
        },

        /**
         * 设置缓存值
         */
        set(key, value, ttl) {
          return self._set(cache, key, value, ttl)
        },

        /**
         * 删除缓存值
         */
        delete(key) {
          return self._delete(cache, key)
        },

        /**
         * 检查键是否存在
         */
        has(key) {
          return self._has(cache, key)
        },

        /**
         * 清空缓存
         */
        clear() {
          return self._clear(cache)
        },

        /**
         * 获取所有键
         */
        keys() {
          return Array.from(cache.data.keys())
        },

        /**
         * 获取缓存大小
         */
        size() {
          return cache.data.size
        },

        /**
         * 获取统计信息
         */
        getStats() {
          return { ...cache.stats }
        },

        /**
         * 使缓存失效
         */
        invalidate(pattern) {
          return self._invalidate(cache, pattern)
        },

        /**
         * 刷新 TTL
         */
        touch(key) {
          return self._touch(cache, key)
        },
      }
    },

    /**
     * 获取缓存值
     */
    _get(cache, key) {
      const entry = cache.data.get(key)

      if (!entry) {
        cache.stats.misses++
        this.stats.misses++
        return undefined
      }

      // 检查是否过期
      if (this._isExpired(entry)) {
        this._delete(cache, key)
        cache.stats.misses++
        this.stats.misses++
        return undefined
      }

      // 更新访问记录
      this._recordAccess(cache, key)

      cache.stats.hits++
      this.stats.hits++

      return entry.value
    },

    /**
     * 设置缓存值
     */
    _set(cache, key, value, ttl) {
      // 检查是否需要淘汰
      if (cache.data.size >= cache.config.maxSize && !cache.data.has(key)) {
        this._evict(cache)
      }

      const entry = {
        value,
        createdAt: Date.now(),
        ttl: ttl || cache.config.ttl,
        expiresAt: Date.now() + (ttl || cache.config.ttl),
      }

      cache.data.set(key, entry)
      cache.stats.sets++

      return true
    },

    /**
     * 删除缓存值
     */
    _delete(cache, key) {
      const result = cache.data.delete(key)
      if (result) {
        cache.stats.deletes++
        cache.accessLog.delete(key)
      }
      return result
    },

    /**
     * 检查键是否存在
     */
    _has(cache, key) {
      const entry = cache.data.get(key)
      if (!entry) {return false}
      if (this._isExpired(entry)) {
        this._delete(cache, key)
        return false
      }
      return true
    },

    /**
     * 清空缓存
     */
    _clear(cache) {
      const size = cache.data.size
      cache.data.clear()
      cache.accessLog.clear()
      return size
    },

    /**
     * 检查是否过期
     */
    _isExpired(entry) {
      return Date.now() > entry.expiresAt
    },

    /**
     * 记录访问
     */
    _recordAccess(cache, key) {
      const strategy = cache.config.strategy

      if (strategy === 'lru') {
        cache.accessLog.set(key, Date.now())
      } else if (strategy === 'lfu') {
        const count = cache.accessLog.get(key) || 0
        cache.accessLog.set(key, count + 1)
      }
    },

    /**
     * 淘汰缓存
     */
    _evict(cache) {
      const strategy = cache.config.strategy
      let keyToEvict = null

      if (strategy === 'lru') {
        // 淘汰最久未使用
        let oldest = Infinity
        for (const [key, time] of cache.accessLog) {
          if (time < oldest) {
            oldest = time
            keyToEvict = key
          }
        }
      } else if (strategy === 'lfu') {
        // 淘汰最少使用
        let least = Infinity
        for (const [key, count] of cache.accessLog) {
          if (count < least) {
            least = count
            keyToEvict = key
          }
        }
      } else {
        // TTL 策略：淘汰最早过期的
        let earliest = Infinity
        for (const [key, entry] of cache.data) {
          if (entry.expiresAt < earliest) {
            earliest = entry.expiresAt
            keyToEvict = key
          }
        }
      }

      if (keyToEvict) {
        this._delete(cache, keyToEvict)
        this.stats.evictions++
        console.log(`[CacheManager] 淘汰缓存项: ${cache.name}/${keyToEvict}`)
      }
    },

    /**
     * 使匹配的缓存失效
     */
    _invalidate(cache, pattern) {
      let count = 0
      const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern)

      for (const key of cache.data.keys()) {
        if (regex.test(key)) {
          this._delete(cache, key)
          count++
        }
      }

      return count
    },

    /**
     * 刷新 TTL
     */
    _touch(cache, key) {
      const entry = cache.data.get(key)
      if (!entry) {return false}

      entry.expiresAt = Date.now() + entry.ttl
      this._recordAccess(cache, key)
      return true
    },

    /**
     * 清理过期缓存
     */
    cleanup() {
      let totalCleaned = 0

      for (const [name, cache] of this.caches) {
        let cleaned = 0
        for (const [key, entry] of cache.data) {
          if (this._isExpired(entry)) {
            this._delete(cache, key)
            cleaned++
          }
        }
        if (cleaned > 0) {
          console.log(`[CacheManager] 清理 ${name}: ${cleaned} 项`)
          totalCleaned += cleaned
        }
      }

      this.stats.cleanups++
      return totalCleaned
    },

    /**
     * 启动自动清理
     */
    _startAutoClean() {
      if (this._cleanTimer) {return}

      this._cleanTimer = setInterval(() => {
        this.cleanup()
      }, this.defaultConfig.cleanInterval)

      console.log('[CacheManager] 启动自动清理')
    },

    /**
     * 停止自动清理
     */
    stopAutoClean() {
      if (this._cleanTimer) {
        clearInterval(this._cleanTimer)
        this._cleanTimer = null
        console.log('[CacheManager] 停止自动清理')
      }
    },

    /**
     * 获取全局统计
     */
    getGlobalStats() {
      const cacheStats = {}
      for (const [name, cache] of this.caches) {
        cacheStats[name] = {
          size: cache.data.size,
          maxSize: cache.config.maxSize,
          ...cache.stats,
        }
      }

      return {
        ...this.stats,
        hitRate: this.stats.hits / (this.stats.hits + this.stats.misses) || 0,
        caches: cacheStats,
      }
    },

    /**
     * 删除缓存实例
     */
    destroy(name) {
      const cache = this.caches.get(name)
      if (cache) {
        cache.data.clear()
        cache.accessLog.clear()
        this.caches.delete(name)
        console.log(`[CacheManager] 销毁缓存: ${name}`)
        return true
      }
      return false
    },

    /**
     * 销毁所有缓存
     */
    destroyAll() {
      for (const name of this.caches.keys()) {
        this.destroy(name)
      }
      this.stopAutoClean()
      console.log('[CacheManager] 销毁所有缓存')
    },
  }

  // 导出
  window.CacheManager = CacheManager

  console.log('[CacheManager] 缓存管理器已加载')
})()
