/**
 * 资源加速器主模块 (v2)
 * 1个共享MutationObserver + 按需分发子模块
 * 子模块: JS替换、字体替换、图片/视频懒加载
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[ResourceAccelerator]';
  const CONFIG_KEY = 'resourceAcceleratorConfig';
  const STATS_KEY = 'resourceAcceleratorStats';

  const DEFAULT_CONFIG = {
    enabled: true,
    jsReplace: true,
    fontReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8,
    imageMinSize: 102400,  // 100KB
    imageMaxConcurrency: 3,
    lazyLoadThreshold: 200,
    excludeDomains: [],
    excludeUrls: []
  };

  class ResourceAccelerator {
    constructor(options = {}) {
      this.config = { ...DEFAULT_CONFIG, ...options };
      this._observer = null;       // 共享MutationObserver
      this._ioObserver = null;     // IntersectionObserver(懒加载用)
      this._processedScripts = new WeakMap();  // script → originalSrc
      this._processedLinks = new WeakMap();    // link → originalHref
      this._processedImages = new WeakSet();
      this._processedVideos = new WeakSet();
      this._cspRestricted = undefined;
      this._stats = { jsReplaced: 0, jsErrors: 0, fontsReplaced: 0, fontErrors: 0, imagesLazy: 0, imagesCompressed: 0, imagesCompressBytesSaved: 0, videosLazy: 0, preloadHints: 0, cdnLoadMs: 0, cdnLoadCount: 0 };
      this._cumulativeStats = null;
      this._perfObserver = null;
      // 图片压缩
      this._compressQueue = [];
      this._compressingCount = 0;
      this._supportsWebP = undefined;
    }

    async init() {
      if (!this.config.enabled) return;

      // 1. 加载配置
      await this._loadConfig();
      if (!this.config.enabled) return;

      // 2. CSP预检
      await this._precheckCSP();

      // 3. CDN preconnect
      this._addCDNPreconnect();

      // 4. CDN健康探测（异步，不阻塞）
      window.CDNMappings?.probeAllCDNs?.();

      // 5. 处理已有资源 + 启动共享Observer
      this._initSharedObserver();

      // 6. 加载累计统计
      this._loadCumulativeStats();

      // 7. 性能度量
      this._initPerfObserver();

      // 8. 消息监听
      this._initMessageListener();

      console.log(`${LOG_PREFIX} 初始化完成`, {
        cspRestricted: !!this._cspRestricted,
        jsReplace: !this._cspRestricted && this.config.jsReplace,
        fontReplace: !this._cspRestricted && this.config.fontReplace,
        lazyLoad: this.config.imageLazyLoad
      });
    }

    // ========== 共享MutationObserver ==========

    _initSharedObserver() {
      // 处理已有资源
      this._processExistingResources();

      // 启动共享Observer
      this._observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            if (!node.tagName) continue;
            const tag = node.tagName;

            if (tag === 'SCRIPT' && node.src) {
              this._onScriptAdded(node);
            } else if (tag === 'LINK' && node.rel === 'stylesheet' && node.href) {
              this._onLinkAdded(node);
            } else if (tag === 'IMG') {
              this._onImageAdded(node);
            } else if (tag === 'VIDEO') {
              this._onVideoAdded(node);
            }

            // 子元素
            if (node.querySelectorAll) {
              node.querySelectorAll('script[src]').forEach(s => this._onScriptAdded(s));
              node.querySelectorAll('link[rel="stylesheet"]').forEach(l => this._onLinkAdded(l));
              if (this.config.imageLazyLoad) {
                node.querySelectorAll('img').forEach(i => this._onImageAdded(i));
                node.querySelectorAll('video').forEach(v => this._onVideoAdded(v));
              }
            }
          }
        }
      });

      this._observer.observe(document.documentElement, {
        childList: true, subtree: true
      });
    }

    _processExistingResources() {
      // 已有脚本
      document.querySelectorAll('script[src]').forEach(s => this._onScriptAdded(s));
      // 已有样式
      document.querySelectorAll('link[rel="stylesheet"]').forEach(l => this._onLinkAdded(l));
      // 已有图片/视频
      if (this.config.imageLazyLoad) {
        document.querySelectorAll('img').forEach(i => this._onImageAdded(i));
        document.querySelectorAll('video').forEach(v => this._onVideoAdded(v));
      }
    }

    // ========== 脚本处理 ==========

    _onScriptAdded(script) {
      if (this._cspRestricted || !this.config.jsReplace) return;
      const url = script.src;
      if (!url || this._processedScripts.has(script)) return;

      // 排除规则
      if (this._isExcluded(url)) return;
      if (this._isCDNUrl(url)) return;

      const match = window.CDNMappings?.matchJSLibrary(url);
      if (!match) return;

      const originalSrc = script.src;
      this._processedScripts.set(script, originalSrc);

      // Preload提示：提前发起CDN获取
      this._addPreloadHint(match.cdnUrl, 'js');

      const fallbacks = (match.fallbackUrls || []).map(f => f.url);
      script.src = match.cdnUrl;

      script.onerror = () => {
        if (fallbacks.length > 0) {
          script.src = fallbacks.shift();
        } else {
          this._processedScripts.delete(script);
          script.src = originalSrc;
          this._stats.jsErrors++;
        }
      };

      this._stats.jsReplaced++;
      console.log(`${LOG_PREFIX} JS: ${match.name} → ${match.cdnName}`);
    }

    // ========== 字体/样式处理 ==========

    _onLinkAdded(link) {
      if (this._cspRestricted || !this.config.fontReplace) return;
      const url = link.href;
      if (!url || this._processedLinks.has(link)) return;

      if (this._isExcluded(url)) return;
      if (this._isCDNUrl(url)) return;

      const match = window.CDNMappings?.matchFont(url) || window.CDNMappings?.matchCSS(url);
      if (!match) return;

      const originalHref = link.href;
      this._processedLinks.set(link, originalHref);

      // Preload提示：提前发起CDN获取
      this._addPreloadHint(match.cdnUrl, 'css');

      const fallbacks = (match.fallbackUrls || []).map(f => f.url);
      link.href = match.cdnUrl;

      link.onerror = () => {
        if (fallbacks.length > 0) {
          link.href = fallbacks.shift();
        } else {
          this._processedLinks.delete(link);
          link.href = originalHref;
          this._stats.fontErrors++;
        }
      };

      this._stats.fontsReplaced++;
      console.log(`${LOG_PREFIX} Font/CSS: ${match.name} → ${match.cdnName}`);
    }

    // ========== 图片懒加载 ==========

    _onImageAdded(img) {
      if (!this.config.imageLazyLoad) return;
      if (this._processedImages.has(img)) return;
      if (!img.src || img.dataset.src || img.src.startsWith('data:')) return;

      // 排除已有loading属性的
      if (img.loading === 'eager' || img.hasAttribute('data-no-lazy')) return;

      // 已完成加载的图片跳过
      if (img.complete && img.naturalWidth > 0) return;

      // 原生懒加载属性（补充保障）
      img.loading = 'lazy';
      if ('fetchPriority' in img) img.fetchPriority = 'low';

      this._initIntersectionObserver();

      img.dataset.src = img.src;
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      img.dataset.lazyLoading = 'true';
      this._processedImages.add(img);
      this._ioObserver.observe(img);
    }

    // ========== 视频懒加载 ==========

    _onVideoAdded(video) {
      if (!this.config.imageLazyLoad) return;
      if (this._processedVideos.has(video)) return;
      if (video.preload === 'none') return;

      const sources = video.querySelectorAll('source');
      if (!video.src && sources.length === 0) return;

      this._initIntersectionObserver();

      if (video.src) {
        video.dataset.src = video.src;
        video.src = '';
      }
      sources.forEach(s => {
        if (s.src) { s.dataset.src = s.src; s.src = ''; }
      });

      video.preload = 'none';
      video.dataset.videoLazyLoading = 'true';
      this._processedVideos.add(video);
      this._ioObserver.observe(video);
    }

    // ========== IntersectionObserver(懒加载共用) ==========

    _initIntersectionObserver() {
      if (this._ioObserver) return;
      this._ioObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target;
          if (el.tagName === 'VIDEO') {
            this._loadVideo(el);
          } else {
            this._loadImage(el);
          }
          this._ioObserver.unobserve(el);
        }
      }, {
        rootMargin: `${this.config.lazyLoadThreshold || 200}px 0px`,
        threshold: 0.01
      });
    }

    _loadImage(img) {
      const src = img.dataset.src;
      if (!src) return;

      if (this.config.imageCompress) {
        this._enqueueCompress(img, src);
      } else {
        img.src = src;
      }
      img.dataset.lazyLoading = 'false';
      img.dataset.lazyLoaded = 'true';
      this._stats.imagesLazy++;
    }

    // ========== 图片压缩 ==========

    _enqueueCompress(img, src) {
      this._compressQueue.push({ img, src });
      this._processCompressQueue();
    }

    async _processCompressQueue() {
      while (this._compressingCount < this.config.imageMaxConcurrency && this._compressQueue.length > 0) {
        const task = this._compressQueue.shift();
        this._compressingCount++;
        try {
          const compressed = await this._compressImage(task.src);
          task.img.src = compressed || task.src;
        } catch {
          task.img.src = task.src;
        } finally {
          this._compressingCount--;
          this._processCompressQueue();
        }
      }
    }

    async _compressImage(url) {
      // 检查域名排除
      try {
        const urlObj = new URL(url, location.href);
        if (this.config.excludeDomains.some(d => urlObj.hostname.includes(d))) return null;
      } catch { return null; }

      // 非图片类型不压缩
      if (/\.(webp|svg|gif)$/i.test(url)) return null;

      return new Promise(resolve => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          // 小图不压缩
          const bytes = img.naturalWidth * img.naturalHeight * 4;
          if (bytes < this.config.imageMinSize) { resolve(null); return; }

          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            const mimeType = this._supportsWebP() ? 'image/webp' : 'image/jpeg';
            canvas.toBlob(blob => {
              if (blob && blob.size < bytes) {
                this._stats.imagesCompressed++;
                this._stats.imagesCompressBytesSaved += (bytes - blob.size);
                resolve(URL.createObjectURL(blob));
              } else {
                resolve(null);
              }
            }, mimeType, this.config.imageQuality);
          } catch { resolve(null); }
        };
        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    _supportsWebP() {
      if (this._supportsWebP !== undefined) return this._supportsWebP;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        this._supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      } catch { this._supportsWebP = false; }
      return this._supportsWebP;
    }

    _loadVideo(video) {
      video.querySelectorAll('source').forEach(s => {
        if (s.dataset.src) { s.src = s.dataset.src; delete s.dataset.src; }
      });
      if (video.dataset.src) { video.src = video.dataset.src; delete video.dataset.src; }
      video.dataset.videoLazyLoading = 'false';
      video.dataset.videoLazyLoaded = 'true';
      video.load();
      this._stats.videosLazy++;
    }

    // ========== CDN preconnect ==========

    _addCDNPreconnect() {
      if (!window.CDNMappings?.CDN_SOURCES) return;
      const head = document.head || document.documentElement;
      const priorityCDNs = ['bootcdn', 'staticfile', 'jsdelivr'];

      window.CDNMappings.CDN_SOURCES.forEach(cdn => {
        if (cdn._disabled) return;
        try {
          const origin = new URL(cdn.baseUrl).origin;
          if (document.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) return;
          const link = document.createElement('link');
          link.rel = priorityCDNs.includes(cdn.id) ? 'preconnect' : 'dns-prefetch';
          link.href = origin;
          if (link.rel === 'preconnect') link.crossOrigin = 'anonymous';
          head.insertBefore(link, head.firstChild);
        } catch {}
      });
    }

    // ========== Preload 提示 ==========

    _addPreloadHint(cdnUrl, type) {
      const head = document.head || document.documentElement;
      if (head.querySelector(`link[rel="preload"][href="${cdnUrl}"]`)) return;
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = cdnUrl;
      link.as = type === 'js' ? 'script' : 'style';
      head.insertBefore(link, head.firstChild);
      this._stats.preloadHints++;
    }

    // ========== 性能度量 ==========

    _initPerfObserver() {
      if (this._perfObserver) return;
      const cdnHosts = ['cdn.bootcdn.net', 'cdn.jsdelivr.net', 'cdn.staticfile.org',
        'cdnjs.cloudflare.com', 'unpkg.com', 'fonts.font.im', 'fonts.loli.net',
        'lf3-cdn-tos.bytecdntp.com', 'fonts.googleapis.cnpmjs.org'];
      try {
        this._perfObserver = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            if (cdnHosts.some(h => entry.name.includes(h))) {
              this._stats.cdnLoadMs += Math.round(entry.duration);
              this._stats.cdnLoadCount++;
            }
          }
        });
        this._perfObserver.observe({ type: 'resource', buffered: false });
      } catch {}
    }

    // ========== CSP预检 ==========

    async _precheckCSP() {
      const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
      if (metaCSP) {
        const content = metaCSP.getAttribute('content') || '';
        const scriptSrc = content.match(/script-src\s+([^;]+)/);
        if (scriptSrc && !/https?:|\*\./.test(scriptSrc[1])) {
          this._cspRestricted = true;
          return;
        }
      }

      this._cspRestricted = await new Promise(resolve => {
        let resolved = false;
        const finish = (val) => {
          if (resolved) return;
          resolved = true;
          document.removeEventListener('securitypolicyviolation', onViolation);
          if (test.parentNode) test.remove();
          resolve(val);
        };
        const onViolation = (e) => {
          if (e.blockedURL?.includes('bootcdn')) finish(true);
        };
        document.addEventListener('securitypolicyviolation', onViolation);

        const test = document.createElement('script');
        test.src = 'https://cdn.bootcdn.net/__csp_probe__';
        test.onload = () => finish(false);
        test.onerror = () => setTimeout(() => finish(false), 20);
        (document.head || document.documentElement).appendChild(test);
        setTimeout(() => finish(false), 800);
      });

      if (this._cspRestricted) console.log(`${LOG_PREFIX} CSP: 外部脚本被阻止`);
    }

    // ========== 消息监听 ==========

    _initMessageListener() {
      chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
        if (message.type === 'RESOURCE_ACCELERATOR_GET_STATS') {
          sendResponse(this.getStats());
          return true;
        }
        if (message.type === 'RESOURCE_ACCELERATOR_GET_CDN_HEALTH') {
          sendResponse(window.CDNMappings?.getCDNHealth?.() || {});
          return true;
        }
        if (message.type === 'RESOURCE_ACCELERATOR_CONFIG') {
          this.config = { ...this.config, ...message.data };
          if (!this.config.enabled) {
            this._observer?.disconnect();
          }
          return true;
        }
      });
    }

    // ========== 工具方法 ==========

    _isExcluded(url) {
      if (!url || typeof url !== 'string') return true;
      if (/^chrome-extension:|^moz-extension:|^about:|^data:|^javascript:/i.test(url)) return true;
      return (this.config.excludeUrls || []).some(pattern => {
        try { return new RegExp(pattern.replace(/\*/g, '.*'), 'i').test(url); } catch { return false; }
      });
    }

    _isCDNUrl(url) {
      if (!window.CDNMappings?.CDN_SOURCES) return false;
      return window.CDNMappings.CDN_SOURCES.some(cdn => {
        try { return url.includes(new URL(cdn.baseUrl).hostname); } catch { return false; }
      });
    }

    // ========== 配置 & 统计 ==========

    async _loadConfig() {
      try {
        const result = await chrome.storage.local.get(CONFIG_KEY);
        if (result[CONFIG_KEY]) this.config = { ...DEFAULT_CONFIG, ...result[CONFIG_KEY] };
      } catch {}
    }

    async _loadCumulativeStats() {
      try {
        const result = await chrome.storage.local.get(STATS_KEY);
        this._cumulativeStats = result[STATS_KEY] || { totalJsReplaced: 0, totalFontsReplaced: 0, totalImagesLazy: 0, totalImagesCompressed: 0, totalBytesSaved: 0 };
        this._cumulativeStats.totalJsReplaced += this._stats.jsReplaced;
        this._cumulativeStats.totalFontsReplaced += this._stats.fontsReplaced;
        this._cumulativeStats.totalImagesLazy += this._stats.imagesLazy;
        this._cumulativeStats.totalImagesCompressed += this._stats.imagesCompressed;
        this._cumulativeStats.totalBytesSaved += this._stats.imagesCompressBytesSaved;
        await chrome.storage.local.set({ [STATS_KEY]: this._cumulativeStats });
      } catch {}
    }

    getStats() { return { ...this._stats, cspRestricted: !!this._cspRestricted }; }

    restoreAll() {
      document.querySelectorAll('script[src]').forEach(s => {
        const orig = this._processedScripts.get(s);
        if (orig && s.src !== orig) s.src = orig;
      });
      document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
        const orig = this._processedLinks.get(l);
        if (orig && l.href !== orig) l.href = orig;
      });
    }

    destroy() {
      if (this._observer) { this._observer.disconnect(); this._observer = null; }
      if (this._ioObserver) { this._ioObserver.disconnect(); this._ioObserver = null; }
      if (this._perfObserver) { this._perfObserver.disconnect(); this._perfObserver = null; }
      this._compressQueue = [];
      this.restoreAll();
      this._processedScripts = new WeakMap();
      this._processedLinks = new WeakMap();
      this._processedImages = new WeakSet();
      this._processedVideos = new WeakSet();
      console.log(`${LOG_PREFIX} 已销毁`);
    }
  }

  window.ResourceAccelerator = ResourceAccelerator;

  // 自动初始化
  if (window.resourceAcceleratorInstance) {
    console.log(`${LOG_PREFIX} 已存在实例，跳过`);
  } else {
    const accelerator = new ResourceAccelerator();
    accelerator.init().then(() => {
      window.resourceAcceleratorInstance = accelerator;
    }).catch(err => console.error(`${LOG_PREFIX} 初始化失败:`, err));
  }
})();
