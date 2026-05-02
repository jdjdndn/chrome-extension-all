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
    cssReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8,
    imageMinSize: 102400,  // 100KB
    imageMaxConcurrency: 3,
    lazyLoadThreshold: 200,
    excludeDomains: [],
    excludeUrls: [],
    // 性能优化配置
    maxPreloadHints: 10,  // 最大preload提示数
    maxCompressQueueSize: 50,  // 最大队列长度
    mutationBatchInterval: 50,  // mutation批量处理间隔(ms)
    enableBatchProcessing: true,  // 启用批量处理
    dedupEnabled: true,  // 资源去重
    imageMaxDimension: 2048,  // 最大输出尺寸，0=不限制
    // 第三方脚本延迟加载
    thirdPartyDeferral: {
      enabled: false,
      strategy: 'idle',  // idle | defer | block | pass
      rules: [
        { pattern: 'google-analytics.com', strategy: 'idle' },
        { pattern: 'googletagmanager.com', strategy: 'idle' },
        { pattern: 'baidu.com/hm.js', strategy: 'idle' },
        { pattern: 'cnzz.com', strategy: 'idle' },
        { pattern: 'umeng.com', strategy: 'idle' },
        { pattern: 'jsagent', strategy: 'defer' },
        { pattern: 'widget', strategy: 'defer' },
      ],
      maxDeferralMs: 10000,
    },
  };

  // ========== 全局状态（同步初始化）==========
  const state = {
    config: { ...DEFAULT_CONFIG },
    cspRestricted: false,
    initialized: false,
    stats: { jsReplaced: 0, jsErrors: 0, fontsReplaced: 0, fontErrors: 0, cssReplaced: 0, cssErrors: 0, imagesLazy: 0, imagesCompressed: 0, imagesCompressBytesSaved: 0, videosLazy: 0, preloadHints: 0, cdnLoadMs: 0, cdnLoadCount: 0, thirdPartyDeferred: 0, thirdPartyBlocked: 0 },
    // 图片压缩
    compressQueue: [],
    compressingCount: 0,
    _supportsWebP: undefined,
    // 批量处理
    _mutationBatch: [],
    _mutationTimer: null,
    _isProcessingBatch: false,
    // 压缩结果缓存（同一页面会话内避免重复压缩）
    _compressCache: new Map(),
    // 去重集合
    dedupSet: new Set(),
    // 最近50条替换记录
    recentReplacements: [],
    // 第三方脚本延迟队列
    _deferredScripts: [],
  };

  // ========== 统计持久化（防抖 + 增量）==========

  let _statsTimer = null;
  const _lastPersisted = { jsReplaced: 0, fontsReplaced: 0, cssReplaced: 0, imagesLazy: 0, imagesCompressed: 0, imagesCompressBytesSaved: 0 };

  function _persistStats() {
    if (_statsTimer) return;
    _statsTimer = setTimeout(async () => {
      _statsTimer = null;
      try {
        const result = await chrome.storage.local.get(STATS_KEY);
        const stored = result[STATS_KEY] || {};
        // 只写入自上次持久化以来的增量
        const delta = {
          totalJsReplaced: (stored.totalJsReplaced || 0) + (state.stats.jsReplaced - _lastPersisted.jsReplaced),
          totalFontsReplaced: (stored.totalFontsReplaced || 0) + (state.stats.fontsReplaced - _lastPersisted.fontsReplaced),
          totalCssReplaced: (stored.totalCssReplaced || 0) + ((state.stats.cssReplaced || 0) - _lastPersisted.cssReplaced),
          totalImagesOptimized: (stored.totalImagesOptimized || 0) + (state.stats.imagesLazy - _lastPersisted.imagesLazy),
          totalImagesCompressed: (stored.totalImagesCompressed || 0) + (state.stats.imagesCompressed - _lastPersisted.imagesCompressed),
          totalBytesSaved: (stored.totalBytesSaved || 0) + (state.stats.imagesCompressBytesSaved - _lastPersisted.imagesCompressBytesSaved),
        };
        await chrome.storage.local.set({ [STATS_KEY]: delta });
        // 更新快照
        _lastPersisted.jsReplaced = state.stats.jsReplaced;
        _lastPersisted.fontsReplaced = state.stats.fontsReplaced;
        _lastPersisted.cssReplaced = state.stats.cssReplaced || 0;
        _lastPersisted.imagesLazy = state.stats.imagesLazy;
        _lastPersisted.imagesCompressed = state.stats.imagesCompressed;
        _lastPersisted.imagesCompressBytesSaved = state.stats.imagesCompressBytesSaved;
      } catch {}
    }, 2000);
  }

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

  function getBaseDomain(hostname) {
    const parts = hostname.split('.');
    return parts.slice(-2).join('.');
  }

  function isThirdPartyScript(url) {
    try {
      const urlObj = new URL(url);
      const pageBase = getBaseDomain(location.hostname);
      const scriptBase = getBaseDomain(urlObj.hostname);
      if (pageBase === scriptBase) return false;
      if (isCDNUrl(url)) return false;
      return true;
    } catch {
      return false;
    }
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

  // ========== 第三方脚本延迟加载 ==========

  function matchDeferralRule(url) {
    const { strategy, rules } = state.config.thirdPartyDeferral;
    for (const rule of rules) {
      if (url.includes(rule.pattern)) {
        return { pattern: rule.pattern, strategy: rule.strategy || strategy };
      }
    }
    return null;
  }

  function deferScript(script, strategy) {
    if (state.cspRestricted) return;

    const src = script.src;
    script.removeAttribute('src');
    script.dataset._deferredSrc = src;
    script.dataset._deferralStrategy = strategy;
    script.dataset._raDeferralTime = Date.now();

    const loadFn = () => {
      if (script.dataset._raLoaded) return;
      script.src = script.dataset._deferredSrc;
      script.dataset._raLoaded = 'true';
      console.log(`${LOG_PREFIX} 第三方脚本延迟加载完成: ${src.substring(0, 60)}...`);
    };

    const maxMs = state.config.thirdPartyDeferral.maxDeferralMs;

    // 最大延迟时间兜底
    const forceLoadTimer = setTimeout(() => {
      if (!script.dataset._raLoaded) {
        console.log(`${LOG_PREFIX} 第三方脚本超过最大延迟，强制加载: ${src.substring(0, 60)}...`);
        loadFn();
      }
    }, maxMs);

    // 加载成功后清除定时器
    const origOnload = script.onload;
    script.onload = () => {
      clearTimeout(forceLoadTimer);
      if (origOnload) origOnload.call(script);
    };

    switch (strategy) {
      case 'idle':
        if ('requestIdleCallback' in window) {
          requestIdleCallback(loadFn, { timeout: maxMs });
        } else {
          setTimeout(loadFn, 100);
        }
        break;
      case 'defer':
        if (document.readyState === 'complete') {
          setTimeout(loadFn, 3000);
        } else {
          window.addEventListener('load', () => setTimeout(loadFn, 3000), { once: true });
        }
        break;
      case 'block':
        clearTimeout(forceLoadTimer);
        state.stats.thirdPartyBlocked++;
        console.log(`${LOG_PREFIX} 第三方脚本已阻止: ${src.substring(0, 60)}...`);
        break;
    }
  }

  // ========== 核心拦截：脚本处理 ==========

  async function processScript(script) {
    if (state.cspRestricted) return;
    const url = script.src;
    if (!url || script.dataset._raProcessed) return;

    script.dataset._raProcessed = '1';

    if (isExcluded(url) || isCDNUrl(url)) return;

    // 去重检查：同一原始URL不重复替换
    if (state.config.dedupEnabled && state.dedupSet.has(url)) return;

    // 使用异步匹配（支持 jsDelivr API 动态查询）
    const match = await window.CDNMappings?.matchJSLibraryAsync?.(url);

    // CDN 无法替换 → 尝试第三方延迟
    if (!match) {
      if (state.config.thirdPartyDeferral?.enabled && state.config.jsReplace) {
        const deferralRule = matchDeferralRule(url);
        if (deferralRule) {
          deferScript(script, deferralRule.strategy);
          state.stats.thirdPartyDeferred++;
          state.recentReplacements.push({
            type: 'thirdParty',
            name: deferralRule.pattern,
            original: url,
            strategy: deferralRule.strategy,
            timestamp: Date.now()
          });
          if (state.recentReplacements.length > 50) state.recentReplacements.shift();
          _persistStats();
          return;
        }
      }
      return;
    }

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
    state.recentReplacements.push({
      type: 'js',
      name: match.name,
      original: originalSrc,
      cdn: match.cdnUrl,
      timestamp: Date.now(),
      isAutoDetected: match.isAutoDetected,
      isDynamic: match.isDynamic
    });
    if (state.recentReplacements.length > 50) {
      state.recentReplacements.shift();
    }
    _persistStats();
    if (state.config.dedupEnabled) state.dedupSet.add(originalSrc);
    console.log(`${LOG_PREFIX} JS: ${match.name} → ${match.cdnName}${match.isDynamic ? ' (dynamic)' : ''}`);
  }

  // ========== 核心拦截：样式/字体处理 ==========

  function processLink(link) {
    if (state.cspRestricted) return;
    const url = link.href;
    if (!url || link.dataset._raProcessed) return;

    link.dataset._raProcessed = '1';

    if (isExcluded(url) || isCDNUrl(url)) return;

    // 去重检查：同一原始URL不重复替换
    if (state.config.dedupEnabled && state.dedupSet.has(url)) return;

    // 先尝试字体匹配，再尝试CSS匹配
    const fontMatch = window.CDNMappings?.matchFont(url);
    const cssMatch = !fontMatch ? window.CDNMappings?.matchCSS(url) : null;

    // 检查各自的开关
    if (fontMatch && !state.config.fontReplace) return;
    if (cssMatch && !state.config.cssReplace) return;

    const match = fontMatch || cssMatch;
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
        if (fontMatch) {
          state.stats.fontErrors++;
        } else {
          state.stats.cssErrors = (state.stats.cssErrors || 0) + 1;
        }
      }
    };

    if (fontMatch) {
      state.stats.fontsReplaced++;
    } else {
      state.stats.cssReplaced = (state.stats.cssReplaced || 0) + 1;
    }
    state.recentReplacements.push({
      type: fontMatch ? 'font' : 'css',
      name: match.name,
      original: originalHref,
      cdn: match.cdnUrl,
      timestamp: Date.now()
    });
    if (state.recentReplacements.length > 50) {
      state.recentReplacements.shift();
    }
    _persistStats();
    if (state.config.dedupEnabled) state.dedupSet.add(originalHref);
    console.log(`${LOG_PREFIX} ${fontMatch ? 'Font' : 'CSS'}: ${match.name} → ${match.cdnName}`);
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

    // 图片压缩：预压缩后直接加载
    if (state.config.imageCompress) {
      enqueueCompress(img, originalSrc);
    } else {
      // 仅懒加载，设置占位图
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      img.dataset.lazyLoading = 'true';
      state.stats.imagesLazy++;
      _persistStats();
    }
  }

  // ========== 图片压缩 ==========

  function enqueueCompress(img, src) {
    // 限制队列大小，避免内存溢出
    if (state.compressQueue.length >= state.config.maxCompressQueueSize) {
      // 队列满时直接加载原图
      img.src = src;
      img.dataset.lazyLoading = 'false';
      img.dataset.lazyLoaded = 'true';
      return;
    }
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
          // 压缩成功，直接加载压缩版本
          task.img.src = compressed;
          task.img.dataset.lazyLoading = 'false';
          task.img.dataset.lazyLoaded = 'true';
          task.img.dataset.compressed = 'true';
        } else {
          // 压缩失败或不值得压缩，回退到原图
          task.img.src = task.src;
          task.img.dataset.lazyLoading = 'false';
          task.img.dataset.lazyLoaded = 'true';
        }
      } catch {
        // 异常时回退到原图
        task.img.src = task.src;
        task.img.dataset.lazyLoading = 'false';
        task.img.dataset.lazyLoaded = 'true';
      }
      state.compressingCount--;
      processCompressQueue();
    }
  }

  async function compressImage(url) {
    // 检查缓存
    if (state._compressCache.has(url)) {
      const cached = state._compressCache.get(url);
      return cached.skip ? null : cached.result;
    }

    // 检查域名排除
    try {
      const urlObj = new URL(url, location.href);
      if (state.config.excludeDomains.some(d => urlObj.hostname.includes(d))) {
        state._compressCache.set(url, { skip: true });
        return null;
      }
    } catch {
      state._compressCache.set(url, { skip: true });
      return null;
    }

    // 非图片类型不压缩
    if (/\.(webp|svg|gif)$/i.test(url)) {
      state._compressCache.set(url, { skip: true });
      return null;
    }

    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // 如果 HEAD 获取到了大小，用实际大小判断；否则用像素估算降级
        const bytes = img.naturalWidth * img.naturalHeight * 4;
        if (bytes < state.config.imageMinSize) {
          state._compressCache.set(url, { skip: true });
          resolve(null);
          return;
        }

        try {
          const MAX_DIMENSION = state.config.imageMaxDimension || 2048;
          let { naturalWidth: w, naturalHeight: h } = img;
          if (MAX_DIMENSION > 0 && (w > MAX_DIMENSION || h > MAX_DIMENSION)) {
            const scale = MAX_DIMENSION / Math.max(w, h);
            w = Math.round(w * scale);
            h = Math.round(h * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);

          const mimeType = supportsWebP() ? 'image/webp' : 'image/jpeg';
          canvas.toBlob(blob => {
            if (blob && blob.size < bytes) {
              state.stats.imagesCompressed++;
              state.stats.imagesCompressBytesSaved += (bytes - blob.size);
              _persistStats();
              const blobUrl = URL.createObjectURL(blob);
              state._compressCache.set(url, { skip: false, result: blobUrl });
              resolve(blobUrl);
            } else {
              state._compressCache.set(url, { skip: true });
              resolve(null);
            }
          }, mimeType, state.config.imageQuality);
        } catch {
          state._compressCache.set(url, { skip: true });
          resolve(null);
        }
      };
      img.onerror = () => {
        state._compressCache.set(url, { skip: true });
        resolve(null);
      };
      img.src = url;
    });
  }

  // ========== Preload 提示 ==========

  function addPreloadHint(cdnUrl, type) {
    // 限制preload提示数量，避免过多标签影响性能
    if (state.stats.preloadHints >= state.config.maxPreloadHints) return;

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
    if (!state.config.enableBatchProcessing) {
      // 不启用批量处理时，直接处理
      _processMutations(mutations);
      return;
    }

    // 批量处理：收集所有需要处理的节点
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node.tagName) continue;
        state._mutationBatch.push(node);
      }
    }

    // 设置定时器，批量处理
    if (!state._mutationTimer) {
      state._mutationTimer = setTimeout(() => {
        state._mutationTimer = null;
        _processBatch();
      }, state.config.mutationBatchInterval);
    }
  });

  function _processBatch() {
    if (state._isProcessingBatch || state._mutationBatch.length === 0) return;

    state._isProcessingBatch = true;
    const batch = state._mutationBatch.splice(0, 100); // 每次处理100个节点

    batch.forEach(node => {
      if (!node.tagName) return;
      if (node.tagName === 'SCRIPT' && node.src) processScript(node);
      else if (node.tagName === 'LINK' && node.rel === 'stylesheet') processLink(node);
      else if (node.tagName === 'IMG') processImage(node);

      if (node.querySelectorAll) {
        node.querySelectorAll('script[src]').forEach(processScript);
        node.querySelectorAll('link[rel="stylesheet"]').forEach(processLink);
        node.querySelectorAll('img[src]').forEach(processImage);
      }
    });

    state._isProcessingBatch = false;

    // 如果还有剩余节点，继续处理
    if (state._mutationBatch.length > 0) {
      setTimeout(_processBatch, 0);
    }
  }

  function _processMutations(mutations) {
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
  }

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
    getStats: () => ({
      ...state.stats,
      cspRestricted: state.cspRestricted,
      recentReplacements: state.recentReplacements.slice(-50),
      thirdPartyDeferralEnabled: state.config.thirdPartyDeferral?.enabled || false,
    }),
    getConfig: () => ({ ...state.config }),
    destroy: () => {
      _observer.disconnect();
      state.compressQueue = [];
      state.recentReplacements = [];
      state.dedupSet.clear();
      state._compressCache.clear();
      document.createElement = _createElement;
      Element.prototype.appendChild = _appendChild;
      Element.prototype.insertBefore = _insertBefore;
      console.log(`${LOG_PREFIX} 已销毁`);
    }
  };

  // 立即初始化（同步）
  init();

})();
