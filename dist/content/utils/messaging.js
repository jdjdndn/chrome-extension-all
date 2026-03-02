// ========== 消息通信工具模块 ==========
// 封装 Chrome Runtime 消息通信

(function () {
  'use strict';

  // 避免重复初始化
  if (window.MessagingUtils) return;

  /**
   * 检查是否在扩展环境中
   * @returns {boolean}
   */
  function isExtensionContext() {
    return typeof chrome !== 'undefined' && chrome.runtime;
  }

  /**
   * 发送消息到 background script
   * @param {object} message - 消息对象
   * @returns {Promise<any>}
   */
  async function sendToBackground(message) {
    if (!isExtensionContext()) {
      console.warn('[Messaging] 非扩展环境，无法发送消息');
      return null;
    }

    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('[Messaging] 发送消息失败:', error);
      return null;
    }
  }

  /**
   * 创建消息处理器（支持多处理器模式）
   * @param {string} handlerId - 唯一标识符，防止重复注册
   * @param {object} handlers - 消息类型与处理函数的映射
   * @returns {boolean} 是否成功注册
   */
  function createMessageHandler(handlerId, handlers) {
    if (!isExtensionContext()) {
      console.warn('[Messaging] 非扩展环境，无法注册消息处理器');
      return false;
    }

    // 检查是否已注册
    if (window[handlerId]) {
      console.log(`[Messaging] 处理器 ${handlerId} 已存在，跳过注册`);
      return false;
    }

    window[handlerId] = true;
    console.log(`[Messaging] 注册消息处理器: ${handlerId}`);

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const handler = handlers[message.type];
      if (handler) {
        const result = handler(message, sender);
        // 支持异步处理
        if (result instanceof Promise) {
          result.then(sendResponse);
          return true; // 保持通道开放
        }
        sendResponse(result);
        return true;
      }
      return false; // 未处理，让其他处理器处理
    });

    return true;
  }

  /**
   * 检查域名是否被阻止
   * @param {string} currentDomain - 当前域名
   * @param {string} requestDomain - 请求域名
   * @returns {Promise<{blocked: boolean, blockedReason?: string}>}
   */
  async function checkDomainBlocked(currentDomain, requestDomain) {
    return sendToBackground({
      type: 'CHECK_DOMAIN_BLOCKED',
      currentDomain,
      requestDomain,
    });
  }

  /**
   * 向 background 注册阻止域名列表
   * @param {string} domain - 当前域名
   * @param {string[]} blockedDomains - 要阻止的域名列表
   * @returns {Promise<any>}
   */
  async function registerBlockedDomains(domain, blockedDomains) {
    return sendToBackground({
      type: 'REGISTER_BLOCKED_DOMAINS',
      domain,
      blockedDomains,
    });
  }

  // 导出工具函数
  window.MessagingUtils = {
    isExtensionContext,
    sendToBackground,
    createMessageHandler,
    checkDomainBlocked,
    registerBlockedDomains,
  };

  console.log('[Messaging] 消息通信模块已加载');
})();
