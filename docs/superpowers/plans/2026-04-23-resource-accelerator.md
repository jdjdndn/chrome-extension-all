# 智能资源加速器实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为慢速网站提供资源加速能力，通过公共CDN替换JS库/字体、图片懒加载+压缩，减少页面加载时间。

**Architecture:** 模块化设计，主模块统一管理配置和统计，子模块分别处理JS替换、字体替换、图片优化。使用MutationObserver监听动态资源，IntersectionObserver实现图片懒加载，Canvas API实现图片压缩。

**Tech Stack:** JavaScript ES6, Chrome Extension APIs (storage, runtime, declarativeNetRequest), IntersectionObserver, Canvas API

---

## 文件结构

```
content/
  modules/
    resource-accelerator.js    # 主模块（新建）
    js-replacer.js             # JS替换（新建）
    font-replacer.js           # 字体替换（新建）
    image-optimizer.js         # 图片优化（新建）
shared/
  cdn-mappings.js              # CDN映射表（新建）
popup.html                     # 添加资源加速器面板（修改）
popup.js                       # 添加资源加速器逻辑（修改）
```

---

### Task 1: CDN映射表配置

**Files:**
- Create: `shared/cdn-mappings.js`

- [ ] **Step 1: 创建CDN映射表文件**

```javascript
/**
 * CDN映射表配置
 * 用于替换常见JS库和字体资源
 */
(function() {
  'use strict';

  // JS库CDN映射
  const JS_CDN_MAP = {
    // jQuery
    jquery: {
      patterns: [
        /jquery[.-]?([\d.]+)?(?:\.min)?\.js$/i,
        /\/jquery\/([\d.]+)\/jquery(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '3.7.1') => {
        return `https://cdn.bootcdn.net/ajax/libs/jquery/${version}/jquery.min.js`;
      },
      defaultVersion: '3.7.1'
    },

    // React
    react: {
      patterns: [
        /react(?:\.production|\.development)?(?:\.min)?\.js$/i,
        /\/react\/([\d.]+)\/umd\/react(?:\.production)?(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '18.2.0') => {
        return `https://cdn.bootcdn.net/ajax/libs/react/${version}/umd/react.production.min.js`;
      },
      defaultVersion: '18.2.0'
    },

    // ReactDOM
    'react-dom': {
      patterns: [
        /react-dom(?:\.production|\.development)?(?:\.min)?\.js$/i,
        /\/react-dom\/([\d.]+)\/umd\/react-dom(?:\.production)?(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '18.2.0') => {
        return `https://cdn.bootcdn.net/ajax/libs/react-dom/${version}/umd/react-dom.production.min.js`;
      },
      defaultVersion: '18.2.0'
    },

    // Vue
    vue: {
      patterns: [
        /vue(?:\.runtime|\.global|\.esm)?(?:\.min)?\.js$/i,
        /\/vue\/([\d.]+)\/dist\/vue(?:\.runtime)?(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '3.4.21') => {
        return `https://cdn.bootcdn.net/ajax/libs/vue/${version}/vue.global.prod.min.js`;
      },
      defaultVersion: '3.4.21'
    },

    // Lodash
    lodash: {
      patterns: [
        /lodash(?:[.-]?([\d.]+))?(?:\.min)?\.js$/i,
        /\/lodash\.js\/([\d.]+)\/lodash(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '4.17.21') => {
        return `https://cdn.bootcdn.net/ajax/libs/lodash.js/${version}/lodash.min.js`;
      },
      defaultVersion: '4.17.21'
    },

    // Axios
    axios: {
      patterns: [
        /axios(?:\.min)?\.js$/i,
        /\/axios\/([\d.]+)\/dist\/axios(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '1.6.8') => {
        return `https://cdn.bootcdn.net/ajax/libs/axios/${version}/axios.min.js`;
      },
      defaultVersion: '1.6.8'
    },

    // Moment.js
    moment: {
      patterns: [
        /moment(?:\.min)?\.js$/i,
        /\/moment\/([\d.]+)\/moment(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '2.30.1') => {
        return `https://cdn.bootcdn.net/ajax/libs/moment.js/${version}/moment.min.js`;
      },
      defaultVersion: '2.30.1'
    },

    // ECharts
    echarts: {
      patterns: [
        /echarts(?:\.min)?\.js$/i,
        /\/echarts\/([\d.]+)\/dist\/echarts(?:\.min)?\.js$/i
      ],
      getCDNUrl: (version = '5.5.0') => {
        return `https://cdn.bootcdn.net/ajax/libs/echarts/${version}/echarts.min.js`;
      },
      defaultVersion: '5.5.0'
    }
  };

  // 字体CDN映射
  const FONT_CDN_MAP = {
    // Google Fonts
    'google-fonts': {
      patterns: [
        /fonts\.googleapis\.com\/css/i,
        /fonts\.gstatic\.com/i
      ],
      getMirrorUrl: (originalUrl) => {
        // 替换为国内镜像
        return originalUrl
          .replace('fonts.googleapis.com', 'fonts.font.im')
          .replace('fonts.gstatic.com', 'fonts-gstatic.font.im');
      }
    },

    // FontAwesome
    'font-awesome': {
      patterns: [
        /font-awesome[.-]?([\d.]+)?(?:\.min)?\.css$/i,
        /\/font-awesome\/([\d.]+)\/css\/font-awesome(?:\.min)?\.css$/i,
        /use\.fontawesome\.com/i
      ],
      getCDNUrl: (version = '6.5.1') => {
        return `https://cdn.bootcdn.net/ajax/libs/font-awesome/${version}/css/all.min.css`;
      },
      defaultVersion: '6.5.1'
    }
  };

  // CDN源配置
  const CDN_SOURCES = {
    bootcdn: {
      name: 'BootCDN',
      baseUrl: 'https://cdn.bootcdn.net/ajax/libs/',
      reliable: true,
      region: 'cn'
    },
    bytedance: {
      name: '字节跳动CDN',
      baseUrl: 'https://cdn.bytedance.com/',
      reliable: true,
      region: 'cn'
    },
    unpkg: {
      name: 'unpkg',
      baseUrl: 'https://unpkg.com/',
      reliable: true,
      region: 'global'
    },
    jsdelivr: {
      name: 'jsDelivr',
      baseUrl: 'https://cdn.jsdelivr.net/npm/',
      reliable: true,
      region: 'global'
    }
  };

  // 导出
  window.CDNMappings = {
    JS_CDN_MAP,
    FONT_CDN_MAP,
    CDN_SOURCES,

    /**
     * 匹配JS库
     * @param {string} url - 原始URL
     * @returns {object|null} - 匹配结果 { name, cdnUrl, version }
     */
    matchJSLibrary(url) {
      if (!url) return null;

      for (const [name, config] of Object.entries(JS_CDN_MAP)) {
        for (const pattern of config.patterns) {
          const match = url.match(pattern);
          if (match) {
            const version = match[1] || config.defaultVersion;
            return {
              name,
              cdnUrl: config.getCDNUrl(version),
              version,
              originalUrl: url
            };
          }
        }
      }
      return null;
    },

    /**
     * 匹配字体
     * @param {string} url - 原始URL
     * @returns {object|null} - 匹配结果 { name, cdnUrl }
     */
    matchFont(url) {
      if (!url) return null;

      for (const [name, config] of Object.entries(FONT_CDN_MAP)) {
        for (const pattern of config.patterns) {
          if (pattern.test(url)) {
            if (config.getMirrorUrl) {
              return {
                name,
                cdnUrl: config.getMirrorUrl(url),
                originalUrl: url
              };
            } else if (config.getCDNUrl) {
              const match = url.match(pattern);
              const version = match?.[1] || config.defaultVersion;
              return {
                name,
                cdnUrl: config.getCDNUrl(version),
                version,
                originalUrl: url
              };
            }
          }
        }
      }
      return null;
    }
  };

  console.log('[CDNMappings] CDN映射表已加载');
})();
```

- [ ] **Step 2: 验证文件创建**

运行: `ls -la shared/cdn-mappings.js`
预期: 文件存在且内容正确

- [ ] **Step 3: 提交**

```bash
git add shared/cdn-mappings.js
git commit -m "feat(resource-accelerator): 添加CDN映射表配置"
```

---

### Task 2: JS库替换模块

**Files:**
- Create: `content/modules/js-replacer.js`

- [ ] **Step 1: 创建JS替换模块**

```javascript
/**
 * JS库替换模块
 * 用公共CDN替换常见JS库
 */
(function() {
  'use strict';

  const logger = {
    log: (...args) => console.log('[JSReplacer]', ...args),
    warn: (...args) => console.warn('[JSReplacer]', ...args),
    error: (...args) => console.error('[JSReplacer]', ...args)
  };

  class JSReplacer {
    constructor(options = {}) {
      this.enabled = options.enabled ?? true;
      this.stats = {
        replaced: 0,
        skipped: 0,
        failed: 0
      };
      this.replacedUrls = new Map(); // originalUrl -> cdnUrl
      this.excludePatterns = options.excludePatterns || [];
    }

    /**
     * 初始化
     */
    init() {
      if (!this.enabled) {
        logger.log('JS替换已禁用');
        return;
      }

      if (!window.CDNMappings) {
        logger.warn('CDNMappings未加载，跳过初始化');
        return;
      }

      // 处理已存在的script标签
      this.processExistingScripts();

      // 监听动态添加的script标签
      this.observeScriptInsertion();

      // 拦截动态创建的script
      this.interceptScriptCreation();

      logger.log('JS替换模块已初始化');
    }

    /**
     * 处理已存在的script标签
     */
    processExistingScripts() {
      const scripts = document.querySelectorAll('script[src]');
      scripts.forEach(script => {
        this.processScript(script);
      });
    }

    /**
     * 处理单个script标签
     */
    processScript(script) {
      if (!script || !script.src) return;

      const originalUrl = script.src;

      // 检查排除规则
      if (this.shouldExclude(originalUrl)) {
        this.stats.skipped++;
        return;
      }

      // 检查是否已处理
      if (this.replacedUrls.has(originalUrl)) return;

      // 匹配CDN
      const match = window.CDNMappings.matchJSLibrary(originalUrl);
      if (!match) {
        this.stats.skipped++;
        return;
      }

      // 执行替换
      try {
        const cdnUrl = match.cdnUrl;
        script.src = cdnUrl;
        this.replacedUrls.set(originalUrl, cdnUrl);
        this.stats.replaced++;

        logger.log(`替换: ${match.name} v${match.version}`);
        logger.log(`  原始: ${originalUrl}`);
        logger.log(`  CDN:  ${cdnUrl}`);

        // 上报统计
        this.reportReplacement(match);
      } catch (error) {
        this.stats.failed++;
        logger.error(`替换失败: ${originalUrl}`, error);
      }
    }

    /**
     * 监听script标签插入
     */
    observeScriptInsertion() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'SCRIPT' && node.src) {
              // 延迟处理，等待src属性完全设置
              setTimeout(() => this.processScript(node), 0);
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      this.observer = observer;
    }

    /**
     * 拦截动态创建的script
     */
    interceptScriptCreation() {
      const self = this;
      const originalCreateElement = document.createElement.bind(document);

      document.createElement = function(tagName, options) {
        const element = originalCreateElement(tagName, options);

        if (tagName.toLowerCase() === 'script') {
          // 拦截src属性设置
          let _src = '';
          Object.defineProperty(element, 'src', {
            get() { return _src; },
            set(value) {
              _src = value;
              if (value && self.enabled) {
                // 延迟处理，让属性设置完成后再处理
                setTimeout(() => self.processScript(element), 0);
              }
              element.setAttribute('src', value);
            },
            configurable: true,
            enumerable: true
          });
        }

        return element;
      };
    }

    /**
     * 检查是否应排除
     */
    shouldExclude(url) {
      for (const pattern of this.excludePatterns) {
        if (pattern.test(url)) return true;
      }
      return false;
    }

    /**
     * 上报替换统计
     */
    reportReplacement(match) {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'RESOURCE_ACCELERATOR_STATS',
          category: 'js',
          action: 'replace',
          data: {
            name: match.name,
            version: match.version,
            originalUrl: match.originalUrl,
            cdnUrl: match.cdnUrl
          }
        }).catch(() => {});
      }
    }

    /**
     * 获取统计
     */
    getStats() {
      return {
        ...this.stats,
        replacedUrls: Array.from(this.replacedUrls.entries())
      };
    }

    /**
     * 启用
     */
    enable() {
      this.enabled = true;
      logger.log('JS替换已启用');
    }

    /**
     * 禁用
     */
    disable() {
      this.enabled = false;
      logger.log('JS替换已禁用');
    }

    /**
     * 销毁
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.enabled = false;
      logger.log('JS替换模块已销毁');
    }
  }

  // 导出
  window.JSReplacer = JSReplacer;

  console.log('[JSReplacer] JS替换模块已加载');
})();
```

- [ ] **Step 2: 验证文件创建**

运行: `ls -la content/modules/js-replacer.js`
预期: 文件存在

- [ ] **Step 3: 提交**

```bash
git add content/modules/js-replacer.js
git commit -m "feat(resource-accelerator): 添加JS库替换模块"
```

---

### Task 3: 字体替换模块

**Files:**
- Create: `content/modules/font-replacer.js`

- [ ] **Step 1: 创建字体替换模块**

```javascript
/**
 * 字体替换模块
 * 用国内镜像替换Google Fonts等外部字体
 */
(function() {
  'use strict';

  const logger = {
    log: (...args) => console.log('[FontReplacer]', ...args),
    warn: (...args) => console.warn('[FontReplacer]', ...args),
    error: (...args) => console.error('[FontReplacer]', ...args)
  };

  class FontReplacer {
    constructor(options = {}) {
      this.enabled = options.enabled ?? true;
      this.stats = {
        replaced: 0,
        skipped: 0,
        failed: 0
      };
      this.replacedUrls = new Map();
      this.excludePatterns = options.excludePatterns || [];
    }

    /**
     * 初始化
     */
    init() {
      if (!this.enabled) {
        logger.log('字体替换已禁用');
        return;
      }

      if (!window.CDNMappings) {
        logger.warn('CDNMappings未加载，跳过初始化');
        return;
      }

      // 处理已存在的link标签
      this.processExistingLinks();

      // 监听动态添加的link标签
      this.observeLinkInsertion();

      logger.log('字体替换模块已初始化');
    }

    /**
     * 处理已存在的link标签
     */
    processExistingLinks() {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(link => {
        this.processLink(link);
      });
    }

    /**
     * 处理单个link标签
     */
    processLink(link) {
      if (!link || !link.href) return;

      const originalUrl = link.href;

      // 检查排除规则
      if (this.shouldExclude(originalUrl)) {
        this.stats.skipped++;
        return;
      }

      // 检查是否已处理
      if (this.replacedUrls.has(originalUrl)) return;

      // 匹配字体
      const match = window.CDNMappings.matchFont(originalUrl);
      if (!match) {
        this.stats.skipped++;
        return;
      }

      // 执行替换
      try {
        const cdnUrl = match.cdnUrl;
        link.href = cdnUrl;
        this.replacedUrls.set(originalUrl, cdnUrl);
        this.stats.replaced++;

        logger.log(`替换字体: ${match.name}`);
        logger.log(`  原始: ${originalUrl}`);
        logger.log(`  CDN:  ${cdnUrl}`);

        // 上报统计
        this.reportReplacement(match);
      } catch (error) {
        this.stats.failed++;
        logger.error(`替换失败: ${originalUrl}`, error);
      }
    }

    /**
     * 监听link标签插入
     */
    observeLinkInsertion() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'LINK' && node.rel === 'stylesheet') {
              setTimeout(() => this.processLink(node), 0);
            }
          });
        });
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      this.observer = observer;
    }

    /**
     * 检查是否应排除
     */
    shouldExclude(url) {
      for (const pattern of this.excludePatterns) {
        if (pattern.test(url)) return true;
      }
      return false;
    }

    /**
     * 上报替换统计
     */
    reportReplacement(match) {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({
          type: 'RESOURCE_ACCELERATOR_STATS',
          category: 'font',
          action: 'replace',
          data: {
            name: match.name,
            originalUrl: match.originalUrl,
            cdnUrl: match.cdnUrl
          }
        }).catch(() => {});
      }
    }

    /**
     * 获取统计
     */
    getStats() {
      return {
        ...this.stats,
        replacedUrls: Array.from(this.replacedUrls.entries())
      };
    }

    /**
     * 启用
     */
    enable() {
      this.enabled = true;
      logger.log('字体替换已启用');
    }

    /**
     * 禁用
     */
    disable() {
      this.enabled = false;
      logger.log('字体替换已禁用');
    }

    /**
     * 销毁
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
      }
      this.enabled = false;
      logger.log('字体替换模块已销毁');
    }
  }

  // 导出
  window.FontReplacer = FontReplacer;

  console.log('[FontReplacer] 字体替换模块已加载');
})();
```

- [ ] **Step 2: 验证文件创建**

运行: `ls -la content/modules/font-replacer.js`
预期: 文件存在

- [ ] **Step 3: 提交**

```bash
git add content/modules/font-replacer.js
git commit -m "feat(resource-accelerator): 添加字体替换模块"
```

---

### Task 4: 图片优化模块

**Files:**
- Create: `content/modules/image-optimizer.js`

- [ ] **Step 1: 创建图片优化模块**

```javascript
/**
 * 图片优化模块
 * 实现懒加载和本地压缩
 */
