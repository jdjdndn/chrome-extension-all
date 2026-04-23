/**
 * JS库替换模块
 * 用公共CDN替换常见JS库，加速资源加载
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[JSReplacer]';

  class JSReplacer {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.excludePatterns = options.excludePatterns || [];
      this.reportEnabled = options.reportEnabled !== false;

      // 统计数据
      this.stats = {
        total: 0,
        replaced: 0,
        skipped: 0,
        errors: 0,
        details: []
      };

      // 内部状态
      this._observer = null;
      this._originalCreateElement = null;
      this._processedScripts = new WeakSet();

      console.log(`${LOG_PREFIX} 模块初始化完成`);
    }

    /**
     * 初始化：处理已存在script + 监听动态插入 + 拦截createElement
     */
    init() {
      if (!this.enabled) {
        console.log(`${LOG_PREFIX} 模块已禁用`);
        return;
      }

      // 1. 处理已存在的script标签
      this._processExistingScripts();

      // 2. 监听动态script插入
      this._setupMutationObserver();

      // 3. 拦截document.createElement
      this._interceptCreateElement();

      console.log(`${LOG_PREFIX} 初始化完成，开始监听`);
    }

    /**
     * 处理已存在的script标签
     */
    _processExistingScripts() {
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach(script => this.processScript(script));
    }

    /**
     * 设置MutationObserver监听动态script插入
     */
    _setupMutationObserver() {
      this._observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.tagName === 'SCRIPT' && node.src) {
              this.processScript(node);
            }
          });
        });
      });

      this._observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    /**
     * 拦截document.createElement('script')
     */
    _interceptCreateElement() {
      this._originalCreateElement = document.createElement.bind(document);

      document.createElement = (tagName, options) => {
        const element = this._originalCreateElement(tagName, options);

        if (tagName.toLowerCase() === 'script') {
          this._interceptScriptSrc(element);
        }

        return element;
      };
    }

    /**
     * 拦截script元素的src属性设置
     */
    _interceptScriptSrc(script) {
      let _src = '';
      const self = this;

      Object.defineProperty(script, 'src', {
        get() {
          return _src;
        },
        set(value) {
          _src = value;
          if (value && self.enabled) {
            // 延迟处理，确保属性设置完成
            setTimeout(() => self.processScript(script), 0);
          }
        },
        configurable: true,
        enumerable: true
      });
    }

    /**
     * 处理单个script标签
     */
    processScript(script) {
      if (!this.enabled) return;

      const url = script.src;
      if (!url) return;

      // 避免重复处理
      if (this._processedScripts.has(script)) return;
      this._processedScripts.add(script);

      this.stats.total++;

      // 检查排除规则
      if (this.shouldExclude(url)) {
        this.stats.skipped++;
        console.log(`${LOG_PREFIX} 跳过(排除规则): ${url}`);
        return;
      }

      // 检查是否已经是目标CDN
      if (this._isTargetCDN(url)) {
        this.stats.skipped++;
        return;
      }

      // 匹配CDN映射
      const match = window.CDNMappings?.matchJSLibrary(url);
      if (!match) {
        this.stats.skipped++;
        return;
      }

      // 执行替换
      try {
        const originalSrc = script.src;
        script.src = match.cdnUrl;

        this.stats.replaced++;
        console.log(`${LOG_PREFIX} 替换: ${match.name}`);
        console.log(`  原始: ${originalSrc}`);
        console.log(`  CDN: ${match.cdnUrl}`);

        // 上报统计
        this.reportReplacement(match);

        // 记录详情
        this.stats.details.push({
          name: match.name,
          original: originalSrc,
          cdn: match.cdnUrl,
          time: Date.now()
        });
      } catch (error) {
        this.stats.errors++;
        console.error(`${LOG_PREFIX} 替换失败:`, error);
      }
    }

    /**
     * 检查是否为目标CDN
     */
    _isTargetCDN(url) {
      const targetCDNs = [
        'cdn.bootcdn.net',
        'fonts.font.im',
        'fonts.loli.net'
      ];
      return targetCDNs.some(cdn => url.includes(cdn));
    }

    /**
     * 检查排除规则
     */
    shouldExclude(url) {
      if (!url || typeof url !== 'string') return true;

      // 默认排除规则
      const defaultExcludes = [
        /^chrome-extension:/i,
        /^moz-extension:/i,
        /^about:/i,
        /^data:/i,
        /^javascript:/i,
        /\/local\//i,
        /\/internal\//i
      ];

      if (defaultExcludes.some(pattern => pattern.test(url))) {
        return true;
      }

      // 用户自定义排除规则
      return this.excludePatterns.some(pattern => pattern.test(url));
    }

    /**
     * 上报统计到background
     */
    reportReplacement(match) {
      if (!this.reportEnabled) return;

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'JS_REPLACER_STATS',
            data: {
              name: match.name,
              originalUrl: match.originalUrl,
              cdnUrl: match.cdnUrl,
              cdnName: match.cdnName,
              timestamp: Date.now()
            }
          });
        }
      } catch (error) {
        // 扩展上下文无效时静默失败
        console.warn(`${LOG_PREFIX} 上报失败:`, error.message);
      }
    }

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        ...this.stats,
        enabled: this.enabled
      };
    }

    /**
     * 启用模块
     */
    enable() {
      this.enabled = true;
      console.log(`${LOG_PREFIX} 模块已启用`);
    }

    /**
     * 禁用模块
     */
    disable() {
      this.enabled = false;
      console.log(`${LOG_PREFIX} 模块已禁用`);
    }

    /**
     * 销毁模块
     */
    destroy() {
      // 停止MutationObserver
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }

      // 恢复原始createElement
      if (this._originalCreateElement) {
        document.createElement = this._originalCreateElement;
        this._originalCreateElement = null;
      }

      // 清理状态
      this.enabled = false;
      this._processedScripts = new WeakSet();

      console.log(`${LOG_PREFIX} 模块已销毁`);
    }
  }

  // 导出
  window.JSReplacer = JSReplacer;

})();
