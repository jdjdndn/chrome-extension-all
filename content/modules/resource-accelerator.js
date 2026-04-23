/**
 * 资源加速器主模块
 * 统一管理JS替换、字体替换、CSS加速、图片优化、资源预加载、资源去重
 * 支持替换结果缓存持久化(带TTL过期)
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[ResourceAccelerator]';
  const CACHE_KEY = 'resourceAcceleratorCache';
  const CONFIG_KEY = 'resourceAcceleratorConfig';
  const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7天过期
  const CACHE_SAVE_DELAY = 500; // debounce 500ms
  const STATS_KEY = 'resourceAcceleratorStats';

  /**
   * 默认配置
   */
  const DEFAULT_CONFIG = {
    enabled: true,
    jsReplace: true,
    fontReplace: true,
    cssReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8,
    imageMinSize: 51200,
    lazyLoadThreshold: 200,
    preloadEnabled: true,
    dedupEnabled: true,
    excludeDomains: [],
    excludeUrls: [],
    cacheEnabled: true
  };

  /**
   * ResourceAccelerator - 资源加速器主类
   */
  class ResourceAccelerator {
    constructor(options = {}) {
      this.config = { ...DEFAULT_CONFIG, ...options };

      // 缓存数据
      this.cache = {
        js: {},
        fonts: {},
        timestamp: Date.now(),
        lastSaved: 0
      };

      // debounce定时器
      this._cacheSaveTimer = null;
      this._statsSaveTimer = null;

      // 累计统计(持久化用)
      this._cumulativeStats = {
        totalJsReplaced: 0,
        totalFontsReplaced: 0,
        totalCssReplaced: 0,
        totalImagesOptimized: 0,
        totalDedupRemoved: 0
      };

      // 子模块实例
      this.modules = {
        jsReplacer: null,
        fontReplacer: null,
        cssAccelerator: null,
        imageOptimizer: null,
        preloader: null,
        deduplicator: null
      };

      // 统计数据
      this.stats = {
        js: { total: 0, replaced: 0, cached: 0, errors: 0 },
        fonts: { total: 0, replaced: 0, cached: 0, errors: 0 },
        css: { total: 0, replaced: 0, cached: 0, errors: 0 },
        images: { lazyLoaded: 0, compressed: 0, skipped: 0 },
        preload: { preloaded: 0, prefetched: 0 },
        dedup: { scripts: 0, styles: 0, removed: 0 }
      };

      // 原始方法备份
      this._originalProcessScript = null;
      this._originalProcessLink = null;

      console.log(`${LOG_PREFIX} 模块初始化完成`);
    }

    /**
     * 初始化
     */
    async init() {
      if (!this.config.enabled) {
        console.log(`${LOG_PREFIX} 模块已禁用`);
        return;
      }

      // 1. 加载配置
      await this.loadConfig();

      // 2. 加载缓存
      await this.loadCache();

      // 3. 先用缓存替换页面中已存在的资源
      this._applyCacheToPage();

      // 4. 初始化子模块
      this.initModules();

      // 5. 监听统计消息
      this.listenStats();

      // 6. 加载累计统计
      await this._loadCumulativeStats();

      console.log(`${LOG_PREFIX} 初始化完成`, {
        jsCacheCount: Object.keys(this.cache.js).length,
        fontCacheCount: Object.keys(this.cache.fonts).length
      });
    }

    /**
     * 加载配置
     */
    async loadConfig() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(CONFIG_KEY);
          if (result[CONFIG_KEY]) {
            this.config = { ...DEFAULT_CONFIG, ...result[CONFIG_KEY] };
            console.log(`${LOG_PREFIX} 配置已加载`);
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 加载配置失败:`, error.message);
      }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.set({ [CONFIG_KEY]: this.config });
          console.log(`${LOG_PREFIX} 配置已保存`);
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 保存配置失败:`, error.message);
      }
    }

    /**
     * 加载缓存
     */
    async loadCache() {
      try {
        if (!this.config.cacheEnabled) return;

        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(CACHE_KEY);
          if (result[CACHE_KEY]) {
            const loaded = result[CACHE_KEY];

            // TTL过期检查
            const now = Date.now();
            if (loaded.timestamp && (now - loaded.timestamp) > CACHE_TTL) {
              console.log(`${LOG_PREFIX} 缓存已过期，清除`);
              this.cache = { js: {}, fonts: {}, timestamp: now, lastSaved: 0 };
              return;
            }

            this.cache = loaded;
            console.log(`${LOG_PREFIX} 缓存已加载`, {
              js: Object.keys(this.cache.js || {}).length,
              fonts: Object.keys(this.cache.fonts || {}).length
            });
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 加载缓存失败:`, error.message);
      }
    }

    /**
     * 保存缓存(debounce批量写入)
     */
    saveCache() {
      if (!this.config.cacheEnabled) return;

      if (this._cacheSaveTimer) {
        clearTimeout(this._cacheSaveTimer);
      }

      this._cacheSaveTimer = setTimeout(async () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            this.cache.timestamp = Date.now();
            this.cache.lastSaved = Date.now();
            await chrome.storage.local.set({ [CACHE_KEY]: this.cache });
            console.log(`${LOG_PREFIX} 缓存已保存`);
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} 保存缓存失败:`, error.message);
        }
        this._cacheSaveTimer = null;
      }, CACHE_SAVE_DELAY);
    }

    /**
     * 生成缓存键
     */
    getCacheKey(url) {
      if (!url || typeof url !== 'string') return null;
      // 移除协议和查询参数，保留核心路径
      try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname;
      } catch {
        return url;
      }
    }

    /**
     * 应用缓存到页面已存在的资源
     */
    _applyCacheToPage() {
      if (!this.config.cacheEnabled) return;

      // 处理已存在的script标签
      if (this.config.jsReplace && Object.keys(this.cache.js).length > 0) {
        const scripts = document.querySelectorAll('script[src]');
        scripts.forEach(script => {
          const originalUrl = script.src;
          const cacheKey = this.getCacheKey(originalUrl);
          const cachedUrl = this.cache.js[cacheKey] || this.cache.js[originalUrl];
          if (cachedUrl && originalUrl !== cachedUrl) {
            script.src = cachedUrl;
            this.stats.js.cached++;
            console.log(`${LOG_PREFIX} 页面缓存命中(JS): ${cachedUrl}`);
          }
        });
      }

      // 处理已存在的link标签
      if (this.config.fontReplace && Object.keys(this.cache.fonts).length > 0) {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        links.forEach(link => {
          const originalUrl = link.href;
          const cacheKey = this.getCacheKey(originalUrl);
          const cachedUrl = this.cache.fonts[cacheKey] || this.cache.fonts[originalUrl];
          if (cachedUrl && originalUrl !== cachedUrl) {
            link.href = cachedUrl;
            this.stats.fonts.cached++;
            console.log(`${LOG_PREFIX} 页面缓存命中(字体): ${cachedUrl}`);
          }
        });
      }
    }

    /**
     * 初始化子模块
     */
    initModules() {
      // 检查当前域名是否被排除
      if (this._isDomainExcluded()) {
        console.log(`${LOG_PREFIX} 当前域名在排除列表中，跳过初始化`);
        return;
      }

      const excludePatterns = this._buildExcludePatterns();

      // JS替换模块
      if (this.config.jsReplace && window.JSReplacer) {
        this.modules.jsReplacer = new window.JSReplacer({
          enabled: this.config.enabled,
          excludePatterns
        });
        this.modules.jsReplacer.init();
        this._wrapJSReplacer();
      }

      // 字体替换模块
      if (this.config.fontReplace && window.FontReplacer) {
        this.modules.fontReplacer = new window.FontReplacer({
          enabled: this.config.enabled,
          excludePatterns
        });
        this.modules.fontReplacer.init();
        this._wrapFontReplacer();
      }

      // CSS加速模块
      if (this.config.cssReplace && window.CSSAccelerator) {
        this.modules.cssAccelerator = new window.CSSAccelerator({
          enabled: this.config.enabled,
          excludePatterns
        });
        this.modules.cssAccelerator.init();
        this._wrapCSSAccelerator();
      }

      // 图片优化模块
      if ((this.config.imageLazyLoad || this.config.imageCompress) && window.ImageOptimizer) {
        this.modules.imageOptimizer = new window.ImageOptimizer({
          lazyLoadEnabled: this.config.imageLazyLoad,
          lazyLoadThreshold: this.config.lazyLoadThreshold,
          compressEnabled: this.config.imageCompress,
          compressQuality: this.config.imageQuality,
          compressMinSize: this.config.imageMinSize
        });
        this.modules.imageOptimizer.init();
      }

      // 资源预加载模块
      if (this.config.preloadEnabled && window.ResourcePreloader) {
        this.modules.preloader = new window.ResourcePreloader({
          enabled: this.config.enabled,
          preloadJS: this.config.jsReplace,
          preloadCSS: this.config.cssReplace,
          preloadFonts: this.config.fontReplace,
          excludePatterns
        });
        this.modules.preloader.init();
      }

      // 资源去重模块
      if (this.config.dedupEnabled && window.ResourceDeduplicator) {
        this.modules.deduplicator = new window.ResourceDeduplicator({
          enabled: this.config.enabled,
          dedupJS: this.config.jsReplace,
          dedupCSS: this.config.cssReplace,
          excludePatterns
        });
        this.modules.deduplicator.init();
      }
    }

    /**
     * 检查当前域名是否被排除
     */
    _isDomainExcluded() {
      const hostname = window.location.hostname;
      return this.config.excludeDomains.some(domain =>
        hostname === domain || hostname.endsWith('.' + domain)
      );
    }

    /**
     * 构建排除模式
     */
    _buildExcludePatterns() {
      const patterns = [];

      // 添加URL排除规则
      this.config.excludeUrls.forEach(url => {
        try {
          patterns.push(new RegExp(url.replace(/\*/g, '.*'), 'i'));
        } catch {
          // 忽略无效正则
        }
      });

      return patterns;
    }

    /**
     * 包装JSReplacer的processScript方法，添加缓存逻辑
     */
    _wrapJSReplacer() {
      if (!this.modules.jsReplacer) return;

      this._originalProcessScript = this.modules.jsReplacer.processScript.bind(this.modules.jsReplacer);
      const self = this;

      this.modules.jsReplacer.processScript = function (script) {
        if (!self.config.enabled) return;

        const url = script.src;
        if (!url) return;

        // 避免重复处理
        if (self.modules.jsReplacer._processedScripts.has(script)) return;

        // 1. 先查缓存
        const cacheKey = self.getCacheKey(url);
        if (self.config.cacheEnabled && cacheKey && (self.cache.js[cacheKey] || self.cache.js[url])) {
          const cachedUrl = self.cache.js[cacheKey] || self.cache.js[url];
          if (script.src !== cachedUrl) {
            script.src = cachedUrl;
            self.stats.js.cached++;
            self.modules.jsReplacer._processedScripts.add(script);
            console.log(`${LOG_PREFIX} 缓存命中(JS): ${cachedUrl}`);
          }
          return;
        }

        // 2. 缓存未命中，走原逻辑
        const statsBefore = self.modules.jsReplacer.stats.replaced;
        self._originalProcessScript(script);

        // 3. 如果替换成功，保存到缓存
        if (self.config.cacheEnabled && self.modules.jsReplacer.stats.replaced > statsBefore) {
          const details = self.modules.jsReplacer.stats.details;
          const detail = details[details.length - 1];
          if (detail && detail.original && detail.cdn) {
            const key = self.getCacheKey(detail.original);
            self.cache.js[key] = detail.cdn;
            self.cache.js[detail.original] = detail.cdn;
            self.saveCache();
          }
        }
      };
    }

    /**
     * 包装FontReplacer的processLink方法，添加缓存逻辑
     */
    _wrapFontReplacer() {
      if (!this.modules.fontReplacer) return;

      this._originalProcessLink = this.modules.fontReplacer.processLink.bind(this.modules.fontReplacer);
      const self = this;

      this.modules.fontReplacer.processLink = function (link) {
        if (!self.config.enabled) return;

        const url = link.href;
        if (!url) return;

        // 避免重复处理
        if (self.modules.fontReplacer._processedLinks.has(link)) return;

        // 1. 先查缓存
        const cacheKey = self.getCacheKey(url);
        if (self.config.cacheEnabled && cacheKey && (self.cache.fonts[cacheKey] || self.cache.fonts[url])) {
          const cachedUrl = self.cache.fonts[cacheKey] || self.cache.fonts[url];
          if (link.href !== cachedUrl) {
            link.href = cachedUrl;
            self.stats.fonts.cached++;
            self.modules.fontReplacer._processedLinks.add(link);
            console.log(`${LOG_PREFIX} 缓存命中(字体): ${cachedUrl}`);
          }
          return;
        }

        // 2. 缓存未命中，走原逻辑
        const statsBefore = self.modules.fontReplacer.stats.replaced;
        self._originalProcessLink(link);

        // 3. 如果替换成功，保存到缓存
        if (self.config.cacheEnabled && self.modules.fontReplacer.stats.replaced > statsBefore) {
          const details = self.modules.fontReplacer.stats.details;
          const detail = details[details.length - 1];
          if (detail && detail.original && detail.cdn) {
            const key = self.getCacheKey(detail.original);
            self.cache.fonts[key] = detail.cdn;
            self.cache.fonts[detail.original] = detail.cdn;
            self.saveCache();
          }
        }
      };
    }

    /**
     * 包装CSSAccelerator的processLink方法，添加缓存逻辑
     */
    _wrapCSSAccelerator() {
      if (!this.modules.cssAccelerator) return;

      const origProcess = this.modules.cssAccelerator.processLink.bind(this.modules.cssAccelerator);
      this._originalProcessCSSLink = origProcess;
      const self = this;

      this.modules.cssAccelerator.processLink = function (link) {
        if (!self.config.enabled) return;

        const url = link.href;
        if (!url) return;

        if (self.modules.cssAccelerator._processedLinks.has(link)) return;

        // 查缓存
        const cacheKey = self.getCacheKey(url);
        if (self.config.cacheEnabled && cacheKey && (self.cache.css?.[cacheKey] || self.cache.css?.[url])) {
          const cachedUrl = self.cache.css[cacheKey] || self.cache.css[url];
          if (link.href !== cachedUrl) {
            link.href = cachedUrl;
            self.stats.css.cached++;
            self.modules.cssAccelerator._processedLinks.add(link);
            console.log(`${LOG_PREFIX} 缓存命中(CSS): ${cachedUrl}`);
          }
          return;
        }

        // 缓存未命中
        const statsBefore = self.modules.cssAccelerator.stats.replaced;
        origProcess(link);

        // 保存到缓存
        if (self.config.cacheEnabled && self.modules.cssAccelerator.stats.replaced > statsBefore) {
          if (!self.cache.css) self.cache.css = {};
          const details = self.modules.cssAccelerator.stats.details;
          const detail = details[details.length - 1];
          if (detail && detail.original && detail.cdn) {
            const key = self.getCacheKey(detail.original);
            self.cache.css[key] = detail.cdn;
            self.cache.css[detail.original] = detail.cdn;
            self.saveCache();
          }
        }
      };
    }

    /**
     * 监听统计消息和配置更新
     */
    listenStats() {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          // 处理配置更新
          if (message.type === 'RESOURCE_ACCELERATOR_CONFIG') {
            this.updateConfig(message.data);
            return false;
          }

          // 返回统计信息
          if (message.type === 'RESOURCE_ACCELERATOR_GET_STATS') {
            sendResponse(this.getStats());
            return true;
          }

          // 清除缓存
          if (message.type === 'RESOURCE_ACCELERATOR_CLEAR_CACHE') {
            this.clearCache().then(() => sendResponse({ cleared: true }));
            return true;
          }

          // 处理统计消息
          this.updateStats(message);
          return false;
        });
      }
    }

    /**
     * 更新统计
     */
    updateStats(message) {
      if (!message || !message.type) return;

      switch (message.type) {
        case 'JS_REPLACER_STATS':
          this.stats.js.replaced++;
          this._cumulativeStats.totalJsReplaced++;
          break;
        case 'FONT_REPLACER_STATS':
          this.stats.fonts.replaced++;
          this._cumulativeStats.totalFontsReplaced++;
          break;
        case 'CSS_ACCELERATOR_STATS':
          this.stats.css.replaced++;
          this._cumulativeStats.totalCssReplaced++;
          break;
        default:
          break;
      }

      this._saveCumulativeStats();
    }

    /**
     * 加载累计统计
     */
    async _loadCumulativeStats() {
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          const result = await chrome.storage.local.get(STATS_KEY);
          if (result[STATS_KEY]) {
            this._cumulativeStats = { ...this._cumulativeStats, ...result[STATS_KEY] };
          }
        }
      } catch (error) {
        console.warn(`${LOG_PREFIX} 加载累计统计失败:`, error.message);
      }
    }

    /**
     * 保存累计统计(debounce)
     */
    _saveCumulativeStats() {
      if (this._statsSaveTimer) {
        clearTimeout(this._statsSaveTimer);
      }

      this._statsSaveTimer = setTimeout(async () => {
        try {
          if (typeof chrome !== 'undefined' && chrome.storage?.local) {
            await chrome.storage.local.set({ [STATS_KEY]: this._cumulativeStats });
          }
        } catch (error) {
          console.warn(`${LOG_PREFIX} 保存累计统计失败:`, error.message);
        }
        this._statsSaveTimer = null;
      }, CACHE_SAVE_DELAY);
    }

    /**
     * 获取统计信息
     */
    getStats() {
      const jsStats = this.modules.jsReplacer?.getStats() || this.stats.js;
      const fontStats = this.modules.fontReplacer?.getStats() || this.stats.fonts;
      const cssStats = this.modules.cssAccelerator?.getStats() || this.stats.css;
      const imageStats = this.modules.imageOptimizer?.getStats() || this.stats.images;
      const preloadStats = this.modules.preloader?.getStats() || this.stats.preload;
      const dedupStats = this.modules.deduplicator?.getStats() || this.stats.dedup;

      return {
        enabled: this.config.enabled,
        js: { ...jsStats, cached: this.stats.js.cached },
        fonts: { ...fontStats, cached: this.stats.fonts.cached },
        css: { ...cssStats, cached: this.stats.css.cached },
        images: imageStats,
        preload: preloadStats,
        dedup: dedupStats,
        cache: {
          jsCount: Object.keys(this.cache.js).length,
          fontCount: Object.keys(this.cache.fonts).length,
          cssCount: Object.keys(this.cache.css || {}).length,
          timestamp: this.cache.timestamp
        }
      };
    }

    /**
     * 更新配置
     */
    async updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      await this.saveConfig();

      // 同步更新子模块
      if (this.modules.jsReplacer) {
        this.modules.jsReplacer.enabled = this.config.jsReplace && this.config.enabled;
      }
      if (this.modules.fontReplacer) {
        this.modules.fontReplacer.enabled = this.config.fontReplace && this.config.enabled;
      }
      if (this.modules.cssAccelerator) {
        this.modules.cssAccelerator.enabled = this.config.cssReplace && this.config.enabled;
      }
      if (this.modules.imageOptimizer) {
        if (this.config.imageLazyLoad) {
          this.modules.imageOptimizer.enableLazyLoad();
        } else {
          this.modules.imageOptimizer.disableLazyLoad();
        }
        if (this.config.imageCompress) {
          this.modules.imageOptimizer.enableCompress();
        } else {
          this.modules.imageOptimizer.disableCompress();
        }
      }
      if (this.modules.preloader) {
        this.modules.preloader.enabled = this.config.preloadEnabled && this.config.enabled;
      }
      if (this.modules.deduplicator) {
        this.modules.deduplicator.enabled = this.config.dedupEnabled && this.config.enabled;
      }

      console.log(`${LOG_PREFIX} 配置已更新`, newConfig);
    }

    /**
     * 清除缓存
     */
    async clearCache() {
      this.cache = {
        js: {},
        fonts: {},
        css: {},
        timestamp: Date.now(),
        lastSaved: 0
      };

      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          await chrome.storage.local.remove(CACHE_KEY);
        }
        console.log(`${LOG_PREFIX} 缓存已清除`);
      } catch (error) {
        console.warn(`${LOG_PREFIX} 清除缓存失败:`, error.message);
      }
    }

    /**
     * 启用模块
     */
    enable() {
      this.config.enabled = true;

      if (this.modules.jsReplacer) this.modules.jsReplacer.enable();
      if (this.modules.fontReplacer) this.modules.fontReplacer.enable();
      if (this.modules.cssAccelerator) this.modules.cssAccelerator.enable();
      if (this.modules.imageOptimizer) this.modules.imageOptimizer.init();
      if (this.modules.preloader) this.modules.preloader.enable();
      if (this.modules.deduplicator) this.modules.deduplicator.enable();

      console.log(`${LOG_PREFIX} 模块已启用`);
    }

    /**
     * 禁用模块
     */
    disable() {
      this.config.enabled = false;

      if (this.modules.jsReplacer) this.modules.jsReplacer.disable();
      if (this.modules.fontReplacer) this.modules.fontReplacer.disable();
      if (this.modules.cssAccelerator) this.modules.cssAccelerator.disable();
      if (this.modules.imageOptimizer) this.modules.imageOptimizer.disableLazyLoad();
      if (this.modules.preloader) this.modules.preloader.disable();
      if (this.modules.deduplicator) this.modules.deduplicator.disable();

      console.log(`${LOG_PREFIX} 模块已禁用`);
    }

    /**
     * 销毁模块
     */
    destroy() {
      // 恢复原始方法
      if (this._originalProcessScript && this.modules.jsReplacer) {
        this.modules.jsReplacer.processScript = this._originalProcessScript;
      }
      if (this._originalProcessLink && this.modules.fontReplacer) {
        this.modules.fontReplacer.processLink = this._originalProcessLink;
      }
      if (this._originalProcessCSSLink && this.modules.cssAccelerator) {
        this.modules.cssAccelerator.processLink = this._originalProcessCSSLink;
      }

      // 销毁子模块
      const moduleNames = ['jsReplacer', 'fontReplacer', 'cssAccelerator', 'imageOptimizer', 'preloader', 'deduplicator'];
      moduleNames.forEach(name => {
        if (this.modules[name]) {
          this.modules[name].destroy();
          this.modules[name] = null;
        }
      });

      // 清理debounce定时器
      if (this._cacheSaveTimer) {
        clearTimeout(this._cacheSaveTimer);
        this._cacheSaveTimer = null;
      }

      // 重置状态
      this.config.enabled = false;
      this._originalProcessScript = null;
      this._originalProcessLink = null;
      this._originalProcessCSSLink = null;

      console.log(`${LOG_PREFIX} 模块已销毁`);
    }
  }

  // 导出
  window.ResourceAccelerator = ResourceAccelerator;

  // 自动初始化
  const autoInit = () => {
    if (window.resourceAcceleratorInstance) {
      console.log(`${LOG_PREFIX} 已存在实例，跳过自动初始化`);
      return;
    }

    const accelerator = new ResourceAccelerator();
    accelerator.init().then(() => {
      window.resourceAcceleratorInstance = accelerator;
      console.log(`${LOG_PREFIX} 自动初始化完成`);
    }).catch(error => {
      console.error(`${LOG_PREFIX} 自动初始化失败:`, error);
    });
  };

  // 根据文档状态选择初始化时机
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInit);
  } else {
    // 延迟初始化，确保其他模块已加载
    setTimeout(autoInit, 0);
  }

})();
