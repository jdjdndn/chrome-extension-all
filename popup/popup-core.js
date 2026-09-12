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
 * 轻量级 Toast 提示（popup 专用）
 * @param {string} message - 提示消息
 * @param {'info'|'success'|'warning'|'error'} [type='info'] - 类型
 * @param {number} [duration=2500] - 显示时长(ms)
 */
export function showToast(message, type = 'info', duration = 2500) {
  let container = document.getElementById('popup-toast-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'popup-toast-container'
    container.style.cssText =
      'position:fixed;top:8px;right:8px;z-index:99999;display:flex;flex-direction:column;gap:6px;pointer-events:none;'
    document.body.appendChild(container)
  }
  const colors = { info: '#333', success: '#10b981', warning: '#f59e0b', error: '#ef4444' }
  const el = document.createElement('div')
  el.textContent = message
  el.style.cssText = `background:${colors[type] || colors.info};color:#fff;padding:8px 14px;border-radius:6px;font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.25);max-width:260px;word-wrap:break-word;pointer-events:auto;opacity:0;transition:opacity .25s;`
  container.appendChild(el)
  requestAnimationFrame(() => (el.style.opacity = '1'))
  setTimeout(() => {
    el.style.opacity = '0'
    setTimeout(() => el.remove(), 300)
  }, duration)
}

/**
 * 轻量级确认对话框（替代 confirm）
 * @param {string} message - 确认消息
 * @returns {Promise<boolean>}
 */
export function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.style.cssText =
      'position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:99998;display:flex;align-items:center;justify-content:center;'
    const box = document.createElement('div')
    box.style.cssText =
      'background:#fff;padding:16px 20px;border-radius:10px;max-width:280px;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.2);color:#333;'
    box.textContent = message
    const btnRow = document.createElement('div')
    btnRow.style.cssText = 'display:flex;gap:8px;margin-top:14px;justify-content:flex-end;'
    const cancelBtn = document.createElement('button')
    cancelBtn.textContent = '取消'
    cancelBtn.style.cssText =
      'padding:5px 14px;border:1px solid #ddd;border-radius:6px;background:#f8f8f8;cursor:pointer;font-size:12px;'
    const okBtn = document.createElement('button')
    okBtn.textContent = '确定'
    okBtn.style.cssText =
      'padding:5px 14px;border:none;border-radius:6px;background:#10b981;color:#fff;cursor:pointer;font-size:12px;'
    cancelBtn.onclick = () => {
      overlay.remove()
      resolve(false)
    }
    okBtn.onclick = () => {
      overlay.remove()
      resolve(true)
    }
    btnRow.appendChild(cancelBtn)
    btnRow.appendChild(okBtn)
    box.appendChild(btnRow)
    overlay.appendChild(box)
    document.body.appendChild(overlay)
  })
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
