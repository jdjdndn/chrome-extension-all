// content/modules/ai-aggregator/messenger.js
/**
 * AI 聚合问答 - 消息通信模块
 * 封装跨组件消息传递
 */

// 消息类型常量
const MessageType = {
  // 聚合页面 -> Background
  START_AGGREGATION: 'AIA_START_AGGREGATION',
  STOP_AGGREGATION: 'AIA_STOP_AGGREGATION',
  GET_AI_SITES: 'AIA_GET_AI_SITES',
  UPDATE_AI_SITE: 'AIA_UPDATE_AI_SITE',

  // Background -> 聚合页面
  AGGREGATION_STARTED: 'AIA_AGGREGATION_STARTED',
  AI_RESPONSE: 'AIA_AI_RESPONSE',
  AI_STATUS_CHANGE: 'AIA_AI_STATUS_CHANGE',
  AGGREGATION_COMPLETE: 'AIA_AGGREGATION_COMPLETE',
  AGGREGATION_ERROR: 'AIA_AGGREGATION_ERROR',

  // Inject Script -> Background
  INJECT_READY: 'AIA_INJECT_READY',
  INJECT_RESPONSE: 'AIA_INJECT_RESPONSE',
  INJECT_ERROR: 'AIA_INJECT_ERROR',
  INJECT_COMPLETE: 'AIA_INJECT_COMPLETE',
}

// AI 状态枚举
const AIStatus = {
  IDLE: 'idle', // 空闲
  PENDING: 'pending', // 等待中
  LOADING: 'loading', // 页面加载中
  SENDING: 'sending', // 发送问题中
  RESPONDING: 'responding', // 回答中
  COMPLETED: 'completed', // 已完成
  ERROR: 'error', // 错误
  LOGIN_REQUIRED: 'login_required', // 需要登录
}

/**
 * 发送消息到 Background
 */
async function sendToBackground(type, data = {}) {
  try {
    const response = await chrome.runtime.sendMessage({
      type,
      ...data,
      timestamp: Date.now(),
    })
    return response
  } catch (error) {
    console.error('[AI Aggregator Messenger] 发送消息失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 发送消息到指定 Tab
 */
async function sendToTab(tabId, type, data = {}) {
  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type,
      ...data,
      timestamp: Date.now(),
    })
    return response
  } catch (error) {
    console.error('[AI Aggregator Messenger] 发送消息到 Tab 失败:', error)
    return { success: false, error: error.message }
  }
}

/**
 * 监听来自 Background 的消息
 */
function onBackgroundMessage(callback) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type && message.type.startsWith('AIA_')) {
      callback(message, sender, sendResponse)
      return true // 保持消息通道开放
    }
    return false
  })
}

/**
 * 监听来自 Tab 的消息（用于 Background）
 */
function onTabMessage(callback) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type && message.type.startsWith('AIA_') && sender.tab) {
      callback(message, sender, sendResponse)
      return true
    }
    return false
  })
}

// 导出
if (typeof window !== 'undefined') {
  window.AIAggregatorMessenger = {
    MessageType,
    AIStatus,
    sendToBackground,
    sendToTab,
    onBackgroundMessage,
    onTabMessage,
  }
}

export { MessageType, AIStatus, sendToBackground, sendToTab, onBackgroundMessage, onTabMessage }
