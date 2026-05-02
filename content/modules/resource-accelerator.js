/**
 * 资源加速器主模块 (v4)
 * 核心优化：
 * 1. 同步启动 - 不等待配置加载
 * 2. API拦截 - 拦截 createElement/appendChild 等原生方法
 * 3. 即时处理 - 在元素创建时就拦截，而非等待 DOM 插入
 * 4. 图片压缩 - Canvas重绘导出WebP/JPEG
 * 5. CDN健康探测 - 启动时探测CDN可用性
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

  // ========== 全局状态（同步初始化）==========
  const state = {
    config: { ...DEFAULT_CONFIG },
    cspRestricted: false,
    initialized: false,
    stats: { jsReplaced: 0, jsErrors: 0, fontsReplaced: 0, fontErrors: 0, imagesLazy: 0, imagesCompressed: 0, imagesCompressBytesSaved: 0, videosLazy: 0, preloadHints: 0, cdnLoadMs: 0, cdnLoadCount: 0 },
    // 图片压缩
    compressQueue: [],
    compressingCount: 0,
    _supportsWebP: undefined
  };

  // ========== 工具方法（同步）==========

  function isExcluded(url) {
    if (!url || typeof url !== 'string') return true;
    if (/^chrome-extension:|^moz-extension:|^about:|^data:|^javascript:/i.test(url)) return true;
    return (state.config.excludeUrls || []).some(pattern => {
      try { return new RegExp(pattern.replace(/\*/g, '.*'), 'i').test(url); } catch { return false; }
    });
  }

  function isCDNUrl(url) {
    if (!window.CDNMappings?.CDN_SOURCES) return false;
    return window.CDNMappings.CDN_SOURCES.some(cdn => {
      try { return url.includes(new URL(cdn.baseUrl).hostname); } catch { return false; }
    });
  }

  function supportsWebP() {
    if (state._supportsWebP !== undefined) return state._supportsWebP;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      state._supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
    } catch { state._supportsWebP = false; }
    return state._supportsWebP;
  }

  // ========== 核心拦截：脚本处理 ==========

  function processScript(script) {
    if (state.cspRestricted || !state.config.jsReplace) return;
    const url = script.src;
    if (!url || script.dataset._raProcessed) return;

    script.dataset._raProcessed = '1';

    if (isExcluded(url) || isCDNUrl(url)) return;

    const match = window.CDNMappings?.matchJSLibrary(url);
    if (!match) return;

    const originalSrc = script.src;
    script.dataset._originalSrc = originalSrc;

    // Preload
    addPreloadHint(match.cdnUrl, 'js');

    const fallbacks = (match.fallbackUrls || []).map(f => f.url);
    script.src = match.cdnUrl;

    script.onerror = () => {
      if (fallbacks.length > 0) {
        script.src = fallbacks.shift();
      } else {
        script.src = originalSrc;
        state.stats.jsErrors++;
      }
    };

    state.stats.jsReplaced++;
    console.log(`${LOG_PREFIX} JS: ${match.name} → ${match.cdnName}`);
  }

  // ========== 核心拦截：样式/字体处理 ==========

  function processLink(link) {
    if (state.cspRestricted || !state.config.fontReplace) return;
    const url = link.href;
    if (!url || link.dataset._raProcessed) return;

    link.dataset._raProcessed = '1';

    if (isExcluded(url) || isCDNUrl(url)) return;

    const match = window.CDNMappings?.matchFont(url) || window.CDNMappings?.matchCSS(url);
    if (!match) return;

    const originalHref = link.href;
    link.dataset._originalHref = originalHref;

    addPreloadHint(match.cdnUrl, 'css');

    const fallbacks = (match.fallbackUrls || []).map(f => f.url);
    link.href = match.cdnUrl;

    link.onerror = () => {
      if (fallbacks.length > 0) {
        link.href = fallbacks.shift();
      } else {
        link.href = originalHref;
        state.stats.fontErrors++;
      }
    };

    state.stats.fontsReplaced++;
    console.log(`${LOG_PREFIX} Font/CSS: ${match.name} → ${match.cdnName}`);
  }

  // ========== 核心拦截：图片懒加载 ==========

  function processImage(img) {
    if (!state.config.imageLazyLoad) return;
    if (img.dataset._raProcessed || !img.src || img.dataset.src || img.src.startsWith('data:')) return;
    if (img.loading === 'eager' || img.hasAttribute('data-no-lazy')) return;
    if (img.complete && img.naturalWidth > 0) return;

    img.dataset._raProcessed = '1';
    img.loading = 'lazy';
    if ('fetchPriority' in img) img.fetchPriority = 'low';

    const originalSrc = img.src;
    img.dataset.src = originalSrc;
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    img.dataset.lazyLoading = 'true';
    state.stats.imagesLazy++;

    // 图片压缩
    if (state.config.imageCompress) {
      enqueueCompress(img, originalSrc);
    }
  }

  // ========== 图片压缩 ==========

  function enqueueCompress(img, src) {
    state.compressQueue.push({ img, src });
    processCompressQueue();
  }

  async function processCompressQueue() {
    while (state.compressingCount < state.config.imageMaxConcurrency && state.compressQueue.length > 0) {
      const task = state.compressQueue.shift();
      state.compressingCount++;
      try {
        const compressed = await compressImage(task.src);
        if (compressed) {
          // 等待图片进入视口时加载压缩版本
          task.img.dataset.src = compressed;
        }
      } catch {}
      state.compressingCount--;
      processCompressQueue();
    }
  }

  async function compressImage(url) {
    // 检查域名排除
    try {
      const urlObj = new URL(url, location.href);
      if (state.config.excludeDomains.some(d => urlObj.hostname.includes(d))) return null;
    } catch { return null; }

    // 非图片类型不压缩
    if (/\.(webp|svg|gif)$/i.test(url)) return null;

    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // 小图不压缩
        const bytes = img.naturalWidth * img.naturalHeight * 4;
        if (bytes < state.config.imageMinSize) { resolve(null); return; }

        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const mimeType = supportsWebP() ? 'image/webp' : 'image/jpeg';
          canvas.toBlob(blob => {
            if (blob && blob.size < bytes) {
              state.stats.imagesCompressed++;
              state.stats.imagesCompressBytesSaved += (bytes - blob.size);
              resolve(URL.createObjectURL(blob));
            } else {
              resolve(null);
            }
          }, mimeType, state.config.imageQuality);
        } catch { resolve(null); }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // ========== Preload 提示 ==========

  function addPreloadHint(cdnUrl, type) {
    const head = document.head || document.documentElement;
    if (head.querySelector(`link[rel="preload"][href="${cdnUrl}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = cdnUrl;
    link.as = type === 'js' ? 'script' : 'style';
    head.insertBefore(link, head.firstChild);
    state.stats.preloadHints++;
  }

  // ========== API 拦截（核心优化）==========

  const _createElement = document.createElement.bind(document);
  const _appendChild = Element.prototype.appendChild;
  const _insertBefore = Element.prototype.insertBefore;

  // 拦截 createElement
  document.createElement = function(tagName, options) {
    const el = _createElement(tagName, options);
    const tag = el.tagName;

    if (tag === 'SCRIPT') {
      // 拦截 src 属性设置
      let _src = '';
      Object.defineProperty(el, 'src', {
        get() { return _src; },
        set(val) {
          _src = val;
          if (val) {
            el.setAttribute('src', val);
            // 延迟处理，等待 CDNMappings 加载
            Promise.resolve().then(() => processScript(el));
          }
        }
      });
    } else if (tag === 'LINK') {
      // 拦截 href 属性设置
      let _href = '';
      Object.defineProperty(el, 'href', {
        get() { return _href; },
        set(val) {
          _href = val;
          if (val && el.rel === 'stylesheet') {
            el.setAttribute('href', val);
            Promise.resolve().then(() => processLink(el));
          }
        }
      });
    } else if (tag === 'IMG') {
      // 拦截 src 属性设置
      let _src = '';
      Object.defineProperty(el, 'src', {
        get() { return _src; },
        set(val) {
          _src = val;
          if (val) {
            el.setAttribute('src', val);
            Promise.resolve().then(() => processImage(el));
          }
        }
      });
    }

    return el;
  };

  // 拦截 appendChild
  Element.prototype.appendChild = function(node) {
    const result = _appendChild.call(this, node);
    if (node.tagName) {
      if (node.tagName === 'SCRIPT' && node.src) processScript(node);
      else if (node.tagName === 'LINK' && node.rel === 'stylesheet') processLink(node);
      else if (node.tagName === 'IMG') processImage(node);
    }
    return result;
  };

  // 拦截 insertBefore
  Element.prototype.insertBefore = function(node, ref) {
    const result = _insertBefore.call(this, node, ref);
    if (node.tagName) {
      if (node.tagName === 'SCRIPT' && node.src) processScript(node);
      else if (node.tagName === 'LINK' && node.rel === 'stylesheet') processLink(node);
      else if (node.tagName === 'IMG') processImage(node);
    }
    return result;
  };

  // ========== MutationObserver（兜底）==========

  const _observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node.tagName) continue;
        if (node.tagName === 'SCRIPT' && node.src) processScript(node);
        else if (node.tagName === 'LINK' && node.rel === 'stylesheet') processLink(node);
        else if (node.tagName === 'IMG') processImage(node);

        if (node.querySelectorAll) {
          node.querySelectorAll('script[src]').forEach(processScript);
          node.querySelectorAll('link[rel="stylesheet"]').forEach(processLink);
          node.querySelectorAll('img[src]').forEach(processImage);
        }
      }
    }
  });

  // ========== 初始化（异步但不阻塞）==========

  async function init() {
    if (state.initialized) return;
    state.initialized = true;

    // 1. 加载配置（异步，不阻塞）
    _loadConfig();

    // 2. CSP 预检（异步，不阻塞）
    _precheckCSP();

    // 3. CDN preconnect
    _addCDNPreconnect();

    // 4. CDN健康探测（异步，不阻塞）
    window.CDNMappings?.probeAllCDNs?.();

    // 5. 启动 MutationObserver（兜底）
    _observer.observe(document.documentElement, { childList: true, subtree: true });

    // 6. 处理已有资源
    document.querySelectorAll('script[src]').forEach(processScript);
    document.querySelectorAll('link[rel="stylesheet"]').forEach(processLink);
    document.querySelectorAll('img[src]').forEach(processImage);

    // 7. 消息监听
    _initMessageListener();

    console.log(`${LOG_PREFIX} 初始化完成`);
  }

  async function _loadConfig() {
    try {
      const result = await chrome.storage.local.get(CONFIG_KEY);
      if (result[CONFIG_KEY]) {
        state.config = { ...DEFAULT_CONFIG, ...result[CONFIG_KEY] };
        if (!state.config.enabled) {
          _observer.disconnect();
        }
      }
    } catch {}
  }

  async function _precheckCSP() {
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (metaCSP) {
      const content = metaCSP.getAttribute('content') || '';
      const scriptSrc = content.match(/script-src\s+([^;]+)/);
      if (scriptSrc && !/https?:|\*\./.test(scriptSrc[1])) {
        state.cspRestricted = true;
        return;
      }
    }

    // 异步检测，不阻塞
    fetch('https://cdn.bootcdn.net/', { method: 'HEAD', mode: 'no-cors' })
      .catch(() => { state.cspRestricted = true; });
  }

  function _addCDNPreconnect() {
    if (!window.CDNMappings?.CDN_SOURCES) return;
    const head = document.head || document.documentElement;
    const priorityCDNs = ['bootcdn', 'staticfile', 'jsdelivr'];

    window.CDNMappings.CDN_SOURCES.forEach(cdn => {
      if (cdn._disabled) return;
      try {
        const origin = new URL(cdn.baseUrl).origin;
        if (document.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) return;
        const link = _createElement('link');
        link.rel = priorityCDNs.includes(cdn.id) ? 'preconnect' : 'dns-prefetch';
        link.href = origin;
        if (link.rel === 'preconnect') link.crossOrigin = 'anonymous';
        head.insertBefore(link, head.firstChild);
      } catch {}
    });
  }

  // ========== 消息监听 ==========

  function _initMessageListener() {
    chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
      if (message.type === 'RESOURCE_ACCELERATOR_GET_STATS') {
        sendResponse(getStats());
        return true;
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_CDN_HEALTH') {
        sendResponse(window.CDNMappings?.getCDNHealth?.() || {});
        return true;
      }
      if (message.type === 'RESOURCE_ACCELERATOR_CONFIG') {
        state.config = { ...state.config, ...message.data };
        if (!state.config.enabled) {
          _observer?.disconnect();
        }
        return true;
      }
    });
  }

  // ========== 导出 API ==========

  window.ResourceAccelerator = {
    init,
    getStats: () => ({ ...state.stats, cspRestricted: state.cspRestricted }),
    getConfig: () => ({ ...state.config }),
    destroy: () => {
      _observer.disconnect();
      state.compressQueue = [];
      document.createElement = _createElement;
      Element.prototype.appendChild = _appendChild;
      Element.prototype.insertBefore = _insertBefore;
      console.log(`${LOG_PREFIX} 已销毁`);
    }
  };

  // 立即初始化（同步）
  init();

})();
