// Content script for aliyundrive.com (阿里云盘)
// 使用公共模块重构

'use strict'

import { createScriptGuard } from './utils/script-guard.js'
import { createStyleInjector } from './utils/style-injector.js'

// 防重复加载
const guard = createScriptGuard('Aliyun')
if (guard.check()) {
  throw new Error('脚本已加载')
}

const STYLE_TAG_ID = 'aliyun-fix-style'
const styleInjector = createStyleInjector(STYLE_TAG_ID)

const styles = `
/* 固定保存按钮 */
[class*="SaveButton"],
[class*="save-btn"],
button[class*="save"] {
  position: sticky !important;
  bottom: 20px !important;
  z-index: 1000 !important;
}
`

let lastExecutionTime = 0
const DELAY = 500

function fixSaveButton() {
  if (lastExecutionTime + DELAY > Date.now()) {
    return
  }
  lastExecutionTime = Date.now()

  // 查找保存按钮并确保可见
  const saveButtons = document.querySelectorAll('button[class*="save"], [class*="SaveButton"]')

  saveButtons.forEach((btn) => {
    // 添加防御性检查
    if (typeof DOMUtils !== 'undefined' && DOMUtils.isElementInViewport) {
      if (!DOMUtils.isElementInViewport(btn)) {
        // 可以添加额外的处理逻辑
      }
    }
  })
}

function injectStyles() {
  styleInjector.inject(styles)
}

let observer = null

function init() {
  // 确保 document.body 存在
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init)
    } else {
      setTimeout(init, 50)
    }
    return
  }

  injectStyles()

  // 监听 DOM 变化（使用 UnifiedDOMWatcher）
  if (window.UnifiedDOMWatcher) {
    window.UnifiedDOMWatcher.subscribe(fixSaveButton, {
      priority: window.UnifiedDOMWatcher.Priority.NORMAL,
      filter: (mutation) => mutation.type === 'childList' || mutation.type === 'attributes',
    })
    console.log('[阿里云盘] 使用 UnifiedDOMWatcher 监听 DOM 变化')
  } else {
    // 降级：使用独立 MutationObserver
    observer = new MutationObserver(fixSaveButton)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })
    console.log('[阿里云盘] 使用独立 MutationObserver 监听 DOM 变化')
  }

  guard.markInitialized()
  console.log('[阿里云盘] 保存按钮固定脚本已加载')
}

// 清理函数
function cleanup() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

// 页面卸载时清理
function onBeforeUnload() {
  cleanup()
}
window.addEventListener('beforeunload', onBeforeUnload)

window.AliyunDestroy = () => {
  cleanup()
  styleInjector.remove()
  window.removeEventListener('beforeunload', onBeforeUnload)
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init)
} else {
  setTimeout(init, 1000)
}
