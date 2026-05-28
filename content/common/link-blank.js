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
    if (anchor.target === '_blank') {
      return true
    }
    if (anchor.hasAttribute(NO_TARGET_ATTR)) {
      return true
    }
    if (!anchor.href || anchor.href.startsWith('javascript:')) {
      return true
    }
    if (!isCrossOrigin(anchor)) {
      return true
    }
    return false
  }

  function processAnchors(anchors) {
    anchors.forEach((anchor) => {
      if (anchor.hasAttribute(PROCESSED_ATTR)) {
        return
      }
      anchor.setAttribute(PROCESSED_ATTR, 'true')

      if (shouldSkip(anchor)) {
        return
      }

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

  let observer = null
  let active = false

  function enable() {
    if (active) {
      return
    }
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enable, { once: true })
      } else {
        setTimeout(enable, 50)
      }
      return
    }
    const throttledHandler = DOMUtils.throttle(() => {
      const anchors = document.querySelectorAll(
        `a[href]:not([${PROCESSED_ATTR}]):not([target="_blank"]):not([${NO_TARGET_ATTR}])`
      )
      processAnchors(anchors)
    }, 300)

    observer = new MutationObserver(throttledHandler)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    window._ycLinkBlankObserver = observer
    throttledHandler()
    active = true
    console.log('[通用脚本] 链接新页面打开已加载')
  }

  function disable() {
    if (!active) {
      return
    }
    if (observer) {
      observer.disconnect()
      observer = null
    }
    window._ycLinkBlankObserver = null
    active = false
    console.log('[通用脚本] 链接新页面打开已禁用')
  }

  window.addEventListener('beforeunload', disable)

  if (!window.getScriptSwitch || !window.getScriptSwitch('link-blank')) {
    console.log('[通用脚本] 链接新页面打开已禁用')
  } else {
    enable()
  }

  const onStorageChange = (changes, area) => {
    if (area !== 'local' || !changes.scriptSwitches) {
      return
    }
    const next = changes.scriptSwitches.newValue || {}
    if (next['link-blank'] === false) {
      disable()
    } else {
      enable()
    }
  }
  try {
    chrome.storage.onChanged.addListener(onStorageChange)
  } catch {}

  window.LinkBlankDestroy = () => {
    disable()
    window.removeEventListener('beforeunload', disable)
    try {
      chrome.storage.onChanged.removeListener(onStorageChange)
    } catch {}
    window.LinkBlankLoaded = false
  }
}
