/**
 * EventBus DevTools 面板脚本
 *
 * 与后台脚本通信，显示实时监控数据
 */

(function () {
  'use strict';

  // ========== 状态管理 ==========
  const state = {
    connected: false,
    currentTab: 'dashboard',
    messages: [],
    recording: null,
    stats: {
      sent: 0,
      received: 0,
      failed: 0,
      latency: 0,
      subscriptions: 0,
      uptime: 0
    },
    performance: [],
    health: null,
    charts: {
      throughput: [],
      latency: [],
      memory: []
    }
  };

  // ========== 端口连接 ==========
  let port = null;

  function connect() {
    try {
      port = chrome.runtime.connect({
        name: 'eventbus-monitor'
      });

      port.onMessage.addListener(handleMessage);
      port.onDisconnect.addListener(handleDisconnect);

      updateConnectionStatus('connected');
      requestState();
    } catch (error) {
      console.error('连接失败:', error);
      updateConnectionStatus('disconnected');
      // 重试连接
      setTimeout(connect, 3000);
    }
  }

  function handleDisconnect() {
    updateConnectionStatus('disconnected');
    port = null;
    // 重试连接
    setTimeout(connect, 3000);
  }

  function handleMessage(message) {
    const { type, data } = message;

    switch (type) {
      case 'state':
        updateState(data);
        break;
      case 'notification':
        handleNotification(data);
        break;
      case 'chart':
        updateChart(data.type, data.data);
        break;
      case 'recordingStopped':
        updateRecording(data);
        break;
      case 'recording':
        updateRecordingData(data);
        break;
      case 'memoryReport':
        updateMemoryReport(data);
        break;
    }
  }

  function send(type, data) {
    if (port && state.connected) {
      try {
        port.postMessage({ type, data });
      } catch (error) {
        console.error('发送失败:', error);
      }
    }
  }

  // ========== UI 更新 ==========

  function updateConnectionStatus(status) {
    state.connected = status === 'connected';
    const badge = document.getElementById('connectionStatus');

    if (status === 'connected') {
      badge.className = 'status-badge connected';
      badge.innerHTML = '● 已连接';
    } else if (status === 'disconnected') {
      badge.className = 'status-badge disconnected';
      badge.innerHTML = '○ 未连接';
    } else {
      badge.className = 'status-badge';
      badge.innerHTML = '● 连接中...';
    }
  }

  function updateState(data) {
    if (data.config) {
      // 配置更新
    }
    if (data.stats) {
      state.stats = {
        sent: data.stats.sent || 0,
        received: data.stats.received || 0,
        failed: data.stats.failed || 0,
        latency: data.stats.avgLatency || 0,
        subscriptions: data.subscriptions || 0,
        uptime: data.uptime || 0
      };
      updateStats();
    }
    if (data.isRecording !== undefined) {
      updateRecordingStatus(data.isRecording);
    }
  }

  function updateStats() {
    document.getElementById('statSent').textContent = formatNumber(state.stats.sent);
    document.getElementById('statReceived').textContent = formatNumber(state.stats.received);
    document.getElementById('statFailed').textContent = formatNumber(state.stats.failed);
    document.getElementById('statLatency').textContent = formatLatency(state.stats.latency);
    document.getElementById('statSubscriptions').textContent = formatNumber(state.stats.subscriptions);
    document.getElementById('statUptime').textContent = formatUptime(state.stats.uptime);
  }

  function handleNotification(data) {
    const { category, event } = data;

    switch (category) {
      case 'message':
        addMessage(data);
        break;
      case 'error':
        showError(data);
        break;
      case 'subscription':
        handleSubscriptionEvent(event);
        break;
      case 'plugin':
        handlePluginEvent(event);
        break;
      case 'recorder':
        handleRecorderEvent(event);
        break;
      case 'memory':
        updateMemorySample(data.sample);
        break;
    }
  }

  function addMessage(data) {
    const message = {
      id: data.id || generateId(),
      type: data.type || data.message?.type,
      timestamp: data.timestamp || Date.now(),
      from: data.from,
      latency: data.latency,
      error: data.error,
      data: data.data || data.message?.data
    };

    state.messages.unshift(message);

    // 限制消息数量
    if (state.messages.length > 1000) {
      state.messages.pop();
    }

    if (state.currentTab === 'messages') {
      renderMessages();
    }
  }

  function renderMessages() {
    const container = document.getElementById('messageItems');
    const filtered = filterMessages();

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📨</div>
          <div>暂无消息</div>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(msg => `
      <div class="message-item" data-id="${msg.id}">
        <div class="message-icon ${getMessageIconClass(msg)}">
          ${getMessageIcon(msg)}
        </div>
        <div class="message-content">
          <div class="message-type">${escapeHtml(msg.type)}</div>
          <div class="message-meta">
            ${formatTime(msg.timestamp)}
            ${msg.latency ? ` · ${formatLatency(msg.latency)}` : ''}
            ${msg.from ? ` · 来自 ${msg.from}` : ''}
          </div>
        </div>
      </div>
    `).join('');

    document.getElementById('messageCount').textContent = `${filtered.length} 条`;

    // 添加点击事件
    container.querySelectorAll('.message-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        showMessageDetail(id);
      });
    });
  }

  function showMessageDetail(id) {
    const message = state.messages.find(m => m.id === id);
    if (!message) return;

    const detail = document.getElementById('messageDetail');
    detail.style.display = 'block';
    detail.textContent = JSON.stringify(message, null, 2);

    // 高亮选中项
    document.querySelectorAll('.message-item').forEach(item => {
      item.classList.toggle('selected', item.dataset.id === id);
    });
  }

  function filterMessages() {
    const search = document.getElementById('messageSearch')?.value?.toLowerCase() || '';
    return state.messages.filter(msg => {
      if (!search) return true;
      return msg.type?.toLowerCase().includes(search);
    });
  }

  function getMessageIcon(msg) {
    if (msg.error) return '✕';
    if (msg.type?.includes('request') || msg.type?.includes('REQUEST')) return '→';
    if (msg.type?.includes('response') || msg.type?.includes('RESPONSE')) return '←';
    return '●';
  }

  function getMessageIconClass(msg) {
    if (msg.error) return 'error';
    if (msg.type?.includes('request') || msg.type?.includes('REQUEST')) return 'request';
    return 'publish';
  }

  function updateChart(type, data) {
    switch (type) {
      case 'messages':
        state.charts.throughput = data;
        renderThroughputChart();
        break;
      case 'latency':
        state.charts.latency = data.latencies || [];
        renderLatencyChart();
        break;
      case 'memory':
        state.charts.memory = data.samples || [];
        renderMemoryChart();
        break;
    }
  }

  function renderThroughputChart() {
    const container = document.getElementById('throughputChart');
    if (!container) return;

    const { sent, received, failed } = state.charts.throughput;
    const max = Math.max(sent, received, failed, 1);

    container.innerHTML = `
      <div style="display: flex; gap: 20px; height: 100%; align-items: flex-end;">
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
          <div style="text-align: center; margin-bottom: 4px; font-size: 10px;">已发送</div>
          <div style="height: ${(sent / max) * 100}%; background: #4ec9b0; border-radius: 4px 4px 0 0; min-height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px;">${sent}</div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
          <div style="text-align: center; margin-bottom: 4px; font-size: 10px;">已接收</div>
          <div style="height: ${(received / max) * 100}%; background: #007acc; border-radius: 4px 4px 0 0; min-height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px;">${received}</div>
        </div>
        <div style="flex: 1; display: flex; flex-direction: column; justify-content: flex-end;">
          <div style="text-align: center; margin-bottom: 4px; font-size: 10px;">失败</div>
          <div style="height: ${(failed / max) * 100}%; background: #f48771; border-radius: 4px 4px 0 0; min-height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px;">${failed}</div>
        </div>
      </div>
    `;
  }

  function renderLatencyChart() {
    const container = document.getElementById('latencyChart');
    if (!container || !state.charts.latency.length) return;

    const latencies = state.charts.latency.slice(-50);
    const max = Math.max(...latencies.map(l => l.y), 1);

    container.innerHTML = latencies.map((point, i) => {
      const height = (point.y / max) * 100;
      const left = (i / latencies.length) * 100;
      return `<div class="chart-bar" style="height: ${height}%; left: ${left}%; width: ${100 / latencies.length}%;" title="${point.y.toFixed(2)}ms"></div>`;
    }).join('');
  }

  function renderMemoryChart() {
    const container = document.getElementById('memoryChart');
    if (!container || !state.charts.memory.length) return;

    const samples = state.charts.memory.slice(-50);
    const max = Math.max(...samples.map(s => s.y || s.usedJSHeapSize || 0), 1);

    container.innerHTML = samples.map((sample, i) => {
      const value = sample.y || sample.usedJSHeapSize || 0;
      const height = (value / max) * 100;
      const left = (i / samples.length) * 100;
      const mb = (value / 1024 / 1024).toFixed(1);
      return `<div class="chart-bar" style="height: ${height}%; left: ${left}%; width: ${100 / samples.length}%;" title="${mb} MB"></div>`;
    }).join('');
  }

  function updateRecording(data) {
    state.recording = data;
    renderRecording();
  }

  function updateRecordingData(data) {
    if (data && data.messages) {
      state.recording = data;
      renderRecording();
    }
  }

  function renderRecording() {
    const container = document.getElementById('recordingItems');
    const messages = state.recording?.messages || [];

    if (messages.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⏺️</div>
          <div>点击"开始录制"开始记录消息</div>
        </div>
      `;
    } else {
      container.innerHTML = messages.map((msg, i) => `
        <div class="message-item">
          <div class="message-icon publish">${i + 1}</div>
          <div class="message-content">
            <div class="message-type">${escapeHtml(msg.type || msg.requestType)}</div>
            <div class="message-meta">
              ${msg.__offset ? `偏移: ${msg.__offset}ms` : formatTime(msg.timestamp)}
            </div>
          </div>
        </div>
      `).join('');
    }

    document.getElementById('recordingCount').textContent = `${messages.length} 条`;

    // 更新按钮状态
    document.getElementById('replayRecording').disabled = messages.length === 0;
    document.getElementById('exportRecording').disabled = messages.length === 0;
  }

  function updateRecordingStatus(isRecording) {
    const startBtn = document.getElementById('startRecording');
    const stopBtn = document.getElementById('stopRecording');

    startBtn.disabled = isRecording;
    stopBtn.disabled = !isRecording;
  }

  function updateMemorySample(sample) {
    if (sample) {
      state.charts.memory.push({
        x: sample.timestamp,
        y: sample.usedJSHeapSize
      });

      // 限制样本数量
      if (state.charts.memory.length > 100) {
        state.charts.memory.shift();
      }

      if (state.currentTab === 'performance') {
        renderMemoryChart();
      }
    }
  }

  function updateMemoryReport(report) {
    const container = document.getElementById('performanceItems');

    if (!report || report.error) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div>暂无性能数据</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="padding: 12px;">
        <div style="margin-bottom: 12px;">
          <div style="font-size: 10px; color: #858585; margin-bottom: 4px;">内存使用</div>
          <div style="font-size: 18px; font-weight: 600; color: #4ec9b0;">
            ${(report.memory?.current / 1024 / 1024).toFixed(2)} MB
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 11px;">
          <div>
            <span style="color: #858585;">峰值:</span>
            ${(report.memory?.peak / 1024 / 1024).toFixed(2)} MB
          </div>
          <div>
            <span style="color: #858585;">平均:</span>
            ${(report.memory?.average / 1024 / 1024).toFixed(2)} MB
          </div>
          <div>
            <span style="color: #858585;">趋势:</span>
            <span style="color: ${report.memory?.trend > 0 ? '#f48771' : '#4ec9b0'};">
              ${report.memory?.trend > 0 ? '+' : ''}${(report.memory?.trend / 1024).toFixed(2)} KB
            </span>
          </div>
          <div>
            <span style="color: #858585;">样本数:</span>
            ${report.samples}
          </div>
        </div>
      </div>
    `;
  }

  function updateHealthAnalysis(health) {
    state.health = health;
    renderHealth();
  }

  function renderHealth() {
    const container = document.getElementById('healthStatus');
    const issuesList = document.getElementById('issuesList');

    const health = state.health || { overall: 'healthy', issues: [] };

    // 更新状态图标
    const icon = container.querySelector('.health-icon');
    const title = container.querySelector('.health-title');
    const description = container.querySelector('.health-description');

    icon.className = `health-icon ${health.overall}`;
    icon.textContent = health.overall === 'healthy' ? '✓' :
                      health.overall === 'degraded' ? '⚠' : '✕';

    title.textContent = health.overall === 'healthy' ? '系统健康' :
                       health.overall === 'degraded' ? '性能降级' : '系统异常';

    description.textContent = health.overall === 'healthy' ? '所有系统正常运行' :
                            health.overall === 'degraded' ? '检测到性能问题' : '检测到严重问题';

    // 更新问题列表
    if (health.issues && health.issues.length > 0) {
      issuesList.innerHTML = health.issues.map(issue => `
        <div class="issue-item ${issue.severity}">
          <div class="issue-header">
            <span class="issue-severity ${issue.severity}">${issue.severity === 'high' ? '高' : issue.severity === 'medium' ? '中' : '低'}</span>
          </div>
          <div class="issue-message">${escapeHtml(issue.message)}</div>
          <div class="issue-suggestion">${escapeHtml(issue.suggestion)}</div>
        </div>
      `).join('');
    } else {
      issuesList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">✓</div>
          <div>未发现问题</div>
        </div>
      `;
    }
  }

  // ========== 事件处理 ==========

  function requestState() {
    send('getState');
  }

  function handleSubscriptionEvent(event) {
    // 更新订阅数
    if (event === 'added') {
      state.stats.subscriptions++;
    } else if (event === 'removed') {
      state.stats.subscriptions = Math.max(0, state.stats.subscriptions - 1);
    } else if (event === 'cleared') {
      state.stats.subscriptions = 0;
    }
    updateStats();
  }

  function handlePluginEvent(event) {
    console.log('插件事件:', event);
  }

  function handleRecorderEvent(event) {
    if (event === 'start') {
      updateRecordingStatus(true);
    } else if (event === 'stop') {
      updateRecordingStatus(false);
    }
  }

  function showError(data) {
    console.error('EventBus 错误:', data.error);
    if (data.diagnosis) {
      console.error('诊断:', data.diagnosis);
    }
  }

  // ========== 标签页切换 ==========

  function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.dataset.tab;

        tabs.forEach(t => t.classList.remove('active'));
        contents.forEach(c => c.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(tabName).classList.add('active');

        state.currentTab = tabName;

        // 刷新当前标签页数据
        if (tabName === 'messages') {
          renderMessages();
        } else if (tabName === 'performance') {
          send('getMemoryReport');
        } else if (tabName === 'health') {
          send('getHealthAnalysis');
        } else if (tabName === 'dashboard') {
          send('getChart', 'messages');
        }
      });
    });
  }

  // ========== 按钮事件 ==========

  function setupButtons() {
    // 录制控制
    document.getElementById('startRecording').addEventListener('click', () => {
      send('startRecording', { timestamp: Date.now() });
    });

    document.getElementById('stopRecording').addEventListener('click', () => {
      send('stopRecording');
    });

    document.getElementById('replayRecording').addEventListener('click', () => {
      if (state.recording && state.recording.messages) {
        send('replay', { messages: state.recording.messages });
      }
    });

    document.getElementById('exportRecording').addEventListener('click', () => {
      if (state.recording) {
        const data = JSON.stringify(state.recording, null, 2);
        downloadFile('eventbus-recording.json', data);
      }
    });

    document.getElementById('clearRecording').addEventListener('click', () => {
      send('clearRecording');
      state.recording = null;
      renderRecording();
    });

    // 消息控制
    document.getElementById('clearMessages').addEventListener('click', () => {
      state.messages = [];
      renderMessages();
    });

    document.getElementById('exportMessages').addEventListener('click', () => {
      const data = JSON.stringify(state.messages, null, 2);
      downloadFile('eventbus-messages.json', data);
    });

    // 搜索
    const searchInput = document.getElementById('messageSearch');
    if (searchInput) {
      searchInput.addEventListener('input', debounce(() => {
        renderMessages();
      }, 300));
    }
  }

  // ========== 工具函数 ==========

  function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }

  function formatLatency(ms) {
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    if (ms >= 1) return ms.toFixed(2) + 'ms';
    return (ms * 1000).toFixed(2) + 'μs';
  }

  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds >= 3600) return Math.floor(seconds / 3600) + 'h';
    if (seconds >= 60) return Math.floor(seconds / 60) + 'm';
    return seconds + 's';
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function generateId() {
    return 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  function debounce(fn, delay) {
    let timeout;
    return function (...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ========== 定时更新 ==========

  function startAutoUpdate() {
    // 每秒更新统计数据
    setInterval(() => {
      if (state.connected && state.currentTab === 'dashboard') {
        requestState();
        send('getChart', 'messages');
      }
    }, 1000);

    // 每5秒更新性能数据
    setInterval(() => {
      if (state.connected && state.currentTab === 'performance') {
        send('getMemoryReport');
      }
    }, 5000);

    // 每10秒更新健康状态
    setInterval(() => {
      if (state.connected && state.currentTab === 'health') {
        send('getHealthAnalysis');
      }
    }, 10000);
  }

  // ========== 初始化 ==========

  function init() {
    setupTabs();
    setupButtons();
    connect();
    startAutoUpdate();

    console.log('[EventBus DevTools] 面板已初始化');
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
