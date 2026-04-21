// Content script for wx.wyaqpx.com (电工考试)
// 使用公共模块重构

'use strict';

import { createScriptGuard } from './utils/script-guard.js';

// 防重复加载
const guard = createScriptGuard('DianGong');
if (guard.check()) {
  throw new Error('脚本已加载');
}

const SELECTORS = {
  answerBtn: '.esmb-answer',
  prevBtn: '.esmb-pre',
  nextBtn: '.esmb-next',
  questionBox: '.course-items',
  collapseBtn: '.fa-angle-up',
  expandBtn: '.fa-angle-down',
  correctIcon: '.fa-check'
};

function hasPseudoElement(element, pseudo) {
  try {
    const style = window.getComputedStyle(element, pseudo);
    return style.content !== 'none' && style.content !== '';
  } catch {
    return false;
  }
}

let lastExecutionTime = 0;
const DELAY = 500;

function autoAnswer() {
  if (lastExecutionTime + DELAY > Date.now()) return;
  lastExecutionTime = Date.now();

  const questionBoxList = DOMUtils.findAllInViewport(SELECTORS.questionBox);

  if (questionBoxList.length !== 1) return;

  const questionBox = questionBoxList[0];
  const iList = [...questionBox.querySelectorAll('i')];
  const hasChoosed = iList.some(it => hasPseudoElement(it, ':after'));

  if (!hasChoosed) return;

  // 如果已经展开，跳过
  if (questionBox.querySelector(SELECTORS.collapseBtn)) return;

  // 点击展开按钮
  const expandBtn = questionBox.querySelector(SELECTORS.expandBtn);
  if (expandBtn) {
    expandBtn.click();
    console.log('[电工考试] 展开解析');
  }

  // 自动下一题
  setTimeout(() => {
    if (!questionBox.querySelector(SELECTORS.correctIcon)) return;

    const nextBtn = document.querySelector(SELECTORS.nextBtn);
    if (nextBtn) {
      console.log('[电工考试] 自动下一题');
      nextBtn.click();
    }
  }, 1000);
}

let observer = null;

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
  observer = new MutationObserver(autoAnswer);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  guard.markInitialized();
  console.log('[电工考试] 自动答题脚本已加载');
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
