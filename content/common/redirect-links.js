// 通用脚本：替换重定向链接为真实链接
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict'

// 配置常量
const REDIRECT_LINKS_CONFIG = {
  // 需要新窗口打开的链接模式
  LINK_PATTERNS: [
    'view_video.php?viewkey=',
    /zhihu\.com\/question\/.*?\/answer\/.*?/,
    /douyin\.com\/user\/.*/,
    'novelquickapp.com/detail?series_id=',
    'link.zhihu.com/?target=',
    /bilibili\.com\/video\/BV/,
    'weibo.com/n/',
    'tieba.baidu.com/p/',
    /xhslink\.com\//,
  ],
  // 目标URL参数名
  TARGET_PARAMS: [
    'target',
    'url',
    'to',
    'u',
    'link',
    'href',
    'q',
    'redirect',
    'goto',
    'jump',
    'next',
    'dest',
    'out',
    'return',
    'back',
  ],
  // Hash中的参数名
  HASH_PARAMS: ['url', 'target', 'link', 'u'],
  // 跳过替换的域名（白名单：这些站点的重定向不应被替换）
  SKIP_DOMAINS: ['github.com', 'google.com', 'google.com.hk', 'accounts.google.com'],
  // 属性标记
  PROCESSED_ATTR: 'yc-redirect-changed',
}

// 使用 ScriptLoader 管理依赖
if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'redirect-links',
    dependencies: ['DOMUtils'],
    onReady: () => initRedirectLinks(),
  })
} else {
  // 降级处理：ScriptLoader 未加载时直接初始化
  initRedirectLinks()
}

function initRedirectLinks() {
  // Logger（优先使用 LoggerUtils，降级到 console）
  const logger = window.LoggerUtils
    ? window.LoggerUtils.createLogger('redirect-links')
    : {
        debug: () => {},
        info: (...a) => console.log('[redirect-links]', ...a),
        warn: (...a) => console.warn('[redirect-links]', ...a),
        error: (...a) => console.error('[redirect-links]', ...a),
      }

  if (window.RedirectLinksLoaded) {
    logger.info('重定向链接替换已加载，跳过')
    return
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('redirect-links')) {
    logger.info('重定向链接替换已禁用')
    return
  }

  window.RedirectLinksLoaded = true

  const { LINK_PATTERNS, TARGET_PARAMS, HASH_PARAMS, SKIP_DOMAINS, PROCESSED_ATTR } =
    REDIRECT_LINKS_CONFIG

  /**
   * 解码URL参数值（支持多次嵌套编码）
   */
  function decodeUrlValue(value) {
    let decoded = value
    for (let i = 0; i < 3; i++) {
      const prev = decoded
      decoded = decodeURIComponent(decoded)
      if (prev === decoded) {break}
    }
    return decoded
  }

  /**
   * 从解码后的字符串中提取URL
   */
  function extractUrlFromString(decoded) {
    // 完整URL
    if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
      return decoded
    }

    // 处理包含 // 的格式（如 https%3A//example.com）
    const slashIndex = decoded.indexOf('//')
    if (slashIndex >= 0) {
      const secondSlashIndex = decoded.indexOf('//', slashIndex + 2)
      return decoded.substring(secondSlashIndex > 0 ? secondSlashIndex : slashIndex)
    }

    // 纯域名格式
    if (decoded.includes('.') && !decoded.includes('/')) {
      return 'https://' + decoded
    }

    return null
  }

  /**
   * 从 URL 中提取真实目标链接
   */
  function extractTargetUrl(href) {
    if (!href) {return null}

    try {
      const urlObj = new URL(href)

      // 从查询参数提取
      for (const param of TARGET_PARAMS) {
        const value = urlObj.searchParams.get(param)
        if (value) {
          try {
            const decoded = decodeUrlValue(value)
            const url = extractUrlFromString(decoded)
            if (url) {return url}
          } catch (e) {
            /* 解码失败，继续 */
          }
        }
      }

      // 从 hash 提取
      const hash = urlObj.hash
      if (hash) {
        const hashPattern = new RegExp(`[/?&](${HASH_PARAMS.join('|')})=([^&]+)`)
        const hashMatch = hash.match(hashPattern)
        if (hashMatch) {
          try {
            return decodeURIComponent(hashMatch[2])
          } catch (e) {
            /* 解码失败 */
          }
        }
      }

      return null
    } catch (e) {
      return null
    }
  }

  function processLinks() {
    const links = document.querySelectorAll(`a[href]:not([${PROCESSED_ATTR}])`)
    let replacedCount = 0

    links.forEach((link) => {
      link.setAttribute(PROCESSED_ATTR, 'true')
      if (!link || !link.host) {return}

      // 白名单域名跳过替换
      if (
        SKIP_DOMAINS.some(
          (domain) => link.hostname === domain || link.hostname.endsWith('.' + domain)
        )
      )
        {return}

      // 匹配特定链接模式，设置新窗口打开
      const shouldOpenBlank = LINK_PATTERNS.some((pattern) => {
        if (typeof pattern === 'string') {return link.href.includes(pattern)}
        if (pattern instanceof RegExp) {return pattern.test(link.href)}
        return false
      })

      if (shouldOpenBlank) {
        link.target = '_blank'
      }

      // 尝试提取真实链接并替换
      const originalHref = link.href
      const realUrl = extractTargetUrl(originalHref)
      if (realUrl && realUrl !== originalHref) {
        link.href = realUrl
        replacedCount++
        logger.debug(
          '替换重定向链接:',
          originalHref.substring(0, 60) + '...',
          '->',
          realUrl.substring(0, 60) + '...'
        )
      }
    })

    if (replacedCount > 0) {
      logger.info(`已替换 ${replacedCount} 个重定向链接`)
      // 持久化替换计数
      try {
        const key = 'redirectLinksStats'
        chrome.storage.local.get(key, (result) => {
          const prev = result[key] || { total: 0, sessions: 0 }
          chrome.storage.local.set({
            [key]: { total: prev.total + replacedCount, sessions: prev.sessions + 1 },
          })
        })
      } catch (e) {
        /* 非扩展环境或存储不可用 */
      }
    }
  }

  // 初始化函数：确保 document.body 存在后执行
  function init() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
      } else {
        setTimeout(init, 50)
      }
      return
    }

    const throttledProcessLinks = DOMUtils.throttle(processLinks, 500)

    const observer = new MutationObserver(throttledProcessLinks)
    observer.observe(document.body, { childList: true, subtree: true })

    window._ycRedirectLinksObserver = observer
    throttledProcessLinks()

    logger.info('已加载')
  }

  // 清理函数
  function cleanup() {
    if (window._ycRedirectLinksObserver) {
      window._ycRedirectLinksObserver.disconnect()
      window._ycRedirectLinksObserver = null
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup)

  // 导出纯函数供测试使用
  window.RedirectLinksUtils = { decodeUrlValue, extractUrlFromString, extractTargetUrl }

  // 立即尝试初始化
  init()
}
