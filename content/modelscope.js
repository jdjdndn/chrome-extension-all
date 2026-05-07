/**
 * ModelScope 脚本
 * 功能：监控模型标题元素，自动复制文本
 * 使用公共模块重构
 */

import { createScriptGuard } from './utils/script-guard.js'
;(function () {
  'use strict'

  // 防重复加载
  const guard = createScriptGuard('ModelScope')
  if (guard.check()) {
    return
  }

  // ========== 使用 ScriptLoader 声明依赖 ==========
  if (window.ScriptLoader) {
    ScriptLoader.declare({
      name: 'modelscope-script',
      dependencies: ['DOMUtils'],
      onReady: initModelScopeScript,
    })
  } else {
    // 降级：直接初始化（兼容旧环境）
    console.log('[ModelScope] ScriptLoader 未加载，使用降级模式')
    initModelScopeScriptLegacy()
  }

  // ========== 主初始化函数（由 ScriptLoader 调用）==========
  async function initModelScopeScript() {
    console.log('[ModelScope] 依赖已就绪，开始初始化')
    init()
  }

  // ========== 降级初始化函数（兼容旧环境）==========
  async function initModelScopeScriptLegacy() {
    // 等待 DOMUtils 就绪
    const domUtilsReady = await waitForDOMUtils()
    if (!domUtilsReady) {
      console.error('[ModelScope] DOMUtils 未加载，无法初始化')
      return
    }
    init()
  }

  // ========== 配置 ==========
  const TITLE_SELECTOR = '.acss-3mq9va.ms-title-font'
  const DEBOUNCE_DELAY = 300 // 防抖延迟（毫秒）
  let lastCopiedText = '' // 记录上次复制的文本，避免重复复制
  let observer = null

  /**
   * 复制文本到剪贴板
   * @param {string} text - 要复制的文本
   */
  async function copyToClipboard(text) {
    if (!text || text === lastCopiedText) return

    try {
      // 优先使用 navigator.clipboard（需要安全上下文）
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        lastCopiedText = text
        console.log(`[ModelScope] 已复制标题: ${text}`)
      } else {
        // 降级方案：使用 execCommand（已废弃但仍可用）
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;opacity:0;'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
        lastCopiedText = text
        console.log(`[ModelScope] 已复制标题(降级方案): ${text}`)
      }
    } catch (err) {
      // SecurityError 或其他错误
      if (err.name === 'SecurityError') {
        console.warn('[ModelScope] 安全限制，无法访问剪贴板')
      } else {
        console.error('[ModelScope] 复制失败:', err.message || err)
      }
    }
  }

  /**
   * 检测并复制标题元素文本
   */
  function detectAndCopyTitle() {
    const titleElement = document.querySelector(TITLE_SELECTOR)

    if (titleElement) {
      const text = titleElement.innerText?.trim()
      if (text) {
        copyToClipboard(text)
      }
    }
  }

  /**
   * 等待 DOMUtils 就绪
   * @param {number} timeout - 超时时间
   * @returns {Promise<boolean>}
   */
  function waitForDOMUtils(timeout = 5000) {
    return new Promise((resolve) => {
      if (window.DOMUtils) {
        resolve(true)
        return
      }

      const startTime = Date.now()
      const check = () => {
        if (window.DOMUtils) {
          resolve(true)
        } else if (Date.now() - startTime > timeout) {
          console.warn('[ModelScope] DOMUtils 加载超时')
          resolve(false)
        } else {
          setTimeout(check, 50)
        }
      }
      check()
    })
  }

  /**
   * 初始化
   */
  async function init() {
    // 确保 document.body 存在
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
      } else {
        setTimeout(init, 50)
      }
      return
    }

    guard.markInitialized()
    console.log('[ModelScope] 脚本初始化完成')

    // 首次检测
    detectAndCopyTitle()

    // 创建防抖的 MutationObserver
    observer = DOMUtils.createDebouncedObserver(detectAndCopyTitle, DEBOUNCE_DELAY)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })

    console.log('[ModelScope] MutationObserver 已启动，监控选择器:', TITLE_SELECTOR)
  }

  /**
   * 清理函数
   */
  function cleanup() {
    if (observer) {
      observer.disconnect()
      observer = null
      console.log('[ModelScope] Observer 已断开')
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup)
})()
