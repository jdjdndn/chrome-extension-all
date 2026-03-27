// ========== 消息通信工具模块 ==========
// 封装 Chrome Runtime 消息通信（基于 EventBus）
// 使用 ScriptLoader 进行依赖管理

(function () {
  'use strict';

  // 避免重复初始化
  if (window.MessagingUtils) return;

  /**
   * 检查是否在扩展环境中
   * @returns {boolean}
   */
  function isExtensionContext() {
    return typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id;
  }

  /**
   * 检查扩展上下文是否有效
   * @returns {boolean}
   */
  function isExtensionContextValid() {
    try {
      return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
    } catch {
      return false;
    }
  }

  /**
   * 检查 EventBus 是否就绪
   * @returns {boolean}
   */
  function isEventBusReady() {
    return typeof EventBus !== 'undefined' && EventBus.getState && EventBus.getState().isReady;
  }

  /**
   * 等待 EventBus 就绪（使用 ScriptLoader 事件驱动）
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>}
   */
  function waitForEventBus(timeout = 3000) {
    // 如果已就绪，立即返回
    if (isEventBusReady()) {
      return Promise.resolve(true);
    }

    // 优先使用 ScriptLoader 的事件驱动机制
    if (window.ScriptLoader) {
      return ScriptLoader.waitFor(['EventBus'], timeout);
    }

    // 降级到轮询（兼容旧代码）
    return new Promise((resolve) => {
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
   * 发送消息到 background script（使用 EventBus，带重试机制）
   * @param {object} message - 消息对象
   * @param {object} options - 选项
   * @param {number} options.retries - 重试次数，默认 2
   * @param {number} options.retryDelay - 重试延迟(ms)，默认 1000
   * @param {number} options.timeout - 超时时间(ms)，默认 5000
   * @returns {Promise<any>}
   */
  async function sendToBackground(message, options = {}) {
    const { retries = 2, retryDelay = 1000, timeout = 5000 } = options;

    if (!isExtensionContextValid()) {
      console.warn('[Messaging] 扩展上下文已失效，请刷新页面');
      return null;
    }

    let lastError = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      // 检查扩展上下文是否仍然有效
      if (!isExtensionContextValid()) {
        console.warn('[Messaging] 扩展上下文已失效，请刷新页面');
        return null;
      }

      // 优先使用 EventBus
      if (isEventBusReady()) {
        try {
          return await EventBus.request(message.type, message, { timeout });
        } catch (error) {
          lastError = error;
          // 扩展上下文失效，静默返回（扩展刷新后的正常情况）
          if (error.message?.includes('Extension context invalidated')) {
            return null;
          }
          // 超时错误，尝试重试
          if (error.message?.includes('Timeout') && attempt < retries) {
            console.log(`[Messaging] ${message.type} 超时，第 ${attempt + 1}/${retries} 次重试...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            continue;
          }
          // 降级到原生 API
          console.warn('[Messaging] EventBus 发送失败，降级到原生:', error.message);
        }
      }

      // 降级到原生 chrome.runtime
      try {
        return await chrome.runtime.sendMessage(message);
      } catch (error) {
        lastError = error;
        // 扩展上下文失效，静默返回
        if (error.message?.includes('Extension context invalidated')) {
          return null;
        }
        if (attempt < retries) {
          console.log(`[Messaging] 原生 API 失败，第 ${attempt + 1}/${retries} 次重试...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
      }
    }

    // 只在非上下文失效错误时打印错误
    if (lastError && !lastError.message?.includes('Extension context invalidated')) {
      console.error('[Messaging] 发送消息失败:', lastError?.message || '未知错误');
    }
    return null;
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
   * 向 background 注册阻止域名列表（带重试和等待 EventBus 就绪）
   * @param {string} domain - 当前域名
   * @param {string[]} blockedDomains - 要阻止的域名列表
   * @returns {Promise<any>}
   */
  async function registerBlockedDomains(domain, blockedDomains) {
    // 等待 EventBus 就绪
    const isReady = await waitForEventBus(3000);
    if (!isReady) {
      console.warn('[Messaging] EventBus 未就绪，跳过注册域名');
      return { success: false, reason: 'EventBus not ready' };
    }

    // 检查扩展上下文
    if (!isExtensionContextValid()) {
      console.warn('[Messaging] 扩展上下文已失效，跳过注册域名');
      return { success: false, reason: 'Extension context invalidated' };
    }

    return sendToBackground({
      type: 'REGISTER_BLOCKED_DOMAINS',
      domain,
      blockedDomains,
    }, { retries: 3, retryDelay: 500, timeout: 8000 });
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
    isExtensionContextValid,
    isEventBusReady,
    waitForEventBus,
    sendToBackground,
    createMessageHandler,
    checkDomainBlocked,
    registerBlockedDomains,
    subscribe,
    publish,
  };

  // 通知 ScriptLoader：MessagingUtils 已就绪
  if (window.ScriptLoader) {
    ScriptLoader.markReady('MessagingUtils');
  }

  console.log('[Messaging] 消息通信模块已加载 (EventBus 增强版)');
})();
