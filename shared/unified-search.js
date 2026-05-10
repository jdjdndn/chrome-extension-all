/**
 * 统一搜索模块
 * 聚合历史记录、书签、下载、标签页等多来源搜索结果
 */

const UnifiedSearch = {
  /**
   * 执行统一搜索
   * @param {string} query - 搜索关键词
   * @param {object} options - 搜索选项
   * @returns {Promise<{history: Array, bookmarks: Array, downloads: Array, tabs: Array}>}
   */
  async search(query, options = {}) {
    const { sources = ['history', 'bookmarks', 'downloads', 'tabs'], limit = 10 } = options

    if (!query || query.trim().length < 2) {
      return { history: [], bookmarks: [], downloads: [], tabs: [] }
    }

    const results = {
      history: [],
      bookmarks: [],
      downloads: [],
      tabs: [],
    }

    // 并行搜索所有来源
    const searchPromises = []

    if (sources.includes('history')) {
      searchPromises.push(this._searchHistory(query, limit))
    }
    if (sources.includes('bookmarks')) {
      searchPromises.push(this._searchBookmarks(query, limit))
    }
    if (sources.includes('downloads')) {
      searchPromises.push(this._searchDownloads(query, limit))
    }
    if (sources.includes('tabs')) {
      searchPromises.push(this._searchTabs(query, limit))
    }

    const searchResults = await Promise.all(searchPromises)

    // 合并结果
    let resultIndex = 0
    if (sources.includes('history')) {
      results.history = searchResults[resultIndex++] || []
    }
    if (sources.includes('bookmarks')) {
      results.bookmarks = searchResults[resultIndex++] || []
    }
    if (sources.includes('downloads')) {
      results.downloads = searchResults[resultIndex++] || []
    }
    if (sources.includes('tabs')) {
      results.tabs = searchResults[resultIndex++] || []
    }

    // 记录搜索历史
    if (typeof SearchHistory !== 'undefined') {
      SearchHistory.add(query)
    }

    return results
  },

  /**
   * 搜索历史记录
   */
  async _searchHistory(query, limit) {
    try {
      const items = await chrome.history.search({
        text: query,
        maxResults: limit * 2,
        startTime: Date.now() - 30 * 24 * 60 * 60 * 1000,
      })

      return items.map((item) => ({
        type: 'history',
        url: item.url,
        title: item.title || item.url,
        lastVisitTime: item.lastVisitTime,
        visitCount: item.visitCount,
        domain: this._getDomain(item.url),
      }))
    } catch (error) {
      console.error('[UnifiedSearch] 历史搜索失败:', error)
      return []
    }
  },

  /**
   * 搜索书签
   */
  async _searchBookmarks(query, limit) {
    try {
      const items = await chrome.bookmarks.search(query)

      return items
        .filter((item) => item.url)
        .slice(0, limit)
        .map((item) => ({
          type: 'bookmark',
          id: item.id,
          url: item.url,
          title: item.title,
          dateAdded: item.dateAdded,
          domain: this._getDomain(item.url),
        }))
    } catch (error) {
      console.error('[UnifiedSearch] 书签搜索失败:', error)
      return []
    }
  },

  /**
   * 搜索下载记录
   */
  async _searchDownloads(query, limit) {
    try {
      if (typeof DownloadsSearch === 'undefined') {
        return []
      }
      const items = await DownloadsSearch.search(query, { limit })

      return items.map((item) => ({
        type: 'download',
        id: item.id,
        filename: item.filename,
        url: item.url,
        state: item.state,
        startTime: item.startTime,
        fileSize: item.fileSize,
        icon: DownloadsSearch.getFileIcon(item.filename),
      }))
    } catch (error) {
      console.error('[UnifiedSearch] 下载搜索失败:', error)
      return []
    }
  },

  /**
   * 搜索标签页内容
   */
  async _searchTabs(query, limit) {
    try {
      if (typeof TabContentSearch === 'undefined') {
        return []
      }
      const items = await TabContentSearch.search(query, { maxResults: limit })

      return items.map((item) => ({
        type: 'tab',
        tabId: item.tab.id,
        title: item.tab.title,
        url: item.tab.url,
        favIconUrl: item.tab.favIconUrl,
        matchCount: item.count,
        snippet: item.snippet,
        domain: TabContentSearch.getDomain(item.tab.url),
      }))
    } catch (error) {
      console.error('[UnifiedSearch] 标签页搜索失败:', error)
      return []
    }
  },

  /**
   * 获取域名
   */
  _getDomain(url) {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  },

  /**
   * 获取总结果数
   */
  getTotalCount(results) {
    return Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
  },

  /**
   * 按相关性排序所有结果
   */
  sortByRelevance(results, query) {
    const allResults = []
    const lowerQuery = query.toLowerCase()

    Object.entries(results).forEach(([source, items]) => {
      items.forEach((item) => {
        let score = 0
        const title = (item.title || item.filename || '').toLowerCase()
        const url = (item.url || '').toLowerCase()

        // 标题完全匹配
        if (title === lowerQuery) {score += 100}
        // 标题开头匹配
        else if (title.startsWith(lowerQuery)) {score += 80}
        // 标题包含
        else if (title.includes(lowerQuery)) {score += 60}

        // URL匹配
        if (url.includes(lowerQuery)) {score += 40}

        // 访问次数/匹配次数加权
        if (item.visitCount) {score += Math.min(item.visitCount, 20)}
        if (item.matchCount) {score += Math.min(item.matchCount * 5, 25)}

        allResults.push({ ...item, source, score })
      })
    })

    return allResults.sort((a, b) => b.score - a.score)
  },

  /**
   * 快速搜索（仅标题和URL）
   */
  async quickSearch(query, limit = 20) {
    const results = await this.search(query, { limit: Math.ceil(limit / 4) })
    return this.sortByRelevance(results, query).slice(0, limit)
  },
}

// 导出
if (typeof window !== 'undefined') {
  window.UnifiedSearch = UnifiedSearch
}