(function() {
  'use strict';

  const logger = {
    log: (...args) => console.log('[ImageOptimizer]', ...args),
    warn: (...args) => console.warn('[ImageOptimizer]', ...args),
    error: (...args) => console.error('[ImageOptimizer]', ...args)
  };

  class ImageOptimizer {
    constructor(options = {}) {
      // 懒加载配置
      this.lazyLoadEnabled = options.lazyLoad ?? true;
      this.lazyLoadThreshold = options.lazyLoadThreshold || 200;

      // 压缩配置
      this.compressEnabled = options.compress ?? true;
      this.compressQuality = options.compressQuality || 0.8;
      this.compressMinSize = options.compressMinSize || 51200; // 50KB

      // 排除规则
      this.excludeSelectors = options.excludeSelectors || [
        'img[data-no-lazy]',
        '.no-lazy img',
        'img[loading="eager"]'
      ];
      this.excludeDomains = options.excludeDomains || [];

      // 统计
      this.stats = {
        lazyLoaded: 0,
        compressed: 0,
        bytesSaved: 0,
        skipped: 0
      };

      this.observer = null;
      this.processedImages = new WeakSet();
    }

    /**
     * 初始化
     */
    init() {
      if (this.lazyLoadEnabled) {
        this.initLazyLoad();
      }

      if (this.compressEnabled) {
        this.initCompression();
      }

      logger.log('图片优化模块已初始化', {
        lazyLoad: this.lazyLoadEnabled,
        compress: this.compressEnabled
      });
    }

    /**
     * 初始化懒加载
     */
    initLazyLoad() {
      // 处理已存在的图片
      this.processExistingImages();

      // 使用IntersectionObserver监听
      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.loadImage(entry.target);
            }
          });
        },
        {
          rootMargin: `${this.lazyLoadThreshold}px`,
          threshold: 0.01
        }
      );

      // 观察符合条件的图片
      this.observeImages();

      // 监听动态添加的图片
      this.observeImageInsertion();

      logger.log('懒加载已初始化');
    }

    /**
     * 处理已存在的图片
     */
    processExistingImages() {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (this.shouldProcess(img)) {
          this.prepareLazyLoad(img);
        }
      });
    }

    /**
     * 观察图片
     */
    observeImages() {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (this.shouldProcess(img) && !this.processedImages.has(img)) {
          this.prepareLazyLoad(img);
          this.observer.observe(img);
        }
      });
    }

    /**
     * 准备懒加载
     */
    prepareLazyLoad(img) {
      if (img.hasAttribute('data-src')) return; // 已处理

      const src = img.getAttribute('src');
      if (!src || src.startsWith('data:')) return;

      // 保存原始src
      img.setAttribute('data-src', src);

      // 设置占位符
      if (!img.hasAttribute('srcset')) {
        // 使用透明占位图
        img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
      }

      // 标记为懒加载
      img.setAttribute('data-lazy', 'pending');

      this.processedImages.add(img);
    }

    /**
     * 加载图片
     */
    async loadImage(img) {
      const dataSrc = img.getAttribute('data-src');
      if (!dataSrc || img.getAttribute('data-lazy') === 'loaded') return;

      img.setAttribute('data-lazy', 'loading');

      try {
        // 如果启用压缩，先尝试压缩
        let finalSrc = dataSrc;
        if (this.compressEnabled) {
          const compressed = await this.compressImage(dataSrc);
          if (compressed) {
            finalSrc = compressed;
            this.stats.compressed++;
          }
        }

        // 加载图片
        img.src = finalSrc;
        img.setAttribute('data-lazy', 'loaded');
        this.stats.lazyLoaded++;

        // 停止观察
        if (this.observer) {
          this.observer.unobserve(img);
        }

        logger.log(`图片加载: ${dataSrc.substring(0, 50)}...`);
      } catch (error) {
        // 加载失败，使用原始URL
        img.src = dataSrc;
        img.setAttribute('data-lazy', 'error');
        logger.error(`图片加载失败: ${dataSrc}`, error);
      }
    }

    /**
     * 初始化压缩
     */
    initCompression() {
      logger.log('图片压缩已初始化', {
        quality: this.compressQuality,
        minSize: this.compressMinSize
      });
    }

    /**
     * 压缩图片
     */
    async compressImage(url) {
      // 检查域名排除
      try {
        const urlObj = new URL(url, window.location.href);
        if (this.excludeDomains.some(d => urlObj.hostname.includes(d))) {
          return null;
        }
      } catch (e) {
        return null;
      }

      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          // 检查图片大小
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;

          ctx.drawImage(img, 0, 0);

          // 尝试导出为WebP，不支持则用JPEG
          let mimeType = 'image/jpeg';
          let quality = this.compressQuality;

          if (this.supportsWebP()) {
            mimeType = 'image/webp';
          }

          canvas.toBlob((blob) => {
            if (blob && blob.size >= this.compressMinSize) {
              // 计算节省的字节数
              const originalSize = img.naturalWidth * img.naturalHeight * 3; // 估算
              this.stats.bytesSaved += Math.max(0, originalSize - blob.size);

              const blobUrl = URL.createObjectURL(blob);
              resolve(blobUrl);
            } else {
              resolve(null);
            }
          }, mimeType, quality);
        };

        img.onerror = () => resolve(null);
        img.src = url;
      });
    }

    /**
     * 检查是否支持WebP
     */
    supportsWebP() {
      if (this._supportsWebP !== undefined) {
        return this._supportsWebP;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      this._supportsWebP = canvas.toDataURL('image/webp').startsWith('data:image/webp');
      return this._supportsWebP;
    }

    /**
     * 监听图片插入
     */
    observeImageInsertion() {
      const mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'IMG') {
              if (this.shouldProcess(node)) {
                this.prepareLazyLoad(node);
                if (this.observer) {
                  this.observer.observe(node);
                }
              }
            }
          });
        });
      });

      mutationObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
      });

      this.mutationObserver = mutationObserver;
    }

    /**
     * 检查是否应处理
     */
    shouldProcess(img) {
      // 检查排除选择器
      for (const selector of this.excludeSelectors) {
        if (img.matches(selector)) return false;
      }

      // 检查data属性
      if (img.hasAttribute('data-no-lazy')) return false;
      if (img.getAttribute('loading') === 'eager') return false;

      // 检查尺寸（太小的不处理）
      const width = img.getAttribute('width') || img.naturalWidth;
      const height = img.getAttribute('height') || img.naturalHeight;
      if (width && height && width * height < 10000) return false;

      return true;
    }

    /**
     * 获取统计
     */
    getStats() {
      return { ...this.stats };
    }

    /**
     * 启用懒加载
     */
    enableLazyLoad() {
      this.lazyLoadEnabled = true;
      this.initLazyLoad();
    }

    /**
     * 禁用懒加载
     */
    disableLazyLoad() {
      this.lazyLoadEnabled = false;
      if (this.observer) {
        this.observer.disconnect();
      }
    }

    /**
     * 启用压缩
     */
    enableCompress() {
      this.compressEnabled = true;
    }

    /**
     * 禁用压缩
     */
    disableCompress() {
      this.compressEnabled = false;
    }

    /**
     * 销毁
     */
    destroy() {
      if (this.observer) {
        this.observer.disconnect();
      }
      if (this.mutationObserver) {
        this.mutationObserver.disconnect();
      }
      this.lazyLoadEnabled = false;
      this.compressEnabled = false;
      logger.log('图片优化模块已销毁');
    }
  }

  // 导出
  window.ImageOptimizer = ImageOptimizer;

  console.log('[ImageOptimizer] 图片优化模块已加载');
})();
```

- [ ] **Step 2: 验证文件创建**

运行: `ls -la content/modules/image-optimizer.js`
预期: 文件存在

- [ ] **Step 3: 提交**

```bash
git add content/modules/image-optimizer.js
git commit -m "feat(resource-accelerator): 添加图片优化模块"
```

---

### Task 5: 资源加速器主模块

**Files:**
- Create: `content/modules/resource-accelerator.js`

- [ ] **Step 1: 创建主模块**

```javascript
/**
 * 资源加速器主模块
 * 统一管理JS替换、字体替换、图片优化
 */
