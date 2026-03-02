// Content script for pan.quark.cn (夸克网盘)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.QuarkScript) {
  window.QuarkScript = { isInitialized: false };
}

const STYLE_TAG_ID = 'quark-search-style';

const styles = `
#kuake-search-container {
  position: fixed;
  left: 50%;
  top: 5px;
  transform: translateX(-50%);
  z-index: 9999;
  display: flex;
  gap: 10px;
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}
#kuake-search-input {
  width: 300px;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}
#kuake-search-button {
  padding: 8px 20px;
  background: #1890ff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}
#kuake-search-button:hover {
  background: #40a9ff;
}
.kuake-highlight {
  background-color: #fff3cd !important;
}
`;

function injectStyles() {
  DOMUtils.upsertStyle(STYLE_TAG_ID, styles);
}

function createSearchUI() {
  const container = document.createElement('div');
  container.id = 'kuake-search-container';

  const input = document.createElement('input');
  input.type = 'text';
  input.id = 'kuake-search-input';
  input.placeholder = '搜索文件名...';

  const button = document.createElement('button');
  button.id = 'kuake-search-button';
  button.textContent = '搜索';

  button.onclick = performSearch;
  input.onkeypress = (e) => {
    if (e.key === 'Enter') performSearch();
  };

  container.appendChild(input);
  container.appendChild(button);
  document.body.appendChild(container);
}

function performSearch() {
  const input = document.getElementById('kuake-search-input');
  const keyword = input.value.trim().toLowerCase();

  // 移除之前的高亮
  document.querySelectorAll('.kuake-highlight').forEach(el => {
    el.classList.remove('kuake-highlight');
  });

  if (!keyword) return;

  // 搜索文件名
  const fileElements = document.querySelectorAll('.filename-text, [class*="filename"]');

  fileElements.forEach(el => {
    const text = el.textContent.toLowerCase();
    if (text.includes(keyword)) {
      el.classList.add('kuake-highlight');
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  console.log('[夸克网盘] 搜索:', keyword);
}

function init() {
  if (window.QuarkScript.isInitialized) return;
  window.QuarkScript.isInitialized = true;

  injectStyles();
  createSearchUI();

  console.log('[夸克网盘] 搜索脚本已加载');
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000);
}
