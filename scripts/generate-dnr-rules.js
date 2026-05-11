/**
 * DNR规则批量生成器
 * 从cdn-mappings.js自动生成declarativeNetRequest重定向规则
 */

const fs = require('fs')
const path = require('path')

// CDN源配置
const CDN_SOURCES = {
  bootcdn: {
    name: 'BootCDN',
    baseUrl: 'https://cdn.bootcdn.net/ajax/libs/',
    format: 'bootcdn',
  },
  staticfile: {
    name: '七牛云',
    baseUrl: 'https://cdn.staticfile.org/',
    format: 'bootcdn',
  },
  jsdelivr: {
    name: 'jsDelivr',
    baseUrl: 'https://cdn.jsdelivr.net/npm/',
    format: 'npm',
  },
  cdnjs: {
    name: 'cdnjs',
    baseUrl: 'https://cdnjs.cloudflare.com/ajax/libs/',
    format: 'bootcdn',
  },
  unpkg: {
    name: 'unpkg',
    baseUrl: 'https://unpkg.com/',
    format: 'npm',
  },
}

// 版本捕获模式：用于从URL中提取版本号
// 每个CDN源的版本号位置不同，需要不同的正则
const VERSION_PATTERNS = {
  // code.jquery.com/jquery-3.7.1.min.js → 捕获 3.7.1
  'code.jquery.com': {
    regex: '^https?://code\\.jquery\\.com/jquery-([\\d.]+)(?:\\.min)?\\.js$',
    versionGroup: 1,
  },
  // ajax.googleapis.com/ajax/libs/jquery/3.7.1/jquery.min.js → 捕获 3.7.1
  'ajax.googleapis.com': {
    regex: '^https?://ajax\\.googleapis\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js → 捕获 3.7.1
  'cdnjs.cloudflare.com': {
    regex: '^https?://cdnjs\\.cloudflare\\.com/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js → 捕获 3.7.1
  'cdn.jsdelivr.net': {
    regex: '^https?://cdn\\.jsdelivr\\.net/npm/[^@]+@([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // unpkg.com/jquery@3.7.1/dist/jquery.min.js → 捕获 3.7.1
  'unpkg.com': {
    regex: '^https?://unpkg\\.com/[^@]+@([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // stackpath.bootstrapcdn.com/bootstrap/5.3.3/js/bootstrap.min.js → 捕获 5.3.3
  'stackpath.bootstrapcdn.com': {
    regex: '^https?://stackpath\\.bootstrapcdn\\.com/[^/]+/([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // maxcdn.bootstrapcdn.com/bootstrap/5.3.3/js/bootstrap.min.js → 捕获 5.3.3
  'maxcdn.bootstrapcdn.com': {
    regex: '^https?://maxcdn\\.bootstrapcdn\\.com/[^/]+/([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // vjs.zencdn.net/8.10.0/video.min.js → 捕获 8.10.0
  'vjs.zencdn.net': {
    regex: '^https?://vjs\\.zencdn\\.net/([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // use.fontawesome.com/releases/v6.5.1/js/all.min.js → 捕获 6.5.1
  'use.fontawesome.com': {
    regex: '^https?://use\\.fontawesome\\.com/releases/v?([\\d.]+)/.*\\.js$',
    versionGroup: 1,
  },
  // cdn.tailwindcss.com → 无版本，跳过版本捕获
  'cdn.tailwindcss.com': {
    noVersion: true,
  },
}

// JS库映射（从cdn-mappings.js提取）
const JS_CDN_MAP = {
  jquery: {
    package: 'jquery',
    file: 'jquery.min.js',
    defaultVersion: '3.7.1',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'code.jquery.com/jquery-', // 匹配 jquery-3.7.1.min.js
      'ajax.googleapis.com/ajax/libs/jquery',
      'cdnjs.cloudflare.com/ajax/libs/jquery',
      'cdn.jsdelivr.net/npm/jquery',
      'unpkg.com/jquery',
    ],
  },
  react: {
    package: 'react',
    file: 'umd/react.production.min.js',
    defaultVersion: '18.2.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'unpkg.com/react',
      'cdn.jsdelivr.net/npm/react',
      'cdnjs.cloudflare.com/ajax/libs/react',
    ],
  },
  'react-dom': {
    package: 'react-dom',
    file: 'umd/react-dom.production.min.js',
    defaultVersion: '18.2.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'unpkg.com/react-dom',
      'cdn.jsdelivr.net/npm/react-dom',
      'cdnjs.cloudflare.com/ajax/libs/react-dom',
    ],
  },
  vue: {
    package: 'vue',
    file: 'dist/vue.global.prod.min.js',
    defaultVersion: '3.4.21',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/vue',
      'unpkg.com/vue',
      'cdnjs.cloudflare.com/ajax/libs/vue',
    ],
  },
  lodash: {
    package: 'lodash',
    file: 'lodash.min.js',
    defaultVersion: '4.17.21',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/lodash',
      'unpkg.com/lodash',
      'cdnjs.cloudflare.com/ajax/libs/lodash.js',
    ],
  },
  axios: {
    package: 'axios',
    file: 'dist/axios.min.js',
    defaultVersion: '1.6.7',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/axios',
      'unpkg.com/axios',
      'cdnjs.cloudflare.com/ajax/libs/axios',
    ],
  },
  moment: {
    package: 'moment',
    file: 'min/moment.min.js',
    defaultVersion: '2.30.1',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/moment',
      'unpkg.com/moment',
      'cdnjs.cloudflare.com/ajax/libs/moment.js',
    ],
  },
  echarts: {
    package: 'echarts',
    file: 'dist/echarts.min.js',
    defaultVersion: '5.5.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/echarts',
      'unpkg.com/echarts',
      'cdnjs.cloudflare.com/ajax/libs/echarts',
    ],
  },
  d3: {
    package: 'd3',
    file: 'dist/d3.min.js',
    defaultVersion: '7.8.5',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/d3',
      'unpkg.com/d3',
      'cdnjs.cloudflare.com/ajax/libs/d3',
    ],
  },
  'chart.js': {
    package: 'chart.js',
    file: 'dist/chart.umd.min.js',
    defaultVersion: '4.4.1',
    cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/chart.js',
      'unpkg.com/chart.js',
      'cdnjs.cloudflare.com/ajax/libs/Chart.js',
    ],
  },
  three: {
    package: 'three',
    file: 'build/three.min.js',
    defaultVersion: '0.168.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/three',
      'unpkg.com/three',
      'cdnjs.cloudflare.com/ajax/libs/three.js',
    ],
  },
  dayjs: {
    package: 'dayjs',
    file: 'dayjs.min.js',
    defaultVersion: '1.11.10',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/dayjs',
      'unpkg.com/dayjs',
      'cdnjs.cloudflare.com/ajax/libs/dayjs',
    ],
  },
  animejs: {
    package: 'animejs',
    file: 'lib/anime.min.js',
    defaultVersion: '3.2.2',
    cdnOrder: ['jsdelivr', 'cdnjs', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/animejs',
      'unpkg.com/animejs',
      'cdnjs.cloudflare.com/ajax/libs/animejs',
    ],
  },
  hammerjs: {
    package: 'hammerjs',
    file: 'hammer.min.js',
    defaultVersion: '2.0.8',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/hammerjs',
      'unpkg.com/hammerjs',
      'cdnjs.cloudflare.com/ajax/libs/hammer.js',
    ],
  },
  'jquery-ui': {
    package: 'jquery-ui',
    file: 'dist/jquery-ui.min.js',
    defaultVersion: '1.13.2',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'code.jquery.com/ui',
      'cdn.jsdelivr.net/npm/jquery-ui',
      'cdnjs.cloudflare.com/ajax/libs/jqueryui',
    ],
  },
  bootstrap: {
    package: 'bootstrap',
    file: 'dist/js/bootstrap.min.js',
    defaultVersion: '5.3.3',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'stackpath.bootstrapcdn.com/bootstrap',
      'maxcdn.bootstrapcdn.com/bootstrap',
      'cdn.jsdelivr.net/npm/bootstrap',
      'unpkg.com/bootstrap',
    ],
  },
  popper: {
    package: '@popperjs/core',
    file: 'dist/umd/popper.min.js',
    defaultVersion: '2.11.8',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/@popperjs/core',
      'unpkg.com/@popperjs/core',
      'cdnjs.cloudflare.com/ajax/libs/popper.js',
    ],
  },
  swiper: {
    package: 'swiper',
    file: 'swiper-bundle.min.js',
    defaultVersion: '11.0.5',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/swiper',
      'unpkg.com/swiper',
      'cdnjs.cloudflare.com/ajax/libs/Swiper',
    ],
  },
  select2: {
    package: 'select2',
    file: 'dist/js/select2.min.js',
    defaultVersion: '4.0.13',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/select2',
      'unpkg.com/select2',
      'cdnjs.cloudflare.com/ajax/libs/select2',
    ],
  },
  gsap: {
    package: 'gsap',
    file: 'dist/gsap.min.js',
    defaultVersion: '3.12.5',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/gsap',
      'unpkg.com/gsap',
      'cdnjs.cloudflare.com/ajax/libs/gsap',
    ],
  },
  'font-awesome': {
    package: '@fortawesome/fontawesome-free',
    file: 'js/all.min.js',
    defaultVersion: '6.5.1',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'use.fontawesome.com/releases',
      'cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free',
      'cdnjs.cloudflare.com/ajax/libs/font-awesome',
    ],
  },
  tailwindcss: {
    package: 'tailwindcss',
    file: 'lib/index.js', // Tailwind通常用CDN CSS
    defaultVersion: '3.4.1',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.tailwindcss.com', 'cdn.jsdelivr.net/npm/tailwindcss'],
  },
  alpine: {
    package: 'alpinejs',
    file: 'dist/cdn.min.js',
    defaultVersion: '3.13.5',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/alpinejs', 'unpkg.com/alpinejs'],
  },
  htmx: {
    package: 'htmx.org',
    file: 'dist/htmx.min.js',
    defaultVersion: '1.9.10',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/htmx.org', 'unpkg.com/htmx.org'],
  },
  underscore: {
    package: 'underscore',
    file: 'underscore-umd-min.js',
    defaultVersion: '1.13.6',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/underscore',
      'unpkg.com/underscore',
      'cdnjs.cloudflare.com/ajax/libs/underscore.js',
    ],
  },
  backbone: {
    package: 'backbone',
    file: 'backbone-min.js',
    defaultVersion: '1.5.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/backbone',
      'unpkg.com/backbone',
      'cdnjs.cloudflare.com/ajax/libs/backbone.js',
    ],
  },
  angular: {
    package: '@angular/core',
    file: 'bundles/core.umd.min.js',
    defaultVersion: '17.2.4',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/@angular/core',
      'unpkg.com/@angular/core',
      'ajax.googleapis.com/ajax/libs/angularjs',
    ],
  },
  svelte: {
    package: 'svelte',
    file: 'internal/index.mjs',
    defaultVersion: '4.2.12',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/svelte', 'unpkg.com/svelte'],
  },
  'socket.io': {
    package: 'socket.io-client',
    file: 'dist/socket.io.min.js',
    defaultVersion: '4.7.5',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/socket.io-client',
      'unpkg.com/socket.io-client',
      'cdnjs.cloudflare.com/ajax/libs/socket.io',
    ],
  },
  pdfjs: {
    package: 'pdfjs-dist',
    file: 'build/pdf.min.js',
    defaultVersion: '4.0.379',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/pdfjs-dist',
      'unpkg.com/pdfjs-dist',
      'cdnjs.cloudflare.com/ajax/libs/pdf.js',
    ],
  },
  videojs: {
    package: 'video.js',
    file: 'dist/video.min.js',
    defaultVersion: '8.10.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/video.js',
      'unpkg.com/video.js',
      'cdnjs.cloudflare.com/ajax/libs/video.js',
      'vjs.zencdn.net',
    ],
  },
  howler: {
    package: 'howler',
    file: 'dist/howler.min.js',
    defaultVersion: '2.2.4',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/howler',
      'unpkg.com/howler',
      'cdnjs.cloudflare.com/ajax/libs/howler',
    ],
  },
  numeral: {
    package: 'numeral',
    file: 'min/numeral.min.js',
    defaultVersion: '2.0.6',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/numeral',
      'unpkg.com/numeral',
      'cdnjs.cloudflare.com/ajax/libs/numeral.js',
    ],
  },
  accounting: {
    package: 'accounting',
    file: 'accounting.min.js',
    defaultVersion: '0.4.2',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/accounting',
      'unpkg.com/accounting',
      'cdnjs.cloudflare.com/ajax/libs/accounting.js',
    ],
  },
  marked: {
    package: 'marked',
    file: 'marked.min.js',
    defaultVersion: '12.0.1',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/marked',
      'unpkg.com/marked',
      'cdnjs.cloudflare.com/ajax/libs/marked',
    ],
  },
  highlightjs: {
    package: 'highlight.js',
    file: 'highlight.min.js',
    defaultVersion: '11.9.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/gh/highlightjs/cdn-release',
      'cdnjs.cloudflare.com/ajax/libs/highlight.js',
    ],
  },
  prism: {
    package: 'prismjs',
    file: 'prism.min.js',
    defaultVersion: '1.29.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/prismjs',
      'unpkg.com/prismjs',
      'cdnjs.cloudflare.com/ajax/libs/prism',
    ],
  },
  validator: {
    package: 'validator',
    file: 'validator.min.js',
    defaultVersion: '13.11.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/validator', 'unpkg.com/validator'],
  },
  uuid: {
    package: 'uuid',
    file: 'dist/umd/uuid.min.js',
    defaultVersion: '9.0.1',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/uuid',
      'unpkg.com/uuid',
      'cdnjs.cloudflare.com/ajax/libs/uuid',
    ],
  },
  cryptojs: {
    package: 'crypto-js',
    file: 'crypto-js.min.js',
    defaultVersion: '4.2.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/crypto-js',
      'unpkg.com/crypto-js',
      'cdnjs.cloudflare.com/ajax/libs/crypto-js',
    ],
  },
  jscookie: {
    package: 'js-cookie',
    file: 'dist/js.cookie.min.js',
    defaultVersion: '3.0.5',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/js-cookie',
      'unpkg.com/js-cookie',
      'cdnjs.cloudflare.com/ajax/libs/js-cookie',
    ],
  },
  storejs: {
    package: 'store',
    file: 'dist/store.legacy.min.js',
    defaultVersion: '2.0.12',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/store',
      'unpkg.com/store',
      'cdnjs.cloudflare.com/ajax/libs/store.js',
    ],
  },
  localforage: {
    package: 'localforage',
    file: 'dist/localforage.min.js',
    defaultVersion: '1.10.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/localforage',
      'unpkg.com/localforage',
      'cdnjs.cloudflare.com/ajax/libs/localforage',
    ],
  },
  pako: {
    package: 'pako',
    file: 'dist/pako.min.js',
    defaultVersion: '2.1.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/pako',
      'unpkg.com/pako',
      'cdnjs.cloudflare.com/ajax/libs/pako',
    ],
  },
  lzstring: {
    package: 'lz-string',
    file: 'libs/lz-string.min.js',
    defaultVersion: '1.5.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/lz-string',
      'unpkg.com/lz-string',
      'cdnjs.cloudflare.com/ajax/libs/lz-string',
    ],
  },
  mathjs: {
    package: 'mathjs',
    file: 'lib/browser/math.min.js',
    defaultVersion: '12.4.1',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/mathjs',
      'unpkg.com/mathjs',
      'cdnjs.cloudflare.com/ajax/libs/mathjs',
    ],
  },
  ramda: {
    package: 'ramda',
    file: 'dist/ramda.min.js',
    defaultVersion: '0.29.1',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/ramda',
      'unpkg.com/ramda',
      'cdnjs.cloudflare.com/ajax/libs/ramda',
    ],
  },
  immutable: {
    package: 'immutable',
    file: 'dist/immutable.min.js',
    defaultVersion: '5.0.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/immutable',
      'unpkg.com/immutable',
      'cdnjs.cloudflare.com/ajax/libs/immutable',
    ],
  },
  mout: {
    package: 'mout',
    file: 'mout.min.js',
    defaultVersion: '1.3.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/mout', 'unpkg.com/mout'],
  },
  datefns: {
    package: 'date-fns',
    file: 'bundle.js',
    defaultVersion: '3.4.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/date-fns', 'unpkg.com/date-fns'],
  },
  timeago: {
    package: 'timeago.js',
    file: 'dist/timeago.min.js',
    defaultVersion: '4.0.2',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/timeago.js', 'unpkg.com/timeago.js'],
  },
  spin: {
    package: 'spin.js',
    file: 'dist/spin.min.js',
    defaultVersion: '4.1.1',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/spin.js',
      'unpkg.com/spin.js',
      'cdnjs.cloudflare.com/ajax/libs/spin.js',
    ],
  },
  toastr: {
    package: 'toastr',
    file: 'build/toastr.min.js',
    defaultVersion: '2.1.4',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/toastr',
      'unpkg.com/toastr',
      'cdnjs.cloudflare.com/ajax/libs/toastr.js',
    ],
  },
  sweetalert: {
    package: 'sweetalert2',
    file: 'dist/sweetalert2.all.min.js',
    defaultVersion: '11.10.6',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/sweetalert2',
      'unpkg.com/sweetalert2',
      'cdnjs.cloudflare.com/ajax/libs/limonte-sweetalert2',
    ],
  },
  notyf: {
    package: 'notyf',
    file: 'notyf.min.js',
    defaultVersion: '3.10.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/notyf',
      'unpkg.com/notyf',
      'cdnjs.cloudflare.com/ajax/libs/notyf',
    ],
  },
  pace: {
    package: 'pace-js',
    file: 'pace.min.js',
    defaultVersion: '1.2.4',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/pace-js',
      'unpkg.com/pace-js',
      'cdnjs.cloudflare.com/ajax/libs/pace',
    ],
  },
  nprogress: {
    package: 'nprogress',
    file: 'nprogress.min.js',
    defaultVersion: '0.2.0',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/nprogress',
      'unpkg.com/nprogress',
      'cdnjs.cloudflare.com/ajax/libs/nprogress',
    ],
  },
  isotope: {
    package: 'isotope-layout',
    file: 'dist/isotope.pkgd.min.js',
    defaultVersion: '3.0.6',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/isotope-layout',
      'unpkg.com/isotope-layout',
      'cdnjs.cloudflare.com/ajax/libs/jquery.isotope',
    ],
  },
  masonry: {
    package: 'masonry-layout',
    file: 'dist/masonry.pkgd.min.js',
    defaultVersion: '4.2.2',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/masonry-layout',
      'unpkg.com/masonry-layout',
      'cdnjs.cloudflare.com/ajax/libs/masonry',
    ],
  },
  imagesloaded: {
    package: 'imagesloaded',
    file: 'imagesloaded.pkgd.min.js',
    defaultVersion: '5.0.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/imagesloaded',
      'unpkg.com/imagesloaded',
      'cdnjs.cloudflare.com/ajax/libs/jquery.imagesloaded',
    ],
  },
  lazysizes: {
    package: 'lazysizes',
    file: 'lazysizes.min.js',
    defaultVersion: '5.3.2',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/lazysizes',
      'unpkg.com/lazysizes',
      'cdnjs.cloudflare.com/ajax/libs/lazysizes',
    ],
  },
  lozad: {
    package: 'lozad',
    file: 'dist/lozad.min.js',
    defaultVersion: '1.16.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/lozad', 'unpkg.com/lozad'],
  },
  particles: {
    package: 'particles.js',
    file: 'particles.min.js',
    defaultVersion: '2.0.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/particles.js',
      'unpkg.com/particles.js',
      'cdnjs.cloudflare.com/ajax/libs/particles.js',
    ],
  },
  typed: {
    package: 'typed.js',
    file: 'dist/typed.umd.js',
    defaultVersion: '2.1.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/typed.js',
      'unpkg.com/typed.js',
      'cdnjs.cloudflare.com/ajax/libs/typed.js',
    ],
  },
  countup: {
    package: 'countup.js',
    file: 'dist/countUp.umd.js',
    defaultVersion: '2.8.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/countup.js',
      'unpkg.com/countup.js',
      'cdnjs.cloudflare.com/ajax/libs/countup.js',
    ],
  },
  aos: {
    package: 'aos',
    file: 'dist/aos.js',
    defaultVersion: '2.3.4',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/aos',
      'unpkg.com/aos',
      'cdnjs.cloudflare.com/ajax/libs/aos',
    ],
  },
  wow: {
    package: 'wow.js',
    file: 'dist/wow.min.js',
    defaultVersion: '1.2.2',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/wow.js',
      'unpkg.com/wow.js',
      'cdnjs.cloudflare.com/ajax/libs/wow',
    ],
  },
  scrollmagic: {
    package: 'scrollmagic',
    file: 'minified/ScrollMagic.min.js',
    defaultVersion: '2.0.8',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/scrollmagic',
      'unpkg.com/scrollmagic',
      'cdnjs.cloudflare.com/ajax/libs/ScrollMagic',
    ],
  },
  scrollTo: {
    package: 'scrollto',
    file: 'dist scrollTo.min.js',
    defaultVersion: '3.0.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/scrollto', 'unpkg.com/scrollto'],
  },
  smoothscroll: {
    package: 'smoothscroll-polyfill',
    file: 'dist/smoothscroll.min.js',
    defaultVersion: '0.4.4',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/smoothscroll-polyfill',
      'unpkg.com/smoothscroll-polyfill',
    ],
  },
  layzr: {
    package: 'layzr.js',
    file: 'dist/layzr.module.min.js',
    defaultVersion: '2.2.2',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/layzr.js', 'unpkg.com/layzr.js'],
  },
  mediumzoom: {
    package: 'medium-zoom',
    file: 'dist/medium-zoom.min.js',
    defaultVersion: '1.1.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/medium-zoom', 'unpkg.com/medium-zoom'],
  },
  spotlight: {
    package: 'spotlight.js',
    file: 'dist/spotlight.bundle.js',
    defaultVersion: '0.7.8',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/spotlight.js', 'unpkg.com/spotlight.js'],
  },
  glightbox: {
    package: 'glightbox',
    file: 'dist/js/glightbox.min.js',
    defaultVersion: '3.2.0',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/glightbox', 'unpkg.com/glightbox'],
  },
  fancybox: {
    package: '@fancyapps/ui',
    file: 'dist/fancybox/fancybox.umd.js',
    defaultVersion: '5.0.36',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/@fancyapps/ui',
      'unpkg.com/@fancyapps/ui',
      'cdnjs.cloudflare.com/ajax/libs/fancybox',
    ],
  },
  photoswipe: {
    package: 'photoswipe',
    file: 'dist/umd/photoswipe.umd.min.js',
    defaultVersion: '5.4.3',
    cdnOrder: ['jsdelivr', 'unpkg'],
    sourcePatterns: [
      'cdn.jsdelivr.net/npm/photoswipe',
      'unpkg.com/photoswipe',
      'cdnjs.cloudflare.com/ajax/libs/photoswipe',
    ],
  },
  swiper11: {
    package: 'swiper',
    file: 'swiper-bundle.min.js',
    defaultVersion: '11.0.5',
    cdnOrder: ['staticfile', 'bootcdn', 'jsdelivr'],
    sourcePatterns: ['cdn.jsdelivr.net/npm/swiper@11', 'unpkg.com/swiper@11'],
  },
}