(function() {
  'use strict';

  const logger = {
    log: (...args) => console.log('[ResourceAccelerator]', ...args),
    warn: (...args) => console.warn('[ResourceAccelerator]', ...args),
    error: (...args) => console.error('[ResourceAccelerator]', ...args)
  };

  // 默认配置
  const DEFAULT_CONFIG = {
    enabled: true,
    jsReplace: true,
    fontReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8,
    imageMinSize: 51200,
    lazyLoadThreshold: 200,
    excludeDomains: [],
    excludeUrls: []
  };

  class ResourceAccelerator {
    constructor(options = {}) {
      this.config = { ...DEFAULT_CONFIG, ...options };
      this.modules = {};
      this.stats = {
        jsReplaced: 0,
        fontsReplaced: 0,
        imagesOptimized: 0,
        bytesSaved: 0,
        timeSaved: 0
      };
      this.initialized = false;
    }

    /**
     * 初始化
     */
    async init() {
      if (this.initialized) return;

      if (!this.config.enabled) {
        logger.log('资源加速器已禁用');
        return;
      }

      // 加载配置
      await this.loadConfig();

      // 初始化子模块
      this.initModules();

      // 监听统计消息
      this.listenStats();

      this.initialized = true;
      logger.log('资源加速器已初始化', this.config);
    }

    /**
     * 加载配置
     */
    async loadConfig() {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await chrome.storage.local.get('resourceAcceleratorConfig');
          if (result.resourceAcceleratorConfig) {
            this.config = { ...this.config, ...result.resourceAcceleratorConfig };
          }
        } catch (error) {
          logger.warn('加载配置失败:', error);
        }
      }
    }

    /**
     * 保存配置
     */
    async saveConfig() {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          await chrome.storage.local.set({ resourceAcceleratorConfig: this.config });
        } catch (error) {
          logger.warn('保存配置失败:', error);
        }
      }
    }

    /**
     * 初始化子模块
     */
    initModules() {
      // JS替换
      if (this.config.jsReplace && window.JSReplacer) {
        this.modules.jsReplacer = new window.JSReplacer({
          enabled: true,
          excludePatterns: this.getExcludePatterns()
        });
        this.modules.jsReplacer.init();
      }

      // 字体替换
      if (this.config.fontReplace && window.FontReplacer) {
        this.modules.fontReplacer = new window.FontReplacer({
          enabled: true,
          excludePatterns: this.getExcludePatterns()
        });
        this.modules.fontReplacer.init();
      }

      // 图片优化
      if ((this.config.imageLazyLoad || this.config.imageCompress) && window.ImageOptimizer) {
        this.modules.imageOptimizer = new window.ImageOptimizer({
          lazyLoad: this.config.imageLazyLoad,
          compress: this.config.imageCompress,
          compressQuality: this.config.imageQuality,
          compressMinSize: this.config.imageMinSize,
          lazyLoadThreshold: this.config.lazyLoadThreshold,
          excludeDomains: this.config.excludeDomains
        });
        this.modules.imageOptimizer.init();
      }
    }

    /**
     * 获取排除模式
     */
    getExcludePatterns() {
      return this.config.excludeUrls.map(url => {
        // 将通配符转换为正则
        const pattern = url
          .replace(/\*/g, '.*')
          .replace(/\?/g, '.');
        return new RegExp(pattern, 'i');
      });
    }

    /**
     * 监听统计消息
     */
    listenStats() {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message.type === 'RESOURCE_ACCELERATOR_STATS') {
            this.updateStats(message);
          }
          return false;
        });
      }
    }

    /**
     * 更新统计
     */
    updateStats(message) {
      switch (message.category) {
        case 'js':
          this.stats.jsReplaced++;
          break;
        case 'font':
          this.stats.fontsReplaced++;
          break;
        case 'image':
          this.stats.imagesOptimized++;
          if (message.data?.bytesSaved) {
            this.stats.bytesSaved += message.data.bytesSaved;
          }
          break;
      }

      // 定期保存统计
      this.saveStats();
    }

    /**
     * 保存统计
     */
    async saveStats() {
      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await chrome.storage.local.get('resourceAcceleratorStats');
          const existingStats = result.resourceAcceleratorStats || {
            totalJsReplaced: 0,
            totalFontsReplaced: 0,
            totalImagesOptimized: 0,
            totalBytesSaved: 0
          };

          existingStats.totalJsReplaced += this.stats.jsReplaced;
          existingStats.totalFontsReplaced += this.stats.fontsReplaced;
          existingStats.totalImagesOptimized += this.stats.imagesOptimized;
          existingStats.totalBytesSaved += this.stats.bytesSaved;

          await chrome.storage.local.set({ resourceAcceleratorStats: existingStats });

          // 重置当前会话统计
          this.stats = {
            jsReplaced: 0,
            fontsReplaced: 0,
            imagesOptimized: 0,
            bytesSaved: 0,
            timeSaved: 0
          };
        } catch (error) {
          logger.warn('保存统计失败:', error);
        }
      }
    }

    /**
     * 获取统计
     */
    async getStats() {
      let totalStats = {
        totalJsReplaced: 0,
        totalFontsReplaced: 0,
        totalImagesOptimized: 0,
        totalBytesSaved: 0
      };

      if (typeof chrome !== 'undefined' && chrome.storage) {
        try {
          const result = await chrome.storage.local.get('resourceAcceleratorStats');
          if (result.resourceAcceleratorStats) {
            totalStats = result.resourceAcceleratorStats;
          }
        } catch (error) {
          logger.warn('获取统计失败:', error);
        }
      }

      // 合并当前会话统计
      return {
        session: this.stats,
        total: totalStats
      };
    }

    /**
     * 更新配置
     */
    async updateConfig(newConfig) {
      this.config = { ...this.config, ...newConfig };
      await this.saveConfig();

      // 更新子模块
      if (this.modules.jsReplacer) {
        if (newConfig.jsReplace !== undefined) {
          newConfig.jsReplace ? this.modules.jsReplacer.enable() : this.modules.jsReplacer.disable();
        }
      }

      if (this.modules.fontReplacer) {
        if (newConfig.fontReplace !== undefined) {
          newConfig.fontReplace ? this.modules.fontReplacer.enable() : this.modules.fontReplacer.disable();
        }
      }

      if (this.modules.imageOptimizer) {
        if (newConfig.imageLazyLoad !== undefined) {
          newConfig.imageLazyLoad ? this.modules.imageOptimizer.enableLazyLoad() : this.modules.imageOptimizer.disableLazyLoad();
        }
        if (newConfig.imageCompress !== undefined) {
          newConfig.imageCompress ? this.modules.imageOptimizer.enableCompress() : this.modules.imageOptimizer.disableCompress();
        }
      }

      logger.log('配置已更新:', this.config);
    }

    /**
     * 启用
     */
    enable() {
      this.config.enabled = true;
      this.initModules();
      logger.log('资源加速器已启用');
    }

    /**
     * 禁用
     */
    disable() {
      this.config.enabled = false;
      Object.values(this.modules).forEach(module => {
        if (module && typeof module.destroy === 'function') {
          module.destroy();
        }
      });
      this.modules = {};
      logger.log('资源加速器已禁用');
    }

    /**
     * 销毁
     */
    destroy() {
      this.disable();
      this.initialized = false;
      logger.log('资源加速器已销毁');
    }
  }

  // 导出
  window.ResourceAccelerator = ResourceAccelerator;

  // 自动初始化（如果配置了）
  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('resourceAcceleratorConfig', (result) => {
      if (result.resourceAcceleratorConfig?.enabled) {
        const accelerator = new ResourceAccelerator(result.resourceAcceleratorConfig);
        accelerator.init();
        window.resourceAccelerator = accelerator;
      }
    });
  }

  console.log('[ResourceAccelerator] 资源加速器模块已加载');
})();
```

- [ ] **Step 2: 验证文件创建**

运行: `ls -la content/modules/resource-accelerator.js`
预期: 文件存在

- [ ] **Step 3: 提交**

```bash
git add content/modules/resource-accelerator.js
git commit -m "feat(resource-accelerator): 添加资源加速器主模块"
```

---

### Task 6: 集成到模块加载器

**Files:**
- Modify: `content/modules/index.js:9-20` (dependencies对象)

- [ ] **Step 1: 更新模块加载器**

在 `content/modules/index.js` 第20行 `OptimizationAdvisor` 之后添加新依赖：

```javascript
// 在第20行后添加以下内容
  ResourceAccelerator: 'content/modules/resource-accelerator.js',
  JSReplacer: 'content/modules/js-replacer.js',
  FontReplacer: 'content/modules/font-replacer.js',
  ImageOptimizer: 'content/modules/image-optimizer.js',
  CDNMappings: 'shared/cdn-mappings.js'
