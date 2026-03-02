// ========== 元素拾取器注入脚本 ==========
// 在页面中运行的元素选择交互脚本
// 支持批量选择、高亮预览、选择器生成

// 注意：不要在生成的选择器中使用脚本添加的自定义属性（如 data-element-picker-uid）

(function () {
  'use strict';

  // 如果已存在实例，先清理旧实例
  if (window.ElementPickerInject) {
    try {
      // 尝试停止旧实例
      if (typeof window.ElementPickerInject.stop === 'function') {
        window.ElementPickerInject.stop();
      }
      // 尝试清理高亮
      if (typeof window.ElementPickerInject.cleanup === 'function') {
        window.ElementPickerInject.cleanup();
      }
      // 移除所有高亮元素
      document.querySelectorAll('[data-ep-selected]').forEach(el => {
        el.removeAttribute('data-ep-selected');
        el.removeAttribute('data-ep-uid');
      });
      // 移除样式
      const oldStyle = document.getElementById('element-picker-styles');
      if (oldStyle) oldStyle.remove();
      // 移除高亮层
      const oldOverlay = document.getElementById('element-picker-highlight');
      if (oldOverlay) oldOverlay.remove();
    } catch (e) {
      // 忽略清理错误
    }
    window.ElementPickerInject = null;
  }

  /**
   * 元素拾取器类
   */
  class ElementPicker {
    constructor() {
      this.isActive = false;
      this.selectedElements = []; // 已选中的元素信息 { pickerUid, xpath, selector, tagName }
      this.highlightOverlay = null;
      this.sizeTooltip = null;
      this.currentHoveredElement = null;
      this.multiSelectMode = false; // 多选模式（Ctrl/Cmd 按下时）
      this._uidCounter = 0; // 唯一 ID 计数器

      // 绑定方法以保持 this 上下文
      this.onHover = this.onHover.bind(this);
      this.onMouseOut = this.onMouseOut.bind(this);
      this.onMouseLeave = this.onMouseLeave.bind(this);
      this.onClick = this.onClick.bind(this);
      this.onKeyDown = this.onKeyDown.bind(this);
      this.onKeyUp = this.onKeyUp.bind(this);
      this.onScroll = this.onScroll.bind(this);
      this.onResize = this.onResize.bind(this);

      this.createHighlightOverlay();

    }

    /**
     * 智能选择元素 - 自动向上选择有效父级
     * 当父元素只有一个可见子元素且大小相近时，自动选中父级
     * @param {Element} target - 初始点击的元素
     * @returns {Element} - 最终选中的元素
     */
    smartSelectElement(target) {
      const SIZE_THRESHOLD = 0.95; // 相似度阈值 95%
      const MAX_LEVEL = 10;

      let current = target;
      let level = 0;

      while (current.parentElement && level < MAX_LEVEL) {
        const parent = current.parentElement;

        if (parent === document.body) break;

        // 获取可见且占位置的子元素
        const visibleChildren = Array.from(parent.children).filter(child => {
          const style = window.getComputedStyle(child);
          // display: none - 完全不显示
          if (style.display === 'none') return false;
          // position: absolute/fixed - 脱离文档流，不占位置
          if (style.position === 'absolute' || style.position === 'fixed') return false;
          return true;
        });

        // 父元素只有一个可见子元素才继续
        if (visibleChildren.length !== 1) break;

        // 检查大小是否相近
        const currentRect = current.getBoundingClientRect();
        const parentRect = parent.getBoundingClientRect();

        const widthRatio = Math.min(currentRect.width, parentRect.width) /
          Math.max(currentRect.width, parentRect.width);
        const heightRatio = Math.min(currentRect.height, parentRect.height) /
          Math.max(currentRect.height, parentRect.height);

        if (widthRatio < SIZE_THRESHOLD || heightRatio < SIZE_THRESHOLD) break;

        current = parent;
        level++;
      }

      return current;
    }

    /**
     * 生成唯一 ID
     */
    generatePickerUid() {
      return 'ep-' + Date.now().toString(36) + '-' + (++this._uidCounter).toString(36);
    }

    /**
     * 创建高亮覆盖层和尺寸提示
     */
    createHighlightOverlay() {
      if (this.highlightOverlay) return;

      // 高亮框
      this.highlightOverlay = document.createElement('div');
      this.highlightOverlay.id = 'element-picker-highlight-overlay';
      this.highlightOverlay.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        border: 2px solid #007acc;
        background: rgba(0, 122, 204, 0.15);
        border-radius: 3px;
        display: none;
      `;
      document.body.appendChild(this.highlightOverlay);

      // 尺寸提示
      this.sizeTooltip = document.createElement('div');
      this.sizeTooltip.id = 'element-picker-size-tooltip';
      this.sizeTooltip.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 2147483647;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 11px;
        font-family: 'Consolas', 'Monaco', monospace;
        white-space: nowrap;
        display: none;
      `;
      document.body.appendChild(this.sizeTooltip);
    }

    /**
     * 进入选择模式
     */
    start() {


      // 无论当前状态如何，都重新启动（强制重启）
      if (this.isActive) {

        this._removeEventListeners();
      }

      this.isActive = true;
      this.selectedElements = [];
      this.currentHoveredElement = null;

      // 添加事件监听器
      this._addEventListeners();

      // 设置页面样式
      document.body.style.cursor = 'crosshair';

      // 通知 content script 选择模式已启动
      this.sendMessage({ type: 'ELEMENT_PICKER_STARTED' });

    }

    /**
     * 停止选择模式
     */
    stop() {


      // 无论当前状态如何，都执行清理（确保状态一致）
      const wasActive = this.isActive;

      this.isActive = false;
      this.multiSelectMode = false;
      this.currentHoveredElement = null;

      // 移除事件监听器
      this._removeEventListeners();

      // 恢复页面样式
      document.body.style.cursor = '';

      // 隐藏高亮层
      this.hideHighlight();

      // 清除选中高亮
      this.clearSelectedHighlights();

      // 通知 content script 选择模式已停止（即使之前不是活动状态也发送，确保同步）
      this.sendMessage({ type: 'ELEMENT_PICKER_STOPPED' });

    }

    /**
     * 切换选择模式
     */
    toggle() {
      if (this.isActive) {
        this.stop();
      } else {
        this.start();
      }
    }

    /**
     * 添加事件监听器
     */
    _addEventListeners() {
      document.addEventListener('mouseover', this.onHover, true);
      document.addEventListener('mouseout', this.onMouseOut, true);
      document.addEventListener('click', this.onClick, true);
      document.addEventListener('keydown', this.onKeyDown, true);
      document.addEventListener('keyup', this.onKeyUp, true);
      document.addEventListener('mouseleave', this.onMouseLeave, true);
      window.addEventListener('scroll', this.onScroll, true);
      window.addEventListener('resize', this.onResize, true);
    }

    /**
     * 移除事件监听器
     */
    _removeEventListeners() {
      document.removeEventListener('mouseover', this.onHover, true);
      document.removeEventListener('mouseout', this.onMouseOut, true);
      document.removeEventListener('click', this.onClick, true);
      document.removeEventListener('keydown', this.onKeyDown, true);
      document.removeEventListener('keyup', this.onKeyUp, true);
      document.removeEventListener('mouseleave', this.onMouseLeave, true);
      window.removeEventListener('scroll', this.onScroll, true);
      window.removeEventListener('resize', this.onResize, true);
    }

    /**
     * 鼠标悬停处理
     */
    onHover(event) {
      if (!this.isActive) return;

      event.stopPropagation();
      const element = event.target;

      // 忽略高亮层自身
      if (element === this.highlightOverlay || element === this.sizeTooltip) return;

      this.currentHoveredElement = element;
      this.showHighlight(element);
    }

    /**
     * 鼠标移出处理
     */
    onMouseOut(event) {
      if (!this.isActive) return;

      const element = event.target;
      const relatedTarget = event.relatedTarget;

      // 如果移到了高亮层或尺寸提示上，忽略
      if (relatedTarget === this.highlightOverlay || relatedTarget === this.sizeTooltip) {
        return;
      }

      // 如果移出了当前悬停元素， 隐藏高亮
      if (element === this.currentHoveredElement) {
        this.hideHighlight();
        this.currentHoveredElement = null;
      }
    }

    /**
     * 鼠标离开文档处理
     */
    onMouseLeave(event) {
      if (!this.isActive) return;

      // 鼠标离开文档时隐藏高亮
      if (event.target === document || event.target === document.body) {
        this.hideHighlight();
        this.currentHoveredElement = null;
      }
    }

    /**
     * 滚动处理
     */
    onScroll(event) {
      if (!this.isActive) return;

      // 更新高亮框位置
      if (this.currentHoveredElement) {
        this.showHighlight(this.currentHoveredElement);
      }
    }

    /**
     * 窗口大小变化处理
     */
    onResize(event) {
      if (!this.isActive) return;

      // 更新高亮框位置
      if (this.currentHoveredElement) {
        this.showHighlight(this.currentHoveredElement);
      }
    }

    /**
     * 点击选择处理
     */
    onClick(event) {
      if (!this.isActive) return;

      // 防止重复处理（使用 stopImmediatePropagation 阻止其他监听器）
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const element = event.target;

      // 忽略高亮层自身
      if (element === this.highlightOverlay || element === this.sizeTooltip) return;

      // 智能选择：自动向上查找有效父级
      const smartElement = this.smartSelectElement(element);

      // 防抖：检查是否是重复点击（500ms 内同一元素）
      const now = Date.now();
      const xpath = this.getXPath(smartElement);
      if (this._lastClickTime && this._lastClickXpath === xpath &&
          now - this._lastClickTime < 500) {

        return;
      }
      this._lastClickTime = now;
      this._lastClickXpath = xpath;

      // 检查是否在已选中列表中（通过 XPath 比较）
      const existingIndex = this.selectedElements.findIndex(
        item => item.xpath === xpath
      );

      if (existingIndex > -1) {
        // 已选中，取消选中
        const removedItem = this.selectedElements.splice(existingIndex, 1)[0];
        this.removeSelectedHighlight(smartElement);
      } else {
        // 未选中，添加选中
        const pickerUid = this.generatePickerUid();
        const selector = this.generateSelector(smartElement);

        // 验证选择器并获取匹配数量
        let finalSelector = selector;
        let matchCount = 1;
        try {
          const found = document.querySelectorAll(selector);
          matchCount = found.length;
          if (found.length > 1) {
          } else if (found.length === 0) {
          }
        } catch (e) {
          matchCount = 0;
        }

        const elementInfo = {
          pickerUid,
          xpath,
          selector: finalSelector,
          matchCount,
          tagName: smartElement.tagName.toLowerCase(),
          id: smartElement.id || '',
          className: typeof smartElement.className === 'string' ? smartElement.className : ''
        };
        this.selectedElements.push(elementInfo);
        this.addSelectedHighlight(smartElement, pickerUid);
      }

      // 通知选中状态变化
      const messageData = {
        type: 'ELEMENT_SELECTION_CHANGED',
        elements: this.selectedElements.map(item => ({
          pickerUid: item.pickerUid,
          selector: item.selector,
          matchCount: item.matchCount || 1,
          tagName: item.tagName,
          id: item.id,
          className: item.className
        }))
      };


      if (messageData.elements.length > 0) {

      }
      this.sendMessage(messageData);
    }

    /**
     * 获取元素的 XPath（唯一标识）
     */
    getXPath(element) {
      if (!element || element === document.body) return '/html/body';
      if (element === document.documentElement) return '/html';

      // 如果元素有 ID，使用 ID
      if (element.id && !element.id.includes(' ') && !/^\d/.test(element.id)) {
        return '//*[@id="' + element.id + '"]';
      }

      // 否则构建路径
      const parts = [];
      let current = element;

      while (current && current.nodeType === Node.ELEMENT_NODE) {
        let index = 1;
        let sibling = current.previousSibling;

        // 计算同类型兄弟元素中的位置
        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === current.tagName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }

        const tagName = current.tagName.toLowerCase();
        const part = tagName + '[' + index + ']';
        parts.unshift(part);

        if (current === document.body) break;
        current = current.parentNode;
      }

      return '/' + parts.join('/');
    }

    /**
     * 通过 XPath 获取元素
     */
    getElementByXPath(xpath) {
      try {
        const result = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        );
        return result.singleNodeValue;
      } catch (e) {
        return null;
      }
    }

    /**
     * 键盘按下处理
     */
    onKeyDown(event) {
      if (!this.isActive) return;

      // Ctrl/Cmd 按下进入多选模式
      if (event.ctrlKey || event.metaKey) {
        this.multiSelectMode = true;
      }

      // Esc 退出选择模式
      if (event.key === 'Escape') {
        this.stop();
      }
    }

    /**
     * 键盘释放处理
     */
    onKeyUp(event) {
      if (!this.isActive) return;

      // Ctrl/Cmd 释放退出多选模式
      if (!event.ctrlKey && !event.metaKey) {
        this.multiSelectMode = false;
      }
    }

    /**
     * 显示高亮和尺寸信息
     */
    showHighlight(element) {
      if (!this.highlightOverlay) return;

      const rect = element.getBoundingClientRect();

      // 检查元素是否在视口内
      const isInViewport = (
        rect.top < window.innerHeight &&
        rect.bottom > 0 &&
        rect.left < window.innerWidth &&
        rect.right > 0
      );

      if (!isInViewport) {
        this.hideHighlight();
        return;
      }

      // 更新高亮框
      this.highlightOverlay.style.display = 'block';
      this.highlightOverlay.style.left = `${rect.left}px`;
      this.highlightOverlay.style.top = `${rect.top}px`;
      this.highlightOverlay.style.width = `${rect.width}px`;
      this.highlightOverlay.style.height = `${rect.height}px`;

      // 更新尺寸提示
      if (this.sizeTooltip) {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        const tagName = element.tagName.toLowerCase();
        const idStr = element.id ? `#${element.id}` : '';

        // 使用 textContent 避免 TrustedHTML 错误
        const strongEl = document.createElement('strong');
        strongEl.textContent = `${tagName}${idStr}`;
        this.sizeTooltip.textContent = '';
        this.sizeTooltip.appendChild(strongEl);
        this.sizeTooltip.appendChild(document.createTextNode(` ${width} × ${height}`));
        this.sizeTooltip.style.display = 'block';

        // 定位尺寸提示（在高亮框上方或下方）
        const tooltipHeight = 24;
        let tooltipTop = rect.top - tooltipHeight - 4;
        let tooltipLeft = rect.left;

        // 如果上方空间不够，放到下方
        if (tooltipTop < 0) {
          tooltipTop = rect.bottom + 4;
        }

        // 确保不超出右边界
        const tooltipWidth = this.sizeTooltip.offsetWidth || 150;
        if (tooltipLeft + tooltipWidth > window.innerWidth) {
          tooltipLeft = window.innerWidth - tooltipWidth - 10;
        }

        this.sizeTooltip.style.top = `${tooltipTop}px`;
        this.sizeTooltip.style.left = `${tooltipLeft}px`;
      }
    }

    /**
     * 隐藏高亮和尺寸信息
     */
    hideHighlight() {
      if (this.highlightOverlay) {
        this.highlightOverlay.style.display = 'none';
      }
      if (this.sizeTooltip) {
        this.sizeTooltip.style.display = 'none';
      }
    }

    /**
     * 添加选中高亮样式
     */
    addSelectedHighlight(element, pickerUid) {

      element.setAttribute('data-ep-selected', 'true');
      element.setAttribute('data-ep-uid', pickerUid);
      // 强制重绘
      void element.offsetHeight;
    }

    /**
     * 移除选中高亮样式（通过唯一 ID）
     */
    removeSelectedHighlight(element) {

      element.removeAttribute('data-ep-selected');
      element.removeAttribute('data-ep-uid');
      // 强制重绘
      void element.offsetHeight;
    }

    /**
     * 通过唯一 ID 移除元素高亮
     */
    removeHighlightByUid(pickerUid) {
      if (!pickerUid) return false;

      // 通过唯一 ID 属性查找元素
      const element = document.querySelector(`[data-ep-uid="${pickerUid}"]`);
      if (element) {
        element.removeAttribute('data-ep-selected');
        element.removeAttribute('data-ep-uid');

        return true;
      }
      return false;
    }

    /**
     * 清除所有选中高亮
     */
    clearSelectedHighlights() {
      // 通过属性选择器找到所有标记的元素
      document.querySelectorAll('[data-ep-uid]').forEach(el => {
        el.removeAttribute('data-ep-selected');
        el.removeAttribute('data-ep-uid');
      });
    }

    /**
     * 清除所有选中
     */
    clearSelection() {
      this.clearSelectedHighlights();
      this.selectedElements = [];
      this.currentHoveredElement = null;

      // 隐藏高亮框
      this.hideHighlight();

      this.sendMessage({
        type: 'ELEMENT_SELECTION_CHANGED',
        elements: []
      });
    }

    /**
     * 生成 CSS 选择器
     * 确保返回的选择器精确匹配目标元素
     */
    generateSelector(element) {
      if (!element || !element.tagName) return '';
      if (element === document.body) return 'body';
      if (element === document.documentElement) return 'html';

      // === Helper Functions ===
      const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\d/.test(node.id);

      const getValidClasses = (node) => {
        if (!node.className || typeof node.className !== 'string') return [];
        return node.className.trim().split(' ').filter(c => {
          if (!c || /^[0-9]/.test(c)) return false;
          if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_)/.test(c) || c.length > 30) return false;
          return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
        });
      };

      const getValidAttributes = (node) => {
        if (!node.attributes) return [];
        // 排除：脚本添加的属性、样式属性、内容属性（每个元素都不同的）
        const skipAttrs = [
          // 脚本添加的属性
          'data-ep-selected', 'data-ep-uid',
          // 基础属性
          'class', 'id', 'style',
          // 内容属性（每个元素不同）
          'title', 'alt', 'aria-label', 'aria-describedby', 'aria-labelledby',
          'placeholder', 'value', 'name', 'href', 'src', 'data-tooltip',
          // 状态/交互属性（不稳定）
          'tabindex', 'role', 'disabled', 'type'
        ];
        const attrs = [];
        for (const attr of node.attributes) {
          if (skipAttrs.includes(attr.name) || !attr.value || attr.value.length > 50 || /^\d+$/.test(attr.value)) continue;
          attrs.push({ name: attr.name, value: attr.value });
        }
        return attrs;
      };

      // 获取元素在同类兄弟中的索引（用于 nth-of-type）
      const getNthOfType = (node) => {
        const parent = node.parentElement;
        if (!parent) return 0;
        const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0;
      };

      const testSelector = (sel) => {
        try {
          return document.querySelectorAll(sel);
        } catch { return []; }
      };

      const isExactMatch = (sel, target) => {
        const found = testSelector(sel);
        return found.length === 1 && found[0] === target;
      };

      // === 策略1: ID ===
      if (hasValidId(element)) {
        const sel = '#' + CSS.escape(element.id);
        if (isExactMatch(sel, element)) return sel;
      }

      // === 策略2: 单class ===
      const classes = getValidClasses(element);
      const tag = element.tagName.toLowerCase();
      for (const cls of classes) {
        const sel = '.' + CSS.escape(cls);
        if (isExactMatch(sel, element)) return sel;
        const tagCls = tag + '.' + CSS.escape(cls);
        if (isExactMatch(tagCls, element)) return tagCls;
      }

      // === 策略3: 属性选择器 ===
      const attrs = getValidAttributes(element);
      for (const attr of attrs) {
        const sel = '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
        if (isExactMatch(sel, element)) return sel;
        const tagAttr = tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
        if (isExactMatch(tagAttr, element)) return tagAttr;
      }

      // === 策略4: 组合 (class + attr) ===
      if (classes.length > 0 && attrs.length > 0) {
        for (const cls of classes) {
          for (const attr of attrs) {
            const sel = tag + '.' + CSS.escape(cls) + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
            if (isExactMatch(sel, element)) return sel;
          }
        }
      }

      // === 策略5: 多class组合 ===
      if (classes.length >= 2) {
        const sel = tag + '.' + classes.map(c => CSS.escape(c)).join('.');
        if (isExactMatch(sel, element)) return sel;
      }

      // === 策略6: 构建完整路径 ===
      // 收集从元素到 html 的所有节点
      const path = [];
      let cur = element;

      while (cur) {
        if (hasValidId(cur)) {
          path.unshift('#' + CSS.escape(cur.id));
          break;
        }

        const t = cur.tagName.toLowerCase();
        const c = getValidClasses(cur);
        const nth = getNthOfType(cur);
        const curAttrs = cur === element ? attrs : getValidAttributes(cur);

        // 优先使用 class，其次 nth-of-type
        if (c.length > 0) {
          path.unshift(t + '.' + CSS.escape(c[0]));
        } else if (curAttrs.length > 0) {
          path.unshift(t + '[' + CSS.escape(curAttrs[0].name) + '="' + CSS.escape(curAttrs[0].value) + '"]');
        } else if (nth > 0) {
          path.unshift(t + ':nth-of-type(' + nth + ')');
        } else {
          path.unshift(t);
        }

        if (cur === document.documentElement) break;
        cur = cur.parentElement;
      }

      // 验证并逐步扩展直到精确匹配
      let selector = path.join(' > ');
      while (!isExactMatch(selector, element)) {
        // 如果路径已经完整但仍不精确，添加更多层级
        if (path[0] === 'html') {
          // 尝试在最后一层添加属性
          const lastPart = path[path.length - 1];
          if (attrs.length > 0 && !lastPart.includes('[')) {
            path[path.length - 1] = lastPart + '[' + CSS.escape(attrs[0].name) + '="' + CSS.escape(attrs[0].value) + '"]';
          } else if (classes.length > 0 && !lastPart.includes('.')) {
            path[path.length - 1] = lastPart + '.' + CSS.escape(classes[0]);
          } else {
            break;
          }
        }
        selector = path.join(' > ');
        if (isExactMatch(selector, element)) break;
        break; // 防止无限循环
      }

      return selector;
    }

    /**
     * 获取合并后的选择器（智能版本）
     * 使用贪心算法和提前终止策略，找到能精确匹配所有元素的最简选择器
     */
    getMergedSelector() {
      if (this.selectedElements.length === 0) return '';
      if (this.selectedElements.length === 1) return this.selectedElements[0].selector;

      // 获取所有元素的实际引用
      const elements = this.selectedElements.map(item => this.getElementByXPath(item.xpath)).filter(el => el);

      if (elements.length === 0) return this.selectedElements.map(item => item.selector).join(', ');

      // 尝试智能合并
      const smartMerged = this._smartMergeSelectors(elements);
      if (smartMerged) return smartMerged;

      // 回退到逗号分隔
      const refinedSelectors = elements.map(el => this.generateSelector(el));
      return refinedSelectors.join(', ');
    }

    /**
     * 智能合并选择器 - 贪心算法 + 提前终止
     * @param {Element[]} elements - 要合并的元素数组
     * @returns {string|null} - 合并后的选择器，如果没有共同模式则返回 null
     */
    _smartMergeSelectors(elements) {
      if (elements.length < 2) return null;

      // === 提取所有元素的特征 ===
      const features = elements.map(el => this._extractElementFeatures(el));

      // === 找出共同特征 ===
      const common = this._findCommonFeatures(features);

      // === 生成候选选择器（按长度排序，贪心：先测试短的）===
      const candidates = this._generateMergedCandidates(elements, common);

      // === 测试每个候选（提前终止：第一个精确匹配即返回）===
      for (const candidate of candidates) {
        if (this._isExactMatchForAll(candidate, elements)) {
          return candidate;
        }
      }

      return null;
    }

    /**
     * 提取元素的所有可用特征
     */
    _extractElementFeatures(element) {
      const getValidClasses = (node) => {
        if (!node.className || typeof node.className !== 'string') return [];
        return node.className.trim().split(' ').filter(c => {
          if (!c || /^[0-9]/.test(c)) return false;
          if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_)/.test(c) || c.length > 30) return false;
          return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
        });
      };

      const getValidAttributes = (node) => {
        if (!node.attributes) return [];
        const skipAttrs = [
          'data-ep-selected', 'data-ep-uid', 'data-element-picker-uid',
          'class', 'id', 'style', 'title', 'alt', 'aria-label', 'aria-describedby', 'aria-labelledby',
          'placeholder', 'value', 'name', 'href', 'src', 'data-tooltip',
          'tabindex', 'role', 'disabled', 'type', 'onclick', 'onchange', 'onsubmit'
        ];
        const attrs = [];
        for (const attr of node.attributes) {
          if (skipAttrs.includes(attr.name) || !attr.value || attr.value.length > 50 || /^\d+$/.test(attr.value)) continue;
          attrs.push({ name: attr.name, value: attr.value });
        }
        return attrs;
      };

      const getPath = (node) => {
        const path = [];
        let current = node;
        while (current && current !== document.body) {
          const tag = current.tagName.toLowerCase();
          const id = current.id && !current.id.includes(' ') && !/^\d/.test(current.id) ? '#' + CSS.escape(current.id) : '';
          const classes = getValidClasses(current);
          const cls = classes.length > 0 ? '.' + CSS.escape(classes[0]) : '';

          path.unshift(tag + id + cls);
          current = current.parentElement;
          if (path.length >= 5) break; // 限制路径深度
        }
        return path;
      };

      return {
        tag: element.tagName.toLowerCase(),
        id: element.id || '',
        classes: getValidClasses(element),
        attributes: getValidAttributes(element),
        path: getPath(element)
      };
    }

    /**
     * 找出所有元素的共同特征
     */
    _findCommonFeatures(featuresList) {
      const common = {
        tag: null,
        classes: [],
        attributes: [],
        commonPathPrefix: []
      };

      // 找出共同的 tag
      const tags = new Set(featuresList.map(f => f.tag));
      common.tag = tags.size === 1 ? [...tags][0] : null;

      // 找出共同的 class
      const allClasses = featuresList.map(f => new Set(f.classes));
      common.classes = [...allClasses[0]].filter(cls => allClasses.every(set => set.has(cls)));

      // 找出共同的属性（名称和值都相同）
      const allAttrs = featuresList.map(f => new Map(f.attributes.map(a => [a.name, a.value])));
      if (allAttrs.length > 0) {
        for (const [name, value] of allAttrs[0]) {
          if (allAttrs.every(map => map.get(name) === value)) {
            common.attributes.push({ name, value });
          }
        }
      }

      // 找出共同的路径前缀
      if (featuresList.length > 0) {
        const firstPath = featuresList[0].path;
        for (let i = 0; i < firstPath.length; i++) {
          const segment = firstPath[i];
          const allMatch = featuresList.every(f => f.path[i] === segment);
          if (allMatch) {
            common.commonPathPrefix.push(segment);
          } else {
            break;
          }
        }
      }

      return common;
    }

    /**
     * 生成合并候选选择器（按长度排序：短 → 长）
     */
    _generateMergedCandidates(elements, common) {
      const candidates = [];
      const tag = common.tag || elements[0].tagName.toLowerCase();

      // === 策略1: 共同的 class（最短优先）===
      for (const cls of common.classes) {
        candidates.push('.' + CSS.escape(cls));
        candidates.push(tag + '.' + CSS.escape(cls));
      }

      // === 策略2: 多个共同 class ===
      if (common.classes.length >= 2) {
        candidates.push(tag + '.' + common.classes.map(c => CSS.escape(c)).join('.'));
      }

      // === 策略3: 共同属性 ===
      for (const attr of common.attributes) {
        candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
        candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
      }

      // === 策略4: class + 属性组合 ===
      for (const cls of common.classes.slice(0, 2)) {
        for (const attr of common.attributes.slice(0, 2)) {
          candidates.push(tag + '.' + CSS.escape(cls) + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
        }
      }

      // === 策略5: 层级选择器（使用共同路径前缀）===
      if (common.commonPathPrefix.length > 0) {
        const pathStr = common.commonPathPrefix.join(' > ');
        candidates.push(pathStr + ' > ' + tag);

        // 尝试添加 class 到最后一级
        if (common.classes.length > 0) {
          candidates.push(pathStr + ' > ' + tag + '.' + CSS.escape(common.classes[0]));
        }
      }

      // === 策略6: 父级共同特征 + tag ===
      // 尝试找父级的共同特征
      const parents = elements.map(el => el.parentElement).filter(p => p);
      if (parents.length === elements.length) {
        const parentCommon = this._findCommonFeatures(parents.map(p => this._extractElementFeatures(p)));

        if (parentCommon.classes.length > 0) {
          const parentSel = (parentCommon.tag || '') + '.' + CSS.escape(parentCommon.classes[0]);
          candidates.push(parentSel + ' > ' + tag);
        }

        if (parentCommon.attributes.length > 0) {
          const attr = parentCommon.attributes[0];
          const parentSel = (parentCommon.tag || tag) + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
          candidates.push(parentSel + ' > ' + tag);
        }
      }

      // 按长度排序（贪心：优先测试短选择器）
      return candidates.sort((a, b) => a.length - b.length);
    }

    /**
     * 验证选择器是否精确匹配所有目标元素（不多不少）
     */
    _isExactMatchForAll(selector, targetElements) {
      try {
        const found = document.querySelectorAll(selector);
        if (found.length !== targetElements.length) return false;

        // 检查是否所有目标元素都被匹配
        const targetSet = new Set(targetElements);
        for (const el of found) {
          if (!targetSet.has(el)) return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    /**
     * 发送消息到 content script
     */
    sendMessage(message) {
      // 通过 DOM 事件传递消息到 content script
      const event = new CustomEvent('element-picker-message', {
        detail: message,
        bubbles: true
      });
      document.dispatchEvent(event);
    }

    /**
     * 获取当前选中元素数量
     */
    getSelectedCount() {
      return this.selectedElements.length;
    }

    /**
     * 清理资源（扩展重新加载时调用）
     */
    cleanup() {

      this.stop();
      this.clearSelectedHighlights();
      this.selectedElements = [];
      // 移除事件监听器
      document.removeEventListener('element-picker-command', this._commandHandler);
    }

    /**
     * 从 DevTools 更新选中状态（同步页面样式）
     */
    updateSelectionFromDevTools(elements) {
      // 清除所有高亮样式（通过属性选择器找到所有标记的元素）
      this.clearSelectedHighlights();

      // 重新设置高亮
      this.selectedElements = [];

      for (const item of elements) {
        try {
          // 优先通过 pickerUid 查找（如果页面上已有标记）
          let element = null;
          if (item.pickerUid) {
            element = document.querySelector(`[data-ep-uid="${item.pickerUid}"]`);
          }

          // 如果没找到，通过选择器查找
          if (!element && item.selector) {
            const found = document.querySelectorAll(item.selector);
            if (found.length > 0) {
              element = found[0];
            }
          }

          if (element) {
            // 使用传入的 pickerUid 或生成新的
            const pickerUid = item.pickerUid || this.generatePickerUid();
            this.selectedElements.push({
              pickerUid,
              xpath: this.getXPath(element),
              selector: item.selector,
              tagName: item.tagName,
              id: item.id,
              className: item.className
            });
            this.addSelectedHighlight(element, pickerUid);
          }
        } catch (e) {
          // 选择器无效，跳过
        }
      }
    }

    /**
     * 根据选择器移除单个元素的高亮（通过唯一 ID 精确定位）
     */
    removeElementBySelector(selector) {
      // 通过选择器找到对应的 pickerUid
      const item = this.selectedElements.find(el => el.selector === selector);
      if (item) {
        this.removeElementByUid(item.pickerUid);
      } else {

      }
    }

    /**
     * 根据唯一 ID 移除单个元素（精确删除）
     */
    removeElementByUid(pickerUid) {
      if (!pickerUid) {

        return;
      }

      // 从选中列表中移除
      const index = this.selectedElements.findIndex(item => item.pickerUid === pickerUid);
      if (index > -1) {
        this.selectedElements.splice(index, 1);

      }

      // 通过唯一 ID 精确移除页面上对应元素的高亮样式
      this.removeHighlightByUid(pickerUid);
    }

    /**
     * 通过选择器查找元素（优先用 XPath，其次用 CSS）
     */
    findElementBySelector(selector) {
      // 先尝试用 XPath（如果存储了的话）
      // 否则用 CSS 选择器
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          return elements[0];
        }
      } catch (e) {
        // CSS 选择器无效
      }
      return null;
    }
  }

  // 创建全局实例
  const picker = new ElementPicker();

  // 添加全局样式
  const style = document.createElement('style');
  style.id = 'element-picker-styles';
  style.textContent = `
    [data-ep-selected="true"] {
      outline: 2px solid #10b981 !important;
      outline-offset: 1px !important;
    }
  `;
  document.head.appendChild(style);

  // 监听来自 content script 的消息
  document.addEventListener('element-picker-command', (event) => {
    const { action, data } = event.detail || {};

    switch (action) {
      case 'START':
        picker.start();
        break;
      case 'STOP':
        picker.stop();
        break;
      case 'TOGGLE':
        picker.toggle();
        break;
      case 'CLEAR':
        picker.clearSelection();
        break;
      case 'REMOVE_ELEMENT_HIGHLIGHT':
        // 优先使用 pickerUid，其次使用 selector（向后兼容）
        if (data?.pickerUid) {
          picker.removeElementByUid(data.pickerUid);
        } else if (data?.selector) {
          picker.removeElementBySelector(data.selector);
        }
        break;
      case 'UPDATE_SELECTION':
        // 从 DevTools 更新选中状态
        picker.updateSelectionFromDevTools(data?.elements || []);
        break;
      case 'GET_STATE':
        picker.sendMessage({
          type: 'ELEMENT_PICKER_STATE',
          isActive: picker.isActive,
          elements: picker.selectedElements.map(item => ({
            pickerUid: item.pickerUid,
            selector: item.selector,
            tagName: item.tagName,
            id: item.id,
            className: item.className
          }))
        });
        break;
    }
  });

  // 导出全局实例
  window.ElementPickerInject = picker;

})();
