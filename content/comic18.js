// Content script for 18comic.vip (美丽新世界)
// 使用公共模块重构

'use strict'

import { createScriptGuard } from './utils/script-guard.js'

// 防重复加载
const guard = createScriptGuard('Comic18')
if (guard.check()) {
  throw new Error('脚本已加载')
}

function handleClick(event) {
  const elements = [...document.elementsFromPoint(event.clientX, event.clientY)]
  const link = elements.find((el) => el.tagName === 'A')

  if (!link) return

  // event.preventDefault();
  // event.stopPropagation();
  // event.stopImmediatePropagation();

  // // 在新标签页打开链接
  // window.open(link.href, '_blank');

  console.log('[18comic] 链接已在新标签页打开:', link.href)
}

function init() {
  document.addEventListener('click', handleClick, true)

  guard.markInitialized()
  console.log('[18comic] 脚本已加载')
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
