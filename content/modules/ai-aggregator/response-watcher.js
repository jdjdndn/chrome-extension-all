// content/modules/ai-aggregator/response-watcher.js
/**
 * AI 聚合问答 - 回复监听模块
 * 监听 AI 网站的回复内容，实时上报
 */

(function () {
  'use strict'

  // 防止重复注入
  if (window.__aiAggregatorResponseWatcher) {
    return
  }
  window.__aiAggregatorResponseWatcher = true

  console.log('[AI Aggregator Response Watcher] 监听脚本已加载')

  /**
   * 回复监听器类
   */
  class ResponseWatcher {
    constructor(config) {
      this.config = config
      this.siteId = config.id
      this.containerSelector = config.selectors.responseContainer
      this.lastContent = ''
      this.isWatching = false
      this.observer = null
      this.pollingTimer = null
    }

    /**
     * 查找回复容器
     */
    async findContainer(timeout = 30000) {
      const selectorList = this.containerSelector.split(',').map((s) => s.trim())

      return new Promise((resolve, reject) => {
        // 先尝试立即查找
        for (const selector of selectorList) {
          const element = document.querySelector(selector)
          if (element) {
            resolve(element)
            return
          }
        }

        // 设置观察器
        const observer = new MutationObserver(() => {
          for (const selector of selectorList) {
            const element = document.querySelector(selector)
            if (element) {
              observer.disconnect()
              resolve(element)
              return
            }
          }
        })

        observer.observe(document.body, {
          childList: true,
          subtree: true,
        })

        setTimeout(() => {
          observer.disconnect()
          reject(new Error('回复容器未找到'))
        }, timeout)
      })
    }

    /**
     * 提取回复内容
     */
    extractContent(container) {
      // 尝试获取最新的 AI 回复（通常是最后一个消息块）
      const messageBlocks = container.querySelectorAll(
        '[class*="message"], [class*="response"], [class*="chat"]'
      )

      if (messageBlocks.length > 0) {
        // 获取最后一个 AI 回复（排除用户消息）
        for (let i = messageBlocks.length - 1; i >= 0; i--) {
          const block = messageBlocks[i]
          const text = block.textContent || block.innerText
          // 检查是否是 AI 回复（通常包含较多文字）
          if (text && text.length > 10) {
            return text.trim()
          }
        }
      }

      // 降级：直接获取容器文本
      return (container.textContent || container.innerText || '').trim()
    }

    /**
     * 发送内容更新到 Background
     */
    sendUpdate(content, isComplete = false) {
      chrome.runtime.sendMessage({
        type: 'AIA_INJECT_RESPONSE',
        siteId: this.siteId,
        content: content,
        isComplete: isComplete,
        timestamp: Date.now(),
      })
    }

    /**
     * 检测回复是否完成
     */
    checkCompletion(container) {
      // 常见的完成指示器
      const completionIndicators = [
        '[class*="regenerate"]',
        '[class*="copy"]',
        '[class*="retry"]',
        '[class*="complete"]',
        'button[aria-label*="重新"]',
        'button[aria-label*="复制"]',
      ]

      for (const selector of completionIndicators) {
        if (container.querySelector(selector)) {
          return true
        }
      }

      return false
    }

    /**
     * 开始监听
     */
    async start() {
      try {
        const container = await this.findContainer()
        this.isWatching = true
        console.log('[AI Aggregator Response Watcher] 开始监听回复')

        // 方式1: MutationObserver
        this.observer = new MutationObserver(() => {
          this.onContainerChange(container)
        })

        this.observer.observe(container, {
          childList: true,
          subtree: true,
          characterData: true,
        })

        // 方式2: 轮询兜底
        this.pollingTimer = setInterval(() => {
          this.onContainerChange(container)
        }, 500)
      } catch (error) {
        chrome.runtime.sendMessage({
          type: 'AIA_INJECT_ERROR',
          siteId: this.siteId,
          error: 'RESPONSE_CONTAINER_NOT_FOUND',
          message: '未找到回复区域',
        })
      }
    }

    /**
     * 容器变化处理
     */
    onContainerChange(container) {
      const content = this.extractContent(container)

      if (content && content !== this.lastContent) {
        this.lastContent = content

        // 检查是否完成
        const isComplete = this.checkCompletion(container)

        this.sendUpdate(content, isComplete)

        if (isComplete) {
          this.stop()
        }
      }
    }

    /**
     * 停止监听
     */
    stop() {
      this.isWatching = false

      if (this.observer) {
        this.observer.disconnect()
        this.observer = null
      }

      if (this.pollingTimer) {
        clearInterval(this.pollingTimer)
        this.pollingTimer = null
      }

      console.log('[AI Aggregator Response Watcher] 停止监听')
    }
  }

  let currentWatcher = null

  // 监听来自 Background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AIA_START_WATCHING') {
      if (currentWatcher) {
        currentWatcher.stop()
      }
      currentWatcher = new ResponseWatcher(message.config)
      currentWatcher.start()
      sendResponse({ success: true })
      return true
    }

    if (message.type === 'AIA_STOP_WATCHING') {
      if (currentWatcher) {
        currentWatcher.stop()
        currentWatcher = null
      }
      sendResponse({ success: true })
      return true
    }

    return false
  })
})()
