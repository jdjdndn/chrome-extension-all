/**
 * CDN 映射表配置
 * 用于智能资源加速器，替换慢速网站的JS库、字体、CSS框架资源为公共CDN
 * 支持从原始URL动态提取版本号
 */

(function () {
  'use strict';

  // ========== CDN 源配置 ==========
  const CDN_SOURCES = {
    bootcdn: {
      name: 'BootCDN',
      baseUrl: 'https://cdn.bootcdn.net/ajax/libs/',
      description: '国内稳定CDN，支持主流库'
    },
    fontMirror: {
      name: 'Font Mirror',
      baseUrl: 'https://fonts.font.im/',
      description: 'Google Fonts 镜像'
    },
    loli: {
      name: 'LoliNet',
      baseUrl: 'https://fonts.loli.net/',
      description: 'Google Fonts 备用镜像'
    }
  };

  // ========== 版本提取工具 ==========
  function extractVersion(url, patterns) {
    if (!url) return null;
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  }

  // ========== JS库CDN映射表 ==========
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
      cdn: 'bootcdn',
      pathTemplate: 'jquery/{version}/jquery.min.js',
      defaultVersion: '3.7.1',
      path: 'jquery/3.7.1/jquery.min.js',
      global: '$'
    },
    react: {
      patterns: [
        /react(?:\.production|\.development)?\.min\.js/i,
        /react\/([\d.]+)\/react\.min\.js/i
      ],
      versionPatterns: [
        /react\/(\d+\.\d+\.\d+)/i,
        /react@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'react/{version}/umd/react.production.min.js',
      defaultVersion: '18.2.0',
      path: 'react/18.2.0/umd/react.production.min.js',
      global: 'React'
    },
    reactdom: {
      patterns: [
        /react-dom(?:\.production|\.development)?\.min\.js/i,
        /react-dom\/([\d.]+)\/react-dom\.min\.js/i
      ],
      versionPatterns: [
        /react-dom\/(\d+\.\d+\.\d+)/i,
        /react-dom@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'react-dom/{version}/umd/react-dom.production.min.js',
      defaultVersion: '18.2.0',
      path: 'react-dom/18.2.0/umd/react-dom.production.min.js',
      global: 'ReactDOM'
    },
    vue: {
      patterns: [
        /vue(?:\.runtime)?(?:\.min)?\.js/i,
        /vue\/([\d.]+)\/vue\.min\.js/i
      ],
      versionPatterns: [
        /vue\/(\d+\.\d+\.\d+)/i,
        /vue@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'vue/{version}/vue.global.prod.min.js',
      defaultVersion: '3.4.21',
      path: 'vue/3.4.21/vue.global.prod.min.js',
      global: 'Vue'
    },
    lodash: {
      patterns: [
        /lodash(?:[-.]?min)?\.js/i,
        /lodash\/([\d.]+)\/lodash\.min\.js/i
      ],
      versionPatterns: [
        /lodash[\/-](\d+\.\d+\.\d+)/i,
        /lodash\.js\/(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'lodash.js/{version}/lodash.min.js',
      defaultVersion: '4.17.21',
      path: 'lodash.js/4.17.21/lodash.min.js',
      global: '_'
    },
    axios: {
      patterns: [
        /axios\.min\.js/i,
        /axios\/([\d.]+)\/axios\.min\.js/i
      ],
      versionPatterns: [
        /axios\/(\d+\.\d+\.\d+)/i,
        /axios@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'axios/{version}/axios.min.js',
      defaultVersion: '1.6.7',
      path: 'axios/1.6.7/axios.min.js',
      global: 'axios'
    },
    moment: {
      patterns: [
        /moment(?:\.min)?\.js/i,
        /moment\/([\d.]+)\/moment\.min\.js/i
      ],
      versionPatterns: [
        /moment[\/-](\d+\.\d+\.\d+)/i,
        /moment\.js\/(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'moment.js/{version}/moment.min.js',
      defaultVersion: '2.30.1',
      path: 'moment.js/2.30.1/moment.min.js',
      global: 'moment'
    },
    echarts: {
      patterns: [
        /echarts(?:\.min)?\.js/i,
        /echarts\/([\d.]+)\/echarts\.min\.js/i
      ],
      versionPatterns: [
        /echarts\/(\d+\.\d+\.\d+)/i,
        /echarts@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'echarts/{version}/echarts.min.js',
      defaultVersion: '5.5.0',
      path: 'echarts/5.5.0/echarts.min.js',
      global: 'echarts'
    },
    d3: {
      patterns: [
        /d3(?:\.min)?\.js/i,
        /d3\/([\d.]+)\/d3\.min\.js/i
      ],
      versionPatterns: [
        /d3\/(\d+\.\d+\.\d+)/i,
        /d3@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'd3/{version}/d3.min.js',
      defaultVersion: '7.8.5',
      path: 'd3/7.8.5/d3.min.js',
      global: 'd3'
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
      cdn: 'bootcdn',
      pathTemplate: 'Chart.js/{version}/chart.umd.js',
      defaultVersion: '4.4.1',
      path: 'Chart.js/4.4.1/chart.umd.js',
      global: 'Chart'
    },
    threejs: {
      patterns: [
        /three(?:\.min)?\.js/i,
        /three\/([\d.]+)\/three\.min\.js/i
      ],
      versionPatterns: [
        /three\/(\d+)/i,
        /three@(\d+\.\d+\.\d+)/i,
        /r(\d+)\/three/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'three.js/{version}/three.min.js',
      defaultVersion: 'r168',
      path: 'three.js/r168/three.min.js',
      global: 'THREE'
    },
    dayjs: {
      patterns: [
        /dayjs(?:\.min)?\.js/i,
        /dayjs\/([\d.]+)\/dayjs\.min\.js/i
      ],
      versionPatterns: [
        /dayjs\/(\d+\.\d+\.\d+)/i,
        /dayjs@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'dayjs/{version}/dayjs.min.js',
      defaultVersion: '1.11.10',
      path: 'dayjs/1.11.10/dayjs.min.js',
      global: 'dayjs'
    },
    animejs: {
      patterns: [
        /anime(?:\.min)?\.js/i,
        /animejs\/([\d.]+)\/anime\.min\.js/i
      ],
      versionPatterns: [
        /anime[\/@](\d+\.\d+\.\d+)/i,
        /animejs\/(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'animejs/{version}/anime.min.js',
      defaultVersion: '3.2.2',
      path: 'animejs/3.2.2/anime.min.js',
      global: 'anime'
    },
    hammerjs: {
      patterns: [
        /hammer(?:\.min)?\.js/i
      ],
      versionPatterns: [
        /hammer[\/.@](\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'hammer.js/{version}/hammer.min.js',
      defaultVersion: '2.0.8',
      path: 'hammer.js/2.0.8/hammer.min.js',
      global: 'Hammer'
    }
  };

  // ========== CSS框架CDN映射表 ==========
  const CSS_CDN_MAP = {
    bootstrap: {
      patterns: [
        /bootstrap[\/-]([\d.]+)\/css\/bootstrap(?:\.min)?\.css/i,
        /bootstrap\/([\d.]+)\/dist\/css\/bootstrap(?:\.min)?\.css/i,
        /bootstrap(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /bootstrap[\/-](\d+\.\d+\.\d+)/i,
        /bootstrap@(\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'bootstrap/{version}/css/bootstrap.min.css',
      defaultVersion: '5.3.3',
      path: 'bootstrap/5.3.3/css/bootstrap.min.css'
    },
    bootstrapGrid: {
      patterns: [
        /bootstrap[\/-]([\d.]+)\/css\/bootstrap-grid(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /bootstrap[\/-](\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'bootstrap/{version}/css/bootstrap-grid.min.css',
      defaultVersion: '5.3.3',
      path: 'bootstrap/5.3.3/css/bootstrap-grid.min.css'
    },
    tailwind: {
      patterns: [
        /tailwindcss\/([\d.]+)\/tailwind(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /tailwindcss[\/@](\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'tailwindcss/{version}/tailwind.min.css',
      defaultVersion: '2.2.19',
      path: 'tailwindcss/2.2.19/tailwind.min.css'
    },
    foundation: {
      patterns: [
        /foundation[\/-]([\d.]+)\/css\/foundation(?:\.min)?\.css/i,
        /foundation(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /foundation[\/-](\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'foundation/{version}/css/foundation.min.css',
      defaultVersion: '6.8.1',
      path: 'foundation/6.8.1/css/foundation.min.css'
    },
    animatecss: {
      patterns: [
        /animate\.css/i,
        /animate[\/-]([\d.]+)\/animate\.min\.css/i
      ],
      versionPatterns: [
        /animate\.css[\/@-](\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'animate.css/{version}/animate.min.css',
      defaultVersion: '4.1.1',
      path: 'animate.css/4.1.1/animate.min.css'
    },
    normalize: {
      patterns: [
        /normalize(?:\.min)?\.css/i,
        /normalize\/([\d.]+)\/normalize(?:\.min)?\.css/i
      ],
      versionPatterns: [
        /normalize[\/-](\d+\.\d+\.\d+)/i
      ],
      cdn: 'bootcdn',
      pathTemplate: 'normalize/{version}/normalize.min.css',
      defaultVersion: '8.0.1',
      path: 'normalize/8.0.1/normalize.min.css'
    }
  };

  // ========== 字体CDN映射表 ==========
  const FONT_CDN_MAP = {
    googleFonts: {
      patterns: [
        /fonts\.googleapis\.com\/css/i,
        /fonts\.googleapis\.com\/css2/i
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
      cdn: 'bootcdn',
      path: 'font-awesome/6.5.1/css/all.min.css',
      description: 'FontAwesome 图标字体'
    }
  };

  // ========== 匹配方法 ==========

  /**
   * 构建带版本的CDN URL
   */
  function buildCDNUrl(config, url) {
    const cdnSource = CDN_SOURCES[config.cdn];

    // 尝试从URL提取版本
    if (config.versionPatterns && config.pathTemplate) {
      const version = extractVersion(url, config.versionPatterns);
      if (version) {
        return cdnSource.baseUrl + config.pathTemplate.replace('{version}', version);
      }
    }

    // 回退到默认路径
    return cdnSource.baseUrl + config.path;
  }

  function matchJSLibrary(url) {
    if (!url || typeof url !== 'string') return null;

    for (const [name, config] of Object.entries(JS_CDN_MAP)) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          const cdnUrl = buildCDNUrl(config, url);
          return {
            name,
            originalUrl: url,
            cdnUrl,
            global: config.global,
            cdnName: CDN_SOURCES[config.cdn].name
          };
        }
      }
    }
    return null;
  }

  function matchCSS(url) {
    if (!url || typeof url !== 'string') return null;

    for (const [name, config] of Object.entries(CSS_CDN_MAP)) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          const cdnUrl = buildCDNUrl(config, url);
          return {
            name,
            originalUrl: url,
            cdnUrl,
            cdnName: CDN_SOURCES[config.cdn].name
          };
        }
      }
    }
    return null;
  }

  function matchFont(url) {
    if (!url || typeof url !== 'string') return null;

    for (const [name, config] of Object.entries(FONT_CDN_MAP)) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          if (config.replaceHost) {
            return {
              name,
              originalUrl: url,
              cdnUrl: url.replace(/fonts\.googleapis\.com/i, config.replaceHost),
              description: config.description
            };
          }
          if (config.cdn) {
            const cdnSource = CDN_SOURCES[config.cdn];
            return {
              name,
              originalUrl: url,
              cdnUrl: cdnSource.baseUrl + config.path,
              description: config.description
            };
          }
        }
      }
    }
    return null;
  }

  // ========== 导出 ==========
  window.CDNMappings = {
    JS_CDN_MAP,
    CSS_CDN_MAP,
    FONT_CDN_MAP,
    CDN_SOURCES,
    extractVersion,
    matchJSLibrary,
    matchCSS,
    matchFont
  };

})();
