/**
 * 搜索历史记录管理模块
 * 管理用户的搜索词历史，支持词频统计和自动建议
 */

const SearchHistory = {
  STORAGE_KEY: 'searchHistory',
  MAX_HISTORY: 100,

  /**
   * 获取所有搜索历史
   * @returns {Promise<Array<{query: string, count: number, lastTime: number}>>}
   */
  async getAll() {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEY)
      return result[this.STORAGE_KEY] || []
    } catch (error) {
      console.error('[SearchHistory] 获取历史失败:', error)
      return []
    }
  },

  /**
   * 添加搜索词
   * @param {string} query - 搜索词
   */
  async add(query) {
    if (!query || query.trim().length < 2) return

    query = query.trim().toLowerCase()
    const history = await this.getAll()

    // 查找是否已存在
    const existingIndex = history.findIndex((h) => h.query === query)
    if (existingIndex >= 0) {
      // 更新计数和时间
      history[existingIndex].count++
      history[existingIndex].lastTime = Date.now()
    } else {
      // 添加新记录
      history.push({
        query,
        count: 1,
        lastTime: Date.now(),
      })
    }

    // 按词频和时间排序，保留热门
    history.sort((a, b) => {
      // 词频优先
      if (b.count !== a.count) return b.count - a.count
      // 时间次之
      return b.lastTime - a.lastTime
    })

    // 限制数量
    const trimmed = history.slice(0, this.MAX_HISTORY)

    await chrome.storage.local.set({ [this.STORAGE_KEY]: trimmed })
  },

  /**
   * 删除单个搜索词
   * @param {string} query - 搜索词
   */
  async remove(query) {
    const history = await this.getAll()
    const filtered = history.filter((h) => h.query !== query.toLowerCase())
    await chrome.storage.local.set({ [this.STORAGE_KEY]: filtered })
  },

  /**
   * 清空所有历史
   */
  async clear() {
    await chrome.storage.local.set({ [this.STORAGE_KEY]: [] })
  },

  /**
   * 获取搜索建议
   * @param {string} prefix - 前缀
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>}
   */
  async getSuggestions(prefix, limit = 5) {
    if (!prefix || prefix.length < 1) return []

    const history = await this.getAll()
    const lowerPrefix = prefix.toLowerCase()

    // 前缀匹配 + 包含匹配
    const suggestions = history
      .filter((h) => h.query.startsWith(lowerPrefix) || h.query.includes(lowerPrefix))
      .slice(0, limit)
      .map((h) => ({
        query: h.query,
        count: h.count,
        type: h.query.startsWith(lowerPrefix) ? 'prefix' : 'contains',
      }))

    return suggestions
  },

  /**
   * 获取热门搜索词
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>}
   */
  async getTop(limit = 10) {
    const history = await this.getAll()
    return history.slice(0, limit)
  },

  /**
   * 获取最近搜索词
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>}
   */
  async getRecent(limit = 10) {
    const history = await this.getAll()
    // 按时间排序
    const sorted = [...history].sort((a, b) => b.lastTime - a.lastTime)
    return sorted.slice(0, limit)
  },

  /**
   * 导出历史
   * @returns {Promise<string>}
   */
  async export() {
    const history = await this.getAll()
    return JSON.stringify(history, null, 2)
  },

  /**
   * 导入历史
   * @param {string} jsonStr - JSON字符串
   */
  async import(jsonStr) {
    try {
      const imported = JSON.parse(jsonStr)
      if (Array.isArray(imported)) {
        const history = await this.getAll()
        // 合并
        imported.forEach((item) => {
          if (item.query && typeof item.count === 'number') {
            const existing = history.find((h) => h.query === item.query.toLowerCase())
            if (existing) {
              existing.count += item.count
              existing.lastTime = Math.max(existing.lastTime, item.lastTime || 0)
            } else {
              history.push({
                query: item.query.toLowerCase(),
                count: item.count,
                lastTime: item.lastTime || Date.now(),
              })
            }
          }
        })
        // 排序并限制
        history.sort((a, b) => b.count - a.count)
        await chrome.storage.local.set({ [this.STORAGE_KEY]: history.slice(0, this.MAX_HISTORY) })
      }
    } catch (error) {
      console.error('[SearchHistory] 导入失败:', error)
    }
  },
}

// 导出
if (typeof window !== 'undefined') {
  window.SearchHistory = SearchHistory
}
