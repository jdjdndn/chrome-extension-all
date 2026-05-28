/**
 * CSS 优化器模块
 * 功能：
 * 1. 关键CSS提取和内联
 * 2. 非关键CSS延迟加载
 * 3. 媒体查询拆分和按需加载
 * 4. CSS压缩和去重
 * 5. 避免FOIT/FOUC
 * 6. 字体加载优化
 */

(function () {
  'use strict'

  const LOG_PREFIX = '[CSSOptimizer]'

  // ========== 配置 ==========
  const DEFAULT_CONFIG = {
    enabled: true,
    criticalCSSExtraction: true, // 关键CSS提取
    nonCriticalDefer: true, // 非关键CSS延迟
    mediaQuerySplit: true, // 媒体查询拆分
    cssDedup: true, // CSS去重
    fontDisplaySwap: true, // 字体font-display: swap
    avoidFOUC: true, // 避免FOUC
    maxCriticalRules: 200, // 最大关键CSS规则数
    criticalSelectors: [
      // 关键选择器（首屏可见元素）
      'header',
      'nav',
      'main',
      '.hero',
      '.above-fold',
      '.container',
      '.content',
      '#app',
      '#root',
    ],
    // 延迟加载阈值
    deferThreshold: {
      viewportRatio: 0.5, // 视口比例阈值
      distanceFromTop: 1000, // 距离顶部距离阈值
    },
    // 字体加载优化
    fontOptimization: {
      preload: true, // 预加载关键字体
      swap: true, // font-display: swap
      fallbackFonts: true, // 回退字体
    },
    // 性能监控
    performanceTracking: true,
  }

  // ========== 状态 ==========
  const state = {
    config: { ...DEFAULT_CONFIG },
    processedStylesheets: new Set(), // 已处理的样式表
    criticalCSSCache: new Map(), // 关键CSS缓存
    fontFaces: new Map(), // 字体声明缓存
    mediaQueryCache: new Map(), // 媒体查询缓存
    stats: {
      criticalCSSExtracted: 0,
      nonCriticalDeferred: 0,
      mediaQuerySplit: 0,
      fontsOptimized: 0,
      cssDeduped: 0,
      foucPrevented: 0,
    },
  }

  // ========== 工具函数 ==========

  /**
   * 日志输出
   */
  function log(level, action, data = {}) {
    const message = `${LOG_PREFIX} [${level}] ${action}`
    if (level === 'error') {
      console.error(message, data)
    } else if (level === 'warn') {
      console.warn(message, data)
    } else {
      console.log(message, data)
    }
  }

  /**
   * 检查元素是否在视口中
   */
  function isInViewport(element, threshold = 0) {
    if (!element || !element.isConnected) {
      return false
    }

    const rect = element.getBoundingClientRect()
    const windowHeight = window.innerHeight || document.documentElement.clientHeight
    const windowWidth = window.innerWidth || document.documentElement.clientWidth

    return (
      rect.top <= windowHeight + threshold &&
      rect.bottom >= -threshold &&
      rect.left <= windowWidth + threshold &&
      rect.right >= -threshold
    )
  }

  /**
   * 检查元素是否是首屏关键元素
   */
  function isCriticalElement(element) {
    if (!element || !element.isConnected) {
      return false
    }

    // 检查是否在首屏
    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth

    const isInAboveFold = rect.top < viewportHeight && rect.bottom > 0

    if (!isInAboveFold) {
      return false
    }

    // 检查是否匹配关键选择器
    for (const selector of state.config.criticalSelectors) {
      try {
        if (element.matches(selector)) {
          return true
        }
      } catch (e) {
        // 选择器无效，跳过
      }
    }

    // 检查元素尺寸（大元素更可能是关键元素）
    const elementArea = rect.width * rect.height
    const viewportArea = viewportHeight * viewportWidth
    if (!viewportArea || viewportArea <= 0) {
      return false
    }
    const areaRatio = elementArea / viewportArea

    // 占视口面积 5% 以上的元素视为关键
    return areaRatio > 0.05
  }

  /**
   * 压缩CSS
   */
  function minifyCSS(css) {
    if (!css || typeof css !== 'string') {
      return ''
    }

    return (
      css
        // 移除注释
        .replace(/\/\*[\s\S]*?\*\//g, '')
        // 移除多余空白
        .replace(/\s+/g, ' ')
        // 移除规则间空白
        .replace(/\s*([{};:,])\s*/g, '$1')
        // 移除分号前空白
        .replace(/;}/g, '}')
        // 移除最后分号
        .trim()
    )
  }

  /**
   * 解析CSS规则
   */
  function parseCSSRules(css) {
    const rules = []
    let currentRule = ''
    let braceCount = 0
    let inString = false
    let stringChar = ''

    for (let i = 0; i < css.length; i++) {
      const char = css[i]

      // 处理字符串
      if ((char === '"' || char === "'") && css[i - 1] !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
        }
      }

      // 计算大括号
      if (!inString) {
        if (char === '{') {
          braceCount++
        } else if (char === '}') {
          braceCount--
        }
      }

      currentRule += char

      // 规则结束
      if (braceCount === 0 && currentRule.trim()) {
        rules.push(currentRule.trim())
        currentRule = ''
      }
    }

    return rules
  }

  /**
   * 提取CSS选择器
   */
  function extractSelector(cssRule) {
    const match = cssRule.match(/^([^{]+)\{/)
    return match ? match[1].trim() : ''
  }

  /**
   * 提取媒体查询
   */
  function extractMediaQuery(cssRule) {
    const match = cssRule.match(/^@media\s+([^{]+)\{/)
    return match ? match[1].trim() : null
  }

  /**
   * 检查选择器是否匹配关键元素
   */
  function selectorMatchesCriticalElements(selector) {
    try {
      // 尝试在文档中查找匹配元素
      const elements = document.querySelectorAll(selector)
      for (const element of elements) {
        if (isCriticalElement(element)) {
          return true
        }
      }
      return false
    } catch (e) {
      // 选择器无效，保守处理
      return true
    }
  }

  // ========== 核心功能 ==========

  /**
   * 提取关键CSS
   * @param {string} css - CSS内容
   * @param {Object} options - 选项
   * @returns {Object} - { critical: string, nonCritical: string }
   */
  function extractCriticalCSS(css, options = {}) {
    if (!css || typeof css !== 'string') {
      return { critical: '', nonCritical: css || '' }
    }

    const rules = parseCSSRules(css)
    const criticalRules = []
    const nonCriticalRules = []
    const maxRules = options.maxRules || state.config.maxCriticalRules

    let criticalCount = 0

    for (const rule of rules) {
      // 字体声明始终视为关键
      if (rule.startsWith('@font-face')) {
        criticalRules.push(rule)
        state.fontFaces.set(rule, true)
        continue
      }

      // 关键CSS动画
      if (rule.startsWith('@keyframes')) {
        // 检查是否被关键元素使用
        // 简化处理：暂时归为非关键
        nonCriticalRules.push(rule)
        continue
      }

      // 媒体查询
      const mediaQuery = extractMediaQuery(rule)
      if (mediaQuery) {
        // 检查媒体查询条件
        const isCurrentMedia = window.matchMedia(mediaQuery).matches
        if (isCurrentMedia) {
          // 当前媒体查询匹配，提取内部规则
          const innerCSS = rule.replace(/^@media[^{]+\{/, '').replace(/\}$/, '')
          const innerResult = extractCriticalCSS(innerCSS, { maxRules: maxRules - criticalCount })
          if (innerResult.critical) {
            criticalRules.push(`@media ${mediaQuery}{${innerResult.critical}}`)
            criticalCount += innerResult.critical.split('{').length
          }
          if (innerResult.nonCritical) {
            nonCriticalRules.push(`@media ${mediaQuery}{${innerResult.nonCritical}}`)
          }
        } else {
          // 非当前媒体查询，延迟加载
          nonCriticalRules.push(rule)
        }
        continue
      }

      // 普通规则
      const selector = extractSelector(rule)
      if (selector && selectorMatchesCriticalElements(selector)) {
        criticalRules.push(rule)
        criticalCount++

        if (criticalCount >= maxRules) {
          // 达到最大规则数，剩余规则归为非关键
          const remainingIndex =
            rules.indexOf(rule, criticalRules.length + nonCriticalRules.length) ||
            rules.indexOf(rule)
          if (remainingIndex >= 0) {
            nonCriticalRules.push(...rules.slice(remainingIndex + 1))
          }
          break
        }
      } else {
        nonCriticalRules.push(rule)
      }
    }

    const critical = criticalRules.join('')
    const nonCritical = nonCriticalRules.join('')

    if (critical) {
      state.stats.criticalCSSExtracted++
    }

    return {
      critical: minifyCSS(critical),
      nonCritical: minifyCSS(nonCritical),
    }
  }

  /**
   * 内联关键CSS
   * @param {string} css - 关键CSS内容
   */
  function inlineCriticalCSS(css) {
    if (!css) {
      return null
    }

    const style = document.createElement('style')
    style.setAttribute('data-critical-css', 'true')
    style.textContent = css

    // 插入到 head 最前面
    const head = document.head || document.getElementsByTagName('head')[0]
    const firstChild = head.firstChild

    if (firstChild) {
      head.insertBefore(style, firstChild)
    } else {
      head.appendChild(style)
    }

    log('info', 'critical-css-inlined', { size: css.length })

    return style
  }

  /**
   * 延迟加载非关键CSS
   * @param {string} href - CSS URL
   * @param {Object} options - 选项
   */
  function deferNonCriticalCSS(href, options = {}) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = href

    // 设置媒体类型为非当前，避免阻塞渲染
    const currentMedia = options.media || 'print'
    link.media = currentMedia

    // 加载完成后切换媒体类型
    link.onload = function () {
      if (link.media === 'print' || link.media !== 'all') {
        link.media = 'all'
      }
      state.stats.nonCriticalDeferred++
      log('info', 'non-critical-css-loaded', { href })
    }

    // 错误处理
    link.onerror = function () {
      log('error', 'non-critical-css-error', { href })
    }

    document.head.appendChild(link)

    return link
  }

  /**
   * 按媒体查询拆分CSS
   * @param {string} css - CSS内容
   * @returns {Map} - 媒体查询 -> CSS
   */
  function splitByMediaQuery(css) {
    const rules = parseCSSRules(css)
    const mediaGroups = new Map()

    // 默认组（无媒体查询）
    mediaGroups.set('all', [])

    for (const rule of rules) {
      const mediaQuery = extractMediaQuery(rule)

      if (mediaQuery) {
        if (!mediaGroups.has(mediaQuery)) {
          mediaGroups.set(mediaQuery, [])
        }
        mediaGroups.get(mediaQuery).push(rule)
      } else {
        mediaGroups.get('all').push(rule)
      }
    }

    // 转换为字符串
    const result = new Map()
    for (const [media, rules] of mediaGroups) {
      if (rules.length > 0) {
        result.set(media, minifyCSS(rules.join('')))
      }
    }

    state.stats.mediaQuerySplit++

    return result
  }

  /**
   * CSS去重
   * @param {string} css - CSS内容
   * @returns {string} - 去重后的CSS
   */
  function deduplicateCSS(css) {
    const rules = parseCSSRules(css)
    const seen = new Set()
    const uniqueRules = []

    for (const rule of rules) {
      // 生成规则的唯一标识
      const fingerprint = minifyCSS(rule)

      if (!seen.has(fingerprint)) {
        seen.add(fingerprint)
        uniqueRules.push(rule)
      } else {
        state.stats.cssDeduped++
      }
    }

    return minifyCSS(uniqueRules.join(''))
  }

  /**
   * 优化字体加载
   * @param {string} css - CSS内容
   * @returns {string} - 优化后的CSS
   */
  function optimizeFontLoading(css) {
    if (!state.config.fontDisplaySwap) {
      return css
    }

    // 为所有 @font-face 添加 font-display: swap
    return css.replace(/(@font-face\s*\{)/gi, '$1font-display:swap;')
  }

  /**
   * 预加载关键字体
   * @param {string} css - CSS内容
   */
  function preloadCriticalFonts(css) {
    if (!state.config.fontOptimization.preload) {
      return
    }

    // 提取字体 URL
    const fontUrls = []
    const fontUrlRegex = /url\(['"]?([^'")]+)['"]?\)/gi
    let match

    while ((match = fontUrlRegex.exec(css)) !== null) {
      fontUrls.push(match[1])
    }

    // 为每个字体创建 preload
    fontUrls.forEach((url, index) => {
      if (index < 3) {
        // 只预加载前3个字体
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'font'
        link.href = url
        link.crossOrigin = 'anonymous'

        document.head.appendChild(link)

        state.stats.fontsOptimized++
        log('info', 'font-preloaded', { url })
      }
    })
  }

  /**
   * 防止FOUC（Flash of Unstyled Content）
   */
  function preventFOUC() {
    if (!state.config.avoidFOUC) {
      return
    }

    // 添加临时的隐藏样式，防止未样式化的内容闪烁
    const style = document.createElement('style')
    style.setAttribute('data-fouc-prevent', 'true')
    style.textContent = `
      html:not([data-styled]) body {
        visibility: hidden;
      }
    `

    document.head.appendChild(style)

    // 在所有样式加载完成后显示
    if (document.readyState === 'complete') {
      document.documentElement.setAttribute('data-styled', 'true')
      setTimeout(() => {
        style.remove()
      }, 100)
    } else {
      state._foucLoadHandler = () => {
        document.documentElement.setAttribute('data-styled', 'true')
        setTimeout(() => {
          style.remove()
        }, 100)
      }
      window.addEventListener('load', state._foucLoadHandler)
    }

    state.stats.foucPrevented++
    log('info', 'fouc-prevented')
  }

  /**
   * 处理单个样式表
   * @param {HTMLLinkElement} link - 样式表元素
   */
  async function processStylesheet(link) {
    if (!state.config.enabled || !link || !link.isConnected) {
      return
    }

    const href = link.href
    if (state.processedStylesheets.has(href)) {
      return
    }

    state.processedStylesheets.add(href)

    try {
      // 获取CSS内容
      const response = await fetch(href)

      // 检查响应状态
      if (!response.ok) {
        log('warn', 'stylesheet-fetch-failed', {
          href,
          status: response.status,
          statusText: response.statusText,
        })
        return
      }

      const css = await response.text()

      // 优化字体加载
      const optimizedCSS = optimizeFontLoading(css)

      // 提取关键CSS
      const { critical, nonCritical } = extractCriticalCSS(optimizedCSS)

      // 内联关键CSS
      if (critical) {
        inlineCriticalCSS(critical)
      }

      // 延迟加载非关键CSS
      if (nonCritical) {
        // 创建 blob URL
        const blob = new Blob([nonCritical], { type: 'text/css' })
        const blobUrl = URL.createObjectURL(blob)

        // 延迟加载
        const deferredLink = deferNonCriticalCSS(blobUrl, { media: link.media })

        // 样式表加载后释放 blob URL
        if (deferredLink) {
          deferredLink.addEventListener('load', () => URL.revokeObjectURL(blobUrl))
          deferredLink.addEventListener('error', () => URL.revokeObjectURL(blobUrl))
        }

        // 移除原始样式表
        link.remove()

        log('info', 'stylesheet-optimized', {
          href,
          criticalSize: critical.length,
          nonCriticalSize: nonCritical.length,
        })
      }

      // 预加载字体
      if (critical) {
        preloadCriticalFonts(critical)
      }
    } catch (error) {
      // CORS 错误或其他网络错误
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        log('warn', 'stylesheet-cors-error', {
          href,
          error: error.message,
          note: '跨域 CSS 文件无法优化，保持原样加载',
        })
      } else {
        log('error', 'stylesheet-process-error', { href, error: error.message })
      }
    }
  }

  /**
   * 批量处理样式表
   */
  function processAllStylesheets() {
    const stylesheets = document.querySelectorAll('link[rel="stylesheet"]')

    stylesheets.forEach((link) => {
      processStylesheet(link)
    })
  }

  /**
   * 处理内联样式
   */
  function processInlineStyles() {
    const styleElements = document.querySelectorAll('style:not([data-critical-css])')

    styleElements.forEach((style) => {
      const css = style.textContent

      // 优化字体加载
      const optimizedCSS = optimizeFontLoading(css)

      // 去重
      const dedupedCSS = deduplicateCSS(optimizedCSS)

      if (dedupedCSS !== css) {
        style.textContent = dedupedCSS
      }
    })
  }

  // ========== API ==========

  window.CSSOptimizer = {
    /**
     * 初始化
     */
    init(config = {}) {
      state.config = { ...DEFAULT_CONFIG, ...config }

      if (!state.config.enabled) {
        log('info', 'disabled')
        return
      }

      // 防止FOUC
      preventFOUC()

      // 处理现有样式表
      if (document.readyState === 'loading') {
        state._domReadyHandler = () => {
          processAllStylesheets()
          processInlineStyles()
        }
        document.addEventListener('DOMContentLoaded', state._domReadyHandler)
      } else {
        processAllStylesheets()
        processInlineStyles()
      }

      log('info', 'initialized', state.config)
    },

    /**
     * 处理单个样式表
     */
    processStylesheet,

    /**
     * 提取关键CSS
     */
    extractCriticalCSS,

    /**
     * 内联关键CSS
     */
    inlineCriticalCSS,

    /**
     * 延迟加载非关键CSS
     */
    deferNonCriticalCSS,

    /**
     * 按媒体查询拆分CSS
     */
    splitByMediaQuery,

    /**
     * CSS去重
     */
    deduplicateCSS,

    /**
     * 优化字体加载
     */
    optimizeFontLoading,

    /**
     * 获取统计信息
     */
    getStats() {
      return { ...state.stats }
    },

    /**
     * 重置统计
     */
    resetStats() {
      state.stats = {
        criticalCSSExtracted: 0,
        nonCriticalDeferred: 0,
        mediaQuerySplit: 0,
        fontsOptimized: 0,
        cssDeduped: 0,
        foucPrevented: 0,
      }
    },

    /**
     * 更新配置
     */
    updateConfig(newConfig) {
      state.config = { ...state.config, ...newConfig }
      log('info', 'config-updated', state.config)
    },

    /**
     * 获取配置
     */
    getConfig() {
      return { ...state.config }
    },

    destroy() {
      if (state._foucLoadHandler) {
        window.removeEventListener('load', state._foucLoadHandler)
        state._foucLoadHandler = null
      }
      if (state._domReadyHandler) {
        document.removeEventListener('DOMContentLoaded', state._domReadyHandler)
        state._domReadyHandler = null
      }
      state.config.enabled = false
    },
  }

  // 自动初始化（如果配置了）
  if (typeof window !== 'undefined' && window.CSSOptimizerAutoInit) {
    window.CSSOptimizer.init(window.CSSOptimizerConfig)
  }
})()
