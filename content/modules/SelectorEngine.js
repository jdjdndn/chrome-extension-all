/**
 * 选择器生成引擎
 * 负责生成和优化 CSS 选择器
 */
(function() {
  'use strict';

  // 选择器缓存
  const selectorCache = new Map();
  const MAX_CACHE_SIZE = 100;

  // 确定性属性白名单
  const STABLE_ATTRIBUTES = new Set([
    'type', 'role', 'data-type', 'data-role', 'data-kind',
    'data-variant', 'data-size', 'data-testid', 'data-test', 'data-id',
    'lang', 'dir', 'target', 'rel', 'colspan', 'rowspan', 'scope',
    'disabled', 'readonly', 'required', 'checked', 'multiple'
  ]);

  // 需要过滤的 class 前缀
  const IGNORED_CLASS_PREFIXES = [
    'css-', 'styled-', 'sc-', 'js-', '_', '__', 'Mui', 'jss', 'css_', 'data-', 'ep-'
  ];

  class SelectorEngine {
    constructor(options = {}) {
    this.strategy = options.strategy || 'prefer-class';
    this.cacheEnabled = options.cacheEnabled !== false;
  }

    /**
     * 生成唯一选择器
     */
    generateSelector(element) {
    if (!element || !element.tagName) return '';
    if (element === document.body) return 'body';
    if (element === document.documentElement) return 'html';

    // 检查缓存
    if (this.cacheEnabled) {
      const cached = this.getFromCache(element);
      if (cached && this.validateSelector(cached, element)) {
        return cached;
      }
    }

    const selector = this._generateOptimalSelector(element);

    // 存入缓存
    if (this.cacheEnabled && selector) {
      this.addToCache(element, selector);
    }

    return selector;
  }

    /**
     * 生成优化选择器
     */
  _generateOptimalSelector(element) {
    const strategies = {
      'prefer-id': () => this._tryIdFirst(element),
      'prefer-class': () => this._tryClassFirst(element),
      'prefer-attribute': () => this._tryAttributeFirst(element),
      'shortest': () => this._tryShortest(element)
    };

    // 按策略尝试
    const result = strategies[this.strategy]?.();
    if (result) return result;

    // 回退到默认策略
    return this._tryClassFirst(element) || this._tryIdFirst(element) || this._buildFullPath(element);
  }

    /**
     * 策略1: 优先 ID
     */
  _tryIdFirst(element) {
    if (this._hasValidId(element)) {
      const sel = '#' + CSS.escape(element.id);
      if (this._isExactMatch(sel, element)) return sel;
    }
    return this._tryClassFirst(element);
  }

  /**
     * 策略2: 优先 Class
     */
  _tryClassFirst(element) {
    const classes = this._getValidClasses(element);
    const tag = element.tagName.toLowerCase();

    // 单 class
    for (const cls of classes) {
      const sel = '.' + CSS.escape(cls);
      if (this._isExactMatch(sel, element)) return sel;
      const tagCls = tag + '.' + CSS.escape(cls);
      if (this._isExactMatch(tagCls, element)) return tagCls;
    }

    // 多 class 组合
    if (classes.length >= 2) {
      const sel = tag + '.' + classes.slice(0, 2).map(c => CSS.escape(c)).join('.');
      if (this._isExactMatch(sel, element)) return sel;
    }

    return this._tryAttributeFirst(element);
  }

  /**
     * 策略3: 优先属性
     */
  _tryAttributeFirst(element) {
    const attrs = this._getStableAttributes(element);
    const tag = element.tagName.toLowerCase();

    for (const attr of attrs) {
      const sel = '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
      if (this._isExactMatch(sel, element)) return sel;
      const tagAttr = tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]';
      if (this._isExactMatch(tagAttr, element)) return tagAttr;
    }

    return this._buildFullPath(element);
  }

  /**
     * 策略4: 最短选择器
     */
  _tryShortest(element) {
    const candidates = [];

    // 收集所有候选选择器
    if (this._hasValidId(element)) {
      candidates.push('#' + CSS.escape(element.id));
    }

    const classes = this._getValidClasses(element);
    const tag = element.tagName.toLowerCase();

    for (const cls of classes) {
      candidates.push('.' + CSS.escape(cls));
      candidates.push(tag + '.' + CSS.escape(cls));
    }

    const attrs = this._getStableAttributes(element);
    for (const attr of attrs) {
      candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
    }

    // 按长度排序，返回最短的有效选择器
    candidates.sort((a, b) => a.length - b.length);
    for (const sel of candidates) {
      if (this._isExactMatch(sel, element)) return sel;
    }

    return this._buildFullPath(element);
  }

  /**
     * 构建完整路径选择器
     */
  _buildFullPath(element) {
    const path = [];
    let current = element;

    while (current && current !== document.documentElement) {
      if (this._hasValidId(current)) {
        path.unshift('#' + CSS.escape(current.id));
        break;
      }

      const t = current.tagName.toLowerCase();
      const c = this._getValidClasses(current);
      const nth = this._getNthOfType(current);

      if (c.length > 0) {
        path.unshift(t + '.' + CSS.escape(c[0]));
      } else if (nth > 0) {
        path.unshift(t + ':nth-of-type(' + nth + ')');
      } else {
        path.unshift(t);
      }

      current = current.parentElement;
    }

    return path.join(' > ');
  }

  // ========== 辅助方法 ==========

  _hasValidId(element) {
    return element.id && !element.id.includes(' ') && !/^\d/.test(element.id);
  }

  _getValidClasses(element) {
    if (!element.className || typeof element.className !== 'string') return [];
    return element.className.trim().split(' ').filter(c => {
      if (!c || /^[0-9]/.test(c)) return false;
      if (IGNORED_CLASS_PREFIXES.some(prefix => c.startsWith(prefix))) return false;
      return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
    });
  }

  _getStableAttributes(element) {
    if (!element.attributes) return [];
    const attrs = [];
    for (const attr of element.attributes) {
      if (STABLE_ATTRIBUTES.has(attr.name) && attr.value && attr.value.length < 50 && !/^\d+$/.test(attr.value)) {
        attrs.push({ name: attr.name, value: attr.value });
      }
    return attrs;
  }

  _getNthOfType(element) {
    const parent = element.parentElement;
    if (!parent) return 0;
    const siblings = Array.from(parent.children).filter(c => c.tagName === element.tagName);
    return siblings.length > 1 ? siblings.indexOf(element) + 1 : 0;
  }

  _isExactMatch(selector, targetElement) {
    try {
      const found = document.querySelectorAll(selector);
      return found.length === 1 && found[0] === targetElement;
    } catch {
      return false;
    }
  }

  validateSelector(selector, element) {
    try {
      const found = document.querySelectorAll(selector);
      return found.length === 1 && found[0] === element;
    } catch {
      return false;
    }
  }

  // ========== 缓存管理 ==========

  _getElementKey(element) {
    // 使用标签名 + ID + class + 位置信息生成唯一 key
    const tag = element.tagName;
    const id = element.id || '';
    const classes = this._getValidClasses(element).join('.');
    const parent = element.parentElement;
    const index = parent ? Array.from(parent.children).indexOf(element) : 0;
    return `${tag}[${id}][${classes}][${index}]`;
  }

  getFromCache(element) {
    const key = this._getElementKey(element);
    return selectorCache.get(key);
  }

  addToCache(element, selector) {
    if (selectorCache.size >= MAX_CACHE_SIZE) {
      const firstKey = selectorCache.keys().next().value;
      selectorCache.delete(firstKey);
    }
    const key = this._getElementKey(element);
    selectorCache.set(key, selector);
  }

  clearCache() {
    selectorCache.clear();
  }

  /**
   * 批量生成选择器（用于合并）
   */
  generateMergedSelector(elements) {
    if (elements.length === 0) return '';
    if (elements.length === 1) return this.generateSelector(elements[0]);

    // 提取共同特征
    const common = this._findCommonFeatures(elements);
    if (!common) return null;

    // 生成候选选择器
    const candidates = this._generateMergedCandidates(elements, common);

    // 测试每个候选
    for (const candidate of candidates) {
      if (this._isExactMatchForAll(candidate, elements)) {
        return candidate;
      }
    }

    return null;
  }

  _findCommonFeatures(elements) {
    const common = {
      tag: null,
      classes: [],
      attributes: []
    };

    // 检查共同标签
    const tags = new Set(elements.map(el => el.tagName.toLowerCase()));
    if (tags.size === 1) common.tag = [...tags][0];

    // 检查共同 class
    const allClasses = elements.map(el => new Set(this._getValidClasses(el)));
    if (allClasses.length > 0) {
      common.classes = [...allClasses[0]].filter(cls =>
        allClasses.every(set => set.has(cls))
      );
    }

    // 检查共同属性
    const allAttrs = elements.map(el =>
      new Map(this._getStableAttributes(el).map(a => [a.name, a.value]))
    );
    if (allAttrs.length > 0) {
      for (const [name, value] of allAttrs[0]) {
        if (allAttrs.every(map => map.get(name) === value)) {
          common.attributes.push({ name, value });
        }
      }
    }

    return common;
  }

  _generateMergedCandidates(elements, common) {
    const candidates = [];
    const tag = common.tag || '*';

    // 共同 class
    for (const cls of common.classes) {
      candidates.push('.' + CSS.escape(cls));
      candidates.push(tag + '.' + CSS.escape(cls));
    }

    // 共同属性
    for (const attr of common.attributes) {
      candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
      candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
    }

    // :is() 伪类合并
    if (elements.length <= 10) {
      const parts = elements.map(el => {
        const sel = this.generateSelector(el);
        return sel.split(/ > /).pop();
      });
      if (parts.every(p => p)) {
        candidates.push(`:is(${parts.join(', ')})`);
      }
    }

    // 按长度排序
    return candidates.sort((a, b) => a.length - b.length);
  }

  _isExactMatchForAll(selector, elements) {
    try {
      const found = document.querySelectorAll(selector);
      if (found.length !== elements.length) return false;
      const set = new Set(elements);
      for (const el of found) {
        if (!set.has(el)) return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 分析选择器质量
   */
  analyzeSelectorQuality(selector) {
    const analysis = {
      score: 0,
      issues: [],
      suggestions: []
    };

    if (!selector) {
      analysis.issues.push('选择器为空');
      return analysis;
    }

    // 检查选择器长度
    if (selector.length > 100) {
      analysis.issues.push('选择器过长，可能脆弱');
      analysis.suggestions.push('考虑使用更短的选择器');
      analysis.score -= 20;
    }

    // 检查是否使用 ID
    if (selector.startsWith('#')) {
      analysis.score += 30;
      analysis.suggestions.push('ID 选择器，性能最佳');
    }

    // 检查是否使用 nth-child
    if (selector.includes(':nth')) {
      analysis.issues.push('使用了位置选择器，DOM 变化时可能失效');
      analysis.suggestions.push('尝试使用更稳定的属性选择器');
      analysis.score -= 15;
    }

    // 检查是否使用自动生成的 class
    if (/[.#](css-|styled-|sc-|js-|_)/.test(selector)) {
      analysis.issues.push('使用了自动生成的 class，可能不稳定');
      analysis.score -= 10;
    }

    // 测试选择器
    try {
      const count = document.querySelectorAll(selector).length;
      if (count === 0) {
        analysis.issues.push('选择器不匹配任何元素');
      } else if (count === 1) {
        analysis.score += 20;
      } else {
        analysis.issues.push(`选择器匹配 ${count} 个元素`);
        analysis.suggestions.push('添加更多限定条件使其唯一');
      }
    } catch {
      analysis.issues.push('选择器语法错误');
    }

    // 计算最终分数 (0-100)
    analysis.score = Math.max(0, Math.min(100, 50 + analysis.score));

    return analysis;
  }

  // 导出
  window.SelectorEngine = SelectorEngine;
})();
