/**
 * 网站脚本基类
 * 提供统一的初始化流程、配置管理、样式注入等功能
 *
 * 使用示例:
 * class YouTubeScript extends SiteScript {
 *   constructor() {
 *     super('youtube', {
 *       waitForElement: 'ytd-rich-grid-renderer',
 *       defaultSettings: { gridColumns: 6 }
 *     });
 *   }
 *   getStyles(settings) { return '...'; }
 *   onReady() { console.log('Ready'); }
 * }
 * new YouTubeScript().init();
 */

class SiteScript {
  /**
   * @param {string} siteName - 网站名称（用于日志和存储命名空间）
   * @param {Object} options - 配置选项
   * @param {string} [options.waitForElement] - 等待的元素选择器
   * @param {number} [options.waitForTimeout=10000] - 等待超时时间
   * @param {Object} [options.defaultSettings={}] - 默认设置
   * @param {string} [options.styleId] - 样式元素ID
   */
  constructor(siteName, options = {}) {
    this.siteName = siteName;
    this.options = {
      waitForElement: null,
      waitForTimeout: 10000,
      defaultSettings: {},
      styleId: `${siteName}-custom-style`,
      ...options
    };

    this.settings = {};
    this.styleManager = null;
    this.configManager = null;
    this.initialized = false;

    // 防止重复初始化
    const globalKey = `__${siteName}ScriptLoaded`;
    if (window[globalKey]) {
      console.log(`[${siteName}] 脚本已加载，跳过`);
      return;
    }
    window[globalKey] = true;
  }

  /**
   * 初始化脚本
   */
  async init() {
    if (this.initialized) return;

    try {
      console.log(`[${this.siteName}] 脚本初始化...`);

      // 1. 等待 DOM 就绪
      await this.waitForDOM();

      // 2. 等待指定元素
      if (this.options.waitForElement) {
        console.log(`[${this.siteName}] 等待元素: ${this.options.waitForElement}`);
        await this.waitForElement(this.options.waitForElement, this.options.waitForTimeout);
      }

      // 3. 加载设置
      await this.loadSettings();

      // 4. 应用样式
      this.applyStyles();

      // 5. 设置观察者
      this.setupObservers();

      // 6. 暴露 API
      this.exposeAPI();

      // 7. 监听设置变化
      this.setupStorageListener();

      // 8. 调用就绪回调
      this.onReady();

      this.initialized = true;
      console.log(`[${this.siteName}] 脚本初始化完成`);

    } catch (error) {
      console.error(`[${this.siteName}] 初始化失败:`, error);
    }
  }

  /**
   * 等待 DOM 就绪
   */
  waitForDOM() {
    return new Promise(resolve => {
      if (document.readyState !== 'loading') {
        resolve();
      } else {
        document.addEventListener('DOMContentLoaded', resolve);
      }
    });
  }

