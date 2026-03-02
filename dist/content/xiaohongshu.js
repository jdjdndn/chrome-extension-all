// Content script for xiaohongshu.com (小红书)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.XiaohongshuScript) {
  window.XiaohongshuScript = { isInitialized: false };
}

const STYLE_TAG_ID = 'xiaohongshu-style';
let currentAutoPlay = false;

const styles = `
.yc-xhs-btn {
  position: absolute;
  min-width: 100px;
  right: -150px;
  height: 30px;
  line-height: 30px;
  text-align: center;
  z-index: 9999;
  background-color: #fff;
  border-radius: 8px;
  cursor: pointer;
  border: 1px solid #ddd;
}
.yc-xhs-btn:hover {
  background-color: #f5f5f5;
}
`;

function injectStyles() {
  DOMUtils.upsertStyle(STYLE_TAG_ID, styles);
}

function createControlButtons() {
  const videoContainer = document.querySelector('[class*="video-container"], [class*="player"]');
  if (!videoContainer) return;

  // 检查是否已创建按钮
  if (document.querySelector('.yc-xhs-btn')) return;

  const prevBtn = document.createElement('div');
  prevBtn.className = 'yc-xhs-btn';
  prevBtn.style.bottom = '200px';
  prevBtn.textContent = '上一个';
  prevBtn.onclick = () => navigateVideo('prev');

  const nextBtn = document.createElement('div');
  nextBtn.className = 'yc-xhs-btn';
  nextBtn.style.bottom = '150px';
  nextBtn.textContent = '下一个';
  nextBtn.onclick = () => navigateVideo('next');

  const autoPlayBtn = document.createElement('div');
  autoPlayBtn.className = 'yc-xhs-btn yc-auto-play';
  autoPlayBtn.style.bottom = '100px';
  autoPlayBtn.textContent = currentAutoPlay ? '停止自动' : '自动播放';
  autoPlayBtn.onclick = toggleAutoPlay;

  videoContainer.style.position = 'relative';
  videoContainer.appendChild(prevBtn);
  videoContainer.appendChild(nextBtn);
  videoContainer.appendChild(autoPlayBtn);
}

function navigateVideo(direction) {
  const key = direction === 'prev' ? 'ArrowUp' : 'ArrowDown';
  const event = new KeyboardEvent('keydown', { key, code: key });
  document.dispatchEvent(event);
  console.log('[小红书]', direction === 'prev' ? '上一个' : '下一个');
}

function toggleAutoPlay() {
  currentAutoPlay = !currentAutoPlay;
  const btn = document.querySelector('.yc-auto-play');
  if (btn) {
    btn.textContent = currentAutoPlay ? '停止自动' : '自动播放';
  }
  console.log('[小红书] 自动播放:', currentAutoPlay ? '开启' : '关闭');
}

function checkAutoPlay() {
  if (!currentAutoPlay) return;

  const video = document.querySelector('video');
  if (video && video.ended) {
    navigateVideo('next');
  }
}

let lastExecutionTime = 0;
const DELAY = 500;

function mainLoop() {
  if (lastExecutionTime + DELAY > Date.now()) return;
  lastExecutionTime = Date.now();

  createControlButtons();
  checkAutoPlay();
}

function init() {
  if (window.XiaohongshuScript.isInitialized) return;

  // 确保 document.body 存在
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
    return;
  }

  window.XiaohongshuScript.isInitialized = true;

  injectStyles();

  // 监听 DOM 变化
  const observer = new MutationObserver(mainLoop);
  observer.observe(document.body, { childList: true, subtree: true });

  // 存储 observer 和 interval 以便清理
  window.XiaohongshuScript.observer = observer;
  window.XiaohongshuScript.intervalId = setInterval(mainLoop, 1000);

  console.log('[小红书] 自动播放脚本已加载');
}

// 清理函数
function cleanup() {
  if (window.XiaohongshuScript?.observer) {
    window.XiaohongshuScript.observer.disconnect();
    window.XiaohongshuScript.observer = null;
  }
  if (window.XiaohongshuScript?.intervalId) {
    clearInterval(window.XiaohongshuScript.intervalId);
    window.XiaohongshuScript.intervalId = null;
  }
}

// 页面卸载时清理
window.addEventListener('beforeunload', cleanup);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000);
}
