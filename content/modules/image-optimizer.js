// ========== 图片优化模块 ==========
// 实现图片懒加载和本地压缩

(function () {
  'use strict';

  if (window.ImageOptimizer) {
    console.log('[ImageOptimizer] 已存在，跳过初始化');
    return;
  }

  /**
   * ImageOptimizer - 图片优化器
   * 功能：
   * 1. 懒加载 - IntersectionObserver实现
   * 2. 本地压缩 - Canvas API
   * 3. WebP支持检测
   */
  class ImageOptimizer {
    constructor(options = {}) {
      // 懒加载配置
      this.lazyLoadThreshold = options.lazyLoadThreshold || 200;
      this.lazyLoadEnabled = options.lazyLoadEnabled !== false;

      // 压缩配置
      this.compressQuality = options.compressQuality || 0.8;
      this.compressMinSize = options.compressMinSize || 51200; // 50KB
      this.compressEnabled = options.compressEnabled || false;

      // 排除选择器
      this.excludeSelectors = options.excludeSelectors || [
        'img[data-no-lazy]',
        '.no-lazy img',
        'img[loading="eager"]'
      ];

      // 内部状态
      this.observer = null;
      this.processedImages = new WeakSet();
      this.stats = {
        lazyLoaded: 0,
        compressed: 0,
        skipped: 0
      };

      // WebP支持
      this._webpSupported = null;
    }

    /**
     * 初始化
     */
    init() {
      if (this.lazyLoadEnabled) {
        this.initLazyLoad();
      }
      console.log('[ImageOptimizer] 初始化完成', {
        lazyLoad: this.lazyLoadEnabled,
        compress: this.compressEnabled
      });
    }

    /**
     * 初始化懒加载
     */
    initLazyLoad() {
      if (this.observer) {
        this.observer.disconnect();
      }

      this.observer = new IntersectionObserver(
        (entries) => this._handleIntersection(entries),
        {
          rootMargin: `${this.lazyLoadThreshold}px 0px`,
          threshold: 0.01
        }
      );

      // 观察现有图片
      this._observeImages();

      // 监听DOM变化
      this._watchDOM();

      console.log('[ImageOptimizer] 懒加载已启用');
    }

    /**
     * 处理交集变化
     */
    _handleIntersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          this.loadImage(img);
          this.observer.unobserve(img);
        }
      });
    }

    /**
     * 观察页面图片
     */
    _observeImages() {
      const images = document.querySelectorAll('img');
      images.forEach(img => {
        if (this.shouldProcess(img)) {
          this.prepareLazyLoad(img);
          this.observer.observe(img);
        }
      });
    }

    /**
     * 监听DOM变化
     */
    _watchDOM() {
      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
      }

      this._mutationObserver = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
          mutation.addedNodes.forEach(node => {
            if (node.nodeName === 'IMG' && this.shouldProcess(node)) {
              this.prepareLazyLoad(node);
              this.observer.observe(node);
            }
            // 检查子元素
            if (node.querySelectorAll) {
              const imgs = node.querySelectorAll('img');
              imgs.forEach(img => {
                if (this.shouldProcess(img)) {
                  this.prepareLazyLoad(img);
                  this.observer.observe(img);
                }
              });
            }
          });
        });
      });

      this._mutationObserver.observe(document.body, {
        childList: true,
        subtree: true
      });
    }

    /**
     * 准备懒加载
     * 保存原始src到data-src，设置占位图
     */
    prepareLazyLoad(img) {
      if (this.processedImages.has(img)) return;
      if (!img.src || img.dataset.src) return;

      // 保存原始src
      img.dataset.src = img.src;

      // 设置占位图 (1x1透明像素)
      img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

      // 添加懒加载标记
      img.dataset.lazyLoading = 'true';

      this.processedImages.add(img);
    }

    /**
     * 加载图片
     */
    async loadImage(img) {
      const originalSrc = img.dataset.src;
      if (!originalSrc) return;

      try {
        // 是否需要压缩
        if (this.compressEnabled && await this._shouldCompress(originalSrc)) {
          const compressedUrl = await this.compressImage(originalSrc);
          if (compressedUrl) {
            img.src = compressedUrl;
            this.stats.compressed++;
          } else {
            img.src = originalSrc;
          }
        } else {
          img.src = originalSrc;
        }

        img.dataset.lazyLoading = 'false';
        img.dataset.lazyLoaded = 'true';
        this.stats.lazyLoaded++;

      } catch (error) {
        console.error('[ImageOptimizer] 加载失败:', error);
        img.src = originalSrc;
      }
    }

    /**
     * 判断是否需要压缩
     */
    async _shouldCompress(url) {
      // 检查文件大小
      try {
        const response = await fetch(url, { method: 'HEAD' });
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) < this.compressMinSize) {
          return false;
        }
      } catch {
        // 无法获取大小，默认压缩
      }
      return true;
    }

    /**
     * 压缩图片
     * 使用Canvas API压缩，返回Blob URL
     */
    async compressImage(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // 计算压缩尺寸
            let { width, height } = img;
            const maxSize = 1920;

            if (width > maxSize || height > maxSize) {
              const ratio = Math.min(maxSize / width, maxSize / height);
              width = Math.floor(width * ratio);
              height = Math.floor(height * ratio);
            }

            canvas.width = width;
            canvas.height = height;

            // 绘制
            ctx.drawImage(img, 0, 0, width, height);

            // 确定格式
            const format = this.supportsWebP() ? 'image/webp' : 'image/jpeg';
            const quality = this.compressQuality;

            // 转换为Blob
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  const blobUrl = URL.createObjectURL(blob);
                  resolve(blobUrl);
                } else {
                  reject(new Error('压缩失败'));
                }
              },
              format,
              quality
            );
          } catch (error) {
            reject(error);
          }
        };

        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = url;
      });
    }

    /**
     * 检测WebP支持
     */
    supportsWebP() {
      if (this._webpSupported !== null) {
        return this._webpSupported;
      }

      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      this._webpSupported = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
      return this._webpSupported;
    }

    /**
     * 检查是否应处理该图片
     */
    shouldProcess(img) {
      // 已处理
      if (this.processedImages.has(img)) return false;

      // 无src
      if (!img.src && !img.dataset.src) return false;

      // data URI 跳过
      if (img.src && img.src.startsWith('data:')) return false;

      // 检查排除选择器
      for (const selector of this.excludeSelectors) {
        if (img.matches(selector)) {
          this.stats.skipped++;
          return false;
        }
      }

      return true;
    }

    /**
     * 获取统计信息
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
        this.observer = null;
      }
      if (this._mutationObserver) {
        this._mutationObserver.disconnect();
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
      this.disableLazyLoad();
      this.processedImages = new WeakSet();
      this.stats = { lazyLoaded: 0, compressed: 0, skipped: 0 };
      console.log('[ImageOptimizer] 已销毁');
    }
  }

  // 导出
  window.ImageOptimizer = ImageOptimizer;

  console.log('[ImageOptimizer] 图片优化模块已加载');
})();
