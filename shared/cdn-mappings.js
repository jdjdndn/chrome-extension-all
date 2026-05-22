/**
 * CDN 映射表配置
 * 用于智能资源加速器，替换慢速网站资源为公共CDN
 * 支持多CDN降级链: BootCDN → jsDelivr → unpkg
 * 只需定义库名和匹配规则，CDN路径自动生成
 */

(function () {
  'use strict'

  // ========== CDN 源配置(降级链) ==========
  const CDN_SOURCES = [
    // 国内优先
    {
      id: 'bootcdn',
      name: 'BootCDN',
      baseUrl: 'https://cdn.bootcdn.net/ajax/libs/',
      format: 'bootcdn', // base + package/version/file
    },
    {
      id: 'baomitu',
      name: '360前端',
      baseUrl: 'https://cdn.baomitu.com/ajax/libs/',
      format: 'bootcdn',
    },
    {
      id: 'staticfile',
      name: '七牛云',
      baseUrl: 'https://cdn.staticfile.org/',
      format: 'bootcdn',
    },
    {
      id: 'bytecdntp',
      name: '字节CDN',
      baseUrl: 'https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/',
      format: 'bootcdn',
    },
    // 全球CDN(国内有节点)
    {
      id: 'jsdelivr',
      name: 'jsDelivr',
      baseUrl: 'https://cdn.jsdelivr.net/npm/',
      format: 'npm', // base + package@version/file
    },
    {
      id: 'cdnjs',
      name: 'cdnjs',
      baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/',
      format: 'bootcdn',
    },
    {
      id: 'unpkg',
      name: 'unpkg',
      baseUrl: 'https://unpkg.com/',
      format: 'npm',
    },
    // 字体镜像
    {
      id: 'fontMirror',
      name: 'Font Mirror',
      baseUrl: 'https://fonts.font.im/',
      format: 'font',
    },
    {
      id: 'loli',
      name: 'LoliNet',
      baseUrl: 'https://fonts.loli.net/',
      format: 'font',
    },
    {
      id: 'fontsGoogle',
      name: 'Google Fonts(国内代理)',
      baseUrl: 'https://fonts.googleapis.cnpmjs.org/',
      format: 'font',
    },
  ]

  const CDN_BY_ID = {}
  CDN_SOURCES.forEach((s) => (CDN_BY_ID[s.id] = s))

  // ========== 版本提取工具 ==========
  function extractVersion(url, patterns) {
    if (!url) {
      return null
    }
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {
        return match[1]
      }
    }
    return null
  }

  /**
   * 从URL中提取文件名部分
   */
  function extractFile(url) {
    try {
      const pathname = new URL(url).pathname
      const parts = pathname.split('/')
      return parts[parts.length - 1] || ''
    } catch {
      return ''
    }
  }

  /**
   * 构建CDN URL
   */
  function buildCDNUrl(cdn, libConfig, version, file) {
    const ver = version || libConfig.defaultVersion
    const pkg = libConfig.package || libConfig.name
    const f = file || libConfig.file

    if (cdn.format === 'bootcdn') {
      return cdn.baseUrl + pkg + '/' + ver + '/' + f
    }
    if (cdn.format === 'npm') {
      return cdn.baseUrl + pkg + '@' + ver + '/' + f
    }
    return null
  }

  // ========== JS库映射 ==========
  // 只需: patterns(匹配), file(CDN文件名), 可选: package, defaultVersion
  const JS_CDN_MAP = {
    jquery: {
      patterns: [/jquery[-.]?([\d.]+)?\.min\.js/i, /jquery\.js/i, /jquery-(\d+\.\d+\.\d+)\.js/i],
      versionPatterns: [/jquery[\/-](\d+\.\d+\.\d+)/i, /jquery[\/-](\d+\.\d+)/i],
      package: 'jquery',
      file: 'jquery.min.js',
      defaultVersion: '3.7.1',
      global: '$',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    react: {
      patterns: [
        /react(?:\.production)?(?:\.min)?\.js/i,
        /react\/([\d.]+)\/umd\/react/i,
        /react@([\d.]+)\/umd\/react/i,
      ],
      versionPatterns: [/react[\/@](\d+\.\d+\.\d+)/i, /react\.production\.min/i],
      package: 'react',
      file: 'umd/react.production.min.js',
      defaultVersion: '18.2.0',
      global: 'React',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    reactDom: {
      patterns: [
        /react-dom(?:\.production)?(?:\.min)?\.js/i,
        /react-dom\/([\d.]+)\/umd\/react-dom/i,
        /react-dom@([\d.]+)\/umd\/react-dom/i,
      ],
      versionPatterns: [/react-dom[\/@](\d+\.\d+\.\d+)/i],
      package: 'react-dom',
      file: 'umd/react-dom.production.min.js',
      defaultVersion: '18.2.0',
      global: 'ReactDOM',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    vue: {
      patterns: [
        /vue(?:\.runtime)?(?:\.production)?(?:\.min)?\.js/i,
        /vue\/([\d.]+)\/dist\/vue/i,
        /vue@([\d.]+)\/dist\/vue/i,
      ],
      versionPatterns: [/vue[\/@](\d+\.\d+\.\d+)/i],
      package: 'vue',
      file: 'dist/vue.global.prod.min.js',
      defaultVersion: '3.4.21',
      global: 'Vue',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    lodash: {
      patterns: [/lodash(?:[-.]?min)?\.js/i, /lodash\/([\d.]+)\/lodash/i],
      versionPatterns: [/lodash[\/-](\d+\.\d+\.\d+)/i, /lodash\.js\/(\d+\.\d+\.\d+)/i],
      package: 'lodash',
      file: 'lodash.min.js',
      defaultVersion: '4.17.21',
      global: '_',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    axios: {
      patterns: [/axios\.min\.js/i, /axios\/([\d.]+)\/axios/i],
      versionPatterns: [/axios\/(\d+\.\d+\.\d+)/i, /axios@(\d+\.\d+\.\d+)/i],
      package: 'axios',
      file: 'dist/axios.min.js',
      defaultVersion: '1.6.7',
      global: 'axios',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    moment: {
      patterns: [/moment(?:\.min)?\.js/i, /moment\/([\d.]+)\/moment/i],
      versionPatterns: [/moment[\/-](\d+\.\d+\.\d+)/i, /moment\.js\/(\d+\.\d+\.\d+)/i],
      package: 'moment',
      file: 'min/moment.min.js',
      defaultVersion: '2.30.1',
      global: 'moment',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    echarts: {
      patterns: [/echarts(?:\.min)?\.js/i, /echarts\/([\d.]+)\/echarts/i],
      versionPatterns: [/echarts\/(\d+\.\d+\.\d+)/i, /echarts@(\d+\.\d+\.\d+)/i],
      package: 'echarts',
      file: 'dist/echarts.min.js',
      defaultVersion: '5.5.0',
      global: 'echarts',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    d3: {
      patterns: [/d3(?:\.min)?\.js/i, /d3\/([\d.]+)\/d3/i],
      versionPatterns: [/d3\/(\d+\.\d+\.\d+)/i, /d3@(\d+\.\d+\.\d+)/i],
      package: 'd3',
      file: 'dist/d3.min.js',
      defaultVersion: '7.8.5',
      global: 'd3',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    chartjs: {
      patterns: [/chart(?:\.js|\.min\.js)/i, /chart\.js\/([\d.]+)\/chart/i],
      versionPatterns: [/chart\.js[\/-](\d+\.\d+\.\d+)/i, /chartjs\/(\d+\.\d+\.\d+)/i],
      package: 'chart.js',
      file: 'dist/chart.umd.js',
      defaultVersion: '4.4.1',
      global: 'Chart',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    threejs: {
      patterns: [/three(?:\.min)?\.js/i, /three\/([\d.]+)\/three/i],
      versionPatterns: [/three\/(\d+\.\d+\.\d+)/i, /three@(\d+\.\d+\.\d+)/i, /r(\d+)\/three/i],
      package: 'three',
      file: 'build/three.min.js',
      defaultVersion: '0.168.0',
      global: 'THREE',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    dayjs: {
      patterns: [/dayjs(?:\.min)?\.js/i, /dayjs\/([\d.]+)\/dayjs/i],
      versionPatterns: [/dayjs\/(\d+\.\d+\.\d+)/i, /dayjs@(\d+\.\d+\.\d+)/i],
      package: 'dayjs',
      file: 'dayjs.min.js',
      defaultVersion: '1.11.10',
      global: 'dayjs',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    animejs: {
      patterns: [/anime(?:\.min)?\.js/i, /animejs\/([\d.]+)\/anime/i],
      versionPatterns: [/anime[\/@](\d+\.\d+\.\d+)/i, /animejs\/(\d+\.\d+\.\d+)/i],
      package: 'animejs',
      file: 'lib/anime.min.js',
      defaultVersion: '3.2.2',
      global: 'anime',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    hammerjs: {
      patterns: [/hammer(?:\.min)?\.js/i],
      versionPatterns: [/hammer[\/.@](\d+\.\d+\.\d+)/i],
      package: 'hammerjs',
      file: 'hammer.min.js',
      defaultVersion: '2.0.8',
      global: 'Hammer',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    // ========== 新增常用库 ==========
    jqueryUi: {
      patterns: [/jquery-ui(?:\.min)?\.js/i, /jqueryui\/([\d.]+)\/jquery-ui/i],
      versionPatterns: [/jquery-ui[\/@](\d+\.\d+\.\d+)/i, /jqueryui[\/@](\d+\.\d+\.\d+)/i],
      package: 'jquery-ui',
      file: 'dist/jquery-ui.min.js',
      defaultVersion: '1.13.2',
      global: 'jQuery',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    bootstrapJs: {
      patterns: [
        /bootstrap[\/-]([\d.]+)\/js\/bootstrap(?:\.bundle)?(?:\.min)?\.js/i,
        /bootstrap(?:\.bundle)?(?:\.min)?\.js/i,
      ],
      versionPatterns: [/bootstrap[\/@-](\d+\.\d+\.\d+)/i],
      package: 'bootstrap',
      file: 'dist/js/bootstrap.min.js',
      defaultVersion: '5.3.3',
      global: 'bootstrap',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    popper: {
      patterns: [/popper(?:\.umd)?(?:\.min)?\.js/i, /popper\.js\/([\d.]+)\/umd\/popper/i],
      versionPatterns: [/popper[\/.@](\d+\.\d+\.\d+)/i],
      package: '@popperjs/core',
      file: 'dist/umd/popper.min.js',
      defaultVersion: '2.11.8',
      global: 'Popper',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    swiper: {
      patterns: [/swiper(?:\.bundle)?(?:\.min)?\.js/i, /swiper\/([\d.]+)\/swiper/i],
      versionPatterns: [/swiper[\/@](\d+\.\d+\.\d+)/i],
      package: 'swiper',
      file: 'swiper-bundle.min.js',
      defaultVersion: '11.0.5',
      global: 'Swiper',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    select2: {
      patterns: [/select2(?:\.min)?\.js/i, /select2\/([\d.]+)\/js\/select2/i],
      versionPatterns: [/select2[\/@](\d+\.\d+\.\d+)/i],
      package: 'select2',
      file: 'dist/js/select2.min.js',
      defaultVersion: '4.0.13',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    gsap: {
      patterns: [/gsap(?:\.min)?\.js/i, /gsap\/([\d.]+)\/gsap/i],
      versionPatterns: [/gsap[\/@](\d+\.\d+\.\d+)/i],
      package: 'gsap',
      file: 'dist/gsap.min.js',
      defaultVersion: '3.12.5',
      global: 'gsap',
      cdnOrder: ['bootcdn', 'baomitu', 'jsdelivr', 'cdnjs'],
    },
    socketio: {
      patterns: [/socket\.io(?:\.min)?\.js/i, /socket\.io\/([\d.]+)\/socket\.io/i],
      versionPatterns: [/socket\.io[\/@](\d+\.\d+\.\d+)/i],
      package: 'socket.io-client',
      file: 'dist/socket.io.min.js',
      defaultVersion: '4.7.4',
      global: 'io',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    zenscroll: {
      patterns: [/zenscroll(?:\.min)?\.js/i],
      versionPatterns: [/zenscroll[\/@](\d+\.\d+\.\d+)/i],
      package: 'zenscroll',
      file: 'zenscroll-min.js',
      defaultVersion: '4.0.2',
      cdnOrder: ['jsdelivr', 'unpkg'],
    },
  }

  // ========== CSS框架映射 ==========
  const CSS_CDN_MAP = {
    bootstrap: {
      patterns: [
        /bootstrap[\/-]([\d.]+)\/css\/bootstrap(?:\.min)?\.css/i,
        /bootstrap\/([\d.]+)\/dist\/css\/bootstrap(?:\.min)?\.css/i,
        /bootstrap(?:\.min)?\.css/i,
      ],
      versionPatterns: [/bootstrap[\/@-](\d+\.\d+\.\d+)/i],
      package: 'bootstrap',
      file: 'dist/css/bootstrap.min.css',
      defaultVersion: '5.3.3',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    bootstrapGrid: {
      patterns: [/bootstrap[\/-]([\d.]+)\/css\/bootstrap-grid(?:\.min)?\.css/i],
      versionPatterns: [/bootstrap[\/@-](\d+\.\d+\.\d+)/i],
      package: 'bootstrap',
      file: 'dist/css/bootstrap-grid.min.css',
      defaultVersion: '5.3.3',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    tailwind: {
      patterns: [/tailwindcss\/([\d.]+)\/tailwind(?:\.min)?\.css/i],
      versionPatterns: [/tailwindcss[\/@](\d+\.\d+\.\d+)/i],
      package: 'tailwindcss',
      file: 'dist/tailwind.min.css',
      defaultVersion: '2.2.19',
      cdnOrder: ['jsdelivr', 'unpkg'],
    },
    foundation: {
      patterns: [
        /foundation[\/-]([\d.]+)\/css\/foundation(?:\.min)?\.css/i,
        /foundation(?:\.min)?\.css/i,
      ],
      versionPatterns: [/foundation[\/@-](\d+\.\d+\.\d+)/i],
      package: 'foundation-sites',
      file: 'dist/css/foundation.min.css',
      defaultVersion: '6.8.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    animatecss: {
      patterns: [/animate\.css/i, /animate[\/-]([\d.]+)\/animate\.min\.css/i],
      versionPatterns: [/animate\.css[\/@-](\d+\.\d+\.\d+)/i],
      package: 'animate.css',
      file: 'animate.min.css',
      defaultVersion: '4.1.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    normalize: {
      patterns: [/normalize(?:\.min)?\.css/i, /normalize\/([\d.]+)\/normalize(?:\.min)?\.css/i],
      versionPatterns: [/normalize[\/-](\d+\.\d+\.\d+)/i],
      package: 'normalize.css',
      file: 'normalize.min.css',
      defaultVersion: '8.0.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    // ========== 图标库 CSS ==========
    materialIcons: {
      patterns: [
        /material-icons(?:\.min)?\.css/i,
        /fonts\.googleapis\.com\/icon/i,
        /material\.io\/icons/i,
      ],
      replaceHost: 'fonts.font.im',
      description: 'Material Icons',
    },
    materialSymbols: {
      patterns: [
        /material-symbols(?:\.outlined)?(?:\.min)?\.css/i,
        /fonts\.googleapis\.com\/css2\?.*material/i,
      ],
      replaceHost: 'fonts.font.im',
      description: 'Material Symbols',
    },
    ionicons: {
      patterns: [/ionicons(?:\.min)?\.css/i, /ion\.icons\/([\d.]+)\/css\/ionicons/i],
      versionPatterns: [/ionicons[\/@](\d+\.\d+\.\d+)/i],
      package: 'ionicons',
      file: 'dist/css/ionicons.min.css',
      defaultVersion: '7.2.1',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    // ========== 更多 CSS 库 ==========
    swiperCss: {
      patterns: [
        /swiper(?:\.bundle)?(?:\.min)?\.css/i,
        /swiper\/([\d.]+)\/swiper-bundle\.min\.css/i,
      ],
      versionPatterns: [/swiper[\/@](\d+\.\d+\.\d+)/i],
      package: 'swiper',
      file: 'swiper-bundle.min.css',
      defaultVersion: '11.0.5',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
    hoverCss: {
      patterns: [/hover(?:\.min)?\.css/i, /hover\.css\/([\d.]+)\/css/i],
      versionPatterns: [/hover\.css[\/@](\d+\.\d+\.\d+)/i],
      package: 'hover.css',
      file: 'css/hover-min.css',
      defaultVersion: '2.3.2',
      cdnOrder: ['bootcdn', 'baomitu', 'jsdelivr'],
    },
    aos: {
      patterns: [/aos(?:\.min)?\.css/i, /aos\/([\d.]+)\/dist\/aos/i],
      versionPatterns: [/aos[\/@](\d+\.\d+\.\d+)/i],
      package: 'aos',
      file: 'dist/aos.css',
      defaultVersion: '2.3.4',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
    },
  }

  // ========== 字体映射 ==========
  const FONT_CDN_MAP = {
    googleFonts: {
      patterns: [/fonts\.googleapis\.com\/css/i],
      replaceHost: 'fonts.font.im',
      description: 'Google Fonts CSS',
    },
    googleFontsEarlyaccess: {
      patterns: [/fonts\.googleapis\.com\/earlyaccess/i],
      replaceHost: 'fonts.font.im',
      description: 'Google Fonts Early Access',
    },
    fontAwesome: {
      patterns: [
        /font-awesome\/[\d.]+\/css\/font-awesome\.min\.css/i,
        /fontawesome-free\/[\d.]+\/css\/all\.min\.css/i,
        /use\.fontawesome\.com\/releases\/[\d.]+\/css\/all\.css/i,
      ],
      package: '@fortawesome/fontawesome-free',
      file: 'css/all.min.css',
      defaultVersion: '6.5.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
      description: 'FontAwesome 图标字体',
    },
    // ========== 新增字体映射 ==========
    fontAwesomeV4: {
      patterns: [
        /font-awesome\/4\.[\d.]+\/css\/font-awesome(?:\.min)?\.css/i,
        /maxcdn\.bootstrapcdn\.com\/font-awesome\/4/i,
      ],
      package: 'font-awesome',
      file: 'css/font-awesome.min.css',
      defaultVersion: '4.7.0',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
      description: 'FontAwesome 4.x 图标字体',
    },
    iconfont: {
      patterns: [/at\.alicdn\.com\/t\/font_\d+/i],
      description: '阿里巴巴 iconfont',
      // iconfont 无法替换，仅标记不处理
      skip: true,
    },
  }

  // ========== CDN 健康探测 ==========

  const CDNHealthProbe = {
    // 缓存: { cdnId: { healthy, latency, timestamp } }
    _cache: {},
    TTL: 5 * 60 * 1000, // 5分钟
    TIMEOUT: 3000, // 3秒超时
    _pending: {}, // 防止重复探测

    // 探测历史: { cdnId: [{ time, latency, healthy }] }
    _history: {},
    // 响应时间历史: { cdnId: [{ time, latency }] }
    _responseTimes: {},
    // 健康计数: { cdnId: { healthy: N, unhealthy: N } }
    _healthCounts: {},
    // 探测统计
    _stats: {
      totalProbes: 0,
      successfulProbes: 0,
      failedProbes: 0,
    },
    // 历史上限配置
    _historyLimits: {
      responseTimes: 20, // 保留最近20次响应时间
      healthHistory: 50, // 保留最近50次健康状态
    },

    /**
     * 探测单个CDN可用性
     */
    async probe(cdnId) {
      const now = Date.now()
      const cached = this._cache[cdnId]

      // 缓存有效
      if (cached && now - cached.timestamp < this.TTL) {
        return cached
      }

      // 防止并发重复探测
      if (this._pending[cdnId]) {
        return this._pending[cdnId]
      }

      const cdn = CDN_BY_ID[cdnId]
      if (!cdn || cdn.format === 'font') {
        return { healthy: true, latency: 0, timestamp: now }
      }

      const probePromise = this._doProbe(cdnId, cdn)
      this._pending[cdnId] = probePromise

      try {
        const result = await probePromise
        this._cache[cdnId] = result
        this._recordProbeResult(cdnId, result)
        return result
      } finally {
        delete this._pending[cdnId]
      }
    },

    /**
     * 获取 CDN 探测用的完整 URL
     * 使用已知存在的热门库文件（避免请求不完整的 baseUrl 导致 404）
     */
    _getProbeFile(cdn) {
      // 根据 CDN 格式选择探测文件
      const probeLibs = {
        bootcdn: 'jquery/3.7.1/jquery.min.js',
        npm: 'jquery@3.7.1/dist/jquery.min.js',
        font: null, // 字体 CDN 不探测
      }

      const probePath = probeLibs[cdn.format]
      if (!probePath) {
        return null
      }

      return cdn.baseUrl + probePath
    },

    async _doProbe(cdnId, cdn) {
      const start = performance.now()
      this._stats.totalProbes++

      const probeFile = this._getProbeFile(cdn)
      if (!probeFile) {
        return { healthy: true, latency: 0, timestamp: Date.now() }
      }

      // 使用 fetch no-cors 探测 — 不执行代码，不产生副作用
      // no-cors 行为: HTTP 200/404/5xx → opaque response → resolve (✓)
      //               网络层错误(DNS/连接/CORS重定向) → reject (✗)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), this.TIMEOUT)
      })

      try {
        const fetchPromise = fetch(probeFile, {
          method: 'GET',
          mode: 'no-cors',
          cache: 'no-store',
        }).then(() => ({ ok: true }))

        await Promise.race([fetchPromise, timeoutPromise])

        const latency = Math.round(performance.now() - start)
        this._stats.successfulProbes++
        return { healthy: true, latency, timestamp: Date.now() }
      } catch (e) {
        const latency = Math.round(performance.now() - start)
        this._stats.failedProbes++
        return { healthy: false, latency: Infinity, timestamp: Date.now() }
      }
    },

    /**
     * 记录探测结果到历史
     */
    _recordProbeResult(cdnId, result) {
      const now = Date.now()

      // 记录响应时间历史（保留最近N次）
      if (!this._responseTimes[cdnId]) {
        this._responseTimes[cdnId] = []
      }
      this._responseTimes[cdnId].push({
        time: now,
        latency: result.latency,
      })
      if (this._responseTimes[cdnId].length > this._historyLimits.responseTimes) {
        this._responseTimes[cdnId].shift()
      }

      // 记录健康状态历史（保留最近N次）
      if (!this._history[cdnId]) {
        this._history[cdnId] = []
      }
      this._history[cdnId].push({
        time: now,
        healthy: result.healthy,
        latency: result.latency,
      })
      if (this._history[cdnId].length > this._historyLimits.healthHistory) {
        this._history[cdnId].shift()
      }

      // 更新健康计数
      if (!this._healthCounts[cdnId]) {
        this._healthCounts[cdnId] = { healthy: 0, unhealthy: 0 }
      }
      if (result.healthy) {
        this._healthCounts[cdnId].healthy++
        this._healthCounts[cdnId].unhealthy = 0
      } else {
        this._healthCounts[cdnId].unhealthy++
        this._healthCounts[cdnId].healthy = 0
      }
    },

    /**
     * 获取CDN的平均响应时间
     * @param {string} cdnId
     * @param {number} lastN - 取最近N次的平均值
     * @returns {number} 平均响应时间(ms)，无数据返回 Infinity
     */
    getAverageResponseTime(cdnId, lastN = 10) {
      const times = this._responseTimes[cdnId] || []
      const recent = times.slice(-lastN)
      if (recent.length === 0) {
        return Infinity
      }

      const total = recent.reduce((sum, item) => sum + item.latency, 0)
      return Math.round(total / recent.length)
    },

    /**
     * 获取CDN的健康率
     * @param {string} cdnId
     * @param {number} lastN - 取最近N次的健康率
     * @returns {number} 健康率(0-1)，无数据返回 0
     */
    getHealthRate(cdnId, lastN = 20) {
      const history = this._history[cdnId] || []
      const recent = history.slice(-lastN)
      if (recent.length === 0) {
        return 0
      }

      const healthyCount = recent.filter((item) => item.healthy).length
      return healthyCount / recent.length
    },

    /**
     * 获取CDN的探测间隔建议
     * 健康CDN：延长探测间隔
     * 不健康CDN：缩短探测间隔
     * @param {string} cdnId
     * @returns {number} 建议的探测间隔(ms)
     */
    getAdaptiveInterval(cdnId) {
      const cached = this._cache[cdnId]
      const counts = this._healthCounts[cdnId] || { healthy: 0, unhealthy: 0 }

      // 基础间隔配置
      const HEALTHY_BASE = 30 * 60 * 1000 // 健康CDN基础间隔：30分钟
      const UNHEALTHY_BASE = 1 * 60 * 1000 // 不健康CDN基础间隔：1分钟
      const DEGRADED_INTERVAL = 5 * 60 * 1000 // 未知状态间隔：5分钟
      const MAX_HEALTHY = 60 * 60 * 1000 // 最大健康间隔：1小时
      const MIN_UNHEALTHY = 30 * 1000 // 最小不健康间隔：30秒

      if (!cached) {
        return DEGRADED_INTERVAL
      }

      if (cached.healthy) {
        // 健康CDN：根据连续健康次数延长间隔（指数增长）
        const consecutiveHealthy = counts.healthy
        const multiplier = Math.min(
          Math.pow(1.5, Math.floor(consecutiveHealthy / 3)),
          MAX_HEALTHY / HEALTHY_BASE
        )
        return Math.min(HEALTHY_BASE * multiplier, MAX_HEALTHY)
      } else {
        // 不健康CDN：根据连续不健康次数缩短间隔（指数衰减）
        const consecutiveUnhealthy = counts.unhealthy
        const multiplier = Math.max(
          Math.pow(0.8, Math.floor(consecutiveUnhealthy / 2)),
          MIN_UNHEALTHY / UNHEALTHY_BASE
        )
        return Math.max(UNHEALTHY_BASE * multiplier, MIN_UNHEALTHY)
      }
    },

    /**
     * 批量探测一组CDN
     */
    async probeAll(cdnIds) {
      await Promise.allSettled(cdnIds.map((id) => this.probe(id)))
    },

    /**
     * 获取健康的CDN列表(按延迟排序)
     */
    getHealthy(cdnIds) {
      const now = Date.now()
      return cdnIds
        .map((id) => {
          const cached = this._cache[id]
          if (!cached || now - cached.timestamp >= this.TTL) {
            return null
          }
          return { id, ...cached }
        })
        .filter(Boolean)
        .filter((c) => c.healthy)
        .sort((a, b) => a.latency - b.latency)
    },

    /**
     * 标记CDN不可用(资源加载失败时调用)
     */
    markUnhealthy(cdnId) {
      this._cache[cdnId] = { healthy: false, latency: Infinity, timestamp: Date.now() }
      this._recordProbeResult(cdnId, { healthy: false, latency: Infinity, timestamp: Date.now() })
    },

    /**
     * 获取探测统计
     */
    getProbeStats() {
      const stats = {
        ...this._stats,
        averageResponseTime: 0,
        cdnStatus: {},
        healthDistribution: { healthy: 0, unhealthy: 0, unknown: 0 },
      }

      let totalLatency = 0
      let latencyCount = 0

      for (const cdn of CDN_SOURCES) {
        if (cdn.format === 'font') {
          continue
        }

        const cached = this._cache[cdn.id]
        const avgResponseTime = this.getAverageResponseTime(cdn.id)
        const healthRate = this.getHealthRate(cdn.id)

        stats.cdnStatus[cdn.id] = {
          name: cdn.name,
          healthy: cached?.healthy ?? null,
          lastProbeTime: cached?.timestamp || null,
          averageResponseTime: avgResponseTime === Infinity ? null : avgResponseTime,
          healthRate,
          probeCount: (this._history[cdn.id] || []).length,
        }

        if (cached?.healthy === true) {
          stats.healthDistribution.healthy++
        } else if (cached?.healthy === false) {
          stats.healthDistribution.unhealthy++
        } else {
          stats.healthDistribution.unknown++
        }

        if (avgResponseTime !== Infinity) {
          totalLatency += avgResponseTime
          latencyCount++
        }
      }

      if (latencyCount > 0) {
        stats.averageResponseTime = Math.round(totalLatency / latencyCount)
      }

      return stats
    },

    /**
     * 清除缓存
     */
    clear() {
      this._cache = {}
      this._history = {}
      this._responseTimes = {}
      this._healthCounts = {}
      this._stats = { totalProbes: 0, successfulProbes: 0, failedProbes: 0 }
    },
  }

  // ========== 匹配方法 ==========

  function matchFromMap(url, map, type) {
    if (!url || typeof url !== 'string') {
      return null
    }

    for (const [name, config] of Object.entries(map)) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          // 字体替换host类型
          if (config.replaceHost) {
            return {
              name,
              originalUrl: url,
              cdnUrl: url.replace(/fonts\.googleapis\.com/i, config.replaceHost),
              cdnName: CDN_BY_ID[config.cdnOrder?.[0]]?.name || config.replaceHost,
              description: config.description,
            }
          }

          // 提取版本
          const version = config.versionPatterns
            ? extractVersion(url, config.versionPatterns)
            : null

          // 按CDN降级链尝试(考虑健康状态)
          const cdnOrder = config.cdnOrder || ['jsdelivr', 'unpkg']
          const result = tryCDNChain(cdnOrder, config, version)

          if (result) {
            return {
              name,
              originalUrl: url,
              cdnUrl: result.url,
              version: version || config.defaultVersion,
              cdnName: CDN_BY_ID[result.cdnId]?.name || result.cdnId,
              cdnId: result.cdnId,
              fallbackUrls: result.fallbackUrls,
              type,
            }
          }
        }
      }
    }
    return null
  }

  /**
   * 计算CDN选择分数
   * 综合考虑健康状态、响应时间、历史成功率
   * @param {string} cdnId
   * @returns {number} 分数(0-100)，越高越优先
   */
  function _scoreCDN(cdnId) {
    const cached = CDNHealthProbe._cache[cdnId]
    const avgResponseTime = CDNHealthProbe.getAverageResponseTime(cdnId)
    const healthRate = CDNHealthProbe.getHealthRate(cdnId)

    let score = 0

    // 健康状态权重（0-50分）
    if (cached?.healthy) {
      score += 50
    } else if (!cached) {
      score += 25 // 未知状态：中等优先级
    }
    // 不健康：0分

    // 响应时间权重（0-30分，越快越高）
    if (avgResponseTime < 100) {
      score += 30
    } else if (avgResponseTime < 300) {
      score += 20
    } else if (avgResponseTime < 1000) {
      score += 10
    }
    // >= 1000ms 或 Infinity：0分

    // 历史成功率权重（0-20分）
    score += Math.round(healthRate * 20)

    return score
  }

  /**
   * 按CDN降级链构建URL(健康探测 + 备选URL)
   * 使用智能排序算法：健康状态 + 响应时间 + 历史成功率
   * 返回 { url, cdnId, fallbackUrls }
   */
  function tryCDNChain(cdnOrder, config, version) {
    // 智能排序：按分数降序
    const scoredCDNs = cdnOrder
      .map((cdnId) => ({ cdnId, score: _scoreCDN(cdnId) }))
      .sort((a, b) => b.score - a.score)

    const fallbackUrls = []
    let primary = null

    for (const { cdnId } of scoredCDNs) {
      const cdn = CDN_BY_ID[cdnId]
      if (!cdn) {
        continue
      }
      const url = buildCDNUrl(cdn, config, version, config.file)
      if (!url) {
        continue
      }

      if (!primary) {
        primary = { url, cdnId }
      } else {
        fallbackUrls.push({ url, cdnId })
      }
    }

    if (primary) {
      primary.fallbackUrls = fallbackUrls
      return primary
    }

    // 全部不可用时回退到第一个
    for (const cdnId of cdnOrder) {
      const cdn = CDN_BY_ID[cdnId]
      if (!cdn) {
        continue
      }
      const url = buildCDNUrl(cdn, config, version, config.file)
      if (url) {
        return { url, cdnId, fallbackUrls: [] }
      }
    }
    return null
  }

  function matchJSLibrary(url) {
    return matchFromMap(url, JS_CDN_MAP, 'js')
  }

  function matchCSS(url) {
    return matchFromMap(url, CSS_CDN_MAP, 'css')
  }

  function matchFont(url) {
    return matchFromMap(url, FONT_CDN_MAP, 'font')
  }

  // ========== 导出 ==========
  window.CDNMappings = {
    JS_CDN_MAP,
    CSS_CDN_MAP,
    FONT_CDN_MAP,
    CDN_SOURCES,
    CDN_BY_ID,
    CDNHealthProbe,
    extractVersion,
    matchJSLibrary,
    matchCSS,
    matchFont,
  }
})()
