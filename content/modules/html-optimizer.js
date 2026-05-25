/**
 * HTML 优化器模块
 * 负责优化 HTML 解析和渲染性能
 *
 * 功能：
 * 1. 资源预加载提示（preload/prefetch/preconnect）
 * 2. 资源加载优先级优化（fetch-priority）
 * 3. 关键渲染路径优化
 * 4. DNS 预解析和 TCP 预连接
 * 5. 骨架屏或占位符支持
 * 6. DOM 解析时机优化（避免阻塞）
 */

(function () {
  'use strict'

  const LOG_PREFIX = '[HTMLOptimizer]'

  // ========== 默认配置 ==========
  const DEFAULT_CONFIG = {
    enabled: true,
    // 预加载提示
    preload: {
      enabled: true,
      maxPreloads: 15, // 最大预加载数量
      maxPrefetch: 10, // 最大预取数量
      criticalResources: true, // 自动识别关键资源
      fontPreload: true, // 字体预加载
      imagePreload: true, // 关键图片预加载
      stylePreload: true, // 关键样式预加载
      scriptPreload: true, // 关键脚本预加载
    },
    // 预连接
    preconnect: {
      enabled: true,
      maxPreconnect: 10, // 最大预连接数量
      dnsPrefetch: true, // DNS 预解析
      tcpPreconnect: true, // TCP 预连接
      importantOrigins: [], // 重要源列表
    },
    // 优先级优化
    priority: {
      enabled: true,
      autoFetchPriority: true, // 自动设置 fetch-priority
      lcpPriority: 'high', // LCP 元素优先级
      viewportPriority: 'high', // 视口元素优先级
      belowFoldPriority: 'low', // 折叠下方元素优先级
    },
    // 关键渲染路径
    criticalPath: {
      enabled: true,
      inlineCriticalCSS: true, // 内联关键 CSS
      deferNonCriticalJS: true, // 延迟非关键 JS
      removeRenderBlocking: true, // 移除渲染阻塞资源
      asyncStyles: true, // 异步加载样式
    },
    // 骨架屏/占位符
    skeleton: {
      enabled: true,
      autoGenerate: false, // 自动生成骨架屏（实验性）
      placeholderColor: '#f0f0f0',
      animationDuration: 300,
      selectors: [], // 需要骨架屏的选择器
      maxSkeletons: 10, // 最大骨架屏数量
    },
    // DOM 解析优化
    domParsing: {
      enabled: true,
      deferDOMReady: true, // 延迟 DOMContentLoaded 处理
      chunkedParsing: true, // 分块解析
      idleCallback: true, // 使用 requestIdleCallback
      chunkSize: 50, // 每批处理的 DOM 节点数
      chunkDelay: 16, // 每批之间的延迟（ms）
    },
  }

  // ========== 状态 ==========
  const state = {
    config: { ...DEFAULT_CONFIG },
    initialized: false,
    // 已预加载的资源 URL
    preloadedUrls: new Set(),
    // 已预连接的源
    preconnectedOrigins: new Set(),
    // 骨架屏元素
    skeletonElements: new WeakSet(),
    // 统计
    stats: {
      preloads: 0,
      prefetches: 0,
      preconnects: 0,
      dnsPrefetches: 0,
      fetchPrioritySet: 0,
      skeletons: 0,
      renderBlockingRemoved: 0,
    },
  }

  // ========== 日志系统 ==========
  function addLog(level, action, details = {}) {
    const logEntry = {
      timestamp: Date.now(),
      level,
      action,
      details,
    }

    if (level === 'error') {
      console.error(`${LOG_PREFIX} ${action}:`, details)
    } else if (level === 'warn') {
      console.warn(`${LOG_PREFIX} ${action}:`, details)
    } else {
      console.log(`${LOG_PREFIX} ${action}:`, details)
    }
  }

  // ========== 预加载提示 ==========

  /**
   * 添加 preload 提示
   * @param {string} url - 资源 URL
   * @param {string} type - 资源类型 (script, style, font, image, fetch)
   * @param {object} options - 选项
   */
  function addPreload(url, type, options = {}) {
    if (!state.config.enabled || !state.config.preload.enabled) {
      return
    }
    if (state.preloadedUrls.has(url)) {
      return
    }
    if (state.stats.preloads >= state.config.preload.maxPreloads) {
      return
    }

    const head = document.head || document.documentElement
    if (!head) {
      return
    }

    // 检查是否已存在
    const existing = head.querySelector(`link[rel="preload"][href="${CSS.escape(url)}"]`)
    if (existing) {
      state.preloadedUrls.add(url)
      return
    }

    try {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.href = url

      // 设置 as 属性
      const asMap = {
        script: 'script',
        style: 'style',
        font: 'font',
        image: 'image',
        fetch: 'fetch',
        document: 'document',
      }
      link.as = asMap[type] || type
      link.dataset.ycInternal = '1'

      // 字体需要 crossorigin
      if (type === 'font') {
        link.crossOrigin = 'anonymous'
      }

      // 设置优先级
      if (options.priority && state.config.priority.enabled) {
        link.setAttribute('fetchpriority', options.priority)
      }

      // 设置 media（条件加载）
      if (options.media) {
        link.media = options.media
      }

      // 插入到 head 最前面
      head.insertBefore(link, head.firstChild)

      state.preloadedUrls.add(url)
      state.stats.preloads++

      addLog('info', 'preload_added', { url, type, priority: options.priority })
    } catch (e) {
      addLog('error', 'preload_failed', { url, type, error: e.message })
    }
  }

  /**
   * 添加 prefetch 提示
   * @param {string} url - 资源 URL
   * @param {string} type - 资源类型
   */
  function addPrefetch(url, type = 'document') {
    if (!state.config.enabled || !state.config.preload.enabled) {
      return
    }
    if (state.preloadedUrls.has(url)) {
      return
    }
    if (state.stats.prefetches >= state.config.preload.maxPrefetch) {
      return
    }

    const head = document.head || document.documentElement
    if (!head) {
      return
    }

    // 检查是否已存在
    const existing = head.querySelector(`link[rel="prefetch"][href="${CSS.escape(url)}"]`)
    if (existing) {
      state.preloadedUrls.add(url)
      return
    }

    try {
      const link = document.createElement('link')
      link.rel = 'prefetch'
      link.href = url
      link.dataset.ycInternal = '1'

      if (type !== 'document') {
        link.as = type
      }

      head.appendChild(link)

      state.preloadedUrls.add(url)
      state.stats.prefetches++

      addLog('info', 'prefetch_added', { url, type })
    } catch (e) {
      addLog('error', 'prefetch_failed', { url, type, error: e.message })
    }
  }

  // ========== 预连接 ==========

  /**
   * 添加 DNS 预解析
   * @param {string} origin - 源地址
   */
  function addDNSPrefetch(origin) {
    if (!state.config.enabled || !state.config.preconnect.enabled) {
      return
    }
    if (!state.config.preconnect.dnsPrefetch) {
      return
    }
    if (state.preconnectedOrigins.has(origin)) {
      return
    }

    try {
      const url = new URL(origin)
      const hostname = url.hostname

      const head = document.head || document.documentElement
      if (!head) {
        return
      }

      // 检查是否已存在
      const existing = head.querySelector(
        `link[rel="dns-prefetch"][href*="${CSS.escape(hostname)}"]`
      )
      if (existing) {
        state.preconnectedOrigins.add(origin)
        return
      }

      const link = document.createElement('link')
      link.rel = 'dns-prefetch'
      link.href = `//${hostname}`
      link.dataset.ycInternal = '1'

      head.insertBefore(link, head.firstChild)

      state.preconnectedOrigins.add(origin)
      state.stats.dnsPrefetches++

      addLog('info', 'dns_prefetch_added', { hostname })
    } catch (e) {
      addLog('error', 'dns_prefetch_failed', { origin, error: e.message })
    }
  }

  /**
   * 添加 TCP 预连接
   * @param {string} origin - 源地址
   */
  function addPreconnect(origin) {
    if (!state.config.enabled || !state.config.preconnect.enabled) {
      return
    }
    if (!state.config.preconnect.tcpPreconnect) {
      return
    }
    if (state.preconnectedOrigins.has(origin)) {
      return
    }
    if (state.stats.preconnects >= state.config.preconnect.maxPreconnect) {
      return
    }

    try {
      const url = new URL(origin)
      const originUrl = url.origin

      const head = document.head || document.documentElement
      if (!head) {
        return
      }

      // 检查是否已存在
      const existing = head.querySelector(`link[rel="preconnect"][href="${CSS.escape(originUrl)}"]`)
      if (existing) {
        state.preconnectedOrigins.add(origin)
        return
      }

      const link = document.createElement('link')
      link.rel = 'preconnect'
      link.href = originUrl
      link.dataset.ycInternal = '1'

      // 对于跨域资源，添加 crossorigin 属性
      if (originUrl !== window.location.origin) {
        link.crossOrigin = 'anonymous'
      }

      head.insertBefore(link, head.firstChild)

      state.preconnectedOrigins.add(origin)
      state.stats.preconnects++

      addLog('info', 'preconnect_added', { origin: originUrl })
    } catch (e) {
      addLog('error', 'preconnect_failed', { origin, error: e.message })
    }
  }

  /**
   * 批量添加预连接
   * @param {string[]} origins - 源地址数组
   */
  function addPreconnects(origins) {
    if (!Array.isArray(origins)) {
      return
    }

    origins.forEach((origin, index) => {
      // DNS 预解析可以更多
      addDNSPrefetch(origin)

      // TCP 预连接限制数量
      if (index < state.config.preconnect.maxPreconnect) {
        addPreconnect(origin)
      }
    })
  }

  // ========== 优先级优化 ==========

  /**
   * 设置元素加载优先级
   * @param {HTMLElement} element - DOM 元素
   * @param {string} priority - 优先级 (high, low, auto)
   */
  function setFetchPriority(element, priority) {
    if (!state.config.enabled || !state.config.priority.enabled) {
      return
    }
    if (!element || !element.setAttribute) {
      return
    }

    // 检查是否支持 fetchpriority
    if (!('fetchPriority' in element)) {
      // 降级：使用其他方式优化
      if (priority === 'low' && element.tagName === 'IMG') {
        element.loading = 'lazy'
      }
      return
    }

    try {
      element.setAttribute('fetchpriority', priority)
      state.stats.fetchPrioritySet++

      addLog('info', 'priority_set', {
        tag: element.tagName,
        priority,
        src: element.src || element.href,
      })
    } catch (e) {
      addLog('error', 'priority_set_failed', { error: e.message })
    }
  }

  /**
   * 根据元素位置自动设置优先级
   * @param {HTMLElement} element - DOM 元素
   */
  function autoSetPriority(element) {
    if (!state.config.priority.autoFetchPriority) {
      return
    }

    const rect = element.getBoundingClientRect()
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    // LCP 候选检测
    const isLarge = rect.width * rect.height > (viewportWidth * viewportHeight) / 10

    // 视口检测
    const inViewport = rect.top < viewportHeight && rect.bottom > 0

    // 设置优先级
    if (isLarge && inViewport) {
      setFetchPriority(element, state.config.priority.lcpPriority)
    } else if (inViewport) {
      setFetchPriority(element, state.config.priority.viewportPriority)
    } else {
      setFetchPriority(element, state.config.priority.belowFoldPriority)
    }
  }

  // ========== 关键渲染路径优化 ==========

  /**
   * 识别关键资源
   * @returns {object} 关键资源信息
   */
  function identifyCriticalResources() {
    const critical = {
      scripts: [],
      styles: [],
      fonts: [],
      images: [],
    }

    // 识别关键脚本（head 中的同步脚本）
    const headScripts =
      document.head?.querySelectorAll('script[src]:not([async]):not([defer])') || []
    critical.scripts = Array.from(headScripts)
      .map((s) => s.src)
      .filter(Boolean)

    // 识别关键样式（head 中的样式表）
    const headStyles = document.head?.querySelectorAll('link[rel="stylesheet"]') || []
    critical.styles = Array.from(headStyles)
      .map((s) => s.href)
      .filter(Boolean)

    // 识别关键字体（样式中的 @font-face）
    const fontUrls = extractFontUrls()
    critical.fonts = fontUrls

    // 识别首屏大图
    const images = document.querySelectorAll('img')
    const viewportHeight = window.innerHeight
    const viewportWidth = window.innerWidth

    images.forEach((img) => {
      if (!img.src) {
        return
      }

      const rect = img.getBoundingClientRect()
      const area = rect.width * rect.height
      const viewportArea = viewportWidth * viewportHeight

      // 面积占比 > 5% 且在视口内
      if (area > viewportArea * 0.05 && rect.top < viewportHeight) {
        critical.images.push(img.src)
      }
    })

    return critical
  }

  /**
   * 提取页面中的字体 URL
   * @returns {string[]} 字体 URL 列表
   */
  function extractFontUrls() {
    const fonts = []
    const fontRegex = /url\(['"]?(https?:\/\/[^'")\s]+\.woff2?[^'")\s]*)['"]?\)/gi

    // 扫描所有样式表
    try {
      const styleSheets = document.styleSheets
      for (const sheet of styleSheets) {
        try {
          const rules = sheet.cssRules || sheet.rules
          for (const rule of rules) {
            if (rule.cssText) {
              const matches = rule.cssText.matchAll(fontRegex)
              for (const match of matches) {
                if (match[1] && !fonts.includes(match[1])) {
                  fonts.push(match[1])
                }
              }
            }
          }
        } catch (e) {
          // 跨域样式表可能无法访问
        }
      }
    } catch (e) {
      addLog('warn', 'font_extract_failed', { error: e.message })
    }

    return fonts
  }

  /**
   * 预加载关键资源
   */
  function preloadCriticalResources() {
    if (!state.config.preload.criticalResources) {
      return
    }

    const critical = identifyCriticalResources()

    // 预加载关键样式（最高优先级）
    if (state.config.preload.stylePreload) {
      critical.styles.slice(0, 3).forEach((url) => {
        addPreload(url, 'style', { priority: 'high' })
      })
    }

    // 预加载关键脚本
    if (state.config.preload.scriptPreload) {
      critical.scripts.slice(0, 2).forEach((url) => {
        addPreload(url, 'script', { priority: 'high' })
      })
    }

    // 预加载关键字体
    if (state.config.preload.fontPreload) {
      critical.fonts.slice(0, 3).forEach((url) => {
        addPreload(url, 'font', { priority: 'high' })
      })
    }

    // 预加载首屏大图
    if (state.config.preload.imagePreload) {
      critical.images.slice(0, 2).forEach((url) => {
        addPreload(url, 'image', { priority: 'high' })
      })
    }

    addLog('info', 'critical_preloaded', {
      styles: critical.styles.length,
      scripts: critical.scripts.length,
      fonts: critical.fonts.length,
      images: critical.images.length,
    })
  }

  /**
   * 移除渲染阻塞资源
   */
  function removeRenderBlocking() {
    if (!state.config.criticalPath.enabled || !state.config.criticalPath.removeRenderBlocking) {
      return
    }

    const head = document.head
    if (!head) {
      return
    }

    // 处理同步脚本
    const syncScripts = head.querySelectorAll('script[src]:not([async]):not([defer])')
    syncScripts.forEach((script) => {
      // 对于非关键脚本，添加 defer
      if (!isCriticalScript(script)) {
        script.defer = true
        state.stats.renderBlockingRemoved++
        addLog('info', 'render_blocking_removed', { type: 'script', src: script.src })
      }
    })

    // 处理同步样式
    const syncStyles = head.querySelectorAll('link[rel="stylesheet"]:not([media="print"])')
    syncStyles.forEach((link) => {
      // 对于非关键样式，使用 media="print" + onload 技巧
      if (!isCriticalStyle(link)) {
        link.media = 'print'
        link.onload = function () {
          this.media = 'all'
        }
        state.stats.renderBlockingRemoved++
        addLog('info', 'render_blocking_removed', { type: 'style', href: link.href })
      }
    })
  }

  /**
   * 判断脚本是否关键
   */
  function isCriticalScript(script) {
    const src = script.src || ''
    const criticalPatterns = [
      /polyfill/i,
      /runtime/i,
      /app\.js/i,
      /main\.js/i,
      /bundle\.js/i,
      /core\.js/i,
    ]
    return criticalPatterns.some((p) => p.test(src))
  }

  /**
   * 判断样式是否关键
   */
  function isCriticalStyle(link) {
    const href = link.href || ''
    const criticalPatterns = [/critical/i, /main\.css/i, /app\.css/i, /core\.css/i, /style\.css/i]
    return criticalPatterns.some((p) => p.test(href))
  }

  // ========== 骨架屏 ==========

  /**
   * 为元素创建骨架屏
   * @param {HTMLElement} element - 目标元素
   * @param {object} options - 选项
   */
  function createSkeleton(element, options = {}) {
    if (!state.config.enabled || !state.config.skeleton.enabled) {
      return
    }
    if (state.skeletonElements.has(element)) {
      return
    }
    if (state.stats.skeletons >= state.config.skeleton.maxSkeletons) {
      return
    }

    const config = { ...state.config.skeleton, ...options }

    try {
      // 保存原始样式
      const originalStyles = {
        position: element.style.position,
        overflow: element.style.overflow,
      }

      // 创建骨架屏样式
      element.style.position = 'relative'
      element.style.overflow = 'hidden'

      // 添加骨架屏背景
      element.style.background = `linear-gradient(
        90deg,
        ${config.placeholderColor} 0%,
        ${adjustColor(config.placeholderColor, 10)} 50%,
        ${config.placeholderColor} 100%
      )`
      element.style.backgroundSize = '200% 100%'
      element.style.animation = `skeleton-loading ${config.animationDuration}ms ease-in-out infinite`

      // 添加动画样式（如果不存在）
      addSkeletonAnimation()

      // 标记已处理
      state.skeletonElements.add(element)
      state.stats.skeletons++

      // 返回移除骨架屏的函数
      return function removeSkeleton() {
        if (!state.skeletonElements.has(element)) {
          return
        }

        element.style.position = originalStyles.position
        element.style.overflow = originalStyles.overflow
        element.style.background = ''
        element.style.backgroundSize = ''
        element.style.animation = ''

        state.skeletonElements.delete(element)
      }
    } catch (e) {
      addLog('error', 'skeleton_failed', { error: e.message })
    }
  }

  /**
   * 添加骨架屏动画样式
   */
  function addSkeletonAnimation() {
    const styleId = 'skeleton-animation-style'
    if (document.getElementById(styleId)) {
      return
    }

    const style = document.createElement('style')
    style.id = styleId
    style.dataset.ycInternal = '1'
    style.textContent = `
      @keyframes skeleton-loading {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `
    document.head.appendChild(style)
  }

  /**
   * 调整颜色亮度
   */
  function adjustColor(hex, percent) {
    const num = parseInt(hex.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = Math.min(255, Math.max(0, (num >> 16) + amt))
    const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt))
    const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt))
    return `#${((1 << 24) | (R << 16) | (G << 8) | B).toString(16).slice(1)}`
  }

  // ========== DOM 解析优化 ==========

  /**
   * 分块处理 DOM 节点
   * @param {NodeList} nodes - 节点列表
   * @param {Function} processor - 处理函数
   * @param {object} options - 选项
   */
  function chunkedProcess(nodes, processor, options = {}) {
    const config = { ...state.config.domParsing, ...options }

    if (!config.enabled || !config.chunkedParsing) {
      // 直接处理
      nodes.forEach(processor)
      return
    }

    const nodeArray = Array.from(nodes)
    let index = 0

    function processChunk(deadline) {
      const useIdle = config.idleCallback && typeof deadline === 'object'
      const startTime = performance.now()

      while (index < nodeArray.length) {
        // 检查是否需要让出主线程
        const elapsed = performance.now() - startTime
        const shouldYield = useIdle ? deadline.timeRemaining() < 1 : elapsed > 16

        if (shouldYield) {
          break
        }

        // 处理一批节点
        const endIndex = Math.min(index + config.chunkSize, nodeArray.length)
        for (let i = index; i < endIndex; i++) {
          try {
            processor(nodeArray[i])
          } catch (e) {
            addLog('error', 'chunk_process_failed', { error: e.message })
          }
        }
        index = endIndex
      }

      // 如果还有剩余，继续调度
      if (index < nodeArray.length) {
        if (useIdle) {
          requestIdleCallback(processChunk, { timeout: 100 })
        } else {
          setTimeout(processChunk, config.chunkDelay)
        }
      }
    }

    // 开始处理
    if (config.idleCallback && 'requestIdleCallback' in window) {
      requestIdleCallback(processChunk, { timeout: 100 })
    } else {
      processChunk()
    }
  }

  /**
   * 延迟执行非关键任务
   * @param {Function} task - 任务函数
   * @param {number} delay - 延迟时间（ms）
   */
  function deferNonCritical(task, delay = 100) {
    if (!state.config.domParsing.enabled) {
      task()
      return
    }

    if (state.config.domParsing.idleCallback && 'requestIdleCallback' in window) {
      requestIdleCallback(
        (deadline) => {
          if (deadline.timeRemaining() > 0 || deadline.didTimeout) {
            task()
          } else {
            // 时间不够，重新调度
            deferNonCritical(task, delay)
          }
        },
        { timeout: delay }
      )
    } else {
      setTimeout(task, delay)
    }
  }

  // ========== 初始化 ==========

  /**
   * 初始化 HTML 优化器
   * @param {object} config - 配置选项
   */
  function init(config = {}) {
    if (state.initialized) {
      return
    }

    state.config = { ...DEFAULT_CONFIG, ...config }
    state.initialized = true

    // 页面加载完成后执行
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onDOMReady)
    } else {
      onDOMReady()
    }

    // 页面完全加载后执行
    if (document.readyState === 'complete') {
      onLoad()
    } else {
      window.addEventListener('load', onLoad)
    }

    addLog('info', 'initialized', { config: state.config })
  }

  /**
   * DOM 就绪回调
   */
  function onDOMReady() {
    // 预连接常用域名
    preconnectCommonOrigins()

    // 预加载关键资源
    if (state.config.preload.criticalResources) {
      preloadCriticalResources()
    }

    // 移除渲染阻塞
    if (state.config.criticalPath.removeRenderBlocking) {
      removeRenderBlocking()
    }
  }

  /**
   * 页面加载完成回调
   */
  function onLoad() {
    // 延迟处理非关键任务
    deferNonCritical(() => {
      // 识别并预取下一页可能需要的资源
      predictAndPrefetch()
    }, 2000)
  }

  /**
   * 预连接常用域名
   */
  function preconnectCommonOrigins() {
    const commonOrigins = [
      'https://fonts.googleapis.com',
      'https://fonts.gstatic.com',
      'https://cdn.jsdelivr.net',
      'https://cdnjs.cloudflare.com',
      'https://unpkg.com',
    ]

    // 合并用户配置的重要源
    const origins = [...commonOrigins, ...state.config.preconnect.importantOrigins]

    addPreconnects(origins)
  }

  /**
   * 预测并预取资源
   */
  function predictAndPrefetch() {
    // 获取页面中的链接
    const links = document.querySelectorAll('a[href]')

    // 简单预测：预取前 N 个链接
    const prefetchCandidates = Array.from(links)
      .filter((link) => {
        const href = link.href
        // 只预取同源链接
        try {
          const url = new URL(href)
          return url.origin === window.location.origin && !url.hash
        } catch {
          return false
        }
      })
      .slice(0, 3)

    // 使用低优先级预取
    prefetchCandidates.forEach((link) => {
      addPrefetch(link.href)
    })
  }

  // ========== 公共 API ==========

  window.HTMLOptimizer = {
    init,
    // 预加载
    addPreload,
    addPrefetch,
    // 预连接
    addDNSPrefetch,
    addPreconnect,
    addPreconnects,
    // 优先级
    setFetchPriority,
    autoSetPriority,
    // 关键渲染路径
    identifyCriticalResources,
    preloadCriticalResources,
    removeRenderBlocking,
    // 骨架屏
    createSkeleton,
    // DOM 解析
    chunkedProcess,
    deferNonCritical,
    // 统计
    getStats: () => ({ ...state.stats }),
    // 配置
    getConfig: () => ({ ...state.config }),
    setConfig: (config) => {
      state.config = { ...state.config, ...config }
    },
  }

  addLog('info', 'module_loaded')
})()
