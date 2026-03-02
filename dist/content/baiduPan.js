// Content script for pan.baidu.com (百度网盘)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.BaiduPanScript) {
  window.BaiduPanScript = { isInitialized: false };
}

let lastExecutionTime = 0;
const DELAY = 500;

function autoSubmitPassword() {
  if (lastExecutionTime + DELAY > Date.now()) return;
  lastExecutionTime = Date.now();

  const accessCode = document.getElementById('accessCode');
  const submitBtn = document.getElementById('submitBtn');

  if (accessCode && accessCode.value && submitBtn) {
    console.log('[百度网盘] 检测到提取码，自动提交');
    submitBtn.click();
  }
}

function init() {
  if (window.BaiduPanScript.isInitialized) return;

  // 确保 document.body 存在
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
    return;
  }

  window.BaiduPanScript.isInitialized = true;

  // 监听 DOM 变化
  const observer = new MutationObserver(autoSubmitPassword);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // 存储 observer 以便清理
  window.BaiduPanScript.observer = observer;

  // 初始检查
  autoSubmitPassword();

  console.log('[百度网盘] 自动提交脚本已加载');
}

// 清理函数
function cleanup() {
  if (window.BaiduPanScript?.observer) {
    window.BaiduPanScript.observer.disconnect();
    window.BaiduPanScript.observer = null;
  }
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
