/**
 * 资源去重模块
 * 检测重复加载的script/link，移除多余副本
 * 基于URL标准化去重，保留首次加载
 */

(function () {
  'use strict';

  if (window.ResourceDeduplicator) {
    console.log('[ResourceDeduplicator] 已存在，跳过初始化');
    return;
  }

  const LOG_PREFIX = '[ResourceDeduplicator]';

  class ResourceDeduplicator {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.dedupJS = options.dedupJS !== false;
      this.dedupCSS = options.dedupCSS !== false;
      this.excludePatterns = options.excludePatterns || [];

      this.stats = {
        scripts: { total: 0, duplicates: 0 },
        styles: { total: 0, duplicates: 0 },
        removed: 0
      };

      this._seenUrls = new Map(); // normalizedUrl -> first element
      this._observer = null;

      console.log(`${LOG_PREFIX} 模块初始化完成`);
    }

    init() {
      if (!this.enabled) {
        console.log(`${LOG_PREFIX} 模块已禁用`);
        return;
      }

      this._processExistingResources();
      this._setupObserver();

      console.log(`${LOG_PREFIX} 初始化完成`);
    }

    /**
     * 处理已有资源
     */
    _processExistingResources() {
      if (this.dedupJS) {
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => this._checkScript(script));
      }

      if (this.dedupCSS) {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => this._checkLink(link));
      }
    }

    /**
     * 监听动态资源
     */
    _setupObserver() {
      this._observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (this.dedupJS && node.tagName === 'SCRIPT' && node.src) {
              this._checkScript(node);
            }
            if (this.dedupCSS && node.tagName === 'LINK' && node.rel === 'stylesheet') {
              this._checkLink(node);
            }

            if (node.querySelectorAll) {
              if (this.dedupJS) {
                node.querySelectorAll('script[src]').forEach(s => this._checkScript(s));
              }
              if (this.dedupCSS) {
                node.querySelectorAll('link[rel="stylesheet"]').forEach(l => this._checkLink(l));
              }
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
     * 标准化URL(移除协议、查询参数中的随机值、hash)
     */
    _normalizeUrl(url) {
      if (!url || typeof url !== 'string') return '';

      try {
        const urlObj = new URL(url);
        let normalized = urlObj.hostname + urlObj.pathname;

        // 保留关键查询参数(version等)，移除cache-buster
        const significantParams = [];
        for (const [key, value] of urlObj.searchParams) {
          // 跳过常见cache-buster参数
          if (/^(v|ver|version)$/i.test(key)) {
            significantParams.push(`${key}=${value}`);
          }
        }
        if (significantParams.length > 0) {
          normalized += '?' + significantParams.join('&');
        }

        return normalized.toLowerCase();
      } catch {
        return url.toLowerCase();
      }
    }

    /**
     * 检查script去重
     */
    _checkScript(script) {
      if (!this.enabled) return;

      const url = script.src;
      if (!url || this._isExcluded(url)) return;

      this.stats.scripts.total++;
      const normalized = this._normalizeUrl(url);

      if (this._seenUrls.has(normalized)) {
        // 检查内联内容是否一致(避免不同版本的脚本)
        const firstScript = this._seenUrls.get(normalized);
        if (firstScript.src === script.src || this._isSameResource(firstScript.src, script.src)) {
          this._removeDuplicate(script, 'script');
        }
      } else {
        this._seenUrls.set(normalized, script);
      }
    }

    /**
     * 检查link去重
     */
    _checkLink(link) {
      if (!this.enabled) return;

      const url = link.href;
      if (!url || this._isExcluded(url)) return;

      this.stats.styles.total++;
      const normalized = this._normalizeUrl(url);

      if (this._seenUrls.has(normalized)) {
        const firstLink = this._seenUrls.get(normalized);
        if (firstLink.href === link.href || this._isSameResource(firstLink.href, link.href)) {
          this._removeDuplicate(link, 'style');
        }
      } else {
        this._seenUrls.set(normalized, link);
      }
    }

    /**
     * 判断两个URL是否指向同一资源
     */
    _isSameResource(url1, url2) {
      const n1 = this._normalizeUrl(url1);
      const n2 = this._normalizeUrl(url2);
      return n1 === n2;
    }

    /**
     * 移除重复资源
     */
    _removeDuplicate(element, type) {
      // 不移除有onerror/onload回调的元素(可能是有意的重复)
      if (element.onerror || element.onload) {
        return;
      }

      // 检查是否有async/defer标记(异步脚本可能需要保留)
      if (type === 'script' && element.async && !this._seenUrls.get(this._normalizeUrl(element.src))?.async) {
        return;
      }

      element.remove();
      this.stats.removed++;

      if (type === 'script') {
        this.stats.scripts.duplicates++;
      } else {
        this.stats.styles.duplicates++;
      }

      console.log(`${LOG_PREFIX} 移除重复${type}: ${element.src || element.href}`);
    }

    _isExcluded(url) {
      const defaults = [
        /^chrome-extension:/i,
        /^moz-extension:/i,
        /^about:/i,
        /^data:/i,
        /^blob:/i
      ];
      if (defaults.some(p => p.test(url))) return true;
      return this.excludePatterns.some(p => p.test(url));
    }

    getStats() {
      return { ...this.stats, enabled: this.enabled };
    }

    enable() {
      this.enabled = true;
      console.log(`${LOG_PREFIX} 模块已启用`);
    }

    disable() {
      this.enabled = false;
      console.log(`${LOG_PREFIX} 模块已禁用`);
    }

    destroy() {
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }
      this.enabled = false;
      this._seenUrls.clear();
      console.log(`${LOG_PREFIX} 模块已销毁`);
    }
  }

  window.ResourceDeduplicator = ResourceDeduplicator;

  console.log('[ResourceDeduplicator] 资源去重模块已加载');
})();
