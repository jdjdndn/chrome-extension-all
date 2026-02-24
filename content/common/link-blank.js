// 通用脚本：非同源链接新页面打开
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict';

if (window.LinkBlankLoaded) {
  console.log('[通用脚本] 链接新页面打开已加载，跳过');
} else {
  window.LinkBlankLoaded = true;

  const NO_TARGET_ATTR = 'yc-no-target';
  const PROCESSED_ATTR = 'yc-blank-processed';

  // 节流函数
  function throttle(func, delay) {
    let lastCall = 0;
    return function (...args) {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        return func.apply(this, args);
      }
    };
  }

  function isCrossOrigin(anchor) {
    try {
      const anchorOrigin = new URL(anchor.href, window.location.href).origin;
      return anchorOrigin !== window.location.origin;
    } catch {
      return false;
    }
  }

  function shouldSkip(anchor) {
    // 已设置 target
    if (anchor.target === '_blank') return true;
    // 标记为不处理
    if (anchor.hasAttribute(NO_TARGET_ATTR)) return true;
    // 没有有效 href
    if (!anchor.href || anchor.href.startsWith('javascript:')) return true;
    // 同源链接
    if (!isCrossOrigin(anchor)) return true;
    return false;
  }

  function processAnchors(anchors) {
    anchors.forEach(anchor => {
      if (anchor.hasAttribute(PROCESSED_ATTR)) return;
      anchor.setAttribute(PROCESSED_ATTR, 'true');

      if (shouldSkip(anchor)) return;

      // 检查父级是否有多个链接（导航菜单）
      let parent = anchor.parentElement;
      let hasMultipleLinks = false;
      while (parent && parent !== document.body) {
        const linkCount = parent.querySelectorAll(`a[href]:not([${PROCESSED_ATTR}])`).length;
        if (linkCount > 1) {
          hasMultipleLinks = true;
          break;
        }
        parent = parent.parentElement;
      }

      if (hasMultipleLinks) {
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
      }
    });
  }

  const throttledProcess = throttle(() => {
    const anchors = document.querySelectorAll(`a[href]:not([${PROCESSED_ATTR}]):not([target="_blank"]):not([${NO_TARGET_ATTR}])`);
    processAnchors(anchors);
  }, 300);

  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver(throttledProcess);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // 初始执行
  throttledProcess();

  console.log('[通用脚本] 链接新页面打开已加载');
}
