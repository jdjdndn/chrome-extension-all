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
      name: '360前端(证书异常，降级)',
      baseUrl: 'https://cdn.baomitu.com/ajax/libs/',
      format: 'bootcdn',
      _disabled: true, // SSL证书过期 ERR_CERT_DATE_INVALID
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
  ]

  const CDN_BY_ID = {}
  CDN_SOURCES.forEach((s) => (CDN_BY_ID[s.id] = s))

  // ========== 版本提取工具 ==========
  function extractVersion(url, patterns) {
    if (!url) {return null}
    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match && match[1]) {return match[1]}
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
      // 更精确的模式：避免匹配 swiper2、swiper3 等
      patterns: [
        /swiper(?:\.bundle)?(?:\.min)?\.js$/i, // 必须以 .js 结尾
        /swiper\/([\d.]+)\/swiper/i,
        /swiper-bundle(?:\.min)?\.js$/i,
      ],
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
    // ========== v4 新增库 ==========
    alpine: {
      patterns: [/alpine(?:\.min)?\.js/i, /alpinejs[\/@]([\d.]+)\/dist\/alpine/i],
      versionPatterns: [/alpinejs[\/@](\d+\.\d+\.\d+)/i],
      package: 'alpinejs',
      file: 'dist/cdn.min.js',
      defaultVersion: '3.14.3',
      global: 'Alpine',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    htmx: {
      patterns: [/htmx(?:\.min)?\.js/i, /htmx[\/@]([\d.]+)\/dist\/htmx/i],
      versionPatterns: [/htmx[\/@](\d+\.\d+\.\d+)/i],
      package: 'htmx.org',
      file: 'dist/htmx.min.js',
      defaultVersion: '2.0.4',
      global: 'htmx',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    lottie: {
      patterns: [/lottie(?:\.min)?\.js/i, /lottie-web[\/@]([\d.]+)\/build\/player\/lottie/i],
      versionPatterns: [/lottie-web[\/@](\d+\.\d+\.\d+)/i],
      package: 'lottie-web',
      file: 'build/player/lottie.min.js',
      defaultVersion: '5.12.2',
      global: 'lottie',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    splide: {
      patterns: [/splide(?:\.min)?\.js/i, /@splidejs[\/]splide[\/@]([\d.]+)\/dist\/js\/splide/i],
      versionPatterns: [/splide[\/@](\d+\.\d+\.\d+)/i],
      package: '@splidejs/splide',
      file: 'dist/js/splide.min.js',
      defaultVersion: '4.1.6',
      cdnOrder: ['jsdelivr', 'unpkg'],
    },
    noUiSlider: {
      patterns: [/nouislider(?:\.min)?\.js/i, /nouislider[\/@]([\d.]+)\/dist\/nouislider/i],
      versionPatterns: [/nouislider[\/@](\d+\.\d+\.\d+)/i],
      package: 'nouislider',
      file: 'dist/nouislider.min.js',
      defaultVersion: '15.7.1',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    flatpickr: {
      patterns: [/flatpickr(?:\.min)?\.js/i, /flatpickr[\/@]([\d.]+)\/dist\/flatpickr/i],
      versionPatterns: [/flatpickr[\/@](\d+\.\d+\.\d+)/i],
      package: 'flatpickr',
      file: 'dist/flatpickr.min.js',
      defaultVersion: '4.6.13',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    tomSelect: {
      patterns: [
        /tom-select(?:\.complete)?(?:\.min)?\.js/i,
        /tom-select[\/@]([\d.]+)\/dist\/js\/tom-select\.complete/i,
      ],
      versionPatterns: [/tom-select[\/@](\d+\.\d+\.\d+)/i],
      package: 'tom-select',
      file: 'dist/js/tom-select.complete.min.js',
      defaultVersion: '2.3.1',
      cdnOrder: ['jsdelivr', 'unpkg'],
    },
    sortable: {
      patterns: [/sortable(?:\.min)?\.js/i, /sortablejs[\/@]([\d.]+)\/Sortable\.min/i],
      versionPatterns: [/sortablejs[\/@](\d+\.\d+\.\d+)/i, /Sortable@([\d.]+)/i],
      package: 'sortablejs',
      file: 'Sortable.min.js',
      defaultVersion: '1.15.3',
      global: 'Sortable',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    },
    stimulus: {
      patterns: [/stimulus(?:\.min)?\.js/i, /@hotwired[\/]stimulus[\/@]([\d.]+)\/dist\/stimulus/i],
      versionPatterns: [/stimulus[\/@](\d+\.\d+\.\d+)/i],
      package: '@hotwired/stimulus',
      file: 'dist/stimulus.umd.js',
      defaultVersion: '3.2.2',
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
    // ========== v4 新增 CSS 库 ==========
    picoCss: {
      patterns: [/pico(?:\.min)?\.css/i, /@picocss[\/]pico[\/@]([\d.]+)\/css\/pico/i],
      versionPatterns: [/pico[\/@](\d+\.\d+\.\d+)/i],
      package: '@picocss/pico',
      file: 'css/pico.min.css',
      defaultVersion: '2.0.6',
      cdnOrder: ['jsdelivr', 'unpkg'],
    },
    openProps: {
      patterns: [
        /open-props(?:\.min)?\.css/i,
        /open-props[\/@]([\d.]+)\/open-props(?:\.min)?\.css/i,
      ],
      versionPatterns: [/open-props[\/@](\d+\.\d+\.\d+)/i],
      package: 'open-props',
      file: 'open-props.min.css',
      defaultVersion: '1.7.7',
      cdnOrder: ['jsdelivr', 'unpkg'],
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

  // ========== 智能 URL 解析（自动识别 npm 包）==========

  // 通用 npm 包名提取模式
  const GENERIC_PACKAGE_PATTERNS = [
    // @scope/package@version/file.js 或 @scope/package@version.js
    /\/(@[a-z0-9-]+\/[a-z0-9-]+)@([a-z0-9._-]+)\/?.*\.js$/i,
    // @scope/package/file.js (无版本，从路径提取)
    /\/(@[a-z0-9-]+\/[a-z0-9-]+)\/(?:v?[\d.]+|latest)\/.*\.js$/i,
    // package@version/file.js
    /\/([a-z][a-z0-9._-]*)@([a-z0-9._-]+)\/?.*\.js$/i,
    // package/version/file.js
    /\/([a-z][a-z0-9._-]*)\/(v?[\d.]+)\/.*\.js$/i,
    // package-version.min.js (简单模式)
    /\/([a-z][a-z0-9._-]*)[-.]?([\d.]+)?(?:\.min)?\.js$/i,
  ]

  /**
   * 从 URL 中智能提取包名和版本
   * 返回 { packageName, version } 或 null
   */
  function extractPackageInfo(url) {
    if (!url || typeof url !== 'string') {return null}

    try {
      const urlObj = new URL(url)
      const pathname = urlObj.pathname

      for (const pattern of GENERIC_PACKAGE_PATTERNS) {
        const match = pathname.match(pattern)
        if (match) {
          const packageName = match[1]
          let version = match[2] || null

          // 清理版本号
          if (version) {
            version = version.replace(/^v/i, '')
            // 只保留有效版本格式
            if (!/^\d+\.\d+/.test(version)) {version = null}
          }

          // 跳过已知的非包名模式
          if (skipPackage(packageName)) {continue}

          return { packageName, version }
        }
      }
    } catch {}

    return null
  }

  /**
   * 判断是否应跳过的包名（静态资源、非JS库等）
   */
  function skipPackage(name) {
    if (!name) {return true}
    const lower = name.toLowerCase()
    // 跳过常见非包名路径
    const skipList = [
      'static',
      'assets',
      'public',
      'lib',
      'vendor',
      'dist',
      'build',
      'js',
      'scripts',
      'bundle',
      'app',
      'main',
      'index',
      'common',
      'utils',
      'helpers',
      'components',
      'modules',
      'plugins',
      'css',
      'style',
      'styles',
      'images',
      'img',
      'fonts',
    ]
    return skipList.includes(lower) || /^\d/.test(lower)
  }

  /**
   * 智能匹配：根据提取的包信息构建 CDN URL
   */
  function smartMatchJSLibrary(url) {
    const info = extractPackageInfo(url)
    if (!info) {return null}

    const { packageName, version } = info
    const fallbackVersion = version || 'latest'

    // 构建 jsDelivr URL (npm 格式)
    const jsdelivrUrl = `https://cdn.jsdelivr.net/npm/${packageName}@${fallbackVersion}/${packageName}.min.js`

    // 构建备选 CDN URLs
    const fallbackUrls = [
      {
        url: `https://unpkg.com/${packageName}@${fallbackVersion}/${packageName}.min.js`,
        cdnId: 'unpkg',
      },
      {
        url: `https://cdnjs.cloudflare.com/ajax/libs/${packageName}/${fallbackVersion}/${packageName}.min.js`,
        cdnId: 'cdnjs',
      },
    ]

    return {
      name: packageName,
      originalUrl: url,
      cdnUrl: jsdelivrUrl,
      version: fallbackVersion,
      cdnName: 'jsDelivr (auto)',
      cdnId: 'jsdelivr',
      fallbackUrls,
      type: 'js',
      isAutoDetected: true,
    }
  }

  // ========== jsDelivr API 动态查询 ==========

  const _jsdelivrCache = new Map() // packageName -> { exists, version, file, timestamp }
  const JSDELIVR_CACHE_TTL = 30 * 60 * 1000 // 30分钟缓存
  const JSDELIVR_RATE_LIMIT = 100 // 100ms 间隔
  let _lastJsdelivrQuery = 0

  /**
   * 通过 jsDelivr API 查询 npm 包信息
   * 返回 { packageName, version, file } 或 null
   */
  async function queryJsdelivrAPI(packageName) {
    if (!packageName) {return null}

    // 检查缓存
    const cached = _jsdelivrCache.get(packageName)
    if (cached && Date.now() - cached.timestamp < JSDELIVR_CACHE_TTL) {
      return cached.exists ? cached : null
    }

    // 速率限制
    const now = Date.now()
    const waitTime = JSDELIVR_RATE_LIMIT - (now - _lastJsdelivrQuery)
    if (waitTime > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitTime))
    }
    _lastJsdelivrQuery = Date.now()

    try {
      // 查询包的最新版本
      const response = await fetch(
        `https://data.jsdelivr.com/v1/packages/npm/${encodeURIComponent(packageName)}/flat`,
        { signal: AbortSignal.timeout(3000) }
      )

      if (!response.ok) {
        _jsdelivrCache.set(packageName, { exists: false, timestamp: Date.now() })
        return null
      }

      const data = await response.json()
      if (!data || !data.files || data.files.length === 0) {
        _jsdelivrCache.set(packageName, { exists: false, timestamp: Date.now() })
        return null
      }

      // 查找常见的入口文件
      const commonFiles = [
        `${packageName}.min.js`,
        `${packageName}.js`,
        `dist/${packageName}.min.js`,
        `dist/${packageName}.js`,
        `dist/${packageName}.umd.min.js`,
        `dist/${packageName}.umd.js`,
        `build/${packageName}.min.js`,
        `lib/${packageName}.min.js`,
        `index.min.js`,
        `index.js`,
      ]

      let foundFile = null
      for (const file of commonFiles) {
        if (data.files.some((f) => f.name === file)) {
          foundFile = file
          break
        }
      }

      if (!foundFile) {
        _jsdelivrCache.set(packageName, { exists: false, timestamp: Date.now() })
        return null
      }

      const version = data.version || 'latest'
      const result = {
        exists: true,
        packageName,
        version,
        file: foundFile,
        timestamp: Date.now(),
      }

      _jsdelivrCache.set(packageName, result)
      return result
    } catch {
      _jsdelivrCache.set(packageName, { exists: false, timestamp: Date.now() })
      return null
    }
  }

  /**
   * 通过 jsDelivr API 动态匹配 JS 库
   */
  async function dynamicMatchJSLibrary(url) {
    const info = extractPackageInfo(url)
    if (!info) {return null}

    const pkgInfo = await queryJsdelivrAPI(info.packageName)
    if (!pkgInfo) {return null}

    const version = info.version || pkgInfo.version
    const jsdelivrUrl = `https://cdn.jsdelivr.net/npm/${pkgInfo.packageName}@${version}/${pkgInfo.file}`

    return {
      name: pkgInfo.packageName,
      originalUrl: url,
      cdnUrl: jsdelivrUrl,
      version,
      cdnName: 'jsDelivr (dynamic)',
      cdnId: 'jsdelivr',
      fallbackUrls: [
        {
          url: `https://unpkg.com/${pkgInfo.packageName}@${version}/${pkgInfo.file}`,
          cdnId: 'unpkg',
        },
      ],
      type: 'js',
      isDynamic: true,
    }
  }

  // ========== 匹配方法 ==========

  function matchFromMap(url, map, type) {
    if (!url || typeof url !== 'string') {return null}

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
   * 按CDN降级链构建URL + 备选URL
   * 返回 { url, cdnId, fallbackUrls }
   */
  function tryCDNChain(cdnOrder, config, version) {
    // 过滤不健康CDN，全部不健康时降级为原始顺序
    const healthyOrder = getHealthyCDNOrder(cdnOrder)
    const effectiveOrder = healthyOrder.length > 0 ? healthyOrder : cdnOrder

    const urls = []

    for (const cdnId of effectiveOrder) {
      const cdn = CDN_BY_ID[cdnId]
      if (!cdn || cdn._disabled) {continue}
      const url = buildCDNUrl(cdn, config, version, config.file)
      if (url) {urls.push({ url, cdnId })}
    }

    if (urls.length === 0) {return null}

    const [primary, ...fallbacks] = urls
    primary.fallbackUrls = fallbacks
    return primary
  }

  function matchJSLibrary(url) {
    // 优先使用硬编码映射
    const hardcoded = matchFromMap(url, JS_CDN_MAP, 'js')
    if (hardcoded) {return hardcoded}

    // 硬编码匹配失败，尝试智能 URL 解析
    return smartMatchJSLibrary(url)
  }

  /**
   * 异步匹配 JS 库（包含 jsDelivr API 查询）
   * 用于需要完整功能的场景
   */
  async function matchJSLibraryAsync(url) {
    // 优先使用硬编码映射
    const hardcoded = matchFromMap(url, JS_CDN_MAP, 'js')
    if (hardcoded) {return hardcoded}

    // 尝试智能 URL 解析（同步）
    const smart = smartMatchJSLibrary(url)
    if (smart) {return smart}

    // 最后尝试 jsDelivr API 动态查询（异步）
    return await dynamicMatchJSLibrary(url)
  }

  function matchCSS(url) {
    return matchFromMap(url, CSS_CDN_MAP, 'css')
  }

  function matchFont(url) {
    return matchFromMap(url, FONT_CDN_MAP, 'font')
  }

  // ========== CDN健康探测 ==========

  const _cdnHealth = {}
  const HEALTH_KEY = 'cdnHealthCache'
  const HEALTH_TTL = 5 * 60 * 1000 // 5分钟缓存

  async function probeCDN(cdn) {
    const start = performance.now()
    try {
      await fetch(cdn.baseUrl, {
        method: 'HEAD',
        mode: 'no-cors',
        signal: AbortSignal.timeout(3000),
      })
      return { healthy: true, rtt: Math.round(performance.now() - start) }
    } catch {
      return { healthy: false, rtt: Infinity }
    }
  }

  async function probeAllCDNs(options = {}) {
    // 读取缓存
    try {
      const cached = await chrome.storage.local.get(HEALTH_KEY)
      if (cached[HEALTH_KEY]?.timestamp > Date.now() - HEALTH_TTL) {
        Object.assign(_cdnHealth, cached[HEALTH_KEY].data || {})
        return
      }
    } catch {}

    const enabledCDNs = CDN_SOURCES.filter((c) => !c._disabled)
    const priorityIds = options.priorityIds || []

    // 将 CDN 按优先级排序：priorityIds 中的排在前面
    const sortedCDNs = enabledCDNs.sort((a, b) => {
      const aIdx = priorityIds.indexOf(a.id)
      const bIdx = priorityIds.indexOf(b.id)
      // 优先级列表中的 CDN 排在前面，按列表顺序排序；不在列表中的保持原顺序
      if (aIdx !== -1 && bIdx !== -1) {return aIdx - bIdx}
      if (aIdx !== -1) {return -1}
      if (bIdx !== -1) {return 1}
      return 0
    })

    // 按顺序串行探测优先 CDN，并行探测其余 CDN
    const priorityCDNs = sortedCDNs.filter((c) => priorityIds.includes(c.id))
    const otherCDNs = sortedCDNs.filter((c) => !priorityIds.includes(c.id))

    // 先探测优先 CDN（串行，确保优先级生效）
    for (const cdn of priorityCDNs) {
      _cdnHealth[cdn.id] = await probeCDN(cdn)
      _cdnHealth[cdn.id].lastProbe = Date.now()
    }

    // 并行探测其余 CDN
    const otherProbes = otherCDNs.map(async (cdn) => {
      _cdnHealth[cdn.id] = await probeCDN(cdn)
      _cdnHealth[cdn.id].lastProbe = Date.now()
    })
    await Promise.allSettled(otherProbes)

    // 缓存结果
    try {
      await chrome.storage.local.set({ [HEALTH_KEY]: { data: _cdnHealth, timestamp: Date.now() } })
    } catch {}
  }

  function getCDNHealth() {
    return { ..._cdnHealth }
  }

  function getHealthyCDNOrder(cdnOrder) {
    return cdnOrder.filter((id) => {
      const health = _cdnHealth[id]
      return !health || (health.healthy && health.rtt < 500)
    })
  }

  // ========== 导出 ==========
  window.CDNMappings = {
    JS_CDN_MAP,
    CSS_CDN_MAP,
    FONT_CDN_MAP,
    CDN_SOURCES,
    CDN_BY_ID,
    extractVersion,
    extractPackageInfo,
    matchJSLibrary,
    matchJSLibraryAsync,
    matchCSS,
    matchFont,
    probeAllCDNs,
    getCDNHealth,
    getHealthyCDNOrder,
    // 测试/调试用
    _jsdelivrCache,
    queryJsdelivrAPI,
  }
})()
