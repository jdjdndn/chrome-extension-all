// Content script for wx.wyaqpx.com (电工考试)
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (!window.DianGongScript) {
  window.DianGongScript = { isInitialized: false };
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

function isElementInViewport(element) {
  const rect = element.getBoundingClientRect();
  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

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

  const questionBoxList = [...document.querySelectorAll(SELECTORS.questionBox)]
    .filter(isElementInViewport);

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

function init() {
  if (window.DianGongScript.isInitialized) return;
  window.DianGongScript.isInitialized = true;

  // 监听 DOM 变化
  const observer = new MutationObserver(autoAnswer);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true });

  console.log('[电工考试] 自动答题脚本已加载');
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
