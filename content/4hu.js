// Content script for 4hu.tv
// 使用 SiteBase 基类重构

'use strict'

// ========== 4hu 站点脚本类 ==========
class Hu4Site extends SiteBase {
  constructor() {
    super({
      domain: '4hu.tv',
      styleTagId: 'kkm-content-hide-style',
      defaultSelectors: ['.kkm-content'],
      blockedDomains: [],
      localServerEnabled: true,
      localServerUrl: 'http://localhost:3000',
    })

    // 4hu 特有的观察器
    this.observer = null
  }

  /**
   * 自定义初始化（覆盖父类方法）
   */
  async customInit() {
    // 设置自动点击观察器
    this.setupAutoClickObserver()

    // 尝试自动点击
    this.autoClickTiaozhuan()

    console.log('[4hu脚本] 自定义初始化完成')
  }

  /**
   * 自动点击跳转按钮
   */
  autoClickTiaozhuan() {
    const tiaozhuan = document.querySelector('#tiaozhuan')
    if (tiaozhuan) {
      tiaozhuan.click()
      console.log('[4hu脚本] 已自动点击 #tiaozhuan')
    }
  }

  /**
   * 设置自动点击观察器
   */
  setupAutoClickObserver() {
    // 清理旧的订阅
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }

    // 使用 UnifiedDOMWatcher 统一管理
    if (window.UnifiedDOMWatcher) {
      this._unsubscribe = window.UnifiedDOMWatcher.subscribe(
        (mutations) => {
          this._processAutoClickMutations(mutations)
        },
        {
          priority: window.UnifiedDOMWatcher.Priority.NORMAL,
          filter: (mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0,
        }
      )
      console.log('[4hu脚本] 使用 UnifiedDOMWatcher 监听自动点击')
    } else {
      // 降级：使用独立 MutationObserver
      this.observer = new MutationObserver((mutations) => {
        this._processAutoClickMutations(mutations)
      })

      this.observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true,
      })
      console.log('[4hu脚本] 使用独立 MutationObserver 监听自动点击')
    }
  }

  /**
   * 处理自动点击的 DOM 变化
   */
  _processAutoClickMutations(mutations) {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.id === 'tiaozhuan') {
            node.click()
            console.log('[4hu脚本] 已自动点击动态添加的 #tiaozhuan')
          }
          const tiaozhuanInChildren = node.querySelectorAll?.('#tiaozhuan')
          tiaozhuanInChildren?.forEach((el) => {
            el.click()
            console.log('[4hu脚本] 已自动点击子节点中的 #tiaozhuan')
          })
        }
      })
    })
  }

  /**
   * 清理资源
   */
  cleanup() {
    console.log('[4hu脚本] 清理状态...')
    if (this._unsubscribe) {
      this._unsubscribe()
      this._unsubscribe = null
    }
    if (this.observer) {
      this.observer.disconnect()
      this.observer = null
    }
    window.Hu4Script.isInitialized = false
  }

  /**
   * 导出配置
   */
  exportConfig() {
    return {
      ...super.exportConfig(),
      hasObserver: !!this.observer,
    }
  }
}

// ========== 全局命名空间 ==========
if (!window.Hu4Script) {
  window.Hu4Script = { isInitialized: false }
}

// ========== 配置导出 ==========
window.Hu4ScriptConfig = {
  DEFAULT_HIDE_SELECTORS: ['.kkm-content'],
  BLOCKED_DOMAINS: [],
}

// ========== 实例化并初始化 ==========
const hu4Site = new Hu4Site()

// 创建消息处理器（扩展父类）
hu4Site.createMessageHandler({
  UPDATE_KEYWORDS: (message) => {
    console.log('[4hu脚本] 关键词更新:', message.keywords)
    return { success: true, message: '关键词已更新' }
  },
})

// 启动初始化
async function init() {
  if (window.Hu4Script.isInitialized) {
    console.log('[4hu脚本] 已经初始化，跳过重复初始化')
    return
  }

  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init)
    } else {
      setTimeout(init, 50)
    }
    return
  }

  window.Hu4Script.isInitialized = true
  await hu4Site.init()

  // 标记 content script 已就绪
  if (window.ContentBridge) {
    ContentBridge.markReady()
  }
}

// 启动
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