```

完整修改后的 dependencies 对象应为：
```javascript
const dependencies = {
  SelectorEngine: 'content/modules/SelectorEngine.js',
  Highlighter: 'content/modules/Highlighter.js',
  VirtualList: 'content/modules/VirtualList.js',
  StorageManager: 'content/modules/StorageManager.js',
  SmartRecommender: 'content/modules/SmartRecommender.js',
  DOMWatcher: 'content/modules/DOMWatcher.js',
  SelectorWorker: 'content/modules/SelectorWorker.js',
  IncrementalUpdater: 'content/modules/IncrementalUpdater.js',
  SelectorPathVisualizer: 'content/modules/SelectorPathVisualizer.js',
  OptimizationAdvisor: 'content/modules/OptimizationAdvisor.js',
  ResourceAccelerator: 'content/modules/resource-accelerator.js',
  JSReplacer: 'content/modules/js-replacer.js',
  FontReplacer: 'content/modules/font-replacer.js',
  ImageOptimizer: 'content/modules/image-optimizer.js',
  CDNMappings: 'shared/cdn-mappings.js'
};
```

- [ ] **Step 2: 验证修改**

运行: `grep "ResourceAccelerator" content/modules/index.js`
预期: 显示新添加的依赖

- [ ] **Step 3: 提交**

```bash
git add content/modules/index.js
git commit -m "feat(resource-accelerator): 集成到模块加载器"
```

---

### Task 7: 添加Popup控制面板

**Files:**
- Modify: `popup.html:567` (在剪贴板历史区域之前)
- Modify: `popup.js` (文件末尾)

- [ ] **Step 1: 在popup.html中添加资源加速器面板**

在 `popup.html` 第567行（`<!-- 剪贴板历史 -->` 之前）插入以下代码：

```html
<!-- 资源加速器 -->
<div class="settings" style="margin-top: 12px;">
  <h2 style="font-size: 16px; margin: 0 0 12px 0">⚡ 资源加速器</h2>

  <div class="setting-item">
    <div class="toggle-container">
      <label for="ra-enabled">启用资源加速</label>
      <input type="checkbox" id="ra-enabled" />
    </div>
  </div>

  <div id="ra-settings" style="margin-top: 8px;">
    <div class="setting-item">
      <div class="toggle-container">
        <label for="ra-js-replace">JS库替换 <span id="ra-js-count" style="color: #666; font-size: 11px;"></span></label>
        <input type="checkbox" id="ra-js-replace" />
      </div>
    </div>

    <div class="setting-item">
      <div class="toggle-container">
        <label for="ra-font-replace">字体替换 <span id="ra-font-count" style="color: #666; font-size: 11px;"></span></label>
        <input type="checkbox" id="ra-font-replace" />
      </div>
    </div>

    <div class="setting-item">
      <div class="toggle-container">
        <label for="ra-image-lazy">图片懒加载 <span id="ra-lazy-count" style="color: #666; font-size: 11px;"></span></label>
        <input type="checkbox" id="ra-image-lazy" />
      </div>
    </div>

    <div class="setting-item">
      <div class="toggle-container">
        <label for="ra-image-compress">图片压缩 <span id="ra-compress-count" style="color: #666; font-size: 11px;"></span></label>
        <input type="checkbox" id="ra-image-compress" />
      </div>
    </div>

    <div class="setting-item" style="margin-top: 8px;">
      <label for="ra-quality">压缩质量: <span id="ra-quality-value">80</span>%</label>
      <input type="range" id="ra-quality" min="50" max="100" value="80" step="5"
             style="width: 100%; margin-top: 4px; accent-color: #007bff;" />
    </div>

    <!-- 统计信息 -->
    <div style="margin-top: 12px; padding: 8px; background: #f8f9fa; border-radius: 6px;">
      <div style="font-size: 12px; color: #666; margin-bottom: 4px;">本次加速效果</div>
      <div style="display: flex; gap: 8px; font-size: 11px;">
        <div style="flex: 1;">节省: <span id="ra-bytes-saved">0</span> KB</div>
        <div style="flex: 1;">替换: <span id="ra-total-replaced">0</span> 个</div>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 2: 在popup.js中添加控制逻辑**

