/**
 * Content Script Bridge
 * 可靠的 popup-content 通信桥梁
 * 基于 EventBus 实现
 */

;(function () {
  'use strict'

  if (window.ContentBridge) return

  const READY_TIMEOUT = 5000 // 5秒超时
  const PING_INTERVAL = 30000 // 30秒心跳

  // 状态管理
  const state = {
    isReady: false,
    initTime: Date.now(),
    messageCount: 0,
  }

  // 待处理的消息队列
  const pendingMessages = new Map()

  /**
   * 检查 EventBus 是否就绪
   */
  function isEventBusReady() {
    return typeof EventBus !== 'undefined' && EventBus.getState && EventBus.getState().isReady
  }

  /**
   * 标记 content script 已就绪
   */
  async function markReady() {
    state.isReady = true
    console.log('[ContentBridge] Content script 已就绪')

    // 通知 background（优先使用 EventBus）
    if (isEventBusReady()) {
      try {
        await EventBus.publish('__eb_content_ready__', {
          url: window.location.href,
          timestamp: Date.now(),
        })
      } catch (e) {
        console.warn('[ContentBridge] EventBus 发布失败:', e.message)
      }
    }

    // 同时使用原生方式通知（兼容性）
    chrome.runtime
      .sendMessage({
        type: 'CONTENT_SCRIPT_READY',
        url: window.location.href,
        timestamp: Date.now(),
      })
      .catch(() => {})
  }

  /**
   * 处理消息（EventBus 和原生消息）
   */
  async function handleMessage(message, sender, sendResponse) {
    state.messageCount++
    console.log(`[ContentBridge] 收到消息 #${state.messageCount}:`, message.type)

    // 响应就绪检查
    if (message.type === 'PING' || message.type === '__eb_ping__') {
      const response = {
        type: 'PONG',
        ready: state.isReady,
        uptime: Date.now() - state.initTime,
        messageCount: state.messageCount,
      }
      if (sendResponse) sendResponse(response)
      return response
    }

    // 响应就绪状态查询
    if (message.type === 'IS_READY') {
      const response = {
        ready: state.isReady,
        initTime: state.initTime,
      }
      if (sendResponse) sendResponse(response)
      return response
    }

    // 中继 widen-page 宽度更新到页面上下文
    if (message.type === 'WIDEN_PAGE_WIDTH_UPDATE') {
      window.dispatchEvent(
        new CustomEvent('yc-widen-page-update', {
          detail: { width: message.width },
        })
      )
      if (sendResponse) sendResponse({ ok: true })
      return { ok: true }
    }

    // 中继 widen-page 开关状态
    if (message.type === 'WIDEN_PAGE_TOGGLE') {
      window.dispatchEvent(
        new CustomEvent('yc-widen-page-toggle', {
          detail: { enabled: message.enabled },
        })
      )
      if (sendResponse) sendResponse({ ok: true })
      return { ok: true }
    }

    return false // 让其他处理器处理
  }

  /**
   * 初始化 EventBus 监听
   */
  function initEventBusListeners() {
    if (!isEventBusReady()) return

    // 订阅 ping 消息
    EventBus.subscribe('__eb_ping__', (data, context) => {
      return {
        type: '__eb_pong__',
        ready: state.isReady,
        uptime: Date.now() - state.initTime,
        messageCount: state.messageCount,
      }
    })
  }

  // 注册原生消息监听（兼容性）
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // 调试：记录所有收到的消息
    console.log('[ContentBridge] 收到消息:', message?.type)

    // 如果是 EventBus 消息，交给 EventBus 处理
    if (message.__eventbus__ && isEventBusReady()) {
      // EventBus 会自动处理
      return false
    }
    const handled = handleMessage(message, sender, sendResponse)
    if (!handled) {
      return false
    }
    return true
  })

  // 启动心跳
  const heartbeatInterval = setInterval(async () => {
    if (document.hidden) return // 页面隐藏时不发送心跳

    const heartbeatData = {
      type: 'CONTENT_HEARTBEAT',
      url: window.location.href,
      ready: state.isReady,
      uptime: Date.now() - state.initTime,
    }

    // 优先使用 EventBus
    if (isEventBusReady()) {
      try {
        await EventBus.publish('__eb_heartbeat__', heartbeatData)
      } catch (e) {}
    }

    // 同时使用原生方式（兼容性）
    chrome.runtime.sendMessage(heartbeatData).catch(() => {
      // Background 可能未就绪，忽略错误
    })
  }, PING_INTERVAL)

  // 页面卸载时清理
  window.addEventListener('beforeunload', () => {
    clearInterval(heartbeatInterval)
  })

  // 等待 EventBus 就绪后初始化监听
  const checkEventBusReady = setInterval(() => {
    if (isEventBusReady()) {
      clearInterval(checkEventBusReady)
      initEventBusListeners()
      console.log('[ContentBridge] EventBus 监听已初始化')
    }
  }, 500)

  // 5秒后停止检查
  setTimeout(() => clearInterval(checkEventBusReady), 5000)

  // 导出接口
  window.ContentBridge = {
    markReady,
    isReady: () => state.isReady,
    getState: () => ({ ...state }),
    sendMessage: async (type, data) => {
      if (isEventBusReady()) {
        return await EventBus.request(type, data)
      }
      return await chrome.runtime.sendMessage({ type, ...data })
    },
  }

  console.log('[ContentBridge] 通信桥梁已加载 (EventBus 增强版)')
})()
