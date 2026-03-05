/**
 * Content Script Bridge
 * 可靠的 popup-content 通信桥梁
 * 确保消息一定能传达
 */

(function () {
  'use strict';

  if (window.ContentBridge) return;

  const READY_TIMEOUT = 5000; // 5秒超时
  const PING_INTERVAL = 30000; // 30秒心跳

  // 状态管理
  const state = {
    isReady: false,
    initTime: Date.now(),
    messageCount: 0
  };

  // 待处理的消息队列
  const pendingMessages = new Map();

  /**
   * 标记 content script 已就绪
   */
  function markReady() {
    state.isReady = true;
    console.log('[ContentBridge] Content script 已就绪');

    // 通知 background
    chrome.runtime.sendMessage({
      type: 'CONTENT_SCRIPT_READY',
      url: window.location.href,
      timestamp: Date.now()
    }).catch(() => {});
  }

  /**
   * 处理来自 popup 的消息
   */
  function handleMessage(message, sender, sendResponse) {
    state.messageCount++;

    console.log(`[ContentBridge] 收到消息 #${state.messageCount}:`, message.type);

    // 响应就绪检查
    if (message.type === 'PING') {
      sendResponse({
        type: 'PONG',
        ready: state.isReady,
        uptime: Date.now() - state.initTime,
        messageCount: state.messageCount
      });
      return true;
    }

    // 响应就绪状态查询
    if (message.type === 'IS_READY') {
      sendResponse({
        ready: state.isReady,
        initTime: state.initTime
      });
      return true;
    }

    return false; // 让其他处理器处理
  }

  // 注册消息监听
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const handled = handleMessage(message, sender, sendResponse);
    if (!handled) {
      // 给其他处理器机会
      return false;
    }
    return true;
  });

  // 启动心跳
  const heartbeatInterval = setInterval(() => {
    if (document.hidden) return; // 页面隐藏时不发送心跳

    chrome.runtime.sendMessage({
      type: 'CONTENT_HEARTBEAT',
      url: window.location.href,
      ready: state.isReady,
      uptime: Date.now() - state.initTime
    }).catch(() => {
      // Background 可能未就绪，忽略错误
    });
  }, PING_INTERVAL);

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    clearInterval(heartbeatInterval);
  });

  // 导出接口
  window.ContentBridge = {
    markReady,
    isReady: () => state.isReady,
    getState: () => ({ ...state })
  };

  console.log('[ContentBridge] 通信桥梁已加载');
})();
