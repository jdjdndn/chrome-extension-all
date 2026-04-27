/**
 * CDN 映射表配置
 * 用于智能资源加速器，替换慢速网站资源为公共CDN
 * 支持多CDN降级链: BootCDN → jsDelivr → unpkg
 * 只需定义库名和匹配规则，CDN路径自动生成
 */

(function () {
  'use strict';

  // ========== CDN 源配置(降级链) ==========
  const CDN_SOURCES = [
    // 国内优先
    {
      id: 'bootcdn',
      name: 'BootCDN',
      baseUrl: 'https://cdn.bootcdn.net/ajax/libs/',
      format: 'bootcdn' // base + package/version/file
    },
    {
      id: 'baomitu',
      name: '360前端(证书异常，降级)',
      baseUrl: 'https://cdn.baomitu.com/ajax/libs/',
      format: 'bootcdn',
      _disabled: true // SSL证书过期 ERR_CERT_DATE_INVALID
    },
    {
      id: 'staticfile',
      name: '七牛云',
      baseUrl: 'https://cdn.staticfile.org/',
      format: 'bootcdn'
    },
    {
      id: 'bytecdntp',
      name: '字节CDN',
      baseUrl: 'https://lf3-cdn-tos.bytecdntp.com/cdn/expire-1-M/',
      format: 'bootcdn'
    },
    // 全球CDN(国内有节点)
    {
      id: 'jsdelivr',
      name: 'jsDelivr',
      baseUrl: 'https://cdn.jsdelivr.net/npm/',
      format: 'npm' // base + package@version/file
    },
    {
      id: 'cdnjs',
      name: 'cdnjs',
      baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/',
      format: 'bootcdn'
    },
    {
      id: 'unpkg',
      name: 'unpkg',
      baseUrl: 'https://unpkg.com/',
      format: 'npm'
    },
    // 字体镜像
    {
      id: 'fontMirror',
      name: 'Font Mirror',
      baseUrl: 'https://fonts.font.im/',
      format: 'font'
    },
    {
      id: 'loli',
      name: 'LoliNet',
      baseUrl: 'https://fonts.loli.net/',
      format: 'font'
    },
    {
      id: 'fontsGoogle',
      name: 'Google Fonts(国内代理)',
      baseUrl: 'https://fonts.googleapis.cnpmjs.org/',
      format: 'font'
    }
  ];

  const CDN_BY_ID = {};
  CDN_SOURCES.forEach(s => CDN_BY_ID[s.id] = s);

  // ========== 版本提取工具 ==========
  function extractVersion(url, patterns) {
    if (!url) return null;
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  /**
   * 从URL中提取文件名部分
   */
  function extractFile(url) {
    try {
      const pathname = new URL(url).pathname;
      const parts = pathname.split('/');
      return parts[parts.length - 1] || '';
    } catch {
      return '';
    }
  }

  /**
   * 构建CDN URL
   */
  function buildCDNUrl(cdn, libConfig, version, file) {
    const ver = version || libConfig.defaultVersion;
    const pkg = libConfig.package || libConfig.name;
    const f = file || libConfig.file;

    if (cdn.format === 'bootcdn') {
      return cdn.baseUrl + pkg + '/' + ver + '/' + f;
    }
    if (cdn.format === 'npm') {
      return cdn.baseUrl + pkg + '@' + ver + '/' + f;
    }
    return null;
  }

  // ========== JS库映射 ==========
  // 只需: patterns(匹配), file(CDN文件名), 可选: package, defaultVersion
  const JS_CDN_MAP = {
    jquery: {
      patterns: [
        /jquery[-.]?([\d.]+)?\.min\.js/i,
        /jquery\.js/i,
        /jquery-(\d+\.\d+\.\d+)\.js/i
      ],
      versionPatterns: [
        /jquery[\/-](\d+\.\d+\.\d+)/i,
        /jquery[\/-](\d+\.\d+)/i
      ],
      package: 'jquery',
      file: 'jquery.min.js',
      defaultVersion: '3.7.1',
      global: '$',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    react: {
      patterns: [
        /react(?:\.production)?(?:\.min)?\.js/i,
        /react\/([\d.]+)\/umd\/react/i,
        /react@([\d.]+)\/umd\/react/i
      ],
      versionPatterns: [
        /react[\/@](\d+\.\d+\.\d+)/i,
        /react\.production\.min/i
      ],
      package: 'react',
      file: 'umd/react.production.min.js',
      defaultVersion: '18.2.0',
      global: 'React',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    reactDom: {
      patterns: [
        /react-dom(?:\.production)?(?:\.min)?\.js/i,
        /react-dom\/([\d.]+)\/umd\/react-dom/i,
        /react-dom@([\d.]+)\/umd\/react-dom/i
      ],
      versionPatterns: [
        /react-dom[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'react-dom',
      file: 'umd/react-dom.production.min.js',
      defaultVersion: '18.2.0',
      global: 'ReactDOM',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    vue: {
      patterns: [
        /vue(?:\.runtime)?(?:\.production)?(?:\.min)?\.js/i,
        /vue\/([\d.]+)\/dist\/vue/i,
        /vue@([\d.]+)\/dist\/vue/i
      ],
      versionPatterns: [
        /vue[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'vue',
      file: 'dist/vue.global.prod.min.js',
      defaultVersion: '3.4.21',
      global: 'Vue',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    lodash: {
      patterns: [
        /lodash(?:[-.]?min)?\.js/i,
        /lodash\/([\d.]+)\/lodash/i
      ],
      versionPatterns: [
        /lodash[\/-](\d+\.\d+\.\d+)/i,
        /lodash\.js\/(\d+\.\d+\.\d+)/i
      ],
      package: 'lodash',
      file: 'lodash.min.js',
      defaultVersion: '4.17.21',
      global: '_',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    axios: {
      patterns: [
        /axios\.min\.js/i,
        /axios\/([\d.]+)\/axios/i
      ],
      versionPatterns: [
        /axios\/(\d+\.\d+\.\d+)/i,
        /axios@(\d+\.\d+\.\d+)/i
      ],
      package: 'axios',
      file: 'dist/axios.min.js',
      defaultVersion: '1.6.7',
      global: 'axios',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    moment: {
      patterns: [
        /moment(?:\.min)?\.js/i,
        /moment\/([\d.]+)\/moment/i
      ],
      versionPatterns: [
        /moment[\/-](\d+\.\d+\.\d+)/i,
        /moment\.js\/(\d+\.\d+\.\d+)/i
      ],
      package: 'moment',
      file: 'min/moment.min.js',
      defaultVersion: '2.30.1',
      global: 'moment',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    echarts: {
      patterns: [
        /echarts(?:\.min)?\.js/i,
        /echarts\/([\d.]+)\/echarts/i
      ],
      versionPatterns: [
        /echarts\/(\d+\.\d+\.\d+)/i,
        /echarts@(\d+\.\d+\.\d+)/i
      ],
      package: 'echarts',
      file: 'dist/echarts.min.js',
      defaultVersion: '5.5.0',
      global: 'echarts',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    d3: {
      patterns: [
        /d3(?:\.min)?\.js/i,
        /d3\/([\d.]+)\/d3/i
      ],
      versionPatterns: [
        /d3\/(\d+\.\d+\.\d+)/i,
        /d3@(\d+\.\d+\.\d+)/i
      ],
      package: 'd3',
      file: 'dist/d3.min.js',
      defaultVersion: '7.8.5',
      global: 'd3',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    chartjs: {
      patterns: [
        /chart(?:\.js|\.min\.js)/i,
        /chart\.js\/([\d.]+)\/chart/i
      ],
      versionPatterns: [
        /chart\.js[\/-](\d+\.\d+\.\d+)/i,
        /chartjs\/(\d+\.\d+\.\d+)/i
      ],
      package: 'chart.js',
      file: 'dist/chart.umd.js',
      defaultVersion: '4.4.1',
      global: 'Chart',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg']
    },
    threejs: {
      patterns: [
        /three(?:\.min)?\.js/i,
        /three\/([\d.]+)\/three/i
      ],
      versionPatterns: [
        /three\/(\d+\.\d+\.\d+)/i,
        /three@(\d+\.\d+\.\d+)/i,
        /r(\d+)\/three/i
      ],
      package: 'three',
      file: 'build/three.min.js',
      defaultVersion: '0.168.0',
      global: 'THREE',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    dayjs: {
      patterns: [
        /dayjs(?:\.min)?\.js/i,
        /dayjs\/([\d.]+)\/dayjs/i
      ],
      versionPatterns: [
        /dayjs\/(\d+\.\d+\.\d+)/i,
        /dayjs@(\d+\.\d+\.\d+)/i
      ],
      package: 'dayjs',
      file: 'dayjs.min.js',
      defaultVersion: '1.11.10',
      global: 'dayjs',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    animejs: {
      patterns: [
        /anime(?:\.min)?\.js/i,
        /animejs\/([\d.]+)\/anime/i
      ],
      versionPatterns: [
        /anime[\/@](\d+\.\d+\.\d+)/i,
        /animejs\/(\d+\.\d+\.\d+)/i
      ],
      package: 'animejs',
      file: 'lib/anime.min.js',
      defaultVersion: '3.2.2',
      global: 'anime',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg']
    },
    hammerjs: {
      patterns: [
        /hammer(?:\.min)?\.js/i
      ],
      versionPatterns: [
        /hammer[\/.@](\d+\.\d+\.\d+)/i
      ],
      package: 'hammerjs',
      file: 'hammer.min.js',
      defaultVersion: '2.0.8',
      global: 'Hammer',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    // ========== 新增常用库 ==========
    jqueryUi: {
      patterns: [
        /jquery-ui(?:\.min)?\.js/i,
        /jqueryui\/([\d.]+)\/jquery-ui/i
      ],
      versionPatterns: [
        /jquery-ui[\/@](\d+\.\d+\.\d+)/i,
        /jqueryui[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'jquery-ui',
      file: 'dist/jquery-ui.min.js',
      defaultVersion: '1.13.2',
      global: 'jQuery',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    bootstrapJs: {
      patterns: [
        /bootstrap[\/-]([\d.]+)\/js\/bootstrap(?:\.bundle)?(?:\.min)?\.js/i,
        /bootstrap(?:\.bundle)?(?:\.min)?\.js/i
      ],
      versionPatterns: [
        /bootstrap[\/@-](\d+\.\d+\.\d+)/i
      ],
      package: 'bootstrap',
      file: 'dist/js/bootstrap.min.js',
      defaultVersion: '5.3.3',
      global: 'bootstrap',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    popper: {
      patterns: [
        /popper(?:\.umd)?(?:\.min)?\.js/i,
        /popper\.js\/([\d.]+)\/umd\/popper/i
      ],
      versionPatterns: [
        /popper[\/.@](\d+\.\d+\.\d+)/i
      ],
      package: '@popperjs/core',
      file: 'dist/umd/popper.min.js',
      defaultVersion: '2.11.8',
      global: 'Popper',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    swiper: {
      patterns: [
        /swiper(?:\.bundle)?(?:\.min)?\.js/i,
        /swiper\/([\d.]+)\/swiper/i
      ],
      versionPatterns: [
        /swiper[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'swiper',
      file: 'swiper-bundle.min.js',
      defaultVersion: '11.0.5',
      global: 'Swiper',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    select2: {
      patterns: [
        /select2(?:\.min)?\.js/i,
        /select2\/([\d.]+)\/js\/select2/i
      ],
      versionPatterns: [
        /select2[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'select2',
      file: 'dist/js/select2.min.js',
      defaultVersion: '4.0.13',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    gsap: {
      patterns: [
        /gsap(?:\.min)?\.js/i,
        /gsap\/([\d.]+)\/gsap/i
      ],
      versionPatterns: [
        /gsap[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'gsap',
      file: 'dist/gsap.min.js',
      defaultVersion: '3.12.5',
      global: 'gsap',
      cdnOrder: ['bootcdn', 'baomitu', 'jsdelivr', 'cdnjs']
    },
    socketio: {
      patterns: [
        /socket\.io(?:\.min)?\.js/i,
        /socket\.io\/([\d.]+)\/socket\.io/i
      ],
      versionPatterns: [
        /socket\.io[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'socket.io-client',
      file: 'dist/socket.io.min.js',
      defaultVersion: '4.7.4',
      global: 'io',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    zenscroll: {
      patterns: [
        /zenscroll(?:\.min)?\.js/i
      ],
      versionPatterns: [
        /zenscroll[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'zenscroll',
      file: 'zenscroll-min.js',
      defaultVersion: '4.0.2',
      cdnOrder: ['jsdelivr', 'unpkg']
    }
  };

  // ========== CSS框架映射 ==========
  const CSS_CDN_MAP = {
    bootstrap: {
      patterns: [
        /bootstrap[\/-]([\d.]+)\/css\/bootstrap(?:\.min)?\.css/i,
        /bootstrap\/([\d.]+)\/dist\/css\/bootstrap(?:\.min)?\.css/i,
        /bootstrap(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /bootstrap[\/@-](\d+\.\d+\.\d+)/i
      ],
      package: 'bootstrap',
      file: 'dist/css/bootstrap.min.css',
      defaultVersion: '5.3.3',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    bootstrapGrid: {
      patterns: [
        /bootstrap[\/-]([\d.]+)\/css\/bootstrap-grid(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /bootstrap[\/@-](\d+\.\d+\.\d+)/i
      ],
      package: 'bootstrap',
      file: 'dist/css/bootstrap-grid.min.css',
      defaultVersion: '5.3.3',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    tailwind: {
      patterns: [
        /tailwindcss\/([\d.]+)\/tailwind(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /tailwindcss[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'tailwindcss',
      file: 'dist/tailwind.min.css',
      defaultVersion: '2.2.19',
      cdnOrder: ['jsdelivr', 'unpkg']
    },
    foundation: {
      patterns: [
        /foundation[\/-]([\d.]+)\/css\/foundation(?:\.min)?\.css/i,
        /foundation(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /foundation[\/@-](\d+\.\d+\.\d+)/i
      ],
      package: 'foundation-sites',
      file: 'dist/css/foundation.min.css',
      defaultVersion: '6.8.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    animatecss: {
      patterns: [
        /animate\.css/i,
        /animate[\/-]([\d.]+)\/animate\.min\.css/i
      ],
      versionPatterns: [
        /animate\.css[\/@-](\d+\.\d+\.\d+)/i
      ],
      package: 'animate.css',
      file: 'animate.min.css',
      defaultVersion: '4.1.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    normalize: {
      patterns: [
        /normalize(?:\.min)?\.css/i,
        /normalize\/([\d.]+)\/normalize(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /normalize[\/-](\d+\.\d+\.\d+)/i
      ],
      package: 'normalize.css',
      file: 'normalize.min.css',
      defaultVersion: '8.0.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    // ========== 图标库 CSS ==========
    materialIcons: {
      patterns: [
        /material-icons(?:\.min)?\.css/i,
        /fonts\.googleapis\.com\/icon/i,
        /material\.io\/icons/i
      ],
      replaceHost: 'fonts.font.im',
      description: 'Material Icons'
    },
    materialSymbols: {
      patterns: [
        /material-symbols(?:\.outlined)?(?:\.min)?\.css/i,
        /fonts\.googleapis\.com\/css2\?.*material/i
      ],
      replaceHost: 'fonts.font.im',
      description: 'Material Symbols'
    },
    ionicons: {
      patterns: [
        /ionicons(?:\.min)?\.css/i,
        /ion\.icons\/([\d.]+)\/css\/ionicons/i
      ],
      versionPatterns: [
        /ionicons[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'ionicons',
      file: 'dist/css/ionicons.min.css',
      defaultVersion: '7.2.1',
      cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg']
    },
    // ========== 更多 CSS 库 ==========
    swiperCss: {
      patterns: [
        /swiper(?:\.bundle)?(?:\.min)?\.css/i,
        /swiper\/([\d.]+)\/swiper-bundle\.min\.css/i
      ],
      versionPatterns: [
        /swiper[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'swiper',
      file: 'swiper-bundle.min.css',
      defaultVersion: '11.0.5',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    },
    hoverCss: {
      patterns: [
        /hover(?:\.min)?\.css/i,
        /hover\.css\/([\d.]+)\/css/i
      ],
      versionPatterns: [
        /hover\.css[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'hover.css',
      file: 'css/hover-min.css',
      defaultVersion: '2.3.2',
      cdnOrder: ['bootcdn', 'baomitu', 'jsdelivr']
    },
    aos: {
      patterns: [
        /aos(?:\.min)?\.css/i,
        /aos\/([\d.]+)\/dist\/aos/i
      ],
      versionPatterns: [
        /aos[\/@](\d+\.\d+\.\d+)/i
      ],
      package: 'aos',
      file: 'dist/aos.css',
      defaultVersion: '2.3.4',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr']
    }
  };

  // ========== 字体映射 ==========
  const FONT_CDN_MAP = {
    googleFonts: {
      patterns: [
        /fonts\.googleapis\.com\/css/i
      ],
      replaceHost: 'fonts.font.im',
      description: 'Google Fonts CSS'
    },
    googleFontsEarlyaccess: {
      patterns: [
        /fonts\.googleapis\.com\/earlyaccess/i
      ],
      replaceHost: 'fonts.font.im',
      description: 'Google Fonts Early Access'
    },
    fontAwesome: {
      patterns: [
        /font-awesome\/[\d.]+\/css\/font-awesome\.min\.css/i,
        /fontawesome-free\/[\d.]+\/css\/all\.min\.css/i,
        /use\.fontawesome\.com\/releases\/[\d.]+\/css\/all\.css/i
      ],
      package: '@fortawesome/fontawesome-free',
      file: 'css/all.min.css',
      defaultVersion: '6.5.1',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
      description: 'FontAwesome 图标字体'
    },
    // ========== 新增字体映射 ==========
    fontAwesomeV4: {
      patterns: [
        /font-awesome\/4\.[\d.]+\/css\/font-awesome(?:\.min)?\.css/i,
        /maxcdn\.bootstrapcdn\.com\/font-awesome\/4/i
      ],
      package: 'font-awesome',
      file: 'css/font-awesome.min.css',
      defaultVersion: '4.7.0',
      cdnOrder: ['bootcdn', 'baomitu', 'staticfile', 'jsdelivr'],
      description: 'FontAwesome 4.x 图标字体'
    },
    iconfont: {
      patterns: [
        /at\.alicdn\.com\/t\/font_\d+/i
      ],
      description: '阿里巴巴 iconfont',
      // iconfont 无法替换，仅标记不处理
      skip: true
    }
  };

  // ========== 匹配方法 ==========

  function matchFromMap(url, map, type) {
    if (!url || typeof url !== 'string') return null;

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
              description: config.description
            };
          }

          // 提取版本
          const version = config.versionPatterns
            ? extractVersion(url, config.versionPatterns)
            : null;

          // 按CDN降级链尝试(考虑健康状态)
          const cdnOrder = config.cdnOrder || ['jsdelivr', 'unpkg'];
          const result = tryCDNChain(cdnOrder, config, version);

          if (result) {
            return {
              name,
              originalUrl: url,
              cdnUrl: result.url,
              version: version || config.defaultVersion,
              cdnName: CDN_BY_ID[result.cdnId]?.name || result.cdnId,
              cdnId: result.cdnId,
              fallbackUrls: result.fallbackUrls,
              type
            };
          }
        }
      }
    }
    return null;
  }

  /**
   * 按CDN降级链构建URL + 备选URL
   * 返回 { url, cdnId, fallbackUrls }
   */
  function tryCDNChain(cdnOrder, config, version) {
    const urls = [];

    for (const cdnId of cdnOrder) {
      const cdn = CDN_BY_ID[cdnId];
      if (!cdn || cdn._disabled) continue;
      const url = buildCDNUrl(cdn, config, version, config.file);
      if (url) urls.push({ url, cdnId });
    }

    if (urls.length === 0) return null;

    const [primary, ...fallbacks] = urls;
    primary.fallbackUrls = fallbacks;
    return primary;
  }

  function matchJSLibrary(url) {
    return matchFromMap(url, JS_CDN_MAP, 'js');
  }

  function matchCSS(url) {
    return matchFromMap(url, CSS_CDN_MAP, 'css');
  }

  function matchFont(url) {
    return matchFromMap(url, FONT_CDN_MAP, 'font');
  }

  // ========== 导出 ==========
  window.CDNMappings = {
    JS_CDN_MAP,
    CSS_CDN_MAP,
    FONT_CDN_MAP,
    CDN_SOURCES,
    CDN_BY_ID,
    extractVersion,
    matchJSLibrary,
    matchCSS,
    matchFont
  };

})();
