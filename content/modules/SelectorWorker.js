/**
 * Web Worker 选择器计算模块
 * 在独立线程中进行复杂的选择器计算，避免阻塞主线程
 */
;(function () {
  'use strict'

  // Worker 代码（将被转换为 Blob URL）
  const workerCode = `
    // 确定性属性白名单
    const STABLE_ATTRIBUTES = new Set([
      'type', 'role', 'data-type', 'data-role', 'data-kind',
      'data-variant', 'data-size', 'data-testid', 'data-test', 'data-id',
      'lang', 'dir', 'target', 'rel', 'colspan', 'rowspan', 'scope',
      'disabled', 'readonly', 'required', 'checked', 'multiple'
    ]);

    const IGNORED_CLASS_PREFIXES = [
      'css-', 'styled-', 'sc-', 'js-', '_', '__', 'Mui', 'jss', 'css_', 'data-', 'ep-'
    ];

    // 任务处理
    self.onmessage = function(e) {
      const { type, data, taskId } = e.data;

      try {
        let result;

        switch (type) {
          case 'GENERATE_SELECTOR':
            result = generateSelector(data);
            break;

          case 'GENERATE_MERGED_SELECTOR':
            result = generateMergedSelector(data.elements);
            break;

          case 'ANALYZE_QUALITY':
            result = analyzeQuality(data.selector, data.pageInfo);
            break;

          case 'BATCH_GENERATE':
            result = data.elements.map(el => generateSelector(el));
            break;

          default:
            result = null;
        }

        self.postMessage({ type: 'RESULT', taskId, result });
      } catch (error) {
        self.postMessage({ type: 'ERROR', taskId, error: error.message });
      }
    };

    // 生成选择器
    function generateSelector(data) {
      const { tag, id, classes, attributes, path, nthOfType } = data;

      // 策略1: ID
      if (id && isValidId(id)) {
        return { selector: '#' + escapeCss(id), strategy: 'id', score: 100 };
      }

      // 策略2: 语义化 class
      const semanticClass = findSemanticClass(classes);
      if (semanticClass) {
        return {
          selector: tag + '.' + escapeCss(semanticClass),
          strategy: 'class',
          score: 85
        };
      }

      // 策略3: 属性选择器
      const stableAttr = findStableAttribute(attributes);
      if (stableAttr) {
        return {
          selector: tag + '[' + escapeCss(stableAttr.name) + '="' + escapeCss(stableAttr.value) + '"]',
          strategy: 'attribute',
          score: 75
        };
      }

      // 策略4: 路径选择器
      if (path && path.length > 0) {
        const pathSelector = buildPathSelector(path, tag, nthOfType);
        return { selector: pathSelector, strategy: 'path', score: 60 };
      }

      // 回退: 标签 + nth-of-type
      if (nthOfType > 0) {
        return { selector: tag + ':nth-of-type(' + nthOfType + ')', strategy: 'nth', score: 40 };
      }

      return { selector: tag, strategy: 'tag', score: 20 };
    }

    // 生成合并选择器
    function generateMergedSelector(elements) {
      if (!elements || elements.length === 0) return null;
      if (elements.length === 1) return generateSelector(elements[0]);

      // 找出共同特征
      const common = findCommonFeatures(elements);
      if (!common) return null;

      // 生成候选选择器
      const candidates = [];

      // 共同 class
      if (common.classes.length > 0) {
        candidates.push('.' + escapeCss(common.classes[0]));
        candidates.push(common.tag + '.' + escapeCss(common.classes[0]));
      }

      // 共同属性
      if (common.attributes.length > 0) {
        const attr = common.attributes[0];
        candidates.push('[' + escapeCss(attr.name) + '="' + escapeCss(attr.value) + '"]');
        candidates.push(common.tag + '[' + escapeCss(attr.name) + '="' + escapeCss(attr.value) + '"]');
      }

      // :is() 合并
      if (elements.length <= 10) {
        const uniqueSelectors = [...new Set(elements.map(el => {
          const r = generateSelector(el);
          return r.selector.split(' > ').pop();
        }))];
        if (uniqueSelectors.length <= 10) {
          candidates.push(common.tag + ':is(' + uniqueSelectors.join(', ') + ')');
        }
      }

      // 返回最短的候选
      candidates.sort((a, b) => a.length - b.length);
      return candidates.length > 0 ? { selector: candidates[0], strategy: 'merged', score: 70 } : null;
    }

    // 分析选择器质量
    function analyzeQuality(selector, pageInfo) {
      const analysis = {
        score: 50,
        issues: [],
        suggestions: [],
        details: {}
      };

      if (!selector) {
        analysis.issues.push('选择器为空');
        analysis.score = 0;
        return analysis;
      }

      // 长度检查
      if (selector.length > 100) {
        analysis.issues.push('选择器过长');
        analysis.suggestions.push('考虑使用更短的选择器');
        analysis.score -= 15;
      }

      // ID 检查
      if (selector.startsWith('#')) {
        analysis.score += 30;
        analysis.suggestions.push('ID 选择器，性能最佳');
        analysis.details.hasId = true;
      }

      // nth-child 检查
      if (selector.includes(':nth')) {
        analysis.issues.push('使用了位置选择器');
        analysis.suggestions.push('尝试使用属性选择器替代');
        analysis.score -= 15;
        analysis.details.hasNth = true;
      }

      // 自动生成 class 检查
      if (/[.#](css-|styled-|sc-|js-|_)/.test(selector)) {
        analysis.issues.push('包含自动生成的 class');
        analysis.suggestions.push('避免使用框架生成的 class');
        analysis.score -= 10;
      }

      // 层级深度检查
      const depth = (selector.match(/>/g) || []).length;
      if (depth > 4) {
        analysis.issues.push('选择器层级过深 (' + depth + ' 层)');
        analysis.suggestions.push('减少选择器层级');
        analysis.score -= 10;
      }
      analysis.details.depth = depth;

      // 最终分数
      analysis.score = Math.max(0, Math.min(100, analysis.score));

      return analysis;
    }

    // 辅助函数
    function isValidId(id) {
      return id && !id.includes(' ') && !/^\\d/.test(id);
    }

    function escapeCss(str) {
      return CSS ? CSS.escape(str) : str.replace(/([\\[\\]\\{\\}\\(\\)\\=\\>\\+\\*\\?\\^\\$\\|\\\\])/g, '\\\\$1');
    }

    function findSemanticClass(classes) {
      if (!classes || classes.length === 0) return null;

      const semantic = classes.find(c =>
        /^(btn|button|link|nav|menu|item|card|list|form|input|container|wrapper|header|footer|content|title|text|icon)/i.test(c)
      );
      return semantic || classes[0];
    }

    function findStableAttribute(attributes) {
      if (!attributes || attributes.length === 0) return null;

      return attributes.find(attr =>
        STABLE_ATTRIBUTES.has(attr.name) &&
        attr.value &&
        attr.value.length < 50 &&
        !/^\\d+$/.test(attr.value)
      );
    }

    function buildPathSelector(path, tag, nthOfType) {
      const parts = path.slice(0, 4); // 限制4层
      parts.push(nthOfType > 0 ? tag + ':nth-of-type(' + nthOfType + ')' : tag);
      return parts.join(' > ');
    }

    function findCommonFeatures(elements) {
      if (!elements || elements.length === 0) return null;

      const common = {
        tag: null,
        classes: [],
        attributes: []
      };

      // 共同标签
      const tags = new Set(elements.map(el => el.tag));
      if (tags.size === 1) common.tag = [...tags][0];

      // 共同 class
      if (elements[0].classes && elements[0].classes.length > 0) {
        const firstClasses = new Set(elements[0].classes);
        common.classes = [...firstClasses].filter(cls =>
          elements.every(el => el.classes && el.classes.includes(cls))
        );
      }

      // 共同属性
      if (elements[0].attributes && elements[0].attributes.length > 0) {
        for (const attr of elements[0].attributes) {
          if (elements.every(el =>
            el.attributes &&
            el.attributes.some(a => a.name === attr.name && a.value === attr.value)
          ) {
            common.attributes.push(attr);
          }
        }
      }

      return common;
    }
  `

  class SelectorWorker {
    constructor() {
      this.worker = null
      this.pendingTasks = new Map()
      this.taskIdCounter = 0
      this.init()
    }

    init() {
      // 创建 Worker Blob
      const blob = new Blob([workerCode], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)

      this.worker = new Worker(url)
      this.worker.onmessage = (e) => {
        const { type, taskId, result, error } = e.data

        const task = this.pendingTasks.get(taskId)
        if (task) {
          this.pendingTasks.delete(taskId)

          if (type === 'RESULT') {
            task.resolve(result)
          } else if (type === 'ERROR') {
            task.reject(new Error(error))
          }
        }
      }

      this.worker.onerror = (e) => {
        console.error('[SelectorWorker] Worker error:', e)
      }

      URL.revokeObjectURL(url)
    }

    /**
     * 生成选择器
     */
    generateSelector(element) {
      return new Promise((resolve, reject) => {
        const taskId = ++this.taskIdCounter
        const data = this._extractElementData(element)

        this.pendingTasks.set(taskId, { resolve, reject })
        this.worker.postMessage({
          type: 'GENERATE_SELECTOR',
          data,
          taskId,
        })
      })
    }

    /**
     * 批量生成选择器
     */
    batchGenerate(elements) {
      return new Promise((resolve, reject) => {
        const taskId = ++this.taskIdCounter
        const data = elements.map((el) => this._extractElementData(el))

        this.pendingTasks.set(taskId, { resolve, reject })
        this.worker.postMessage({
          type: 'BATCH_GENERATE',
          data: { elements: data },
          taskId,
        })
      })
    }

    /**
     * 生成合并选择器
     */
    generateMergedSelector(elements) {
      return new Promise((resolve, reject) => {
        const taskId = ++this.taskIdCounter
        const data = elements.map((el) => this._extractElementData(el))

        this.pendingTasks.set(taskId, { resolve, reject })
        this.worker.postMessage({
          type: 'GENERATE_MERGED_SELECTOR',
          data: { elements: data },
          taskId,
        })
      })
    }

    /**
     * 分析选择器质量
     */
    analyzeQuality(selector) {
      return new Promise((resolve, reject) => {
        const taskId = ++this.taskIdCounter

        this.pendingTasks.set(taskId, { resolve, reject })
        this.worker.postMessage({
          type: 'ANALYZE_QUALITY',
          data: { selector },
          taskId,
        })
      })
    }

    /**
     * 提取元素数据（用于传递给 Worker）
     */
    _extractElementData(element) {
      if (!element || !element.tagName) return null

      const tag = element.tagName.toLowerCase()
      const id = element.id || null

      // 提取 class
      const classes = []
      if (element.className && typeof element.className === 'string') {
        const allClasses = element.className.trim().split(' ')
        for (const c of allClasses) {
          if (c && !/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|data-|ep-)/.test(c)) {
            classes.push(c)
          }
        }
      }

      // 提取属性
      const attributes = []
      if (element.attributes) {
        for (const attr of element.attributes) {
          if (
            STABLE_ATTRIBUTES.has(attr.name) &&
            attr.value &&
            attr.value.length < 50 &&
            !/^\d+$/.test(attr.value)
          ) {
            attributes.push({ name: attr.name, value: attr.value })
          }
        }
      }

      // 构建路径
      const path = []
      let current = element.parentElement
      while (current && current !== document.documentElement && path.length < 4) {
        const t = current.tagName.toLowerCase()
        const c =
          current.className && typeof current.className === 'string'
            ? current.className
                .trim()
                .split(' ')
                .find((c) => !/^(css-|styled-|sc-|js-|_)/.test(c))
            : null

        if (c) {
          path.unshift(t + '.' + c)
        } else {
          path.unshift(t)
        }
        current = current.parentElement
      }

      // 计算 nth-of-type
      let nthOfType = 0
      const parent = element.parentElement
      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === element.tagName)
        if (siblings.length > 1) {
          nthOfType = siblings.indexOf(element) + 1
        }
      }

      return { tag, id, classes, attributes, path, nthOfType }
    }

    /**
     * 销毁
     */
    destroy() {
      if (this.worker) {
        this.worker.terminate()
        this.worker = null
      }
      this.pendingTasks.clear()
    }
  }

  // 导出
  window.SelectorWorker = SelectorWorker
})()
