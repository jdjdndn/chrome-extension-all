/**
 * 资源加速器主模块 (v8)
 * 核心优化：
 * 1. 同步启动 - 不等待配置加载
 * 2. API拦截 - 拦截 createElement/appendChild 等原生方法
 * 3. 即时处理 - 在元素创建时就拦截，而非等待 DOM 插入
 * 4. 图片压缩 - Canvas重绘导出WebP/JPEG
 * 5. CDN健康探测 - 启动时探测CDN可用性
 * 6. 智能调度 - 优先级队列、动态批量处理、CDN探测优先级
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[ResourceAccelerator]';
  const CONFIG_KEY = 'resourceAcceleratorConfig';
  const STATS_KEY = 'resourceAcceleratorStats';

  const DEFAULT_CONFIG = {
    version: '2.0.0',  // 配置版本号，用于迁移
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
    // 渐进式图片占位
    lqip: {
      enabled: true,
      blurRadius: 8,
      transitionDuration: 300,
      placeholderColor: '#f0f0f0',
    },
    // content-visibility 渲染优化
    contentVisibility: {
      enabled: true,
      selectors: ['article', 'section', 'aside', '.sidebar', '.footer', '.comments'],
      excludeSelectors: ['nav', 'header', '.above-fold'],
    },
    // 第三方iframe懒加载
    iframeLazyLoad: {
      enabled: true,
      threshold: 200,
      excludePatterns: [],
    },
    // 全站DNS prefetch
    dnsPrefetch: {
      enabled: true,
      maxDomains: 15,
    },
    // Worker压缩
    workerCompress: {
      enabled: true,       // 启用Worker压缩
      maxWorkers: 2,       // 最大Worker数
      timeout: 5000,       // 超时时间(ms)
      fallbackToMain: true, // Worker失败时回退主线程
    },
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
    // SVG 优化
    svgOptimize: {
      enabled: true,
      maxInlineSize: 10240,  // 10KB 以下内联为 data URI
      removeComments: true,
      removeMetadata: true,
      minify: true,
    },
    // 自适应压缩
    adaptiveCompress: {
      enabled: true,
      typeDetection: {
        enabled: true,
        patterns: {
          photo: [/\.(jpg|jpeg|png|webp)$/i, /photo|image|pic/i],
          icon: [/icon|logo|avatar|emoji/i, /\.(svg|ico)$/i],
          screenshot: [/screenshot|capture|snap/i],
          diagram: [/chart|graph|diagram|flow/i],
        },
      },
      typeStrategies: {
        photo: { quality: 0.82, maxWidth: 1920 },
        icon: { quality: 0.95, maxWidth: 512 },
        screenshot: { quality: 0.78, maxWidth: 2560 },
        diagram: { quality: 0.85, maxWidth: 1200 },
      },
      networkAdaptive: {
        enabled: true,
        adjustments: {
          fast: { qualityMultiplier: 1.1 },
          medium: { qualityMultiplier: 1.0 },
          slow: { qualityMultiplier: 0.7 },
        },
        deviceAdjustments: {
          high: { maxWidthMultiplier: 1.0 },
          medium: { maxWidthMultiplier: 0.85 },
          low: { maxWidthMultiplier: 0.7 },
        },
      },
      sizeAdaptive: {
        enabled: true,
        smallImageThreshold: 50000,
        largeImageThreshold: 500000,
      },
    },
    // 智能预加载 v2
    smartPreloadV2: {
      enabled: true,
      pageStructure: {
        enabled: true,
        criticalRegions: {
          aboveFold: true,
          navigation: true,
          mainContent: true,
          sidebar: false,
        },
        contentTypes: {
          article: { patterns: [/article/i, /post/i, /blog/i], preloadImages: 3 },
          ecommerce: { patterns: [/product/i, /item/i, /shop/i], preloadImages: 5 },
          video: { patterns: [/video/i, /watch/i, /player/i], preloadVideo: true },
          gallery: { patterns: [/gallery/i, /album/i, /photo/i], preloadImages: 8 },
        },
      },
      intentPrediction: {
        enabled: true,
        scrollSpeed: {
          fastThreshold: 1000,
          slowThreshold: 200,
          fastBehavior: 'preload-more',
          slowBehavior: 'preload-details',
        },
        dwellTime: {
          shortThreshold: 2000,
          longThreshold: 10000,
          shortBehavior: 'preload-next',
          longBehavior: 'preload-related',
        },
        mouseMovement: {
          enabled: true,
          hoverPreload: true,
          hoverDelay: 300,
        },
      },
      priorityScheduling: {
        enabled: true,
        maxConcurrent: 3,
        priorityQueue: true,
        abortOnNavigate: true,
        maxPreloads: 6,  // 新增：最大preload元素数
      },
    },
    // 性能监控
    perfMonitor: {
      enabled: true,
      metrics: {
        lcp: true,
        fid: true,
        cls: true,
        ttfb: true,
        fcp: true,
        resourceTiming: true,
        resourceSize: true,
        resourceCount: true,
        memoryUsage: true,
        memoryPressure: true,
      },
      sampleRate: 0.1,
      reportInterval: 60000,
      storageKey: 'resourceAcceleratorPerfData',
      maxEntries: 1000,
    },
    // 优先级优化
    priorityOptimizer: {
      enabled: true,
      networkAware: {
        enabled: true,
        adjustments: {
          fast: { script: 0, style: 1, image: 2, font: 3 },
          medium: { script: 0, style: 0, image: 1, font: 2 },
          slow: { script: 0, style: 0, image: 0, font: 1 },
        },
      },
      pageTypeAware: {
        enabled: true,
        rules: {
          ecommerce: { image: 0, script: 1, style: 2, font: 3 },
          news: { script: 0, style: 1, image: 2, font: 3 },
          video: { video: 0, script: 1, style: 2, image: 3 },
        },
      },
      sizeAware: {
        enabled: true,
        smallResourceThreshold: 10000,
        largeResourceThreshold: 100000,
      },
      scanExisting: {
        enabled: true,
        maxElements: 50,
      },
    },
    // 内存优化
    memoryOptimizer: {
      enabled: true,
      monitoring: {
        enabled: true,
        checkInterval: 5000,
        thresholds: {
          warning: 100,
          critical: 200,
        },
      },
      caching: {
        enabled: true,
        maxSize: 50 * 1024 * 1024,  // 50MB
        ttl: 7 * 24 * 60 * 60 * 1000,  // 7天
        evictionPolicy: 'lru',  // lru | lfu | fifo
        prewarm: {
          enabled: true,
          types: ['css', 'js', 'fonts'],
        },
      },
      pressureResponse: {
        enabled: true,
        strategies: {
          warning: {
            disableImageCompress: false,
            reduceCacheSize: true,
            pauseBackgroundTasks: false,
          },
          critical: {
            disableImageCompress: true,
            reduceCacheSize: true,
            pauseBackgroundTasks: true,
          },
        },
      },
    },
    // 位置感知加载
    positionAwareLoading: {
      enabled: true,
      nearbyThreshold: 1,      // 触发加载的距离阈值（屏数），默认1屏
      processLoaded: false,    // 已加载资源是否重新处理
    },
  };

  // ========== 日志系统 ==========
  const MAX_LOG_SIZE = 200;
  const LOG_ERROR_PERSIST_KEY = 'resourceAcceleratorErrorLogs';
  const MAX_PERSISTED_ERROR_LOGS = 50;
  let _logBuffer = [];
  let _logPersistTimer = null;

  /**
   * 添加日志记录
   * @param {'info'|'warn'|'error'} level - 日志级别
   * @param {'script'|'style'|'image'|'svg'|'cdn'|'deferral'|'system'} module - 模块
   * @param {'replace'|'compress'|'lazy'|'defer'|'skip'|'block'|'error'|'init'|'probe'} action - 操作
   * @param {object} details - 详情
   */
  function addLog(level, module, action, details = {}) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      module,
      action,
      details: {
        url: details.url || '',
        original: details.original || '',
        cdn: details.cdn || '',
        reason: details.reason || '',
        duration: details.duration || 0,
        size: details.size || 0,
        compressedSize: details.compressedSize || 0,
        ...details
      }
    };

    _logBuffer.push(logEntry);

    // 保持环形缓冲区大小
    if (_logBuffer.length > MAX_LOG_SIZE) {
      _logBuffer.shift();
    }

    // error 级别日志持久化到 storage
    if (level === 'error') {
      _scheduleErrorLogPersist();
    }
  }

  /**
   * 调度错误日志持久化（防抖）
   */
  function _scheduleErrorLogPersist() {
    if (_logPersistTimer) return;
    _logPersistTimer = setTimeout(async () => {
      _logPersistTimer = null;
      try {
        const errorLogs = _logBuffer.filter(l => l.level === 'error').slice(-MAX_PERSISTED_ERROR_LOGS);
        await chrome.storage.local.set({ [LOG_ERROR_PERSIST_KEY]: errorLogs });
      } catch (e) {
        console.error(`${LOG_PREFIX} 持久化错误日志失败:`, e);
      }
    }, 1000);
  }

  /**
   * 从 storage 恢复错误日志
   */
  async function _restoreErrorLogs() {
    try {
      const result = await chrome.storage.local.get(LOG_ERROR_PERSIST_KEY);
      const storedLogs = result[LOG_ERROR_PERSIST_KEY];
      if (Array.isArray(storedLogs) && storedLogs.length > 0) {
        // 将历史错误日志添加到缓冲区开头，确保最新的日志在后面
        const historicalLogs = storedLogs.filter(l =>
          l.timestamp && l.level === 'error' && l.module && l.action
        );
        _logBuffer = [...historicalLogs, ..._logBuffer].slice(-MAX_LOG_SIZE);
        console.log(`${LOG_PREFIX} 已恢复 ${historicalLogs.length} 条历史错误日志`);
      }
    } catch (e) {
      console.error(`${LOG_PREFIX} 恢复历史错误日志失败:`, e);
    }
  }

  /**
   * 获取日志缓冲区
   */
  function getLogs(filter = {}) {
    let logs = [..._logBuffer];

    // 按级别筛选
    if (filter.level && filter.level !== 'all') {
      logs = logs.filter(l => l.level === filter.level);
    }

    // 按模块筛选
    if (filter.module && filter.module !== 'all') {
      logs = logs.filter(l => l.module === filter.module);
    }

    // 按时间范围筛选
    if (filter.since) {
      logs = logs.filter(l => l.timestamp >= filter.since);
    }

    return logs;
  }

  /**
   * 清空日志缓冲区
   */
  function clearLogs() {
    _logBuffer = [];
  }

  // ========== 全局状态（同步初始化）==========
  const state = {
    config: { ...DEFAULT_CONFIG },
    cspRestricted: false,
    initialized: false,
    stats: { jsReplaced: 0, jsErrors: 0, fontsReplaced: 0, fontErrors: 0, cssReplaced: 0, cssErrors: 0, imagesLazy: 0, imagesCompressed: 0, imagesCompressBytesSaved: 0, svgOptimized: 0, svgInlined: 0, svgBytesSaved: 0, videosLazy: 0, preloadHints: 0, cdnLoadMs: 0, cdnLoadCount: 0, thirdPartyDeferred: 0, thirdPartyBlocked: 0, workerCompressSuccess: 0, workerCompressFallback: 0, workerCompressTotalMs: 0 },
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
    _compressCacheSize: 0,  // 缓存大小追踪（字节）
    _compressCacheMaxSize: 50 * 1024 * 1024,  // 最大50MB
    // SVG 优化缓存
    _svgCache: new Map(),
    // 去重集合
    dedupSet: new Set(),
    // 最近50条替换记录
    recentReplacements: [],
    // 第三方脚本延迟队列
    _deferredScripts: [],
    // 字体预加载候选队列（weight-based priority）
    _fontCandidates: [],
    _fontPreloadedUrls: new Set(),
    // LCP 指标
    lcp: null,
    // 性能指标
    performance: null,
    // 页面跳转状态
    _isNavigating: false,
  };

  // ========== 统计持久化（防抖 + 增量）==========

  let _statsTimer = null;
  const _lastPersisted = { jsReplaced: 0, fontsReplaced: 0, cssReplaced: 0, imagesLazy: 0, imagesCompressed: 0, imagesCompressBytesSaved: 0, svgOptimized: 0, svgBytesSaved: 0 };

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
          totalBytesSaved: (stored.totalBytesSaved || 0) + (state.stats.imagesCompressBytesSaved - _lastPersisted.imagesCompressBytesSaved) + (state.stats.svgBytesSaved - _lastPersisted.svgBytesSaved),
          totalSvgOptimized: (stored.totalSvgOptimized || 0) + (state.stats.svgOptimized - _lastPersisted.svgOptimized),
        };
        await chrome.storage.local.set({ [STATS_KEY]: delta });
        // 更新快照
        _lastPersisted.jsReplaced = state.stats.jsReplaced;
        _lastPersisted.fontsReplaced = state.stats.fontsReplaced;
        _lastPersisted.cssReplaced = state.stats.cssReplaced || 0;
        _lastPersisted.imagesLazy = state.stats.imagesLazy;
        _lastPersisted.imagesCompressed = state.stats.imagesCompressed;
        _lastPersisted.imagesCompressBytesSaved = state.stats.imagesCompressBytesSaved;
        _lastPersisted.svgOptimized = state.stats.svgOptimized;
        _lastPersisted.svgBytesSaved = state.stats.svgBytesSaved;
      } catch (error) {
        console.warn('[persistStats] 持久化统计失败:', error);
      }
    }, 2000);
  }

  // ========== 压缩缓存内存管理 ==========
  function _addToCompressCache(url, result) {
    const size = result ? result.length * 2 : 0; // dataUrl大小估算（UTF-16编码）

    // 检查是否需要清理
    while (state._compressCacheSize + size > state._compressCacheMaxSize && state._compressCache.size > 0) {
      // 删除最旧的缓存项（Map保持插入顺序）
      const oldest = state._compressCache.keys().next().value;
      const oldEntry = state._compressCache.get(oldest);
      const oldSize = oldEntry?.result?.length * 2 || 0;
      state._compressCache.delete(oldest);
      state._compressCacheSize -= oldSize;
      state.stats.cacheEvictions = (state.stats.cacheEvictions || 0) + 1;
    }

    state._compressCache.set(url, result ? { skip: false, result } : { skip: true });
    state._compressCacheSize += size;
  }

  // ========== 网络变化动态调整 ==========
  let _networkChangeListener = null;

  function _initNetworkChangeListener() {
    if (!navigator.connection) return;

    _networkChangeListener = () => {
      const oldQuality = state._lastNetworkQuality;
      const newQuality = detectNetworkQuality();

      if (oldQuality !== newQuality) {
        console.log(`${LOG_PREFIX} 网络质量变化: ${oldQuality} -> ${newQuality}`);
        state._lastNetworkQuality = newQuality;

        // 通知AdaptiveCompressor更新
        if (_adaptiveCompressor) {
          _adaptiveCompressor.networkQuality = newQuality;
        }
      }
    };

    navigator.connection.addEventListener('change', _networkChangeListener);
  }

  // ========== 工具方法（同步）==========

  /**
   * 检测网络质量（共享函数）
   * @returns {'fast'|'medium'|'slow'}
   */
  function detectNetworkQuality() {
    if (!navigator.connection) return state._lastNetworkQuality || 'medium';

    const effectiveType = navigator.connection.effectiveType;
    const downlink = navigator.connection.downlink;

    let quality = 'medium';
    if (effectiveType === '4g' && downlink > 10) {
      quality = 'fast';
    } else if (effectiveType === '4g' || effectiveType === '3g') {
      quality = 'medium';
    } else {
      quality = 'slow';
    }

    // 更新全局状态
    state._lastNetworkQuality = quality;
    return quality;
  }

  // 设备性能缓存
  let _cachedDeviceTier = null;

  /**
   * 检测设备性能等级
   * @returns {'high'|'medium'|'low'}
   */
  function detectDeviceTier() {
    if (_cachedDeviceTier) return _cachedDeviceTier;

    let tier = 'medium';
    // 优先使用 deviceMemory API
    if (navigator.deviceMemory) {
      if (navigator.deviceMemory >= 8) tier = 'high';
      else if (navigator.deviceMemory >= 4) tier = 'medium';
      else tier = 'low';
    } else if (navigator.hardwareConcurrency) {
      // 回退：根据硬件并发数判断
      if (navigator.hardwareConcurrency >= 8) tier = 'high';
      else if (navigator.hardwareConcurrency >= 4) tier = 'medium';
      else tier = 'low';
    }

    _cachedDeviceTier = tier;
    return tier;
  }

  /**
   * 增强的可视区检测
   * @param {Element} element - 要检测的元素
   * @param {Object} options - 配置选项
   * @returns {{inViewport: boolean, aboveFold: boolean, visible: boolean, priority: 'high'|'auto'|'low'}}
   */
  function detectViewportState(element, options = {}) {
    const {
      topThreshold = 0.5,      // 首屏顶部区域比例
      bottomBuffer = 100,      // 底部缓冲区
      minVisibleArea = 0.1,    // 最小可见面积比例
    } = options;

    // 基础检查：元素是否存在
    if (!element || !element.isConnected) {
      return { inViewport: false, aboveFold: false, visible: false, priority: 'low' };
    }

    // 检查元素可见性
    const style = window.getComputedStyle(element);
    const isVisible = style.display !== 'none' &&
                      style.visibility !== 'hidden' &&
                      parseFloat(style.opacity) > 0;

    if (!isVisible) {
      return { inViewport: false, aboveFold: false, visible: false, priority: 'low' };
    }

    // 获取元素边界
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // 检查元素尺寸
    const elementArea = rect.width * rect.height;
    if (elementArea < 10) { // 小于10像素的元素
      return { inViewport: false, aboveFold: false, visible: true, priority: 'low' };
    }

    // 检查是否在可视区内（考虑水平和垂直）
    const inViewportX = rect.right > 0 && rect.left < viewportWidth;
    const inViewportY = rect.bottom > 0 && rect.top < viewportHeight + bottomBuffer;
    const inViewport = inViewportX && inViewportY;

    if (!inViewport) {
      return { inViewport: false, aboveFold: false, visible: true, priority: 'low' };
    }

    // 计算可见面积比例
    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
    const visibleArea = visibleWidth * visibleHeight;
    const visibleRatio = visibleArea / elementArea;

    // 可见面积太小
    if (visibleRatio < minVisibleArea) {
      return { inViewport: true, aboveFold: false, visible: true, priority: 'low' };
    }

    // 检查是否在首屏顶部
    const aboveFold = rect.top < viewportHeight * topThreshold;

    // 确定优先级
    let priority = 'auto';
    if (aboveFold && rect.top < viewportHeight * 0.3) {
      // 首屏前30%区域，高优先级
      priority = 'high';
    } else if (rect.top > viewportHeight) {
      // 完全在可视区下方
      priority = 'low';
    }

    return { inViewport, aboveFold, visible: true, priority, visibleRatio };
  }

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
      } catch (error) {
        console.warn('[detectImageFormat] 检测图片格式失败:', error);
      }
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
      } catch (error) {
        console.warn('[getThirdPartyDeferral] 正则表达式匹配失败:', error);
      }
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

    if (isExcluded(url) || isCDNUrl(url)) {
      addLog('info', 'script', 'skip', { url, reason: isExcluded(url) ? 'excluded' : 'cdn_url' });
      return;
    }

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(url);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'script', 'skip', { url, reason: 'filter_rule' });
        return;
      }
    }

    // 去重检查：同一原始URL不重复替换
    if (state.config.dedupEnabled && state.dedupSet.has(url)) {
      addLog('info', 'script', 'skip', { url, reason: 'deduplicated' });
      return;
    }

    const startTime = performance.now();

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
          addLog('info', 'deferral', 'defer', {
            url,
            reason: deferralRule.pattern,
            strategy: deferralRule.strategy,
            duration: Math.round(performance.now() - startTime)
          });
          return;
        }
      }
      addLog('info', 'script', 'skip', { url, reason: 'no_cdn_match' });
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
        addLog('error', 'script', 'error', {
          url: originalSrc,
          cdn: match.cdnUrl,
          reason: 'all_fallbacks_failed'
        });
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

    addLog('info', 'script', 'replace', {
      url: originalSrc,
      original: originalSrc,
      cdn: match.cdnUrl,
      reason: match.name,
      duration: Math.round(performance.now() - startTime)
    });

    // Apply priority optimization
    if (_priorityOptimizer) {
      _priorityOptimizer.applyPriorityToResource(script, url, 'script');
    }

    console.log(`${LOG_PREFIX} JS: ${match.name} → ${match.cdnName}${match.isDynamic ? ' (dynamic)' : ''}`);
  }

  // ========== 核心拦截：样式/字体处理 ==========

  function processLink(link) {
    if (state.cspRestricted) return;
    if (!isSiteEnabled('fontReplace') && !isSiteEnabled('cssReplace')) return;
    const url = link.href;
    if (!url || link.dataset._raProcessed) return;

    link.dataset._raProcessed = '1';

    if (isExcluded(url) || isCDNUrl(url)) {
      addLog('info', 'style', 'skip', { url, reason: isExcluded(url) ? 'excluded' : 'cdn_url' });
      return;
    }

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(url);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'style', 'skip', { url, reason: 'filter_rule' });
        return;
      }
    }

    // 去重检查：同一原始URL不重复替换
    if (state.config.dedupEnabled && state.dedupSet.has(url)) {
      addLog('info', 'style', 'skip', { url, reason: 'deduplicated' });
      return;
    }

    const startTime = performance.now();

    // 先尝试字体匹配，再尝试CSS匹配
    const fontMatch = window.CDNMappings?.matchFont(url);
    const cssMatch = !fontMatch ? window.CDNMappings?.matchCSS(url) : null;

    // 检查各自的开关
    if (fontMatch && !state.config.fontReplace) {
      addLog('info', 'style', 'skip', { url, reason: 'font_replace_disabled' });
      return;
    }
    if (cssMatch && !state.config.cssReplace) {
      addLog('info', 'style', 'skip', { url, reason: 'css_replace_disabled' });
      return;
    }

    const match = fontMatch || cssMatch;
    if (!match) {
      addLog('info', 'style', 'skip', { url, reason: 'no_cdn_match' });
      return;
    }

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
        addLog('error', 'style', 'error', {
          url: originalHref,
          cdn: match.cdnUrl,
          reason: 'all_fallbacks_failed'
        });
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

    addLog('info', fontMatch ? 'style' : 'style', 'replace', {
      url: originalHref,
      original: originalHref,
      cdn: match.cdnUrl,
      reason: `${fontMatch ? 'font' : 'css'}: ${match.name}`,
      duration: Math.round(performance.now() - startTime)
    });

    // Apply priority optimization
    if (_priorityOptimizer) {
      _priorityOptimizer.applyPriorityToResource(link, url, 'style');
    }

    console.log(`${LOG_PREFIX} ${fontMatch ? 'Font' : 'CSS'}: ${match.name} → ${match.cdnName}`);
  }

  // ========== 核心拦截：图片懒加载 ==========

  function processImage(img) {
    // SVG 优化：与图片懒加载独立，优先处理
    if (img.src && !img.dataset._raSvgProcessed && !img.dataset._raProcessed) {
      if (/\.svg(\?|#|$)/i.test(img.src) || /\/svg\+xml/i.test(img.src)) {
        if (isSiteEnabled('svgOptimize') && !state.cspRestricted) {
          processSVG(img);
          return;
        }
      }
    }

    if (!isSiteEnabled('imageLazyLoad')) return;
    if (img.dataset._raProcessed || !img.src || img.dataset.src || img.src.startsWith('data:')) return;
    if (img.loading === 'eager' || img.hasAttribute('data-no-lazy')) return;
    if (img.complete && img.naturalWidth > 0) return;

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(img.src);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'image', 'skip', { url: img.src, reason: 'filter_rule' });
        return;
      }
    }

    img.dataset._raProcessed = '1';

    // 增强的可视区检测
    const viewportState = detectViewportState(img, {
      topThreshold: 0.5,
      bottomBuffer: 100,
      minVisibleArea: 0.1
    });

    // 可视区图片：立即加载，不延迟
    if (viewportState.inViewport && viewportState.visible) {
      img.loading = 'eager';
      if ('fetchPriority' in img) img.fetchPriority = viewportState.priority;

      if (_priorityOptimizer) {
        _priorityOptimizer.applyPriorityToResource(img, img.src, 'image');
      }

      // 可视区图片：后台压缩，前台立即显示原图
      if (state.config.imageCompress) {
        img.dataset.src = img.src;
        addLog('info', 'image', 'viewport', {
          url: img.src,
          reason: 'viewport_immediate',
          priority: viewportState.priority,
          visibleRatio: viewportState.visibleRatio?.toFixed(2)
        });

        // 后台压缩（低优先级）
        if (state.compressQueue.length < 3) {
          compressImage(img.src).then(compressed => {
            if (compressed && !state._isNavigating) {
              img.src = compressed;
              img.dataset.compressed = 'true';
            }
          });
        }
      }
      return;
    }

    // 非可视区或不可见图片：懒加载处理
    img.loading = 'lazy';
    if ('fetchPriority' in img) img.fetchPriority = 'low';
    img.dataset._raLazyLoad = '1';

    if (_priorityOptimizer) {
      _priorityOptimizer.applyPriorityToResource(img, img.src, 'image');
    }

    const originalSrc = img.src;
    img.dataset.src = originalSrc;

    // LQIP：设置渐进式占位
    if (state.config.lqip?.enabled) {
      img.dataset.lqip = '1';
      img.style.backgroundColor = state.config.lqip.placeholderColor || '#f0f0f0';
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    }

    // 图片压缩：预压缩后直接加载
    if (state.config.imageCompress) {
      enqueueCompress(img, originalSrc);
    } else {
      // 非压缩路径：如果 LQIP 启用，触发过渡；否则仅懒加载
      if (state.config.lqip?.enabled) {
        _triggerLqipTransition(img);
      } else {
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
        img.dataset.lazyLoading = 'true';
      }
      state.stats.imagesLazy++;
      _persistStats();
      addLog('info', 'image', 'lazy', {
        url: originalSrc,
        reason: state.config.lqip?.enabled ? 'lqip_lazy' : 'lazy_load_only'
      });
    }
  }

  // ========== 第三方iframe懒加载 ==========
  function processIframeLazyLoad() {
    if (!isSiteEnabled('iframeLazyLoad')) return;
    const config = state.config.iframeLazyLoad;
    const threshold = config.threshold || 200;

    const iframes = document.querySelectorAll('iframe[src]');
    iframes.forEach(iframe => {
      try {
        const url = new URL(iframe.src, location.href);
        if (url.hostname === location.hostname) return;
        if (config.excludePatterns?.some(p => url.hostname.includes(p))) return;
        if (iframe.dataset._raIframeProcessed) return;

        iframe.dataset._raIframeProcessed = '1';
        iframe.dataset.src = iframe.src;
        iframe.removeAttribute('src');
        iframe.loading = 'lazy';

        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const el = entry.target;
              if (el.dataset.src) {
                el.src = el.dataset.src;
                delete el.dataset.src;
              }
              observer.unobserve(el);
            }
          });
        }, { rootMargin: `0px 0px ${threshold}px 0px` });
        observer.observe(iframe);
      } catch {
        // URL 解析失败，跳过
      }
    });
  }

  // ========== 全站DNS prefetch ==========
  function _addGlobalDnsPrefetch() {
    if (!isSiteEnabled('dnsPrefetch')) return;
    const config = state.config.dnsPrefetch;
    const maxDomains = config.maxDomains || 15;
    const origins = new Set();
    const head = document.head || document.documentElement;

    document.querySelectorAll('script[src], link[href], img[src], iframe[src]').forEach(el => {
      const url = el.src || el.href;
      if (!url) return;
      try {
        const origin = new URL(url, location.href).origin;
        if (origin !== location.origin) {
          origins.add(origin);
        }
      } catch {}
    });

    let count = 0;
    origins.forEach(origin => {
      if (count >= maxDomains) return;
      if (head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) return;
      if (head.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) return;

      const link = document.createElement('link');
      link.rel = 'dns-prefetch';
      link.href = origin;
      head.appendChild(link);
      count++;
    });
  }

  // ========== 核心拦截：SVG 优化 ==========

  /**
   * 处理 SVG 图片：优化内容并内联小 SVG
   * @param {HTMLImageElement} img - 图片元素
   */
  async function processSVG(img) {
    if (state.cspRestricted) return;
    if (!isSiteEnabled('svgOptimize')) return;

    const url = img.src;
    if (!url || img.dataset._raSvgProcessed) return;

    // 已经是 data URI，跳过
    if (url.startsWith('data:')) return;

    // 判断是否为 SVG
    if (!/\.svg(\?|#|$)/i.test(url) && !/\/svg\+xml/i.test(url)) return;

    img.dataset._raSvgProcessed = '1';

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(url);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'svg', 'skip', { url, reason: 'filter_rule' });
        return;
      }
    }

    // 缓存命中
    if (state._svgCache.has(url)) {
      const cached = state._svgCache.get(url);
      if (cached) img.src = cached;
      return;
    }

    // 域名排除
    try {
      const urlObj = new URL(url, location.href);
      if (state.config.excludeDomains.some(d => urlObj.hostname.includes(d))) {
        addLog('info', 'svg', 'skip', { url, reason: 'domain_excluded' });
        return;
      }
    } catch {
      return;
    }

    const startTime = performance.now();

    try {
      const response = await fetch(url);
      if (!response.ok) return;
      const text = await response.text();
      const originalSize = new Blob([text]).size;

      const config = state.config.svgOptimize;
      let optimized = text;

      // 移除注释
      if (config.removeComments) {
        optimized = optimized.replace(/<!--[\s\S]*?-->/g, '');
      }

      // 移除元数据（Inkscape / sodipodi 等编辑器生成的非必要元素）
      if (config.removeMetadata) {
        optimized = optimized.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');
        optimized = optimized.replace(/<sodipodi:[\s\S]*?\/>/gi, '');
        optimized = optimized.replace(/<inkscape:[\s\S]*?\/>/gi, '');
      }

      // 压缩空白
      if (config.minify) {
        optimized = optimized
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><')
          .trim();
      }

      const optimizedSize = new Blob([optimized]).size;

      // 小 SVG：内联为 data URI
      if (optimizedSize <= config.maxInlineSize) {
        const dataUri = `data:image/svg+xml,${encodeURIComponent(optimized)}`;
        img.src = dataUri;
        img.dataset._raSvgInlined = 'true';

        state.stats.svgOptimized++;
        state.stats.svgInlined++;
        state.stats.svgBytesSaved += Math.max(0, originalSize - optimizedSize);
        _persistStats();

        addLog('info', 'svg', 'inline', {
          url,
          size: originalSize,
          compressedSize: optimizedSize,
          reason: 'small_svg_inlined',
          duration: Math.round(performance.now() - startTime)
        });
        return;
      }

      // 大 SVG：优化后替换（需有 5% 以上收益）
      if (optimizedSize < originalSize * 0.95) {
        const blob = new Blob([optimized], { type: 'image/svg+xml' });
        const blobUrl = URL.createObjectURL(blob);
        img.src = blobUrl;
        state._svgCache.set(url, blobUrl);

        state.stats.svgOptimized++;
        state.stats.svgBytesSaved += (originalSize - optimizedSize);
        _persistStats();

        addLog('info', 'svg', 'replace', {
          url,
          size: originalSize,
          compressedSize: optimizedSize,
          reason: 'large_svg_optimized',
          duration: Math.round(performance.now() - startTime)
        });
      }
      // 优化收益不足，保持原图
    } catch (error) {
      addLog('error', 'svg', 'error', { url, reason: 'svg_optimize_failed' });
    }
  }

  // ========== 图片压缩 ==========

  // 图片压缩优先级与阈值常量
  const COMPRESS_PRIORITY = { IN_VIEW: 0, SMALL: 1, LARGE: 2 };
  const SMALL_IMAGE_PIXEL_THRESHOLD = 100000;

  /**
   * 获取资源位置优先级
   * @param {Element} element - DOM元素
   * @returns {{ zone: 'inViewport'|'nearby'|'far', priority: number, distance: number }}
   */
  function _getResourcePositionPriority(element) {
    if (!element || !element.isConnected) {
      return { zone: 'far', priority: 999, distance: Infinity };
    }

    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // 计算元素距离视口的距离
    const distanceToViewport = rect.top < 0
      ? -rect.top  // 视口上方，取绝对值
      : rect.top > viewportHeight
        ? rect.top - viewportHeight  // 视口下方
        : 0;  // 在视口内

    // 获取配置的距离阈值（屏数）
    const nearbyThreshold = (state.config.positionAwareLoading?.nearbyThreshold || 1) * viewportHeight;

    // 判断区域
    if (distanceToViewport === 0) {
      return { zone: 'inViewport', priority: 0, distance: 0 };
    }

    if (distanceToViewport <= nearbyThreshold) {
      // nearby 区域：优先级 10-19，距离越近优先级越高
      return {
        zone: 'nearby',
        priority: 10 + Math.floor(distanceToViewport / viewportHeight * 10),
        distance: distanceToViewport
      };
    }

    // far 区域
    return { zone: 'far', priority: 100, distance: distanceToViewport };
  }

  /**
   * 检查资源是否已加载
   * @param {Element} element - DOM元素
   * @param {string} type - 资源类型
   * @returns {boolean}
   */
  function _isResourceLoaded(element, type) {
    switch (type) {
      case 'image':
        return element.complete && element.naturalHeight > 0;
      case 'iframe':
        if (element.dataset.loaded === 'true') return true;
        // 跨域iframe访问contentDocument会抛出安全错误
        try {
          return element.contentDocument !== null;
        } catch {
          return false;
        }
      case 'script':
        return element.dataset.loaded === 'true';
      default:
        return false;
    }
  }

  // 获取图片压缩优先级：可视区域 > 小图 > 大图
  function _getCompressPriority(img) {
    try {
      const rect = img.getBoundingClientRect();
      // 可视区域最高优先级
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        return COMPRESS_PRIORITY.IN_VIEW;
      }
    } catch (error) {
      console.warn('[_getCompressPriority] 获取图片边界失败:', error);
    }

    // 根据图片大小判断优先级
    const size = (img.naturalWidth || 0) * (img.naturalHeight || 0);
    if (size < SMALL_IMAGE_PIXEL_THRESHOLD) return COMPRESS_PRIORITY.SMALL;  // 小图次之
    return COMPRESS_PRIORITY.LARGE;  // 大图最低
  }

  function enqueueCompress(img, src) {
    // 限制队列大小，避免内存溢出
    if (state.compressQueue.length >= state.config.maxCompressQueueSize) {
      // 队列满时直接加载原图
      img.src = src;
      img.dataset.lazyLoading = 'false';
      img.dataset.lazyLoaded = 'true';
      addLog('warn', 'image', 'skip', { url: src, reason: 'compress_queue_full' });
      return;
    }

    // 计算优先级并插入到队列的合适位置
    const priority = _getCompressPriority(img);
    let insertIndex = state.compressQueue.length;

    // 找到第一个优先级比当前低（数值更大）的位置
    for (let i = 0; i < state.compressQueue.length; i++) {
      if (state.compressQueue[i].priority < priority) {
        insertIndex = i;
        break;
      }
    }

    state.compressQueue.splice(insertIndex, 0, { img, src, priority });
    processCompressQueue();
  }

  async function processCompressQueue() {
    // 页面跳转时停止处理
    if (state._isNavigating) {
      state.compressQueue = [];
      return;
    }

    while (state.compressingCount < state.config.imageMaxConcurrency && state.compressQueue.length > 0) {
      // 页面跳转时停止处理
      if (state._isNavigating) {
        state.compressQueue = [];
        return;
      }

      // 按优先级取任务：总是取第一个（最高优先级）
      const task = state.compressQueue.shift();
      state.compressingCount++;
      const startTime = performance.now();
      try {
        const compressed = await compressImage(task.src);
        const duration = Math.round(performance.now() - startTime);
        if (compressed) {
          // 压缩成功，直接加载压缩版本
          task.img.src = compressed;
          task.img.dataset.lazyLoading = 'false';
          task.img.dataset.lazyLoaded = 'true';
          task.img.dataset.compressed = 'true';
          _triggerLqipTransition(task.img);
          addLog('info', 'image', 'compress', {
            url: task.src,
            reason: 'success',
            duration
          });
        } else {
          // 压缩失败或不值得压缩，回退到原图
          task.img.src = task.src;
          task.img.dataset.lazyLoading = 'false';
          task.img.dataset.lazyLoaded = 'true';
          _triggerLqipTransition(task.img);
          addLog('info', 'image', 'skip', {
            url: task.src,
            reason: 'not_worth_compressing',
            duration
          });
        }
      } catch {
        // 异常时回退到原图
        task.img.src = task.src;
        task.img.dataset.lazyLoading = 'false';
        task.img.dataset.lazyLoaded = 'true';
        _triggerLqipTransition(task.img);
        addLog('error', 'image', 'error', {
          url: task.src,
          reason: 'compress_exception'
        });
      }
      state.compressingCount--;
      processCompressQueue();
    }
  }

  async function compressImage(url) {
    if (!isSiteEnabled('imageCompress')) {
      addLog('info', 'image', 'skip', { url, reason: 'compress_disabled' });
      return null;
    }

    // 高级过滤检查
    const filterResult = matchAdvancedFilter(url);
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipCompress') {
        addLog('info', 'image', 'skip', { url, reason: 'filter_rule' });
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
        addLog('info', 'image', 'skip', { url, reason: 'domain_excluded' });
        return null;
      }
    } catch {
      state._compressCache.set(url, { skip: true });
      return null;
    }

    // 非图片类型不压缩
    if (/\.(webp|svg|gif|avif)$/i.test(url)) {
      state._compressCache.set(url, { skip: true });
      addLog('info', 'image', 'skip', { url, reason: 'unsupported_format' });
      return null;
    }

    // 页面跳转时跳过压缩
    if (state._isNavigating || false) {
      return null;
    }

    // 优先获取实际文件大小
    const actualSize = await getImageActualSize(url);

    // 再次检查跳转状态
    if (state._isNavigating) {
      return null;
    }

    // 获取压缩参数
    let quality = state.config.imageQuality || 0.8;
    let maxWidth = state.config.imageMaxDimension || 2048;
    if (_adaptiveCompressor) {
      const params = _adaptiveCompressor.getCompressParams(url, null, actualSize);
      quality = params.quality;
      maxWidth = params.maxWidth;
    }
    const maxHeight = maxWidth;

    // 尝试 Worker 压缩
    if (state.config.workerCompress?.enabled && _compressorWorkers.length > 0) {
      try {
        const result = await _compressViaWorker(url, quality, maxWidth, maxHeight);
        if (result.dataUrl) {
          const originalSize = result.originalSize;
          const compressionRatio = result.compressedSize / originalSize;
          if (compressionRatio < 0.95) {
            state.stats.imagesCompressed++;
            state.stats.imagesCompressBytesSaved += (originalSize - result.compressedSize);
            _persistStats();
            _addToCompressCache(url, result.dataUrl);
            addLog('info', 'image', 'worker_compress', {
              url,
              originalSize,
              compressedSize: result.compressedSize,
              ratio: compressionRatio.toFixed(2),
            });
            return result.dataUrl;
          }
        }
      } catch (e) {
        if (!state.config.workerCompress?.fallbackToMain) {
          addLog('warn', 'image', 'worker_failed_no_fallback', { url, error: e.message });
          state._compressCache.set(url, { skip: true });
          return null;
        }
        // 识别跨域错误
        const isCorsError = e.message?.includes('fetch') ||
                           e.message?.includes('CORS') ||
                           e.message?.includes('Failed to fetch');
        addLog('debug', 'image', 'worker_fallback', {
          url,
          error: e.message,
          isCorsError,
          reason: isCorsError ? 'cors_fallback' : 'worker_error'
        });
      }
    }

    // 主线程压缩（回退或首选）
    return new Promise(resolve => {
      // 跳转检查函数
      const checkAborted = () => {
        if (state._isNavigating) {
          resolve(null);
          return true;
        }
        return false;
      };

      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (checkAborted()) return;
        // 使用实际大小（如果获取到）；否则用像素估算降级
        const bytes = actualSize || (img.naturalWidth * img.naturalHeight * 4);
        if (bytes < state.config.imageMinSize) {
          state._compressCache.set(url, { skip: true });
          addLog('info', 'image', 'skip', { url, reason: 'below_min_size', size: bytes });
          resolve(null);
          return;
        }

        try {
          let MAX_DIMENSION = state.config.imageMaxDimension || 2048;
          let quality = state.config.imageQuality;

          if (_adaptiveCompressor) {
            const params = _adaptiveCompressor.getCompressParams(url, img, actualSize);
            quality = params.quality;
            MAX_DIMENSION = params.maxWidth;
          }

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
            // 跳转时放弃结果
            if (state._isNavigating) {
              resolve(null);
              return;
            }
            if (blob && blob.size < bytes) {
              state.stats.imagesCompressed++;
              state.stats.imagesCompressBytesSaved += (bytes - blob.size);
              _persistStats();
              const blobUrl = URL.createObjectURL(blob);
              _addToCompressCache(url, blobUrl);
              resolve(blobUrl);
            } else {
              state._compressCache.set(url, { skip: true });
              resolve(null);
            }
          }, mimeType, quality);
        } catch {
          state._compressCache.set(url, { skip: true });
          resolve(null);
        }
      };
      img.onerror = () => {
        state._compressCache.set(url, { skip: true });
        addLog('error', 'image', 'error', { url, reason: 'load_failed' });
        resolve(null);
      };
      // 设置 src 前再次检查
      if (state._isNavigating) {
        resolve(null);
        return;
      }
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

  // 批量处理阈值与参数常量
  const BATCH_THRESHOLDS = { HIGH: 500, MEDIUM: 100 };
  const BATCH_SIZES = { HIGH: 200, MEDIUM: 100, LOW: 50 };
  const INTERVAL_THRESHOLDS = { HIGH: 200, MEDIUM: 50 };
  const BATCH_INTERVALS = { HIGH: 30, MEDIUM: 50, LOW: 100 };

  // 根据页面负载动态调整批量大小
  function _getBatchSize() {
    const pending = state._mutationBatch.length;
    if (pending > BATCH_THRESHOLDS.HIGH) return BATCH_SIZES.HIGH;   // 高负载：大批次
    if (pending > BATCH_THRESHOLDS.MEDIUM) return BATCH_SIZES.MEDIUM;   // 中负载：中批次
    return BATCH_SIZES.LOW;                       // 低负载：小批次
  }

  // 根据页面负载动态调整批量处理间隔
  function _getBatchInterval() {
    const pending = state._mutationBatch.length;
    if (pending > INTERVAL_THRESHOLDS.HIGH) return BATCH_INTERVALS.HIGH;    // 高负载：更快处理
    if (pending > INTERVAL_THRESHOLDS.MEDIUM) return BATCH_INTERVALS.MEDIUM;     // 中负载：正常
    return BATCH_INTERVALS.LOW;                      // 低负载：节省资源
  }

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

    // 设置定时器，使用动态间隔
    if (!state._mutationTimer) {
      const interval = _getBatchInterval();
      state._mutationTimer = setTimeout(() => {
        state._mutationTimer = null;
        _processBatch();
      }, interval);
    }
  });

  function _processBatch() {
    if (state._isProcessingBatch || state._mutationBatch.length === 0) return;

    state._isProcessingBatch = true;
    // 使用动态批量大小
    const batchSize = _getBatchSize();
    const batch = state._mutationBatch.splice(0, batchSize);

    batch.forEach(node => {
      if (!node.tagName) return;
      if (node.tagName === 'SCRIPT' && node.src) processScript(node);
      else if (node.tagName === 'LINK' && node.rel === 'stylesheet') processLink(node);
      else if (node.tagName === 'IMG') processImage(node);
      else if (node.tagName === 'IFRAME') processIframeLazyLoad();

      if (node.querySelectorAll) {
        node.querySelectorAll('script[src]').forEach(processScript);
        node.querySelectorAll('link[rel="stylesheet"]').forEach(processLink);
        node.querySelectorAll('img[src]').forEach(processImage);
        node.querySelectorAll('iframe[src]').forEach(processIframeLazyLoad);
      }
    });

    state._isProcessingBatch = false;

    // 如果还有剩余节点，使用动态间隔继续处理
    if (state._mutationBatch.length > 0) {
      const interval = _getBatchInterval();
      setTimeout(_processBatch, interval);
    }
  }

  function _processMutations(mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node.tagName) continue;
        if (node.tagName === 'SCRIPT' && node.src) processScript(node);
        else if (node.tagName === 'LINK' && node.rel === 'stylesheet') processLink(node);
        else if (node.tagName === 'IMG') processImage(node);
        else if (node.tagName === 'IFRAME') processIframeLazyLoad();

        if (node.querySelectorAll) {
          node.querySelectorAll('script[src]').forEach(processScript);
          node.querySelectorAll('link[rel="stylesheet"]').forEach(processLink);
          node.querySelectorAll('img[src]').forEach(processImage);
          node.querySelectorAll('iframe[src]').forEach(processIframeLazyLoad);
        }
      }
    }
  }

  // ========== 共享网络状态模块 ==========
  // 单例模式：避免 PriorityOptimizer 和 AdaptiveCompressor 重复检测
  const NetworkState = {
    quality: 'medium',
    _listeners: new Set(),
    _handleNetworkChange: null,

    init() {
      this.detect();
      this.listen();
    },

    detect() {
      if (!navigator.connection) return;

      const effectiveType = navigator.connection.effectiveType;
      const downlink = navigator.connection.downlink;

      if (effectiveType === '4g' && downlink > 10) {
        this.quality = 'fast';
      } else if (effectiveType === '4g' || effectiveType === '3g') {
        this.quality = 'medium';
      } else {
        this.quality = 'slow';
      }

      state._lastNetworkQuality = this.quality;
    },

    listen() {
      if (!navigator.connection) return;

      this._handleNetworkChange = () => {
        const oldQuality = this.quality;
        this.detect();
        if (oldQuality !== this.quality) {
          this._notifyListeners();
        }
      };

      navigator.connection.addEventListener('change', this._handleNetworkChange);
    },

    subscribe(callback) {
      this._listeners.add(callback);
      return () => this._listeners.delete(callback);
    },

    _notifyListeners() {
      this._listeners.forEach(cb => cb(this.quality));
    },

    destroy() {
      if (this._handleNetworkChange && navigator.connection) {
        navigator.connection.removeEventListener('change', this._handleNetworkChange);
      }
      this._listeners.clear();
    }
  };

  // ========== 性能监控 ==========
  class PerformanceMonitor {
    constructor(config) {
      this.config = config;
      this.metrics = {};
      this.observers = [];
      this.sampled = Math.random() < config.sampleRate;
      this._reportTimer = null;
    }

    init() {
      if (!this.config.enabled || !this.sampled) return;

      this.initCoreWebVitals();
      this.initResourceTiming();
      this.initMemoryMonitoring();
      this.startReporting();

      console.log(`${LOG_PREFIX} [PerfMonitor] 初始化完成`);
    }

    initCoreWebVitals() {
      // LCP 已在 init() 中通过 state.lcp 收集，此处不再重复创建 observer

      try {
        if (this.config.metrics.fid && typeof PerformanceObserver !== 'undefined') {
          const fidObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
              if (entry.processingStart) {
                this.metrics.fid = entry.processingStart - entry.startTime;
              }
            });
          });
          fidObserver.observe({ type: 'first-input', buffered: true });
          this.observers.push(fidObserver);
        }
      } catch (e) { console.warn(`${LOG_PREFIX} [PerfMonitor] 指标收集失败:`, e); }

      try {
        if (this.config.metrics.cls && typeof PerformanceObserver !== 'undefined') {
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            });
            this.metrics.cls = clsValue;
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
          this.observers.push(clsObserver);
        }
      } catch (e) { console.warn(`${LOG_PREFIX} [PerfMonitor] 指标收集失败:`, e); }

      try {
        if (this.config.metrics.fcp && typeof PerformanceObserver !== 'undefined') {
          const fcpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries();
            entries.forEach(entry => {
              if (entry.name === 'first-contentful-paint') {
                this.metrics.fcp = entry.startTime;
              }
            });
          });
          fcpObserver.observe({ type: 'paint', buffered: true });
          this.observers.push(fcpObserver);
        }
      } catch (e) { console.warn(`${LOG_PREFIX} [PerfMonitor] 指标收集失败:`, e); }

      if (this.config.metrics.ttfb) {
        const navEntry = performance.getEntriesByType('navigation')[0];
        if (navEntry) {
          this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
        }
      }
    }

    initResourceTiming() {
      if (!this.config.metrics.resourceTiming) return;

      try {
        const resourceObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          entries.forEach(entry => {
            this.processResourceTiming(entry);
          });
        });
        resourceObserver.observe({ type: 'resource', buffered: true });
        this.observers.push(resourceObserver);
      } catch (e) { console.warn(`${LOG_PREFIX} [PerfMonitor] 指标收集失败:`, e); }
    }

    processResourceTiming(entry) {
      const url = entry.name;
      const duration = entry.duration;
      const size = entry.transferSize || 0;

      if (!this.metrics.resources) {
        this.metrics.resources = [];
      }

      this.metrics.resources.push({
        url,
        duration,
        size,
        type: this.getResourceType(url),
        timestamp: Date.now(),
      });

      if (this.metrics.resources.length > 100) {
        this.metrics.resources = this.metrics.resources.slice(-100);
      }
    }

    getResourceType(url) {
      if (url.endsWith('.js')) return 'script';
      if (url.endsWith('.css')) return 'style';
      if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) return 'image';
      if (url.match(/\.(woff|woff2|ttf|otf)$/)) return 'font';
      return 'other';
    }

    initMemoryMonitoring() {
      if (!this.config.metrics.memoryUsage) return;

      this._memoryTimer = setInterval(() => {
        if (performance.memory) {
          this.metrics.memoryUsage = {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          };
        }
      }, 5000);
    }

    startReporting() {
      this._reportTimer = setInterval(() => {
        this.reportMetrics();
      }, this.config.reportInterval);
    }

    async reportMetrics() {
      if (Object.keys(this.metrics).length === 0) return;

      const report = {
        timestamp: Date.now(),
        url: location.href,
        userAgent: navigator.userAgent,
        connection: this.getConnectionInfo(),
        metrics: {
        ...this.metrics,
        resources: this.metrics.resources ? this.metrics.resources.map(r => ({...r})) : [],
      },
      };

      await this.saveMetrics(report);
      this.metrics.resources = [];
    }

    getConnectionInfo() {
      if (navigator.connection) {
        return {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
        };
      }
      return null;
    }

    async saveMetrics(report) {
      try {
        const result = await chrome.storage.local.get(this.config.storageKey);
        const metrics = result[this.config.storageKey] || [];

        metrics.push(report);

        if (metrics.length > this.config.maxEntries) {
          metrics.splice(0, metrics.length - this.config.maxEntries);
        }

        await chrome.storage.local.set({ [this.config.storageKey]: metrics });
      } catch (e) {
        console.warn(`${LOG_PREFIX} [PerfMonitor] 保存指标失败:`, e);
      }
    }

    getOptimizationSuggestions() {
      const suggestions = [];

      if (state.lcp != null && state.lcp > 2500) {
        suggestions.push({
          type: 'lcp',
          severity: 'high',
          message: 'LCP 时间过长，建议优化关键资源加载',
          actions: ['启用关键资源优先加载', '优化图片加载', '减少渲染阻塞资源'],
        });
      }

      if (this.metrics.cls > 0.1) {
        suggestions.push({
          type: 'cls',
          severity: 'medium',
          message: '布局偏移过大，建议稳定页面布局',
          actions: ['为图片设置尺寸', '避免动态插入内容', '使用 CSS containment'],
        });
      }

      if (this.metrics.resources) {
        const slowResources = this.metrics.resources.filter(r => r.duration > 1000);
        if (slowResources.length > 0) {
          suggestions.push({
            type: 'resource',
            severity: 'medium',
            message: `发现 ${slowResources.length} 个慢加载资源`,
            actions: ['启用 CDN 加速', '优化资源大小', '使用懒加载'],
          });
        }
      }

      return suggestions;
    }

    destroy() {
      this.observers.forEach(observer => observer.disconnect());
      this.observers = [];
      if (this._reportTimer) clearInterval(this._reportTimer);
      if (this._memoryTimer) clearInterval(this._memoryTimer);
    }
  }

  // ========== 优先级优化 ==========
  class PriorityOptimizer {
    constructor(config) {
      this.config = config;
      this.currentPriority = {};
      this.networkQuality = 'medium';
      this.pageType = 'default';
      this._handleNetworkChange = null;
    }

    init() {
      if (!this.config.enabled) return;

      this.detectNetworkQuality();
      this.detectPageType();
      this.calculatePriority();
      this.applyToExistingElements();
      this.listenNetworkChanges();

      console.log(`${LOG_PREFIX} [PriorityOptimizer] 初始化完成`);
    }

    detectNetworkQuality() {
      if (!this.config.networkAware.enabled) return;
      // 使用共享函数，统一网络质量检测
      this.networkQuality = detectNetworkQuality();
    }

    detectPageType() {
      if (!this.config.pageTypeAware.enabled) return;

      const url = location.href;
      const hostname = location.hostname;

      for (const [type, rules] of Object.entries(this.config.pageTypeAware.rules)) {
        const patterns = this.getPageTypePatterns(type);
        const matches = patterns.some(pattern => pattern.test(url) || pattern.test(hostname));

        if (matches) {
          this.pageType = type;
          return;
        }
      }

      this.pageType = 'default';
    }

    getPageTypePatterns(type) {
      const patterns = {
        ecommerce: [/product/i, /item/i, /shop/i, /cart/i],
        news: [/article/i, /news/i, /post/i, /blog/i],
        video: [/video/i, /watch/i, /player/i, /stream/i],
      };

      return patterns[type] || [];
    }

    calculatePriority() {
      const basePriority = this.getBasePriority();
      const networkAdjustment = this.getNetworkAdjustment();
      const pageTypeAdjustment = this.getPageTypeAdjustment();

      this.currentPriority = { ...basePriority };

      if (this.config.networkAware.enabled && networkAdjustment) {
        Object.keys(this.currentPriority).forEach(type => {
          if (networkAdjustment[type] !== undefined) {
            this.currentPriority[type] = networkAdjustment[type];
          }
        });
      }

      if (this.config.pageTypeAware.enabled && pageTypeAdjustment) {
        Object.keys(this.currentPriority).forEach(type => {
          if (pageTypeAdjustment[type] !== undefined) {
            this.currentPriority[type] = pageTypeAdjustment[type];
          }
        });
      }
    }

    getBasePriority() {
      return { script: 0, style: 1, image: 2, font: 3, video: 4 };
    }

    getNetworkAdjustment() {
      return this.config.networkAware.adjustments[this.networkQuality];
    }

    getPageTypeAdjustment() {
      return this.config.pageTypeAware.rules[this.pageType];
    }

    listenNetworkChanges() {
      if (!navigator.connection) return;

      this._handleNetworkChange = () => {
        this.detectNetworkQuality();
        this.calculatePriority();
      };

      navigator.connection.addEventListener('change', this._handleNetworkChange);
    }

    getResourcePriority(url, type) {
      let priority = this.currentPriority[type] ?? 2;

      if (this.config.sizeAware.enabled) {
        const size = this.estimateResourceSize(url, type);
        if (size < this.config.sizeAware.smallResourceThreshold) {
          priority = Math.max(0, priority - 1);
        } else if (size > this.config.sizeAware.largeResourceThreshold) {
          priority = Math.min(4, priority + 1);
        }
      }

      return priority;
    }

    estimateResourceSize(url, type) {
      const sizeEstimates = {
        script: 50000,
        style: 20000,
        image: 100000,
        font: 30000,
        video: 1000000,
      };

      return sizeEstimates[type] || 50000;
    }

    applyPriorityToResource(element, url, type) {
      const priority = this.getResourcePriority(url, type);

      if (element.fetchPriority) {
        element.fetchPriority = priority <= 1 ? 'high' : priority >= 3 ? 'low' : 'auto';
      }

      if (element.loading) {
        element.loading = priority <= 1 ? 'eager' : 'lazy';
      }
    }

    applyToExistingElements() {
      if (!this.config.scanExisting?.enabled) return;

      const viewportHeight = window.innerHeight;
      let count = 0;
      const max = this.config.scanExisting.maxElements || 50;

      document.querySelectorAll('script[src]').forEach(script => {
        if (count >= max) return;
        this.applyPriorityToResource(script, script.src, 'script');
        count++;
      });

      document.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
        if (count >= max) return;
        this.applyPriorityToResource(link, link.href, 'style');
        count++;
      });

      document.querySelectorAll('img[src]').forEach(img => {
        if (count >= max) return;
        const rect = img.getBoundingClientRect();
        const isInViewport = rect.top < viewportHeight;
        this.applyPriorityToResource(img, img.src, 'image');
        if (!isInViewport && img.loading !== 'lazy') {
          img.loading = 'lazy';
        }
        count++;
      });

      console.log(`${LOG_PREFIX} [PriorityOptimizer] 扫描已有资源: ${count} 个`);
    }

    getPriorityInfo() {
      return {
        networkQuality: this.networkQuality,
        pageType: this.pageType,
        currentPriority: { ...this.currentPriority },
      };
    }

    destroy() {
      // 移除网络变化监听器
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', this._handleNetworkChange);
      }
    }
  }

  // ========== 内存优化 ==========
  class MemoryOptimizer {
    constructor(config) {
      this.config = config;
      this.cache = new Map();
      this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
      this.memoryPressure = 'normal';
      this._checkTimer = null;
      this._saveTimer = null;
    }

    async init() {
      if (!this.config.enabled) return;

      this.initMemoryMonitoring();
      this.initCache();
      await this.loadCacheData();
      await this.prewarmCache();

      console.log(`${LOG_PREFIX} [MemoryOptimizer] 初始化完成`);
    }

    initMemoryMonitoring() {
      if (!this.config.monitoring.enabled) return;

      this._checkTimer = setInterval(() => {
        this.checkMemoryPressure();
      }, this.config.monitoring.checkInterval);
    }

    checkMemoryPressure() {
      if (!performance.memory) return;

      const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024;

      if (usedMB > this.config.monitoring.thresholds.critical) {
        this.memoryPressure = 'critical';
        this.applyPressureResponse('critical');
      } else if (usedMB > this.config.monitoring.thresholds.warning) {
        this.memoryPressure = 'warning';
        this.applyPressureResponse('warning');
      } else {
        this.memoryPressure = 'normal';
      }
    }

    applyPressureResponse(pressure) {
      const strategy = this.config.pressureResponse.strategies[pressure];
      if (!strategy) return;

      if (strategy.disableImageCompress && typeof state !== 'undefined') {
        state.config.imageCompress = false;
      }

      if (strategy.reduceCacheSize) {
        this.reduceCacheSize();
      }

      if (strategy.pauseBackgroundTasks) {
        this.pauseBackgroundTasks();
      }
    }

    reduceCacheSize() {
      const currentSize = this.getCacheSize();
      const targetSize = this.config.caching.maxSize * 0.5;

      if (currentSize > targetSize) {
        this.evictCacheEntries(currentSize - targetSize);
      }
    }

    pauseBackgroundTasks() {
      // Worker pool pause not implemented in current architecture
    }

    initCache() {
      this.cache = new Map();
    }

    async loadCacheData() {
      try {
        const result = await chrome.storage.local.get('resourceAcceleratorCacheData');
        const cachedData = result.resourceAcceleratorCacheData || {};

        for (const [key, value] of Object.entries(cachedData)) {
          if (this.isCacheEntryValid(value)) {
            this.cache.set(key, value);
          }
        }
      } catch (e) {
        console.warn(`${LOG_PREFIX} [MemoryOptimizer] 加载缓存数据失败:`, e);
      }
    }

    async prewarmCache() {
      if (!this.config.caching.prewarm?.enabled) return;

      const types = this.config.caching.prewarm.types || [];
      const resources = document.querySelectorAll('link[rel="stylesheet"], script[src], style');

      for (const resource of resources) {
        let url = '';
        let type = '';

        if (resource.tagName === 'LINK' && resource.rel === 'stylesheet') {
          url = resource.href;
          type = 'css';
        } else if (resource.tagName === 'SCRIPT' && resource.src) {
          url = resource.src;
          type = 'js';
        } else if (resource.tagName === 'STYLE') {
          type = 'css';
        }

        if (url && types.includes(type)) {
          const cacheKey = `prewarm:${url}`;
          const existing = await this.getFromCache(cacheKey);
          if (!existing) {
            this.cache.set(cacheKey, {
              value: { url, type, prewarmed: true },
              timestamp: Date.now(),
              lastAccess: Date.now(),
              accessCount: 0,
            });
          }
        }
      }

      console.log(`${LOG_PREFIX} [MemoryOptimizer] 缓存预热完成，当前缓存 ${this.cache.size} 项`);
    }

    isCacheEntryValid(entry) {
      if (!entry || !entry.timestamp) return false;
      const now = Date.now();
      return now - entry.timestamp < this.config.caching.ttl;
    }

    async saveCacheData() {
      try {
        const cacheData = Object.fromEntries(this.cache);
        await chrome.storage.local.set({ resourceAcceleratorCacheData: cacheData });
      } catch (e) {
        console.warn(`${LOG_PREFIX} [MemoryOptimizer] 保存缓存数据失败:`, e);
      }
    }

    getCacheSize() {
      let size = 0;
      for (const [key, value] of this.cache.entries()) {
        size += this.estimateSize(value.value);
      }
      return size;
    }

    estimateSize(value) {
      if (typeof value === 'string') {
        return value.length * 2;
      }
      return JSON.stringify(value).length * 2;
    }

    evictCacheEntries(targetSize) {
      let evictedSize = 0;
      const entries = Array.from(this.cache.entries());

      switch (this.config.caching.evictionPolicy) {
        case 'lru':
          entries.sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0));
          break;
        case 'lfu':
          entries.sort((a, b) => (a[1].accessCount || 0) - (b[1].accessCount || 0));
          break;
        case 'fifo':
          entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
          break;
      }

      for (const [key, value] of entries) {
        if (evictedSize >= targetSize) break;
        const size = this.estimateSize(value);
        this.cache.delete(key);
        evictedSize += size;
        this.cacheStats.evictions++;
      }
    }

    async getFromCache(key) {
      if (!this.config.caching.enabled) return null;

      const entry = this.cache.get(key);
      if (!entry) {
        this.cacheStats.misses++;
        return null;
      }

      if (!this.isCacheEntryValid(entry)) {
        this.cache.delete(key);
        this.cacheStats.misses++;
        return null;
      }

      entry.lastAccess = Date.now();
      entry.accessCount = (entry.accessCount || 0) + 1;
      this.cacheStats.hits++;
      return entry.value;
    }

    async setCache(key, value) {
      if (!this.config.caching.enabled) return;

      const currentSize = this.getCacheSize();
      const entrySize = this.estimateSize(value);

      if (currentSize + entrySize > this.config.caching.maxSize) {
        this.evictCacheEntries(entrySize);
      }

      this.cache.set(key, {
        value,
        timestamp: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
      });

      this.scheduleSaveCacheData();
    }

    scheduleSaveCacheData() {
      if (this._saveTimer) return;
      this._saveTimer = setTimeout(() => {
        this._saveTimer = null;
        this.saveCacheData();
      }, 5000);
    }

    getCacheStats() {
      return {
        ...this.cacheStats,
        size: this.getCacheSize(),
        entries: this.cache.size,
        memoryPressure: this.memoryPressure,
      };
    }

    clearCache() {
      this.cache.clear();
      this.cacheStats = { hits: 0, misses: 0, evictions: 0 };
      this.saveCacheData();
    }

    destroy() {
      if (this._checkTimer) clearInterval(this._checkTimer);
      if (this._saveTimer) clearTimeout(this._saveTimer);
      this.saveCacheData();
    }
  }

  let _perfMonitor = null;

  function _initPerfMonitor() {
    if (!state.config.perfMonitor?.enabled) return;
    _perfMonitor = new PerformanceMonitor(state.config.perfMonitor);
    _perfMonitor.init();
  }

  let _priorityOptimizer = null;

  function _initPriorityOptimizer() {
    if (!state.config.priorityOptimizer?.enabled) return;
    _priorityOptimizer = new PriorityOptimizer(state.config.priorityOptimizer);
    _priorityOptimizer.init();
  }

  let _memoryOptimizer = null;

  function _initMemoryOptimizer() {
    if (!state.config.memoryOptimizer?.enabled) return;
    _memoryOptimizer = new MemoryOptimizer(state.config.memoryOptimizer);
    _memoryOptimizer.init();
  }

  // ========== LQIP 渐进式占位 ==========
  let _lqipStyleInjected = false;

  function _injectLqipCSS() {
    if (_lqipStyleInjected) return;
    const config = state.config.lqip;
    if (!config?.enabled) return;

    const style = document.createElement('style');
    style.textContent = `
      img[data-lqip] {
        filter: blur(${config.blurRadius}px);
        transition: filter ${config.transitionDuration}ms ease-out, opacity ${config.transitionDuration}ms ease-out;
        opacity: 0.6;
        background-color: ${config.placeholderColor};
      }
      img[data-lqip-loaded] {
        filter: blur(0);
        opacity: 1;
      }
    `;
    const head = document.head || document.documentElement;
    head.appendChild(style);
    _lqipStyleInjected = true;
  }

  // ========== content-visibility 渲染优化 ==========
  let _contentVisibilityInjected = false;

  function _injectContentVisibilityCSS() {
    if (_contentVisibilityInjected) return;
    const config = state.config.contentVisibility;
    if (!config?.enabled) return;

    const includeSelector = config.selectors.join(', ');
    const excludeSelector = config.excludeSelectors.map(s => `:not(${s})`).join('');

    const style = document.createElement('style');
    style.textContent = `
      ${includeSelector}${excludeSelector} {
        content-visibility: auto;
        contain-intrinsic-size: 0 500px;
      }
    `;
    const head = document.head || document.documentElement;
    head.appendChild(style);
    _contentVisibilityInjected = true;
  }

  function _triggerLqipTransition(img) {
    if (!img.dataset.lqip) return;
    if (img.complete) {
      img.dataset.lqipLoaded = '1';
    } else {
      img.addEventListener('load', () => {
        img.dataset.lqipLoaded = '1';
      }, { once: true });
      img.addEventListener('error', () => {
        img.dataset.lqipLoaded = '1';
      }, { once: true });
    }
  }

  // ========== Worker 压缩管理 ==========
  let _compressorWorkers = [];
  let _workerTaskId = 0;
  let _workerPendingTasks = new Map();
  let _workerLoadIndex = 0;  // 轮询索引

  // 根据设备性能获取最优Worker数量
  function _getOptimalWorkerCount() {
    const tier = detectDeviceTier();
    const configMax = state.config.workerCompress?.maxWorkers || 2;
    // 高端设备4个，中端2个，低端1个
    const optimal = tier === 'high' ? 4 : tier === 'medium' ? 2 : 1;
    return Math.min(optimal, configMax);
  }

  // 创建单个Worker（支持健康检查重建）
  function _createWorker(index) {
    try {
      const worker = new Worker(chrome.runtime.getURL('content/workers/image-compressor.worker.js'));
      worker.onmessage = _handleWorkerMessage;
      worker.onerror = (e) => {
        console.error(`${LOG_PREFIX} Worker#${index}错误:`, e.message);
        // 健康检查：自动重建崩溃的Worker
        state.stats.workerCrashCount = (state.stats.workerCrashCount || 0) + 1;
        setTimeout(() => {
          if (_compressorWorkers[index] === worker) {
            _compressorWorkers[index] = _createWorker(index);
            console.log(`${LOG_PREFIX} Worker#${index}已重建`);
          }
        }, 100);
      };
      return worker;
    } catch (e) {
      console.warn(`${LOG_PREFIX} Worker创建失败:`, e);
      return null;
    }
  }

  function _initCompressorWorkers() {
    if (!state.config.workerCompress?.enabled) return;
    if (typeof Worker === 'undefined') return;

    const maxWorkers = _getOptimalWorkerCount();
    for (let i = 0; i < maxWorkers; i++) {
      const worker = _createWorker(i);
      if (worker) _compressorWorkers.push(worker);
    }

    if (_compressorWorkers.length > 0) {
      console.log(`${LOG_PREFIX} 已初始化 ${_compressorWorkers.length} 个压缩Worker (设备等级: ${detectDeviceTier()})`);
      // 预热：发送微型测试任务激活Worker
      _warmupWorkers();
    }
  }

  // Worker预热
  function _warmupWorkers() {
    const testPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    _compressorWorkers.forEach((worker, i) => {
      const id = `warmup-${i}`;
      worker.postMessage({ id, src: testPng, quality: 0.1, maxWidth: 1, maxHeight: 1 });
    });
  }

  function _handleWorkerMessage(e) {
    const { id, success, dataUrl, error, originalSize, compressedSize } = e.data;
    const task = _workerPendingTasks.get(id);
    if (!task) return;

    _workerPendingTasks.delete(id);

    // 记录耗时
    const duration = Date.now() - task.startTime;
    state.stats.workerCompressTotalMs = (state.stats.workerCompressTotalMs || 0) + duration;

    if (success) {
      state.stats.workerCompressSuccess = (state.stats.workerCompressSuccess || 0) + 1;
      task.resolve({ dataUrl, originalSize, compressedSize, duration });
    } else {
      state.stats.workerCompressFallback = (state.stats.workerCompressFallback || 0) + 1;
      task.reject(new Error(error));
    }
  }

  // 轮询分配Worker
  function _getAvailableWorker() {
    if (_compressorWorkers.length === 0) return null;
    const worker = _compressorWorkers[_workerLoadIndex % _compressorWorkers.length];
    _workerLoadIndex++;
    return worker;
  }

  async function _compressViaWorker(src, quality, maxWidth, maxHeight) {
    return new Promise((resolve, reject) => {
      const worker = _getAvailableWorker();
      if (!worker) {
        reject(new Error('No available worker'));
        return;
      }

      const id = ++_workerTaskId;
      const timeout = state.config.workerCompress?.timeout || 5000;
      const startTime = Date.now();

      const timer = setTimeout(() => {
        _workerPendingTasks.delete(id);
        state.stats.workerCompressFallback = (state.stats.workerCompressFallback || 0) + 1;
        reject(new Error('Worker timeout'));
      }, timeout);

      _workerPendingTasks.set(id, {
        startTime,
        resolve: (result) => {
          clearTimeout(timer);
          resolve(result);
        },
        reject: (err) => {
          clearTimeout(timer);
          reject(err);
        },
      });

      worker.postMessage({ id, src, quality, maxWidth, maxHeight });
    });
  }

  function _terminateCompressorWorkers() {
    _compressorWorkers.forEach(w => w.terminate());
    _compressorWorkers = [];
    _workerPendingTasks.clear();
  }

  // ========== 自适应压缩 ==========
  class AdaptiveCompressor {
    constructor(config) {
      this.config = config;
      this.typeCache = new Map();
      this.networkQuality = 'medium';  // 独立的网络质量状态
      this._handleNetworkChange = null;
    }

    init() {
      if (!this.config.enabled) return;

      // 独立检测网络质量，不依赖 PriorityOptimizer
      this.detectNetworkQuality();
      this.listenNetworkChanges();

      console.log(`${LOG_PREFIX} [AdaptiveCompressor] 初始化完成`);
    }

    detectNetworkQuality() {
      if (!this.config.networkAdaptive.enabled) return;
      // 使用共享函数，统一网络质量检测
      this.networkQuality = detectNetworkQuality();
    }

    listenNetworkChanges() {
      if (!navigator.connection) return;

      this._handleNetworkChange = () => {
        this.detectNetworkQuality();
      };

      navigator.connection.addEventListener('change', this._handleNetworkChange);
    }

    detectImageType(url, element) {
      if (!this.config.typeDetection.enabled) return 'photo';

      const cacheKey = url;
      if (this.typeCache.has(cacheKey)) {
        return this.typeCache.get(cacheKey);
      }

      let detectedType = 'photo';

      for (const [type, patterns] of Object.entries(this.config.typeDetection.patterns)) {
        const matches = patterns.some(pattern =>
          pattern.test(url) || pattern.test(element?.className || '')
        );
        if (matches) {
          detectedType = type;
          break;
        }
      }

      this.typeCache.set(cacheKey, detectedType);

      // 限制缓存大小，删除最旧的1000条而非全部清除
      if (this.typeCache.size > 5000) {
        const iter = this.typeCache.keys();
        for (let i = 0; i < 1000; i++) {
          this.typeCache.delete(iter.next().value);
        }
      }

      return detectedType;
    }

    getCompressParams(url, element, originalSize) {
      const imageType = this.detectImageType(url, element);
      const baseParams = this.config.typeStrategies[imageType] || this.config.typeStrategies.photo;

      let quality = baseParams.quality;
      let maxWidth = baseParams.maxWidth;
      let deviceTier = detectDeviceTier();  // 设备等级检测

      // 网络感知调整
      if (this.config.networkAdaptive.enabled) {
        const networkQuality = state._lastNetworkQuality || 'medium';
        const adjustment = this.config.networkAdaptive.adjustments[networkQuality];
        if (adjustment) {
          quality = Math.min(1, quality * adjustment.qualityMultiplier);
        }

        // 设备感知调整
        const deviceAdjustments = this.config.networkAdaptive.deviceAdjustments;
        if (deviceAdjustments) {
          const deviceAdjustment = deviceAdjustments[deviceTier];
          if (deviceAdjustment) {
            maxWidth = Math.floor(maxWidth * deviceAdjustment.maxWidthMultiplier);
          }
        }
      }

      // 尺寸感知调整
      if (this.config.sizeAdaptive.enabled && originalSize) {
        if (originalSize < this.config.sizeAdaptive.smallImageThreshold) {
          quality = Math.min(1, quality * 1.1);
        } else if (originalSize > this.config.sizeAdaptive.largeImageThreshold) {
          quality = Math.max(0.3, quality * 0.7);
          maxWidth = Math.floor(maxWidth * 0.7);
        }
      }

      // 设置最低质量阈值
      quality = Math.max(0.5, quality);

      // 调试日志
      addLog('debug', 'image', 'adaptive_params', {
        url,
        imageType,
        network: state._lastNetworkQuality,
        device: deviceTier,
        quality: quality.toFixed(2),
        maxWidth,
      });

      return {
        quality,
        maxWidth,
        imageType,
      };
    }

    destroy() {
      this.typeCache.clear();
    }
  }

  let _adaptiveCompressor = null;

  function _initAdaptiveCompressor() {
    if (!state.config.adaptiveCompress?.enabled) return;
    _adaptiveCompressor = new AdaptiveCompressor(state.config.adaptiveCompress);
    _adaptiveCompressor.init();
  }

  // ========== 智能预加载 v2 ==========
  class SmartPreloadV2 {
    constructor(config) {
      this.config = config;
      this.pageType = 'default';
      this.preloadQueue = [];
      this.activePreloads = 0;
      this.scrollSpeed = 0;
      this.lastScrollY = 0;
      this.lastScrollTime = Date.now();
      this.dwellTime = 0;
      this.pageLoadTime = Date.now();
      this._longBehaviorTriggered = false;
      this._shortBehaviorTriggered = false;
      this._preloadUrls = new Set();
    }

    init() {
      if (!this.config.enabled) return;

      this.analyzePageStructure();
      this.preloadCriticalResources();  // 新增
      this.initScrollListener();
      this.initMouseListener();
      this.initDwellTimeTracker();

      console.log(`${LOG_PREFIX} [SmartPreloadV2] 初始化完成`);
    }

    analyzePageStructure() {
      if (!this.config.pageStructure.enabled) return;

      const url = location.href;
      for (const [type, rules] of Object.entries(this.config.pageStructure.contentTypes)) {
        const matches = rules.patterns.some(pattern => pattern.test(url));
        if (matches) {
          this.pageType = type;
          break;
        }
      }

      this.criticalResources = this.detectCriticalResources();
    }

    detectCriticalResources() {
      const resources = [];

      if (this.config.pageStructure.criticalRegions.aboveFold) {
        const viewportHeight = window.innerHeight;
        document.querySelectorAll('img[src]').forEach(img => {
          const rect = img.getBoundingClientRect();
          if (rect.top < viewportHeight) {
            resources.push({
              url: img.src,
              type: 'image',
              priority: 0,
              region: 'aboveFold',
            });
          }
        });
      }

      if (this.config.pageStructure.criticalRegions.navigation) {
        document.querySelectorAll('nav a[href], .nav a[href], header a[href]').forEach(link => {
          resources.push({
            url: link.href,
            type: 'link',
            priority: 1,
            region: 'navigation',
          });
        });
      }

      return resources;
    }

    preloadCriticalResources() {
      if (!this.criticalResources || this.criticalResources.length === 0) return;
      this.criticalResources
        .filter(r => r.type === 'image' && r.priority === 0)
        .slice(0, this.config.priorityScheduling.maxPreloads || 6)
        .forEach(r => this._executePreload(r.url, 'aboveFold'));
    }

    initScrollListener() {
      if (!this.config.intentPrediction.enabled) return;

      this._scrollTimer = null;
      this._scrollHandler = () => {
        const now = Date.now();
        const deltaY = Math.abs(window.scrollY - this.lastScrollY);
        const deltaTime = now - this.lastScrollTime;

        if (deltaTime > 0) {
          this.scrollSpeed = deltaY / (deltaTime / 1000);
        }

        this.lastScrollY = window.scrollY;
        this.lastScrollTime = now;

        clearTimeout(this._scrollTimer);
        this._scrollTimer = setTimeout(() => {
          this.onScrollEnd();
        }, 150);
      };
      window.addEventListener('scroll', this._scrollHandler, { passive: true });
    }

    onScrollEnd() {
      const { fastThreshold, slowThreshold, fastBehavior, slowBehavior } =
        this.config.intentPrediction.scrollSpeed;

      if (this.scrollSpeed > fastThreshold) {
        this.executeStrategy(fastBehavior);
      } else if (this.scrollSpeed < slowThreshold) {
        this.executeStrategy(slowBehavior);
      }
    }

    initMouseListener() {
      if (!this.config.intentPrediction.mouseMovement.enabled) return;

      this._mouseHandler = (e) => {
        const target = e.target.closest('a[href], img[src]');
        if (!target) return;

        const url = target.href || target.src;
        if (!url) return;

        clearTimeout(this._mouseTimeout);
        this._mouseTimeout = setTimeout(() => {
          this.schedulePreload(url, 'hover', 2);
        }, this.config.intentPrediction.mouseMovement.hoverDelay);
      };
      document.addEventListener('mouseover', this._mouseHandler, { passive: true });
    }

    initDwellTimeTracker() {
      if (!this.config.intentPrediction.enabled) return;

      this._dwellTimer = setInterval(() => {
        this.dwellTime = Date.now() - this.pageLoadTime;
        const { shortThreshold, longThreshold, shortBehavior, longBehavior } =
          this.config.intentPrediction.dwellTime;

        if (this.dwellTime > longThreshold && !this._longBehaviorTriggered) {
          this._longBehaviorTriggered = true;
          this.executeStrategy(longBehavior);
        } else if (this.dwellTime > shortThreshold && this.dwellTime <= longThreshold && !this._shortBehaviorTriggered) {
          this._shortBehaviorTriggered = true;
          this.executeStrategy(shortBehavior);
        }
      }, 5000);
    }

    executeStrategy(strategy) {
      switch (strategy) {
        case 'preload-more':
          this.preloadNextResources(3);
          break;
        case 'preload-details':
          this.preloadCurrentContentDetails();
          break;
        case 'preload-next':
          this.preloadNextPage();
          break;
        case 'preload-related':
          this.preloadRelatedContent();
          break;
      }
    }

    schedulePreload(url, reason, priority) {
      if (this.activePreloads >= this.config.priorityScheduling.maxConcurrent) {
        this.preloadQueue.push({ url, reason, priority });
        this.preloadQueue.sort((a, b) => a.priority - b.priority);
        return;
      }

      this._executePreload(url, reason);
    }

    _executePreload(url, reason) {
      if (this._preloadUrls.has(url)) return;  // 去重
      this._preloadUrls.add(url);
      this.activePreloads++;
      const isCritical = reason === 'aboveFold' || reason === 'hover' || reason === 'scroll-predict';
      const link = document.createElement('link');
      link.rel = isCritical ? 'preload' : 'prefetch';
      link.href = url;
      if (isCritical) {
        link.as = 'image';
        const preloadCount = document.querySelectorAll('link[rel="preload"][data-preload-reason]').length;
        if (preloadCount >= (this.config.priorityScheduling.maxPreloads || 6)) {
          link.rel = 'prefetch';
          delete link.as;
        }
      }
      link.dataset.preloadReason = reason;

      let _done = false;
      const finish = () => {
        if (_done) return;
        _done = true;
        this.activePreloads--;
        this.processQueue();
      };
      link.onload = finish;
      link.onerror = finish;
      setTimeout(finish, 3000);

      document.head.appendChild(link);
    }

    processQueue() {
      while (this.preloadQueue.length > 0 &&
             this.activePreloads < this.config.priorityScheduling.maxConcurrent) {
        const item = this.preloadQueue.shift();
        this._executePreload(item.url, item.reason);
      }
    }

    preloadNextResources(count) {
      const viewportHeight = window.innerHeight;
      const images = document.querySelectorAll('img[data-src], img[src]');
      let preloaded = 0;

      for (const img of images) {
        if (preloaded >= count) break;

        const rect = img.getBoundingClientRect();
        if (rect.top > viewportHeight && rect.top < viewportHeight + 500) {
          const url = img.dataset.src || img.src;
          if (url && !url.startsWith('data:') && !img.complete && img.naturalWidth === 0) {
            this.schedulePreload(url, 'scroll-predict', 1);
            preloaded++;
          }
        }
      }
    }

    preloadCurrentContentDetails() {
      const article = document.querySelector('article, .article, .post-content, .entry-content');
      if (!article) return;

      let count = 0;
      const images = article.querySelectorAll('img[data-src], img[src]');
      images.forEach(img => {
        if (count >= 10) return;
        const url = img.dataset.src || img.src;
        if (url && !url.startsWith('data:')) {
          this.schedulePreload(url, 'content-detail', 2);
          count++;
        }
      });

      const links = article.querySelectorAll('a[href]');
      links.forEach(link => {
        if (count >= 10) return;
        if (link.hostname === location.hostname) {
          this.schedulePreload(link.href, 'related-link', 3);
          count++;
        }
      });
    }

    preloadNextPage() {
      const nextLink = document.querySelector('a[rel="next"], .next-page, .pagination .next a');
      if (nextLink) {
        this.schedulePreload(nextLink.href, 'next-page', 1);
      }
    }

    preloadRelatedContent() {
      const relatedSections = document.querySelectorAll(
        '.related-posts, .recommended, .similar-articles, aside'
      );

      let count = 0;
      relatedSections.forEach(section => {
        const links = section.querySelectorAll('a[href]');
        links.forEach(link => {
          if (count >= 10) return;
          if (link.hostname === location.hostname) {
            this.schedulePreload(link.href, 'related-content', 2);
            count++;
          }
        });
      });
    }

    destroy() {
      if (this._scrollHandler) {
        window.removeEventListener('scroll', this._scrollHandler);
      }
      if (this._scrollTimer) {
        clearTimeout(this._scrollTimer);
      }
      if (this._mouseHandler) {
        document.removeEventListener('mouseover', this._mouseHandler);
      }
      if (this._mouseTimeout) {
        clearTimeout(this._mouseTimeout);
      }
      if (this._dwellTimer) {
        clearInterval(this._dwellTimer);
      }
      document.querySelectorAll('link[data-preload-reason]').forEach(el => el.remove());
      this._preloadUrls.clear();
      this.preloadQueue = [];
    }
  }

  let _smartPreloadV2 = null;

  function _initSmartPreloadV2() {
    if (!state.config.smartPreloadV2?.enabled) return;
    _smartPreloadV2 = new SmartPreloadV2(state.config.smartPreloadV2);
    _smartPreloadV2.init();
  }

  // ========== 页面跳转资源清理 ==========
  /**
   * 监听页面跳转，取消非可视区资源加载
   * 使用 requestIdleCallback 延迟清理，不阻塞页面跳转
   */
  function _initNavigationListener() {
    window.addEventListener('pagehide', () => {
      // 标记跳转状态，立即返回让页面跳转
      state._isNavigating = true;

      // 使用 requestIdleCallback 延迟清理，不阻塞
      requestIdleCallback?.(() => {
        state.compressQueue = [];
        state._deferredScripts = [];
      }, { timeout: 100 }) || setTimeout(() => {
        state.compressQueue = [];
        state._deferredScripts = [];
      }, 0);
    }, { once: true });
  }

  // ========== 初始化（异步但不阻塞）==========

  // 获取页面使用的 CDN 优先级
  function _getCDNPriorities() {
    const pageCDNs = new Set();

    // 扫描页面中的 script 和 link 元素
    const elements = document.querySelectorAll('script[src], link[href]');
    elements.forEach(el => {
      const url = el.src || el.href;
      if (isCDNUrl(url)) {
        const cdnInfo = _getCDNInfo(url);
        if (cdnInfo) {
          pageCDNs.add(cdnInfo.id);
        }
      }
    });

    return Array.from(pageCDNs);
  }

  // 获取 URL 对应的 CDN 信息
  function _getCDNInfo(url) {
    if (!window.CDNMappings?.CDN_SOURCES) return null;

    for (const cdn of window.CDNMappings.CDN_SOURCES) {
      try {
        const cdnUrl = new URL(cdn.baseUrl);
        if (url.includes(cdnUrl.hostname)) {
          return { id: cdn.id, name: cdn.name || cdn.id };
        }
      } catch (error) {
        console.warn('[_getCDNInfo] 解析CDN URL失败:', error);
      }
    }
    return null;
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;

    // 0. LCP 指标收集（需要尽早启动观察）
    let lcpObserver = null;
    try {
      if (typeof PerformanceObserver !== 'undefined') {
        lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          if (entries.length > 0) {
            state.lcp = entries[entries.length - 1].startTime;
          }
        });
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
      }
    } catch {
      // 部分浏览器不支持 largest-contentful-paint 类型
    }

    // 1. 加载配置（异步，不阻塞）
    _loadConfig();

    // 注入LQIP样式
    _injectLqipCSS();

    // 注入 content-visibility 样式
    _injectContentVisibilityCSS();

    // 1.1 恢复历史错误日志（异步，不阻塞）
    _restoreErrorLogs();

    // 2. CSP 预检（异步，不阻塞）
    _precheckCSP();

    // 3. CDN preconnect
    _addCDNPreconnect();

    // 全站DNS prefetch
    _addGlobalDnsPrefetch();

    // 初始化压缩Worker
    _initCompressorWorkers();

    // 初始化网络变化监听
    _initNetworkChangeListener();

    // 4. CDN健康探测（异步，不阻塞）- 优先探测页面使用的 CDN
    if (window.CDNMappings?.probeAllCDNs) {
      const pageCDNs = _getCDNPriorities();
      let probePromise;
      if (pageCDNs.length > 0) {
        console.log(`${LOG_PREFIX} 优先探测页面使用的 CDN: ${pageCDNs.join(', ')}`);
        // 先探测页面使用的 CDN，再探测其他 CDN
        probePromise = window.CDNMappings.probeAllCDNs({ priorityIds: pageCDNs });
      } else {
        probePromise = window.CDNMappings.probeAllCDNs();
      }
      // 探测完成后记录健康状态到日志缓冲区
      probePromise?.then?.(() => {
        const cdnHealth = window.CDNMappings?.getCDNHealth?.() || {};
        Object.entries(cdnHealth).forEach(([cdnId, health]) => {
          addLog('info', 'cdn', 'probe', {
            cdn: cdnId,
            reason: health.healthy ? `RTT: ${health.rtt}ms` : '探测失败'
          });
        });
      });
    }

    // 5. 启动 MutationObserver（兜底）
    _observer.observe(document.documentElement, { childList: true, subtree: true });

    // 6. 处理已有资源
    document.querySelectorAll('script[src]').forEach(processScript);
    document.querySelectorAll('link[rel="stylesheet"]').forEach(processLink);
    document.querySelectorAll('img[src]').forEach(processImage);
    // 处理已有iframe
    processIframeLazyLoad();

    // 7. 消息监听
    _initMessageListener();

    // 1.14 初始化性能监控
    _initPerfMonitor();

    // 1.15 初始化优先级优化
    _initPriorityOptimizer();

    // 1.16 初始化内存优化
    _initMemoryOptimizer();

    // 1.17 初始化自适应压缩
    _initAdaptiveCompressor();

    // 1.18 初始化智能预加载 v2
    _initSmartPreloadV2();

    // 1.19 初始化页面跳转监听
    _initNavigationListener();

    // 8. 页面加载后收集性能指标并停止 LCP 观察
    window.addEventListener('load', () => {
      if (lcpObserver) {
        lcpObserver.disconnect();
      }
      state.performance = collectPerformanceMetrics();
      // 保存每日统计数据用于趋势图表
      saveDailyStats();
    }, { once: true });

    // 9. 点击预览立即加载原图
    document.addEventListener('click', (e) => {
      const img = e.target.closest('img[data-_raLazyLoad="1"]');
      if (!img) return;

      const originalSrc = img.dataset.src;
      if (!originalSrc || img.dataset.lazyLoaded === 'true') return;

      // 立即加载原图
      img.src = originalSrc;
      img.dataset.lazyLoaded = 'true';
      img.loading = 'eager';
      if ('fetchPriority' in img) img.fetchPriority = 'high';

      // 触发 LQIP 过渡
      _triggerLqipTransition(img);

      addLog('info', 'image', 'click_load', { url: originalSrc, reason: 'user_click_preview' });
    }, { capture: true });

    console.log(`${LOG_PREFIX} 初始化完成`);
  }

  async function _loadConfig() {
    try {
      const result = await chrome.storage.local.get(CONFIG_KEY);
      let userConfig = result[CONFIG_KEY] || {};

      // 配置迁移：自动升级旧版本配置
      if (window.ConfigMigrator && userConfig.version !== DEFAULT_CONFIG.version) {
        const migrationResult = await ConfigMigrator.migrate(userConfig);
        if (migrationResult?.config) {
          userConfig = migrationResult.config;
          console.log(`${LOG_PREFIX} 配置迁移完成: ${migrationResult.fromVersion} -> ${migrationResult.toVersion}`);
        }
      }

      // Deep merge for nested config objects
      state.config = { ...DEFAULT_CONFIG };
      for (const key of Object.keys(userConfig)) {
        if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
          state.config[key] = { ...DEFAULT_CONFIG[key], ...userConfig[key] };
        } else {
          state.config[key] = userConfig[key];
        }
      }

      if (!state.config.enabled) {
        _observer.disconnect();
      }
    } catch (error) {
      console.warn('[_loadConfig] 加载配置失败:', error);
    }
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
      } catch (error) {
        console.warn('[_addCDNPreconnect] 添加CDN预连接失败:', error);
      }
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
      if (message.type === 'RESOURCE_ACCELERATOR_GET_LOGS') {
        const logs = getLogs(message.filter || {});
        sendResponse({ success: true, data: logs });
        return true;
      }
      if (message.type === 'RESOURCE_ACCELERATOR_CLEAR_LOGS') {
        clearLogs();
        sendResponse({ success: true });
        return true;
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_DISTRIBUTION') {
        sendResponse({ success: true, data: getStatsDistribution() });
        return true;
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_TREND') {
        aggregateDailyStats(message.days || 7).then(data => {
          sendResponse({ success: true, data });
        });
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
        lcp: state.lcp != null ? Math.round(state.lcp) : null,
        totalResources: resEntries.length,
        totalDuration: Math.round(totalDuration),
        replacedJs: state.stats.jsReplaced,
        replacedCss: state.stats.cssReplaced || 0,
        replacedFonts: state.stats.fontsReplaced,
        imagesCompressed: state.stats.imagesCompressed,
        bytesSaved: state.stats.imagesCompressBytesSaved,
        svgOptimized: state.stats.svgOptimized,
        svgBytesSaved: state.stats.svgBytesSaved,
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
      lcp: state.performance.lcp,
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

      // 计算 LCP 改善
      const lcpSaved = (baseline.lcp != null && current.lcp != null)
        ? baseline.lcp - current.lcp
        : null;
      const lcpPercent = (lcpSaved != null && baseline.lcp > 0)
        ? Math.round((lcpSaved / baseline.lcp) * 100)
        : null;

      return {
        baseline: {
          ttfb: baseline.ttfb,
          domContentLoaded: baseline.domContentLoaded,
          loadEvent: baseline.loadEvent,
          lcp: baseline.lcp,
          totalResources: baseline.totalResources,
          totalTransferSize: baseline.totalTransferSize
        },
        current: {
          ttfb: current.ttfb,
          domContentLoaded: current.domContentLoaded,
          loadEvent: current.loadEvent,
          lcp: current.lcp,
          totalResources: current.totalResources,
          totalTransferSize: current.totalTransferSize || 0
        },
        savings: {
          loadTimeSaved: Math.max(0, loadTimeSaved),
          loadTimePercent: Math.max(0, loadTimePercent),
          lcpSaved: lcpSaved != null ? Math.max(0, lcpSaved) : null,
          lcpPercent: lcpPercent != null ? Math.max(0, lcpPercent) : null,
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

  // ========== 每日统计与数据聚合 ==========

  const DAILY_STATS_KEY = 'resourceAcceleratorDailyStats';

  // 保存当日统计数据
  function saveDailyStats() {
    if (!state.performance) return;

    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const dailyData = {
      date: today,
      timestamp: Date.now(),
      replacedJs: state.stats.jsReplaced,
      replacedCss: state.stats.cssReplaced || 0,
      replacedFonts: state.stats.fontsReplaced,
      imagesCompressed: state.stats.imagesCompressed,
      bytesSaved: state.stats.imagesCompressBytesSaved,
      loadEvent: state.performance.loadEvent,
      totalResources: state.performance.totalResources,
      lcp: state.performance.lcp,
    };

    chrome.storage.local.get(DAILY_STATS_KEY).then(result => {
      const allDaily = result[DAILY_STATS_KEY] || {};
      allDaily[today] = dailyData;

      // 保留最近30天数据
      const keys = Object.keys(allDaily).sort().slice(-30);
      const trimmed = {};
      keys.forEach(k => { trimmed[k] = allDaily[k]; });

      chrome.storage.local.set({ [DAILY_STATS_KEY]: trimmed });
    });
  }

  // 聚合近 N 天统计数据
  async function aggregateDailyStats(days = 7) {
    try {
      const result = await chrome.storage.local.get(DAILY_STATS_KEY);
      const allDaily = result[DAILY_STATS_KEY] || {};

      const today = new Date();
      const stats = [];

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dayData = allDaily[dateStr];

        stats.push({
          date: dateStr,
          dayLabel: `${d.getMonth() + 1}/${d.getDate()}`,
          replacedJs: dayData?.replacedJs || 0,
          replacedCss: dayData?.replacedCss || 0,
          replacedFonts: dayData?.replacedFonts || 0,
          imagesCompressed: dayData?.imagesCompressed || 0,
          bytesSaved: dayData?.bytesSaved || 0,
          loadEvent: dayData?.loadEvent || 0,
          totalResources: dayData?.totalResources || 0,
          totalReplaced: (dayData?.replacedJs || 0) + (dayData?.replacedCss || 0) + (dayData?.replacedFonts || 0) + (dayData?.imagesCompressed || 0),
        });
      }

      return stats;
    } catch {
      return [];
    }
  }

  // 获取替换类型分布
  function getStatsDistribution() {
    return {
      js: state.stats.jsReplaced || 0,
      css: state.stats.cssReplaced || 0,
      fonts: state.stats.fontsReplaced || 0,
      images: state.stats.imagesCompressed || 0,
      svg: state.stats.svgOptimized || 0,
    };
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
    saveDailyStats,
    aggregateDailyStats,
    getStatsDistribution,
    getStats: () => ({
      ...state.stats,
      cspRestricted: state.cspRestricted,
      recentReplacements: state.recentReplacements.slice(-50),
      performance: state.performance,
      thirdPartyDeferralEnabled: state.config.thirdPartyDeferral?.enabled || false,
      svgOptimizeEnabled: state.config.svgOptimize?.enabled || false,
    }),
    getConfig: () => ({ ...state.config }),
    getLogs,
    clearLogs,
    addLog,
    getPriorityInfo: () => _priorityOptimizer?.getPriorityInfo(),
    getCacheStats: () => _memoryOptimizer?.getCacheStats(),
    destroy: () => {
      _observer.disconnect();
      _perfMonitor?.destroy();
      _priorityOptimizer?.destroy?.();
      _memoryOptimizer?.destroy?.();
      _adaptiveCompressor?.destroy();
      _smartPreloadV2?.destroy();
      _terminateCompressorWorkers();
      // 清理网络变化监听
      if (_networkChangeListener && navigator.connection) {
        navigator.connection.removeEventListener('change', _networkChangeListener);
      }
      state.compressQueue = [];
      state._compressCacheSize = 0;
      state.recentReplacements = [];
      state.dedupSet.clear();
      state._compressCache.clear();
      state._svgCache.clear();
      _logBuffer = [];
      document.createElement = _createElement;
      Element.prototype.appendChild = _appendChild;
      Element.prototype.insertBefore = _insertBefore;
      console.log(`${LOG_PREFIX} 已销毁`);
    }
  };

  // 立即初始化（同步）
  init();

})();
