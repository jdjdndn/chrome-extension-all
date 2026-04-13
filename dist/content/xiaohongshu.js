// Content script for xiaohongshu.com (小红书)
// 使用公共模块重构

'use strict';

import { createScriptGuard } from './utils/script-guard.js';
import { createStyleInjector } from './utils/style-injector.js';

// 防重复加载
const guard = createScriptGuard('Xiaohongshu');
if (guard.check()) {
  throw new Error('脚本已加载');
}

const STYLE_TAG_ID = 'xiaohongshu-style';
const styleInjector = createStyleInjector(STYLE_TAG_ID);

let currentAutoPlay = false;
let observer = null;
let intervalId = null;

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
  styleInjector.inject(styles);
}

function createControlButtons() {
  const videoContainer = document.querySelector('[class*="video-container"], [class*="player"]');
  if (!videoContainer) return;

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
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
    return;
  }

  injectStyles();

  observer = new MutationObserver(mainLoop);
  observer.observe(document.body, { childList: true, subtree: true });

  intervalId = setInterval(mainLoop, 1000);

  guard.markInitialized();
  console.log('[小红书] 自动播放脚本已加载');
}

function cleanup() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

window.addEventListener('beforeunload', cleanup);

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  setTimeout(init, 1000);
}
