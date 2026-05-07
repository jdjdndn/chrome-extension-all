// 通用脚本：非同源链接新页面打开
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict'

// 使用 ScriptLoader 管理依赖
if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'link-blank',
    dependencies: ['DOMUtils'],
    onReady: () => initLinkBlank(),
  })
} else {
  // 降级处理：ScriptLoader 未加载时直接初始化
  initLinkBlank()
}

function initLinkBlank() {
  if (window.LinkBlankLoaded) {
    console.log('[通用脚本] 链接新页面打开已加载，跳过')
    return
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('link-blank')) {
    console.log('[通用脚本] 链接新页面打开已禁用')
    return
  }

  window.LinkBlankLoaded = true

  const NO_TARGET_ATTR = 'yc-no-target'
  const PROCESSED_ATTR = 'yc-blank-processed'

  function isCrossOrigin(anchor) {
    try {
      const anchorOrigin = new URL(anchor.href, window.location.href).origin
      return anchorOrigin !== window.location.origin
    } catch {
      return false
    }
  }

  function shouldSkip(anchor) {
    // 已设置 target
    if (anchor.target === '_blank') return true
    // 标记为不处理
    if (anchor.hasAttribute(NO_TARGET_ATTR)) return true
    // 没有有效 href
    if (!anchor.href || anchor.href.startsWith('javascript:')) return true
    // 同源链接
    if (!isCrossOrigin(anchor)) return true
    return false
  }

  function processAnchors(anchors) {
    anchors.forEach((anchor) => {
      if (anchor.hasAttribute(PROCESSED_ATTR)) return
      anchor.setAttribute(PROCESSED_ATTR, 'true')

      if (shouldSkip(anchor)) return

      // 检查父级是否有多个链接（导航菜单）
      let parent = anchor.parentElement
      let hasMultipleLinks = false
      while (parent && parent !== document.body) {
        const linkCount = parent.querySelectorAll(`a[href]:not([${PROCESSED_ATTR}])`).length
        if (linkCount > 1) {
          hasMultipleLinks = true
          break
        }
        parent = parent.parentElement
      }

      if (hasMultipleLinks) {
        anchor.target = '_blank'
        anchor.rel = 'noopener noreferrer'
      }
    })
  }

  // 初始化函数：确保 document.body 存在后执行
  function init() {
    if (!document.body) {
      // DOM 未准备好，等待 DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
      } else {
        // 极端情况：readyState 不是 loading 但 body 也不存在
        setTimeout(init, 50)
      }
      return
    }

    // 使用 DOMUtils.throttle 进行节流处理（在 init 内部调用确保 DOMUtils 已加载）
    const throttledProcess = DOMUtils.throttle

    const throttledHandler = throttledProcess(() => {
      const anchors = document.querySelectorAll(
        `a[href]:not([${PROCESSED_ATTR}]):not([target="_blank"]):not([${NO_TARGET_ATTR}])`
      )
      processAnchors(anchors)
    }, 300)

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(throttledHandler)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    // 存储 observer 以便清理
    window._ycLinkBlankObserver = observer

    // 初始执行
    throttledHandler()

    console.log('[通用脚本] 链接新页面打开已加载')
  }

  // 清理函数
  function cleanup() {
    if (window._ycLinkBlankObserver) {
      window._ycLinkBlankObserver.disconnect()
      window._ycLinkBlankObserver = null
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup)

  // 立即尝试初始化
  init()
}
