/**
 * 存储管理模块
 * 负责用户偏好和选择历史的持久化存储
 */
(function () {
  'use strict'

  const STORAGE_KEYS = {
    SETTINGS: 'ep_settings',
    HISTORY: 'ep_history',
    FAVORITES: 'ep_favorites',
  }

  const DEFAULT_SETTINGS = {
    theme: 'dark',
    strategy: 'prefer-class',
    autoPreview: true,
    showMatched: true,
    showInherited: false,
    compactMode: false,
    shortcuts: {
      refresh: 'r',
      computed: 'c',
      test: 't',
      batch: 'b',
      filter: 'f',
      togglePicker: 'p',
    },
  }

  class StorageManager {
    constructor() {
      this.cache = new Map()
    }

    // ========== 设置管理 ==========

    /**
     * 获取设置
     */
    async getSettings() {
      try {
        // 由于 content script 可能无法直接访问 chrome.storage，
        // 通过消息传递与 background 通信
        return new Promise((resolve) => {
          const messageHandler = (event) => {
            if (event.data?.type === 'EP_SETTINGS_RESPONSE') {
              window.removeEventListener('message', messageHandler)
              resolve(event.data.settings || DEFAULT_SETTINGS)
            }
          }

          window.addEventListener('message', messageHandler)
          window.postMessage({ type: 'EP_GET_SETTINGS' }, '*')

          // 超时处理
          setTimeout(() => {
            window.removeEventListener('message', messageHandler)
            resolve(DEFAULT_SETTINGS)
          }, 1000)
        })
      } catch {
        return DEFAULT_SETTINGS
      }
    }

    /**
     * 保存设置
     */
    async saveSettings(settings) {
      return new Promise((resolve) => {
        const messageHandler = (event) => {
          if (event.data?.type === 'EP_SETTINGS_SAVED') {
            window.removeEventListener('message', messageHandler)
            resolve(true)
          }
        }

        window.addEventListener('message', messageHandler)
        window.postMessage(
          {
            type: 'EP_SAVE_SETTINGS',
            settings: { ...DEFAULT_SETTINGS, ...settings },
          },
          '*'
        )

        setTimeout(() => resolve(false), 1000)
      })
    }

    // ========== 历史记录 ==========

    /**
     * 添加选择历史
     */
    async addToHistory(selection) {
      const history = await this.getHistory()
      const entry = {
        ...selection,
        timestamp: Date.now(),
        url: window.location.href,
      }

      // 限制历史记录数量
      if (history.length >= 50) {
        history.shift()
      }

      history.push(entry)

      try {
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(history))
      } catch {
        // 存储失败，忽略
      }
    }

    /**
     * 获取选择历史
     */
    async getHistory() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.HISTORY)
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    }

    /**
     * 清除历史
     */
    clearHistory() {
      localStorage.removeItem(STORAGE_KEYS.HISTORY)
    }

    // ========== 收藏管理 ==========

    /**
     * 添加收藏
     */
    addFavorite(selector, label = '') {
      const favorites = this.getFavorites()
      const entry = {
        selector,
        label: label || selector.substring(0, 30),
        timestamp: Date.now(),
      }

      // 检查是否已存在
      const exists = favorites.some((f) => f.selector === selector)
      if (!exists) {
        favorites.push(entry)
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites))
      }
    }

    /**
     * 获取收藏列表
     */
    getFavorites() {
      try {
        const stored = localStorage.getItem(STORAGE_KEYS.FAVORITES)
        return stored ? JSON.parse(stored) : []
      } catch {
        return []
      }
    }

    /**
     * 移除收藏
     */
    removeFavorite(selector) {
      const favorites = this.getFavorites()
      const filtered = favorites.filter((f) => f.selector !== selector)
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(filtered))
    }

    // ========== 导出功能 ==========

    /**
     * 导出为 JSON
     */
    exportAsJson(data) {
      const json = JSON.stringify(data, null, 2)
      this._download(json, 'selectors.json', 'application/json')
    }

    /**
     * 导出为 CSV
     */
    exportAsCsv(data) {
      const headers = ['selector', 'tagName', 'id', 'className', 'matchCount', 'timestamp']
      const rows = data.map((item) =>
        headers
          .map((h) => {
            const val = item[h] || ''
            // CSV 转义
            return typeof val === 'string' &&
              (val.includes(',') || val.includes('"') || val.includes('\n'))
              ? `"${val.replace(/"/g, '""')}"`
              : val
          })
          .join(',')
      )

      const csv = [headers.join(','), ...rows].join('\n')
      this._download(csv, 'selectors.csv', 'text/csv')
    }

    /**
     * 导出为 Playwright 代码
     */
    exportAsPlaywright(data) {
      const code = `// Playwright 选择器
// 生成时间: ${new Date().toISOString()}

${data
  .map(
    (item, i) =>
      `// 元素 ${i + 1}: ${item.tagName}${item.id ? '#' + item.id : ''}${item.className ? '.' + item.className.split(' ')[0] : ''}\nconst element${i + 1} = await page.locator('${item.selector.replace(/'/g, "\\'")}');`
  )
  .join('\n\n')}
`
      this._download(code, 'selectors.playwright.js', 'text/javascript')
    }

    /**
     * 导出为 Puppeteer 代码
     */
    exportAsPuppeteer(data) {
      const code = `// Puppeteer 选择器
// 生成时间: ${new Date().toISOString()}

${data
  .map(
    (item, i) =>
      `// 元素 ${i + 1}: ${item.tagName}${item.id ? '#' + item.id : ''}${item.className ? '.' + item.className.split(' ')[0] : ''}\nconst element${i + 1} = await page.$('${item.selector.replace(/'/g, "\\'")}');`
  )
  .join('\n\n')}
`
      this._download(code, 'selectors.puppeteer.js', 'text/javascript')
    }

    /**
     * 下载文件
     */
    _download(content, filename, mimeType) {
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    }

    // ========== 缓存管理 ==========

    setCache(key, value) {
      this.cache.set(key, {
        value,
        timestamp: Date.now(),
      })
    }

    getCache(key, maxAge = 60000) {
      // 默认1分钟
      const cached = this.cache.get(key)
      if (!cached) {return null}

      if (Date.now() - cached.timestamp > maxAge) {
        this.cache.delete(key)
        return null
      }

      return cached.value
    }

    clearCache() {
      this.cache.clear()
    }
  }

  // 导出
  window.StorageManager = StorageManager
})()