// 生成DNR规则
function generateDNRRules() {
  const rules = []
  let ruleId = 4001

  for (const [libName, config] of Object.entries(JS_CDN_MAP)) {
    const { package: pkg, file, defaultVersion, cdnOrder, sourcePatterns } = config

    // 获取首选CDN
    const primaryCDN = cdnOrder[0]
    const cdnConfig = CDN_SOURCES[primaryCDN]

    // 为每个源URL模式生成规则
    for (const sourcePattern of sourcePatterns) {
      // 提取域名
      const domain = sourcePattern.split('/')[0]
      const versionPattern = VERSION_PATTERNS[domain]

      // === 规则1：带版本号的URL - 使用 regexFilter + regexSubstitution 保留版本 ===
      if (versionPattern && !versionPattern.noVersion) {
        // 构建带版本捕获的正则
        const regexFilter = buildVersionRegex(sourcePattern, pkg, file, versionPattern)
        if (regexFilter) {
          // 构建替换模板（保留捕获的版本号）
          const substitution = buildSubstitution(cdnConfig, pkg, file)

          rules.push({
            id: ruleId++,
            priority: 2, // 高优先级：带版本的先匹配
            action: {
              type: 'redirect',
              redirect: { regexSubstitution: substitution },
            },
            condition: {
              regexFilter,
              resourceTypes: ['script'],
              excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
            },
          })
        }
      }

      // === 规则2：无版本号的URL - 重定向到默认版本 ===
      // 根据 sourcePattern 是否以路径分隔符结尾决定匹配模式
      const urlFilter =
        sourcePattern.endsWith('/') || sourcePattern.endsWith('-')
          ? `*://${sourcePattern}*`
          : `*://${sourcePattern}/*`

      // 构建目标URL
      let targetUrl
      if (cdnConfig.format === 'npm') {
        targetUrl = `${cdnConfig.baseUrl}${pkg}@${defaultVersion}/${file}`
      } else {
        targetUrl = `${cdnConfig.baseUrl}${pkg}/${defaultVersion}/${file}`
      }

      rules.push({
        id: ruleId++,
        priority: 1,
        action: {
          type: 'redirect',
          redirect: { url: targetUrl },
        },
        condition: {
          urlFilter,
          resourceTypes: ['script'],
          excludedInitiatorDomains: ['cdn.bootcdn.net', 'cdn.staticfile.org'],
        },
      })

      // 限制规则数量，避免超出DNR限制
      if (rules.length >= 500) {
        console.log('达到500条规则限制，停止生成')
        return rules
      }
    }
  }

  return rules
}

