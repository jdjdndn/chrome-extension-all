/**
 * 共享消息工具
 * 统一 Chrome Extension 消息通信
 * 适用于 popup、background、devtools 等非 content script 环境
 */

'use strict';

/**
 * 检查扩展上下文是否有效
 */
export function isExtensionContextValid() {
  try {
    return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id;
  } catch {
    return false;
  }
}

/**
 * 发送消息到 background
 * @param {string} type - 消息类型
 * @param {object} data - 消息数据
 * @returns {Promise<any>}
 */
export async function sendToBackground(type, data = {}) {
  if (!isExtensionContextValid()) {
    console.warn('[Messaging] 扩展上下文已失效');
    return null;
  }

  try {
    return await chrome.runtime.sendMessage({ type, ...data });
  } catch (error) {
    if (!error.message?.includes('Extension context invalidated')) {
      console.error('[Messaging] 发送失败:', error.message);
    }
    return null;
  }
}

/**
 * 发送消息到 content script
 * @param {object} message - 消息对象
 * @param {number} [tabId] - 标签页ID，不传则使用当前活动标签
 * @returns {Promise<any>}
 */
export async function sendToContentScript(message, tabId = null) {
  if (!isExtensionContextValid()) {
    return null;
  }

  try {
    let targetTabId = tabId;

    if (!targetTabId) {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) return null;
      targetTabId = tabs[0].id;
    }

    return await chrome.tabs.sendMessage(targetTabId, message);
  } catch (error) {
    // content script 未加载是正常情况
    if (!error.message?.includes('Receiving end does not exist')) {
      console.warn('[Messaging] 发送到 content script 失败:', error.message);
    }
    return null;
  }
}

/**
 * 广播消息到所有标签页
 * @param {object} message - 消息对象
 * @returns {Promise<void>}
 */
export async function broadcastToAllTabs(message) {
  if (!isExtensionContextValid()) return;

  try {
    const tabs = await chrome.tabs.query({});
    await Promise.all(
      tabs
        .filter(tab => tab.id && tab.url?.startsWith('http'))
        .map(tab => chrome.tabs.sendMessage(tab.id, message).catch(() => {}))
    );
  } catch (error) {
    console.warn('[Messaging] 广播失败:', error.message);
  }
}

const SharedMessaging = {
  isExtensionContextValid,
  sendToBackground,
  sendToContentScript,
  broadcastToAllTabs
};
export default SharedMessaging;

// 全局暴露
if (typeof window !== 'undefined' && !window.SharedMessaging) {
  window.SharedMessaging = SharedMessaging;
}