  /**
   * 等待指定元素出现
   * @param {string} selector - CSS 选择器
   * @param {number} timeout - 超时时间
   */
  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      // 确保 body 存在
      const target = document.body || document.documentElement;
      observer.observe(target, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        const el = document.querySelector(selector);
        if (el) {
          resolve(el);
        } else {
          reject(new Error(`元素 ${selector} 未在 ${timeout}ms 内找到`));
        }
      }, timeout);
    });
  }

  /**
   * 加载设置
   */
  async loadSettings() {
    const storageKey = `${this.siteName}Settings`;

    try {
      const result = await chrome.storage.local.get(storageKey);
      const savedSettings = result[storageKey] || {};
      this.settings = { ...this.options.defaultSettings, ...savedSettings };
      console.log(`[${this.siteName}] 设置已加载:`, this.settings);
    } catch (error) {
      // 处理扩展重载的情况
      if (error.message?.includes('Extension context')) {
        console.warn(`[${this.siteName}] 扩展上下文失效，使用默认设置`);
        this.settings = { ...this.options.defaultSettings };
      } else {
        throw error;
      }
    }
  }

  /**
   * 保存设置
   * @param {Object} newSettings - 新设置
   */
  async saveSettings(newSettings) {
    const storageKey = `${this.siteName}Settings`;
    this.settings = { ...this.settings, ...newSettings };

    try {
      await chrome.storage.local.set({ [storageKey]: this.settings });
      console.log(`[${this.siteName}] 设置已保存:`, this.settings);
    } catch (error) {
      if (error.message?.includes('Extension context')) {
        console.warn(`[${this.siteName}] 保存设置失败，扩展可能已重载`);
      } else {
        throw error;
      }
    }
  }

  /**
   * 获取单个设置
   * @param {string} key - 设置键
   * @param {*} defaultValue - 默认值
   */
  getSetting(key, defaultValue = null) {
    return this.settings[key] ?? defaultValue;
  }

  /**
   * 更新单个设置
   * @param {string} key - 设置键
   * @param {*} value - 设置值
   */
  async updateSetting(key, value) {
    await this.saveSettings({ [key]: value });
    this.applyStyles();
  }

  /**
   * 应用样式
   */
  applyStyles() {
    let styleEl = document.getElementById(this.options.styleId);
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = this.options.styleId;
      document.head.appendChild(styleEl);
    }

    const css = this.getStyles(this.settings);
    styleEl.textContent = css;
    console.log(`[${this.siteName}] 样式已应用`);
  }

  /**
   * 获取样式 CSS（子类重写）
   * @param {Object} settings - 当前设置
   * @returns {string} CSS 字符串
   */
  getStyles(settings) {
    return '';
  }

  /**
   * 设置 DOM 观察者（子类可重写）
   */
  setupObservers() {
    // 默认实现：监听 DOM 变化，必要时重新应用样式
    const observer = new MutationObserver(() => {
      this.onDOMChange();
    });

    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  /**
   * DOM 变化回调（子类可重写）
   */
  onDOMChange() {
    // 子类可重写
  }

  /**
   * 暴露 API 到 window（子类可扩展）
   */
  exposeAPI() {
    const apiName = `${this.siteName}API`;
    window[apiName] = {
      getSettings: () => this.settings,
      updateSettings: (newSettings) => {
        this.saveSettings(newSettings);
        this.applyStyles();
      },
      applyStyles: () => this.applyStyles(),
      resetSettings: () => {
        this.settings = { ...this.options.defaultSettings };
        this.saveSettings(this.settings);
        this.applyStyles();
      }
    };
    console.log(`[${this.siteName}] API 已暴露: window.${apiName}`);
  }

  /**
   * 监听存储变化
   */
  setupStorageListener() {
    const storageKey = `${this.siteName}Settings`;

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName === 'local' && changes[storageKey]) {
        const newSettings = changes[storageKey].newValue;
        if (newSettings) {
          this.settings = { ...this.options.defaultSettings, ...newSettings };
          this.applyStyles();
          console.log(`[${this.siteName}] 设置已更新:`, this.settings);
        }
      }
    });
  }

  /**
   * 脚本就绪回调（子类重写）
   */
  onReady() {
    // 子类可重写
  }

  /**
   * 显示通知
   * @param {string} message - 通知消息
   * @param {number} duration - 显示时长（毫秒）
   */
  showNotification(message, duration = 3000) {
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #333;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 999999;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: slideIn 0.3s ease-out;
    `;

    // 添加动画样式
    if (!document.getElementById(`${this.siteName}-notification-style`)) {
      const style = document.createElement('style');
      style.id = `${this.siteName}-notification-style`;
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, duration);
  }

  /**
   * 防抖函数
   * @param {Function} func - 要执行的函数
   * @param {number} delay - 延迟时间
   */
  debounce(func, delay = 300) {
    let timer = null;
    return (...args) => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), delay);
    };
  }
}

// 导出（如果支持模块）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SiteScript;
}
