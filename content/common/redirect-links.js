// 通用脚本：替换重定向链接为真实链接
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict';

if (window.RedirectLinksLoaded) {
  console.log('[通用脚本] 重定向链接替换已加载，跳过');
} else {
  window.RedirectLinksLoaded = true;

  // 需要新窗口打开的链接模式
  const LINK_PATTERNS = [
    "view_video.php?viewkey=",
    /zhihu\.com\/question\/.*?\/answer\/.*?/,
    /douyin\.com\/user\/*/,
    "novelquickapp.com/detail?series_id="
  ];

  const YC_ATTR = 'yc-redirect-changed';
  let lastExecutionTime = 0;
  const DELAY = 500;

  function processLinks() {
    if (lastExecutionTime + DELAY > Date.now()) return;
    lastExecutionTime = Date.now();

    const links = document.querySelectorAll(`a[href]:not([${YC_ATTR}])`);
    // 注意：这里不能排除已有 target 的元素，因为需要提取重定向链接的真实 URL

    links.forEach(link => {
      link.setAttribute(YC_ATTR, 'true');
      if (!link || !link.host) return;

      // 匹配特定链接模式，设置新窗口打开
      const shouldOpenBlank = LINK_PATTERNS.some(pattern => {
        if (typeof pattern === 'string') return link.href.includes(pattern);
        if (pattern instanceof RegExp) return pattern.test(link.href);
        return false;
      });

      if (shouldOpenBlank) {
        link.target = '_blank';
      }

      // 尝试提取真实链接
      try {
        const linkUrl = decodeURIComponent(link.search);
        const urlMatch = linkUrl.match(/url=([^&]*)/);
        if (urlMatch && urlMatch[1]) {
          const realUrl = decodeURIComponent(urlMatch[1]);
          if (realUrl.startsWith('http')) {
            link.href = realUrl;
          }
        }
      } catch (e) {
        // 忽略解析错误
      }
    });
  }

  // 使用 MutationObserver 监听 DOM 变化
  const observer = new MutationObserver(processLinks);
  observer.observe(document.body, { childList: true, subtree: true });

  // 初始执行
  processLinks();

  console.log('[通用脚本] 重定向链接替换已加载');
}
