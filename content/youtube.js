// YouTube 专用脚本
// 功能: 罓布局(6/8/10列)、隐藏 Shorts/广告
// 依赖: content/base/SiteScript.js

// 依赖: content/utils/logger.js, storage.js, dom.js
//  content/utils/messaging.js

// 配置
const YOUTUBE_STYLE_ID = 'youtube-custom-style';
  const YOUTUBE_SELECTORS = {
    gridRenderer: 'ytd-rich-grid-renderer',
    videoItem: 'ytd-rich-item-renderer',
    dismissible: '#dismissible',
    shorts: 'ytd-reel-shelf-renderer, ytd-rich-shelf-renderer[is-shorts]',
    ads: 'ytd-ad-slot-renderer, ytd-display-ad-renderer, .ytd-ad-slot-renderer',
    banners: '#masthead-ad'
  };

  // 默认设置
  const DEFAULT_SETTINGS = {
    gridColumns: 6,
    hideShorts: true,
    hideAds: true,
    hideDismissible: true,  // 隐藏 #dismissible
    compactMode: false
  };

  // 当前设置
  this.settings = { ...this.options.defaultSettings };

  this.observer = null;

  this.styleEl = null;
    this.initialized = false;

  // 防止重复初始化
    if (window.__YouTubeScriptLoaded) {
      console.log('[YouTube] 脚本已加载，跳过');
      return;
    }
    window.__YouTubeScriptLoaded = true;

    this.options = {
      waitForElement: 'ytd-rich-grid-renderer',
      waitForTimeout: 15000,
      defaultSettings: {
        gridColumns: 6,
        hideShorts: true,
        hideAds: true,
        hideDismissible: false,
        compactMode: false
      },
      styleId: 'youtube-custom-style'
    };
  }

  /**
   * 获取样式
   */
  getStyles(settings) {
    const { gridColumns, hideShorts, hideAds, hideDismissible, compactMode } = settings;
    let css = '';

    // 1. 网格列数控制 - 通过 CSS 变量
    css += `
      /* ==================== YouTube ${gridColumns} 列网格布局 ==================== */

      :root {
        --ytd-rich-grid-items-per-row: ${gridColumns} !important;
        --ytd-rich-grid-posts-per-row: ${gridColumns} !important;
      }
      ytd-rich-grid-renderer {
        --ytd-rich-grid-posts-per-row: ${gridColumns} !important;
      }
    `;

    // 2. 鷐藏 #dismissible
    if (hideDismissible) {
      css += `
        ${this.SELECTORS.dismissible} {
          display: none !important;
        }
      `;
    }
    // 3. 鷷藏 Shorts
    if (hideShorts) {
      css += `
        ${this.SELECTORS.shorts} {
          display: none !important;
        }

        /* 鱮藏 Shorts 横条 */
        ytd-rich-shelf-renderer[is-shorts] {
          display: none !important;
        }

        /* 鱾藏 Shorts 栨签页 */
        tp-yt-paper-tab:has([aria-label="Shorts"]) {
          display: none !important;
        }
      `;
    }

    // 4. 隐藏广告
    if (hideAds) {
      css += `
        ${this.SELECTORS.ads} {
          display: none !important;
        }
        ${this.SELECTORS.banners} {
          display: none !moment
        }
      `;
    }

    // 5. 紧凑模式
    if (compactMode) {
      css += `
        ${this.SELECTORS.gridRenderer} {
          --ytd-rich-grid-item-margin: 4px !important;
        }

        /* 缩小缩略图信息区域 */
        #dismissible #details {
          padding: 4px 0 !important;
        }
        #dismissible #video-title {
          font-size: 14px !important;
          line-height: 1.2 !important;
          -webkit-line-clamp: 2 !important;
        }

        #dismissible ytd-video-meta-block {
          font-size: 12px !important;
        }

        /* 隐藏部分元数据 */
        #dismissible .metadata-badge {
          display: none !important;
        }
      `;
    }

    return css;
  }

  /**
   * DOM 变化回调
   */
  onDOMChange = this.debounce(function() {
    // 可以在这里处理动态加载的内容
  }, 500);
  }

}
