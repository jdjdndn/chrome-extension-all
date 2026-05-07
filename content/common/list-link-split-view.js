// 通用脚本：页面列表链接拆分视图打开
// @match *://*/*
// 功能：自动发现页面列表结构，Alt+点击链接在侧边栏/拆分视图中打开

'use strict'

if (window.ListLinkSplitViewLoaded) {
  console.log('[列表链接拆分视图] 已加载，跳过')
} else if (!window.getScriptSwitch || !window.getScriptSwitch('list-link-split-view')) {
  console.log('[列表链接拆分视图] 已禁用')
} else {
  window.ListLinkSplitViewLoaded = true

  /**
   * 列表链接拆分视图管理器
   * 自动发现页面列表结构，为列表中的链接添加 Alt+点击侧边栏打开功能
   */
  class ListLinkSplitView {
    constructor() {
      this.processedLinks = new WeakSet()
      this.listPatterns = this.getListPatterns()
      this.init()
    }

    /**
     * 获取列表模式配置
     * 用于识别不同网站的列表结构
     */
    getListPatterns() {
      return {
        // 掘金 - 文章列表
        'juejin.cn': {
          // 列表容器选择器
          listContainer: '.entry-list-container, .timeline-entry-list',
          // 列表项选择器
          listItem: '.entry-item, [class*="item"]',
          // 链接选择器（列表项内的链接）
          linkInItem: '.title-row a, .abstract a, a[href*="/post/"]',
          // 排除的链接（导航、广告等）
          excludeLinks: 'nav a, .nav a, header a, footer a, .sidebar a, [class*="nav"] a',
        },
        // 知乎 - 回答/文章列表
        'zhihu.com': {
          listContainer: '.List-item, .ContentItem',
          listItem: '.List-item, .ContentItem',
          linkInItem: 'a[href*="/question/"], a[href*="/answer/"], a[href*="/p/"]',
          excludeLinks: '.GlobalBar a, .AppHeader a',
        },
        // GitHub - 仓库列表、Issue列表
        'github.com': {
          listContainer: '.repo-list, .issues-list, [data-testid="issue-results"]',
          listItem: '.repo-list-item, .issue-row, [data-testid="issue-row"]',
          linkInItem: 'a[href*="/"], h3 a, a.Link--primary',
          excludeLinks: 'header a, nav a, .Header a',
        },
        // B站 - 视频列表
        'bilibili.com': {
          listContainer: '.video-list, .feed-card, [class*="video-list"]',
          listItem: '.video-item, .feed-card, [class*="video-item"]',
          linkInItem: 'a[href*="/video/"], .title a',
          excludeLinks: 'nav a, header a, .nav a',
        },
        // 抖音 - 视频列表
        'douyin.com': {
          listContainer: '[class*="video-list"], [class*="feed"]',
          listItem: '[class*="video-item"], [class*="feed-item"]',
          linkInItem: 'a[href*="/video/"]',
          excludeLinks: 'nav a, header a',
        },
        // 通用配置 - 作为后备
        _default: {
          // 通过启发式方法自动发现
        },
      }
    }

    init() {
      // 监听点击事件
      document.addEventListener('click', (e) => this.handleClick(e), true)

      // 监听键盘事件，显示提示
      document.addEventListener('keydown', (e) => this.handleKeyDown(e))
      document.addEventListener('keyup', (e) => this.handleKeyUp(e))

      // 窗口失焦时清除状态
      window.addEventListener('blur', () => this.handleBlur())

      console.log('[列表链接拆分视图] 初始化完成')
    }

    /**
     * 处理点击事件
     */
    handleClick(e) {
      // 检查是否按住 Alt 键
      if (!e.altKey) return

      // 获取点击的链接
      const link = e.target.closest('a[href]')
      if (!link) return

      console.log('[列表链接拆分视图] Alt+点击检测到，链接:', link.href)

      // 检查是否是列表中的链接
      const isList = this.isListLink(link)
      console.log('[列表链接拆分视图] 是否列表链接:', isList)
      if (!isList) return

      // 阻止默认行为
      e.preventDefault()
      e.stopPropagation()

      // 立即清除提示样式（但不改变 altPressed 状态，让 keyup 处理）
      this.hideAltHint()

      // 在侧边栏打开
      this.openInSidePanel(link.href)

      console.log('[列表链接拆分视图] Alt+点击链接，在侧边栏打开:', link.href)
    }

    /**
     * 判断链接是否在列表结构中
     */
    isListLink(link) {
      const hostname = window.location.hostname

      // 获取当前网站的配置
      let config = null
      for (const [domain, pattern] of Object.entries(this.listPatterns)) {
        if (domain !== '_default' && hostname.includes(domain)) {
          config = pattern
          break
        }
      }

      // 如果有特定配置，使用配置检测
      if (config && config.listItem) {
        // 检查链接是否在排除列表中
        if (config.excludeLinks && link.matches(config.excludeLinks)) {
          return false
        }

        // 检查链接是否在列表项中
        const listItem = link.closest(config.listItem)
        if (listItem) {
          // 检查是否匹配预期的链接选择器
          if (config.linkInItem && link.matches(config.linkInItem)) {
            return true
          }
          // 如果没有指定链接选择器，只要是列表项中的链接就算
          return true
        }

        return false
      }

      // 使用启发式方法检测
      return this.heuristicListDetection(link)
    }

    /**
     * 启发式列表检测
     * 当没有特定配置时，自动检测列表结构
     */
    heuristicListDetection(link) {
      // 排除导航、页眉、页脚、侧边栏中的链接
      const excludePatterns = [
        'nav',
        'header',
        'footer',
        'aside',
        'sidebar',
        '[role="navigation"]',
        '[role="banner"]',
        '[role="complementary"]',
        '.nav',
        '.header',
        '.footer',
        '.sidebar',
        '.menu',
        '#nav',
        '#header',
        '#footer',
        '#sidebar',
      ]

      for (const pattern of excludePatterns) {
        if (link.closest(pattern)) {
          console.log('[列表链接拆分视图] 链接在排除区域:', pattern)
          return false
        }
      }

      // 检查链接是否在重复结构中（列表项的特征）
      const parent = link.parentElement
      if (!parent) return true // 无法判断时默认允许

      // 向上查找可能的列表项容器
      let candidate = parent
      let depth = 0
      const maxDepth = 5

      while (candidate && depth < maxDepth) {
        // 检查候选元素是否像列表项
        if (this.looksLikeListItem(candidate, link)) {
          return true
        }

        candidate = candidate.parentElement
        depth++
      }

      // 默认允许：如果没有明确排除，就允许Alt+点击
      return true
    }

    /**
     * 判断元素是否像列表项
     */
    looksLikeListItem(element, link) {
      // 获取元素的类名
      const className = element.className || ''
      const id = element.id || ''
      const tagName = element.tagName.toLowerCase()

      // 常见的列表项类名模式
      const listItemPatterns = [
        /\bitem\b/i,
        /\blist-item\b/i,
        /\blistitem\b/i,
        /\bentry\b/i,
        /\bentry-item\b/i,
        /\bcard\b/i,
        /\bcard-item\b/i,
        /\brow\b/i,
        /\brow-item\b/i,
        /\bcell\b/i,
        /\bpost\b/i,
        /\bpost-item\b/i,
        /\barticle\b/i,
        /\barticle-item\b/i,
        /\bvideo\b/i,
        /\bvideo-item\b/i,
        /\bfeed\b/i,
        /\bfeed-item\b/i,
        /\bresult\b/i,
        /\bresult-item\b/i,
        /\bcontent\b/i,
        /\bcontent-item\b/i,
        /\blist\b/i,
      ]

      // 检查类名或ID是否匹配列表项模式
      const combinedStr = `${className} ${id}`
      for (const pattern of listItemPatterns) {
        if (pattern.test(combinedStr)) {
          return true // 放宽条件：不再要求兄弟元素
        }
      }

      // 检查是否是 li 元素
      if (tagName === 'li') {
        return true
      }

      // 检查是否在 ul/ol 内
      const listParent = element.closest('ul, ol, [role="list"]')
      if (listParent) {
        return true
      }

      // 新增：检查链接是否在重复结构中（有相似兄弟元素）
      const siblings = this.getSimilarSiblings(element)
      if (siblings.length >= 1) {
        return true
      }

      return false
    }

    /**
     * 获取相似的兄弟元素
     */
    getSimilarSiblings(element) {
      const parent = element.parentElement
      if (!parent) return []

      const tagName = element.tagName
      const className = element.className

      // 查找相同标签和相似类名的兄弟元素
      const siblings = Array.from(parent.children).filter((child) => {
        if (child === element) return false
        if (child.tagName !== tagName) return false

        // 检查类名相似度
        if (className && child.className) {
          const commonClasses = this.getCommonClasses(className, child.className)
          return commonClasses.length > 0
        }

        return true
      })

      return siblings
    }

    /**
     * 获取两个类名字符串的公共类名
     */
    getCommonClasses(class1, class2) {
      const classes1 = class1.split(/\s+/).filter((c) => c && !/^\d/.test(c))
      const classes2 = new Set(class2.split(/\s+/).filter((c) => c && !/^\d/.test(c)))
      return classes1.filter((c) => classes2.has(c))
    }

    /**
     * 在侧边栏/拆分视图中打开链接
     */
    openInSidePanel(url) {
      console.log('[列表链接拆分视图] 准备打开侧边栏:', url)
      console.log('[列表链接拆分视图] chrome.runtime:', typeof chrome?.runtime)

      // 直接使用原生 Chrome API
      try {
        const message = {
          type: 'OPEN_IN_SIDE_PANEL',
          url: url,
          timestamp: Date.now(),
          source: 'list-link-split-view',
        }
        console.log('[列表链接拆分视图] 发送消息:', message)

        chrome.runtime.sendMessage(message, (response) => {
          const lastError = chrome.runtime.lastError
          console.log('[列表链接拆分视图] 收到响应:', response, 'lastError:', lastError)
          if (lastError) {
            console.error('[列表链接拆分视图] lastError:', lastError)
          }
          if (lastError || !response || !response.success) {
            console.log('[列表链接拆分视图] 侧边栏打开失败，回退到新标签页')
            window.open(url, '_blank')
          }
        })
      } catch (error) {
        console.error('[列表链接拆分视图] 发送消息异常:', error)
        window.open(url, '_blank')
      }
    }

    /**
     * 处理键盘按下事件
     * 显示 Alt 键提示
     */
    handleKeyDown(e) {
      if (e.key === 'Alt' && !this.altPressed) {
        this.altPressed = true
        this.showAltHint()
      }
    }

    /**
     * 处理键盘释放事件
     */
    handleKeyUp(e) {
      if (e.key === 'Alt') {
        this.altPressed = false
        this.hideAltHint()
      }
    }

    /**
     * 处理失焦事件（窗口失焦时清除状态）
     */
    handleBlur() {
      if (this.altPressed) {
        this.altPressed = false
        this.hideAltHint()
      }
    }

    /**
     * 显示 Alt 键提示
     */
    showAltHint() {
      // 为列表中的链接添加提示样式
      const links = document.querySelectorAll('a[href]')
      links.forEach((link) => {
        if (this.isListLink(link)) {
          link.dataset.altSplitView = 'true'
        }
      })

      // 注入提示样式
      if (!document.getElementById('list-link-split-view-hint-style')) {
        const style = document.createElement('style')
        style.id = 'list-link-split-view-hint-style'
        style.textContent = `
          a[data-alt-split-view="true"] {
            outline: 2px dashed #667eea !important;
            outline-offset: 2px;
          }
          a[data-alt-split-view="true"]:hover::after {
            content: "Alt+点击 → 侧边栏打开";
            position: absolute;
            top: -24px;
            left: 50%;
            transform: translateX(-50%);
            background: #667eea;
            color: white;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 11px;
            white-space: nowrap;
            z-index: 999999;
            pointer-events: none;
          }
        `
        document.head.appendChild(style)
      }
    }

    /**
     * 隐藏 Alt 键提示
     */
    hideAltHint() {
      // 移除提示样式
      const links = document.querySelectorAll('a[data-alt-split-view]')
      links.forEach((link) => {
        delete link.dataset.altSplitView
      })
    }
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.listLinkSplitView = new ListLinkSplitView()
    })
  } else {
    window.listLinkSplitView = new ListLinkSplitView()
  }
}
