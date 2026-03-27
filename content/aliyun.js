// Content script for aliyundrive.com (阿里云盘)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.AliyunScript) {
  window.AliyunScript = { isInitialized: false };
}

const STYLE_TAG_ID = 'aliyun-fix-style';

const styles = `
/* 固定保存按钮 */
[class*="SaveButton"],
[class*="save-btn"],
button[class*="save"] {
  position: sticky !important;
  bottom: 20px !important;
  z-index: 1000 !important;
}
`;

let lastExecutionTime = 0;
const DELAY = 500;

function fixSaveButton() {
  if (lastExecutionTime + DELAY > Date.now()) return;
  lastExecutionTime = Date.now();

  // 查找保存按钮并确保可见
  const saveButtons = document.querySelectorAll('button[class*="save"], [class*="SaveButton"]');

  saveButtons.forEach(btn => {
    // 添加防御性检查
    if (typeof DOMUtils !== 'undefined' && DOMUtils.isElementInViewport) {
      if (!DOMUtils.isElementInViewport(btn)) {
        // 可以添加额外的处理逻辑
      }
    }
  });
}

function injectStyles() {
  // 添加防御性检查
  if (typeof DOMUtils === 'undefined' || !DOMUtils.upsertStyle) {
    console.warn('[aliyun] DOMUtils 未加载，手动添加样式');
    const style = document.getElementById(STYLE_TAG_ID);
    if (!style) {
      const newStyle = document.createElement('style');
      newStyle.id = STYLE_TAG_ID;
      newStyle.textContent = styles;
      document.head.appendChild(newStyle);
    }
  } else {
    DOMUtils.upsertStyle(STYLE_TAG_ID, styles);
  }
}

function init() {
  if (window.AliyunScript.isInitialized) return;

  // 确保 document.body 存在
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
    return;
  }

  window.AliyunScript.isInitialized = true;

  injectStyles();

  // 监听 DOM 变化
  const observer = new MutationObserver(fixSaveButton);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // 存储 observer 以便清理
  window.AliyunScript.observer = observer;

  console.log('[阿里云盘] 保存按钮固定脚本已加载');
}

// 清理函数
function cleanup() {
  if (window.AliyunScript?.observer) {
    window.AliyunScript.observer.disconnect();
    window.AliyunScript.observer = null;
  }
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000);
}
