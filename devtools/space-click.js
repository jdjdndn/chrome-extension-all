// 键盘快捷操作（devtools 面板）
// Space(短按): 点击 | Space(长按): 选文本 | X: 右击
(function() {
  'use strict';
  let hoveredEl = null;
  let mouseX = 0, mouseY = 0;
  let spaceHeld = false;
  let spaceDownTime = 0;
  let spaceTimer = null;
  let selectAnchor = null;
  let selectTooltip = null;
  const LONG_PRESS_THRESHOLD = 700;

  document.body.setAttribute('tabindex', '-1');
  document.body.style.outline = 'none';

  // 鼠标追踪
  document.addEventListener('mouseover', (e) => { hoveredEl = e.target; }, true);
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (spaceHeld) extendSelection(e.clientX, e.clientY);
  }, true);

  // 键盘
  window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

    switch (e.key) {
      case ' ':
        // 空格按下时禁用默认事件（防止页面滚动）
        e.preventDefault();
        e.stopPropagation();
        if (!spaceHeld && !spaceTimer) {
          spaceDownTime = Date.now();
          // 设置长按定时器，超时后进入选择模式
          spaceTimer = setTimeout(() => {
            startTextSelection();
            spaceTimer = null;
          }, LONG_PRESS_THRESHOLD);
        }
        break;
      case 'x': case 'X':
        if (!spaceHeld) doRightClick(e);
        break;
      case 'Escape':
        if (spaceHeld) cancelSelect();
        break;
    }
  }, true);

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') onSpaceUp(e);
  }, true);

  function onSpaceUp(e) {
    // 清除长按定时器
    if (spaceTimer) {
      clearTimeout(spaceTimer);
      spaceTimer = null;
      // 定时器未触发 = 短按，执行点击
      // 先清除之前的选择
      window.getSelection().removeAllRanges();
      doClick(e);
      return;
    }

    if (spaceHeld) {
      spaceHeld = false;
      const text = window.getSelection().toString().trim();
      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          showHint('已复制 ' + text.length + ' 字');
          setTimeout(hideHint, 1200);
        }).catch(hideHint);
      } else {
        window.getSelection().removeAllRanges();
        hideHint();
      }
      selectAnchor = null;
    }
  }

  function startTextSelection() {
    const anchor = rangeFromPoint(mouseX, mouseY);
    if (!anchor) return; // 鼠标下没有文本，不进入选择模式

    spaceHeld = true;
    selectAnchor = anchor;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(anchor.cloneRange());
    showHint('Space:按住移动选文本');
  }

  function doClick(e) {
    if (!hoveredEl || !document.body.contains(hoveredEl)) return;
    e.preventDefault(); e.stopPropagation();

    const rect = hoveredEl.getBoundingClientRect();
    const clientX = rect.left + rect.width / 2;
    const clientY = rect.top + rect.height / 2;

    hoveredEl.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true, cancelable: true,
      clientX, clientY, button: 0, buttons: 1
    }));
    hoveredEl.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true, cancelable: true,
      clientX, clientY, button: 0, buttons: 0
    }));
    hoveredEl.dispatchEvent(new MouseEvent('click', {
      bubbles: true, cancelable: true,
      clientX, clientY, button: 0, buttons: 0
    }));
  }

  function doRightClick(e) {
    if (!hoveredEl || !document.body.contains(hoveredEl)) return;
    e.preventDefault(); e.stopPropagation();
    const r = hoveredEl.getBoundingClientRect();
    hoveredEl.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true, cancelable: true,
      clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
      button: 2, buttons: 2,
    }));
  }

  function extendSelection(cx, cy) {
    if (!selectAnchor) return;
    const focus = rangeFromPoint(cx, cy);
    if (!focus) return;
    try {
      const range = document.createRange();
      const a = selectAnchor;
      const cmp = a.startContainer.compareDocumentPosition(focus.startContainer);
      if (cmp & Node.DOCUMENT_POSITION_FOLLOWING || (!cmp && a.startOffset < focus.startOffset)) {
        range.setStart(a.startContainer, a.startOffset);
        range.setEnd(focus.startContainer, focus.startOffset);
      } else {
        range.setStart(focus.startContainer, focus.startOffset);
        range.setEnd(a.startContainer, a.startOffset);
      }
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch(_) {}
  }

  function rangeFromPoint(x, y) {
    if (document.caretRangeFromPoint) return document.caretRangeFromPoint(x, y);
    if (document.caretPositionFromPoint) {
      const pos = document.caretPositionFromPoint(x, y);
      if (pos) { const r = document.createRange(); r.setStart(pos.offsetNode, pos.offset); r.collapse(true); return r; }
    }
    return null;
  }

  function cancelSelect() {
    window.getSelection().removeAllRanges();
    spaceHeld = false; selectAnchor = null; hideHint();
  }

  function showHint(text) {
    hideHint();
    const tip = document.createElement('div');
    tip.textContent = text;
    tip.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.8);color:#fff;padding:4px 12px;border-radius:4px;' +
      'font:12px monospace;z-index:2147483647;pointer-events:none;';
    document.body.appendChild(tip);
    selectTooltip = tip;
  }

  function hideHint() {
    if (selectTooltip) { selectTooltip.remove(); selectTooltip = null; }
  }
})();
