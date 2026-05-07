/**
 * HTML 转义工具函数
 * 防止 XSS 攻击
 */

'use strict'

/**
 * 转义 HTML 特殊字符
 * @param {string} text - 原始文本
 * @returns {string} - 转义后的文本
 */
export function escapeHtml(text) {
  if (!text) return ''
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 反转义 HTML 特殊字符
 * @param {string} html - 转义后的文本
 * @returns {string} - 原始文本
 */
export function unescapeHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/**
 * 转义 HTML 属性值
 * @param {string} text - 原始文本
 * @returns {string} - 转义后的文本
 */
export function escapeAttribute(text) {
  if (!text) return ''
  return String(text).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
