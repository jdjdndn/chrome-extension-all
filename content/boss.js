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

let lastExecutionTime = 0;
const DELAY = 500;

function processJobList() {
  if (lastExecutionTime + DELAY > Date.now()) return;
  lastExecutionTime = Date.now();

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
  DOMUtils.upsertStyle(STYLE_TAG_ID, styles);
}

function init() {
  if (window.BossScript.isInitialized) return;
  window.BossScript.isInitialized = true;

  injectStyles();

  // 监听 DOM 变化
  const observer = new MutationObserver(processJobList);
  observer.observe(document.body, { childList: true, subtree: true });

  console.log('[BOSS直聘] 信息透出脚本已加载');
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000);
}
