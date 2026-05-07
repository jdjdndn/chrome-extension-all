/**
 * Content Script热重载客户端
 * 通过WebSocket连接热重载服务器，接收重载通知
 * 仅在开发模式下使用
 */

(function() {
  const HOT_RELOAD_URL = 'ws://localhost:8765'
  const RECONNECT_DELAY = 1000
  const MAX_RECONNECT_DELAY = 30000

  let ws = null
  let reconnectAttempts = 0
  let reconnectTimeout = null

  function connect() {
    try {
      ws = new WebSocket(HOT_RELOAD_URL)

      ws.onopen = () => {
        console.log(`[HotReload] WebSocket已连接: ${HOT_RELOAD_URL}`)
        reconnectAttempts = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'reload') {
            console.log('[HotReload] 收到重载通知，刷新页面...')
            location.reload()
          }
        } catch (err) {
          // 忽略解析错误
        }
      }

      ws.onclose = () => {
        console.log('[HotReload] WebSocket已断开')
        scheduleReconnect()
      }

      ws.onerror = (err) => {
        console.log('[HotReload] WebSocket连接错误')
        ws.close()
      }
    } catch (err) {
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }

    // 指数退避重连
    const delay = Math.min(
      RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    )
    reconnectAttempts++

    reconnectTimeout = setTimeout(() => {
      connect()
    }, delay)
  }

  // 检查是否在http/https页面（排除chrome://等特殊页面）
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    connect()
  }
})()
