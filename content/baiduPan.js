// Content script for pan.baidu.com (百度网盘)
// 使用公共模块重构

'use strict';

import { createScriptGuard } from './utils/script-guard.js';

// 防重复加载
const guard = createScriptGuard('BaiduPan');
if (guard.check()) {
  throw new Error('脚本已加载');
}

let observer = null;
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
  // 确保 document.body 存在
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
    return;
  }

  // 监听 DOM 变化
  observer = new MutationObserver(autoSubmitPassword);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  // 初始检查
  autoSubmitPassword();

  guard.markInitialized();
  console.log('[百度网盘] 自动提交脚本已加载');
}

// 清理函数
function cleanup() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
