// content/modules/ai-aggregator/tab-manager.js
/**
 * AI 聚合问答 - 标签页管理模块
 * 负责创建、管理、关闭 AI 网站标签页
 */

/**
 * 标签页管理器类
 */
class TabManager {
  constructor() {
    this.activeTabs = new Map() // siteId -> { tabId, status }
    this.aggregatorTabId = null
  }

  /**
   * 设置聚合页面 Tab ID
   */
  setAggregatorTab(tabId) {
    this.aggregatorTabId = tabId
  }

  /**
   * 从 URL 提取基础路径用于匹配
   * 例如: https://kimi.moonshot.cn/chat/xxx -> https://kimi.moonshot.cn
   */
  getBaseUrl(url) {
    try {
      const urlObj = new URL(url)
      return urlObj.origin
    } catch {
      return url
    }
  }

  /**
   * 通过 URL 查找已打开的标签页
   */
  async findTabByUrl(site) {
    const baseUrl = this.getBaseUrl(site.url)
    const tabs = await chrome.tabs.query({ url: `${baseUrl}/*` })

    if (tabs && tabs.length > 0) {
      // 优先返回非 discarded 的标签页
      const activeTab = tabs.find((tab) => !tab.discarded)
      return activeTab || tabs[0]
    }
    return null
  }

  /**
   * 创建 AI 网站标签页（复用已存在的标签页）
   */
  async createAITab(site) {
    try {
      // 1. 先检查内存记录
      const existingTab = this.activeTabs.get(site.id)
      if (existingTab && existingTab.tabId) {
        try {
          const tab = await chrome.tabs.get(existingTab.tabId)
          if (tab && !tab.discarded) {
            console.log(
              `[Tab Manager] 复用内存中的标签页: ${site.name} (tabId: ${existingTab.tabId})`
            )
            return existingTab.tabId
          }
        } catch (e) {
          this.activeTabs.delete(site.id)
        }
      }

      // 2. 通过 URL 查找已打开的标签页
      const foundTab = await this.findTabByUrl(site)
      if (foundTab) {
        console.log(`[Tab Manager] 复用已打开的标签页: ${site.name} (tabId: ${foundTab.id})`)
        this.activeTabs.set(site.id, {
          tabId: foundTab.id,
          status: 'existing',
          site: site,
        })
        return foundTab.id
      }

      // 3. 创建新标签页
      const tab = await chrome.tabs.create({
        url: site.url,
        active: false,
      })

      this.activeTabs.set(site.id, {
        tabId: tab.id,
        status: 'loading',
        site: site,
      })

      console.log(`[Tab Manager] 创建标签页: ${site.name} (tabId: ${tab.id})`)
      return tab.id
    } catch (error) {
      console.error(`[Tab Manager] 创建标签页失败: ${site.name}`, error)
      return null
    }
  }

  /**
   * 批量创建 AI 标签页（带并发控制）
   */
  async createAITabs(sites, maxConcurrent = 3) {
    const results = []

    for (let i = 0; i < sites.length; i += maxConcurrent) {
      const batch = sites.slice(i, i + maxConcurrent)
      const batchResults = await Promise.all(
        batch.map(async (site) => {
          const tabId = await this.createAITab(site)
          return { siteId: site.id, tabId, success: !!tabId }
        })
      )
      results.push(...batchResults)
    }

    return results
  }

  /**
   * 注入脚本到标签页
   */
  async injectScripts(tabId, config) {
    try {
      // 注入 injector.js
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/modules/ai-aggregator/injector.js'],
      })

      // 注入 response-watcher.js
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content/modules/ai-aggregator/response-watcher.js'],
      })

      console.log(`[Tab Manager] 脚本已注入到 tabId: ${tabId}`)
      return true
    } catch (error) {
      console.error(`[Tab Manager] 注入脚本失败:`, error)
      return false
    }
  }

  /**
   * 向标签页发送问题
   */
  async sendQuestion(tabId, config, question) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, {
        type: 'AIA_EXECUTE_SEND',
        config: config,
        question: question,
      })
      return response
    } catch (error) {
      console.error(`[Tab Manager] 发送问题失败:`, error)
      return { success: false, error: error.message }
    }
  }

  /**
   * 开始监听回复
   */
  async startWatching(tabId, config) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'AIA_START_WATCHING',
        config: config,
      })
    } catch (error) {
      console.error(`[Tab Manager] 启动监听失败:`, error)
    }
  }

  /**
   * 更新标签页状态
   */
  updateTabStatus(siteId, status) {
    const tabInfo = this.activeTabs.get(siteId)
    if (tabInfo) {
      tabInfo.status = status
    }
  }

  /**
   * 关闭单个标签页
   */
  async closeTab(siteId) {
    const tabInfo = this.activeTabs.get(siteId)
    if (tabInfo && tabInfo.tabId) {
      try {
        await chrome.tabs.remove(tabInfo.tabId)
        this.activeTabs.delete(siteId)
        console.log(`[Tab Manager] 已关闭标签页: ${siteId}`)
      } catch (error) {
        console.error(`[Tab Manager] 关闭标签页失败:`, error)
      }
    }
  }

  /**
   * 关闭所有 AI 标签页
   */
  async closeAllTabs() {
    const tabIds = Array.from(this.activeTabs.values())
      .map((info) => info.tabId)
      .filter((id) => id)

    if (tabIds.length > 0) {
      try {
        await chrome.tabs.remove(tabIds)
        this.activeTabs.clear()
        console.log(`[Tab Manager] 已关闭所有标签页`)
      } catch (error) {
        console.error(`[Tab Manager] 批量关闭失败:`, error)
      }
    }
  }

  /**
   * 获取活跃标签页信息
   */
  getActiveTabs() {
    return Object.fromEntries(this.activeTabs)
  }

  /**
   * 清理资源
   */
  cleanup() {
    this.closeAllTabs()
    this.aggregatorTabId = null
  }
}

// 导出
if (typeof window !== 'undefined') {
  window.TabManager = TabManager
}

export { TabManager }
