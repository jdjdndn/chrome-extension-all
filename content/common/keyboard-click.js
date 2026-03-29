// 通用脚本：键盘快捷操作
// @match *://*/*
// 功能：
//   Space  — 点击悬停元素
//   C      — 右击悬停元素
//   S(按住) — 从鼠标位置开始选文本，移动鼠标扩展，松开 S 确认复制

'use strict';

if (window.KeyboardClickLoaded) {
  console.log('[键盘操作] 已加载，跳过');
} else if (!window.getScriptSwitch || !window.getScriptSwitch('keyboard-click')) {
  console.log('[键盘操作] 已禁用');
} else {
  window.KeyboardClickLoaded = true;

  class KeyboardClicker {
    constructor() {
      this.hoveredEl = null;
      this.observer = null;
      // 鼠标精确坐标（用于文本选择）
      this.mouseX = 0;
      this.mouseY = 0;
      // S 键文本选择
      this.sHeld = false;
      this.selectAnchor = null;  // Range：按住 S 时的起始位置
      this.selectTooltip = null;

      this._init();
    }

    _init() {
      this._bindMouse();
      this._bindKeyboard();
      this._startObserver();
      console.log('[键盘操作] 已初始化 — Space:点击, C:右击, S(按住):选文本');
    }

    // ========== 鼠标追踪 ==========
    _bindMouse() {
      // 追踪悬停元素
      document.addEventListener('mouseover', (e) => {
        this.hoveredEl = e.target;
      }, true);
      document.addEventListener('mouseout', (e) => {
        if (!e.relatedTarget) this.hoveredEl = null;
      }, true);

      // 追踪精确坐标（S 选择需要像素级定位）
      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        // S 按住时实时扩展选择
        if (this.sHeld) {
          this._extendSelectionTo(e.clientX, e.clientY);
        }
      }, true);
    }

    // ========== 键盘 ==========
    _bindKeyboard() {
      document.addEventListener('keydown', (e) => {
        if (this._isInputFocused()) return;

        switch (e.key) {
          case ' ':
            if (!this.sHeld) this._doClick(e);
            break;

          case 'x':
          case 'X':
            if (!this.sHeld) this._doRightClick(e);
            break;

          case 's':
          case 'S':
            if (!e.repeat) this._onSDown(e);
            break;

          case 'Escape':
            if (this.sHeld) this._cancelSelect();
            break;
        }
      }, true);

      document.addEventListener('keyup', (e) => {
        if (e.key === 's' || e.key === 'S') {
          this._onSUp(e);
        }
      }, true);
    }

    _isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    // ========== Space 点击 ==========
    _doClick(e) {
      const el = this.hoveredEl;
      if (!el || !document.body.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      if (typeof el.click === 'function') {
        el.click();
      } else {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      }
    }

    // ========== C 右击 ==========
    _doRightClick(e) {
      const el = this.hoveredEl;
      if (!el || !document.body.contains(el)) return;
      e.preventDefault();
      e.stopPropagation();
      const r = el.getBoundingClientRect();
      el.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        button: 2, buttons: 2,
      }));
    }

    // ========== S 文本选择（按住选） ==========
    _onSDown(e) {
      e.preventDefault();
      e.stopPropagation();
      this.sHeld = true;

      // 用 caretRangeFromPoint 获取鼠标处的精确文本位置
      const anchor = this._rangeFromPoint(this.mouseX, this.mouseY);
      if (!anchor) {
        // 鼠标下没有文本，取消
        this.sHeld = false;
        return;
      }
      this.selectAnchor = anchor;

      // 初始选中（光标位置，零宽度）
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(anchor.cloneRange());

      this._showHint('S:按住移动选文本');
    }

    _onSUp(e) {
      if (!this.sHeld) return;
      this.sHeld = false;

      const sel = window.getSelection();
      const text = sel.toString().trim();

      if (text) {
        navigator.clipboard.writeText(text).then(() => {
          this._showHint(`已复制 ${text.length} 字`);
          setTimeout(() => this._hideHint(), 1200);
        }).catch(() => {
          this._hideHint();
        });
      } else {
        sel.removeAllRanges();
        this._hideHint();
      }

      this.selectAnchor = null;
    }

    _extendSelectionTo(clientX, clientY) {
      if (!this.selectAnchor) return;

      const focus = this._rangeFromPoint(clientX, clientY);
      if (!focus) return;

      try {
        const range = document.createRange();
        const anchor = this.selectAnchor;

        // 比较 anchor 和 focus 的文档位置，确保 start < end
        const cmp = anchor.startContainer.compareDocumentPosition(focus.startContainer);
        if (cmp & Node.DOCUMENT_POSITION_FOLLOWING || (!cmp && anchor.startOffset < focus.startOffset)) {
          // focus 在 anchor 后面（正常方向）
          range.setStart(anchor.startContainer, anchor.startOffset);
          range.setEnd(focus.startContainer, focus.startOffset);
        } else {
          // focus 在 anchor 前面（反向选择）
          range.setStart(focus.startContainer, focus.startOffset);
          range.setEnd(anchor.startContainer, anchor.startOffset);
        }

        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      } catch (_) {
        // 跨容器等异常，忽略
      }
    }

    /** 用 caretRangeFromPoint 获取像素坐标处的文本 Range */
    _rangeFromPoint(x, y) {
      // Chrome / Edge
      if (document.caretRangeFromPoint) {
        return document.caretRangeFromPoint(x, y);
      }
      // Firefox
      if (document.caretPositionFromPoint) {
        const pos = document.caretPositionFromPoint(x, y);
        if (pos) {
          const range = document.createRange();
          range.setStart(pos.offsetNode, pos.offset);
          range.collapse(true);
          return range;
        }
      }
      return null;
    }

    _cancelSelect() {
      window.getSelection().removeAllRanges();
      this.sHeld = false;
      this.selectAnchor = null;
      this._hideHint();
    }

    // ========== 提示 ==========
    _showHint(text) {
      this._hideHint();
      const tip = document.createElement('div');
      tip.textContent = text;
      tip.style.cssText = 'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);' +
        'background:rgba(0,0,0,0.8);color:#fff;padding:4px 12px;border-radius:4px;' +
        'font:12px monospace;z-index:2147483647;pointer-events:none;transition:opacity 0.3s;';
      document.body.appendChild(tip);
      this.selectTooltip = tip;
    }

    _hideHint() {
      if (this.selectTooltip) {
        this.selectTooltip.remove();
        this.selectTooltip = null;
      }
    }

    // ========== DOM 变化 ==========
    _startObserver() {
      this.observer = DOMUtils.createDebouncedObserver(() => {
        if (this.hoveredEl && !document.body.contains(this.hoveredEl)) {
          this.hoveredEl = null;
        }
      }, 300);
      DOMUtils.onBodyReady(() => {
        this.observer.observe(document.body, { childList: true, subtree: true });
      });
    }

    // ========== 销毁 ==========
    destroy() {
      if (this.observer) this.observer.disconnect();
      this._cancelSelect();
      this.hoveredEl = null;
      window.KeyboardClickLoaded = false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.keyboardClicker = new KeyboardClicker();
    });
  } else {
    window.keyboardClicker = new KeyboardClicker();
  }
}
