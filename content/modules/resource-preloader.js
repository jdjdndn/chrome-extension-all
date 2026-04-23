/**
 * 资源预加载模块
 * 检测关键资源并添加 preload/prefetch 提示
 * 加速首屏渲染和关键资源加载
 */

(function () {
  'use strict';

  if (window.ResourcePreloader) {
    console.log('[ResourcePreloader] 已存在，跳过初始化');
    return;
  }

  const LOG_PREFIX = '[ResourcePreloader]';

  class ResourcePreloader {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.preloadJS = options.preloadJS !== false;
      this.preloadCSS = options.preloadCSS !== false;
      this.preloadFonts = options.preloadFonts !== false;
      this.preloadImages = options.preloadImages || false;
      this.maxPreloads = options.maxPreloads || 10;
      this.excludePatterns = options.excludePatterns || [];

      this.stats = {
        preloaded: 0,
        prefetched: 0,
        skipped: 0,
        details: []
      };

      this._observer = null;
      this._processedUrls = new Set();

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
     * 处理页面已有的关键资源
     */
    _processExistingResources() {
      // JS: preload关键脚本(已匹配CDN的)
      if (this.preloadJS) {
        document.querySelectorAll('script[src]').forEach(script => {
          if (this._isCritical(script.src, 'js')) {
            this._addPreload(script.src, 'script');
          }
        });
      }

      // CSS: preload样式表
      if (this.preloadCSS) {
        document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
          if (this._isCritical(link.href, 'css')) {
            this._addPreload(link.href, 'style');
          }
        });
      }

      // 字体: 从CSS中提取字体URL并preload
      if (this.preloadFonts) {
        this._preloadCriticalFonts();
      }
    }

    /**
     * 监听动态插入的资源
     */
    _setupObserver() {
      this._observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (this.stats.preloaded >= this.maxPreloads) return;

            if (node.tagName === 'SCRIPT' && node.src && this.preloadJS) {
              if (this._isCritical(node.src, 'js')) {
                this._addPreload(node.src, 'script');
              }
            }

            if (node.tagName === 'LINK' && node.rel === 'stylesheet' && this.preloadCSS) {
              if (this._isCritical(node.href, 'css')) {
                this._addPreload(node.href, 'style');
              }
            }

            // 检查子节点
            if (node.querySelectorAll) {
              node.querySelectorAll('script[src]').forEach(script => {
                if (this.stats.preloaded >= this.maxPreloads) return;
                if (this.preloadJS && this._isCritical(script.src, 'js')) {
                  this._addPreload(script.src, 'script');
                }
              });
              node.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
                if (this.stats.preloaded >= this.maxPreloads) return;
                if (this.preloadCSS && this._isCritical(link.href, 'css')) {
                  this._addPreload(link.href, 'style');
                }
              });
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
     * 判断是否为关键资源
     * 基于CDN映射表匹配(已知库=关键)
     */
    _isCritical(url, type) {
      if (!url || typeof url !== 'string') return false;
      if (this._processedUrls.has(url)) return false;
      if (this._isExcluded(url)) return false;
      if (url.startsWith('data:') || url.startsWith('blob:')) return false;

      // CDN映射表中的库视为关键资源
      if (type === 'js' && window.CDNMappings) {
        return !!window.CDNMappings.matchJSLibrary(url);
      }
      if (type === 'css' && window.CDNMappings) {
        return !!window.CDNMappings.matchCSS(url);
      }

      return false;
    }

    _isExcluded(url) {
      const defaults = [/^chrome-extension:/i, /^moz-extension:/i, /^about:/i];
      if (defaults.some(p => p.test(url))) return true;
      return this.excludePatterns.some(p => p.test(url));
    }

    /**
     * 添加preload提示
     */
    _addPreload(url, asType) {
      if (this._processedUrls.has(url)) return;
      if (this.stats.preloaded >= this.maxPreloads) {
        this.stats.skipped++;
        return;
      }

      // 检查是否已有preload
      const existing = document.querySelector(`link[rel="preload"][href="${url}"]`);
      if (existing) {
        this.stats.skipped++;
        return;
      }

      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = url;
      link.as = asType;

      if (asType === 'script') {
        link.crossOrigin = 'anonymous';
      }

      // 插入到head最前面
      const head = document.head || document.documentElement;
      head.insertBefore(link, head.firstChild);

      this._processedUrls.add(url);
      this.stats.preloaded++;

      this.stats.details.push({
        url,
        type: asType,
        action: 'preload',
        time: Date.now()
      });

      console.log(`${LOG_PREFIX} preload(${asType}): ${url}`);
    }

    /**
     * 预加载关键字体
     */
    _preloadCriticalFonts() {
      // 从已加载的CSS link中提取Google Fonts
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        const href = link.href;
        if (href && /fonts\.(googleapis|font\.im|loli\.net)/i.test(href)) {
          // 添加preconnect提示
          this._addPreconnect('https://fonts.font.im');
          this._addPreconnect('https://fonts.gstatic.com');
        }
      });

      // 检查FontAwesome
      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        if (link.href && /font-?awesome/i.test(link.href)) {
          this._addPreconnect('https://cdn.bootcdn.net');
        }
      });
    }

    /**
     * 添加preconnect提示
     */
    _addPreconnect(url) {
      if (document.querySelector(`link[rel="preconnect"][href="${url}"]`)) return;

      const link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = url;
      link.crossOrigin = 'anonymous';

      const head = document.head || document.documentElement;
      head.insertBefore(link, head.firstChild);

      this.stats.prefetched++;
      console.log(`${LOG_PREFIX} preconnect: ${url}`);
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
      this._processedUrls.clear();
      console.log(`${LOG_PREFIX} 模块已销毁`);
    }
  }

  window.ResourcePreloader = ResourcePreloader;

  console.log('[ResourcePreloader] 资源预加载模块已加载');
})();
