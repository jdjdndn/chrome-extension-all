/**
 * ToastNotification - 统一提示组件
 * 提供轻量级的消息提示功能
 */

'use strict'

let toastContainer = null
let toastIdCounter = 0

/**
 * 确保容器存在
 */
function ensureContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div')
    toastContainer.id = 'toast-notification-container'
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    `
    document.body.appendChild(toastContainer)

    // 添加动画样式
    if (!document.getElementById('toast-notification-styles')) {
      const style = document.createElement('style')
      style.id = 'toast-notification-styles'
      style.textContent = `
        @keyframes toast-slide-in {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes toast-slide-out {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        .toast-item {
          pointer-events: auto;
        }
      `
      document.head.appendChild(style)
    }
  }
}

/**
 * 显示提示消息
 * @param {string} message - 消息内容
 * @param {Object} options - 配置选项
 * @param {number} [options.duration=3000] - 显示时长（毫秒）
 * @param {string} [options.type='info'] - 类型：info, success, warning, error
 * @param {string} [options.position='top-right'] - 位置
 * @returns {Object} Toast实例，包含close方法
 */
export function toast(message, options = {}) {
  const { duration = 3000, type = 'info', position = 'top-right' } = options

  ensureContainer()

  // 类型对应的样式
  const typeStyles = {
    info: 'background: #333; color: white;',
    success: 'background: #10b981; color: white;',
    warning: 'background: #f59e0b; color: white;',
    error: 'background: #ef4444; color: white;',
  }

  // 创建toast元素
  const id = ++toastIdCounter
  const toastEl = document.createElement('div')
  toastEl.className = 'toast-item'
  toastEl.dataset.toastId = id
  toastEl.textContent = message
  toastEl.style.cssText = `
    ${typeStyles[type] || typeStyles.info}
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: toast-slide-in 0.3s ease-out;
    max-width: 300px;
    word-wrap: break-word;
  `

  toastContainer.appendChild(toastEl)

  // 自动关闭
  let timeoutId = null
  const close = () => {
    if (timeoutId) clearTimeout(timeoutId)
    toastEl.style.animation = 'toast-slide-out 0.3s ease-in'
    setTimeout(() => toastEl.remove(), 300)
  }

  if (duration > 0) {
    timeoutId = setTimeout(close, duration)
  }

  return { id, close }
}

/**
 * 快捷方法
 */
export const toastSuccess = (message, duration) => toast(message, { type: 'success', duration })
export const toastWarning = (message, duration) => toast(message, { type: 'warning', duration })
export const toastError = (message, duration) => toast(message, { type: 'error', duration })
export const toastInfo = (message, duration) => toast(message, { type: 'info', duration })

/**
 * 关闭所有提示
 */
export function closeAllToasts() {
  if (toastContainer) {
    toastContainer.innerHTML = ''
  }
}

const ToastNotification = {
  show: toast,
  success: toastSuccess,
  warning: toastWarning,
  error: toastError,
  info: toastInfo,
  closeAll: closeAllToasts,
}

export default ToastNotification

// 全局暴露
if (typeof window !== 'undefined' && !window.Toast) {
  window.Toast = ToastNotification
  console.log('[Toast] 模块已加载')
}
