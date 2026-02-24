// Content script for weread.qq.com (微信阅读)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.WereadScript) {
  window.WereadScript = { isInitialized: false };
}

const STYLE_TAG_ID = 'weread-script-style';
let intervalId = null;

const settings = {
  open: true,
  interval: 5000,
  step: 30
};

const STORAGE_KEY = 'yc-weixin-read';
const lastScrollYArr = [];

// 样式注入
const styles = `
#floatBtn {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  padding: 10px 15px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  z-index: 9999;
  font-size: 14px;
}
#floatBtn:hover {
  background: #45a049;
}
#floatBtn.stopped {
  background: #f44336;
}
`;

function injectStyles() {
  DOMUtils.upsertStyle(STYLE_TAG_ID, styles);
}

function autoScroll() {
  if (!settings.open) return;

  const scrollStep = settings.step;
  const currentScrollY = window.scrollY;
  lastScrollYArr.push(currentScrollY);

  // 保留最近5次滚动位置
  if (lastScrollYArr.length > 5) {
    lastScrollYArr.shift();
  }

  // 检测是否到达底部
  const isAtBottom = (window.innerHeight + window.scrollY) >= document.body.scrollHeight - 100;

  if (isAtBottom) {
    console.log('[微信阅读] 已到达页面底部');
    stopAutoScroll();
    return;
  }

  window.scrollBy(0, scrollStep);
}

function startAutoScroll() {
  if (intervalId) return;
  settings.open = true;
  intervalId = setInterval(autoScroll, settings.interval);
  updateButtonState();
  console.log('[微信阅读] 开始自动滚动');
}

function stopAutoScroll() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  settings.open = false;
  updateButtonState();
  console.log('[微信阅读] 停止自动滚动');
}

function toggleAutoScroll() {
  if (settings.open) {
    stopAutoScroll();
  } else {
    startAutoScroll();
  }
  saveSettings();
}

function updateButtonState() {
  const btn = document.getElementById('floatBtn');
  if (btn) {
    btn.textContent = settings.open ? '停止滚动' : '开始滚动';
    btn.classList.toggle('stopped', !settings.open);
  }
}

function createFloatButton() {
  const btn = document.createElement('button');
  btn.id = 'floatBtn';
  btn.textContent = settings.open ? '停止滚动' : '开始滚动';
  btn.onclick = toggleAutoScroll;
  document.body.appendChild(btn);
}

async function loadSettings() {
  const result = await StorageUtils.getLocal([STORAGE_KEY]);
  if (result[STORAGE_KEY]) {
    Object.assign(settings, result[STORAGE_KEY]);
  }
}

async function saveSettings() {
  await StorageUtils.setLocal({ [STORAGE_KEY]: settings });
}

async function init() {
  if (window.WereadScript.isInitialized) return;
  window.WereadScript.isInitialized = true;

  injectStyles();
  await loadSettings();
  createFloatButton();

  if (settings.open) {
    startAutoScroll();
  }

  console.log('[微信阅读] 脚本已加载');
}

// 启动
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
