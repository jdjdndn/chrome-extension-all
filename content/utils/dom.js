// ========== DOM 工具模块 ==========
// 提供 DOM 操作相关的通用功能

(function () {
  'use strict';

  // 避免重复初始化
  if (window.DOMUtils) return;

  /**
   * 获取当前域名
   * @returns {string|null}
   */
  function getCurrentDomain() {
    try {
      return window.location.hostname;
    } catch (error) {
      console.error('[DOM] 获取域名失败:', error);
      return null;
    }
  }

  /**
   * 创建或更新样式标签
   * @param {string} id - 样式标签 ID
   * @param {string} css - CSS 内容
   * @returns {HTMLStyleElement|null}
   */
  function upsertStyle(id, css) {
    // 移除已存在的样式标签
    const existing = document.getElementById(id);
    if (existing) {
      existing.remove();
    }

    if (!css || !css.trim()) {
      return null;
    }

    const style = document.createElement('style');
    style.id = id;
    style.textContent = css;
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  /**
   * 移除样式标签
   * @param {string} id - 样式标签 ID
   * @returns {boolean} 是否成功移除
   */
  function removeStyle(id) {
    const style = document.getElementById(id);
    if (style) {
      style.remove();
      return true;
    }
    return false;
  }

  /**
   * 生成隐藏元素的 CSS
   * @param {string[]} selectors - CSS 选择器数组
   * @returns {string} CSS 字符串
   */
  function generateHideCSS(selectors) {
    return selectors
      .filter((s) => s && s.trim())
      .map((selector) => `${selector} { display: none !important; }`)
      .join('\n');
  }

  /**
   * 应用隐藏元素样式
   * @param {string} styleId - 样式标签 ID
   * @param {string[]} selectors - 要隐藏的选择器数组
   */
  function applyHideStyle(styleId, selectors) {
    if (!selectors || selectors.length === 0) {
      removeStyle(styleId);
      return;
    }

    const css = generateHideCSS(selectors);
    upsertStyle(styleId, css);
    console.log(`[DOM] 已应用隐藏样式，共 ${selectors.length} 个选择器`);
  }

  /**
   * 等待 DOM 元素出现
   * @param {string} selector - CSS 选择器
   * @param {number} timeout - 超时时间（毫秒）
   * @param {Element} parent - 父元素，默认 document
   * @returns {Promise<Element|null>}
   */
  function waitForElement(selector, timeout = 10000, parent = document) {
    return new Promise((resolve) => {
      const element = parent.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const el = parent.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(parent === document ? document.body : parent, {
        childList: true,
        subtree: true,
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  }

  /**
   * 批量等待多个元素
   * @param {string[]} selectors - CSS 选择器数组
   * @param {number} timeout - 超时时间
   * @returns {Promise<Element[]>}
   */
  async function waitForElements(selectors, timeout = 10000) {
    const results = await Promise.all(
      selectors.map((s) => waitForElement(s, timeout))
    );
    return results.filter(Boolean);
  }

  /**
   * 防抖执行的 DOM 观察器
   * @param {function} callback - 回调函数
   * @param {number} debounceMs - 防抖延迟
   * @returns {MutationObserver}
   */
  function createDebouncedObserver(callback, debounceMs = 300) {
    let timer = null;
    const observer = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(callback, debounceMs);
    });
    return observer;
  }

  // 导出工具函数
  window.DOMUtils = {
    getCurrentDomain,
    upsertStyle,
    removeStyle,
    generateHideCSS,
    applyHideStyle,
    waitForElement,
    waitForElements,
    createDebouncedObserver,
  };

  console.log('[DOM] DOM工具模块已加载');
})();
