/**
 * KeywordFilter - 关键词过滤模块
 * 用于站点脚本的关键词过滤功能
 */

'use strict'

/**
 * 创建关键词过滤器
 * @param {Object} options - 配置选项
 * @param {string} options.domain - 域名
 * @param {string[]} options.defaultKeywords - 默认关键词列表
 * @param {boolean} options.caseSensitive - 是否区分大小写
 * @returns {Object} 过滤器实例
 */
export function createKeywordFilter(options = {}) {
  const { domain = '', defaultKeywords = [], caseSensitive = false } = options

  let keywords = [...defaultKeywords]
  let userKeywords = []

  /**
   * 标准化关键词
   */
  function normalize(keyword) {
    return caseSensitive ? keyword : keyword.toLowerCase()
  }

  return {
    /**
     * 检查文本是否包含关键词
     * @param {string} text - 待检查文本
     * @returns {boolean}
     */
    match(text) {
      if (!text || keywords.length === 0) {
        return false
      }
      const normalizedText = normalize(text)
      return keywords.some((keyword) => normalizedText.includes(normalize(keyword)))
    },

    /**
     * 查找匹配的关键词
     * @param {string} text - 待检查文本
     * @returns {string[]} 匹配的关键词列表
     */
    findMatches(text) {
      if (!text || keywords.length === 0) {
        return []
      }
      const normalizedText = normalize(text)
      return keywords.filter((keyword) => normalizedText.includes(normalize(keyword)))
    },

    /**
     * 添加关键词
     * @param {string|string[]} newKeywords - 新关键词
     */
    add(newKeywords) {
      const toAdd = Array.isArray(newKeywords) ? newKeywords : [newKeywords]
      keywords = [...new Set([...keywords, ...toAdd])]
    },

    /**
     * 移除关键词
     * @param {string|string[]} toRemove - 要移除的关键词
     */
    remove(toRemove) {
      const removeList = Array.isArray(toRemove) ? toRemove : [toRemove]
      keywords = keywords.filter((k) => !removeList.includes(k))
    },

    /**
     * 设置用户关键词
     * @param {string[]} newUserKeywords - 用户关键词列表
     */
    setUserKeywords(newUserKeywords) {
      userKeywords = [...newUserKeywords]
      keywords = [...new Set([...defaultKeywords, ...userKeywords])]
    },

    /**
     * 重置为默认关键词
     */
    reset() {
      userKeywords = []
      keywords = [...defaultKeywords]
    },

    /**
     * 获取所有关键词
     * @returns {string[]}
     */
    getKeywords() {
      return [...keywords]
    },

    /**
     * 获取用户关键词
     * @returns {string[]}
     */
    getUserKeywords() {
      return [...userKeywords]
    },

    /**
     * 从存储加载关键词
     */
    async loadFromStorage() {
      try {
        const storageKey = `${domain}Keywords`
        const result = await chrome.storage.local.get(storageKey)
        if (result[storageKey]) {
          this.setUserKeywords(result[storageKey])
        }
      } catch (error) {
        console.warn(`[${domain}] 加载关键词失败:`, error.message)
      }
    },

    /**
     * 保存关键词到存储
     */
    async saveToStorage() {
      try {
        const storageKey = `${domain}Keywords`
        await chrome.storage.local.set({ [storageKey]: userKeywords })
      } catch (error) {
        console.warn(`[${domain}] 保存关键词失败:`, error.message)
      }
    },

    /**
     * 导出配置
     */
    export() {
      return {
        domain,
        defaultKeywords: [...defaultKeywords],
        userKeywords: [...userKeywords],
        allKeywords: [...keywords],
      }
    },
  }
}

const KeywordFilter = {
  create: createKeywordFilter,
}

export default KeywordFilter

// 全局暴露
if (typeof window !== 'undefined' && !window.KeywordFilter) {
  window.KeywordFilter = KeywordFilter
  console.log('[KeywordFilter] 模块已加载')
}
