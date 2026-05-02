// 通用脚本：键盘快捷操作
// @match *://*/*
// 功能：
//   Space(短按) — 点击悬停元素
//   Space(长按) — 从鼠标位置开始选文本，移动鼠标扩展，松开确认复制
//   X      — 右击悬停元素

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
      // 空格键文本选择
      this.spaceHeld = false;
      this.spaceDownTime = 0;
      this.selectAnchor = null;  // Range：按住空格时的起始位置
      this.selectTooltip = null;
      this.spaceTimer = null;  // 长按定时器
      // 长按阈值（毫秒）
      this.LONG_PRESS_THRESHOLD = 300;

      this._init();
    }

    _init() {
      this._bindMouse();
      this._bindKeyboard();
      this._startObserver();
      console.log('[键盘操作] 已初始化 — Space(短按):点击, Space(长按):选文本, X:右击');
    }

    // ========== 深度元素查找（穿透 Shadow DOM）==========
    /**
     * 递归穿透 shadow root，获取 (x, y) 坐标处最深层的元素。
     * document.elementFromPoint 只返回 shadow host，不会深入 shadow root 内部。
     */
    _deepElementFromPoint(x, y) {
      let el = document.elementFromPoint(x, y);
      if (!el) return null;
      // 递归穿透所有嵌套 shadow root
      let maxDepth = 20; // 防止无限循环
      while (el && el.shadowRoot && maxDepth-- > 0) {
        const inner = el.shadowRoot.elementFromPoint(x, y);
        if (!inner || inner === el) break;
        el = inner;
      }
      return el;
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

      // 追踪精确坐标（空格选择需要像素级定位）
      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        // 空格按住时实时扩展选择
        if (this.spaceHeld) {
          this._extendSelectionTo(e.clientX, e.clientY);
        }
      }, true);
    }

    // ========== 键盘 ==========
    _bindKeyboard() {
      document.addEventListener('keydown', (e) => {
        // 组合键（Ctrl+Space 等）不拦截
        if (this._isComboKey(e)) return;

        // 输入框聚焦时不拦截
        if (this._isInputFocused()) return;

        switch (e.key) {
          case ' ':
            // 空格按下时完全阻止事件传播和默认行为
            // stopImmediatePropagation 阻止同元素其他 capture 监听器触发
            e.preventDefault();
            e.stopImmediatePropagation();
            if (!this.spaceHeld && !this.spaceTimer) {
              this.spaceDownTime = Date.now();
              // 设置长按定时器，超时后进入选择模式
              this.spaceTimer = setTimeout(() => {
                this._startTextSelection();
                this.spaceTimer = null;
              }, this.LONG_PRESS_THRESHOLD);
            }
            break;

          case 'x':
          case 'X':
            if (!this.spaceHeld) this._doRightClick(e);
            break;

          case 'Escape':
            if (this.spaceHeld) this._cancelSelect();
            break;
        }
      }, true);

      document.addEventListener('keyup', (e) => {
        if (e.key === ' ' && !this._isComboKey(e)) {
          // 阻止 keyup 的默认行为和传播，防止页面其他监听器二次处理空格键
          e.preventDefault();
          e.stopImmediatePropagation();
          this._onSpaceUp(e);
        }
      }, true);
    }

    _isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName;

      // 基本表单元素
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;

      // contentEditable
      if (el.isContentEditable) return true;

      // ARIA 文本框 / 编辑器
      const role = el.getAttribute('role');
      if (role === 'textbox' || role === 'combobox' || role === 'searchbox' || role === 'editor') return true;

      // 代码编辑器常见容器（CodeMirror, Monaco, ACE 等）
      if (el.closest('.CodeMirror, .monaco-editor, .ace_editor, .cm-editor, .CodeMirror-code, [class*="editor"]')) return true;

      // 某些 input type 不拦截（checkbox, radio, submit, button 等）
      if (tag === 'INPUT') {
        const type = (el.type || '').toLowerCase();
        const nonTextTypes = ['checkbox', 'radio', 'submit', 'button', 'reset', 'image', 'color', 'range', 'file'];
        if (nonTextTypes.includes(type)) return false;
      }

      return false;
    }

    /** 是否为组合键（Ctrl/Cmd/Alt + 字母），这些应该交给浏览器/页面处理 */
    _isComboKey(e) {
      return e.ctrlKey || e.metaKey || e.altKey;
    }

    _onSpaceUp(e) {
      // 清除长按定时器
      if (this.spaceTimer) {
        clearTimeout(this.spaceTimer);
        this.spaceTimer = null;
        // 定时器未触发 = 短按，执行点击
        // 先清除之前的选择
        window.getSelection().removeAllRanges();
        this._doClick(e);
        return;
      }

      if (this.spaceHeld) {
        // 长按松开：复制选中文本
        this.spaceHeld = false;
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
    }

    _startTextSelection() {
      // 用 caretRangeFromPoint 获取鼠标处的精确文本位置
      const anchor = this._rangeFromPoint(this.mouseX, this.mouseY);
      if (!anchor) {
        // 鼠标下没有文本，不进入选择模式
        return;
      }

      this.spaceHeld = true;
      this.selectAnchor = anchor;

      // 初始选中（光标位置，零宽度）
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(anchor.cloneRange());

      this._showHint('Space:按住移动选文本');
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
      this.spaceHeld = false;
      this.selectAnchor = null;
      this._hideHint();
    }

    // ========== 查找点击目标 ==========
    /**
     * 查找真正的点击目标：优先选择被覆盖层遮挡的媒体元素（video/audio）。
     * 很多视频播放器在 video 上方覆盖透明 div，elementFromPoint 会返回覆盖层。
     * 这里用 elementsFromPoint 检测是否有媒体元素被遮挡，仅在当前元素非交互元素时切换。
     */
    _findClickTarget(x, y) {
      let el = this._deepElementFromPoint(x, y);
      if (!el) return null;

      // 已经是媒体元素，直接返回
      if (el.tagName === 'VIDEO' || el.tagName === 'AUDIO') return el;

      // 检查当前位置下方是否有媒体元素被遮挡
      const all = document.elementsFromPoint(x, y);
      let foundMedia = false;
      for (const candidate of all) {
        if (candidate.tagName === 'VIDEO' || candidate.tagName === 'AUDIO') {
          foundMedia = true;
          // 只有当前元素不是交互元素（按钮/链接等）时，才切换到媒体元素
          if (!this._isInteractiveElement(el)) {
            el = candidate;
          }
          break;
        }
      }

      // 兜底：elementsFromPoint 无法找到 pointer-events:none 或 shadow DOM 内的 video
      if (!foundMedia && !this._isInteractiveElement(el)) {
        const media = this._findMediaByRect(x, y);
        if (media) el = media;
      }

      return el;
    }

    /**
     * 通过 bounding rect 查找坐标处的媒体元素（兜底方案）。
     * 处理 video/audio 设置了 pointer-events:none 或位于 shadow DOM 内，
     * 导致 elementsFromPoint 无法检测到的情况。
     */
    _findMediaByRect(x, y) {
      const check = (video) => {
        const rect = video.getBoundingClientRect();
        return (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) ? video : null;
      };

      // 文档级 video/audio
      for (const media of document.querySelectorAll('video, audio')) {
        const found = check(media);
        if (found) return found;
      }

      // shadow DOM 内的 video/audio
      for (const host of document.querySelectorAll('*')) {
        if (host.shadowRoot) {
          for (const media of host.shadowRoot.querySelectorAll('video, audio')) {
            const found = check(media);
            if (found) return found;
          }
        }
      }

      return null;
    }

    /** 判断元素是否为交互元素（按钮/链接等），交互元素应保留原始点击目标 */
    _isInteractiveElement(el) {
      const tags = ['BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA', 'LABEL'];
      if (tags.includes(el.tagName)) return true;
      if (el.isContentEditable) return true;
      const role = el.getAttribute('role');
      if (['button', 'link', 'tab', 'menuitem', 'checkbox', 'radio', 'switch'].includes(role)) return true;
      return false;
    }

    // ========== Space 短按点击 ==========
    _doClick(e) {
      // 使用 _findClickTarget 查找真实点击目标（穿透覆盖层找到被遮挡的媒体元素）
      const el = this._findClickTarget(this.mouseX, this.mouseY);
      if (!el || !el.isConnected) return;
      e.preventDefault();
      e.stopPropagation();

      // 使用鼠标实际位置（而非元素中心），确保点击精确位置
      // 这对于进度条等需要精确点击的场景很重要
      const clientX = this.mouseX;
      const clientY = this.mouseY;

      // 计算相对于元素的偏移（进度条等控件依赖此属性）
      const rect = el.getBoundingClientRect();
      const offsetX = clientX - rect.left;
      const offsetY = clientY - rect.top;

      // 1. mousedown
      el.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true,
        clientX, clientY, offsetX, offsetY,
        button: 0, buttons: 1,
      }));

      // 2. mouseup
      el.dispatchEvent(new MouseEvent('mouseup', {
        bubbles: true, cancelable: true,
        clientX, clientY, offsetX, offsetY,
        button: 0, buttons: 0,
      }));

      // 3. click（带完整坐标信息）
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true,
        clientX, clientY, offsetX, offsetY,
        button: 0, buttons: 0,
      }));
    }

    // ========== X 右击 ==========
    _doRightClick(e) {
      const el = this._findClickTarget(this.mouseX, this.mouseY);
      if (!el || !el.isConnected) return;
      e.preventDefault();
      e.stopPropagation();
      el.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, cancelable: true,
        clientX: this.mouseX, clientY: this.mouseY,
        button: 2, buttons: 2,
      }));
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
      if (typeof DOMUtils === 'undefined') return;
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