/**
 * 构建版本捕获正则
 * 例：code.jquery.com/jquery-3.7.1.min.js → ^https?://code\.jquery\.com/jquery-([\d.]+)(?:\.min)?\.js$
 */
function buildVersionRegex(sourcePattern, pkg, file, versionPattern) {
  // 转义域名中的特殊字符
  const domain = sourcePattern.split('/')[0]
  const escapedDomain = domain.replace(/\./g, '\\.')
  const escapedPkg = pkg.replace(/\//g, '\\/')

  // 判断CDN格式
  if (domain === 'cdn.jsdelivr.net' || domain === 'unpkg.com') {
    // npm 格式：cdn.jsdelivr.net/npm/package@version/file 或 unpkg.com/package@version/file
    if (domain === 'cdn.jsdelivr.net') {
      return `^https?://${escapedDomain}/npm/${escapedPkg}@([\\d.]+)/.*\\.js$`
    } else {
      return `^https?://${escapedDomain}/${escapedPkg}@([\\d.]+)/.*\\.js$`
    }
  } else if (sourcePattern.includes('/ajax/libs/')) {
    // Google/CDNJS 格式：ajax/libs/package/version/file
    return `^https?://${escapedDomain}/ajax/libs/[^/]+/([\\d.]+)/.*\\.js$`
  } else if (sourcePattern.endsWith('-')) {
    // code.jquery.com 格式：jquery-version.min.js
    return `^https?://${escapedDomain}/[^-]+-([\\d.]+)(?:\\.min)?\\.js$`
  } else if (sourcePattern.includes('bootstrapcdn.com')) {
    // BootstrapCDN 格式：bootstrap/5.3.3/js/bootstrap.min.js
    return `^https?://${escapedDomain}/[^/]+/([\\d.]+)/.*\\.js$`
  } else if (sourcePattern.includes('fontawesome.com')) {
    // FontAwesome 格式：releases/v6.5.1/js/all.min.js
    return `^https?://${escapedDomain}/releases/v?([\\d.]+)/.*\\.js$`
  } else {
    // 通用格式：package/version/file
    const escapedPath = escapedPattern(sourcePattern.replace(domain, '').replace(/^\//, ''))
    return `^https?://${escapedDomain}/${escapedPath}/([\\d.]+)/.*\\.js$`
  }
}

/**
 * 构建替换模板
 * 例：https://cdn.staticfile.org/jquery/\\1/jquery.min.js
 * 其中 \\1 是捕获的版本号
 * 注意：JavaScript 字符串需要双重转义，输出为 \\1，在 JSON 中会变成 \\\\1
 */
function buildSubstitution(cdnConfig, pkg, file) {
  // 静态文件CDN和npm格式CDN的版本路径不同
  // staticfile: https://cdn.staticfile.org/jquery/3.7.1/jquery.min.js
  // jsdelivr: https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js
  if (cdnConfig.format === 'npm') {
    return `${cdnConfig.baseUrl}${pkg}@\\1/${file}`
  } else {
    // bootcdn/staticfile 格式
    return `${cdnConfig.baseUrl}${pkg}/\\1/${file}`
  }
}

/**
 * 转义路径中的正则特殊字符（保留版本捕获组）
 */
function escapedPattern(pattern) {
  return pattern.replace(/\./g, '\\.').replace(/\//g, '\\/').replace(/\-/g, '\\-')
}

// 转义正则特殊字符
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 生成代码
function generateCode(rules) {
  const ruleDefinitions = rules
    .map((rule) => {
      return `  {
    id: ${rule.id},
    priority: ${rule.priority},
    action: ${JSON.stringify(rule.action, null, 4)},
    condition: ${JSON.stringify(rule.condition, null, 4)}
  }`
    })
    .join(',\n')

  return `/**
 * 自动生成的DNR JS重定向规则
 * 生成时间: ${new Date().toISOString()}
 * 规则数量: ${rules.length}
 * 规则ID范围: 4001-${rules[rules.length - 1].id}
 */

const AUTO_GENERATED_JS_REDIRECT_RULES = [
${ruleDefinitions}
]

// 导出
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AUTO_GENERATED_JS_REDIRECT_RULES }
}
`
}

// 主函数
function main() {
  console.log('开始生成DNR规则...')

  const rules = generateDNRRules()

  console.log(`生成了 ${rules.length} 条规则`)

  const code = generateCode(rules)

  // 写入文件
  const outputPath = path.join(__dirname, '../background-dnr-rules-auto.js')
  fs.writeFileSync(outputPath, code, 'utf-8')

  console.log(`规则已写入: ${outputPath}`)

  // 统计信息
  const stats = {
    total: rules.length,
    byCDN: {},
    byType: { regex: 0, url: 0 },
  }

  rules.forEach((rule) => {
    const redirect = rule.action.redirect
    const url = redirect.url || redirect.regexSubstitution || ''

    // 统计规则类型
    if (redirect.regexSubstitution) {
      stats.byType.regex++
    } else if (redirect.url) {
      stats.byType.url++
    }

    // 统计CDN分布
    const cdn =
      Object.entries(CDN_SOURCES).find(([id, config]) =>
        url.includes(config.baseUrl.replace('https://', '').split('/')[0])
      )?.[0] || 'unknown'

    stats.byCDN[cdn] = (stats.byCDN[cdn] || 0) + 1
  })

  console.log('\n统计信息:')
  console.log('总规则数:', stats.total)
  console.log('规则类型:', stats.byType)
  console.log('按CDN分布:', stats.byCDN)
}

// 执行
main()
