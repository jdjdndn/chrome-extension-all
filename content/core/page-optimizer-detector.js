/**
 * 页面优化检测器 (PageOptimizationDetector)
 *
 * 检测页面是否已经使用了优化手段，避免重复优化导致冲突。
 * 支持检测：CDN、懒加载、预加载、字体优化、CSS优化、Service Worker缓存。
 *
 * 设计原则：
 * - 检测在 init() 中执行（不在 constructor 中）
 * - try/catch 支持降级策略：检测失败时返回全部优化启用
 * - 检测结果带置信度分数（0-1），>0.5 判定为已优化
 * - 目标准确率 >90%
 * - 检测耗时 <50ms
 * - 误判率 <5%
 */

(function () {
  'use strict'

  if (window.PageOptimizationDetector) {
    console.log('[PageOptimizationDetector] 已存在，跳过初始化')
    return
  }

  const LOG_PREFIX = '[PageOptimizationDetector]'

  /**
   * 已知 CDN 域名特征（用于高置信度判定）
   */
  const CDN_DOMAINS = [
    // 国内 CDN
    'cdn.bootcdn.net',
    'cdn.baomitu.com',
    'cdn.staticfile.org',
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com',
    'unpkg.com',
    'lf-cdn-tos.bytecdntp.com',
    'lf26-cdn-tos.bytecdntp.com',
    'lf3-cdn-tos.bytecdntp.com',
    'lf6-cdn-tos.bytecdntp.com',
    'lf9-cdn-tos.bytecdntp.com',
    // 字体 CDN
    'fonts.googleapis.com',
    'fonts.font.im',
    'fonts.loli.net',
  ]

  /**
   * CDN 路径特征（低置信度但可辅助判定）
   */
  const CDN_PATH_PATTERNS = [
    /\/ajax\/libs\//i,
    /\/npm\/[^/]+@/i,
    /\/cdnjs\//i,
    /\/dist\//i,
    /\/build\//i,
  ]

  /**
   * 已知懒加载库/框架特征
   */
  const LAZY_LOAD_INDICATORS = {
    // 属性特征
    attributes: [
      'data-src',
      'data-original',
      'data-lazy-src',
      'data-lazyload',
      'data-defer-src',
      'data-echo',
      'data-source',
    ],
    // class 特征
    classes: ['lazyload', 'lazy-load', 'lazy', 'lozad', 'lazyloaded', 'lazy-image'],
    // 事件特征
    events: ['lazybeforeunload', 'lazyloaded'],
  }

  /**
   * 已知预加载库/框架特征
   */
  const PRELOAD_INDICATORS = {
    // link rel 类型
    relTypes: ['preload', 'prefetch', 'preconnect', 'dns-prefetch', 'modulepreload'],
    // 属性特征
    attributes: ['data-preload', 'data-prefetch'],
  }

  /**
   * 已知字体优化特征
   */
  const FONT_OPT_INDICATORS = {
    // 字体 CDN 域名
    fontCDNs: [
      'fonts.googleapis.com',
      'fonts.font.im',
      'fonts.loli.net',
      'cdn.bootcdn.net', // font-awesome 等
    ],
    // 字体优化属性
    fontDisplayValues: ['swap', 'fallback', 'optional'],
    // 字体优化库特征
    fontLibraries: ['font-display', 'fontfaceobserver', 'webfontloader', 'font-spider'],
  }

  /**
   * CSS 优化检测特征
   */
  const CSS_OPT_INDICATORS = {
    // CSS 压缩特征（minified CSS）
    minifiedPatterns: [
      /;\}/g, // 压缩后缺少空格
      /\{[^ ]/g, // 左括号后无空格
      /:[^ ]/g, // 冒号后无空格
      /\n\s*\n/g, // 连续空行（反向特征）
    ],
    // CSS CDN 域名
    cssCDNs: [
      'cdn.bootcdn.net',
      'cdn.baomitu.com',
      'cdn.staticfile.org',
      'cdn.jsdelivr.net',
      'cdnjs.cloudflare.com',
      'unpkg.com',
    ],
    // CSS 框架特征
    cssFrameworks: ['tailwindcss', 'bootstrap', 'bulma', 'foundation', 'materialize'],
    // CSS 变量特征（现代 CSS 框架标志）
    cssVariablePattern: /--[\w-]+\s*:/,
  }

  /**
   * Service Worker 缓存检测特征
   */
  const SW_CACHE_INDICATORS = {
    // SW 注册脚本特征
    swScripts: [
      'sw.js',
      'service-worker.js',
      'serviceWorker.js',
      'sw-register.js',
      'workbox',
      'precache',
    ],
    // Cache API 使用特征
    cachePatterns: ['caches.open', 'caches.match', 'cache.put', 'cache.add', 'cache.addAll'],
    // 预缓存特征
    precachePatterns: ['precache', 'precacheAndRoute', ' precache('],
  }

  /**
   * 检测结果类型
   */
  const DetectionType = {
    CDN: 'cdn',
    LAZY_LOAD: 'lazyLoad',
    PRELOAD: 'preload',
    FONT_OPT: 'fontOpt',
    CSS_OPT: 'cssOpt', // CSS优化检测
    SW_CACHE: 'swCache', // Service Worker缓存检测
  }

  /**
   * PageOptimizationDetector 主类
   *
   * 支持检测结果缓存机制：
   * - 按页面URL（hostname + pathname）缓存检测结果
   * - 缓存过期时间：5分钟（页面可能动态变化）
   * - 缓存命中时跳过DOM扫描，减少重复检测开销
   * - 支持手动清除缓存和查询缓存统计
   */
  class PageOptimizationDetector {
    // ========== 静态缓存（跨实例共享）==========
    // 按页面URL缓存检测结果，避免同页面重复检测
    static _cache = {}
    // 缓存统计
    static _cacheStats = {
      hits: 0, // 缓存命中次数
      misses: 0, // 缓存未命中次数（首次检测）
      expired: 0, // 缓存过期后重新检测次数
      total: 0, // 总检测次数
    }
    // 缓存过期时间：5分钟（页面可能动态变化）
    static CACHE_TTL = 5 * 60 * 1000

    /**
     * 生成缓存键：基于 hostname + pathname
     * @returns {string|null}
     */
    static _generateCacheKey() {
      try {
        return window.location.hostname + window.location.pathname
      } catch {
        return null
      }
    }

    /**
     * 获取缓存命中率统计（静态方法）
     * @returns {{ hits: number, misses: number, expired: number, total: number, hitRate: string, cacheSize: number }}
     */
    static getCacheStats() {
      const stats = PageOptimizationDetector._cacheStats
      const totalRequests = stats.hits + stats.misses
      return {
        hits: stats.hits,
        misses: stats.misses,
        expired: stats.expired,
        total: stats.total,
        hitRate: totalRequests > 0 ? (stats.hits / totalRequests).toFixed(2) : '0.00',
        cacheSize: Object.keys(PageOptimizationDetector._cache).length,
      }
    }

    /**
     * 手动清除检测结果缓存（静态方法）
     */
    static clearCache() {
      PageOptimizationDetector._cache = {}
      PageOptimizationDetector._cacheStats = { hits: 0, misses: 0, expired: 0, total: 0 }
      console.log(LOG_PREFIX + ' 检测缓存已清除')
    }

    constructor() {
      // 检测结果
      this.results = {
        [DetectionType.CDN]: { detected: false, confidence: 0, details: [] },
        [DetectionType.LAZY_LOAD]: { detected: false, confidence: 0, details: [] },
        [DetectionType.PRELOAD]: { detected: false, confidence: 0, details: [] },
        [DetectionType.FONT_OPT]: { detected: false, confidence: 0, details: [] },
        [DetectionType.CSS_OPT]: { detected: false, confidence: 0, details: [] },
        [DetectionType.SW_CACHE]: { detected: false, confidence: 0, details: [] },
      }

      // 检测状态
      this.isInitialized = false
      this.detectionTime = 0

      // 置信度阈值（>0.5 判定为已优化）
      this.confidenceThreshold = 0.5

      // 检测是否失败（用于降级策略）
      this._detectionFailed = false

      // 缓存键（标记当前实例对应的缓存条目）
      this._cacheKey = null
      // 本次检测是否从缓存命中
      this._cacheHit = false
    }

    /**
     * 初始化并执行检测
     * 注意：检测在 init() 中执行，不在 constructor 中
     * 支持缓存：同页面（hostname + pathname）5分钟内复用检测结果
     */
    init() {
      if (this.isInitialized) {
        console.log(`${LOG_PREFIX} 已初始化，跳过`)
        return this.results
      }

      // 生成缓存键
      this._cacheKey = PageOptimizationDetector._generateCacheKey()

      // 检查缓存是否存在且未过期
      if (this._cacheKey) {
        const cached = PageOptimizationDetector._cache[this._cacheKey]
        if (cached) {
          const now = Date.now()
          if (now - cached.timestamp < PageOptimizationDetector.CACHE_TTL) {
            // 缓存命中：直接复用检测结果，跳过DOM扫描
            PageOptimizationDetector._cacheStats.hits++
            this.results = JSON.parse(JSON.stringify(cached.results))
            this._detectionFailed = cached.detectionFailed
            this.isInitialized = true
            this._cacheHit = true
            this.detectionTime = 0 // 缓存命中无需检测时间
            console.log(`${LOG_PREFIX} 缓存命中，跳过检测 [${this._cacheKey}]`)
            return this.results
          }
          // 缓存过期：删除过期条目，执行完整检测
          PageOptimizationDetector._cacheStats.expired++
          delete PageOptimizationDetector._cache[this._cacheKey]
          console.log(`${LOG_PREFIX} 缓存过期，重新检测 [${this._cacheKey}]`)
        }
      }

      // 缓存未命中：执行完整检测
      PageOptimizationDetector._cacheStats.misses++
      PageOptimizationDetector._cacheStats.total++

      const startTime = performance.now()

      try {
        this._detectCDN()
        this._detectLazyLoad()
        this._detectPreload()
        this._detectFontOpt()
        this._detectCSSOpt()
        this._detectSWCache()

        this.isInitialized = true
        this.detectionTime = performance.now() - startTime

        // 写入缓存（深拷贝避免引用污染）
        if (this._cacheKey) {
          PageOptimizationDetector._cache[this._cacheKey] = {
            results: JSON.parse(JSON.stringify(this.results)),
            detectionFailed: this._detectionFailed,
            timestamp: Date.now(),
          }
          console.log(`${LOG_PREFIX} 检测结果已缓存 [${this._cacheKey}]`)
        }

        console.log(`${LOG_PREFIX} 检测完成`, this._getSummary())
        return this.results
      } catch (error) {
        console.error(`${LOG_PREFIX} 检测异常，启用降级策略:`, error.message)
        this._applyFallbackStrategy()
        this.isInitialized = true
        this.detectionTime = performance.now() - startTime

        // 降级结果也写入缓存（避免同页面重复触发异常检测）
        if (this._cacheKey) {
          PageOptimizationDetector._cache[this._cacheKey] = {
            results: JSON.parse(JSON.stringify(this.results)),
            detectionFailed: this._detectionFailed,
            timestamp: Date.now(),
          }
        }

        return this.results
      }
    }

    /**
     * 检测 CDN 使用情况
     *
     * 检测策略：
     * 1. 检查 script/link 标签的 src/href 是否匹配已知 CDN 域名（中置信度 +0.35）
     * 2. 检查 URL 路径是否匹配 CDN 路径特征（低置信度 +0.2）
     * 3. 检查页面 meta/link 标签中是否声明了 CDN preconnect（低置信度 +0.15）
     * 4. 多证据加权：增加证据多样性，避免单一证据主导
     */
    _detectCDN() {
      const evidence = []
      let confidence = 0
      const evidenceCount = { high: 0, medium: 0, low: 0 }

      // 收集所有外部资源 URL
      const resourceUrls = this._getResourceUrls()

      // 1. 检查已知 CDN 域名匹配（中置信度）
      for (const url of resourceUrls) {
        const matchedDomain = CDN_DOMAINS.find((domain) => url.toLowerCase().includes(domain))
        if (matchedDomain) {
          evidenceCount.medium++
          evidence.push(`CDN域名匹配: ${matchedDomain} (${url})`)
          break
        }
      }

      // 2. 检查 CDN 路径特征（低置信度）
      for (const url of resourceUrls) {
        const matchedPattern = CDN_PATH_PATTERNS.find((pattern) => pattern.test(url))
        if (matchedPattern) {
          evidenceCount.low++
          evidence.push(`CDN路径匹配: ${matchedPattern.source} (${url})`)
          break
        }
      }

      // 3. 检查 preconnect/dns-prefetch 到 CDN 域名（低置信度）
      const preconnectLinks = document.querySelectorAll(
        'link[rel="preconnect"], link[rel="dns-prefetch"]'
      )
      const maxPreconnectToCheck = 20 // 限制检查数量
      for (let i = 0; i < Math.min(preconnectLinks.length, maxPreconnectToCheck); i++) {
        const href = preconnectLinks[i].href || ''
        const matchedDomain = CDN_DOMAINS.find((domain) => href.toLowerCase().includes(domain))
        if (matchedDomain) {
          evidenceCount.low++
          evidence.push(`CDN preconnect: ${matchedDomain}`)
          break
        }
      }

      // 4. 基于证据多样性计算置信度
      // 多证据加权：避免单一证据过度影响
      const evidenceScore =
        evidenceCount.high * 0.4 + evidenceCount.medium * 0.35 + evidenceCount.low * 0.2
      confidence = Math.min(evidenceScore, 1.0)

      // 至少有一个证据才判定为已优化
      if (evidence.length === 0) {
        confidence = 0
      }

      this.results[DetectionType.CDN] = {
        detected: confidence >= this.confidenceThreshold,
        confidence,
        details: evidence,
      }
    }

    /**
     * 检测懒加载使用情况
     *
     * 检测策略：
     * 1. 检查 img/video 标签是否使用 data-src 等懒加载属性（中置信度 +0.35）
     * 2. 检查元素 class 是否包含懒加载特征类名（低置信度 +0.2）
     * 3. 检查是否使用原生 lazy 属性（中置信度 +0.3）
     * 4. 检查是否有懒加载库脚本（低置信度 +0.15）
     * 5. 多证据加权：增加证据多样性，避免单一证据主导
     */
    _detectLazyLoad() {
      const evidence = []
      let confidence = 0
      const evidenceCount = { high: 0, medium: 0, low: 0 }

      // 1. 检查 data-src 等懒加载属性（中置信度）
      for (const attr of LAZY_LOAD_INDICATORS.attributes) {
        const elements = document.querySelectorAll(`[${attr}]`)
        if (elements.length > 0) {
          evidenceCount.medium++
          evidence.push(`懒加载属性: ${attr} (${elements.length}个元素)`)
          break
        }
      }

      // 2. 检查懒加载 class（低置信度）
      for (const className of LAZY_LOAD_INDICATORS.classes) {
        const elements = document.querySelectorAll(`.${className}`)
        if (elements.length > 0) {
          evidenceCount.low++
          evidence.push(`懒加载class: .${className} (${elements.length}个元素)`)
          break
        }
      }

      // 3. 检查 loading="lazy" 属性（原生懒加载，中置信度）
      const lazyElements = document.querySelectorAll(
        'img[loading="lazy"], iframe[loading="lazy"], video[loading="lazy"]'
      )
      if (lazyElements.length > 0) {
        evidenceCount.medium++
        evidence.push(`原生lazy属性: ${lazyElements.length}个元素`)
      }

      // 4. 检查懒加载库脚本（低置信度）
      const scripts = document.querySelectorAll('script[src]')
      const maxScriptsToCheck = 50 // 限制检查数量
      for (let i = 0; i < Math.min(scripts.length, maxScriptsToCheck); i++) {
        const src = (scripts[i].src || '').toLowerCase()
        if (
          src.includes('lozad') ||
          src.includes('lazysizes') ||
          src.includes('vanilla-lazyload') ||
          src.includes('intersection-observer')
        ) {
          evidenceCount.low++
          evidence.push(`懒加载库: ${src}`)
          break
        }
      }

      // 5. 基于证据多样性计算置信度
      // 多证据加权：避免单一证据过度影响
      const evidenceScore =
        evidenceCount.high * 0.4 + evidenceCount.medium * 0.3 + evidenceCount.low * 0.2
      confidence = Math.min(evidenceScore, 1.0)

      // 至少有一个证据才判定为已优化
      if (evidence.length === 0) {
        confidence = 0
      }

      this.results[DetectionType.LAZY_LOAD] = {
        detected: confidence >= this.confidenceThreshold,
        confidence,
        details: evidence,
      }
    }

    /**
     * 检测预加载使用情况
     *
     * 检测策略：
     * 1. 检查 link[rel="preload/prefetch/preconnect"] 数量（中置信度 +0.3）
     * 2. 检查是否有 modulepreload（低置信度 +0.2）
     * 3. 检查 Service Worker 预加载逻辑（低置信度 +0.15）
     * 4. 多证据加权：增加证据多样性，避免单一证据主导
     */
    _detectPreload() {
      const evidence = []
      let confidence = 0
      const evidenceCount = { high: 0, medium: 0, low: 0 }

      // 1. 检查 preload/prefetch/preconnect 标签（中置信度）
      let preloadCount = 0
      let prefetchCount = 0
      let preconnectCount = 0
      let modulepreloadCount = 0

      for (const relType of PRELOAD_INDICATORS.relTypes) {
        const links = document.querySelectorAll(`link[rel="${relType}"]`)
        switch (relType) {
          case 'preload':
            preloadCount = links.length
            break
          case 'prefetch':
            prefetchCount = links.length
            break
          case 'preconnect':
            preconnectCount = links.length
            break
          case 'modulepreload':
            modulepreloadCount = links.length
            break
        }
      }

      // preload 数量越多，置信度越高
      if (preloadCount >= 3) {
        evidenceCount.medium++
        evidence.push(`preload标签: ${preloadCount}个`)
      } else if (preloadCount >= 1) {
        evidenceCount.low++
        evidence.push(`preload标签: ${preloadCount}个(少量)`)
      }

      // prefetch 数量
      if (prefetchCount >= 2) {
        evidenceCount.low++
        evidence.push(`prefetch标签: ${prefetchCount}个`)
      }

      // preconnect 数量
      if (preconnectCount >= 2) {
        evidenceCount.low++
        evidence.push(`preconnect标签: ${preconnectCount}个`)
      }

      // 2. 检查 modulepreload（低置信度）
      if (modulepreloadCount > 0) {
        evidenceCount.low++
        evidence.push(`modulepreload标签: ${modulepreloadCount}个`)
      }

      // 3. 基于证据多样性计算置信度
      // 多证据加权：避免单一证据过度影响
      const evidenceScore =
        evidenceCount.high * 0.4 + evidenceCount.medium * 0.3 + evidenceCount.low * 0.2
      confidence = Math.min(evidenceScore, 1.0)

      // 至少有一个证据才判定为已优化
      if (evidence.length === 0) {
        confidence = 0
      }

      this.results[DetectionType.PRELOAD] = {
        detected: confidence >= this.confidenceThreshold,
        confidence,
        details: evidence,
      }
    }

    /**
     * 检测字体优化使用情况
     *
     * 检测策略：
     * 1. 检查 link[rel="stylesheet"] 是否加载字体 CDN（中置信度 +0.3）
     * 2. 检查 @font-face 声明中的 font-display 属性（中置信度 +0.3）
     * 3. 检查字体优化库脚本（低置信度 +0.2）
     * 4. 检查 CSS 变量中是否有字体预加载标记（低置信度 +0.15）
     * 5. 多证据加权：增加证据多样性，避免单一证据主导
     */
    _detectFontOpt() {
      const evidence = []
      let confidence = 0
      const evidenceCount = { high: 0, medium: 0, low: 0 }

      // 1. 检查字体 CDN 链接（中置信度）
      const linkElements = document.querySelectorAll('link[rel="stylesheet"]')
      for (const link of linkElements) {
        const href = (link.href || '').toLowerCase()
        const isFontCDN = FONT_OPT_INDICATORS.fontCDNs.some((cdn) => href.includes(cdn))
        if (isFontCDN) {
          evidenceCount.medium++
          evidence.push(`字体CDN链接: ${link.href}`)
          break
        }
      }

      // 2. 检查 style 标签中的 font-display（中置信度）
      const styleElements = document.querySelectorAll('style')
      const maxStylesToCheck = 30 // 限制检查数量
      for (let i = 0; i < Math.min(styleElements.length, maxStylesToCheck); i++) {
        const content = styleElements[i].textContent || ''
        const hasFontDisplay = FONT_OPT_INDICATORS.fontDisplayValues.some(
          (val) =>
            content.includes(`font-display:${val}`) || content.includes(`font-display: ${val}`)
        )
        if (hasFontDisplay) {
          evidenceCount.medium++
          evidence.push('font-display属性已设置')
          break
        }
      }

      // 3. 检查字体优化库脚本（低置信度）
      const scripts = document.querySelectorAll('script[src]')
      const maxScriptsToCheck = 50 // 限制检查数量
      for (let i = 0; i < Math.min(scripts.length, maxScriptsToCheck); i++) {
        const src = (scripts[i].src || '').toLowerCase()
        const hasFontLib = FONT_OPT_INDICATORS.fontLibraries.some((lib) => src.includes(lib))
        if (hasFontLib) {
          evidenceCount.low++
          evidence.push(`字体优化库: ${src}`)
          break
        }
      }

      // 4. 检查字体 CSS 文件（低置信度）
      for (const link of linkElements) {
        const href = (link.href || '').toLowerCase()
        if (href.includes('font') && (href.includes('.css') || href.includes('css2'))) {
          evidenceCount.low++
          evidence.push(`字体CSS文件: ${link.href}`)
          break
        }
      }

      // 5. 基于证据多样性计算置信度
      // 多证据加权：避免单一证据过度影响
      const evidenceScore =
        evidenceCount.high * 0.4 + evidenceCount.medium * 0.3 + evidenceCount.low * 0.2
      confidence = Math.min(evidenceScore, 1.0)

      // 至少有一个证据才判定为已优化
      if (evidence.length === 0) {
        confidence = 0
      }

      this.results[DetectionType.FONT_OPT] = {
        detected: confidence >= this.confidenceThreshold,
        confidence,
        details: evidence,
      }
    }

    /**
     * 检测 CSS 优化使用情况
     *
     * 检测策略：
     * 1. 检查 CSS 文件是否经过压缩（中置信度 +0.3）
     * 2. 检查是否使用 CSS CDN（中置信度 +0.3）
     * 3. 检查是否使用现代 CSS 框架（低置信度 +0.2）
     * 4. 检查 CSS 变量使用（低置信度 +0.15）
     * 5. 多证据加权：增加证据多样性，避免单一证据主导
     */
    _detectCSSOpt() {
      const evidence = []
      let confidence = 0
      const evidenceCount = { high: 0, medium: 0, low: 0 }

      // 1. 检查 CSS 压缩特征（中置信度）
      const styleElements = document.querySelectorAll('style')
      let minifiedCount = 0
      const maxStylesToCheck = 50 // 限制检查数量

      for (let i = 0; i < Math.min(styleElements.length, maxStylesToCheck); i++) {
        const content = styleElements[i].textContent || ''
        if (content.length > 100) {
          // 只检查有实质内容的 style
          const hasMinified = CSS_OPT_INDICATORS.minifiedPatterns.some((pattern) =>
            pattern.test(content)
          )
          if (hasMinified) {
            minifiedCount++
          }
        }
      }

      if (minifiedCount > 0) {
        evidenceCount.medium++
        evidence.push(`CSS压缩特征: ${minifiedCount}个style标签`)
      }

      // 2. 检查 CSS CDN 使用（中置信度）
      const linkElements = document.querySelectorAll('link[rel="stylesheet"]')
      let cssCDNCount = 0

      for (const link of linkElements) {
        const href = (link.href || '').toLowerCase()
        const isCSSCDN = CSS_OPT_INDICATORS.cssCDNs.some((cdn) => href.includes(cdn))
        if (isCSSCDN) {
          cssCDNCount++
          if (cssCDNCount === 1) {
            evidence.push(`CSS CDN链接: ${link.href}`)
          }
        }
      }

      if (cssCDNCount >= 2) {
        evidenceCount.medium++
        evidence.push(`CSS CDN数量: ${cssCDNCount}个`)
      } else if (cssCDNCount === 1) {
        evidenceCount.low++
      }

      // 3. 检查 CSS 框架使用（低置信度）
      const allLinks = document.querySelectorAll('link[href], script[src]')
      let frameworkDetected = false
      const maxLinksToCheck = 100 // 限制检查数量

      for (let i = 0; i < Math.min(allLinks.length, maxLinksToCheck); i++) {
        const el = allLinks[i]
        const src = (el.href || el.src || '').toLowerCase()
        const isFramework = CSS_OPT_INDICATORS.cssFrameworks.some((fw) => src.includes(fw))
        if (isFramework) {
          frameworkDetected = true
          evidence.push(`CSS框架: ${src}`)
          break
        }
      }

      if (frameworkDetected) {
        evidenceCount.low++
      }

      // 4. 检查 CSS 变量使用（低置信度）
      let hasCSSVariables = false
      const maxStylesForVarCheck = 30 // 限制检查数量
      for (let i = 0; i < Math.min(styleElements.length, maxStylesForVarCheck); i++) {
        const content = styleElements[i].textContent || ''
        if (CSS_OPT_INDICATORS.cssVariablePattern.test(content)) {
          hasCSSVariables = true
          evidence.push('CSS变量已使用')
          break
        }
      }

      if (hasCSSVariables) {
        evidenceCount.low++
      }

      // 5. 基于证据多样性计算置信度
      // 多证据加权：避免单一证据过度影响
      const evidenceScore =
        evidenceCount.high * 0.4 + evidenceCount.medium * 0.3 + evidenceCount.low * 0.2
      confidence = Math.min(evidenceScore, 1.0)

      // 至少有一个证据才判定为已优化
      if (evidence.length === 0) {
        confidence = 0
      }

      this.results[DetectionType.CSS_OPT] = {
        detected: confidence >= this.confidenceThreshold,
        confidence,
        details: evidence,
      }
    }

    /**
     * 检测 Service Worker 缓存使用情况
     *
     * 检测策略：
     * 1. 检查 Service Worker 是否注册（中置信度 +0.35）
     * 2. 检查是否有 SW 注册脚本（低置信度 +0.2）
     * 3. 检查 Cache API 使用（中置信度 +0.3）
     * 4. 检查 Workbox 预缓存（低置信度 +0.2）
     * 5. 多证据加权：增加证据多样性，避免单一证据主导
     */
    _detectSWCache() {
      const evidence = []
      let confidence = 0
      const evidenceCount = { high: 0, medium: 0, low: 0 }

      // 1. 检查 Service Worker 注册状态（中置信度）
      if ('serviceWorker' in navigator) {
        // 检查是否有激活的 SW
        if (navigator.serviceWorker?.controller) {
          evidenceCount.medium++
          evidence.push('Service Worker 已激活')
        }
      }

      // 2. 检查 SW 注册脚本（低置信度）
      const scripts = document.querySelectorAll('script[src]')
      let swScriptFound = false
      const maxScriptsToCheck = 50 // 限制检查数量

      for (let i = 0; i < Math.min(scripts.length, maxScriptsToCheck); i++) {
        const src = (scripts[i].src || '').toLowerCase()
        const isSWScript = SW_CACHE_INDICATORS.swScripts.some((sw) => src.includes(sw))
        if (isSWScript) {
          swScriptFound = true
          evidence.push(`SW注册脚本: ${src}`)
          break
        }
      }

      if (swScriptFound) {
        evidenceCount.low++
      }

      // 3. 检查内联脚本中的 Cache API 使用（中置信度）
      const inlineScripts = document.querySelectorAll('script:not([src])')
      let cacheAPIUsed = false
      const maxInlineToCheck = 30 // 限制检查数量

      for (let i = 0; i < Math.min(inlineScripts.length, maxInlineToCheck); i++) {
        const content = inlineScripts[i].textContent || ''
        const hasCacheAPI = SW_CACHE_INDICATORS.cachePatterns.some((pattern) =>
          content.includes(pattern)
        )
        if (hasCacheAPI) {
          cacheAPIUsed = true
          evidence.push('Cache API 已使用')
          break
        }
      }

      if (cacheAPIUsed) {
        evidenceCount.medium++
      }

      // 4. 检查 Workbox 预缓存特征（低置信度）
      let workboxDetected = false
      for (let i = 0; i < Math.min(inlineScripts.length, maxInlineToCheck); i++) {
        const content = inlineScripts[i].textContent || ''
        const hasWorkbox = SW_CACHE_INDICATORS.precachePatterns.some((pattern) =>
          content.includes(pattern)
        )
        if (hasWorkbox) {
          workboxDetected = true
          evidence.push('Workbox预缓存已使用')
          break
        }
      }

      if (workboxDetected) {
        evidenceCount.low++
      }

      // 5. 基于证据多样性计算置信度
      // 多证据加权：避免单一证据过度影响
      const evidenceScore =
        evidenceCount.high * 0.4 + evidenceCount.medium * 0.3 + evidenceCount.low * 0.2
      confidence = Math.min(evidenceScore, 1.0)

      // 至少有一个证据才判定为已优化
      if (evidence.length === 0) {
        confidence = 0
      }

      this.results[DetectionType.SW_CACHE] = {
        detected: confidence >= this.confidenceThreshold,
        confidence,
        details: evidence,
      }
    }

    /**
     * 获取页面所有外部资源 URL
     * 优化：限制查询范围，避免全页面扫描
     */
    _getResourceUrls() {
      const urls = []
      const maxElements = 200 // 限制最大查询数量

      // script 标签（限制数量）
      const scripts = document.querySelectorAll('script[src]')
      for (let i = 0; i < Math.min(scripts.length, maxElements); i++) {
        const s = scripts[i]
        if (s.src && !s.src.startsWith('data:') && !s.src.startsWith('blob:')) {
          urls.push(s.src)
        }
      }

      // link 标签（限制数量）
      const links = document.querySelectorAll('link[href]')
      for (let i = 0; i < Math.min(links.length, maxElements); i++) {
        const l = links[i]
        if (l.href && !l.href.startsWith('data:') && !l.href.startsWith('blob:')) {
          urls.push(l.href)
        }
      }

      // img 标签（限制数量）
      const imgs = document.querySelectorAll('img[src]')
      for (let i = 0; i < Math.min(imgs.length, maxElements); i++) {
        const img = imgs[i]
        if (img.src && !img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
          urls.push(img.src)
        }
      }

      return urls
    }

    /**
     * 降级策略：检测失败时启用全部优化
     */
    _applyFallbackStrategy() {
      this._detectionFailed = true

      // 将所有检测结果设为"未检测到"，触发全部优化
      Object.keys(this.results).forEach((type) => {
        this.results[type] = {
          detected: false,
          confidence: 0,
          details: ['检测失败，降级为全部优化'],
          fallback: true,
        }
      })

      console.log(`${LOG_PREFIX} 降级策略已启用：将执行全部优化`)
    }

    /**
     * 获取检测摘要
     */
    _getSummary() {
      return {
        cdn: this.results[DetectionType.CDN].detected,
        lazyLoad: this.results[DetectionType.LAZY_LOAD].detected,
        preload: this.results[DetectionType.PRELOAD].detected,
        fontOpt: this.results[DetectionType.FONT_OPT].detected,
        cssOpt: this.results[DetectionType.CSS_OPT].detected,
        swCache: this.results[DetectionType.SW_CACHE].detected,
        detectionTime: `${this.detectionTime.toFixed(1)}ms`,
      }
    }

    /**
     * 获取指定类型的检测结果
     * @param {string} type - DetectionType 枚举值
     * @returns {{ detected: boolean, confidence: number, details: string[] }}
     */
    getResult(type) {
      return this.results[type] || { detected: false, confidence: 0, details: [] }
    }

    /**
     * 获取全部检测结果
     * @returns {{ cdn: object, lazyLoad: object, preload: object, fontOpt: object }}
     */
    getResults() {
      return { ...this.results }
    }

    /**
     * 判断指定优化是否应该执行
     * @param {string} type - DetectionType 枚举值
     * @returns {boolean} true=应该执行优化，false=页面已有优化
     */
    shouldOptimize(type) {
      const result = this.results[type]
      if (!result) {
        return true
      }
      // 检测失败时始终返回 true（降级策略）
      if (this._detectionFailed) {
        return true
      }
      return !result.detected
    }

    /**
     * 获取所有需要执行的优化类型
     * @returns {string[]}
     */
    getOptimizationsToRun() {
      return Object.values(DetectionType).filter((type) => this.shouldOptimize(type))
    }

    /**
     * 获取检测统计（含缓存统计）
     */
    getStats() {
      const summary = this._getSummary()
      return {
        initialized: this.isInitialized,
        detectionFailed: this._detectionFailed,
        detectionTime: this.detectionTime,
        results: summary,
        optimizationsToRun: this.getOptimizationsToRun(),
        // 缓存统计
        cache: PageOptimizationDetector.getCacheStats(),
      }
    }
  }

  /**
   * OptimizationSkipper - 优化跳过决策器
   *
   * 根据 PageOptimizationDetector 的检测结果决定跳过哪些优化。
   * 使用空对象模式避免空指针错误。
   *
   * 设计原则：
   * - 检测失败时不跳过任何优化（降级策略）
   * - 支持自定义跳过规则和阈值
   * - 记录跳过的优化统计
   */
  class OptimizationSkipper {
    /**
     * @param {PageOptimizationDetector} detector - 页面优化检测器实例
     * @param {object} config - 跳过规则配置
     */
    constructor(detector, config = {}) {
      this.detector = detector
      this.config = {
        cdnSkipThreshold: 0.6, // CDN替换跳过阈值
        lazyLoadSkipThreshold: 0.7, // 懒加载跳过阈值
        preloadSkipCount: 3, // 预加载跳过数量阈值
        fontOptSkipThreshold: 0.5, // 字体优化跳过阈值
        cssOptSkipThreshold: 0.6, // CSS优化跳过阈值
        swCacheSkipThreshold: 0.5, // SW缓存跳过阈值
        ...config,
      }

      // 跳过统计
      this.skipStats = {
        jsReplace: { skipped: false, reason: '' },
        fontReplace: { skipped: false, reason: '' },
        cssReplace: { skipped: false, reason: '' },
        imageLazyLoad: { skipped: false, reason: '' },
        preload: { skipped: false, reason: '' },
        cssOpt: { skipped: false, reason: '' },
        swCache: { skipped: false, reason: '' },
      }

      // 空对象模式：用于替换被跳过的模块
      this.noopModule = {
        process: () => {},
        processLink: () => {},
        processScript: () => {},
        init: () => Promise.resolve(),
        destroy: () => {},
        enable: () => {},
        disable: () => {},
        getStats: () => ({
          total: 0,
          replaced: 0,
          skipped: 0,
          errors: 0,
          details: [],
          enabled: false,
          skippedByDetector: true,
        }),
        enabled: false,
        _processedLinks: { has: () => true, add: () => {} },
        _processedScripts: { has: () => true, add: () => {} },
        stats: { total: 0, replaced: 0, skipped: 0, errors: 0, details: [] },
      }
    }

    /**
     * 根据检测结果决定是否应该执行指定优化
     * @param {string} optimizationType - 优化类型
     * @returns {boolean} true=应该跳过, false=应该执行
     */
    shouldSkip(optimizationType) {
      try {
        const detectorResults = this.detector.getResults()
        const detectionFailed = this.detector._detectionFailed

        // 检测失败时不跳过（降级策略）
        if (detectionFailed) {
          this._recordSkip(optimizationType, false, '检测失败，不跳过')
          return false
        }

        let shouldSkip = false
        let reason = ''

        switch (optimizationType) {
          case 'jsReplace':
          case 'cssReplace': {
            // CDN替换：如果页面已使用优质CDN，跳过
            const cdnResult = detectorResults[DetectionType.CDN]
            if (cdnResult?.detected && cdnResult.confidence >= this.config.cdnSkipThreshold) {
              shouldSkip = true
              reason = `页面已使用CDN (置信度: ${cdnResult.confidence.toFixed(2)})`
            }
            break
          }

          case 'fontReplace': {
            // 字体替换：如果页面已优化字体，跳过
            const fontResult = detectorResults[DetectionType.FONT_OPT]
            if (fontResult?.detected && fontResult.confidence >= this.config.fontOptSkipThreshold) {
              shouldSkip = true
              reason = `页面已优化字体 (置信度: ${fontResult.confidence.toFixed(2)})`
            }
            break
          }

          case 'imageLazyLoad': {
            // 图片懒加载：如果页面已有懒加载，跳过
            const lazyResult = detectorResults[DetectionType.LAZY_LOAD]
            if (
              lazyResult?.detected &&
              lazyResult.confidence >= this.config.lazyLoadSkipThreshold
            ) {
              shouldSkip = true
              reason = `页面已有懒加载 (置信度: ${lazyResult.confidence.toFixed(2)})`
            }
            break
          }

          case 'preload': {
            // 预加载：如果页面已有足够预加载，跳过
            const preloadResult = detectorResults[DetectionType.PRELOAD]
            if (preloadResult?.detected) {
              shouldSkip = true
              reason = `页面已有预加载 (置信度: ${preloadResult.confidence.toFixed(2)})`
            }
            break
          }

          case 'cssOpt': {
            // CSS优化：如果页面已有CSS优化，跳过
            const cssOptResult = detectorResults[DetectionType.CSS_OPT]
            if (
              cssOptResult?.detected &&
              cssOptResult.confidence >= this.config.cssOptSkipThreshold
            ) {
              shouldSkip = true
              reason = `页面已有CSS优化 (置信度: ${cssOptResult.confidence.toFixed(2)})`
            }
            break
          }

          case 'swCache': {
            // SW缓存：如果页面已有SW缓存，跳过
            const swCacheResult = detectorResults[DetectionType.SW_CACHE]
            if (
              swCacheResult?.detected &&
              swCacheResult.confidence >= this.config.swCacheSkipThreshold
            ) {
              shouldSkip = true
              reason = `页面已有SW缓存 (置信度: ${swCacheResult.confidence.toFixed(2)})`
            }
            break
          }

          default:
            shouldSkip = false
            reason = '未知优化类型'
        }

        this._recordSkip(optimizationType, shouldSkip, reason)
        return shouldSkip
      } catch (error) {
        // 降级：检测异常时不跳过
        console.warn(
          `${LOG_PREFIX} [OptimizationSkipper] 判断异常，不跳过 ${optimizationType}:`,
          error
        )
        this._recordSkip(optimizationType, false, `检测异常: ${error.message}`)
        return false
      }
    }

    /**
     * 记录跳过决策
     */
    _recordSkip(type, skipped, reason) {
      if (this.skipStats[type]) {
        this.skipStats[type] = { skipped, reason }
      }
    }

    /**
     * 获取被跳过的模块的空对象
     * @returns {object} 空操作模块
     */
    getNoopModule() {
      return this.noopModule
    }

    /**
     * 获取跳过统计
     */
    getSkipStats() {
      return { ...this.skipStats }
    }

    /**
     * 获取被跳过的优化类型列表
     * @returns {string[]}
     */
    getSkippedOptimizations() {
      return Object.entries(this.skipStats)
        .filter(([, stat]) => stat.skipped)
        .map(([type]) => type)
    }

    /**
     * 获取被执行的优化类型列表
     * @returns {string[]}
     */
    getActiveOptimizations() {
      return Object.entries(this.skipStats)
        .filter(([, stat]) => !stat.skipped)
        .map(([type]) => type)
    }
  }

  // 导出
  window.PageOptimizationDetector = PageOptimizationDetector
  window.PageOptimizationDetector.DetectionType = DetectionType
  window.OptimizationSkipper = OptimizationSkipper

  console.log(`${LOG_PREFIX} 模块已加载`)
})()
