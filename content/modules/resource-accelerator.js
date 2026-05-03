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
      enabled: true,
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
      userRules: [],  // User-defined rules [{ pattern: string, strategy: string }]
      maxDeferralMs: 10000,
    },
    // 站点级配置
    siteConfig: {
      enabled: true,  // 全局开关
      rules: [],  // 站点规则列表 [{ domain: string, enabled: boolean, ...featureFlags }]
    },
    // 高级过滤规则
    advancedFilter: {
      enabled: false,
      rules: [],  // [{ type: 'exclude'|'include', match: 'extension'|'path'|'domain'|'query'|'regex', value: string, action: 'skipAll'|'skipCompress'|'skipReplace'|'forceReplace', description: string }]
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
    _imageFormat: null,
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
    // 字体预加载候选队列（weight-based priority）
    _fontCandidates: [],
    _fontPreloadedUrls: new Set(),
    // 性能指标
    performance: null,
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

  // ========== 站点级配置 ==========

  function getSiteConfig(hostname) {
    const rules = state.config.siteConfig?.rules || [];

    // 精确匹配优先
    const exact = rules.find(r => r.domain === hostname);
    if (exact) return exact;

    // 通配符匹配 (*.domain.com)
    const wildcard = rules.find(r => {
      if (!r.domain.startsWith('*')) return false;
      const suffix = r.domain.slice(1);
      return hostname.endsWith(suffix);
    });

    return wildcard || null;
  }

  function isSiteEnabled(feature) {
    const site = getSiteConfig(location.hostname);

    // 站点级别完全禁用
    if (site && site.enabled === false) return false;

    // 站点级别功能开关
    if (site && feature in site) return site[feature];

    // 回退到全局配置
    return state.config[feature];
  }

  // ========== 高级过滤规则 ==========

  function matchAdvancedFilter(url, context = {}) {
    const filter = state.config.advancedFilter;
    if (!filter?.enabled || !filter.rules?.length) {
      return { matched: false, action: null };
    }

    let urlObj;
    try {
      urlObj = new URL(url, location.href);
    } catch {
      return { matched: false, action: null };
    }

    for (const rule of filter.rules) {
      let matches = false;

      switch (rule.match) {
        case 'extension': {
          const ext = urlObj.pathname.split('.').pop()?.toLowerCase();
          matches = ext === rule.value.toLowerCase();
          break;
        }
        case 'path': {
          matches = urlObj.pathname.includes(rule.value);
          break;
        }
        case 'domain': {
          matches = urlObj.hostname === rule.value || urlObj.hostname.endsWith('.' + rule.value);
          break;
        }
        case 'query': {
          matches = urlObj.search.includes(rule.value);
          break;
        }
        case 'regex': {
          try {
            matches = new RegExp(rule.value, 'i').test(url);
          } catch {
            matches = false;
          }
          break;
        }
      }

      if (matches) {
        // 检查 type 是否匹配
        if (rule.type === 'include' && !context.isInclude) continue;
        if (rule.type === 'exclude' && context.isInclude) continue;

        return { matched: true, action: rule.action, rule };
      }
    }

    return { matched: false, action: null };
  }

  // ========== 精准图片压缩 ==========

  const _headSizeCache = new Map();  // URL -> { size: number, timestamp: number }
  const HEAD_CACHE_TTL = 30000;  // 30秒缓存
  let _headRequestCount = 0;
  const MAX_HEAD_CONCURRENT = 5;

  async function getImageActualSize(url) {
    // 检查缓存
    const cached = _headSizeCache.get(url);
    if (cached && Date.now() - cached.timestamp < HEAD_CACHE_TTL) {
      return cached.size;
    }

    // 并发限制
    if (_headRequestCount >= MAX_HEAD_CONCURRENT) {
      return null;
    }

    _headRequestCount++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);  // 3秒超时

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const size = parseInt(contentLength, 10);
        _headSizeCache.set(url, { size, timestamp: Date.now() });
        return size;
      }
    } catch {
      // CORS 限制或其他错误，降级到估算
    } finally {
      _headRequestCount--;
    }

    return null;
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

  const IMAGE_FORMAT_PRIORITY = [
    { mime: 'image/avif', test: 'image/avif' },
    { mime: 'image/webp', test: 'image/webp' },
    { mime: 'image/jpeg', test: null },
  ];

  function getSupportedImageFormat() {
    if (state._imageFormat) return state._imageFormat;
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    for (const fmt of IMAGE_FORMAT_PRIORITY) {
      try {
        if (!fmt.test) {
          state._imageFormat = fmt;
          return fmt;
        }
        if (canvas.toDataURL(fmt.mime).startsWith(`data:${fmt.mime}`)) {
          state._imageFormat = fmt;
          return fmt;
        }
      } catch {}
    }
    state._imageFormat = IMAGE_FORMAT_PRIORITY[2];
    return state._imageFormat;
  }

  function getWeightPriority(weight) {
    if (!weight || weight === 'unknown') return 99;
    const w = parseInt(weight);
    if (w === 400 || weight === 'normal') return 0;
    if (w === 700 || weight === 'bold') return 1;
    return 2;
  }

  function parseFontWeight(url) {
    const queryMatch = url.match(/wght[@=](\d+)/i);
    if (queryMatch) return queryMatch[1];
    const nameMatch = url.match(/-(Regular|Bold|Light|Medium|SemiBold|ExtraBold|Thin|Black)/i);
    if (nameMatch) {
      const map = { regular: '400', bold: '700', light: '300', medium: '500', semibold: '600', extrabold: '800', thin: '100', black: '900' };
      return map[nameMatch[1].toLowerCase()] || 'unknown';
    }
    return null;
  }

  // ========== 第三方脚本延迟加载 ==========

  function matchDeferralRule(url) {
    const deferral = state.config.thirdPartyDeferral;
    if (!deferral?.enabled) return null;

    // 1. User-defined rules (regex match, highest priority)
    for (const rule of (deferral.userRules || [])) {
      try {
        if (new RegExp(rule.pattern, 'i').test(url)) {
          return { pattern: rule.pattern, strategy: rule.strategy, name: rule.pattern };
        }
      } catch {}
    }

    // 2. Built-in rules (string includes match)
    const { strategy, rules } = deferral;
    for (const rule of rules) {
      if (url.includes(rule.pattern)) {
        return { pattern: rule.pattern, strategy: rule.strategy || strategy, name: rule.pattern };
      }
    }

    // 3. Auto-detection: non-CDN, cross-domain
    if (isThirdPartyScript(url)) {
      return { pattern: '*', strategy: strategy || 'idle', name: 'auto-detected' };
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
    if (!isSiteEnabled('jsReplace')) return;
    const url = script.src;
    if (!url || script.dataset._raProcessed) return;

    script.dataset._raProcessed = '1';

    if (isExcluded(url) || isCDNUrl(url)) return;

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(url);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        return;
      }
    }

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
    if (!isSiteEnabled('fontReplace') && !isSiteEnabled('cssReplace')) return;
    const url = link.href;
    if (!url || link.dataset._raProcessed) return;

    link.dataset._raProcessed = '1';

    if (isExcluded(url) || isCDNUrl(url)) return;

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(url);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        return;
      }
    }

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

    if (fontMatch) {
      addPreloadHint(match.cdnUrl, 'font', { weight: parseFontWeight(originalHref) });
    } else {
      addPreloadHint(match.cdnUrl, 'css');
    }

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
    if (!isSiteEnabled('imageLazyLoad')) return;
    if (img.dataset._raProcessed || !img.src || img.dataset.src || img.src.startsWith('data:')) return;
    if (img.loading === 'eager' || img.hasAttribute('data-no-lazy')) return;
    if (img.complete && img.naturalWidth > 0) return;

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(img.src);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        return;
      }
    }

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
    if (!isSiteEnabled('imageCompress')) return null;

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(url);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipCompress') {
        return null;
      }
    }

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
    if (/\.(webp|svg|gif|avif)$/i.test(url)) {
      state._compressCache.set(url, { skip: true });
      return null;
    }

    // 优先获取实际文件大小
    const actualSize = await getImageActualSize(url);

    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        // 使用实际大小（如果获取到）；否则用像素估算降级
        const bytes = actualSize || (img.naturalWidth * img.naturalHeight * 4);
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

          const format = getSupportedImageFormat();
          const mimeType = format.mime;
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

  function addPreloadHint(cdnUrl, type, fontInfo) {
    if (state.stats.preloadHints >= state.config.maxPreloadHints) return;

    if (type === 'font') {
      if (state._fontPreloadedUrls.has(cdnUrl)) return;

      const weight = fontInfo?.weight || parseFontWeight(cdnUrl);
      state._fontCandidates.push({
        url: cdnUrl,
        priority: getWeightPriority(weight),
        weight: weight || 'unknown'
      });

      state._fontCandidates.sort((a, b) => a.priority - b.priority);
      state._fontCandidates = state._fontCandidates.slice(0, 3);

      _flushFontPreloads();
      return;
    }

    _insertPreloadLink(cdnUrl, type);
  }

  function _insertPreloadLink(cdnUrl, type) {
    if (!cdnUrl || typeof cdnUrl !== 'string' || !cdnUrl.startsWith('http')) return;
    const head = document.head || document.documentElement;
    if (head.querySelector(`link[rel="preload"]`)) {
      const links = head.querySelectorAll('link[rel="preload"]');
      for (const l of links) {
        if (l.getAttribute('href') === cdnUrl) return;
      }
    }
    const link = document.createElement('link');
    link.rel = 'preload';
    link.href = cdnUrl;
    if (type === 'js') {
      link.as = 'script';
    } else if (type === 'font') {
      // Google Fonts 等 replaceHost 返回的是 CSS 样式表 URL，不是字体文件
      if (/\/css[2]?(?:\?|$)/i.test(cdnUrl)) {
        link.as = 'style';
      } else {
        link.as = 'font';
        link.crossOrigin = 'anonymous';
      }
    } else {
      link.as = 'style';
    }
    head.insertBefore(link, head.firstChild);
    state.stats.preloadHints++;
  }

  function _flushFontPreloads() {
    for (const candidate of state._fontCandidates) {
      if (!state._fontPreloadedUrls.has(candidate.url)) {
        _insertPreloadLink(candidate.url, 'font');
        state._fontPreloadedUrls.add(candidate.url);
      }
    }
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
      const desc = Object.getOwnPropertyDescriptor(el, 'src') || Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src');
      if (!desc || desc.configurable) {
        let _src = '';
        Object.defineProperty(el, 'src', {
          get() { return _src; },
          set(val) {
            _src = val;
            if (val) {
              el.setAttribute('src', val);
              Promise.resolve().then(() => processScript(el));
            }
          }
        });
      }
    } else if (tag === 'LINK') {
      // 拦截 href 属性设置
      const desc = Object.getOwnPropertyDescriptor(el, 'href') || Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href');
      if (!desc || desc.configurable) {
        let _href = '';
        Object.defineProperty(el, 'href', {
          get() { return _href; },
          set(val) {
            _href = val;
            if (val) {
              el.setAttribute('href', val);
              if (el.rel === 'stylesheet') {
                Promise.resolve().then(() => processLink(el));
              }
            }
          }
        });
      }
    } else if (tag === 'IMG') {
      // 拦截 src 属性设置
      const desc = Object.getOwnPropertyDescriptor(el, 'src') || Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
      if (!desc || desc.configurable) {
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

    // 8. 页面加载后收集性能指标
    window.addEventListener('load', () => {
      state.performance = collectPerformanceMetrics();
    }, { once: true });

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

    // 异步检测，不阻塞（跳过 CSP 检测，避免被 block）
    // CSP 限制已通过 meta 标签预检处理
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
        sendResponse({ success: true, data: getStats() });
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
      if (message.type === 'RESOURCE_ACCELERATOR_GET_COMPARISON') {
        getPerformanceComparison().then(data => {
          sendResponse({ success: true, data });
        });
        return true;
      }
      if (message.type === 'RESOURCE_ACCELERATOR_SAVE_BASELINE') {
        savePerformanceBaseline();
        sendResponse({ success: true });
        return true;
      }
      if (message.type === 'RESOURCE_ACCELERATOR_RESET_BASELINE') {
        resetPerformanceBaseline();
        sendResponse({ success: true });
        return true;
      }
    });
  }

  // ========== 性能指标收集 ==========

  function collectPerformanceMetrics() {
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (!navEntries.length) return null;
      const nav = navEntries[0];

      const resEntries = performance.getEntriesByType('resource');
      const totalDuration = resEntries.reduce((sum, e) => sum + e.duration, 0);

      const estimatedTimeSaved =
        state.stats.jsReplaced * 150 +
        (state.stats.cssReplaced || 0) * 100 +
        state.stats.fontsReplaced * 120;

      return {
        ttfb: Math.round(nav.responseStart - nav.requestStart),
        domContentLoaded: Math.round(nav.domContentLoadedEventEnd - nav.startTime),
        loadEvent: Math.round(nav.loadEventEnd - nav.startTime),
        totalResources: resEntries.length,
        totalDuration: Math.round(totalDuration),
        replacedJs: state.stats.jsReplaced,
        replacedCss: state.stats.cssReplaced || 0,
        replacedFonts: state.stats.fontsReplaced,
        imagesCompressed: state.stats.imagesCompressed,
        bytesSaved: state.stats.imagesCompressBytesSaved,
        estimatedTimeSaved
      };
    } catch {
      return null;
    }
  }

  // ========== 配置导入导出 ==========

  function exportConfig() {
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      config: { ...state.config }
    };
    return JSON.stringify(exportData, null, 2);
  }

  function importConfig(jsonString) {
    try {
      const importData = JSON.parse(jsonString);

      // 验证格式
      if (!importData.version || !importData.config) {
        return { success: false, error: '无效的配置格式' };
      }

      // 验证版本
      if (importData.version !== '1.0') {
        return { success: false, error: `不支持的配置版本: ${importData.version}` };
      }

      // 合并配置（保留现有配置的默认值）
      const mergedConfig = { ...DEFAULT_CONFIG, ...importData.config };

      // 更新状态
      state.config = mergedConfig;

      // 保存到 storage
      chrome.storage.local.set({ [CONFIG_KEY]: mergedConfig });

      return { success: true, config: mergedConfig };
    } catch (e) {
      return { success: false, error: `解析配置失败: ${e.message}` };
    }
  }

  function resetConfig() {
    state.config = { ...DEFAULT_CONFIG };
    chrome.storage.local.set({ [CONFIG_KEY]: state.config });
    return state.config;
  }

  // ========== 性能基线对比 ==========

  const PERFORMANCE_BASELINE_KEY = 'resourceAcceleratorPerformanceBaseline';

  function savePerformanceBaseline() {
    if (!state.performance) return null;

    const baseline = {
      ttfb: state.performance.ttfb,
      domContentLoaded: state.performance.domContentLoaded,
      loadEvent: state.performance.loadEvent,
      totalResources: state.performance.totalResources,
      totalTransferSize: state.performance.totalTransferSize || 0,
      timestamp: Date.now()
    };

    chrome.storage.local.set({ [PERFORMANCE_BASELINE_KEY]: baseline });
    return baseline;
  }

  async function getPerformanceComparison() {
    try {
      const result = await chrome.storage.local.get(PERFORMANCE_BASELINE_KEY);
      const baseline = result[PERFORMANCE_BASELINE_KEY];

      if (!baseline || !state.performance) {
        return null;
      }

      const current = state.performance;

      // 计算节省时间
      const loadTimeSaved = baseline.loadEvent - current.loadEvent;
      const loadTimePercent = baseline.loadEvent > 0
        ? Math.round((loadTimeSaved / baseline.loadEvent) * 100)
        : 0;

      // 计算节省流量
      const transferSizeSaved = baseline.totalTransferSize - (current.totalTransferSize || 0);
      const transferSizePercent = baseline.totalTransferSize > 0
        ? Math.round((transferSizeSaved / baseline.totalTransferSize) * 100)
        : 0;

      return {
        baseline: {
          ttfb: baseline.ttfb,
          domContentLoaded: baseline.domContentLoaded,
          loadEvent: baseline.loadEvent,
          totalResources: baseline.totalResources,
          totalTransferSize: baseline.totalTransferSize
        },
        current: {
          ttfb: current.ttfb,
          domContentLoaded: current.domContentLoaded,
          loadEvent: current.loadEvent,
          totalResources: current.totalResources,
          totalTransferSize: current.totalTransferSize || 0
        },
        savings: {
          loadTimeSaved: Math.max(0, loadTimeSaved),
          loadTimePercent: Math.max(0, loadTimePercent),
          transferSizeSaved: Math.max(0, transferSizeSaved),
          transferSizePercent: Math.max(0, transferSizePercent),
          resourcesReplaced: Math.max(0, baseline.totalResources - current.totalResources)
        }
      };
    } catch {
      return null;
    }
  }

  function resetPerformanceBaseline() {
    chrome.storage.local.remove(PERFORMANCE_BASELINE_KEY);
  }

  // ========== 导出 API ==========

  window.ResourceAccelerator = {
    init,
    getImageActualSize,
    exportConfig,
    importConfig,
    resetConfig,
    savePerformanceBaseline,
    getPerformanceComparison,
    resetPerformanceBaseline,
    getStats: () => ({
      ...state.stats,
      cspRestricted: state.cspRestricted,
      recentReplacements: state.recentReplacements.slice(-50),
      performance: state.performance,
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
