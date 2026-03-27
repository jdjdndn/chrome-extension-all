// 通用脚本：替换重定向链接为真实链接
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict';

// 使用 ScriptLoader 管理依赖
if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'redirect-links',
    dependencies: ['DOMUtils'],
    onReady: () => initRedirectLinks()
  });
} else {
  // 降级处理：ScriptLoader 未加载时直接初始化
  initRedirectLinks();
}

function initRedirectLinks() {
  if (window.RedirectLinksLoaded) {
    console.log('[通用脚本] 重定向链接替换已加载，跳过');
    return;
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('redirect-links')) {
    console.log('[通用脚本] 重定向链接替换已禁用');
    return;
  }

  window.RedirectLinksLoaded = true;

  // 需要新窗口打开的链接模式
  const LINK_PATTERNS = [
    "view_video.php?viewkey=",
    /zhihu\.com\/question\/.*?\/answer\/.*?/,
    /douyin\.com\/user\/.*/,
    "novelquickapp.com/detail?series_id="
  ];

  const YC_ATTR = 'yc-redirect-changed';

  // 从 URL 中提取真实目标链接
  function extractTargetUrl(href) {
    if (!href) return null;

    try {
      const urlObj = new URL(href);
      const searchParams = urlObj.searchParams;

      // 常见的参数名
      const targetParams = ['target', 'url', 'to', 'u', 'link', 'href', 'q', 'redirect', 'goto', 'jump', 'next'];

      for (const param of targetParams) {
        const value = searchParams.get(param);
        if (value) {
          try {
            // URL 解码（可能需要解码多次）
            let decoded = value;
            for (let i = 0; i < 3; i++) {
              const prev = decoded;
              decoded = decodeURIComponent(decoded);
              if (prev === decoded) break;
            }

            // 如果解码后的值是有效的 URL，直接返回
            if (decoded.startsWith('http://') || decoded.startsWith('https://')) {
              return decoded;
            }

            // 处理类似 https%3A//chrome.google.com 这种格式
            // 方法：找第二个 // 及后面的内容
            const slashIndex = decoded.indexOf('//');
            if (slashIndex >= 0) {
              // 检查是否有第二个 //
              const secondSlashIndex = decoded.indexOf('//', slashIndex + 2);
              if (secondSlashIndex > 0) {
                // 有第二个 //，说明格式类似 "xxx://https://yyy" 或 "https%3A//yyy"
                // 提取从第二个 // 开始的内容（浏览器会自动处理协议）
                return decoded.substring(secondSlashIndex);
              } else {
                // 只有一个 //，直接返回（浏览器会自动处理协议）
                return decoded.substring(slashIndex);
              }
            }

            // 处理纯域名格式
            if (decoded.includes('.') && !decoded.includes('/')) {
              return 'https://' + decoded;
            }
          } catch (e) {
            // 解码失败，继续尝试其他方法
          }
        }
      }

      // 尝试从 hash 中提取
      const hash = urlObj.hash;
      if (hash) {
        const hashMatch = hash.match(/[/?&](url|target|link|u)=([^&]+)/);
        if (hashMatch) {
          try {
            return decodeURIComponent(hashMatch[2]);
          } catch (e) {}
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  function processLinks() {
    const links = document.querySelectorAll(`a[href]:not([${YC_ATTR}])`);
    let replacedCount = 0;

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

      // 尝试提取真实链接并替换
      const realUrl = extractTargetUrl(link.href);
      if (realUrl && realUrl !== link.href) {
        link.href = realUrl;
        replacedCount++;
        console.log('[通用脚本] 替换重定向链接:', link.href.substring(0, 60) + '...', '->', realUrl.substring(0, 60) + '...');
      }
    });

    if (replacedCount > 0) {
      console.log(`[通用脚本] 已替换 ${replacedCount} 个重定向链接`);
    }
  }

  // 使用 DOMUtils.throttle 进行节流处理
  const throttledProcessLinks = DOMUtils.throttle(processLinks, 500);

  // 初始化函数：确保 document.body 存在后执行
  function init() {
    if (!document.body) {
      // DOM 未准备好，等待 DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        // 极端情况：readyState 不是 loading 但 body 也不存在
        setTimeout(init, 50);
      }
      return;
    }

    // 使用 MutationObserver 监听 DOM 变化（使用节流版本）
    const observer = new MutationObserver(throttledProcessLinks);
    observer.observe(document.body, { childList: true, subtree: true });

    // 存储 observer 以便清理
    window._ycRedirectLinksObserver = observer;

    // 初始执行
    throttledProcessLinks();

    console.log('[通用脚本] 重定向链接替换已加载');
  }

  // 清理函数
  function cleanup() {
    if (window._ycRedirectLinksObserver) {
      window._ycRedirectLinksObserver.disconnect();
      window._ycRedirectLinksObserver = null;
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup);

  // 立即尝试初始化
  init();
}
