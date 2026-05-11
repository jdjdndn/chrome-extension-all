/**
 * Hot Reload DevTools Panel
 * 连接热重载服务器，显示构建状态和历史
 */

(function () {
  'use strict'

  const HOT_RELOAD_URL = 'ws://localhost:8765'
  const HTTP_URL = 'http://localhost:8765'

  // 状态
  let ws = null
  let isConnected = false
  const buildHistory = []
  let lastBuildTime = null
  let lastBuildDuration = null

  // DOM 元素
  const statusEl = document.getElementById('status')
  const statusDot = statusEl.querySelector('.status-dot')
  const statusText = statusEl.querySelector('.status-text')
  const lastBuildEl = document.getElementById('last-build')
  const buildDurationEl = document.getElementById('build-duration')
  const historyListEl = document.getElementById('history-list')
  const btnForceReload = document.getElementById('btn-force-reload')
  const btnClearCache = document.getElementById('btn-clear-cache')
  const btnReconnect = document.getElementById('btn-reconnect')

  /**
   * 更新连接状态 UI
   */
  function updateStatus(connected) {
    isConnected = connected
    statusDot.className = 'status-dot ' + (connected ? 'connected' : 'disconnected')
    statusText.textContent = connected ? '已连接' : '未连接'
    btnForceReload.disabled = !connected
  }

  /**
   * 格式化时间
   */
  function formatTime(timestamp) {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  /**
   * 格式化相对时间
   */
  function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp
    if (diff < 60000) {
      return `${Math.floor(diff / 1000)}秒前`
    }
    if (diff < 3600000) {
      return `${Math.floor(diff / 60000)}分钟前`
    }
    return formatTime(timestamp)
  }

  /**
   * 添加构建历史记录
   */
  function addHistoryItem(item) {
    buildHistory.unshift(item)
    // 最多保留 20 条记录
    if (buildHistory.length > 20) {
      buildHistory.pop()
    }
    renderHistory()
  }

  /**
   * 渲染构建历史
   */
  function renderHistory() {
    if (buildHistory.length === 0) {
      historyListEl.innerHTML = '<div class="empty-state">暂无构建记录</div>'
      return
    }

    historyListEl.innerHTML = buildHistory
      .map(
        (item) => `
      <div class="history-item ${item.success ? 'success' : 'error'}">
        <span class="icon">${item.success ? '✅' : '❌'}</span>
        <span class="time">${formatTime(item.timestamp)}</span>
        <span class="message">${item.message}</span>
        ${item.duration ? `<span class="duration">${item.duration}ms</span>` : ''}
      </div>
    `
      )
      .join('')
  }

  /**
   * 更新构建信息
   */
  function updateBuildInfo(data) {
    lastBuildTime = data.timestamp
    lastBuildDuration = data.duration || null

    lastBuildEl.textContent = formatRelativeTime(data.timestamp)
    buildDurationEl.textContent = data.duration ? `${data.duration}ms` : '-'

    // 每分钟更新相对时间
    setTimeout(() => {
      if (lastBuildTime) {
        lastBuildEl.textContent = formatRelativeTime(lastBuildTime)
      }
    }, 60000)
  }

  /**
   * 连接 WebSocket
   */
  function connect() {
    if (ws) {
      ws.close()
    }

    statusDot.className = 'status-dot connecting'
    statusText.textContent = '连接中...'

    try {
      ws = new WebSocket(HOT_RELOAD_URL)

      ws.onopen = () => {
        console.log('[HotReload Panel] 已连接')
        updateStatus(true)
        addHistoryItem({
          timestamp: Date.now(),
          success: true,
          message: '已连接到开发服务器',
        })
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          handleServerMessage(data)
        } catch (err) {
          console.error('[HotReload Panel] 解析消息失败:', err)
        }
      }

      ws.onclose = () => {
        console.log('[HotReload Panel] 连接关闭')
        updateStatus(false)
        addHistoryItem({
          timestamp: Date.now(),
          success: false,
          message: '与开发服务器断开连接',
        })
      }

      ws.onerror = (err) => {
        console.error('[HotReload Panel] 连接错误:', err)
        updateStatus(false)
      }
    } catch (err) {
      console.error('[HotReload Panel] 创建连接失败:', err)
      updateStatus(false)
    }
  }

  /**
   * 处理服务器消息
   */
  function handleServerMessage(data) {
    switch (data.type) {
      case 'reload':
        updateBuildInfo(data)
        addHistoryItem({
          timestamp: data.timestamp,
          success: true,
          message: '构建完成，页面已刷新',
          duration: data.duration,
        })
        break

      case 'manifest-changed':
        addHistoryItem({
          timestamp: data.timestamp,
          success: true,
          message: 'Manifest 变化，扩展重载中...',
        })
        break

      case 'build-start':
        statusText.textContent = '构建中...'
        break

      default:
        break
    }
  }

  /**
   * 强制重载扩展
   */
  function forceReload() {
    chrome.runtime.reload()
  }

  /**
   * 清除构建缓存
   */
  async function clearCache() {
    try {
      const response = await fetch(`${HTTP_URL}/check-build`, {
        method: 'GET',
      })

      if (response.ok) {
        addHistoryItem({
          timestamp: Date.now(),
          success: true,
          message: '缓存已清除',
        })
      }
    } catch (err) {
      addHistoryItem({
        timestamp: Date.now(),
        success: false,
        message: '清除缓存失败: ' + err.message,
      })
    }
  }

  // 事件绑定
  btnForceReload.addEventListener('click', forceReload)
  btnClearCache.addEventListener('click', clearCache)
  btnReconnect.addEventListener('click', connect)

  // 初始化连接
  connect()

  // 定期更新相对时间
  setInterval(() => {
    if (lastBuildTime) {
      lastBuildEl.textContent = formatRelativeTime(lastBuildTime)
    }
  }, 30000)
})()
