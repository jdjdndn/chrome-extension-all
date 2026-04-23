/**
 * CDN 映射表配置
 * 用于智能资源加速器，替换慢速网站的JS库、字体资源为公共CDN
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

  // ========== JS库CDN映射表 ==========
  const JS_CDN_MAP = {
    jquery: {
      patterns: [
        /jquery[-.]?([\d.]+)?\.min\.js/i,
        /jquery\.js/i,
        /jquery-\d+\.\d+\.\d+\.js/i
      ],
      cdn: 'bootcdn',
      path: 'jquery/3.7.1/jquery.min.js',
      global: '$'
    },
    react: {
      patterns: [
        /react(?:\.production|\.development)?\.min\.js/i,
        /react\/[\d.]+\/react\.min\.js/i
      ],
      cdn: 'bootcdn',
      path: 'react/18.2.0/umd/react.production.min.js',
      global: 'React'
    },
    reactdom: {
      patterns: [
        /react-dom(?:\.production|\.development)?\.min\.js/i,
        /react-dom\/[\d.]+\/react-dom\.min\.js/i
      ],
      cdn: 'bootcdn',
      path: 'react-dom/18.2.0/umd/react-dom.production.min.js',
      global: 'ReactDOM'
    },
    vue: {
      patterns: [
        /vue(?:\.runtime)?(?:\.min)?\.js/i,
        /vue\/[\d.]+\/vue\.min\.js/i
      ],
      cdn: 'bootcdn',
      path: 'vue/3.4.21/vue.global.prod.min.js',
      global: 'Vue'
    },
    lodash: {
      patterns: [
        /lodash(?:[-.]?min)?\.js/i,
        /lodash\/[\d.]+\/lodash\.min\.js/i
      ],
      cdn: 'bootcdn',
      path: 'lodash.js/4.17.21/lodash.min.js',
      global: '_'
    },
    axios: {
      patterns: [
        /axios\.min\.js/i,
        /axios\/[\d.]+\/axios\.min\.js/i
      ],
      cdn: 'bootcdn',
      path: 'axios/1.6.7/axios.min.js',
      global: 'axios'
    },
    moment: {
      patterns: [
        /moment(?:\.min)?\.js/i,
        /moment\/[\d.]+\/moment\.min\.js/i
      ],
      cdn: 'bootcdn',
      path: 'moment.js/2.30.1/moment.min.js',
      global: 'moment'
    },
    echarts: {
      patterns: [
        /echarts(?:\.min)?\.js/i,
        /echarts\/[\d.]+\/echarts\.min\.js/i
      ],
      cdn: 'bootcdn',
      path: 'echarts/5.5.0/echarts.min.js',
      global: 'echarts'
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
  function matchJSLibrary(url) {
    if (!url || typeof url !== 'string') return null;

    for (const [name, config] of Object.entries(JS_CDN_MAP)) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          const cdnSource = CDN_SOURCES[config.cdn];
          return {
            name,
            originalUrl: url,
            cdnUrl: cdnSource.baseUrl + config.path,
            global: config.global,
            cdnName: cdnSource.name
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
    FONT_CDN_MAP,
    CDN_SOURCES,
    matchJSLibrary,
    matchFont
  };

})();
