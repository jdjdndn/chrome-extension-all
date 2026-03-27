// 通用脚本：给没有 title 的 a 链接添加 title，给溢出隐藏的元素添加 title
// @match *://*/*

'use strict';

// 使用 ScriptLoader 管理依赖
if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'add-title',
    dependencies: ['DOMUtils'],
    onReady: () => initAddTitle()
  });
} else {
  // 降级处理：ScriptLoader 未加载时直接初始化
  initAddTitle();
}

function initAddTitle() {
  if (window.AddTitleLoaded) {
    console.log('[通用脚本] title 添加已加载，跳过');
    return;
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('add-title')) {
    console.log('[通用脚本] title 添加已禁用');
    return;
  }

  window.AddTitleLoaded = true;

  const PROCESSED_ATTR = 'yc-title-processed';

  // 获取元素的 padding
  function getPadding(el) {
    const style = window.getComputedStyle(el, null);
    return {
      left: parseInt(style.paddingLeft, 10) || 0,
      right: parseInt(style.paddingRight, 10) || 0,
      top: parseInt(style.paddingTop, 10) || 0,
      bottom: parseInt(style.paddingBottom, 10) || 0
    };
  }

  // 检查文本是否溢出
  function isTextOverflow(dom) {
    // 绝对定位的元素，脱离了文档流，需要特殊处理
    const domPosition = getComputedStyle(dom).position;
    const hasAbsChild = [...dom.childNodes].some(
      node => node.nodeType === 1 && getComputedStyle(node).position === 'absolute'
    );

    // 设置不换行的元素，默认能显示完整
    const whiteSpace = getComputedStyle(dom).whiteSpace;
    const textOverflow = getComputedStyle(dom).textOverflow;
    if (whiteSpace === 'nowrap' && textOverflow !== 'ellipsis') {
      return false;
    }

    // 看不见的不处理
    if (dom.offsetWidth === 0) return false;

    // 获取文本内容的实际尺寸
    const cloneDom = hasAbsChild ? dom.cloneNode(true) : dom;
    // 移除绝对定位的子元素（如果有）
    if (hasAbsChild) {
      [...cloneDom.childNodes].forEach(node => {
        if (node.nodeType === 1 && getComputedStyle(node).position === 'absolute') {
          node.remove();
        }
      });
      document.body.appendChild(cloneDom);
    }

    const range = document.createRange();
    range.setStart(cloneDom, 0);
    range.setEnd(cloneDom, cloneDom.childNodes.length);

    const rangeRect = range.getBoundingClientRect();
    if (hasAbsChild) {
      cloneDom.remove();
    }

    const { left, right, top, bottom } = getPadding(dom);
    const horizontalPadding = left + right;
    const verticalPadding = top + bottom;

    const rangeWidth = Math.floor(rangeRect.width);
    const rangeHeight = Math.floor(rangeRect.height);

    // 有绝对定位子元素时，只使用 Range 检测
    // 没有时，使用 Range 检测或 scrollWidth/scrollHeight 检测
    if (hasAbsChild || domPosition === 'absolute') {
      return rangeWidth + horizontalPadding > dom.offsetWidth ||
             rangeHeight + verticalPadding > dom.offsetHeight;
    }

    return rangeWidth + horizontalPadding > dom.offsetWidth ||
           rangeHeight + verticalPadding > dom.offsetHeight ||
           dom.scrollWidth > dom.offsetWidth ||
           dom.scrollHeight > dom.offsetHeight;
  }

  // 处理 a 链接
  function addTitleToAnchor(anchor) {
    if (!anchor || anchor.hasAttribute(PROCESSED_ATTR)) return;
    anchor.setAttribute(PROCESSED_ATTR, 'true');

    const text = anchor.textContent.trim();
    if (!text) return;

    anchor.title = text;
  }

  // 处理溢出元素
  function addTitleToOverflowElement(textNode) {
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

    const dom = textNode.parentNode;
    if (!dom || dom.hasAttribute(PROCESSED_ATTR) || dom.title) return;

    const text = textNode.textContent.trim();
    if (!text) return;

    // 排除不需要处理的标签
    const excludedTags = ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'A'];
    if (excludedTags.includes(dom.tagName)) return;

    // 检查是否溢出
    if (isTextOverflow(dom)) {
      dom.title = dom.innerText || text;
      dom.setAttribute(PROCESSED_ATTR, 'true');
    }
  }

  // 获取所有文本节点
  function getTextNodes() {
    const textNodes = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    while (walker.nextNode()) {
      const trimText = walker.currentNode.textContent.trim();
      // 跳过零宽空格和空文本
      if (trimText.length > 0) {
        textNodes.push(walker.currentNode);
      }
    }

    return textNodes;
  }

  function processAllElements() {
    // 处理 a 链接：排除已处理、已有 title 的元素
    const anchors = document.querySelectorAll(`a:not([${PROCESSED_ATTR}]):not([title])`);
    anchors.forEach(addTitleToAnchor);

    // 处理溢出元素
    const textNodes = getTextNodes();
    textNodes.forEach(addTitleToOverflowElement);
  }

  // 使用 DOMUtils.throttle 进行节流处理
  const throttledProcess = DOMUtils.throttle(processAllElements, 500);

  // 初始化函数：确保 document.body 存在后执行
  function init() {
    if (!document.body) {
      // DOM 未准备好，等待 DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        // 极端情况：readyState 不是 loading 但 body 也不存在
        setTimeout(init, 50);
      }
      return;
    }

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver(throttledProcess);
    observer.observe(document.body, { childList: true, subtree: true });

    // 存储 observer 以便清理
    window._ycAddTitleObserver = observer;

    // 初始执行
    processAllElements();

    console.log('[通用脚本] title 添加已加载');
  }

  // 清理函数
  function cleanup() {
    if (window._ycAddTitleObserver) {
      window._ycAddTitleObserver.disconnect();
      window._ycAddTitleObserver = null;
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup);

  // 立即尝试初始化
  init();
}
