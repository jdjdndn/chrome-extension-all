/**
 * EventBus 集成模块
 * 为现有脚本添加 EventBus 支持，而不修改原有代码
 */

(function () {
  'use strict'

  console.log('[EventBus集成] 开始集成...')

  // 等待 EventBus 就绪
  function waitForEventBus(callback) {
    const maxWait = 10000
    const checkInterval = 100
    let attempts = 0

    const interval = setInterval(() => {
      attempts++
      if (window.EventBus && EventBus.getState && EventBus.getState().isReady) {
        clearInterval(interval)
        console.log('[EventBus集成] EventBus 已就绪')
        callback()
      } else if (attempts * checkInterval >= maxWait) {
        clearInterval(interval)
        console.warn('[EventBus集成] 等待 EventBus 超时')
      }
    }, checkInterval)
  }

  // 注册所有消息处理器
  function registerHandlers() {
    console.log('[EventBus集成] 注册消息处理器...')

    // 已经存在的 MessagingUtils 处理器会被保留
    // 这里添加 EventBus 的额外支持

    // 如果有现有的消息处理逻辑，可以通过 EventBus 也能访问到
    if (window.MessagingUtils) {
      console.log('[EventBus集成] MessagingUtils 已存在，保持兼容')
    }

    // 注册 EventBus 处理器
    EventBus.on('GET_DEFAULT_HIDE_SELECTORS', () => {
      if (typeof DEFAULT_HIDE_SELECTORS !== 'undefined') {
        console.log('[EventBus集成] 返回默认选择器:', DEFAULT_HIDE_SELECTORS.length, '个')
        return { success: true, selectors: DEFAULT_HIDE_SELECTORS }
      }
      return { success: true, selectors: [] }
    })

    EventBus.on('GET_CURRENT_HIDE_SELECTORS', () => {
      if (typeof currentSelectors !== 'undefined') {
        return { success: true, selectors: currentSelectors }
      }
      return { success: true, selectors: [] }
    })

    EventBus.on('UPDATE_KEYWORDS', (data) => {
      // 如果有现有的 UPDATE_KEYWORDS 处理逻辑，这里可以调用它
      console.log('[EventBus集成] 收到 UPDATE_KEYWORDS')
      // 返回成功表示消息已处理
      return { success: true }
    })

    EventBus.on('UPDATE_HIDE_ELEMENTS', (data) => {
      console.log('[EventBus集成] 收到 UPDATE_HIDE_ELEMENTS')
      return { success: true }
    })

    EventBus.on('TOGGLE_EXTENSION', (data) => {
      console.log('[EventBus集成] 收到 TOGGLE_EXTENSION:', data.enabled)
      return { success: true }
    })

    // 订阅系统事件
    EventBus.subscribe('PING', () => {
      console.log('[EventBus集成] Pong')
    })

    console.log('[EventBus集成] 处理器注册完成')
  }

  // 标记组件就绪
  function markReady() {
    if (window.EventBus && EventBus.publish) {
      EventBus.publish('COMPONENT_READY', {
        component: 'douyin_script',
        version: '1.0.0',
        timestamp: Date.now(),
      })
      console.log('[EventBus集成] 已发布 COMPONENT_READY 事件')
    }
  }

  // 初始化
  waitForEventBus(() => {
    registerHandlers()
    markReady()
  })
})()