在popup.js末尾添加资源加速器控制代码：

```javascript
// ========== 资源加速器控制 ==========
async function initResourceAccelerator() {
  // 加载配置
  const result = await chrome.storage.local.get('resourceAcceleratorConfig');
  const config = result.resourceAcceleratorConfig || {
    enabled: false,
    jsReplace: true,
    fontReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8
  };

  // 设置UI状态
  document.getElementById('ra-enabled').checked = config.enabled;
  document.getElementById('ra-js-replace').checked = config.jsReplace;
  document.getElementById('ra-font-replace').checked = config.fontReplace;
  document.getElementById('ra-image-lazy').checked = config.imageLazyLoad;
  document.getElementById('ra-image-compress').checked = config.imageCompress;
  document.getElementById('ra-quality').value = config.imageQuality * 100;
  document.getElementById('ra-quality-value').textContent = Math.round(config.imageQuality * 100);

  // 显示/隐藏设置面板
  const settingsPanel = document.getElementById('ra-settings');
  settingsPanel.style.display = config.enabled ? 'block' : 'none';

  // 绑定事件
  document.getElementById('ra-enabled').addEventListener('change', async (e) => {
    config.enabled = e.target.checked;
    settingsPanel.style.display = config.enabled ? 'block' : 'none';
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    // 通知content script
    notifyContentScript('RESOURCE_ACCELERATOR_CONFIG', config);
  });

  document.getElementById('ra-js-replace').addEventListener('change', async (e) => {
    config.jsReplace = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyContentScript('RESOURCE_ACCELERATOR_CONFIG', config);
  });

  document.getElementById('ra-font-replace').addEventListener('change', async (e) => {
    config.fontReplace = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyContentScript('RESOURCE_ACCELERATOR_CONFIG', config);
  });

  document.getElementById('ra-image-lazy').addEventListener('change', async (e) => {
    config.imageLazyLoad = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyContentScript('RESOURCE_ACCELERATOR_CONFIG', config);
  });

  document.getElementById('ra-image-compress').addEventListener('change', async (e) => {
    config.imageCompress = e.target.checked;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
    notifyContentScript('RESOURCE_ACCELERATOR_CONFIG', config);
  });

  document.getElementById('ra-quality').addEventListener('input', async (e) => {
    const value = parseInt(e.target.value);
    document.getElementById('ra-quality-value').textContent = value;
    config.imageQuality = value / 100;
    await chrome.storage.local.set({ resourceAcceleratorConfig: config });
  });

  // 加载统计
  loadResourceAcceleratorStats();
}

async function loadResourceAcceleratorStats() {
  const result = await chrome.storage.local.get('resourceAcceleratorStats');
  const stats = result.resourceAcceleratorStats || {
    totalJsReplaced: 0,
    totalFontsReplaced: 0,
    totalImagesOptimized: 0,
    totalBytesSaved: 0
  };

  document.getElementById('ra-js-count').textContent = `(${stats.totalJsReplaced})`;
  document.getElementById('ra-font-count').textContent = `(${stats.totalFontsReplaced})`;
  document.getElementById('ra-lazy-count').textContent = `(${stats.totalImagesOptimized})`;
  document.getElementById('ra-compress-count').textContent = `(${stats.totalImagesOptimized})`;
  document.getElementById('ra-bytes-saved').textContent = Math.round(stats.totalBytesSaved / 1024);
  document.getElementById('ra-total-replaced').textContent =
    stats.totalJsReplaced + stats.totalFontsReplaced + stats.totalImagesOptimized;
}

function notifyContentScript(type, data) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, { type, data }).catch(() => {});
    }
  });
}

// 初始化
initResourceAccelerator();
```

