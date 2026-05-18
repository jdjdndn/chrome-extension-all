/**
 * Popup 核心模块
 * 导出核心功能供其他模块使用
 */

/**
 * 统一发送消息函数
 */
export async function sendMessage(type, data = {}) {
  try {
    return await chrome.runtime.sendMessage({ type, ...data })
  } catch (error) {
    console.error('[Popup] 发送消息失败:', error.message)
    return null
  }
}

/**
 * 发送消息到 content script
 */
export async function sendMessageToContentScript(message) {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      return await chrome.tabs.sendMessage(tabs[0].id, message)
    }
  } catch (error) {
    if (!error.message.includes('Receiving end does not exist')) {
      console.warn('[Popup] 发送到 content script 失败:', error.message)
    }
  }
  return null
}

/**
 * 广播消息到所有组件
 */
export async function broadcastMessage(message) {
  await sendMessage('BROADCAST_MESSAGE', message)
}

/**
 * HTML 转义
 */
export function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

/**
 * 获取当前域名
 */
export async function getCurrentDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.url) {
      return new URL(tabs[0].url).hostname
    }
  } catch (error) {
    console.error('Failed to get current domain:', error)
  }
  return null
}
