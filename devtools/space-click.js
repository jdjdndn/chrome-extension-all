// 键盘快捷操作（devtools 面板）
// Space: 点击 | C: 右击 | S(按住): 选文本
(function() {
  'use strict';
  let hoveredEl = null;
  let mouseX = 0, mouseY = 0;
  let sHeld = false;
  let selectAnchor = null;
  let selectTooltip = null;

  document.body.setAttribute('tabindex', '-1');
  document.body.style.outline = 'none';

  // 鼠标追踪
  document.addEventListener('mouseover', (e) => { hoveredEl = e.target; }, true);
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (sHeld) extendSelection(e.clientX, e.clientY);
  }, true);

  // 键盘
  window.addEventListener('keydown', (e) => {
    const active = document.activeElement;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT' || active.isContentEditable)) return;

    switch (e.key) {
      case ' ':
        if (sHeld) break;
        doClick(e);
        break;
      case 'x': case 'X':
        if (sHeld) break;
        doRightClick(e);
        break;
      case 's': case 'S':
        if (!e.repeat) onSDown(e);
        break;
      case 'Escape':
        if (sHeld) cancelSelect();
        break;
    }
  }, true);

  window.addEventListener('keyup', (e) => {
    if (e.key === 's' || e.key === 'S') onSUp();
  }, true);

  function doClick(e) {
    if (!hoveredEl || !document.body.contains(hoveredEl)) return;
    e.preventDefault(); e.stopPropagation();
    if (typeof hoveredEl.click === 'function') hoveredEl.click();
    else hoveredEl.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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

  // S 文本选择
  function onSDown(e) {
    e.preventDefault(); e.stopPropagation();
    sHeld = true;
    const anchor = rangeFromPoint(mouseX, mouseY);
    if (!anchor) { sHeld = false; return; }
    selectAnchor = anchor;
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(anchor.cloneRange());
    showHint('S:按住移动选文本');
  }

  function onSUp() {
    if (!sHeld) return;
    sHeld = false;
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
    sHeld = false; selectAnchor = null; hideHint();
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
