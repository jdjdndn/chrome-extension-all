// Content script for ymmfa.com (工控人家园)
// 使用公共模块重构

'use strict'

import { createScriptGuard } from './utils/script-guard.js'

// 防重复加载
const guard = createScriptGuard('Gongkong')
if (guard.check()) {
  throw new Error('脚本已加载')
}

let observer = null
let lastExecutionTime = 0
const DELAY = 500

function autoFillInput() {
  if (lastExecutionTime + DELAY > Date.now()) return
  lastExecutionTime = Date.now()

  // 查找 font 标签后紧跟的 input
  const fontElements = document.querySelectorAll('font')

  fontElements.forEach((font) => {
    const input = font.nextSibling
    if (input && input.nodeName === 'INPUT') {
      const value = font.textContent.trim()
      if (value && input.value !== value) {
        input.value = value
        console.log('[工控人家园] 自动填充:', value)
      }
    }
  })
}

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

  // 监听 DOM 变化
  observer = new MutationObserver(autoFillInput)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true })

  // 初始执行
  autoFillInput()

  guard.markInitialized()
  console.log('[工控人家园] 自动填充脚本已加载')
}

// 清理函数
function cleanup() {
  if (observer) {
    observer.disconnect()
    observer = null
  }
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup)

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
