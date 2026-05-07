/**
 * 剪贴板工具函数
 * 统一的剪贴板复制功能
 */

'use strict'

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 * @returns {Promise<boolean>} - 是否成功
 */
export async function copyToClipboard(text) {
  if (!text) return false

  try {
    // 优先使用现代 Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // 降级到 execCommand（兼容旧浏览器）
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;'
    document.body.appendChild(textarea)
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch (error) {
    console.error('[Clipboard] 复制失败:', error.message)
    return false
  }
}

/**
 * 从剪贴板读取文本
 * @returns {Promise<string|null>} - 剪贴板内容或 null
 */
export async function readFromClipboard() {
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      return await navigator.clipboard.readText()
    }
    return null
  } catch (error) {
    // 权限被拒绝或不可用
    console.warn('[Clipboard] 读取失败:', error.message)
    return null
  }
}
