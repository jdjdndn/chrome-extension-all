/**
 * 字体替换模块
 * 用国内镜像替换Google Fonts等外部字体
 */

(function () {
  'use strict';

  const LOG_PREFIX = '[FontReplacer]';

  class FontReplacer {
    constructor(options = {}) {
      this.enabled = options.enabled !== false;
      this.excludePatterns = options.excludePatterns || [];
      this.reportEnabled = options.reportEnabled !== false;

      // 统计数据
      this.stats = {
        total: 0,
        replaced: 0,
        skipped: 0,
        errors: 0,
        details: []
      };

      // 内部状态
      this._observer = null;
      this._processedLinks = new WeakSet();

      console.log(`${LOG_PREFIX} 模块初始化完成`);
    }

    /**
     * 初始化：处理已存在link标签 + 监听动态插入
     */
    init() {
      if (!this.enabled) {
        console.log(`${LOG_PREFIX} 模块已禁用`);
        return;
      }

      // 1. 处理已存在的link标签
      this._processExistingLinks();

      // 2. 监听动态link插入
      this._setupMutationObserver();

      console.log(`${LOG_PREFIX} 初始化完成，开始监听`);
    }

    /**
     * 处理已存在的link标签
     */
    _processExistingLinks() {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      links.forEach(link => this.processLink(link));
    }

    /**
     * 设置MutationObserver监听动态link插入
     */
    _setupMutationObserver() {
      this._observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            // 检查节点本身
            if (node.tagName === 'LINK' && node.rel === 'stylesheet') {
              this.processLink(node);
            }
            // 检查子节点
            if (node.querySelectorAll) {
              const links = node.querySelectorAll('link[rel="stylesheet"]');
              links.forEach(link => this.processLink(link));
            }
          });
        });
      });

      this._observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    /**
     * 处理单个link标签
     */
    processLink(link) {
      if (!this.enabled) return;

      const url = link.href;
      if (!url) return;

      // 避免重复处理
      if (this._processedLinks.has(link)) return;
      this._processedLinks.add(link);

      this.stats.total++;

      // 检查排除规则
      if (this.shouldExclude(url)) {
        this.stats.skipped++;
        console.log(`${LOG_PREFIX} 跳过(排除规则): ${url}`);
        return;
      }

      // 检查是否已经是目标CDN
      if (this._isTargetCDN(url)) {
        this.stats.skipped++;
        return;
      }

      // 匹配字体CDN映射
      const match = window.CDNMappings?.matchFont(url);
      if (!match) {
        this.stats.skipped++;
        return;
      }

      // 执行替换
      try {
        const originalHref = link.href;
        link.href = match.cdnUrl;

        this.stats.replaced++;
        console.log(`${LOG_PREFIX} 替换: ${match.name}`);
        console.log(`  原始: ${originalHref}`);
        console.log(`  CDN: ${match.cdnUrl}`);

        // 上报统计
        this.reportReplacement(match);

        // 记录详情
        this.stats.details.push({
          name: match.name,
          original: originalHref,
          cdn: match.cdnUrl,
          time: Date.now()
        });
      } catch (error) {
        this.stats.errors++;
        console.error(`${LOG_PREFIX} 替换失败:`, error);
      }
    }

    /**
     * 检查是否为目标CDN
     */
    _isTargetCDN(url) {
      const targetCDNs = [
        'fonts.font.im',
        'fonts.loli.net',
        'cdn.bootcdn.net'
      ];
      return targetCDNs.some(cdn => url.includes(cdn));
    }

    /**
     * 检查排除规则
     */
    shouldExclude(url) {
      if (!url || typeof url !== 'string') return true;

      // 默认排除规则
      const defaultExcludes = [
        /^chrome-extension:/i,
        /^moz-extension:/i,
        /^about:/i,
        /^data:/i,
        /^javascript:/i,
        /\/local\//i,
        /\/internal\//i
      ];

      if (defaultExcludes.some(pattern => pattern.test(url))) {
        return true;
      }

      // 用户自定义排除规则
      return this.excludePatterns.some(pattern => pattern.test(url));
    }

    /**
     * 上报统计到background
     */
    reportReplacement(match) {
      if (!this.reportEnabled) return;

      try {
        if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
          chrome.runtime.sendMessage({
            type: 'FONT_REPLACER_STATS',
            data: {
              name: match.name,
              originalUrl: match.originalUrl,
              cdnUrl: match.cdnUrl,
              description: match.description,
              timestamp: Date.now()
            }
          });
        }
      } catch (error) {
        // 扩展上下文无效时静默失败
        console.warn(`${LOG_PREFIX} 上报失败:`, error.message);
      }
    }

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        ...this.stats,
        enabled: this.enabled
      };
    }

    /**
     * 启用模块
     */
    enable() {
      this.enabled = true;
      console.log(`${LOG_PREFIX} 模块已启用`);
    }

    /**
     * 禁用模块
     */
    disable() {
      this.enabled = false;
      console.log(`${LOG_PREFIX} 模块已禁用`);
    }

    /**
     * 销毁模块
     */
    destroy() {
      // 停止MutationObserver
      if (this._observer) {
        this._observer.disconnect();
        this._observer = null;
      }

      // 清理状态
      this.enabled = false;
      this._processedLinks = new WeakSet();

      console.log(`${LOG_PREFIX} 模块已销毁`);
    }
  }

  // 导出
  window.FontReplacer = FontReplacer;

})();
