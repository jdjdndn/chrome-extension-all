/**
 * ModelScope 脚本
 * 功能：监控模型标题元素，自动复制文本
 * 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
 */

(function () {
  'use strict';

  // ========== 防止重复加载 ==========
  if (window.ModelScopeScript && window.ModelScopeScript.isInitialized) {
    console.log('[ModelScope] 脚本已加载，跳过重复初始化');
    return;
  }
  if (!window.ModelScopeScript) {
    window.ModelScopeScript = { isInitialized: false };
  }

  // ========== 配置 ==========
  const TITLE_SELECTOR = '.acss-3mq9va.ms-title-font';
  const DEBOUNCE_DELAY = 300; // 防抖延迟（毫秒）
  let lastCopiedText = ''; // 记录上次复制的文本，避免重复复制

  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   */
  async function copyToClipboard(text) {
    if (!text || text === lastCopiedText) return;

    try {
      await navigator.clipboard.writeText(text);
      lastCopiedText = text;
      console.log(`[ModelScope] 已复制标题: ${text}`);
    } catch (err) {
      console.error('[ModelScope] 复制失败:', err);
    }
  }

  /**
   * 检测并复制标题元素文本
   */
  function detectAndCopyTitle() {
    const titleElement = document.querySelector(TITLE_SELECTOR);

    if (titleElement) {
      const text = titleElement.innerText?.trim();
      if (text) {
        copyToClipboard(text);
      }
    }
  }

  /**
   * 等待 DOMUtils 就绪
   * @param {number} timeout - 超时时间
   * @returns {Promise<boolean>}
   */
  function waitForDOMUtils(timeout = 5000) {
    return new Promise((resolve) => {
      if (window.DOMUtils) {
        resolve(true);
        return;
      }

      const startTime = Date.now();
      const check = () => {
        if (window.DOMUtils) {
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          console.warn('[ModelScope] DOMUtils 加载超时');
          resolve(false);
        } else {
          setTimeout(check, 50);
        }
      };
      check();
    });
  }

  /**
   * 初始化
   */
  async function init() {
    if (window.ModelScopeScript.isInitialized) {
      console.log('[ModelScope] 已经初始化，跳过');
      return;
    }

    // 等待 DOMUtils 就绪
    const domUtilsReady = await waitForDOMUtils();
    if (!domUtilsReady) {
      console.error('[ModelScope] DOMUtils 未加载，无法初始化');
      return;
    }

    window.ModelScopeScript.isInitialized = true;

    // 确保 document.body 存在
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        setTimeout(init, 50);
      }
      return;
    }

    console.log('[ModelScope] 脚本初始化完成');

    // 首次检测
    detectAndCopyTitle();

    // 创建防抖的 MutationObserver
    const observer = DOMUtils.createDebouncedObserver(detectAndCopyTitle, DEBOUNCE_DELAY);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    // 存储 observer 以便清理
    window.ModelScopeScript.observer = observer;

    console.log('[ModelScope] MutationObserver 已启动，监控选择器:', TITLE_SELECTOR);
  }

  /**
   * 清理函数
   */
  function cleanup() {
    if (window.ModelScopeScript?.observer) {
      window.ModelScopeScript.observer.disconnect();
      window.ModelScopeScript.observer = null;
      console.log('[ModelScope] Observer 已断开');
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup);

  // 启动
  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();