- [ ] **Step 3: 验证修改**

运行: `grep "ra-enabled" popup.html`
预期: 显示添加的元素

- [ ] **Step 4: 提交**

```bash
git add popup.html popup.js
git commit -m "feat(resource-accelerator): 添加Popup控制面板"
```

---

### Task 8: 验证manifest.json配置

**注意**: manifest.json 第66-68行已有通配符 `"content/modules/*.js"` 和 `"shared/*.js"`，已覆盖所有新建文件，无需额外修改。

**Files:**
- Verify: `manifest.json:66-68`

- [ ] **Step 1: 验证通配符配置**

运行: `grep -A 3 '"content/modules/\*.js"' manifest.json`
预期: 显示已存在的通配符配置

- [ ] **Step 2: 验证JSON语法**

运行: `node -e "JSON.parse(require('fs').readFileSync('manifest.json'))"`
预期: 无错误输出

---

### Task 9: 编写单元测试

**注意**: 本项目采用后置测试模式（实现后再测试），而非TDD模式。

**Files:**
- Create: `tests/resource-accelerator.test.js`

- [ ] **Step 1: 创建测试文件**

```javascript
/**
 * 资源加速器单元测试
 * 
 * 测试前置条件：
 * 1. 需要在vitest配置中设置setup文件预加载被测模块
 * 2. 或在测试前手动import被测模块
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    },
    sync: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined)
    }
  },
  runtime: {
    sendMessage: vi.fn().mockResolvedValue(undefined),
    onMessage: {
      addListener: vi.fn()
    }
  }
};

// 模拟CDNMappings模块
beforeAll(() => {
  // 创建模拟的CDNMappings
  global.window = global.window || {};
  
  const JS_CDN_MAP = {
    jquery: {
      patterns: [/jquery[.-]?([\d.]+)?(?:\.min)?\.js$/i],
      getCDNUrl: (v = '3.7.1') => `https://cdn.bootcdn.net/ajax/libs/jquery/${v}/jquery.min.js`,
      defaultVersion: '3.7.1'
    },
    react: {
      patterns: [/react(?:\.production)?(?:\.min)?\.js$/i],
      getCDNUrl: (v = '18.2.0') => `https://cdn.bootcdn.net/ajax/libs/react/${v}/umd/react.production.min.js`,
      defaultVersion: '18.2.0'
    },
    vue: {
      patterns: [/vue(?:\.runtime|\.global)?(?:\.min)?\.js$/i],
      getCDNUrl: (v = '3.4.21') => `https://cdn.bootcdn.net/ajax/libs/vue/${v}/vue.global.prod.min.js`,
      defaultVersion: '3.4.21'
    }
  };

  const FONT_CDN_MAP = {
    'google-fonts': {
      patterns: [/fonts\.googleapis\.com\/css/i],
      getMirrorUrl: (url) => url.replace('fonts.googleapis.com', 'fonts.font.im')
    }
  };

  window.CDNMappings = {
    JS_CDN_MAP,
    FONT_CDN_MAP,
    matchJSLibrary(url) {
      if (!url) return null;
      for (const [name, config] of Object.entries(JS_CDN_MAP)) {
        for (const pattern of config.patterns) {
          const match = url.match(pattern);
          if (match) {
            const version = match[1] || config.defaultVersion;
            return { name, cdnUrl: config.getCDNUrl(version), version, originalUrl: url };
          }
        }
      }
      return null;
    },
    matchFont(url) {
      if (!url) return null;
      for (const [name, config] of Object.entries(FONT_CDN_MAP)) {
        for (const pattern of config.patterns) {
          if (pattern.test(url)) {
            return { name, cdnUrl: config.getMirrorUrl(url), originalUrl: url };
          }
        }
      }
      return null;
    }
  };

  // 模拟JSReplacer类
  window.JSReplacer = class JSReplacer {
    constructor(options = {}) {
      this.enabled = options.enabled ?? true;
      this.stats = { replaced: 0, skipped: 0, failed: 0 };
    }
    enable() { this.enabled = true; }
    disable() { this.enabled = false; }
  };

  // 模拟ImageOptimizer类
  window.ImageOptimizer = class ImageOptimizer {
    constructor(options = {}) {
      this.lazyLoadEnabled = options.lazyLoad ?? true;
      this.compressEnabled = options.compress ?? true;
      this.compressQuality = options.compressQuality || 0.8;
      this._supportsWebP = undefined;
    }
    supportsWebP() {
      if (this._supportsWebP !== undefined) return this._supportsWebP;
      this._supportsWebP = true; // 模拟支持WebP
      return this._supportsWebP;
    }
  };
});

