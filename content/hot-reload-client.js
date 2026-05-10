/**
 * Content Script热重载客户端
 * 通过WebSocket连接热重载服务器，接收重载通知
 * 仅在开发模式下使用
 *
 * 注意：此文件只会被 vite 构建系统在开发模式下添加到 manifest.json
 * 生产构建不会包含此文件
 */

;(function () {
  'use strict'

  // 环境检测：检查是否在开发环境
  const isDev = (() => {
    // 检查是否有开发标记（由构建系统注入）
    if (typeof __HOT_RELOAD__ !== 'undefined' && __HOT_RELOAD__) {
      return true
    }
    return false
  })()

  if (!isDev) {
    return
  }

  const HOT_RELOAD_URL = 'ws://localhost:8765'
  const HTTP_URL = 'http://localhost:8765'

  let ws = null
  let reconnectTimeout = null
  let hasConnected = false
  let serverAvailable = false
  let checkCount = 0
  const MAX_CHECKS = 3 // 最多检测3次服务器是否可用

  /**
   * 检查热重载服务器是否可用
   * 通过 HTTP 端点预检测，避免无效的 WebSocket 连接尝试
   */
  async function checkServerAvailable() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 2000)

      const response = await fetch(`${HTTP_URL}/check-build`, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.ok) {
        serverAvailable = true
        return true
      }
      return false
    } catch (err) {
      // 服务器未启动或网络错误，静默失败
      return false
    }
  }

  /**
   * 连接 WebSocket（仅在服务器可用时）
   */
  function connect() {
    if (!serverAvailable) {
      return
    }

    try {
      ws = new WebSocket(HOT_RELOAD_URL)

      ws.onopen = () => {
        console.log(`[HotReload] 已连接到开发服务器`)
        hasConnected = true
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'reload') {
            console.log('[HotReload] 检测到文件变更，正在刷新...')
            location.reload()
          }
        } catch (err) {
          // 忽略解析错误
        }
      }

      ws.onclose = () => {
        if (hasConnected) {
          // 连接过一次后断开，尝试重连
          hasConnected = false
          scheduleReconnect()
        }
      }

      ws.onerror = () => {
        // 静默处理错误，只在服务器可用时才会触发
        if (ws) {
          ws.close()
        }
      }
    } catch (err) {
      // 静默处理异常
    }
  }

  /**
   * 重连逻辑（仅在曾经连接成功时才重连）
   */
  function scheduleReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }

    if (!hasConnected) {
      return
    }

    reconnectTimeout = setTimeout(() => {
      checkServerAvailable().then((available) => {
        if (available) {
          connect()
        }
      })
    }, 1000)
  }

  /**
   * 初始化：延迟检测服务器，避免阻塞页面加载
   */
  async function init() {
    // 检查是否在 http/https 页面
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      return
    }

    // 延迟 500ms 后开始检测，给页面加载时间
    await new Promise((resolve) => setTimeout(resolve, 500))

    // 首次检测服务器
    const available = await checkServerAvailable()

    if (available) {
      connect()
      return
    }

    // 服务器未启动，延迟重试（最多3次）
    checkCount++
    if (checkCount < MAX_CHECKS) {
      setTimeout(() => init(), 3000)
    } else {
      // 3次检测后仍不可用，静默放弃
      // 用户可以通过刷新页面重新触发检测
    }
  }

  // 启动初始化
  init()
})()
