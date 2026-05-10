/**
 * 剪贴板自动记录监听器
 * 监听 copy 事件，自动记录剪贴板内容到历史
 */

'use strict'
;(function () {
  // 避免重复初始化
  if (window.ClipboardWatcherInitialized) {return}
  window.ClipboardWatcherInitialized = true

  /**
   * 记录剪贴板内容到历史
   * @param {string} text - 剪贴板内容
   */
  async function recordClipboard(text) {
    if (!text || text.trim().length === 0) {return}

    try {
      // 发送到 background 记录
      const response = await chrome.runtime.sendMessage({
        type: 'RECORD_CLIPBOARD',
        text: text,
        timestamp: Date.now(),
        url: window.location.href,
      })

      if (response?.success) {
        console.log('[ClipboardWatcher] 已记录剪贴板内容')
      }
    } catch (error) {
      // 扩展上下文失效或未加载，静默失败
      if (!error.message?.includes('Extension context invalidated')) {
        console.warn('[ClipboardWatcher] 记录失败:', error.message)
      }
    }
  }

  /**
   * 监听 copy 事件
   */
  document.addEventListener('copy', (event) => {
    // 延迟读取剪贴板，确保内容已写入
    setTimeout(async () => {
      try {
        // 尝试从剪贴板 API 读取
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText()
          if (text) {
            await recordClipboard(text)
          }
        }
      } catch (error) {
        // 权限被拒绝，尝试从 selection 读取
        const selection = document.getSelection()
        if (selection && selection.toString()) {
          await recordClipboard(selection.toString())
        }
      }
    }, 100)
  })

  /**
   * 监听 cut 事件
   */
  document.addEventListener('cut', (event) => {
    setTimeout(async () => {
      try {
        if (navigator.clipboard && navigator.clipboard.readText) {
          const text = await navigator.clipboard.readText()
          if (text) {
            await recordClipboard(text)
          }
        }
      } catch (error) {
        const selection = document.getSelection()
        if (selection && selection.toString()) {
          await recordClipboard(selection.toString())
        }
      }
    }, 100)
  })

  console.log('[ClipboardWatcher] 已初始化')
})()
