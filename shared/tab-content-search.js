/**
 * 跨标签页内容搜索模块
 * 搜索所有打开标签页的页面内容
 */

const TabContentSearch = {
  /**
   * 获取所有标签页
   * @returns {Promise<Array<chrome.tabs.Tab>>}
   */
  async getAllTabs() {
    try {
      const tabs = await chrome.tabs.query({})
      return tabs.filter((tab) => tab.url && !tab.url.startsWith('chrome://'))
    } catch (error) {
      console.error('[TabContentSearch] 获取标签页失败:', error)
      return []
    }
  },

  /**
   * 在标签页中搜索内容
   * @param {string} query - 搜索关键词
   * @param {object} options - 搜索选项
   * @returns {Promise<Array<{tab: object, matches: Array, snippet: string}>>}
   */
  async search(query, options = {}) {
    const { caseSensitive = false, wholeWord = false, maxResults = 50 } = options

    if (!query || query.trim().length < 2) {
      return []
    }

    const tabs = await this.getAllTabs()
    const results = []

    // 并行搜索所有标签页
    const searchPromises = tabs.map(async (tab) => {
      try {
        // 注入搜索脚本
        const matches = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: this._searchInPage,
          args: [query, caseSensitive, wholeWord],
        })

        if (matches && matches[0] && matches[0].result && matches[0].result.count > 0) {
          return {
            tab: {
              id: tab.id,
              title: tab.title,
              url: tab.url,
              favIconUrl: tab.favIconUrl,
            },
            matches: matches[0].result.matches,
            count: matches[0].result.count,
            snippet: matches[0].result.snippet,
          }
        }
        return null
      } catch (error) {
        // 某些页面可能无法注入脚本
        return null
      }
    })

    const searchResults = await Promise.all(searchPromises)

    // 过滤有效结果并排序
    const validResults = searchResults
      .filter((r) => r !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, maxResults)

    return validResults
  },

  /**
   * 在页面中搜索的函数（注入到页面执行）
   */
  _searchInPage: function (query, caseSensitive, wholeWord) {
    const searchQuery = caseSensitive ? query : query.toLowerCase()

    // 获取页面文本内容
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        // 排除脚本、样式等
        const parent = node.parentElement
        if (!parent) return NodeFilter.FILTER_REJECT
        const tag = parent.tagName.toLowerCase()
        if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tag)) {
          return NodeFilter.FILTER_REJECT
        }
        return NodeFilter.FILTER_ACCEPT
      },
    })

    const matches = []
    let matchCount = 0
    let snippet = ''
    const maxSnippets = 3

    while (walker.nextNode()) {
      const text = walker.currentNode.textContent
      const searchText = caseSensitive ? text : text.toLowerCase()

      let index = searchText.indexOf(searchQuery)
      while (index !== -1) {
        matchCount++

        // 收集前几个匹配的上下文片段
        if (matches.length < maxSnippets) {
          const start = Math.max(0, index - 30)
          const end = Math.min(text.length, index + query.length + 30)
          const context = text.substring(start, end)

          matches.push({
            text: context,
            offset: index,
          })
        }

        // 查找下一个匹配
        index = searchText.indexOf(searchQuery, index + 1)
      }
    }

    // 生成摘要
    if (matches.length > 0) {
      snippet = matches.map((m) => '...' + m.text + '...').join(' | ')
    }

    return {
      count: matchCount,
      matches: matches.slice(0, 5),
      snippet: snippet.substring(0, 200),
    }
  },

  /**
   * 高亮标签页中的搜索词
   * @param {number} tabId - 标签页ID
   * @param {string} query - 搜索词
   */
  async highlight(tabId, query) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: this._highlightInPage,
        args: [query],
      })
    } catch (error) {
      console.error('[TabContentSearch] 高亮失败:', error)
    }
  },

  /**
   * 在页面中高亮搜索词的函数
   */
  _highlightInPage: function (query) {
    // 移除之前的高亮
    document.querySelectorAll('.tab-search-highlight').forEach((el) => {
      el.outerHTML = el.textContent
    })

    // 创建高亮样式
    if (!document.getElementById('tab-search-highlight-style')) {
      const style = document.createElement('style')
      style.id = 'tab-search-highlight-style'
      style.textContent = `
        .tab-search-highlight {
          background-color: #ffeb3b;
          color: #000;
          padding: 0 2px;
          border-radius: 2px;
          box-shadow: 0 0 0 2px #ffeb3b;
        }
      `
      document.head.appendChild(style)
    }

    // 查找并高亮
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null)

    const textNodes = []
    while (walker.nextNode()) {
      const parent = walker.currentNode.parentElement
      if (parent && !['script', 'style', 'noscript'].includes(parent.tagName.toLowerCase())) {
        if (walker.currentNode.textContent.toLowerCase().includes(query.toLowerCase())) {
          textNodes.push(walker.currentNode)
        }
      }
    }

    textNodes.forEach((node) => {
      const text = node.textContent
      const regex = new RegExp(`(${query})`, 'gi')
      const span = document.createElement('span')
      span.innerHTML = text.replace(regex, '<mark class="tab-search-highlight">$1</mark>')
      node.parentNode.replaceChild(span, node)
    })
  },

  /**
   * 清除高亮
   * @param {number} tabId - 标签页ID
   */
  async clearHighlight(tabId) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          document.querySelectorAll('.tab-search-highlight').forEach((el) => {
            el.outerHTML = el.textContent
          })
        },
      })
    } catch (error) {
      console.error('[TabContentSearch] 清除高亮失败:', error)
    }
  },

  /**
   * 跳转到标签页
   * @param {number} tabId - 标签页ID
   */
  async goToTab(tabId) {
    try {
      await chrome.tabs.update(tabId, { active: true })
      const tab = await chrome.tabs.get(tabId)
      if (tab.windowId) {
        await chrome.windows.update(tab.windowId, { focused: true })
      }
    } catch (error) {
      console.error('[TabContentSearch] 跳转标签页失败:', error)
    }
  },

  /**
   * 获取标签页域名
   * @param {string} url - URL
   * @returns {string}
   */
  getDomain(url) {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  },
}

// 导出
if (typeof window !== 'undefined') {
  window.TabContentSearch = TabContentSearch
}
