// Content script for zhipin.com (BOSS直聘)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.BossScript) {
  window.BossScript = { isInitialized: false };
}

const STYLE_TAG_ID = 'boss-style';

const styles = `
.boss-job-update {
  font-size: 12px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 8px;
}
.boss-update-week {
  background-color: #f7d8d8;
  color: #d32f2f;
}
.boss-update-month {
  background-color: #f7e4d8;
  color: #e65100;
}
.boss-update-quarter {
  background-color: #e8f7d8;
  color: #388e3c;
}
`;

function getDiffDays(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (1000 * 60 * 60 * 24));
}

function getUpdateClass(diffDays) {
  if (diffDays > 90) return '';
  if (diffDays > 30) return 'boss-update-quarter';
  if (diffDays > 7) return 'boss-update-month';
  return 'boss-update-week';
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日更新`;
}

// 使用 DOMUtils.throttle 进行节流处理
// 添加防御性检查
let throttledProcessJobList;
if (typeof DOMUtils === 'undefined' || !DOMUtils.throttle) {
  console.warn('[boss] DOMUtils 未加载，使用简单节流');
  const simpleThrottle = (fn, delay) => {
    let lastCall = 0;
    return (...args) => {
      const now = Date.now();
      if (now - lastCall >= delay) {
        lastCall = now;
        fn(...args);
      }
    };
  };
  throttledProcessJobList = simpleThrottle(processJobList, 300);
} else {
  throttledProcessJobList = DOMUtils.throttle(processJobList, 300);
}

// 旧的直接引用（已替换）
// const throttledProcessJobList = DOMUtils.throttle(() => {
function processJobList() {
  const jobCards = document.querySelectorAll('[class*="job-card"], [ka="search-job-item"]');

  jobCards.forEach(card => {
    if (card.hasAttribute('yc-boss-processed')) return;
    card.setAttribute('yc-boss-processed', 'true');

    // 尝试获取职位发布时间（需要根据实际页面结构调整）
    const timeElement = card.querySelector('[class*="time"], [class*="date"]');
    if (!timeElement) return;

    const timeText = timeElement.textContent;
    // 解析时间（这里需要根据实际格式调整）
    // 示例：显示更新标记

    const diffDays = getDiffDays(new Date().toISOString()); // 这里需要实际解析

    const updateClass = getUpdateClass(diffDays);
    if (!updateClass) return;

    const badge = document.createElement('span');
    badge.className = `boss-job-update ${updateClass}`;
    badge.textContent = formatDate(new Date().toISOString());

    const titleElement = card.querySelector('[class*="job-title"], [class*="name"]');
    if (titleElement) {
      titleElement.appendChild(badge);
    }
  });
}

function injectStyles() {
  // 添加防御性检查
  if (typeof DOMUtils === 'undefined' || !DOMUtils.upsertStyle) {
    console.warn('[boss] DOMUtils 未加载，手动添加样式');
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
  if (window.BossScript.isInitialized) return;

  // 确保 document.body 存在
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
    return;
  }

  window.BossScript.isInitialized = true;

  injectStyles();

  // 监听 DOM 变化（使用节流版本）
  const observer = new MutationObserver(throttledProcessJobList);
  observer.observe(document.body, { childList: true, subtree: true });

  // 存储 observer 以便清理
  window.BossScript.observer = observer;

  console.log('[BOSS直聘] 信息透出脚本已加载');
}

// 清理函数
function cleanup() {
  if (window.BossScript?.observer) {
    window.BossScript.observer.disconnect();
    window.BossScript.observer = null;
  }
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000);
}
