/**
 * Popup Bridge
 * 可靠的 popup-content 通信桥梁
 * 确保消息一定能传达
 */

(function () {
  'use strict';

  if (window.PopupBridge) return;

  const READY_CHECK_INTERVAL = 100;
  const MAX_READY_WAIT = 5000;
  const MESSAGE_RETRY = 3;
  const MESSAGE_RETRY_DELAY = 200;

  /**
   * 等待 content script 就绪
   * @param {number} tabId - 标签页 ID
   * @returns {Promise<boolean>}
   */
  async function waitForContentReady(tabId) {
    const startTime = Date.now();

    while (Date.now() - startTime < MAX_READY_WAIT) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, {
          type: 'IS_READY'
        });

        if (response && response.ready) {
          console.log('[PopupBridge] Content script 已就绪');
          return true;
        }
      } catch (error) {
        // Content script 可能还未加载
      }

      await new Promise(resolve => setTimeout(resolve, READY_CHECK_INTERVAL));
    }

    console.warn('[PopupBridge] 等待 content script 就绪超时');
    return false;
  }

  /**
   * 发送消息到 content script（带重试）
   * @param {object} message - 消息对象
   * @param {number|null} tabId - 标签页 ID（null 表示当前标签）
   * @returns {Promise<any>}
   */
  async function sendMessage(message, tabId = null) {
    // 获取当前标签页
    if (!tabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        throw new Error('无法获取当前标签页');
      }
      tabId = tabs[0].id;
    }

    // 先等待 content script 就绪
    await waitForContentReady(tabId);

    // 带重试的消息发送
    let lastError = null;
    for (let i = 0; i < MESSAGE_RETRY; i++) {
      try {
        console.log(`[PopupBridge] 发送消息 (尝试 ${i + 1}/${MESSAGE_RETRY}):`, message.type);

        const response = await chrome.tabs.sendMessage(tabId, message);

        if (response) {
          console.log(`[PopupBridge] 收到响应:`, response);
          return response;
        }
      } catch (error) {
        lastError = error;
        console.warn(`[PopupBridge] 发送失败 (尝试 ${i + 1}):`, error.message);

        if (i < MESSAGE_RETRY - 1) {
          await new Promise(resolve => setTimeout(resolve, MESSAGE_RETRY_DELAY));
        }
      }
    }

    throw lastError || new Error('发送消息失败');
  }

  /**
   * 检查 content script 是否运行
   * @param {number|null} tabId - 标签页 ID
   * @returns {Promise<boolean>}
   */
  async function isContentScriptRunning(tabId = null) {
    try {
      const response = await sendMessage({ type: 'PING' }, tabId);
      return response && response.type === 'PONG';
    } catch (error) {
      return false;
    }
  }

  // 导出接口
  window.PopupBridge = {
    sendMessage,
    isContentScriptRunning,
    waitForContentReady
  };

  console.log('[PopupBridge] 通信桥梁已加载');
})();
