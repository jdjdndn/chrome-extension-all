/**
 * ��Դ��������ģ�� (v8)
 * �����Ż���
 * 1. ͬ����� - ���ȴ����ü���
 * 2. API���� - ���� createElement/appendChild ��ԭ������
 * 3. ��ʱ���� - ��Ԫ�ش���ʱ�����أ����ǵȴ� DOM ����
 * 4. ͼƬѹ�� - Canvas�ػ浼��WebP/JPEG
 * 5. CDN����̽�� - ���ʱ̽��CDN������
 * 6. ���ܵ��� - ���ȼ����С���̬���������CDN̽�����ȼ�
 */

(function () {
  'use strict'

  const LOG_PREFIX = '[ResourceAccelerator]'
  const CONFIG_KEY = 'resourceAcceleratorConfig'
  const STATS_KEY = 'resourceAcceleratorStats'

  const DEFAULT_CONFIG = {
    version: '2.0.0', // ���ð汾�ţ�����Ǩ��
    enabled: true,
    jsReplace: true,
    fontReplace: true,
    cssReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8,
    imageMinSize: 102400, // 100KB
    imageMaxConcurrency: 3,
    lazyLoadThreshold: 200,
    excludeDomains: [],
    excludeUrls: [],
    // �����Ż�����
    maxPreloadHints: 10, // ���preload��ʾ��
    maxCompressQueueSize: 50, // �����г���
    mutationBatchInterval: 50, // mutation����������(ms)
    enableBatchProcessing: true, // ������������
    dedupEnabled: true, // ��Դȥ��
    imageMaxDimension: 2048, // �������ߴ磬0=������
    // ����ʽͼƬռλ
    lqip: {
      enabled: true,
      blurRadius: 8,
      transitionDuration: 300,
      placeholderColor: '#f0f0f0',
    },
    // content-visibility ��Ⱦ�Ż�
    contentVisibility: {
      enabled: true,
      selectors: ['article', 'section', 'aside', '.sidebar', '.footer', '.comments'],
      excludeSelectors: ['nav', 'header', '.above-fold'],
    },
    // ������iframe������
    iframeLazyLoad: {
      enabled: true,
      threshold: 200,
      excludePatterns: [],
    },
    // ȫվDNS prefetch
    dnsPrefetch: {
      enabled: true,
      maxDomains: 15,
    },
    // Workerѹ��
    workerCompress: {
      enabled: true, // ����Workerѹ��
      maxWorkers: 2, // ���Worker��
      timeout: 5000, // ��ʱʱ��(ms)
      fallbackToMain: true, // Workerʧ��ʱ�������߳�
    },
    // �������ű��ӳټ���
    thirdPartyDeferral: {
      enabled: true,
      strategy: 'idle', // idle | defer | block | pass
      rules: [
        { pattern: 'google-analytics.com', strategy: 'idle' },
        { pattern: 'googletagmanager.com', strategy: 'idle' },
        { pattern: 'baidu.com/hm.js', strategy: 'idle' },
        { pattern: 'cnzz.com', strategy: 'idle' },
        { pattern: 'umeng.com', strategy: 'idle' },
        { pattern: 'jsagent', strategy: 'defer' },
        { pattern: 'widget', strategy: 'defer' },
      ],
      userRules: [], // User-defined rules [{ pattern: string, strategy: string }]
      maxDeferralMs: 10000,
    },
    // վ�㼶����
    siteConfig: {
      enabled: true, // ȫ�ֿ���
      rules: [], // վ������б� [{ domain: string, enabled: boolean, ...featureFlags }]
    },
    // �߼����˹���
    advancedFilter: {
      enabled: false,
      rules: [], // [{ type: 'exclude'|'include', match: 'extension'|'path'|'domain'|'query'|'regex', value: string, action: 'skipAll'|'skipCompress'|'skipReplace'|'forceReplace', description: string }]
    },
    // SVG �Ż�
    svgOptimize: {
      enabled: true,
      maxInlineSize: 10240, // 10KB ��������Ϊ data URI
      removeComments: true,
      removeMetadata: true,
      minify: true,
    },
    // ����Ӧѹ��
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
    // ����Ԥ���� v2
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
        maxPreloads: 6, // ���������preloadԪ����
      },
    },
    // ���ܼ��
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
    // ���ȼ��Ż�
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
    // �ڴ��Ż�
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
        maxSize: 50 * 1024 * 1024, // 50MB
        ttl: 7 * 24 * 60 * 60 * 1000, // 7��
        evictionPolicy: 'lru', // lru | lfu | fifo
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
    // λ�ø�֪����
    positionAwareLoading: {
      enabled: true,
      nearbyThreshold: 1, // �������صľ�����ֵ����������Ĭ��1��
      processLoaded: false, // �Ѽ�����Դ�Ƿ����´���
    },
  }

  // ========== ��־ϵͳ ==========
  const MAX_LOG_SIZE = 200
  const LOG_ERROR_PERSIST_KEY = 'resourceAcceleratorErrorLogs'
  const MAX_PERSISTED_ERROR_LOGS = 50
  let _logBuffer = []
  let _logPersistTimer = null

  /**
   * �����־��¼
   * @param {'info'|'warn'|'error'} level - ��־����
   * @param {'script'|'style'|'image'|'svg'|'cdn'|'deferral'|'system'} module - ģ��
   * @param {'replace'|'compress'|'lazy'|'defer'|'skip'|'block'|'error'|'init'|'probe'} action - ����
   * @param {object} details - ����
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
        ...details,
      },
    }

    _logBuffer.push(logEntry)

    // ���ֻ��λ�������С
    if (_logBuffer.length > MAX_LOG_SIZE) {
      _logBuffer.shift()
    }

    // error ������־�־û��� storage
    if (level === 'error') {
      _scheduleErrorLogPersist()
    }
  }

  /**
   * ���ȴ�����־�־û���������
   */
  function _scheduleErrorLogPersist() {
    if (_logPersistTimer) {return}
    _logPersistTimer = setTimeout(async () => {
      _logPersistTimer = null
      try {
        const errorLogs = _logBuffer
          .filter((l) => l.level === 'error')
          .slice(-MAX_PERSISTED_ERROR_LOGS)
        await chrome.storage.local.set({ [LOG_ERROR_PERSIST_KEY]: errorLogs })
      } catch (e) {
        console.error(`${LOG_PREFIX} �־û�������־ʧ��:`, e)
      }
    }, 1000)
  }

  /**
   * �� storage �ָ�������־
   */
  async function _restoreErrorLogs() {
    try {
      const result = await chrome.storage.local.get(LOG_ERROR_PERSIST_KEY)
      const storedLogs = result[LOG_ERROR_PERSIST_KEY]
      if (Array.isArray(storedLogs) && storedLogs.length > 0) {
        // ����ʷ������־��ӵ���������ͷ��ȷ�����µ���־�ں���
        const historicalLogs = storedLogs.filter(
          (l) => l.timestamp && l.level === 'error' && l.module && l.action
        )
        _logBuffer = [...historicalLogs, ..._logBuffer].slice(-MAX_LOG_SIZE)
        console.log(`${LOG_PREFIX} �ѻָ� ${historicalLogs.length} ����ʷ������־`)
      }
    } catch (e) {
      console.error(`${LOG_PREFIX} �ָ���ʷ������־ʧ��:`, e)
    }
  }

  /**
   * ��ȡ��־������
   */
  function getLogs(filter = {}) {
    let logs = [..._logBuffer]

    // ������ɸѡ
    if (filter.level && filter.level !== 'all') {
      logs = logs.filter((l) => l.level === filter.level)
    }

    // ��ģ��ɸѡ
    if (filter.module && filter.module !== 'all') {
      logs = logs.filter((l) => l.module === filter.module)
    }

    // ��ʱ�䷶Χɸѡ
    if (filter.since) {
      logs = logs.filter((l) => l.timestamp >= filter.since)
    }

    return logs
  }

  /**
   * �����־������
   */
  function clearLogs() {
    _logBuffer = []
  }

  // ========== ȫ��״̬��ͬ����ʼ����==========
  const state = {
    config: { ...DEFAULT_CONFIG },
    cspRestricted: false,
    initialized: false,
    stats: {
      jsReplaced: 0,
      jsErrors: 0,
      fontsReplaced: 0,
      fontErrors: 0,
      cssReplaced: 0,
      cssErrors: 0,
      imagesLazy: 0,
      imagesCompressed: 0,
      imagesCompressBytesSaved: 0,
      svgOptimized: 0,
      svgInlined: 0,
      svgBytesSaved: 0,
      videosLazy: 0,
      preloadHints: 0,
      cdnLoadMs: 0,
      cdnLoadCount: 0,
      thirdPartyDeferred: 0,
      thirdPartyBlocked: 0,
      workerCompressSuccess: 0,
      workerCompressFallback: 0,
      workerCompressTotalMs: 0,
    },
    // ͼƬѹ��
    compressQueue: [],
    compressingCount: 0,
    _supportsWebP: undefined,
    _imageFormat: null,
    // ��������
    _mutationBatch: [],
    _mutationTimer: null,
    _isProcessingBatch: false,
    // ѹ��������棨ͬһҳ��Ự�ڱ����ظ�ѹ����
    _compressCache: new Map(),
    _compressCacheSize: 0, // �����С׷�٣��ֽڣ�
    _compressCacheMaxSize: 50 * 1024 * 1024, // ���50MB
    // SVG �Ż�����
    _svgCache: new Map(),
    // ȥ�ؼ���
    dedupSet: new Set(),
    // ���50���滻��¼
    recentReplacements: [],
    // �������ű��ӳٶ���
    _deferredScripts: [],
    // ����Ԥ���غ�ѡ���У�weight-based priority��
    _fontCandidates: [],
    _fontPreloadedUrls: new Set(),
    // LCP ָ��
    lcp: null,
    // ����ָ��
    performance: null,
    // ҳ����ת״̬
    _isNavigating: false,
    // ��������� throttle
    _recheckThrottleTimer: null,
    // ��ʽ�仯�۲���
    _styleChangeObserver: null,
    // ͼƬ���Լ�����
    _imageRetryCount: new Map(),
  }

  // ͼƬ��������
  const IMAGE_RETRY_MAX = 3
  const IMAGE_RETRY_DELAY_MS = 500

  // ========== ͳ�Ƴ־û������� + ������==========

  let _statsTimer = null
  const _lastPersisted = {
    jsReplaced: 0,
    fontsReplaced: 0,
    cssReplaced: 0,
    imagesLazy: 0,
    imagesCompressed: 0,
    imagesCompressBytesSaved: 0,
    svgOptimized: 0,
    svgBytesSaved: 0,
  }

  function _persistStats() {
    if (_statsTimer) {return}
    _statsTimer = setTimeout(async () => {
      _statsTimer = null
      try {
        const result = await chrome.storage.local.get(STATS_KEY)
        const stored = result[STATS_KEY] || {}
        // ֻд�����ϴγ־û�����������
        const delta = {
          totalJsReplaced:
            (stored.totalJsReplaced || 0) + (state.stats.jsReplaced - _lastPersisted.jsReplaced),
          totalFontsReplaced:
            (stored.totalFontsReplaced || 0) +
            (state.stats.fontsReplaced - _lastPersisted.fontsReplaced),
          totalCssReplaced:
            (stored.totalCssReplaced || 0) +
            ((state.stats.cssReplaced || 0) - _lastPersisted.cssReplaced),
          totalImagesOptimized:
            (stored.totalImagesOptimized || 0) +
            (state.stats.imagesLazy - _lastPersisted.imagesLazy),
          totalImagesCompressed:
            (stored.totalImagesCompressed || 0) +
            (state.stats.imagesCompressed - _lastPersisted.imagesCompressed),
          totalBytesSaved:
            (stored.totalBytesSaved || 0) +
            (state.stats.imagesCompressBytesSaved - _lastPersisted.imagesCompressBytesSaved) +
            (state.stats.svgBytesSaved - _lastPersisted.svgBytesSaved),
          totalSvgOptimized:
            (stored.totalSvgOptimized || 0) +
            (state.stats.svgOptimized - _lastPersisted.svgOptimized),
        }
        await chrome.storage.local.set({ [STATS_KEY]: delta })
        // ���¿���
        _lastPersisted.jsReplaced = state.stats.jsReplaced
        _lastPersisted.fontsReplaced = state.stats.fontsReplaced
        _lastPersisted.cssReplaced = state.stats.cssReplaced || 0
        _lastPersisted.imagesLazy = state.stats.imagesLazy
        _lastPersisted.imagesCompressed = state.stats.imagesCompressed
        _lastPersisted.imagesCompressBytesSaved = state.stats.imagesCompressBytesSaved
        _lastPersisted.svgOptimized = state.stats.svgOptimized
        _lastPersisted.svgBytesSaved = state.stats.svgBytesSaved
      } catch (error) {
        console.warn('[persistStats] �־û�ͳ��ʧ��:', error)
      }
    }, 2000)
  }

  // ========== 压缩缓存内存管理 ==========
  function _addToCompressCache(url, result) {
    const size = result ? result.length * 2 : 0 // dataUrl大小估算（UTF-16编码）

    // 加权LRU淘汰策略
    while (
      state._compressCacheSize + size > state._compressCacheMaxSize &&
      state._compressCache.size > 0
    ) {
      // 计算每个缓存项的权重分数（越低越应该淘汰）
      // 权重 = 访问频率 * 0.6 + 新近度 * 0.4
      const now = Date.now()
      let minScore = Infinity
      let evictKey = null
      let evictSize = 0

      for (const [key, entry] of state._compressCache.entries()) {
        if (!entry || entry.skip) {continue}

        const accessCount = entry.accessCount || 1
        const age = now - (entry.lastAccess || entry.timestamp || now)
        const ageScore = Math.max(0, 1 - age / 3600000) // 1小时内归一化
        const freqScore = Math.min(1, accessCount / 10) // 10次访问归一化

        // 加权分数：访问频率权重0.6，新近度权重0.4
        const score = freqScore * 0.6 + ageScore * 0.4

        // 大文件额外惩罚
        const entrySize = entry.result?.length * 2 || 0
        const sizePenalty = entrySize > 500000 ? 0.3 : 0

        if (score - sizePenalty < minScore) {
          minScore = score - sizePenalty
          evictKey = key
          evictSize = entrySize
        }
      }

      // 如果没找到合适的，使用FIFO作为后备
      if (!evictKey) {
        evictKey = state._compressCache.keys().next().value
        const oldEntry = state._compressCache.get(evictKey)
        evictSize = oldEntry?.result?.length * 2 || 0
      }

      state._compressCache.delete(evictKey)
      state._compressCacheSize -= evictSize
      state.stats.cacheEvictions = (state.stats.cacheEvictions || 0) + 1
      addLog('debug', 'cache', 'evict', { key: evictKey, size: evictSize, score: minScore })
    }

    // 添加新缓存项，包含访问统计
    state._compressCache.set(url, {
      skip: false,
      result,
      timestamp: Date.now(),
      lastAccess: Date.now(),
      accessCount: 1,
    })
    state._compressCacheSize += size
  }

  // ========== ����仯��̬���� ==========
  let _networkChangeListener = null

  function _initNetworkChangeListener() {
    if (!navigator.connection) {return}

    _networkChangeListener = () => {
      const oldQuality = state._lastNetworkQuality
      const newQuality = detectNetworkQuality()

      if (oldQuality !== newQuality) {
        console.log(`${LOG_PREFIX} ���������仯: ${oldQuality} -> ${newQuality}`)
        state._lastNetworkQuality = newQuality

        // ֪ͨAdaptiveCompressor����
        if (_adaptiveCompressor) {
          _adaptiveCompressor.networkQuality = newQuality
        }
      }
    }

    navigator.connection.addEventListener('change', _networkChangeListener)
  }

  // ========== ���߷�����ͬ����==========

  /**
   * ����������������������
   * @returns {'fast'|'medium'|'slow'}
   */
  function detectNetworkQuality() {
    if (!navigator.connection) {return state._lastNetworkQuality || 'medium'}

    const effectiveType = navigator.connection.effectiveType
    const downlink = navigator.connection.downlink

    let quality = 'medium'
    if (effectiveType === '4g' && downlink > 10) {
      quality = 'fast'
    } else if (effectiveType === '4g' || effectiveType === '3g') {
      quality = 'medium'
    } else {
      quality = 'slow'
    }

    // ����ȫ��״̬
    state._lastNetworkQuality = quality
    return quality
  }

  // �豸���ܻ���
  let _cachedDeviceTier = null

  /**
   * ����豸���ܵȼ�
   * @returns {'high'|'medium'|'low'}
   */
  function detectDeviceTier() {
    if (_cachedDeviceTier) {return _cachedDeviceTier}

    let tier = 'medium'
    // ����ʹ�� deviceMemory API
    if (navigator.deviceMemory) {
      if (navigator.deviceMemory >= 8) {tier = 'high'}
      else if (navigator.deviceMemory >= 4) {tier = 'medium'}
      else {tier = 'low'}
    } else if (navigator.hardwareConcurrency) {
      // ���ˣ�����Ӳ���������ж�
      if (navigator.hardwareConcurrency >= 8) {tier = 'high'}
      else if (navigator.hardwareConcurrency >= 4) {tier = 'medium'}
      else {tier = 'low'}
    }

    _cachedDeviceTier = tier
    return tier
  }

  /**
   * ��ǿ�Ŀ��������
   * @param {Element} element - Ҫ����Ԫ��
   * @param {Object} options - ����ѡ��
   * @returns {{inViewport: boolean, aboveFold: boolean, visible: boolean, priority: 'high'|'auto'|'low'}}
   */
  function detectViewportState(element, options = {}) {
    const {
      topThreshold = 0.5, // ���������������
      bottomBuffer = 100, // �ײ�������
      minVisibleArea = 0.1, // ��С�ɼ��������
    } = options

    // ������飺Ԫ���Ƿ����
    if (!element || !element.isConnected) {
      return { inViewport: false, aboveFold: false, visible: false, priority: 'low' }
    }

    // ���Ԫ�ؿɼ���
    const style = window.getComputedStyle(element)
    const isVisible =
      style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0

    if (!isVisible) {
      return { inViewport: false, aboveFold: false, visible: false, priority: 'low' }
    }

    // ��ȡԪ�ر߽�
    const rect = element.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // ���Ԫ�سߴ�
    const elementArea = rect.width * rect.height
    if (elementArea < 10) {
      // С��10���ص�Ԫ��
      return { inViewport: false, aboveFold: false, visible: true, priority: 'low' }
    }

    // ����Ƿ��ڿ������ڣ�����ˮƽ�ʹ�ֱ��
    const inViewportX = rect.right > 0 && rect.left < viewportWidth
    const inViewportY = rect.bottom > 0 && rect.top < viewportHeight + bottomBuffer
    const inViewport = inViewportX && inViewportY

    if (!inViewport) {
      return { inViewport: false, aboveFold: false, visible: true, priority: 'low' }
    }

    // ����ɼ��������
    const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0)
    const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0)
    const visibleArea = visibleWidth * visibleHeight
    const visibleRatio = visibleArea / elementArea

    // �ɼ����̫С
    if (visibleRatio < minVisibleArea) {
      return { inViewport: true, aboveFold: false, visible: true, priority: 'low' }
    }

    // ����Ƿ�����������
    const aboveFold = rect.top < viewportHeight * topThreshold

    // ȷ�����ȼ�
    let priority = 'auto'
    if (aboveFold && rect.top < viewportHeight * 0.3) {
      // ����ǰ30%���򣬸����ȼ�
      priority = 'high'
    } else if (rect.top > viewportHeight) {
      // ��ȫ�ڿ������·�
      priority = 'low'
    }

    return { inViewport, aboveFold, visible: true, priority, visibleRatio }
  }

  function isExcluded(url) {
    if (!url || typeof url !== 'string') {return true}
    if (/^chrome-extension:|^moz-extension:|^about:|^data:|^javascript:/i.test(url)) {return true}
    return (state.config.excludeUrls || []).some((pattern) => {
      try {
        return new RegExp(pattern.replace(/\*/g, '.*'), 'i').test(url)
      } catch {
        return false
      }
    })
  }

  function isCDNUrl(url) {
    if (!window.CDNMappings?.CDN_SOURCES) {return false}
    return window.CDNMappings.CDN_SOURCES.some((cdn) => {
      try {
        return url.includes(new URL(cdn.baseUrl).hostname)
      } catch {
        return false
      }
    })
  }

  function getBaseDomain(hostname) {
    const parts = hostname.split('.')
    return parts.slice(-2).join('.')
  }

  function isThirdPartyScript(url) {
    try {
      const urlObj = new URL(url)
      const pageBase = getBaseDomain(location.hostname)
      const scriptBase = getBaseDomain(urlObj.hostname)
      if (pageBase === scriptBase) {return false}
      if (isCDNUrl(url)) {return false}
      return true
    } catch {
      return false
    }
  }

  // ========== վ�㼶���� ==========

  function getSiteConfig(hostname) {
    const rules = state.config.siteConfig?.rules || []

    // ��ȷƥ������
    const exact = rules.find((r) => r.domain === hostname)
    if (exact) {return exact}

    // ͨ���ƥ�� (*.domain.com)
    const wildcard = rules.find((r) => {
      if (!r.domain.startsWith('*')) {return false}
      const suffix = r.domain.slice(1)
      return hostname.endsWith(suffix)
    })

    return wildcard || null
  }

  function isSiteEnabled(feature) {
    const site = getSiteConfig(location.hostname)

    // վ�㼶����ȫ����
    if (site && site.enabled === false) {return false}

    // վ�㼶���ܿ���
    if (site && feature in site) {return site[feature]}

    // ���˵�ȫ������
    return state.config[feature]
  }

  // ========== �߼����˹��� ==========

  function matchAdvancedFilter(url, context = {}) {
    const filter = state.config.advancedFilter
    if (!filter?.enabled || !filter.rules?.length) {
      return { matched: false, action: null }
    }

    let urlObj
    try {
      urlObj = new URL(url, location.href)
    } catch {
      return { matched: false, action: null }
    }

    for (const rule of filter.rules) {
      let matches = false

      switch (rule.match) {
        case 'extension': {
          const ext = urlObj.pathname.split('.').pop()?.toLowerCase()
          matches = ext === rule.value.toLowerCase()
          break
        }
        case 'path': {
          matches = urlObj.pathname.includes(rule.value)
          break
        }
        case 'domain': {
          matches = urlObj.hostname === rule.value || urlObj.hostname.endsWith('.' + rule.value)
          break
        }
        case 'query': {
          matches = urlObj.search.includes(rule.value)
          break
        }
        case 'regex': {
          try {
            matches = new RegExp(rule.value, 'i').test(url)
          } catch {
            matches = false
          }
          break
        }
      }

      if (matches) {
        // ��� type �Ƿ�ƥ��
        if (rule.type === 'include' && !context.isInclude) {continue}
        if (rule.type === 'exclude' && context.isInclude) {continue}

        return { matched: true, action: rule.action, rule }
      }
    }

    return { matched: false, action: null }
  }

  // ========== ��׼ͼƬѹ�� ==========

  const _headSizeCache = new Map() // URL -> { size: number, timestamp: number }
  const HEAD_CACHE_TTL = 30000 // 30�뻺��
  let _headRequestCount = 0
  const MAX_HEAD_CONCURRENT = 5

  async function getImageActualSize(url) {
    // ��黺��
    const cached = _headSizeCache.get(url)
    if (cached && Date.now() - cached.timestamp < HEAD_CACHE_TTL) {
      return cached.size
    }

    // ��������
    if (_headRequestCount >= MAX_HEAD_CONCURRENT) {
      return null
    }

    _headRequestCount++
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3�볬ʱ

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const contentLength = response.headers.get('content-length')
      if (contentLength) {
        const size = parseInt(contentLength, 10)
        _headSizeCache.set(url, { size, timestamp: Date.now() })
        return size
      }
    } catch {
      // CORS ���ƻ��������󣬽���������
    } finally {
      _headRequestCount--
    }

    return null
  }

  function supportsWebP() {
    if (state._supportsWebP !== undefined) {return state._supportsWebP}
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1
      canvas.height = 1
      state._supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp')
    } catch {
      state._supportsWebP = false
    }
    return state._supportsWebP
  }

  const IMAGE_FORMAT_PRIORITY = [
    { mime: 'image/avif', test: 'image/avif' },
    { mime: 'image/webp', test: 'image/webp' },
    { mime: 'image/jpeg', test: null },
  ]

  function getSupportedImageFormat() {
    if (state._imageFormat) {return state._imageFormat}
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    for (const fmt of IMAGE_FORMAT_PRIORITY) {
      try {
        if (!fmt.test) {
          state._imageFormat = fmt
          return fmt
        }
        if (canvas.toDataURL(fmt.mime).startsWith(`data:${fmt.mime}`)) {
          state._imageFormat = fmt
          return fmt
        }
      } catch (error) {
        console.warn('[detectImageFormat] ���ͼƬ��ʽʧ��:', error)
      }
    }
    state._imageFormat = IMAGE_FORMAT_PRIORITY[2]
    return state._imageFormat
  }

  function getWeightPriority(weight) {
    if (!weight || weight === 'unknown') {return 99}
    const w = parseInt(weight)
    if (w === 400 || weight === 'normal') {return 0}
    if (w === 700 || weight === 'bold') {return 1}
    return 2
  }

  function parseFontWeight(url) {
    const queryMatch = url.match(/wght[@=](\d+)/i)
    if (queryMatch) {return queryMatch[1]}
    const nameMatch = url.match(/-(Regular|Bold|Light|Medium|SemiBold|ExtraBold|Thin|Black)/i)
    if (nameMatch) {
      const map = {
        regular: '400',
        bold: '700',
        light: '300',
        medium: '500',
        semibold: '600',
        extrabold: '800',
        thin: '100',
        black: '900',
      }
      return map[nameMatch[1].toLowerCase()] || 'unknown'
    }
    return null
  }

  // ========== �������ű��ӳټ��� ==========

  function matchDeferralRule(url) {
    const deferral = state.config.thirdPartyDeferral
    if (!deferral?.enabled) {return null}

    // 1. User-defined rules (regex match, highest priority)
    for (const rule of deferral.userRules || []) {
      try {
        if (new RegExp(rule.pattern, 'i').test(url)) {
          return { pattern: rule.pattern, strategy: rule.strategy, name: rule.pattern }
        }
      } catch (error) {
        console.warn('[getThirdPartyDeferral] ������ʽƥ��ʧ��:', error)
      }
    }

    // 2. Built-in rules (string includes match)
    const { strategy, rules } = deferral
    for (const rule of rules) {
      if (url.includes(rule.pattern)) {
        return { pattern: rule.pattern, strategy: rule.strategy || strategy, name: rule.pattern }
      }
    }

    // 3. Auto-detection: non-CDN, cross-domain
    if (isThirdPartyScript(url)) {
      return { pattern: '*', strategy: strategy || 'idle', name: 'auto-detected' }
    }

    return null
  }

  function deferScript(script, strategy) {
    if (state.cspRestricted) {return}

    const src = script.src
    script.removeAttribute('src')
    script.dataset._deferredSrc = src
    script.dataset._deferralStrategy = strategy
    script.dataset._raDeferralTime = Date.now()

    const loadFn = () => {
      if (script.dataset._raLoaded) {return}
      script.src = script.dataset._deferredSrc
      script.dataset._raLoaded = 'true'
      console.log(`${LOG_PREFIX} �������ű��ӳټ������: ${src.substring(0, 60)}...`)
    }

    const maxMs = state.config.thirdPartyDeferral.maxDeferralMs

    // ����ӳ�ʱ�䶵��
    const forceLoadTimer = setTimeout(() => {
      if (!script.dataset._raLoaded) {
        console.log(`${LOG_PREFIX} �������ű���������ӳ٣�ǿ�Ƽ���: ${src.substring(0, 60)}...`)
        loadFn()
      }
    }, maxMs)

    // ���سɹ��������ʱ��
    const origOnload = script.onload
    script.onload = () => {
      clearTimeout(forceLoadTimer)
      if (origOnload) {origOnload.call(script)}
    }

    switch (strategy) {
      case 'idle':
        if ('requestIdleCallback' in window) {
          requestIdleCallback(loadFn, { timeout: maxMs })
        } else {
          setTimeout(loadFn, 100)
        }
        break
      case 'defer':
        if (document.readyState === 'complete') {
          setTimeout(loadFn, 3000)
        } else {
          window.addEventListener('load', () => setTimeout(loadFn, 3000), { once: true })
        }
        break
      case 'block':
        clearTimeout(forceLoadTimer)
        state.stats.thirdPartyBlocked++
        console.log(`${LOG_PREFIX} �������ű�����ֹ: ${src.substring(0, 60)}...`)
        break
    }
  }

  // ========== �������أ��ű����� ==========

  async function processScript(script) {
    if (state.cspRestricted) {return}
    if (!isSiteEnabled('jsReplace')) {return}
    const url = script.src
    if (!url || script.dataset._raProcessed) {return}

    script.dataset._raProcessed = '1'

    if (isExcluded(url) || isCDNUrl(url)) {
      addLog('info', 'script', 'skip', { url, reason: isExcluded(url) ? 'excluded' : 'cdn_url' })
      return
    }

    // �߼����˼��
    const filterResult = matchAdvancedFilter(url)
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'script', 'skip', { url, reason: 'filter_rule' })
        return
      }
    }

    // ȥ�ؼ�飺ͬһԭʼURL���ظ��滻
    if (state.config.dedupEnabled && state.dedupSet.has(url)) {
      addLog('info', 'script', 'skip', { url, reason: 'deduplicated' })
      return
    }

    const startTime = performance.now()

    // ʹ���첽ƥ�䣨֧�� jsDelivr API ��̬��ѯ��
    const match = await window.CDNMappings?.matchJSLibraryAsync?.(url)

    // CDN �޷��滻 �� ���Ե������ӳ�
    if (!match) {
      if (state.config.thirdPartyDeferral?.enabled && state.config.jsReplace) {
        const deferralRule = matchDeferralRule(url)
        if (deferralRule) {
          deferScript(script, deferralRule.strategy)
          state.stats.thirdPartyDeferred++
          state.recentReplacements.push({
            type: 'thirdParty',
            name: deferralRule.pattern,
            original: url,
            strategy: deferralRule.strategy,
            timestamp: Date.now(),
          })
          if (state.recentReplacements.length > 50) {state.recentReplacements.shift()}
          _persistStats()
          addLog('info', 'deferral', 'defer', {
            url,
            reason: deferralRule.pattern,
            strategy: deferralRule.strategy,
            duration: Math.round(performance.now() - startTime),
          })
          return
        }
      }
      addLog('info', 'script', 'skip', { url, reason: 'no_cdn_match' })
      return
    }

    const originalSrc = script.src
    script.dataset._originalSrc = originalSrc

    // Preload
    addPreloadHint(match.cdnUrl, 'js')

    const fallbacks = (match.fallbackUrls || []).map((f) => f.url)
    script.src = match.cdnUrl

    script.onerror = () => {
      if (fallbacks.length > 0) {
        script.src = fallbacks.shift()
      } else {
        script.src = originalSrc
        state.stats.jsErrors++
        addLog('error', 'script', 'error', {
          url: originalSrc,
          cdn: match.cdnUrl,
          reason: 'all_fallbacks_failed',
        })
      }
    }

    state.stats.jsReplaced++
    state.recentReplacements.push({
      type: 'js',
      name: match.name,
      original: originalSrc,
      cdn: match.cdnUrl,
      timestamp: Date.now(),
      isAutoDetected: match.isAutoDetected,
      isDynamic: match.isDynamic,
    })
    if (state.recentReplacements.length > 50) {
      state.recentReplacements.shift()
    }
    _persistStats()
    if (state.config.dedupEnabled) {state.dedupSet.add(originalSrc)}

    addLog('info', 'script', 'replace', {
      url: originalSrc,
      original: originalSrc,
      cdn: match.cdnUrl,
      reason: match.name,
      duration: Math.round(performance.now() - startTime),
    })

    // Apply priority optimization
    if (_priorityOptimizer) {
      _priorityOptimizer.applyPriorityToResource(script, url, 'script')
    }

    console.log(
      `${LOG_PREFIX} JS: ${match.name} �� ${match.cdnName}${match.isDynamic ? ' (dynamic)' : ''}`
    )
  }

  // ========== �������أ���ʽ/���崦�� ==========

  function processLink(link) {
    if (state.cspRestricted) {return}
    if (!isSiteEnabled('fontReplace') && !isSiteEnabled('cssReplace')) {return}
    const url = link.href
    if (!url || link.dataset._raProcessed) {return}

    link.dataset._raProcessed = '1'

    if (isExcluded(url) || isCDNUrl(url)) {
      addLog('info', 'style', 'skip', { url, reason: isExcluded(url) ? 'excluded' : 'cdn_url' })
      return
    }

    // �߼����˼��
    const filterResult = matchAdvancedFilter(url)
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'style', 'skip', { url, reason: 'filter_rule' })
        return
      }
    }

    // ȥ�ؼ�飺ͬһԭʼURL���ظ��滻
    if (state.config.dedupEnabled && state.dedupSet.has(url)) {
      addLog('info', 'style', 'skip', { url, reason: 'deduplicated' })
      return
    }

    const startTime = performance.now()

    // �ȳ�������ƥ�䣬�ٳ���CSSƥ��
    const fontMatch = window.CDNMappings?.matchFont(url)
    const cssMatch = !fontMatch ? window.CDNMappings?.matchCSS(url) : null

    // �����ԵĿ���
    if (fontMatch && !state.config.fontReplace) {
      addLog('info', 'style', 'skip', { url, reason: 'font_replace_disabled' })
      return
    }
    if (cssMatch && !state.config.cssReplace) {
      addLog('info', 'style', 'skip', { url, reason: 'css_replace_disabled' })
      return
    }

    const match = fontMatch || cssMatch
    if (!match) {
      addLog('info', 'style', 'skip', { url, reason: 'no_cdn_match' })
      return
    }

    const originalHref = link.href
    link.dataset._originalHref = originalHref

    if (fontMatch) {
      addPreloadHint(match.cdnUrl, 'font', { weight: parseFontWeight(originalHref) })
    } else {
      addPreloadHint(match.cdnUrl, 'css')
    }

    const fallbacks = (match.fallbackUrls || []).map((f) => f.url)
    link.href = match.cdnUrl

    link.onerror = () => {
      if (fallbacks.length > 0) {
        link.href = fallbacks.shift()
      } else {
        link.href = originalHref
        if (fontMatch) {
          state.stats.fontErrors++
        } else {
          state.stats.cssErrors = (state.stats.cssErrors || 0) + 1
        }
        addLog('error', 'style', 'error', {
          url: originalHref,
          cdn: match.cdnUrl,
          reason: 'all_fallbacks_failed',
        })
      }
    }

    if (fontMatch) {
      state.stats.fontsReplaced++
    } else {
      state.stats.cssReplaced = (state.stats.cssReplaced || 0) + 1
    }
    state.recentReplacements.push({
      type: fontMatch ? 'font' : 'css',
      name: match.name,
      original: originalHref,
      cdn: match.cdnUrl,
      timestamp: Date.now(),
    })
    if (state.recentReplacements.length > 50) {
      state.recentReplacements.shift()
    }
    _persistStats()
    if (state.config.dedupEnabled) {state.dedupSet.add(originalHref)}

    addLog('info', fontMatch ? 'style' : 'style', 'replace', {
      url: originalHref,
      original: originalHref,
      cdn: match.cdnUrl,
      reason: `${fontMatch ? 'font' : 'css'}: ${match.name}`,
      duration: Math.round(performance.now() - startTime),
    })

    // Apply priority optimization
    if (_priorityOptimizer) {
      _priorityOptimizer.applyPriorityToResource(link, url, 'style')
    }

    console.log(`${LOG_PREFIX} ${fontMatch ? 'Font' : 'CSS'}: ${match.name} �� ${match.cdnName}`)
  }

  // ========== �������أ�ͼƬ������ ==========

  function processImage(img) {
    // SVG �Ż�����ͼƬ�����ض��������ȴ���
    if (img.src && !img.dataset._raSvgProcessed && !img.dataset._raProcessed) {
      if (/\.svg(\?|#|$)/i.test(img.src) || /\/svg\+xml/i.test(img.src)) {
        if (isSiteEnabled('svgOptimize') && !state.cspRestricted) {
          processSVG(img)
          return
        }
      }
    }

    if (!isSiteEnabled('imageLazyLoad')) {return}
    if (img.dataset._raProcessed || !img.src || img.dataset.src || img.src.startsWith('data:'))
      {return}
    if (img.loading === 'eager' || img.hasAttribute('data-no-lazy')) {return}
    if (img.complete && img.naturalWidth > 0) {return}

    // �߼����˼��
    const filterResult = matchAdvancedFilter(img.src)
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'image', 'skip', { url: img.src, reason: 'filter_rule' })
        return
      }
    }

    img.dataset._raProcessed = '1'

    // λ�ø�֪���أ����ͼƬλ��
    const positionState = _getResourcePositionPriority(img)

    // far ��������ӳټ��ع۲죬����������
    if (positionState.zone === 'far') {
      if (img.src && !img.dataset.lazySrc) {
        img.dataset.lazySrc = img.src
        // ʹ��͸��ռλͼ���ֲ���
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
      }
      if ('fetchPriority' in img) {img.fetchPriority = 'low'}
      img.loading = 'lazy'
      img.dataset._raLazyLoad = '1'
      _observeLazyLoad(img)
      addLog('info', 'image', 'far_delayed', {
        url: img.dataset.lazySrc,
        distance: Math.round(positionState.distance),
        zone: positionState.zone,
      })
      return
    }

    // ��ǿ�Ŀ��������
    const viewportState = detectViewportState(img, {
      topThreshold: 0.5,
      bottomBuffer: 100,
      minVisibleArea: 0.1,
    })

    // ������ͼƬ���������أ����ӳ�
    if (viewportState.inViewport && viewportState.visible) {
      img.loading = 'eager'
      if ('fetchPriority' in img) {img.fetchPriority = viewportState.priority}

      if (_priorityOptimizer) {
        _priorityOptimizer.applyPriorityToResource(img, img.src, 'image')
      }

      // ������ͼƬ����̨ѹ����ǰ̨������ʾԭͼ
      if (state.config.imageCompress) {
        img.dataset.src = img.src
        addLog('info', 'image', 'viewport', {
          url: img.src,
          reason: 'viewport_immediate',
          priority: viewportState.priority,
          visibleRatio: viewportState.visibleRatio?.toFixed(2),
        })

        // ��̨ѹ���������ȼ���
        if (state.compressQueue.length < 3) {
          compressImage(img.src).then((compressed) => {
            if (compressed && !state._isNavigating) {
              img.src = compressed
              img.dataset.compressed = 'true'
            }
          })
        }
      }
      return
    }

    // �ǿ������򲻿ɼ�ͼƬ�������ش���
    img.loading = 'lazy'
    if ('fetchPriority' in img) {img.fetchPriority = 'low'}
    img.dataset._raLazyLoad = '1'

    if (_priorityOptimizer) {
      _priorityOptimizer.applyPriorityToResource(img, img.src, 'image')
    }

    const originalSrc = img.src
    img.dataset.src = originalSrc

    // LQIP�����ý���ʽռλ
    if (state.config.lqip?.enabled) {
      img.dataset.lqip = '1'
      img.style.backgroundColor = state.config.lqip.placeholderColor || '#f0f0f0'
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
    }

    // ͼƬѹ����Ԥѹ����ֱ�Ӽ���
    if (state.config.imageCompress) {
      enqueueCompress(img, originalSrc)
    } else {
      // ��ѹ��·������� LQIP ���ã��������ɣ������������
      if (state.config.lqip?.enabled) {
        _triggerLqipTransition(img)
      } else {
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
        img.dataset.lazyLoading = 'true'
      }
      state.stats.imagesLazy++
      _persistStats()
      addLog('info', 'image', 'lazy', {
        url: originalSrc,
        reason: state.config.lqip?.enabled ? 'lqip_lazy' : 'lazy_load_only',
      })
    }
  }

  // ========== ������iframe������ ==========
  function processIframeLazyLoad() {
    if (!isSiteEnabled('iframeLazyLoad')) {return}
    const config = state.config.iframeLazyLoad

    const iframes = document.querySelectorAll('iframe[src]')
    iframes.forEach((iframe) => {
      try {
        const url = new URL(iframe.src, location.href)
        if (url.hostname === location.hostname) {return}
        if (config.excludePatterns?.some((p) => url.hostname.includes(p))) {return}
        if (iframe.dataset._raIframeProcessed) {return}
        if (_isResourceLoaded(iframe, 'iframe')) {return}

        iframe.dataset._raIframeProcessed = '1'

        // ʹ��λ�����ȼ��ж�
        const { zone } = _getResourcePositionPriority(iframe)

        if (zone === 'inViewport') {
          // �ӿ��ڣ���������
          if ('fetchPriority' in iframe) {iframe.fetchPriority = 'high'}
          return
        }

        // nearby �� far �����ӳټ���
        iframe.dataset.lazySrc = iframe.src
        iframe.loading = 'lazy'
        if ('fetchPriority' in iframe) {iframe.fetchPriority = zone === 'nearby' ? 'auto' : 'low'}

        // far ����ʹ�� data-src ģʽ������ src ռλ
        if (zone === 'far') {
          // ����͸��ռλ������ iframe �ṹ
          iframe.src = 'about:blank'
        }
        // nearby ���򣺱���ԭ src�����������ԭ�� lazy loading

        // ʹ��ͳһ���ӳټ��ع۲���
        _observeLazyLoad(iframe)

        addLog('info', 'iframe', 'lazy', {
          url: iframe.dataset.lazySrc,
          zone: zone,
        })
      } catch {
        // URL ����ʧ�ܣ�����
      }
    })
  }

  // ========== ȫվDNS prefetch ==========
  function _addGlobalDnsPrefetch() {
    if (!isSiteEnabled('dnsPrefetch')) {return}
    const config = state.config.dnsPrefetch
    const maxDomains = config.maxDomains || 15
    const origins = new Set()
    const head = document.head || document.documentElement

    document.querySelectorAll('script[src], link[href], img[src], iframe[src]').forEach((el) => {
      const url = el.src || el.href
      if (!url) {return}
      try {
        const origin = new URL(url, location.href).origin
        if (origin !== location.origin) {
          origins.add(origin)
        }
      } catch {}
    })

    let count = 0
    origins.forEach((origin) => {
      if (count >= maxDomains) {return}
      if (head.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {return}
      if (head.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) {return}

      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = origin
      head.appendChild(link)
      count++
    })
  }

  // ========== �������أ�SVG �Ż� ==========

  /**
   * ���� SVG ͼƬ���Ż����ݲ�����С SVG
   * @param {HTMLImageElement} img - ͼƬԪ��
   */
  async function processSVG(img) {
    if (state.cspRestricted) {return}
    if (!isSiteEnabled('svgOptimize')) {return}

    const url = img.src
    if (!url || img.dataset._raSvgProcessed) {return}

    // �Ѿ��� data URI������
    if (url.startsWith('data:')) {return}

    // �ж��Ƿ�Ϊ SVG
    if (!/\.svg(\?|#|$)/i.test(url) && !/\/svg\+xml/i.test(url)) {return}

    img.dataset._raSvgProcessed = '1'

    // �߼����˼��
    const filterResult = matchAdvancedFilter(url)
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipReplace') {
        addLog('info', 'svg', 'skip', { url, reason: 'filter_rule' })
        return
      }
    }

    // ��������
    if (state._svgCache.has(url)) {
      const cached = state._svgCache.get(url)
      if (cached) {img.src = cached}
      return
    }

    // �����ų�
    try {
      const urlObj = new URL(url, location.href)
      if (state.config.excludeDomains.some((d) => urlObj.hostname.includes(d))) {
        addLog('info', 'svg', 'skip', { url, reason: 'domain_excluded' })
        return
      }
    } catch {
      return
    }

    const startTime = performance.now()

    try {
      const response = await fetch(url)
      if (!response.ok) {return}
      const text = await response.text()
      const originalSize = new Blob([text]).size

      const config = state.config.svgOptimize
      let optimized = text

      // �Ƴ�ע��
      if (config.removeComments) {
        optimized = optimized.replace(/<!--[\s\S]*?-->/g, '')
      }

      // �Ƴ�Ԫ���ݣ�Inkscape / sodipodi �ȱ༭�����ɵķǱ�ҪԪ�أ�
      if (config.removeMetadata) {
        optimized = optimized.replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
        optimized = optimized.replace(/<sodipodi:[\s\S]*?\/>/gi, '')
        optimized = optimized.replace(/<inkscape:[\s\S]*?\/>/gi, '')
      }

      // ѹ���հ�
      if (config.minify) {
        optimized = optimized.replace(/\s+/g, ' ').replace(/>\s+</g, '><').trim()
      }

      const optimizedSize = new Blob([optimized]).size

      // С SVG������Ϊ data URI
      if (optimizedSize <= config.maxInlineSize) {
        const dataUri = `data:image/svg+xml,${encodeURIComponent(optimized)}`
        img.src = dataUri
        img.dataset._raSvgInlined = 'true'

        state.stats.svgOptimized++
        state.stats.svgInlined++
        state.stats.svgBytesSaved += Math.max(0, originalSize - optimizedSize)
        _persistStats()

        addLog('info', 'svg', 'inline', {
          url,
          size: originalSize,
          compressedSize: optimizedSize,
          reason: 'small_svg_inlined',
          duration: Math.round(performance.now() - startTime),
        })
        return
      }

      // �� SVG���Ż����滻������ 5% �������棩
      if (optimizedSize < originalSize * 0.95) {
        const blob = new Blob([optimized], { type: 'image/svg+xml' })
        const blobUrl = URL.createObjectURL(blob)
        img.src = blobUrl
        state._svgCache.set(url, blobUrl)

        state.stats.svgOptimized++
        state.stats.svgBytesSaved += originalSize - optimizedSize
        _persistStats()

        addLog('info', 'svg', 'replace', {
          url,
          size: originalSize,
          compressedSize: optimizedSize,
          reason: 'large_svg_optimized',
          duration: Math.round(performance.now() - startTime),
        })
      }
      // �Ż����治�㣬����ԭͼ
    } catch (error) {
      addLog('error', 'svg', 'error', { url, reason: 'svg_optimize_failed' })
    }
  }

  // ========== ͼƬѹ�� ==========

  // ͼƬѹ�����ȼ�����ֵ����
  const COMPRESS_PRIORITY = { IN_VIEW: 0, SMALL: 1, LARGE: 2 }
  const SMALL_IMAGE_PIXEL_THRESHOLD = 100000

  // λ�����ȼ����棨�������ʱƵ������ getBoundingClientRect��
  const _positionPriorityCache = new WeakMap()
  const _POSITION_CACHE_TTL = 100 // 100ms ������Ч��

  /**
   * ��ȡ��Դλ�����ȼ�
   * @param {Element} element - DOMԪ��
   * @returns {{ zone: 'inViewport'|'nearby'|'far', priority: number, distance: number }}
   */
  function _getResourcePositionPriority(element) {
    if (!element || !element.isConnected) {
      return { zone: 'far', priority: 999, distance: Infinity }
    }

    // ��黺��
    const cached = _positionPriorityCache.get(element)
    if (cached && performance.now() - cached.time < _POSITION_CACHE_TTL) {
      return cached.result
    }

    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight

    // ����Ԫ�ؾ����ӿڵľ���
    const distanceToViewport =
      rect.top < 0
        ? -rect.top // �ӿ��Ϸ���ȡ����ֵ
        : rect.top > viewportHeight
          ? rect.top - viewportHeight // �ӿ��·�
          : 0 // ���ӿ���

    // ��ȡ���õľ�����ֵ��������
    const nearbyThreshold =
      (state.config.positionAwareLoading?.nearbyThreshold || 1) * viewportHeight

    // �ж�����
    let result
    if (distanceToViewport === 0) {
      result = { zone: 'inViewport', priority: 0, distance: 0 }
    } else if (distanceToViewport <= nearbyThreshold) {
      // nearby �������ȼ� 10-19������Խ�����ȼ�Խ��
      result = {
        zone: 'nearby',
        priority: 10 + Math.floor((distanceToViewport / viewportHeight) * 10),
        distance: distanceToViewport,
      }
    } else {
      // far ����
      result = { zone: 'far', priority: 100, distance: distanceToViewport }
    }

    // ���»���
    _positionPriorityCache.set(element, { result, time: performance.now() })

    return result
  }

  /**
   * �����Դ�Ƿ��Ѽ���
   * @param {Element} element - DOMԪ��
   * @param {string} type - ��Դ����
   * @returns {boolean}
   */
  function _isResourceLoaded(element, type) {
    switch (type) {
      case 'image':
        return element.complete && element.naturalHeight > 0
      case 'iframe':
        if (element.dataset.loaded === 'true') {return true}
        // ����iframe����contentDocument���׳���ȫ����
        try {
          return element.contentDocument !== null
        } catch {
          return false
        }
      case 'script':
        return element.dataset.loaded === 'true'
      default:
        return false
    }
  }

  // ========== �ӳټ��ع۲��� ==========
  let _lazyLoadObserver = null

  /**
   * �����ӳټ��ع۲���
   */
  function _setupLazyLoadObserver() {
    if (_lazyLoadObserver) {return}
    if (typeof IntersectionObserver === 'undefined') {return}

    const nearbyThreshold = state.config.positionAwareLoading?.nearbyThreshold || 1
    // ���������ֵΪ 2 ����200%��������Ԥ���ع�����Դ
    const cappedThreshold = Math.min(nearbyThreshold, 2)
    const rootMargin = `${cappedThreshold * 100}% 0px ${cappedThreshold * 100}% 0px`

    _lazyLoadObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target
            const type = el.tagName.toLowerCase()

            // ��������
            if (el.dataset.lazySrc) {
              el.src = el.dataset.lazySrc
              delete el.dataset.lazySrc
            }

            // ͼƬ����ѹ��
            if (type === 'img' && !el.complete && el.src) {
              enqueueCompress(el, el.src)
            }

            _lazyLoadObserver.unobserve(el)
          }
        })
      },
      {
        rootMargin: rootMargin,
      }
    )

    addLog('info', 'loader', 'init', { feature: 'lazyLoadObserver', threshold: nearbyThreshold })
  }

  /**
   * ��Ԫ�ؼ����ӳټ��ع۲�
   * @param {Element} element - DOMԪ��
   */
  function _observeLazyLoad(element) {
    if (!_lazyLoadObserver) {return}
    _lazyLoadObserver.observe(element)
  }

  /**
   * �����ӳټ��ع۲���
   */
  function _destroyLazyLoadObserver() {
    if (_lazyLoadObserver) {
      _lazyLoadObserver.disconnect()
      _lazyLoadObserver = null
    }
  }

  /**
   * ��ʼ��λ�ø�֪����
   */
  function _initPositionAwareLoading() {
    if (!state.config.positionAwareLoading?.enabled) {return}
    _setupLazyLoadObserver()
  }

  // Throttle ������
  const RECHECK_THROTTLE_MS = 100

  /**
   * ���¼����������ӳټ��ص�ͼƬ��throttled��
   * ���� tab �л���display �仯�ȳ���
   */
  function _recheckVisibleLazyImages() {
    // throttle����ֹƵ������
    if (state._recheckThrottleTimer) {return}
    state._recheckThrottleTimer = setTimeout(() => {
      state._recheckThrottleTimer = null
      _doRecheckVisibleLazyImages()
    }, RECHECK_THROTTLE_MS)
  }

  /**
   * ִ�п�����ͼƬ���
   */
  function _doRecheckVisibleLazyImages() {
    const lazyImages = document.querySelectorAll('img[data-lazy-src]:not([data-lazy-loaded="true"])')

    lazyImages.forEach((img) => {
      // ���Ԫ���Ƿ�ɼ�
      const style = window.getComputedStyle(img)
      if (style.display === 'none' || style.visibility === 'hidden') {return}

      // ����Ƿ��ڿ�����
      const rect = img.getBoundingClientRect()
      const viewportHeight = window.innerHeight
      const viewportWidth = window.innerWidth

      const inViewport =
        rect.bottom > 0 &&
        rect.top < viewportHeight &&
        rect.right > 0 &&
        rect.left < viewportWidth

      if (inViewport && img.dataset.lazySrc) {
        const originalSrc = img.dataset.lazySrc
        delete img.dataset.lazySrc

        // ��������
        img.src = originalSrc
        // ���ô�������
        _setupImageErrorRetry(img, originalSrc)
        img.dataset.lazyLoaded = 'true'
        img.loading = 'eager'
        if ('fetchPriority' in img) {img.fetchPriority = 'high'}

        // �������ѹ��������ѹ������
        if (state.config.imageCompress && !img.dataset.compressed) {
          enqueueCompress(img, originalSrc)
        }

        addLog('info', 'image', 'viewport_reload', {
          url: originalSrc,
          reason: 'tab_switch_or_display_change',
        })
      }
    })
  }

  /**
   * DOM ׼���ú��ʼ���Ĺ���
   * ͳһ������Ҫ document.body ���ڵĳ�ʼ���߼�
   */
  function _initAfterDOMReady() {
    if (state._domReadyInitialized) {return}

    const runInit = () => {
      state._domReadyInitialized = true
      _setupStyleChangeObserver()
    }

    if (document.body) {
      runInit()
    } else {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', runInit, { once: true })
      } else {
        // readyState �� interactive �� complete���� body �Բ����ڣ����ټ���
        const docObserver = new MutationObserver(() => {
          if (document.body) {
            docObserver.disconnect()
            runInit()
          }
        })
        docObserver.observe(document.documentElement, { childList: true, subtree: true })
      }
    }
  }

  /**
   * ������ʽ�仯�۲���
   * ���� display/visibility/hidden ���Ա仯������������ͼƬ���¼��
   * ע�⣺�˺���Ӧͨ�� _initAfterDOMReady ���ã�ȷ�� document.body �Ѵ���
   */
  function _setupStyleChangeObserver() {
    if (state._styleChangeObserver) {return}
    if (typeof MutationObserver === 'undefined') {return}
    // �����Լ�飺��� body �����ڣ���¼����
    if (!document.body) {
      console.warn(`${LOG_PREFIX} _setupStyleChangeObserver called before document.body is ready`)
      return
    }

    state._styleChangeObserver = new MutationObserver((mutations) => {
      let shouldRecheck = false

      for (const mutation of mutations) {
        // ����Ƿ�����ʽ�����Ա仯
        if (mutation.type === 'attributes') {
          const attr = mutation.attributeName
          if (attr === 'style' || attr === 'hidden' || attr === 'class') {
            shouldRecheck = true
            break
          }
        }
      }

      if (shouldRecheck) {
        _recheckVisibleLazyImages()
      }
    })

    // �۲� body ������Ԫ�ص����Ա仯
    state._styleChangeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['style', 'hidden', 'class'],
      subtree: true,
      childList: false,
    })

    addLog('info', 'loader', 'init', { feature: 'styleChangeObserver' })
  }

  /**
   * ������ʽ�仯�۲���
   */
  function _destroyStyleChangeObserver() {
    if (state._styleChangeObserver) {
      state._styleChangeObserver.disconnect()
      state._styleChangeObserver = null
    }
  }

  /**
   * ����ͼƬ���ش�������
   * @param {HTMLImageElement} img - ͼƬԪ��
   * @param {string} src - ԭʼURL
   */
  function _setupImageErrorRetry(img, src) {
    if (!src || src.startsWith('data:')) {return}

    img.onerror = () => {
      const retryCount = state._imageRetryCount.get(src) || 0

      if (retryCount < IMAGE_RETRY_MAX) {
        state._imageRetryCount.set(src, retryCount + 1)

        addLog('warn', 'image', 'retry', {
          url: src,
          reason: 'load_failed',
          attempt: retryCount + 1,
          maxAttempts: IMAGE_RETRY_MAX,
        })

        // �ӳ�����
        setTimeout(() => {
          if (img.isConnected && !img.complete) {
            // ���ʱ�����ֹ����
            const separator = src.includes('?') ? '&' : '?'
            img.src = `${src}${separator}_retry=${Date.now()}`
          }
        }, IMAGE_RETRY_DELAY_MS * (retryCount + 1))
      } else {
        addLog('error', 'image', 'error', {
          url: src,
          reason: 'max_retry_exceeded',
          attempts: retryCount,
        })
        // �������Լ���
        state._imageRetryCount.delete(src)
      }
    }
  }

  // ��ȡͼƬѹ�����ȼ�������λ�ã�
  function _getCompressPriority(img) {
    // �Ѽ�������
    if (_isResourceLoaded(img, 'image')) {return 999}

    const { zone, priority } = _getResourcePositionPriority(img)

    // far ����ѹ��
    if (zone === 'far') {return 999}

    // inViewport �� nearby ʹ��λ�����ȼ�
    // Сͼ��ͬ������΢�� -1
    const size = (img.naturalWidth || 0) * (img.naturalHeight || 0)
    const sizeBonus = size < 100000 ? -1 : 0

    return Math.max(0, priority + sizeBonus)
  }

  function enqueueCompress(img, src) {
    // ���ƶ��д�С�������ڴ����
    if (state.compressQueue.length >= state.config.maxCompressQueueSize) {
      // ������ʱֱ�Ӽ���ԭͼ
      img.src = src
      img.dataset.lazyLoading = 'false'
      img.dataset.lazyLoaded = 'true'
      addLog('warn', 'image', 'skip', { url: src, reason: 'compress_queue_full' })
      return
    }

    // �������ȼ������뵽���еĺ���λ��
    const priority = _getCompressPriority(img)
    let insertIndex = state.compressQueue.length

    // �ҵ���һ�����ȼ��ȵ�ǰ�ͣ���ֵ���󣩵�λ��
    for (let i = 0; i < state.compressQueue.length; i++) {
      if (state.compressQueue[i].priority < priority) {
        insertIndex = i
        break
      }
    }

    state.compressQueue.splice(insertIndex, 0, { img, src, priority })
    processCompressQueue()
  }

  async function processCompressQueue() {
    // ҳ����תʱֹͣ����
    if (state._isNavigating) {
      state.compressQueue = []
      return
    }

    while (
      state.compressingCount < state.config.imageMaxConcurrency &&
      state.compressQueue.length > 0
    ) {
      // ҳ����תʱֹͣ����
      if (state._isNavigating) {
        state.compressQueue = []
        return
      }

      // �����ȼ�ȡ��������ȡ��һ����������ȼ���
      const task = state.compressQueue.shift()
      state.compressingCount++
      const startTime = performance.now()
      try {
        const compressed = await compressImage(task.src)
        const duration = Math.round(performance.now() - startTime)
        if (compressed) {
          // ѹ���ɹ���ֱ�Ӽ���ѹ���汾
          task.img.src = compressed
          task.img.dataset.lazyLoading = 'false'
          task.img.dataset.lazyLoaded = 'true'
          task.img.dataset.compressed = 'true'
          _triggerLqipTransition(task.img)
          addLog('info', 'image', 'compress', {
            url: task.src,
            reason: 'success',
            duration,
          })
        } else {
          // ѹ��ʧ�ܻ�ֵ��ѹ�������˵�ԭͼ
          task.img.src = task.src
          task.img.dataset.lazyLoading = 'false'
          task.img.dataset.lazyLoaded = 'true'
          _triggerLqipTransition(task.img)
          addLog('info', 'image', 'skip', {
            url: task.src,
            reason: 'not_worth_compressing',
            duration,
          })
        }
      } catch {
        // �쳣ʱ���˵�ԭͼ
        task.img.src = task.src
        task.img.dataset.lazyLoading = 'false'
        task.img.dataset.lazyLoaded = 'true'
        _triggerLqipTransition(task.img)
        addLog('error', 'image', 'error', {
          url: task.src,
          reason: 'compress_exception',
        })
      }
      state.compressingCount--
      processCompressQueue()
    }
  }

  async function compressImage(url) {
    if (!isSiteEnabled('imageCompress')) {
      addLog('info', 'image', 'skip', { url, reason: 'compress_disabled' })
      return null
    }

    // �߼����˼��
    const filterResult = matchAdvancedFilter(url)
    if (filterResult.matched) {
      if (filterResult.action === 'skipAll' || filterResult.action === 'skipCompress') {
        addLog('info', 'image', 'skip', { url, reason: 'filter_rule' })
        return null
      }
    }

    // ��黺��
    if (state._compressCache.has(url)) {
      const cached = state._compressCache.get(url)
      return cached.skip ? null : cached.result
    }

    // ��������ų�
    try {
      const urlObj = new URL(url, location.href)
      if (state.config.excludeDomains.some((d) => urlObj.hostname.includes(d))) {
        state._compressCache.set(url, { skip: true })
        addLog('info', 'image', 'skip', { url, reason: 'domain_excluded' })
        return null
      }
    } catch {
      state._compressCache.set(url, { skip: true })
      return null
    }

    // ��ͼƬ���Ͳ�ѹ��
    if (/\.(webp|svg|gif|avif)$/i.test(url)) {
      state._compressCache.set(url, { skip: true })
      addLog('info', 'image', 'skip', { url, reason: 'unsupported_format' })
      return null
    }

    // ҳ����תʱ����ѹ��
    if (state._isNavigating || false) {
      return null
    }

    // ���Ȼ�ȡʵ���ļ���С
    const actualSize = await getImageActualSize(url)

    // �ٴμ����ת״̬
    if (state._isNavigating) {
      return null
    }

    // ��ȡѹ������
    let quality = state.config.imageQuality || 0.8
    let maxWidth = state.config.imageMaxDimension || 2048
    if (_adaptiveCompressor) {
      const params = _adaptiveCompressor.getCompressParams(url, null, actualSize)
      quality = params.quality
      maxWidth = params.maxWidth
    }
    const maxHeight = maxWidth

    // ���� Worker ѹ��
    if (state.config.workerCompress?.enabled && _compressorWorkers.length > 0) {
      try {
        const result = await _compressViaWorker(url, quality, maxWidth, maxHeight)
        if (result.dataUrl) {
          const originalSize = result.originalSize
          const compressionRatio = result.compressedSize / originalSize
          if (compressionRatio < 0.95) {
            state.stats.imagesCompressed++
            state.stats.imagesCompressBytesSaved += originalSize - result.compressedSize
            _persistStats()
            _addToCompressCache(url, result.dataUrl)
            addLog('info', 'image', 'worker_compress', {
              url,
              originalSize,
              compressedSize: result.compressedSize,
              ratio: compressionRatio.toFixed(2),
            })
            return result.dataUrl
          }
        }
      } catch (e) {
        if (!state.config.workerCompress?.fallbackToMain) {
          addLog('warn', 'image', 'worker_failed_no_fallback', { url, error: e.message })
          state._compressCache.set(url, { skip: true })
          return null
        }
        // ʶ��������
        const isCorsError =
          e.message?.includes('fetch') ||
          e.message?.includes('CORS') ||
          e.message?.includes('Failed to fetch')
        addLog('debug', 'image', 'worker_fallback', {
          url,
          error: e.message,
          isCorsError,
          reason: isCorsError ? 'cors_fallback' : 'worker_error',
        })
      }
    }

    // ���߳�ѹ�������˻���ѡ��
    return new Promise((resolve) => {
      // ��ת��麯��
      const checkAborted = () => {
        if (state._isNavigating) {
          resolve(null)
          return true
        }
        return false
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (checkAborted()) {return}
        // ʹ��ʵ�ʴ�С�������ȡ���������������ع��㽵��
        const bytes = actualSize || img.naturalWidth * img.naturalHeight * 4
        if (bytes < state.config.imageMinSize) {
          state._compressCache.set(url, { skip: true })
          addLog('info', 'image', 'skip', { url, reason: 'below_min_size', size: bytes })
          resolve(null)
          return
        }

        try {
          let MAX_DIMENSION = state.config.imageMaxDimension || 2048
          let quality = state.config.imageQuality

          if (_adaptiveCompressor) {
            const params = _adaptiveCompressor.getCompressParams(url, img, actualSize)
            quality = params.quality
            MAX_DIMENSION = params.maxWidth
          }

          let { naturalWidth: w, naturalHeight: h } = img
          if (MAX_DIMENSION > 0 && (w > MAX_DIMENSION || h > MAX_DIMENSION)) {
            const scale = MAX_DIMENSION / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)

          const format = getSupportedImageFormat()
          const mimeType = format.mime

          canvas.toBlob(
            (blob) => {
              // ��תʱ�������
              if (state._isNavigating) {
                resolve(null)
                return
              }
              if (blob && blob.size < bytes) {
                state.stats.imagesCompressed++
                state.stats.imagesCompressBytesSaved += bytes - blob.size
                _persistStats()
                const blobUrl = URL.createObjectURL(blob)
                _addToCompressCache(url, blobUrl)
                resolve(blobUrl)
              } else {
                state._compressCache.set(url, { skip: true })
                resolve(null)
              }
            },
            mimeType,
            quality
          )
        } catch {
          state._compressCache.set(url, { skip: true })
          resolve(null)
        }
      }
      img.onerror = () => {
        state._compressCache.set(url, { skip: true })
        addLog('error', 'image', 'error', { url, reason: 'load_failed' })
        resolve(null)
      }
      // ���� src ǰ�ٴμ��
      if (state._isNavigating) {
        resolve(null)
        return
      }
      img.src = url
    })
  }

  // ========== Preload ��ʾ ==========

  function addPreloadHint(cdnUrl, type, fontInfo) {
    if (state.stats.preloadHints >= state.config.maxPreloadHints) {return}

    if (type === 'font') {
      if (state._fontPreloadedUrls.has(cdnUrl)) {return}

      const weight = fontInfo?.weight || parseFontWeight(cdnUrl)
      state._fontCandidates.push({
        url: cdnUrl,
        priority: getWeightPriority(weight),
        weight: weight || 'unknown',
      })

      state._fontCandidates.sort((a, b) => a.priority - b.priority)
      state._fontCandidates = state._fontCandidates.slice(0, 3)

      _flushFontPreloads()
      return
    }

    _insertPreloadLink(cdnUrl, type)
  }

  function _insertPreloadLink(cdnUrl, type) {
    if (!cdnUrl || typeof cdnUrl !== 'string' || !cdnUrl.startsWith('http')) {return}
    const head = document.head || document.documentElement
    if (head.querySelector(`link[rel="preload"]`)) {
      const links = head.querySelectorAll('link[rel="preload"]')
      for (const l of links) {
        if (l.getAttribute('href') === cdnUrl) {return}
      }
    }
    const link = document.createElement('link')
    link.rel = 'preload'
    link.href = cdnUrl
    if (type === 'js') {
      link.as = 'script'
    } else if (type === 'font') {
      // Google Fonts �� replaceHost ���ص��� CSS ��ʽ�� URL�����������ļ�
      if (/\/css[2]?(?:\?|$)/i.test(cdnUrl)) {
        link.as = 'style'
      } else {
        link.as = 'font'
        link.crossOrigin = 'anonymous'
      }
    } else {
      link.as = 'style'
    }
    head.insertBefore(link, head.firstChild)
    state.stats.preloadHints++
  }

  function _flushFontPreloads() {
    for (const candidate of state._fontCandidates) {
      if (!state._fontPreloadedUrls.has(candidate.url)) {
        _insertPreloadLink(candidate.url, 'font')
        state._fontPreloadedUrls.add(candidate.url)
      }
    }
  }

  // ========== API ���أ������Ż���==========

  const _createElement = document.createElement.bind(document)
  const _appendChild = Element.prototype.appendChild
  const _insertBefore = Element.prototype.insertBefore

  // ���� createElement
  document.createElement = function (tagName, options) {
    const el = _createElement(tagName, options)
    const tag = el.tagName

    if (tag === 'SCRIPT') {
      // ���� src ��������
      const desc =
        Object.getOwnPropertyDescriptor(el, 'src') ||
        Object.getOwnPropertyDescriptor(HTMLScriptElement.prototype, 'src')
      if (!desc || desc.configurable) {
        let _src = ''
        Object.defineProperty(el, 'src', {
          get() {
            return _src
          },
          set(val) {
            _src = val
            if (val) {
              el.setAttribute('src', val)
              Promise.resolve().then(() => processScript(el))
            }
          },
        })
      }
    } else if (tag === 'LINK') {
      // ���� href ��������
      const desc =
        Object.getOwnPropertyDescriptor(el, 'href') ||
        Object.getOwnPropertyDescriptor(HTMLLinkElement.prototype, 'href')
      if (!desc || desc.configurable) {
        let _href = ''
        Object.defineProperty(el, 'href', {
          get() {
            return _href
          },
          set(val) {
            _href = val
            if (val) {
              el.setAttribute('href', val)
              if (el.rel === 'stylesheet') {
                Promise.resolve().then(() => processLink(el))
              }
            }
          },
        })
      }
    } else if (tag === 'IMG') {
      // ���� src ��������
      const desc =
        Object.getOwnPropertyDescriptor(el, 'src') ||
        Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')
      if (!desc || desc.configurable) {
        let _src = ''
        Object.defineProperty(el, 'src', {
          get() {
            return _src
          },
          set(val) {
            _src = val
            if (val) {
              el.setAttribute('src', val)
              Promise.resolve().then(() => processImage(el))
            }
          },
        })
      }
    }

    return el
  }

  // ���� appendChild
  Element.prototype.appendChild = function (node) {
    const result = _appendChild.call(this, node)
    if (node.tagName) {
      if (node.tagName === 'SCRIPT' && node.src) {processScript(node)}
      else if (node.tagName === 'LINK' && node.rel === 'stylesheet') {processLink(node)}
      else if (node.tagName === 'IMG') {processImage(node)}
    }
    return result
  }

  // ���� insertBefore
  Element.prototype.insertBefore = function (node, ref) {
    const result = _insertBefore.call(this, node, ref)
    if (node.tagName) {
      if (node.tagName === 'SCRIPT' && node.src) {processScript(node)}
      else if (node.tagName === 'LINK' && node.rel === 'stylesheet') {processLink(node)}
      else if (node.tagName === 'IMG') {processImage(node)}
    }
    return result
  }

  // ========== MutationObserver�����ף�==========

  // ����������ֵ���������
  const BATCH_THRESHOLDS = { HIGH: 500, MEDIUM: 100 }
  const BATCH_SIZES = { HIGH: 200, MEDIUM: 100, LOW: 50 }
  const INTERVAL_THRESHOLDS = { HIGH: 200, MEDIUM: 50 }
  const BATCH_INTERVALS = { HIGH: 30, MEDIUM: 50, LOW: 100 }

  // ����ҳ�渺�ض�̬����������С
  function _getBatchSize() {
    const pending = state._mutationBatch.length
    if (pending > BATCH_THRESHOLDS.HIGH) {return BATCH_SIZES.HIGH} // �߸��أ�������
    if (pending > BATCH_THRESHOLDS.MEDIUM) {return BATCH_SIZES.MEDIUM} // �и��أ�������
    return BATCH_SIZES.LOW // �͸��أ�С����
  }

  // ����ҳ�渺�ض�̬��������������
  function _getBatchInterval() {
    const pending = state._mutationBatch.length
    if (pending > INTERVAL_THRESHOLDS.HIGH) {return BATCH_INTERVALS.HIGH} // �߸��أ����촦��
    if (pending > INTERVAL_THRESHOLDS.MEDIUM) {return BATCH_INTERVALS.MEDIUM} // �и��أ�����
    return BATCH_INTERVALS.LOW // �͸��أ���ʡ��Դ
  }

  const _observer = new MutationObserver((mutations) => {
    if (!state.config.enableBatchProcessing) {
      // ��������������ʱ��ֱ�Ӵ���
      _processMutations(mutations)
      return
    }

    // ����������ռ�������Ҫ����Ľڵ�
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node.tagName) {continue}
        state._mutationBatch.push(node)
      }
    }

    // ���ö�ʱ����ʹ�ö�̬���
    if (!state._mutationTimer) {
      const interval = _getBatchInterval()
      state._mutationTimer = setTimeout(() => {
        state._mutationTimer = null
        _processBatch()
      }, interval)
    }
  })

  function _processBatch() {
    if (state._isProcessingBatch || state._mutationBatch.length === 0) {return}

    state._isProcessingBatch = true
    // ʹ�ö�̬������С
    const batchSize = _getBatchSize()
    const batch = state._mutationBatch.splice(0, batchSize)

    batch.forEach((node) => {
      if (!node.tagName) {return}
      if (node.tagName === 'SCRIPT' && node.src) {processScript(node)}
      else if (node.tagName === 'LINK' && node.rel === 'stylesheet') {processLink(node)}
      else if (node.tagName === 'IMG') {processImage(node)}
      else if (node.tagName === 'IFRAME') {processIframeLazyLoad()}

      if (node.querySelectorAll) {
        node.querySelectorAll('script[src]').forEach(processScript)
        node.querySelectorAll('link[rel="stylesheet"]').forEach(processLink)
        node.querySelectorAll('img[src]').forEach(processImage)
        node.querySelectorAll('iframe[src]').forEach(processIframeLazyLoad)
      }
    })

    state._isProcessingBatch = false

    // �������ʣ��ڵ㣬ʹ�ö�̬����������
    if (state._mutationBatch.length > 0) {
      const interval = _getBatchInterval()
      setTimeout(_processBatch, interval)
    }
  }

  function _processMutations(mutations) {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!node.tagName) {continue}
        if (node.tagName === 'SCRIPT' && node.src) {processScript(node)}
        else if (node.tagName === 'LINK' && node.rel === 'stylesheet') {processLink(node)}
        else if (node.tagName === 'IMG') {processImage(node)}
        else if (node.tagName === 'IFRAME') {processIframeLazyLoad()}

        if (node.querySelectorAll) {
          node.querySelectorAll('script[src]').forEach(processScript)
          node.querySelectorAll('link[rel="stylesheet"]').forEach(processLink)
          node.querySelectorAll('img[src]').forEach(processImage)
          node.querySelectorAll('iframe[src]').forEach(processIframeLazyLoad)
        }
      }
    }
  }

  // ========== ��������״̬ģ�� ==========
  // ����ģʽ������ PriorityOptimizer �� AdaptiveCompressor �ظ����
  const NetworkState = {
    quality: 'medium',
    _listeners: new Set(),
    _handleNetworkChange: null,

    init() {
      this.detect()
      this.listen()
    },

    detect() {
      if (!navigator.connection) {return}

      const effectiveType = navigator.connection.effectiveType
      const downlink = navigator.connection.downlink

      if (effectiveType === '4g' && downlink > 10) {
        this.quality = 'fast'
      } else if (effectiveType === '4g' || effectiveType === '3g') {
        this.quality = 'medium'
      } else {
        this.quality = 'slow'
      }

      state._lastNetworkQuality = this.quality
    },

    listen() {
      if (!navigator.connection) {return}

      this._handleNetworkChange = () => {
        const oldQuality = this.quality
        this.detect()
        if (oldQuality !== this.quality) {
          this._notifyListeners()
        }
      }

      navigator.connection.addEventListener('change', this._handleNetworkChange)
    },

    subscribe(callback) {
      this._listeners.add(callback)
      return () => this._listeners.delete(callback)
    },

    _notifyListeners() {
      this._listeners.forEach((cb) => cb(this.quality))
    },

    destroy() {
      if (this._handleNetworkChange && navigator.connection) {
        navigator.connection.removeEventListener('change', this._handleNetworkChange)
      }
      this._listeners.clear()
    },
  }

  // ========== ���ܼ�� ==========
  class PerformanceMonitor {
    constructor(config) {
      this.config = config
      this.metrics = {}
      this.observers = []
      this.sampled = Math.random() < config.sampleRate
      this._reportTimer = null
    }

    init() {
      if (!this.config.enabled || !this.sampled) {return}

      this.initCoreWebVitals()
      this.initResourceTiming()
      this.initMemoryMonitoring()
      this.startReporting()

      console.log(`${LOG_PREFIX} [PerfMonitor] ��ʼ�����`)
    }

    initCoreWebVitals() {
      // LCP ���� init() ��ͨ�� state.lcp �ռ����˴������ظ����� observer

      try {
        if (this.config.metrics.fid && typeof PerformanceObserver !== 'undefined') {
          const fidObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            entries.forEach((entry) => {
              if (entry.processingStart) {
                this.metrics.fid = entry.processingStart - entry.startTime
              }
            })
          })
          fidObserver.observe({ type: 'first-input', buffered: true })
          this.observers.push(fidObserver)
        }
      } catch (e) {
        console.warn(`${LOG_PREFIX} [PerfMonitor] ָ���ռ�ʧ��:`, e)
      }

      try {
        if (this.config.metrics.cls && typeof PerformanceObserver !== 'undefined') {
          let clsValue = 0
          const clsObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            entries.forEach((entry) => {
              if (!entry.hadRecentInput) {
                clsValue += entry.value
              }
            })
            this.metrics.cls = clsValue
          })
          clsObserver.observe({ type: 'layout-shift', buffered: true })
          this.observers.push(clsObserver)
        }
      } catch (e) {
        console.warn(`${LOG_PREFIX} [PerfMonitor] ָ���ռ�ʧ��:`, e)
      }

      try {
        if (this.config.metrics.fcp && typeof PerformanceObserver !== 'undefined') {
          const fcpObserver = new PerformanceObserver((entryList) => {
            const entries = entryList.getEntries()
            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                this.metrics.fcp = entry.startTime
              }
            })
          })
          fcpObserver.observe({ type: 'paint', buffered: true })
          this.observers.push(fcpObserver)
        }
      } catch (e) {
        console.warn(`${LOG_PREFIX} [PerfMonitor] ָ���ռ�ʧ��:`, e)
      }

      if (this.config.metrics.ttfb) {
        const navEntry = performance.getEntriesByType('navigation')[0]
        if (navEntry) {
          this.metrics.ttfb = navEntry.responseStart - navEntry.requestStart
        }
      }
    }

    initResourceTiming() {
      if (!this.config.metrics.resourceTiming) {return}

      try {
        const resourceObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          entries.forEach((entry) => {
            this.processResourceTiming(entry)
          })
        })
        resourceObserver.observe({ type: 'resource', buffered: true })
        this.observers.push(resourceObserver)
      } catch (e) {
        console.warn(`${LOG_PREFIX} [PerfMonitor] ָ���ռ�ʧ��:`, e)
      }
    }

    processResourceTiming(entry) {
      const url = entry.name
      const duration = entry.duration
      const size = entry.transferSize || 0

      if (!this.metrics.resources) {
        this.metrics.resources = []
      }

      this.metrics.resources.push({
        url,
        duration,
        size,
        type: this.getResourceType(url),
        timestamp: Date.now(),
      })

      if (this.metrics.resources.length > 100) {
        this.metrics.resources = this.metrics.resources.slice(-100)
      }
    }

    getResourceType(url) {
      if (url.endsWith('.js')) {return 'script'}
      if (url.endsWith('.css')) {return 'style'}
      if (url.match(/\.(png|jpg|jpeg|gif|webp|svg)$/)) {return 'image'}
      if (url.match(/\.(woff|woff2|ttf|otf)$/)) {return 'font'}
      return 'other'
    }

    initMemoryMonitoring() {
      if (!this.config.metrics.memoryUsage) {return}

      this._memoryTimer = setInterval(() => {
        if (performance.memory) {
          this.metrics.memoryUsage = {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit,
          }
        }
      }, 5000)
    }

    startReporting() {
      this._reportTimer = setInterval(() => {
        this.reportMetrics()
      }, this.config.reportInterval)
    }

    async reportMetrics() {
      if (Object.keys(this.metrics).length === 0) {return}

      const report = {
        timestamp: Date.now(),
        url: location.href,
        userAgent: navigator.userAgent,
        connection: this.getConnectionInfo(),
        metrics: {
          ...this.metrics,
          resources: this.metrics.resources ? this.metrics.resources.map((r) => ({ ...r })) : [],
        },
      }

      await this.saveMetrics(report)
      this.metrics.resources = []
    }

    getConnectionInfo() {
      if (navigator.connection) {
        return {
          effectiveType: navigator.connection.effectiveType,
          downlink: navigator.connection.downlink,
          rtt: navigator.connection.rtt,
        }
      }
      return null
    }

    async saveMetrics(report) {
      try {
        const result = await chrome.storage.local.get(this.config.storageKey)
        const metrics = result[this.config.storageKey] || []

        metrics.push(report)

        if (metrics.length > this.config.maxEntries) {
          metrics.splice(0, metrics.length - this.config.maxEntries)
        }

        await chrome.storage.local.set({ [this.config.storageKey]: metrics })
      } catch (e) {
        console.warn(`${LOG_PREFIX} [PerfMonitor] ����ָ��ʧ��:`, e)
      }
    }

    getOptimizationSuggestions() {
      const suggestions = []

      if (state.lcp != null && state.lcp > 2500) {
        suggestions.push({
          type: 'lcp',
          severity: 'high',
          message: 'LCP ʱ������������Ż��ؼ���Դ����',
          actions: ['���ùؼ���Դ���ȼ���', '�Ż�ͼƬ����', '������Ⱦ������Դ'],
        })
      }

      if (this.metrics.cls > 0.1) {
        suggestions.push({
          type: 'cls',
          severity: 'medium',
          message: '����ƫ�ƹ��󣬽����ȶ�ҳ�沼��',
          actions: ['ΪͼƬ���óߴ�', '���⶯̬��������', 'ʹ�� CSS containment'],
        })
      }

      if (this.metrics.resources) {
        const slowResources = this.metrics.resources.filter((r) => r.duration > 1000)
        if (slowResources.length > 0) {
          suggestions.push({
            type: 'resource',
            severity: 'medium',
            message: `���� ${slowResources.length} ����������Դ`,
            actions: ['���� CDN ����', '�Ż���Դ��С', 'ʹ��������'],
          })
        }
      }

      return suggestions
    }

    destroy() {
      this.observers.forEach((observer) => observer.disconnect())
      this.observers = []
      if (this._reportTimer) {clearInterval(this._reportTimer)}
      if (this._memoryTimer) {clearInterval(this._memoryTimer)}
    }
  }

  // ========== ���ȼ��Ż� ==========
  class PriorityOptimizer {
    constructor(config) {
      this.config = config
      this.currentPriority = {}
      this.networkQuality = 'medium'
      this.pageType = 'default'
      this._handleNetworkChange = null
    }

    init() {
      if (!this.config.enabled) {return}

      this.detectNetworkQuality()
      this.detectPageType()
      this.calculatePriority()
      this.applyToExistingElements()
      this.listenNetworkChanges()

      console.log(`${LOG_PREFIX} [PriorityOptimizer] ��ʼ�����`)
    }

    detectNetworkQuality() {
      if (!this.config.networkAware.enabled) {return}
      // ʹ�ù��������ͳһ�����������
      this.networkQuality = detectNetworkQuality()
    }

    detectPageType() {
      if (!this.config.pageTypeAware.enabled) {return}

      const url = location.href
      const hostname = location.hostname

      for (const [type, rules] of Object.entries(this.config.pageTypeAware.rules)) {
        const patterns = this.getPageTypePatterns(type)
        const matches = patterns.some((pattern) => pattern.test(url) || pattern.test(hostname))

        if (matches) {
          this.pageType = type
          return
        }
      }

      this.pageType = 'default'
    }

    getPageTypePatterns(type) {
      const patterns = {
        ecommerce: [/product/i, /item/i, /shop/i, /cart/i],
        news: [/article/i, /news/i, /post/i, /blog/i],
        video: [/video/i, /watch/i, /player/i, /stream/i],
      }

      return patterns[type] || []
    }

    calculatePriority() {
      const basePriority = this.getBasePriority()
      const networkAdjustment = this.getNetworkAdjustment()
      const pageTypeAdjustment = this.getPageTypeAdjustment()

      this.currentPriority = { ...basePriority }

      if (this.config.networkAware.enabled && networkAdjustment) {
        Object.keys(this.currentPriority).forEach((type) => {
          if (networkAdjustment[type] !== undefined) {
            this.currentPriority[type] = networkAdjustment[type]
          }
        })
      }

      if (this.config.pageTypeAware.enabled && pageTypeAdjustment) {
        Object.keys(this.currentPriority).forEach((type) => {
          if (pageTypeAdjustment[type] !== undefined) {
            this.currentPriority[type] = pageTypeAdjustment[type]
          }
        })
      }
    }

    getBasePriority() {
      return { script: 0, style: 1, image: 2, font: 3, video: 4 }
    }

    getNetworkAdjustment() {
      return this.config.networkAware.adjustments[this.networkQuality]
    }

    getPageTypeAdjustment() {
      return this.config.pageTypeAware.rules[this.pageType]
    }

    listenNetworkChanges() {
      if (!navigator.connection) {return}

      this._handleNetworkChange = () => {
        this.detectNetworkQuality()
        this.calculatePriority()
      }

      navigator.connection.addEventListener('change', this._handleNetworkChange)
    }

    getResourcePriority(url, type) {
      let priority = this.currentPriority[type] ?? 2

      if (this.config.sizeAware.enabled) {
        const size = this.estimateResourceSize(url, type)
        if (size < this.config.sizeAware.smallResourceThreshold) {
          priority = Math.max(0, priority - 1)
        } else if (size > this.config.sizeAware.largeResourceThreshold) {
          priority = Math.min(4, priority + 1)
        }
      }

      return priority
    }

    estimateResourceSize(url, type) {
      const sizeEstimates = {
        script: 50000,
        style: 20000,
        image: 100000,
        font: 30000,
        video: 1000000,
      }

      return sizeEstimates[type] || 50000
    }

    applyPriorityToResource(element, url, type) {
      // �Ѽ�����Դ����
      if (_isResourceLoaded(element, type)) {return}

      // ͼƬ��iframeʹ��λ�����ȼ�
      if (type === 'image' || type === 'iframe') {
        const { zone } = _getResourcePositionPriority(element)

        if (zone === 'inViewport') {
          if ('fetchPriority' in element) {element.fetchPriority = 'high'}
          if ('loading' in element) {element.loading = 'eager'}
        } else if (zone === 'nearby') {
          if ('fetchPriority' in element) {element.fetchPriority = 'auto'}
          if ('loading' in element) {element.loading = 'lazy'}
        } else {
          // far - ����lazy���ȴ���������
          if ('fetchPriority' in element) {element.fetchPriority = 'low'}
          if ('loading' in element) {element.loading = 'lazy'}
        }
        return
      }

      // �ű����ؼ�JS�������أ��ǹؼ���λ��
      if (type === 'script') {
        const isCritical = element.type === 'module' || element.closest('head')
        if (isCritical) {return} // �ؼ�JS����Ԥ

        const { zone } = _getResourcePositionPriority(element)
        if (zone === 'far') {
          // �ǹؼ�JS��far�����ӳټ���
          if (!element.dataset.src) {
            element.dataset.src = element.src
            element.src = ''
          }
        }
        return
      }

      // CSS ������
    }

    applyToExistingElements() {
      if (!this.config.scanExisting?.enabled) {return}

      const viewportHeight = window.innerHeight
      let count = 0
      const max = this.config.scanExisting.maxElements || 50

      document.querySelectorAll('script[src]').forEach((script) => {
        if (count >= max) {return}
        this.applyPriorityToResource(script, script.src, 'script')
        count++
      })

      document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
        if (count >= max) {return}
        this.applyPriorityToResource(link, link.href, 'style')
        count++
      })

      document.querySelectorAll('img[src]').forEach((img) => {
        if (count >= max) {return}
        const rect = img.getBoundingClientRect()
        const isInViewport = rect.top < viewportHeight
        this.applyPriorityToResource(img, img.src, 'image')
        if (!isInViewport && img.loading !== 'lazy') {
          img.loading = 'lazy'
        }
        count++
      })

      console.log(`${LOG_PREFIX} [PriorityOptimizer] ɨ��������Դ: ${count} ��`)
    }

    getPriorityInfo() {
      return {
        networkQuality: this.networkQuality,
        pageType: this.pageType,
        currentPriority: { ...this.currentPriority },
      }
    }

    destroy() {
      // �Ƴ�����仯������
      if (navigator.connection) {
        navigator.connection.removeEventListener('change', this._handleNetworkChange)
      }
    }
  }

  // ========== �ڴ��Ż� ==========
  class MemoryOptimizer {
    constructor(config) {
      this.config = config
      this.cache = new Map()
      this.cacheStats = { hits: 0, misses: 0, evictions: 0 }
      this.memoryPressure = 'normal'
      this._checkTimer = null
      this._saveTimer = null
    }

    async init() {
      if (!this.config.enabled) {return}

      this.initMemoryMonitoring()
      this.initCache()
      await this.loadCacheData()
      await this.prewarmCache()

      console.log(`${LOG_PREFIX} [MemoryOptimizer] ��ʼ�����`)
    }

    initMemoryMonitoring() {
      if (!this.config.monitoring.enabled) {return}

      this._checkTimer = setInterval(() => {
        this.checkMemoryPressure()
      }, this.config.monitoring.checkInterval)
    }

    checkMemoryPressure() {
      if (!performance.memory) {return}

      const usedMB = performance.memory.usedJSHeapSize / 1024 / 1024

      if (usedMB > this.config.monitoring.thresholds.critical) {
        this.memoryPressure = 'critical'
        this.applyPressureResponse('critical')
      } else if (usedMB > this.config.monitoring.thresholds.warning) {
        this.memoryPressure = 'warning'
        this.applyPressureResponse('warning')
      } else {
        this.memoryPressure = 'normal'
      }
    }

    applyPressureResponse(pressure) {
      const strategy = this.config.pressureResponse.strategies[pressure]
      if (!strategy) {return}

      if (strategy.disableImageCompress && typeof state !== 'undefined') {
        state.config.imageCompress = false
      }

      if (strategy.reduceCacheSize) {
        this.reduceCacheSize()
      }

      if (strategy.pauseBackgroundTasks) {
        this.pauseBackgroundTasks()
      }
    }

    reduceCacheSize() {
      const currentSize = this.getCacheSize()
      const targetSize = this.config.caching.maxSize * 0.5

      if (currentSize > targetSize) {
        this.evictCacheEntries(currentSize - targetSize)
      }
    }

    pauseBackgroundTasks() {
      // Worker pool pause not implemented in current architecture
    }

    initCache() {
      this.cache = new Map()
    }

    async loadCacheData() {
      try {
        const result = await chrome.storage.local.get('resourceAcceleratorCacheData')
        const cachedData = result.resourceAcceleratorCacheData || {}

        for (const [key, value] of Object.entries(cachedData)) {
          if (this.isCacheEntryValid(value)) {
            this.cache.set(key, value)
          }
        }
      } catch (e) {
        console.warn(`${LOG_PREFIX} [MemoryOptimizer] ���ػ�������ʧ��:`, e)
      }
    }

    async prewarmCache() {
      if (!this.config.caching.prewarm?.enabled) {return}

      const types = this.config.caching.prewarm.types || []
      const resources = document.querySelectorAll('link[rel="stylesheet"], script[src], style')

      for (const resource of resources) {
        let url = ''
        let type = ''

        if (resource.tagName === 'LINK' && resource.rel === 'stylesheet') {
          url = resource.href
          type = 'css'
        } else if (resource.tagName === 'SCRIPT' && resource.src) {
          url = resource.src
          type = 'js'
        } else if (resource.tagName === 'STYLE') {
          type = 'css'
        }

        if (url && types.includes(type)) {
          const cacheKey = `prewarm:${url}`
          const existing = await this.getFromCache(cacheKey)
          if (!existing) {
            this.cache.set(cacheKey, {
              value: { url, type, prewarmed: true },
              timestamp: Date.now(),
              lastAccess: Date.now(),
              accessCount: 0,
            })
          }
        }
      }

      console.log(`${LOG_PREFIX} [MemoryOptimizer] ����Ԥ����ɣ���ǰ���� ${this.cache.size} ��`)
    }

    isCacheEntryValid(entry) {
      if (!entry || !entry.timestamp) {return false}
      const now = Date.now()
      return now - entry.timestamp < this.config.caching.ttl
    }

    async saveCacheData() {
      try {
        const cacheData = Object.fromEntries(this.cache)
        await chrome.storage.local.set({ resourceAcceleratorCacheData: cacheData })
      } catch (e) {
        console.warn(`${LOG_PREFIX} [MemoryOptimizer] ���滺������ʧ��:`, e)
      }
    }

    getCacheSize() {
      let size = 0
      for (const [key, value] of this.cache.entries()) {
        size += this.estimateSize(value.value)
      }
      return size
    }

    estimateSize(value) {
      if (typeof value === 'string') {
        return value.length * 2
      }
      return JSON.stringify(value).length * 2
    }

    evictCacheEntries(targetSize) {
      let evictedSize = 0
      const entries = Array.from(this.cache.entries())

      switch (this.config.caching.evictionPolicy) {
        case 'lru':
          entries.sort((a, b) => (a[1].lastAccess || 0) - (b[1].lastAccess || 0))
          break
        case 'lfu':
          entries.sort((a, b) => (a[1].accessCount || 0) - (b[1].accessCount || 0))
          break
        case 'fifo':
          entries.sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0))
          break
      }

      for (const [key, value] of entries) {
        if (evictedSize >= targetSize) {break}
        const size = this.estimateSize(value)
        this.cache.delete(key)
        evictedSize += size
        this.cacheStats.evictions++
      }
    }

    async getFromCache(key) {
      if (!this.config.caching.enabled) {return null}

      const entry = this.cache.get(key)
      if (!entry) {
        this.cacheStats.misses++
        return null
      }

      if (!this.isCacheEntryValid(entry)) {
        this.cache.delete(key)
        this.cacheStats.misses++
        return null
      }

      entry.lastAccess = Date.now()
      entry.accessCount = (entry.accessCount || 0) + 1
      this.cacheStats.hits++
      return entry.value
    }

    async setCache(key, value) {
      if (!this.config.caching.enabled) {return}

      const currentSize = this.getCacheSize()
      const entrySize = this.estimateSize(value)

      if (currentSize + entrySize > this.config.caching.maxSize) {
        this.evictCacheEntries(entrySize)
      }

      this.cache.set(key, {
        value,
        timestamp: Date.now(),
        lastAccess: Date.now(),
        accessCount: 1,
      })

      this.scheduleSaveCacheData()
    }

    scheduleSaveCacheData() {
      if (this._saveTimer) {return}
      this._saveTimer = setTimeout(() => {
        this._saveTimer = null
        this.saveCacheData()
      }, 5000)
    }

    getCacheStats() {
      return {
        ...this.cacheStats,
        size: this.getCacheSize(),
        entries: this.cache.size,
        memoryPressure: this.memoryPressure,
      }
    }

    clearCache() {
      this.cache.clear()
      this.cacheStats = { hits: 0, misses: 0, evictions: 0 }
      this.saveCacheData()
    }

    destroy() {
      if (this._checkTimer) {clearInterval(this._checkTimer)}
      if (this._saveTimer) {clearTimeout(this._saveTimer)}
      this.saveCacheData()
    }
  }

  let _perfMonitor = null

  function _initPerfMonitor() {
    if (!state.config.perfMonitor?.enabled) {return}
    _perfMonitor = new PerformanceMonitor(state.config.perfMonitor)
    _perfMonitor.init()
  }

  let _priorityOptimizer = null

  function _initPriorityOptimizer() {
    if (!state.config.priorityOptimizer?.enabled) {return}
    _priorityOptimizer = new PriorityOptimizer(state.config.priorityOptimizer)
    _priorityOptimizer.init()
  }

  let _memoryOptimizer = null

  function _initMemoryOptimizer() {
    if (!state.config.memoryOptimizer?.enabled) {return}
    _memoryOptimizer = new MemoryOptimizer(state.config.memoryOptimizer)
    _memoryOptimizer.init()
  }

  // ========== LQIP ����ʽռλ ==========
  let _lqipStyleInjected = false

  function _injectLqipCSS() {
    if (_lqipStyleInjected) {return}
    const config = state.config.lqip
    if (!config?.enabled) {return}

    const style = document.createElement('style')
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
    `
    const head = document.head || document.documentElement
    head.appendChild(style)
    _lqipStyleInjected = true
  }

  // ========== content-visibility ��Ⱦ�Ż� ==========
  let _contentVisibilityInjected = false

  function _injectContentVisibilityCSS() {
    if (_contentVisibilityInjected) {return}
    const config = state.config.contentVisibility
    if (!config?.enabled) {return}

    const includeSelector = config.selectors.join(', ')
    const excludeSelector = config.excludeSelectors.map((s) => `:not(${s})`).join('')

    const style = document.createElement('style')
    style.textContent = `
      ${includeSelector}${excludeSelector} {
        content-visibility: auto;
        contain-intrinsic-size: 0 500px;
      }
    `
    const head = document.head || document.documentElement
    head.appendChild(style)
    _contentVisibilityInjected = true
  }

  function _triggerLqipTransition(img) {
    if (!img.dataset.lqip) {return}
    if (img.complete) {
      img.dataset.lqipLoaded = '1'
    } else {
      img.addEventListener(
        'load',
        () => {
          img.dataset.lqipLoaded = '1'
        },
        { once: true }
      )
      img.addEventListener(
        'error',
        () => {
          img.dataset.lqipLoaded = '1'
        },
        { once: true }
      )
    }
  }

  // ========== Worker ѹ������ ==========
  // Worker �ļ�: content/workers/image-compressor.worker.js

  let _compressorWorkers = []
  let _workerTaskId = 0
  const _workerPendingTasks = new Map()
  let _workerLoadIndex = 0
  const _workerTaskQueue = [] // ���ȼ��������

  // �����豸���ܻ�ȡ����Worker����
  function _getOptimalWorkerCount() {
    const tier = detectDeviceTier()
    const configMax = state.config.workerCompress?.maxWorkers || 2
    // �߶��豸4�����ж�2�����Ͷ�1��
    const optimal = tier === 'high' ? 4 : tier === 'medium' ? 2 : 1
    return Math.min(optimal, configMax)
  }

  // ��������Worker��֧�ֽ�������ؽ���
  function _createWorker(index) {
    try {
      // ʹ�� chrome.runtime.getURL() ���ض��� Worker �ļ���Manifest V3 CSP ���ݣ�
      const workerUrl = chrome.runtime.getURL('content/workers/image-compressor.worker.js')
      const worker = new Worker(workerUrl)

      worker.onmessage = _handleWorkerMessage
      worker.onerror = (e) => {
        // ��� CSP ����
        if (e.message && e.message.includes('Content Security Policy')) {
          console.warn(`${LOG_PREFIX} Worker �� CSP ��ֹ������ Worker ѹ������`)
          state.config.workerCompress.enabled = false
          addLog('warn', 'worker', 'csp_blocked', {
            error: e.message,
            fallback: 'main_thread'
          })
          return
        }

        console.error(`${LOG_PREFIX} Worker#${index}����:`, e.message)
        // ������飺�Զ��ؽ�������Worker
        state.stats.workerCrashCount = (state.stats.workerCrashCount || 0) + 1
        setTimeout(() => {
          if (_compressorWorkers[index] === worker) {
            _compressorWorkers[index] = _createWorker(index)
            console.log(`${LOG_PREFIX} Worker#${index}���ؽ�`)
          }
        }, 100)
      }
      return worker
    } catch (e) {
      // ����ͬ�������� CSP ��ֹ��
      if (e.message && e.message.includes('Content Security Policy')) {
        console.warn(`${LOG_PREFIX} Worker ������ CSP ��ֹ������ Worker ѹ������`)
        state.config.workerCompress.enabled = false
      } else {
        console.warn(`${LOG_PREFIX} Worker����ʧ��:`, e)
      }
      return null
    }
  }

  function _initCompressorWorkers() {
    if (!state.config.workerCompress?.enabled) {return}
    if (typeof Worker === 'undefined') {return}

    const maxWorkers = _getOptimalWorkerCount()
    for (let i = 0; i < maxWorkers; i++) {
      const worker = _createWorker(i)
      if (worker) {_compressorWorkers.push(worker)}
    }

    if (_compressorWorkers.length > 0) {
      console.log(
        `${LOG_PREFIX} �ѳ�ʼ�� ${_compressorWorkers.length} ��ѹ��Worker (�豸�ȼ�: ${detectDeviceTier()})`
      )
      // Ԥ�ȣ�����΢�Ͳ������񼤻�Worker
      _warmupWorkers()
      // �����̬�������
      _startWorkerPoolMonitor()
    }
  }

  // WorkerԤ��
  function _warmupWorkers() {
    const testPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    _compressorWorkers.forEach((worker, i) => {
      const id = `warmup-${i}`
      worker.postMessage({ id, src: testPng, quality: 0.1, maxWidth: 1, maxHeight: 1 })
    })
  }

  function _handleWorkerMessage(e) {
    const { id, success, dataUrl, error, originalSize, compressedSize } = e.data
    const task = _workerPendingTasks.get(id)
    if (!task) {return}

    _workerPendingTasks.delete(id)

    // ��¼��ʱ
    const duration = Date.now() - task.startTime
    state.stats.workerCompressTotalMs = (state.stats.workerCompressTotalMs || 0) + duration

    if (success) {
      state.stats.workerCompressSuccess = (state.stats.workerCompressSuccess || 0) + 1
      task.resolve({ dataUrl, originalSize, compressedSize, duration })
    } else {
      state.stats.workerCompressFallback = (state.stats.workerCompressFallback || 0) + 1
      task.reject(new Error(error))
    }
  }

  // ��ѯ����Worker
  function _getAvailableWorker() {
    if (_compressorWorkers.length === 0) {return null}
    const worker = _compressorWorkers[_workerLoadIndex % _compressorWorkers.length]
    _workerLoadIndex++
    return worker
  }

  // ������ͼƬ
  function _isCorsUrl(url) {
    if (!url || url.startsWith('data:')) {return false}
    try {
      const urlObj = new URL(url, location.href)
      return urlObj.origin !== location.origin
    } catch {
      return true
    }
  }

  // ���ȼ����д���
  function _processWorkerQueue() {
    if (_workerTaskQueue.length === 0) {return}
    const worker = _getAvailableWorker()
    if (!worker) {return}

    // �����ȼ����򣨸����ȼ��ȴ����
    _workerTaskQueue.sort((a, b) => b.priority - a.priority)
    const task = _workerTaskQueue.shift()
    if (!task) {return}

    const { id, src, quality, maxWidth, maxHeight, priority, isCors, resolve, reject } = task
    const timeout = state.config.workerCompress?.timeout || 5000
    const startTime = Date.now()

    const timer = setTimeout(() => {
      _workerPendingTasks.delete(id)
      state.stats.workerCompressFallback = (state.stats.workerCompressFallback || 0) + 1
      reject(new Error('Worker timeout'))
    }, timeout)

    _workerPendingTasks.set(id, {
      startTime,
      priority,
      resolve: (result) => {
        clearTimeout(timer)
        resolve(result)
        // ������һ����������
        setTimeout(_processWorkerQueue, 0)
      },
      reject: (err) => {
        clearTimeout(timer)
        reject(err)
        setTimeout(_processWorkerQueue, 0)
      },
    })

    worker.postMessage({ id, src, quality, maxWidth, maxHeight, priority, isCors })
  }

  async function _compressViaWorker(src, quality, maxWidth, maxHeight, priority = 0) {
    return new Promise((resolve, reject) => {
      const worker = _getAvailableWorker()
      const isCors = _isCorsUrl(src)

      if (!worker) {
        reject(new Error('No available worker'))
        return
      }

      // �����ȼ�ֱ�Ӵ���������ȼ�������
      if (priority >= 5 || _workerTaskQueue.length === 0) {
        const id = ++_workerTaskId
        const timeout = state.config.workerCompress?.timeout || 5000
        const startTime = Date.now()

        const timer = setTimeout(() => {
          _workerPendingTasks.delete(id)
          state.stats.workerCompressFallback = (state.stats.workerCompressFallback || 0) + 1
          reject(new Error('Worker timeout'))
        }, timeout)

        _workerPendingTasks.set(id, {
          startTime,
          priority,
          resolve: (result) => {
            clearTimeout(timer)
            resolve(result)
          },
          reject: (err) => {
            clearTimeout(timer)
            reject(err)
          },
        })

        worker.postMessage({ id, src, quality, maxWidth, maxHeight, priority, isCors })
      } else {
        // �������
        _workerTaskQueue.push({
          id: ++_workerTaskId,
          src,
          quality,
          maxWidth,
          maxHeight,
          priority,
          isCors,
          resolve,
          reject,
        })
        // �������д���
        setTimeout(_processWorkerQueue, 0)
      }
    })
  }

  function _terminateCompressorWorkers() {
    _compressorWorkers.forEach((w) => w.terminate())
    _compressorWorkers = []
    _workerPendingTasks.clear()
    // ֹͣ��̬�������
    if (_workerPoolMonitor) {
      clearInterval(_workerPoolMonitor)
      _workerPoolMonitor = null
    }
  }

  // ========== ���߳̽���ѹ�� ==========
  async function _compressOnMainThread(src, quality, maxWidth, maxHeight, actualSize = null) {
    return new Promise((resolve) => {
      if (state._isNavigating) {
        resolve(null)
        return
      }

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (state._isNavigating) {
          resolve(null)
          return
        }

        const bytes = actualSize || img.naturalWidth * img.naturalHeight * 4
        if (bytes < state.config.imageMinSize) {
          state._compressCache.set(src, { skip: true })
          resolve(null)
          return
        }

        try {
          let { naturalWidth: w, naturalHeight: h } = img
          if (maxWidth > 0 && (w > maxWidth || h > maxHeight)) {
            const scale = maxWidth / Math.max(w, h)
            w = Math.round(w * scale)
            h = Math.round(h * scale)
          }

          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, w, h)

          const format = getSupportedImageFormat()
          canvas.toBlob(
            (blob) => {
              if (state._isNavigating) {
                resolve(null)
                return
              }
              if (blob && blob.size < bytes) {
                state.stats.mainThreadCompress = (state.stats.mainThreadCompress || 0) + 1
                const blobUrl = URL.createObjectURL(blob)
                resolve({ dataUrl: blobUrl, originalSize: bytes, compressedSize: blob.size })
              } else {
                resolve(null)
              }
            },
            format.mime,
            quality
          )
        } catch {
          resolve(null)
        }
      }
      img.onerror = async () => {
        // ����ͼƬ����ʧ�ܣ�����ͨ�� background ����
        if (_isCorsUrl(src)) {
          try {
            const response = await chrome.runtime.sendMessage({ type: 'FETCH_CORS_IMAGE', url: src })
            if (response.success && response.dataUrl) {
              // ʹ�ô�����ص� data URL ���¼���ͼƬ
              const proxyImg = new Image()
              proxyImg.onload = () => {
                const bytes = actualSize || proxyImg.naturalWidth * proxyImg.naturalHeight * 4
                if (bytes < state.config.imageMinSize) {
                  state._compressCache.set(src, { skip: true })
                  resolve(null)
                  return
                }
                try {
                  let { naturalWidth: w, naturalHeight: h } = proxyImg
                  if (maxWidth > 0 && (w > maxWidth || h > maxHeight)) {
                    const scale = maxWidth / Math.max(w, h)
                    w = Math.round(w * scale)
                    h = Math.round(h * scale)
                  }
                  const canvas = document.createElement('canvas')
                  canvas.width = w
                  canvas.height = h
                  const ctx = canvas.getContext('2d')
                  ctx.drawImage(proxyImg, 0, 0, w, h)
                  const format = getSupportedImageFormat()
                  canvas.toBlob((blob) => {
                    if (blob && blob.size < bytes) {
                      state.stats.corsProxyCompress = (state.stats.corsProxyCompress || 0) + 1
                      const blobUrl = URL.createObjectURL(blob)
                      resolve({ dataUrl: blobUrl, originalSize: bytes, compressedSize: blob.size })
                    } else {
                      resolve(null)
                    }
                  }, format.mime, quality)
                } catch {
                  resolve(null)
                }
              }
              proxyImg.onerror = () => resolve(null)
              proxyImg.src = response.dataUrl
              return
            }
          } catch (e) {
            addLog('warn', 'image', 'cors_proxy_failed', { url: src, error: e.message })
          }
        }
        resolve(null)
      }
      img.src = src
    })
  }

  // ========== Worker �ض�̬���� ==========
  let _workerPoolMonitor = null
  const WORKER_POOL_CONFIG = {
    minWorkers: 1,
    maxWorkers: 4,
    scaleUpThreshold: 3, // ������ѹ��������������
    scaleDownThreshold: 5000, // ����ʱ��(ms)��������
    monitorInterval: 2000, // ��ؼ��
  }

  function _startWorkerPoolMonitor() {
    if (_workerPoolMonitor) {return}

    let consecutiveBacklog = 0
    let lastActiveTime = Date.now()

    _workerPoolMonitor = setInterval(() => {
      const pendingCount = _workerPendingTasks.size
      const workerCount = _compressorWorkers.length

      // ���»�Ծʱ��
      if (pendingCount > 0) {
        lastActiveTime = Date.now()
      }

      // �����߼�����ѹ�����������
      if (pendingCount >= WORKER_POOL_CONFIG.scaleUpThreshold) {
        consecutiveBacklog++
        if (consecutiveBacklog >= 2 && workerCount < WORKER_POOL_CONFIG.maxWorkers) {
          const newWorker = _createWorker(workerCount)
          if (newWorker) {
            _compressorWorkers.push(newWorker)
            console.log(`${LOG_PREFIX} Worker�������� ${_compressorWorkers.length} ��`)
          }
          consecutiveBacklog = 0
        }
      } else {
        consecutiveBacklog = 0
      }

      // �����߼�����ʱ�����
      const idleTime = Date.now() - lastActiveTime
      if (
        idleTime > WORKER_POOL_CONFIG.scaleDownThreshold &&
        workerCount > WORKER_POOL_CONFIG.minWorkers
      ) {
        const removed = _compressorWorkers.pop()
        if (removed) {
          removed.terminate()
          console.log(`${LOG_PREFIX} Worker�������� ${_compressorWorkers.length} ��`)
        }
      }
    }, WORKER_POOL_CONFIG.monitorInterval)
  }

  // ========== ����Ӧѹ�� ==========
  class AdaptiveCompressor {
    constructor(config) {
      this.config = config
      this.typeCache = new Map()
      this.networkQuality = 'medium' // ��������������״̬
      this._handleNetworkChange = null
    }

    init() {
      if (!this.config.enabled) {return}

      // ����������������������� PriorityOptimizer
      this.detectNetworkQuality()
      this.listenNetworkChanges()

      console.log(`${LOG_PREFIX} [AdaptiveCompressor] ��ʼ�����`)
    }

    detectNetworkQuality() {
      if (!this.config.networkAdaptive.enabled) {return}
      // ʹ�ù��������ͳһ�����������
      this.networkQuality = detectNetworkQuality()
    }

    listenNetworkChanges() {
      if (!navigator.connection) {return}

      this._handleNetworkChange = () => {
        this.detectNetworkQuality()
      }

      navigator.connection.addEventListener('change', this._handleNetworkChange)
    }

    detectImageType(url, element) {
      if (!this.config.typeDetection.enabled) {return 'photo'}

      const cacheKey = url
      if (this.typeCache.has(cacheKey)) {
        return this.typeCache.get(cacheKey)
      }

      let detectedType = 'photo'

      for (const [type, patterns] of Object.entries(this.config.typeDetection.patterns)) {
        const matches = patterns.some(
          (pattern) => pattern.test(url) || pattern.test(element?.className || '')
        )
        if (matches) {
          detectedType = type
          break
        }
      }

      this.typeCache.set(cacheKey, detectedType)

      // ���ƻ����С��ɾ����ɵ�1000������ȫ�����
      if (this.typeCache.size > 5000) {
        const iter = this.typeCache.keys()
        for (let i = 0; i < 1000; i++) {
          this.typeCache.delete(iter.next().value)
        }
      }

      return detectedType
    }

    getCompressParams(url, element, originalSize) {
      const imageType = this.detectImageType(url, element)
      const baseParams = this.config.typeStrategies[imageType] || this.config.typeStrategies.photo

      let quality = baseParams.quality
      let maxWidth = baseParams.maxWidth
      const deviceTier = detectDeviceTier() // �豸�ȼ����

      // �����֪����
      if (this.config.networkAdaptive.enabled) {
        const networkQuality = state._lastNetworkQuality || 'medium'
        const adjustment = this.config.networkAdaptive.adjustments[networkQuality]
        if (adjustment) {
          quality = Math.min(1, quality * adjustment.qualityMultiplier)
        }

        // �豸��֪����
        const deviceAdjustments = this.config.networkAdaptive.deviceAdjustments
        if (deviceAdjustments) {
          const deviceAdjustment = deviceAdjustments[deviceTier]
          if (deviceAdjustment) {
            maxWidth = Math.floor(maxWidth * deviceAdjustment.maxWidthMultiplier)
          }
        }
      }

      // �ߴ��֪����
      if (this.config.sizeAdaptive.enabled && originalSize) {
        if (originalSize < this.config.sizeAdaptive.smallImageThreshold) {
          quality = Math.min(1, quality * 1.1)
        } else if (originalSize > this.config.sizeAdaptive.largeImageThreshold) {
          quality = Math.max(0.3, quality * 0.7)
          maxWidth = Math.floor(maxWidth * 0.7)
        }
      }

      // �������������ֵ
      quality = Math.max(0.5, quality)

      // ������־
      addLog('debug', 'image', 'adaptive_params', {
        url,
        imageType,
        network: state._lastNetworkQuality,
        device: deviceTier,
        quality: quality.toFixed(2),
        maxWidth,
      })

      return {
        quality,
        maxWidth,
        imageType,
      }
    }

    destroy() {
      this.typeCache.clear()
    }
  }

  let _adaptiveCompressor = null

  function _initAdaptiveCompressor() {
    if (!state.config.adaptiveCompress?.enabled) {return}
    _adaptiveCompressor = new AdaptiveCompressor(state.config.adaptiveCompress)
    _adaptiveCompressor.init()
  }

  // ========== ����Ԥ���� v2 ==========
  class SmartPreloadV2 {
    constructor(config) {
      this.config = config
      this.pageType = 'default'
      this.preloadQueue = []
      this.activePreloads = 0
      this.scrollSpeed = 0
      this.lastScrollY = 0
      this.lastScrollTime = Date.now()
      this.dwellTime = 0
      this.pageLoadTime = Date.now()
      this._longBehaviorTriggered = false
      this._shortBehaviorTriggered = false
      this._preloadUrls = new Set()
    }

    init() {
      if (!this.config.enabled) {return}

      this.analyzePageStructure()
      this.preloadCriticalResources() // ����
      this.initScrollListener()
      this.initMouseListener()
      this.initDwellTimeTracker()

      console.log(`${LOG_PREFIX} [SmartPreloadV2] ��ʼ�����`)
    }

    analyzePageStructure() {
      if (!this.config.pageStructure.enabled) {return}

      const url = location.href
      for (const [type, rules] of Object.entries(this.config.pageStructure.contentTypes)) {
        const matches = rules.patterns.some((pattern) => pattern.test(url))
        if (matches) {
          this.pageType = type
          break
        }
      }

      this.criticalResources = this.detectCriticalResources()
    }

    detectCriticalResources() {
      const resources = []

      if (this.config.pageStructure.criticalRegions.aboveFold) {
        const viewportHeight = window.innerHeight
        document.querySelectorAll('img[src]').forEach((img) => {
          const rect = img.getBoundingClientRect()
          if (rect.top < viewportHeight) {
            resources.push({
              url: img.src,
              type: 'image',
              priority: 0,
              region: 'aboveFold',
            })
          }
        })
      }

      if (this.config.pageStructure.criticalRegions.navigation) {
        document.querySelectorAll('nav a[href], .nav a[href], header a[href]').forEach((link) => {
          resources.push({
            url: link.href,
            type: 'link',
            priority: 1,
            region: 'navigation',
          })
        })
      }

      return resources
    }

    preloadCriticalResources() {
      if (!this.criticalResources || this.criticalResources.length === 0) {return}
      this.criticalResources
        .filter((r) => r.type === 'image' && r.priority === 0)
        .slice(0, this.config.priorityScheduling.maxPreloads || 6)
        .forEach((r) => this._executePreload(r.url, 'aboveFold'))
    }

    initScrollListener() {
      if (!this.config.intentPrediction.enabled) {return}

      this._scrollTimer = null
      this._scrollHandler = () => {
        const now = Date.now()
        const deltaY = Math.abs(window.scrollY - this.lastScrollY)
        const deltaTime = now - this.lastScrollTime

        if (deltaTime > 0) {
          this.scrollSpeed = deltaY / (deltaTime / 1000)
        }

        this.lastScrollY = window.scrollY
        this.lastScrollTime = now

        clearTimeout(this._scrollTimer)
        this._scrollTimer = setTimeout(() => {
          this.onScrollEnd()
        }, 150)
      }
      window.addEventListener('scroll', this._scrollHandler, { passive: true })
    }

    onScrollEnd() {
      const { fastThreshold, slowThreshold, fastBehavior, slowBehavior } =
        this.config.intentPrediction.scrollSpeed

      if (this.scrollSpeed > fastThreshold) {
        this.executeStrategy(fastBehavior)
      } else if (this.scrollSpeed < slowThreshold) {
        this.executeStrategy(slowBehavior)
      }
    }

    initMouseListener() {
      if (!this.config.intentPrediction.mouseMovement.enabled) {return}

      this._mouseHandler = (e) => {
        const target = e.target.closest('a[href], img[src]')
        if (!target) {return}

        const url = target.href || target.src
        if (!url) {return}

        clearTimeout(this._mouseTimeout)
        this._mouseTimeout = setTimeout(() => {
          this.schedulePreload(url, 'hover', 2)
        }, this.config.intentPrediction.mouseMovement.hoverDelay)
      }
      document.addEventListener('mouseover', this._mouseHandler, { passive: true })
    }

    initDwellTimeTracker() {
      if (!this.config.intentPrediction.enabled) {return}

      this._dwellTimer = setInterval(() => {
        this.dwellTime = Date.now() - this.pageLoadTime
        const { shortThreshold, longThreshold, shortBehavior, longBehavior } =
          this.config.intentPrediction.dwellTime

        if (this.dwellTime > longThreshold && !this._longBehaviorTriggered) {
          this._longBehaviorTriggered = true
          this.executeStrategy(longBehavior)
        } else if (
          this.dwellTime > shortThreshold &&
          this.dwellTime <= longThreshold &&
          !this._shortBehaviorTriggered
        ) {
          this._shortBehaviorTriggered = true
          this.executeStrategy(shortBehavior)
        }
      }, 5000)
    }

    executeStrategy(strategy) {
      switch (strategy) {
        case 'preload-more':
          this.preloadNextResources(3)
          break
        case 'preload-details':
          this.preloadCurrentContentDetails()
          break
        case 'preload-next':
          this.preloadNextPage()
          break
        case 'preload-related':
          this.preloadRelatedContent()
          break
      }
    }

    schedulePreload(url, reason, priority) {
      if (this.activePreloads >= this.config.priorityScheduling.maxConcurrent) {
        this.preloadQueue.push({ url, reason, priority })
        this.preloadQueue.sort((a, b) => a.priority - b.priority)
        return
      }

      this._executePreload(url, reason)
    }

    _executePreload(url, reason) {
      if (this._preloadUrls.has(url)) {return} // ȥ��
      this._preloadUrls.add(url)
      this.activePreloads++
      const isCritical = reason === 'aboveFold' || reason === 'hover' || reason === 'scroll-predict'
      const link = document.createElement('link')
      link.rel = isCritical ? 'preload' : 'prefetch'
      link.href = url
      if (isCritical) {
        link.as = 'image'
        const preloadCount = document.querySelectorAll(
          'link[rel="preload"][data-preload-reason]'
        ).length
        if (preloadCount >= (this.config.priorityScheduling.maxPreloads || 6)) {
          link.rel = 'prefetch'
          delete link.as
        }
      }
      link.dataset.preloadReason = reason

      let _done = false
      const finish = () => {
        if (_done) {return}
        _done = true
        this.activePreloads--
        this.processQueue()
      }
      link.onload = finish
      link.onerror = finish
      setTimeout(finish, 3000)

      document.head.appendChild(link)
    }

    processQueue() {
      while (
        this.preloadQueue.length > 0 &&
        this.activePreloads < this.config.priorityScheduling.maxConcurrent
      ) {
        const item = this.preloadQueue.shift()
        this._executePreload(item.url, item.reason)
      }
    }

    preloadNextResources(count) {
      const viewportHeight = window.innerHeight
      const images = document.querySelectorAll('img[data-src], img[data-lazy-src], img[src]')
      let preloaded = 0

      for (const img of images) {
        if (preloaded >= count) {break}

        const rect = img.getBoundingClientRect()
        if (rect.top > viewportHeight && rect.top < viewportHeight + 500) {
          const url = img.dataset.lazySrc || img.dataset.src || img.src
          if (url && !url.startsWith('data:') && !img.complete && img.naturalWidth === 0) {
            this.schedulePreload(url, 'scroll-predict', 1)
            preloaded++
          }
        }
      }
    }

    preloadCurrentContentDetails() {
      const article = document.querySelector('article, .article, .post-content, .entry-content')
      if (!article) {return}

      let count = 0
      const images = article.querySelectorAll('img[data-src], img[data-lazysrc], img[src]')
      images.forEach((img) => {
        if (count >= 10) {return}
        const url = img.dataset.lazySrc || img.dataset.src || img.src
        if (url && !url.startsWith('data:')) {
          this.schedulePreload(url, 'content-detail', 2)
          count++
        }
      })

      const links = article.querySelectorAll('a[href]')
      links.forEach((link) => {
        if (count >= 10) {return}
        if (link.hostname === location.hostname) {
          this.schedulePreload(link.href, 'related-link', 3)
          count++
        }
      })
    }

    preloadNextPage() {
      const nextLink = document.querySelector('a[rel="next"], .next-page, .pagination .next a')
      if (nextLink) {
        this.schedulePreload(nextLink.href, 'next-page', 1)
      }
    }

    preloadRelatedContent() {
      const relatedSections = document.querySelectorAll(
        '.related-posts, .recommended, .similar-articles, aside'
      )

      let count = 0
      relatedSections.forEach((section) => {
        const links = section.querySelectorAll('a[href]')
        links.forEach((link) => {
          if (count >= 10) {return}
          if (link.hostname === location.hostname) {
            this.schedulePreload(link.href, 'related-content', 2)
            count++
          }
        })
      })
    }

    destroy() {
      if (this._scrollHandler) {
        window.removeEventListener('scroll', this._scrollHandler)
      }
      if (this._scrollTimer) {
        clearTimeout(this._scrollTimer)
      }
      if (this._mouseHandler) {
        document.removeEventListener('mouseover', this._mouseHandler)
      }
      if (this._mouseTimeout) {
        clearTimeout(this._mouseTimeout)
      }
      if (this._dwellTimer) {
        clearInterval(this._dwellTimer)
      }
      document.querySelectorAll('link[data-preload-reason]').forEach((el) => el.remove())
      this._preloadUrls.clear()
      this.preloadQueue = []
    }
  }

  let _smartPreloadV2 = null

  function _initSmartPreloadV2() {
    if (!state.config.smartPreloadV2?.enabled) {return}
    _smartPreloadV2 = new SmartPreloadV2(state.config.smartPreloadV2)
    _smartPreloadV2.init()
  }

  // ========== ҳ����ת��Դ���� ==========
  /**
   * ����ҳ����ת��ȡ���ǿ�������Դ����
   * ʹ�� requestIdleCallback �ӳ������������ҳ����ת
   */
  function _initNavigationListener() {
    window.addEventListener(
      'pagehide',
      () => {
        // �����ת״̬������������ҳ����ת
        state._isNavigating = true

        // ʹ�� requestIdleCallback �ӳ������������
        requestIdleCallback?.(
          () => {
            state.compressQueue = []
            state._deferredScripts = []
          },
          { timeout: 100 }
        ) ||
          setTimeout(() => {
            state.compressQueue = []
            state._deferredScripts = []
          }, 0)
      },
      { once: true }
    )
  }

  // ========== ��ʼ�����첽����������==========

  // ��ȡҳ��ʹ�õ� CDN ���ȼ�
  function _getCDNPriorities() {
    const pageCDNs = new Set()

    // ɨ��ҳ���е� script �� link Ԫ��
    const elements = document.querySelectorAll('script[src], link[href]')
    elements.forEach((el) => {
      const url = el.src || el.href
      if (isCDNUrl(url)) {
        const cdnInfo = _getCDNInfo(url)
        if (cdnInfo) {
          pageCDNs.add(cdnInfo.id)
        }
      }
    })

    return Array.from(pageCDNs)
  }

  // ��ȡ URL ��Ӧ�� CDN ��Ϣ
  function _getCDNInfo(url) {
    if (!window.CDNMappings?.CDN_SOURCES) {return null}

    for (const cdn of window.CDNMappings.CDN_SOURCES) {
      try {
        const cdnUrl = new URL(cdn.baseUrl)
        if (url.includes(cdnUrl.hostname)) {
          return { id: cdn.id, name: cdn.name || cdn.id }
        }
      } catch (error) {
        console.warn('[_getCDNInfo] ����CDN URLʧ��:', error)
      }
    }
    return null
  }

  function init() {
    if (state.initialized) {return}
    state.initialized = true

    // 0. LCP ָ���ռ�����Ҫ��������۲죩
    let lcpObserver = null
    try {
      if (typeof PerformanceObserver !== 'undefined') {
        lcpObserver = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries()
          if (entries.length > 0) {
            state.lcp = entries[entries.length - 1].startTime
          }
        })
        lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true })
      }
    } catch {
      // �����������֧�� largest-contentful-paint ����
    }

    // 1. �������ã��첽����������
    _loadConfig()

    // ע��LQIP��ʽ
    _injectLqipCSS()

    // ע�� content-visibility ��ʽ
    _injectContentVisibilityCSS()

    // 1.1 �ָ���ʷ������־���첽����������
    _restoreErrorLogs()

    // 2. CSP Ԥ�죨�첽����������
    _precheckCSP()

    // 3. CDN preconnect
    _addCDNPreconnect()

    // ȫվDNS prefetch
    _addGlobalDnsPrefetch()

    // ��ʼ��ѹ��Worker
    _initCompressorWorkers()

    // ��ʼ��λ�ø�֪����
    _initPositionAwareLoading()

    // ��ʼ����ʽ�仯�۲�������Ҫ DOM ׼���ã�
    _initAfterDOMReady()

    // ��ʼ������仯����
    _initNetworkChangeListener()
    // 初始化完成后立即检查视口内的懒加载图片
    requestAnimationFrame(() => {
      setTimeout(() => {
        _doRecheckVisibleLazyImages()
      }, 100)
    })

    // 4. CDN����̽�⣨�첽����������- ����̽��ҳ��ʹ�õ� CDN
    if (window.CDNMappings?.probeAllCDNs) {
      const pageCDNs = _getCDNPriorities()
      let probePromise
      if (pageCDNs.length > 0) {
        console.log(`${LOG_PREFIX} ����̽��ҳ��ʹ�õ� CDN: ${pageCDNs.join(', ')}`)
        // ��̽��ҳ��ʹ�õ� CDN����̽������ CDN
        probePromise = window.CDNMappings.probeAllCDNs({ priorityIds: pageCDNs })
      } else {
        probePromise = window.CDNMappings.probeAllCDNs()
      }
      // ̽����ɺ��¼����״̬����־������
      probePromise?.then?.(() => {
        const cdnHealth = window.CDNMappings?.getCDNHealth?.() || {}
        Object.entries(cdnHealth).forEach(([cdnId, health]) => {
          addLog('info', 'cdn', 'probe', {
            cdn: cdnId,
            reason: health.healthy ? `RTT: ${health.rtt}ms` : '̽��ʧ��',
          })
        })
      })
    }

    // 5. ��� MutationObserver�����ף�
    _observer.observe(document.documentElement, { childList: true, subtree: true })

    // 6. ����������Դ
    document.querySelectorAll('script[src]').forEach(processScript)
    document.querySelectorAll('link[rel="stylesheet"]').forEach(processLink)
    document.querySelectorAll('img[src]').forEach(processImage)
    // ��������iframe
    processIframeLazyLoad()

    // 7. ��Ϣ����
    _initMessageListener()

    // 1.14 ��ʼ�����ܼ��
    _initPerfMonitor()

    // 1.15 ��ʼ�����ȼ��Ż�
    _initPriorityOptimizer()

    // 1.16 ��ʼ���ڴ��Ż�
    _initMemoryOptimizer()

    // 1.17 ��ʼ������Ӧѹ��
    _initAdaptiveCompressor()

    // 1.18 ��ʼ������Ԥ���� v2
    _initSmartPreloadV2()

    // 1.19 ��ʼ��ҳ����ת����
    _initNavigationListener()

    // 8. ҳ����غ��ռ�����ָ�겢ֹͣ LCP �۲�
    window.addEventListener(
      'load',
      () => {
        if (lcpObserver) {
          lcpObserver.disconnect()
        }
        state.performance = collectPerformanceMetrics()
        // ����ÿ��ͳ��������������ͼ��
        saveDailyStats()
      },
      { once: true }
    )

    // 9. ҳ��ɼ��Ա仯ʱ���¼�������ͼƬ
    document.addEventListener(
      'visibilitychange',
      () => {
        if (document.visibilityState === 'visible') {
          // ���¼��������ڴ��� lazySrc ��ͼƬ
          requestAnimationFrame(() => {
            _recheckVisibleLazyImages()
          })
        }
      }
    )

    // 10. ���Ԥ����������ԭͼ
    document.addEventListener(
      'click',
      (e) => {
        const img = e.target.closest('img[data--ra-lazy-load="1"], img[data-lazy-src]')
        if (!img) {return}

        // ͳһ��� lazySrc �� src
        const originalSrc = img.dataset.lazySrc || img.dataset.src
        if (!originalSrc || img.dataset.lazyLoaded === 'true') {return}

        // ���� lazySrc �����ظ�����
        delete img.dataset.lazySrc

        // ��������ԭͼ
        img.src = originalSrc
        img.dataset.lazyLoaded = 'true'
        img.loading = 'eager'
        if ('fetchPriority' in img) {img.fetchPriority = 'high'}

        // ���ô�������
        _setupImageErrorRetry(img, originalSrc)

        // ���� LQIP ����
        _triggerLqipTransition(img)

        addLog('info', 'image', 'click_load', { url: originalSrc, reason: 'user_click_preview' })
      },
      { capture: true }
    )

    console.log(`${LOG_PREFIX} ��ʼ�����`)
  }

  async function _loadConfig() {
    try {
      const result = await chrome.storage.local.get(CONFIG_KEY)
      let userConfig = result[CONFIG_KEY] || {}

      // ����Ǩ�ƣ��Զ������ɰ汾����
      if (window.ConfigMigrator && userConfig.version !== DEFAULT_CONFIG.version) {
        const migrationResult = await window.ConfigMigrator.migrate(userConfig)
        if (migrationResult?.config) {
          userConfig = migrationResult.config
          console.log(
            `${LOG_PREFIX} ����Ǩ�����: ${migrationResult.fromVersion} -> ${migrationResult.toVersion}`
          )
        }
      }

      // Deep merge for nested config objects
      state.config = { ...DEFAULT_CONFIG }
      for (const key of Object.keys(userConfig)) {
        if (
          typeof userConfig[key] === 'object' &&
          userConfig[key] !== null &&
          !Array.isArray(userConfig[key])
        ) {
          state.config[key] = { ...DEFAULT_CONFIG[key], ...userConfig[key] }
        } else {
          state.config[key] = userConfig[key]
        }
      }

      if (!state.config.enabled) {
        _observer.disconnect()
      }
    } catch (error) {
      console.warn('[_loadConfig] ��������ʧ��:', error)
    }
  }

  async function _precheckCSP() {
    const metaCSP = document.querySelector('meta[http-equiv="Content-Security-Policy"]')
    if (metaCSP) {
      const content = metaCSP.getAttribute('content') || ''

      // ��� script-src
      const scriptSrc = content.match(/script-src\s+([^;]+)/)
      if (scriptSrc && !/https?:|\*\./.test(scriptSrc[1])) {
        state.cspRestricted = true
        return
      }

      // ��� worker-src��Ӱ�� Worker ������
      const workerSrc = content.match(/worker-src\s+([^;]+)/)
      if (workerSrc && !/blob:|data:|https?:|\*\./.test(workerSrc[1])) {
        // worker-src ������ blob: �� data:������ Worker ѹ��
        if (state.config.workerCompress) {
          state.config.workerCompress.enabled = false
          addLog('warn', 'worker', 'csp_restricted', {
            directive: workerSrc[0],
            fallback: 'main_thread'
          })
        }
      }
    }

    // �첽��⣬������������ CSP ��⣬���ⱻ block��
    // CSP ������ͨ�� meta ��ǩԤ�촦��
  }

  function _addCDNPreconnect() {
    if (!window.CDNMappings?.CDN_SOURCES) {return}
    const head = document.head || document.documentElement
    const priorityCDNs = ['bootcdn', 'staticfile', 'jsdelivr']

    window.CDNMappings.CDN_SOURCES.forEach((cdn) => {
      if (cdn._disabled) {return}
      try {
        const origin = new URL(cdn.baseUrl).origin
        if (document.querySelector(`link[rel="dns-prefetch"][href="${origin}"]`)) {return}
        const link = _createElement('link')
        link.rel = priorityCDNs.includes(cdn.id) ? 'preconnect' : 'dns-prefetch'
        link.href = origin
        if (link.rel === 'preconnect') {link.crossOrigin = 'anonymous'}
        head.insertBefore(link, head.firstChild)
      } catch (error) {
        console.warn('[_addCDNPreconnect] ���CDNԤ����ʧ��:', error)
      }
    })
  }

  // ========== ��Ϣ���� ==========

  // ========== CDN 重定向失败回退 ==========
  function _handleCDNFallback(originalUrl, failedUrl, reason) {
    addLog('warn', 'cdn', 'fallback', { originalUrl, failedUrl, reason })

    // 查找使用失败 URL 的 stylesheet link 元素
    const links = document.querySelectorAll('link[rel="stylesheet"]')
    for (const link of links) {
      if (link.href === failedUrl) {
        // 创建新的 link 元素使用原始 URL
        const newLink = document.createElement('link')
        newLink.rel = 'stylesheet'
        newLink.href = originalUrl
        newLink.dataset._raFallback = '1'
        newLink.dataset._raOriginalFailed = failedUrl

        // 插入到失败的 link 之后
        link.parentNode?.insertBefore(newLink, link.nextSibling)

        // 移除失败的 link
        link.remove()

        addLog('info', 'cdn', 'fallback_success', { originalUrl, failedUrl })
        state.stats.fallbacks = (state.stats.fallbacks || 0) + 1
        break
      }
    }
  }

  function _initMessageListener() {
    chrome.runtime?.onMessage?.addListener((message, sender, sendResponse) => {
      if (message.type === 'RESOURCE_ACCELERATOR_GET_STATS') {
        sendResponse({ success: true, data: state.stats })
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_CDN_HEALTH') {
        sendResponse(window.CDNMappings?.getCDNHealth?.() || {})
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_CONFIG') {
        state.config = { ...state.config, ...message.data }
        if (!state.config.enabled) {
          _observer?.disconnect()
        }
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_COMPARISON') {
        getPerformanceComparison().then((data) => {
          sendResponse({ success: true, data })
        })
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_SAVE_BASELINE') {
        savePerformanceBaseline()
        sendResponse({ success: true })
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_RESET_BASELINE') {
        resetPerformanceBaseline()
        sendResponse({ success: true })
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_LOGS') {
        const logs = getLogs(message.filter || {})
        sendResponse({ success: true, data: logs })
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_CLEAR_LOGS') {
        clearLogs()
        sendResponse({ success: true })
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_DISTRIBUTION') {
        sendResponse({ success: true, data: getStatsDistribution() })
        return true
      }
      if (message.type === 'RESOURCE_ACCELERATOR_GET_TREND') {
        aggregateDailyStats(message.days || 7).then((data) => {
          sendResponse({ success: true, data })
        })
        return true
      }
      // CDN 重定向失败回退
      if (message.type === 'CDN_REDIRECT_FALLBACK') {
        _handleCDNFallback(message.originalUrl, message.failedUrl, message.statusCode || message.error)
        return true
      }
    })
  }

  // ========== ����ָ���ռ� ==========

  function collectPerformanceMetrics() {
    try {
      const navEntries = performance.getEntriesByType('navigation')
      if (!navEntries.length) {return null}
      const nav = navEntries[0]

      const resEntries = performance.getEntriesByType('resource')
      const totalDuration = resEntries.reduce((sum, e) => sum + e.duration, 0)

      const estimatedTimeSaved =
        state.stats.jsReplaced * 150 +
        (state.stats.cssReplaced || 0) * 100 +
        state.stats.fontsReplaced * 120

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
        estimatedTimeSaved,
      }
    } catch {
      return null
    }
  }

  // ========== ���õ��뵼�� ==========

  function exportConfig() {
    const exportData = {
      version: '1.0',
      exportTime: new Date().toISOString(),
      config: { ...state.config },
    }
    return JSON.stringify(exportData, null, 2)
  }

  function importConfig(jsonString) {
    try {
      const importData = JSON.parse(jsonString)

      // ��֤��ʽ
      if (!importData.version || !importData.config) {
        return { success: false, error: '��Ч�����ø�ʽ' }
      }

      // ��֤�汾
      if (importData.version !== '1.0') {
        return { success: false, error: `��֧�ֵ����ð汾: ${importData.version}` }
      }

      // �ϲ����ã������������õ�Ĭ��ֵ��
      const mergedConfig = { ...DEFAULT_CONFIG, ...importData.config }

      // ����״̬
      state.config = mergedConfig

      // ���浽 storage
      chrome.storage.local.set({ [CONFIG_KEY]: mergedConfig })

      return { success: true, config: mergedConfig }
    } catch (e) {
      return { success: false, error: `��������ʧ��: ${e.message}` }
    }
  }

  function resetConfig() {
    state.config = { ...DEFAULT_CONFIG }
    chrome.storage.local.set({ [CONFIG_KEY]: state.config })
    return state.config
  }

  // ========== ���ܻ��߶Ա� ==========

  const PERFORMANCE_BASELINE_KEY = 'resourceAcceleratorPerformanceBaseline'

  function savePerformanceBaseline() {
    if (!state.performance) {return null}

    const baseline = {
      ttfb: state.performance.ttfb,
      domContentLoaded: state.performance.domContentLoaded,
      loadEvent: state.performance.loadEvent,
      lcp: state.performance.lcp,
      totalResources: state.performance.totalResources,
      totalTransferSize: state.performance.totalTransferSize || 0,
      timestamp: Date.now(),
    }

    chrome.storage.local.set({ [PERFORMANCE_BASELINE_KEY]: baseline })
    return baseline
  }

  async function getPerformanceComparison() {
    try {
      const result = await chrome.storage.local.get(PERFORMANCE_BASELINE_KEY)
      const baseline = result[PERFORMANCE_BASELINE_KEY]

      if (!baseline || !state.performance) {
        return null
      }

      const current = state.performance

      // �����ʡʱ��
      const loadTimeSaved = baseline.loadEvent - current.loadEvent
      const loadTimePercent =
        baseline.loadEvent > 0 ? Math.round((loadTimeSaved / baseline.loadEvent) * 100) : 0

      // �����ʡ����
      const transferSizeSaved = baseline.totalTransferSize - (current.totalTransferSize || 0)
      const transferSizePercent =
        baseline.totalTransferSize > 0
          ? Math.round((transferSizeSaved / baseline.totalTransferSize) * 100)
          : 0

      // ���� LCP ����
      const lcpSaved =
        baseline.lcp != null && current.lcp != null ? baseline.lcp - current.lcp : null
      const lcpPercent =
        lcpSaved != null && baseline.lcp > 0 ? Math.round((lcpSaved / baseline.lcp) * 100) : null

      return {
        baseline: {
          ttfb: baseline.ttfb,
          domContentLoaded: baseline.domContentLoaded,
          loadEvent: baseline.loadEvent,
          lcp: baseline.lcp,
          totalResources: baseline.totalResources,
          totalTransferSize: baseline.totalTransferSize,
        },
        current: {
          ttfb: current.ttfb,
          domContentLoaded: current.domContentLoaded,
          loadEvent: current.loadEvent,
          lcp: current.lcp,
          totalResources: current.totalResources,
          totalTransferSize: current.totalTransferSize || 0,
        },
        savings: {
          loadTimeSaved: Math.max(0, loadTimeSaved),
          loadTimePercent: Math.max(0, loadTimePercent),
          lcpSaved: lcpSaved != null ? Math.max(0, lcpSaved) : null,
          lcpPercent: lcpPercent != null ? Math.max(0, lcpPercent) : null,
          transferSizeSaved: Math.max(0, transferSizeSaved),
          transferSizePercent: Math.max(0, transferSizePercent),
          resourcesReplaced: Math.max(0, baseline.totalResources - current.totalResources),
        },
      }
    } catch {
      return null
    }
  }

  function resetPerformanceBaseline() {
    chrome.storage.local.remove(PERFORMANCE_BASELINE_KEY)
  }

  // ========== ÿ��ͳ�������ݾۺ� ==========

  const DAILY_STATS_KEY = 'resourceAcceleratorDailyStats'

  // ���浱��ͳ������
  function saveDailyStats() {
    if (!state.performance) {return}

    const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
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
    }

    chrome.storage.local.get(DAILY_STATS_KEY).then((result) => {
      const allDaily = result[DAILY_STATS_KEY] || {}
      allDaily[today] = dailyData

      // �������30������
      const keys = Object.keys(allDaily).sort().slice(-30)
      const trimmed = {}
      keys.forEach((k) => {
        trimmed[k] = allDaily[k]
      })

      chrome.storage.local.set({ [DAILY_STATS_KEY]: trimmed })
    })
  }

  // �ۺϽ� N ��ͳ������
  async function aggregateDailyStats(days = 7) {
    try {
      const result = await chrome.storage.local.get(DAILY_STATS_KEY)
      const allDaily = result[DAILY_STATS_KEY] || {}

      const today = new Date()
      const stats = []

      for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const dateStr = d.toISOString().split('T')[0]
        const dayData = allDaily[dateStr]

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
          totalReplaced:
            (dayData?.replacedJs || 0) +
            (dayData?.replacedCss || 0) +
            (dayData?.replacedFonts || 0) +
            (dayData?.imagesCompressed || 0),
        })
      }

      return stats
    } catch {
      return []
    }
  }

  // ��ȡ�滻���ͷֲ�
  function getStatsDistribution() {
    return {
      js: state.stats.jsReplaced || 0,
      css: state.stats.cssReplaced || 0,
      fonts: state.stats.fontsReplaced || 0,
      images: state.stats.imagesCompressed || 0,
      svg: state.stats.svgOptimized || 0,
    }
  }

  // ========== ���� API ==========

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
      _observer.disconnect()
      _perfMonitor?.destroy()
      _priorityOptimizer?.destroy?.()
      _memoryOptimizer?.destroy?.()
      _adaptiveCompressor?.destroy()
      _smartPreloadV2?.destroy()
      _destroyLazyLoadObserver()
      _terminateCompressorWorkers()
      // ��������仯����
      if (_networkChangeListener && navigator.connection) {
        navigator.connection.removeEventListener('change', _networkChangeListener)
      }
      state.compressQueue = []
      state._compressCacheSize = 0
      state.recentReplacements = []
      state.dedupSet.clear()
      state._compressCache.clear()
      state._svgCache.clear()
      _logBuffer = []
      document.createElement = _createElement
      Element.prototype.appendChild = _appendChild
      Element.prototype.insertBefore = _insertBefore
      console.log(`${LOG_PREFIX} ������`)
    },
  }

  // ������ʼ����ͬ����
  init()
})()

