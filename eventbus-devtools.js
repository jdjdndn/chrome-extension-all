/**
 * EventBus DevTools Panel
 * 用于在 DevTools 中监控 EventBus 活动
 */

(function () {
  'use strict'

  // 状态
  const state = {
    messages: [],
    recordings: [],
    isRecording: false,
    connectionStatus: 'disconnected',
  }

  // DOM 元素缓存
  const elements = {}

  // 初始化
  function init() {
    cacheElements()
    bindEvents()
    connectToBackground()
    updateStats()
  }

  // 缓存 DOM 元素
  function cacheElements() {
    elements.connectionStatus = document.getElementById('connectionStatus')
    elements.statSent = document.getElementById('statSent')
    elements.statReceived = document.getElementById('statReceived')
    elements.statFailed = document.getElementById('statFailed')
    elements.statLatency = document.getElementById('statLatency')
    elements.statSubscriptions = document.getElementById('statSubscriptions')
    elements.statUptime = document.getElementById('statUptime')
    elements.messageItems = document.getElementById('messageItems')
    elements.messageCount = document.getElementById('messageCount')
    elements.messageDetail = document.getElementById('messageDetail')
    elements.messageSearch = document.getElementById('messageSearch')
    elements.recordingItems = document.getElementById('recordingItems')
    elements.recordingCount = document.getElementById('recordingCount')
    elements.healthStatus = document.getElementById('healthStatus')
    elements.issuesList = document.getElementById('issuesList')
    elements.throughputChart = document.getElementById('throughputChart')
    elements.latencyChart = document.getElementById('latencyChart')

    // 录制按钮
    elements.startRecording = document.getElementById('startRecording')
    elements.stopRecording = document.getElementById('stopRecording')
    elements.replayRecording = document.getElementById('replayRecording')
    elements.exportRecording = document.getElementById('exportRecording')
    elements.clearRecording = document.getElementById('clearRecording')
  }

  // 绑定事件
  function bindEvents() {
    // 标签页切换
    document.querySelectorAll('.tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'))
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'))
        tab.classList.add('active')
        const contentId = tab.dataset.tab
        document.getElementById(contentId).classList.add('active')
      })
    })

    // 消息搜索
    if (elements.messageSearch) {
      elements.messageSearch.addEventListener('input', filterMessages)
    }

    // 清空消息
    document.getElementById('clearMessages')?.addEventListener('click', () => {
      state.messages = []
      renderMessages()
    })

    // 导出消息
    document.getElementById('exportMessages')?.addEventListener('click', exportMessages)

    // 录制控制
    elements.startRecording?.addEventListener('click', startRecording)
    elements.stopRecording?.addEventListener('click', stopRecording)
    elements.replayRecording?.addEventListener('click', replayRecording)
    elements.exportRecording?.addEventListener('click', exportRecording)
    elements.clearRecording?.addEventListener('click', clearRecording)
  }

  // 连接到 background
  function connectToBackground() {
    try {
      const port = chrome.runtime.connect({ name: 'devtools-panel' })

      port.onMessage.addListener(handleMessage)

      port.onDisconnect.addListener(() => {
        updateConnectionStatus('disconnected')
        disableContentScriptMonitoring()
        setTimeout(connectToBackground, 2000)
      })

      // 注册当前 tab
      const tabId = chrome.devtools.inspectedWindow.tabId
      port.postMessage({
        type: 'REGISTER_DEVTOOLS',
        tabId: tabId,
      })

      updateConnectionStatus('connected')
    } catch (error) {
      updateConnectionStatus('disconnected')
      console.error('[DevTools] 连接失败:', error)
    }
  }

  // 启用 content script 的监控
  async function enableContentScriptMonitoring(tabId) {
    // 先尝试直接发送消息
    try {
      await chrome.tabs.sendMessage(tabId, { type: 'ENABLE_EVENTBUS_MONITOR' })
      console.log('[DevTools] EventBus 监控已启用 (via message)')
    } catch (err) {
      // 如果消息发送失败，尝试注入脚本
      console.warn('[DevTools] 消息发送失败，尝试注入:', err.message)
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => {
            if (window.EventBus && EventBus.enableDevToolsMonitor) {
              EventBus.enableDevToolsMonitor()
              console.log('[DevTools] EventBus 监控已启用 (via script)')
            } else {
              console.warn('[DevTools] EventBus 不可用')
            }
          },
        })
      } catch (scriptErr) {
        console.warn('[DevTools] 启用监控失败:', scriptErr)
      }
    }
  }

  // 禁用 content script 的监控
  function disableContentScriptMonitoring() {
    const tabId = chrome.devtools.inspectedWindow.tabId
    chrome.scripting
      .executeScript({
        target: { tabId: tabId },
        func: () => {
          if (window.EventBus && EventBus.disableDevToolsMonitor) {
            EventBus.disableDevToolsMonitor()
          }
        },
      })
      .catch(() => {})
  }

  // 处理来自 background 的消息
  function handleMessage(message) {
    if (message.type === 'PICKER_MESSAGE_PUSH') {
      addMessage(message.data)
    } else if (message.type === 'EVENTBUS_STATS') {
      updateStatsFromData(message.data)
    }
  }

  // 添加消息
  function addMessage(data) {
    const msg = {
      ...data,
      id: Date.now() + Math.random(),
      timestamp: Date.now(),
    }

    state.messages.unshift(msg)

    // 限制消息数量
    if (state.messages.length > 500) {
      state.messages = state.messages.slice(0, 500)
    }

    // 如果正在录制，添加到录制列表
    if (state.isRecording) {
      state.recordings.push(msg)
      renderRecordings()
    }

    renderMessages()
    updateStats()
  }

  // 渲染消息列表
  function renderMessages() {
    if (!elements.messageItems) {return}

    const searchTerm = elements.messageSearch?.value?.toLowerCase() || ''
    const filtered = searchTerm
      ? state.messages.filter((m) => m.type?.toLowerCase().includes(searchTerm))
      : state.messages

    if (filtered.length === 0) {
      elements.messageItems.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📨</div>
          <div>暂无消息</div>
        </div>
      `
      return
    }

    elements.messageItems.innerHTML = filtered
      .slice(0, 100)
      .map(
        (msg) => `
      <div class="message-item" data-id="${msg.id}">
        <div class="message-icon ${msg.type || 'request'}">${(msg.type || 'REQ')[0]}</div>
        <div class="message-content">
          <div class="message-type">${msg.type || 'Unknown'}</div>
          <div class="message-meta">${formatTime(msg.timestamp)}</div>
        </div>
      </div>
    `
      )
      .join('')

    elements.messageCount.textContent = `${filtered.length} 条`

    // 绑定点击事件
    elements.messageItems.querySelectorAll('.message-item').forEach((item) => {
      item.addEventListener('click', () => showMessageDetail(item.dataset.id))
    })
  }

  // 显示消息详情
  function showMessageDetail(id) {
    const msg = state.messages.find((m) => m.id == id)
    if (!msg || !elements.messageDetail) {return}

    elements.messageDetail.style.display = 'block'
    elements.messageDetail.textContent = JSON.stringify(msg, null, 2)

    // 高亮选中项
    elements.messageItems.querySelectorAll('.message-item').forEach((item) => {
      item.classList.toggle('selected', item.dataset.id === id)
    })
  }

  // 过滤消息
  function filterMessages() {
    renderMessages()
  }

  // 更新连接状态
  function updateConnectionStatus(status) {
    state.connectionStatus = status
    if (!elements.connectionStatus) {return}

    const statusMap = {
      connected: { class: 'connected', text: '已连接' },
      disconnected: { class: 'disconnected', text: '已断开' },
      connecting: { class: 'recording', text: '连接中...' },
    }

    const config = statusMap[status] || statusMap.disconnected
    elements.connectionStatus.className = `status-badge ${config.class}`
    elements.connectionStatus.innerHTML = `<span class="recording-dot"></span>${config.text}`

    // 连接成功后启用监控
    if (status === 'connected') {
      const tabId = chrome.devtools.inspectedWindow.tabId
      enableContentScriptMonitoring(tabId)
    } else if (status === 'disconnected') {
      disableContentScriptMonitoring()
    }
  }

  // 更新统计数据
  function updateStats() {
    const sent = state.messages.filter((m) => m.direction === 'send').length
    const received = state.messages.filter((m) => m.direction === 'receive').length
    const failed = state.messages.filter((m) => m.error).length

    if (elements.statSent) {elements.statSent.textContent = sent}
    if (elements.statReceived) {elements.statReceived.textContent = received}
    if (elements.statFailed) {elements.statFailed.textContent = failed}
    if (elements.statSubscriptions) {elements.statSubscriptions.textContent = '0'}
    if (elements.statUptime) {elements.statUptime.textContent = formatUptime(Date.now())}
  }

  // 从数据更新统计
  function updateStatsFromData(data) {
    if (data.sent !== undefined && elements.statSent) {
      elements.statSent.textContent = data.sent
    }
    if (data.received !== undefined && elements.statReceived) {
      elements.statReceived.textContent = data.received
    }
    if (data.failed !== undefined && elements.statFailed) {
      elements.statFailed.textContent = data.failed
    }
    if (data.avgLatency !== undefined && elements.statLatency) {
      elements.statLatency.textContent = `${data.avgLatency}ms`
    }
    if (data.subscriptions !== undefined && elements.statSubscriptions) {
      elements.statSubscriptions.textContent = data.subscriptions
    }
  }

  // 开始录制
  function startRecording() {
    state.isRecording = true
    state.recordings = []

    elements.startRecording.disabled = true
    elements.stopRecording.disabled = false
    elements.replayRecording.disabled = true
    elements.exportRecording.disabled = true

    renderRecordings()
  }

  // 停止录制
  function stopRecording() {
    state.isRecording = false

    elements.startRecording.disabled = false
    elements.stopRecording.disabled = true
    elements.replayRecording.disabled = state.recordings.length === 0
    elements.exportRecording.disabled = state.recordings.length === 0
  }

  // 回放录制
  async function replayRecording() {
    if (state.recordings.length === 0) {return}

    for (const msg of state.recordings) {
      try {
        await chrome.runtime.sendMessage(msg)
        await new Promise((r) => setTimeout(r, 100))
      } catch (e) {
        console.error('[DevTools] 回放失败:', e)
      }
    }
  }

  // 导出录制
  function exportRecording() {
    const data = JSON.stringify(state.recordings, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `eventbus-recording-${Date.now()}.json`
    a.click()

    URL.revokeObjectURL(url)
  }

  // 清空录制
  function clearRecording() {
    state.recordings = []
    renderRecordings()

    elements.replayRecording.disabled = true
    elements.exportRecording.disabled = true
  }

  // 渲染录制列表
  function renderRecordings() {
    if (!elements.recordingItems) {return}

    if (state.recordings.length === 0) {
      elements.recordingItems.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⏺️</div>
          <div>${state.isRecording ? '等待消息...' : '点击"开始录制"开始记录消息'}</div>
        </div>
      `
    } else {
      elements.recordingItems.innerHTML = state.recordings
        .map(
          (msg, i) => `
        <div class="message-item">
          <div class="message-icon ${msg.type || 'request'}">${i + 1}</div>
          <div class="message-content">
            <div class="message-type">${msg.type || 'Unknown'}</div>
            <div class="message-meta">${formatTime(msg.timestamp)}</div>
          </div>
        </div>
      `
        )
        .join('')
    }

    elements.recordingCount.textContent = `${state.recordings.length} 条`
  }

  // 导出消息
  function exportMessages() {
    const data = JSON.stringify(state.messages, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    const a = document.createElement('a')
    a.href = url
    a.download = `eventbus-messages-${Date.now()}.json`
    a.click()

    URL.revokeObjectURL(url)
  }

  // 格式化时间
  function formatTime(timestamp) {
    if (!timestamp) {return ''}
    const d = new Date(timestamp)
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}.${(d.getMilliseconds() / 1000).toFixed(3).slice(2)}`
  }

  // 格式化运行时间
  function formatUptime(startTime) {
    const seconds = Math.floor((Date.now() - startTime) / 1000)
    if (seconds < 60) {return `${seconds}s`}
    if (seconds < 3600) {return `${Math.floor(seconds / 60)}m`}
    return `${Math.floor(seconds / 3600)}h`
  }

  // 启动
  document.addEventListener('DOMContentLoaded', init)
})()
