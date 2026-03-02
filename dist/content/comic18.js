// Content script for 18comic.vip (美丽新世界)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.Comic18Script) {
  window.Comic18Script = { isInitialized: false };
}

function handleClick(event) {
  const elements = [...document.elementsFromPoint(event.clientX, event.clientY)];
  const link = elements.find(el => el.tagName === 'A');

  if (!link) return;

  // event.preventDefault();
  // event.stopPropagation();
  // event.stopImmediatePropagation();

  // // 在新标签页打开链接
  // window.open(link.href, '_blank');

  console.log('[18comic] 链接已在新标签页打开:', link.href);
}

function init() {
  if (window.Comic18Script.isInitialized) return;
  window.Comic18Script.isInitialized = true;

  document.addEventListener('click', handleClick, true);

  console.log('[18comic] 脚本已加载');
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
