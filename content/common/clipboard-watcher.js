/**
 * 剪贴板自动记录监听器
 * 监听 copy 事件，自动记录剪贴板内容到历史
 */

'use strict'
;(function () {
  // 避免重复初始化
  if (window.ClipboardWatcherInitialized) {
    return
  }
  window.ClipboardWatcherInitialized = true

  /**
   * 记录剪贴板内容到历史
   * @param {string} text - 剪贴板内容
   */
  async function recordClipboard(text) {
    if (!text || text.trim().length === 0) {
      return
    }

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

  async function handleClipboardEvent() {
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
  }

  document.addEventListener('copy', handleClipboardEvent)
  document.addEventListener('cut', handleClipboardEvent)

  window.ClipboardWatcherDestroy = () => {
    document.removeEventListener('copy', handleClipboardEvent)
    document.removeEventListener('cut', handleClipboardEvent)
  }

  console.log('[ClipboardWatcher] 已初始化')
})()