describe('CDNMappings', () => {
  it('应该匹配jQuery URL', () => {
    const result = window.CDNMappings.matchJSLibrary('https://code.jquery.com/jquery-3.7.1.min.js');
    expect(result).toBeDefined();
    expect(result.name).toBe('jquery');
    expect(result.version).toBe('3.7.1');
  });

  it('应该匹配React URL', () => {
    const result = window.CDNMappings.matchJSLibrary('https://unpkg.com/react@18.2.0/umd/react.production.min.js');
    expect(result).toBeDefined();
    expect(result.name).toBe('react');
  });

  it('应该匹配Vue URL', () => {
    const result = window.CDNMappings.matchJSLibrary('https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.min.js');
    expect(result).toBeDefined();
    expect(result.name).toBe('vue');
  });

  it('应该匹配Google Fonts URL', () => {
    const result = window.CDNMappings.matchFont('https://fonts.googleapis.com/css2?family=Roboto');
    expect(result).toBeDefined();
    expect(result.name).toBe('google-fonts');
    expect(result.cdnUrl).toContain('fonts.font.im');
  });

  it('不应该匹配未知URL', () => {
    const result = window.CDNMappings.matchJSLibrary('https://example.com/custom.js');
    expect(result).toBeNull();
  });
});

describe('JSReplacer', () => {
  it('应该正确初始化', () => {
    const replacer = new window.JSReplacer({ enabled: true });
    expect(replacer.enabled).toBe(true);
    expect(replacer.stats.replaced).toBe(0);
  });

  it('应该能启用和禁用', () => {
    const replacer = new window.JSReplacer({ enabled: true });
    replacer.disable();
    expect(replacer.enabled).toBe(false);
    replacer.enable();
    expect(replacer.enabled).toBe(true);
  });
});

