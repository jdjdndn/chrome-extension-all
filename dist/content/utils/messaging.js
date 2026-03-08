// ========== 消息通信工具模块 ==========
// 封装 Chrome Runtime 消息通信（基于 EventBus）

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
   * 检查 EventBus 是否就绪
   * @returns {boolean}
   */
  function isEventBusReady() {
    return typeof EventBus !== 'undefined' && EventBus.getState && EventBus.getState().isReady;
  }

  /**
   * 等待 EventBus 就绪
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>}
   */
  function waitForEventBus(timeout = 3000) {
    return new Promise((resolve) => {
      if (isEventBusReady()) {
        resolve(true);
        return;
      }
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (isEventBusReady()) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * 发送消息到 background script（使用 EventBus）
   * @param {object} message - 消息对象
   * @returns {Promise<any>}
   */
  async function sendToBackground(message) {
    if (!isExtensionContext()) {
      console.warn('[Messaging] 非扩展环境，无法发送消息');
      return null;
    }

    // 优先使用 EventBus
    if (isEventBusReady()) {
      try {
        return await EventBus.request(message.type, message, { timeout: 5000 });
      } catch (error) {
        console.warn('[Messaging] EventBus 发送失败，降级到原生:', error.message);
      }
    }

    // 降级到原生 chrome.runtime
    try {
      return await chrome.runtime.sendMessage(message);
    } catch (error) {
      console.error('[Messaging] 发送消息失败:', error);
      return null;
    }
  }

  /**
   * 创建消息处理器（支持多处理器模式）
   * 使用 EventBus 订阅机制
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

    // 如果 EventBus 就绪，使用 EventBus 注册
    if (isEventBusReady()) {
      for (const [type, handler] of Object.entries(handlers)) {
        EventBus.on(type, async (data, context) => {
          return await handler(data, context);
        });
      }
    } else {
      // 降级到原生 chrome.runtime.onMessage
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
    }

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

  /**
   * 订阅事件（EventBus 封装）
   * @param {string} type - 事件类型
   * @param {function} callback - 回调函数
   * @returns {function} 取消订阅函数
   */
  function subscribe(type, callback) {
    if (isEventBusReady()) {
      return EventBus.subscribe(type, callback);
    }
    // 降级：返回空函数
    return () => {};
  }

  /**
   * 发布事件（EventBus 封装）
   * @param {string} type - 事件类型
   * @param {any} data - 数据
   */
  async function publish(type, data) {
    if (isEventBusReady()) {
      await EventBus.publish(type, data);
    }
  }

  // 导出工具函数
  window.MessagingUtils = {
    isExtensionContext,
    isEventBusReady,
    waitForEventBus,
    sendToBackground,
    createMessageHandler,
    checkDomainBlocked,
    registerBlockedDomains,
    subscribe,
    publish,
  };

  console.log('[Messaging] 消息通信模块已加载 (EventBus 增强版)');
})();