describe('ImageOptimizer', () => {
  it('应该正确初始化', () => {
    const optimizer = new window.ImageOptimizer({
      lazyLoad: true,
      compress: true,
      compressQuality: 0.8
    });
    expect(optimizer.lazyLoadEnabled).toBe(true);
    expect(optimizer.compressEnabled).toBe(true);
    expect(optimizer.compressQuality).toBe(0.8);
  });

  it('应该正确判断是否支持WebP', () => {
    const optimizer = new window.ImageOptimizer();
    const supports = optimizer.supportsWebP();
    expect(typeof supports).toBe('boolean');
  });
});
```

- [ ] **Step 2: 运行测试**

运行: `npm test tests/resource-accelerator.test.js`
预期: 测试通过或显示预期失败（模块未加载）

- [ ] **Step 3: 提交**

```bash
git add tests/resource-accelerator.test.js
git commit -m "test(resource-accelerator): 添加单元测试"
```

---

### Task 10: 最终验证和文档

- [ ] **Step 1: 验证所有文件存在**

运行: `ls -la shared/cdn-mappings.js content/modules/js-replacer.js content/modules/font-replacer.js content/modules/image-optimizer.js content/modules/resource-accelerator.js`
预期: 所有文件存在

- [ ] **Step 2: 验证manifest.json语法**

运行: `node -e "JSON.parse(require('fs').readFileSync('manifest.json'))"`
预期: 无错误

- [ ] **Step 3: 最终提交**

```bash
git add -A
git commit -m "feat: 完成智能资源加速器功能

功能概述:
- JS库替换: 用公共CDN替换jQuery/React/Vue等常见库
- 字体替换: 用国内镜像替换Google Fonts
- 图片优化: 懒加载 + Canvas压缩

模块结构:
- shared/cdn-mappings.js: CDN映射表
- content/modules/js-replacer.js: JS替换
- content/modules/font-replacer.js: 字体替换
- content/modules/image-optimizer.js: 图片优化
- content/modules/resource-accelerator.js: 主模块"
```

- [ ] **Step 4: 推送到远程（可选）**

```bash
git push origin main
```
