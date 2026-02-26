// 控制面板逻辑
'use strict';

const outputEl = document.getElementById('console-output');
const notificationEl = document.getElementById('change-notification');
const notificationTextEl = document.getElementById('notification-text');

// 字符串截断限制（字符数）
const TRUNCATE_LIMIT = 200;
// 对象JSON显示行数限制
const LINE_LIMIT = 8;

// 唯一ID计数器
let itemIdCounter = 0;

// 存储数据结构
let storageSections = {
  'storage-local': { title: '本地存储', icon: '💾', type: 'local', data: null },
  'storage-sync': { title: '同步存储', icon: '🔄', type: 'sync', data: null },
  'storage-session': { title: '会话存储', icon: '⚡', type: 'session', data: null }
};

// 通用复制函数（兼容DevTools环境）
function copyToClipboard(text) {
  return new Promise((resolve, reject) => {
    // 优先使用Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        resolve(true);
      }).catch(() => {
        // Clipboard API失败，使用fallback
        fallbackCopy(text, resolve, reject);
      });
    } else {
      // 不支持Clipboard API，直接使用fallback
      fallbackCopy(text, resolve, reject);
    }
  });
}

// Fallback复制方法
function fallbackCopy(text, resolve, reject) {
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (success) {
      resolve(true);
    } else {
      reject(new Error('复制失败'));
    }
  } catch (e) {
    reject(e);
  }
}

// 标签页切换
document.querySelectorAll('.sidebar-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();

    // 更新标签页激活状态
    document.querySelectorAll('.sidebar-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // 更新内容可见性
    const tabId = tab.dataset.tab;
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    const targetContent = document.getElementById(`tab-${tabId}`);
    if (targetContent) {
      targetContent.classList.add('active');

      // Auto-load data when tab becomes active
      if (tabId === 'bookmarks') {
        loadBookmarks();
      }
      if (tabId === 'history') {
        loadHistory();
      }
    }
  });
});

// ========== Info 子标签页切换 ==========
document.querySelectorAll('.info-sub-tab').forEach(tab => {
  tab.addEventListener('click', (e) => {
    e.preventDefault();

    // 更新子标签页激活状态
    document.querySelectorAll('.info-sub-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // 更新内容可见性
    const subtabId = tab.dataset.subtab;
    document.querySelectorAll('.info-sub-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`info-${subtabId}`).classList.add('active');

    // 如果切换到内存标签页，加载内存数据
    if (subtabId === 'memory') {
      loadMemoryInfo();
    }
  });
});

// ========== 内存信息功能 ==========
const memoryOutput = document.getElementById('memory-output');
const refreshMemoryBtn = document.getElementById('refresh-memory-btn');

// 格式化字节大小
function formatMemoryBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

// 获取内存状态样式类
function getMemoryStatusClass(percentage) {
  if (percentage < 50) return 'good';
  if (percentage < 80) return 'warning';
  return 'danger';
}

// 加载内存信息
async function loadMemoryInfo() {
  if (!memoryOutput) return;

  memoryOutput.innerHTML = '<div class="memory-loading">正在获取内存数据...</div>';

  try {
    // 发送消息到background获取页面性能信息
    const response = await chrome.runtime.sendMessage({ type: 'GET_MEMORY_INFO' });

    if (response && response.success && response.data) {
      renderMemoryInfoFromBackground(response.data);
    } else {
      // 如果background不支持，使用performance API直接获取
      renderMemoryInfoFromPerformance();
    }
  } catch (e) {
    console.log('[Info] 无法从background获取内存信息，使用本地performance API:', e);
    // 回退到直接使用performance API
    renderMemoryInfoFromPerformance();
  }
}

// 从performance API渲染内存信息
function renderMemoryInfoFromPerformance() {
  const memoryInfo = {};

  // 尝试获取JS堆内存信息
  if (performance.memory) {
    memoryInfo.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
    memoryInfo.totalJSHeapSize = performance.memory.totalJSHeapSize;
    memoryInfo.usedJSHeapSize = performance.memory.usedJSHeapSize;
  }

  // 获取性能指标
  if (performance.timing) {
    const timing = performance.timing;
    memoryInfo.loadTime = timing.loadEventEnd - timing.navigationStart;
    memoryInfo.domReady = timing.domContentLoadedEventEnd - timing.navigationStart;
  }

  // 获取导航信息
  if (performance.getEntriesByType) {
    const navigation = performance.getEntriesByType('navigation')[0];
    if (navigation) {
      memoryInfo.domContentLoaded = navigation.domContentLoadedEventEnd;
      memoryInfo.loadComplete = navigation.loadEventEnd;
      memoryInfo.domInteractive = navigation.domInteractive;
      memoryInfo.transferSize = navigation.transferSize;
      memoryInfo.encodedBodySize = navigation.encodedBodySize;
      memoryInfo.decodedBodySize = navigation.decodedBodySize;
    }

    // 获取资源数量
    const resources = performance.getEntriesByType('resource');
    memoryInfo.resourceCount = resources.length;
    memoryInfo.resourceSize = resources.reduce((sum, r) => sum + (r.transferSize || 0), 0);
  }

  renderMemoryInfo(memoryInfo);
}

// 渲染从background获取的内存信息
function renderMemoryInfoFromBackground(data) {
  const memoryInfo = {};

  // JS堆内存
  if (data.jsHeapSizeLimit) {
    memoryInfo.jsHeapSizeLimit = data.jsHeapSizeLimit;
    memoryInfo.totalJSHeapSize = data.totalJSHeapSize;
    memoryInfo.usedJSHeapSize = data.usedJSHeapSize;
  }

  // 性能指标
  if (data.domContentLoaded !== undefined) {
    memoryInfo.domContentLoaded = data.domContentLoaded;
  }
  if (data.loadComplete !== undefined) {
    memoryInfo.loadComplete = data.loadComplete;
  }
  if (data.domInteractive !== undefined) {
    memoryInfo.domInteractive = data.domInteractive;
  }

  // 资源信息
  if (data.resourceCount !== undefined) {
    memoryInfo.resourceCount = data.resourceCount;
  }
  if (data.resourceSize !== undefined) {
    memoryInfo.resourceSize = data.resourceSize;
  }
  if (data.transferSize !== undefined) {
    memoryInfo.transferSize = data.transferSize;
  }
  if (data.decodedBodySize !== undefined) {
    memoryInfo.decodedBodySize = data.decodedBodySize;
  }

  renderMemoryInfo(memoryInfo);
}

// 渲染内存信息
function renderMemoryInfo(data) {
  if (!memoryOutput) return;

  let html = '';

  // JS堆内存部分
  if (data.jsHeapSizeLimit || data.totalJSHeapSize || data.usedJSHeapSize) {
    const usedJSHeap = data.usedJSHeapSize || 0;
    const totalJSHeap = data.totalJSHeapSize || 0;
    const heapLimit = data.jsHeapSizeLimit || 0;
    const usedPercent = heapLimit > 0 ? (usedJSHeap / heapLimit * 100) : 0;
    const statusClass = getMemoryStatusClass(usedPercent);

    html += `
      <div class="memory-section">
        <div class="memory-section-header">
          <span class="memory-section-icon">▼</span>
          <span class="memory-section-title">JavaScript 堆内存</span>
        </div>
        <div class="memory-section-content">
          <div class="memory-stat">
            <span class="memory-stat-label">已使用堆内存</span>
            <span class="memory-stat-value ${statusClass}">${formatMemoryBytes(usedJSHeap)}</span>
          </div>
          <div class="memory-stat">
            <span class="memory-stat-label">总堆内存</span>
            <span class="memory-stat-value">${formatMemoryBytes(totalJSHeap)}</span>
          </div>
          <div class="memory-stat">
            <span class="memory-stat-label">堆内存限制</span>
            <span class="memory-stat-value">${formatMemoryBytes(heapLimit)}</span>
          </div>
          <div class="memory-stat" style="flex-direction: column; align-items: stretch;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
              <span class="memory-stat-label">内存使用率</span>
              <span class="memory-stat-value ${statusClass}">${usedPercent.toFixed(1)}%</span>
            </div>
            <div class="memory-bar">
              <div class="memory-bar-fill ${statusClass}" style="width: ${Math.min(usedPercent, 100)}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // 页面加载性能
  if (data.loadTime !== undefined || data.domReady !== undefined || data.loadComplete !== undefined) {
    html += `
      <div class="memory-section">
        <div class="memory-section-header">
          <span class="memory-section-icon">▼</span>
          <span class="memory-section-title">页面加载性能</span>
        </div>
        <div class="memory-section-content">
          ${data.domInteractive !== undefined ? `
            <div class="memory-stat">
              <span class="memory-stat-label">DOM 可交互时间</span>
              <span class="memory-stat-value">${data.domInteractive.toFixed(0)} ms</span>
            </div>
          ` : ''}
          ${data.domContentLoaded !== undefined ? `
            <div class="memory-stat">
              <span class="memory-stat-label">DOM 内容加载完成</span>
              <span class="memory-stat-value">${data.domContentLoaded.toFixed(0)} ms</span>
            </div>
          ` : ''}
          ${data.loadComplete !== undefined ? `
            <div class="memory-stat">
              <span class="memory-stat-label">页面完全加载</span>
              <span class="memory-stat-value">${data.loadComplete.toFixed(0)} ms</span>
            </div>
          ` : ''}
          ${data.loadTime !== undefined && data.loadTime > 0 ? `
            <div class="memory-stat">
              <span class="memory-stat-label">总加载时间</span>
              <span class="memory-stat-value">${data.loadTime} ms</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 资源信息
  if (data.resourceCount !== undefined || data.resourceSize !== undefined) {
    html += `
      <div class="memory-section">
        <div class="memory-section-header">
          <span class="memory-section-icon">▼</span>
          <span class="memory-section-title">页面资源</span>
        </div>
        <div class="memory-section-content">
          ${data.resourceCount !== undefined ? `
            <div class="memory-stat">
              <span class="memory-stat-label">资源请求数量</span>
              <span class="memory-stat-value">${data.resourceCount}</span>
            </div>
          ` : ''}
          ${data.resourceSize !== undefined ? `
            <div class="memory-stat">
              <span class="memory-stat-label">资源总大小</span>
              <span class="memory-stat-value">${formatMemoryBytes(data.resourceSize)}</span>
            </div>
          ` : ''}
          ${data.transferSize !== undefined ? `
            <div class="memory-stat">
              <span class="memory-stat-label">传输大小</span>
              <span class="memory-stat-value">${formatMemoryBytes(data.transferSize)}</span>
            </div>
          ` : ''}
          ${data.decodedBodySize !== undefined ? `
            <div class="memory-stat">
              <span class="memory-stat-label">解压后大小</span>
              <span class="memory-stat-value">${formatMemoryBytes(data.decodedBodySize)}</span>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // 如果没有任何数据
  if (!html) {
    html = `
      <div class="memory-section">
        <div class="memory-section-content">
          <div class="memory-stat">
            <span class="memory-stat-label">无法获取内存信息</span>
            <span class="memory-stat-value">当前浏览器不支持或需要刷新页面</span>
          </div>
        </div>
      </div>
    `;
  }

  memoryOutput.innerHTML = html;

  // 添加折叠功能
  memoryOutput.querySelectorAll('.memory-section-header').forEach(header => {
    header.addEventListener('click', () => {
      const section = header.parentElement;
      const content = section.querySelector('.memory-section-content');
      const icon = header.querySelector('.memory-section-icon');

      if (content.style.display === 'none') {
        content.style.display = 'block';
        icon.textContent = '▼';
      } else {
        content.style.display = 'none';
        icon.textContent = '▶';
      }
    });
  });
}

// 刷新内存按钮点击事件
if (refreshMemoryBtn) {
  refreshMemoryBtn.addEventListener('click', () => {
    loadMemoryInfo();
  });
}

// ========== 内存清理功能 ==========
let autoCleanupTimer = null;

// 清理资源
async function cleanupResources(type) {
  const cleanupSection = document.querySelector('.memory-cleanup-section');
  let resultEl = cleanupSection.querySelector('.cleanup-result');
  if (!resultEl) {
    resultEl = document.createElement('div');
    resultEl.className = 'cleanup-result';
    cleanupSection.appendChild(resultEl);
  }

  try {
    let message = '';
    let success = true;

    switch (type) {
      case 'cache':
        // 清理Service Worker缓存
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          message = `已清理 ${cacheNames.length} 个缓存`;
        } else {
          message = '浏览器不支持Cache API';
        }
        break;

      case 'localStorage':
        // 清理本地存储
        const localKeys = Object.keys(localStorage);
        localStorage.clear();
        message = `已清理 ${localKeys.length} 个本地存储项`;
        break;

      case 'sessionStorage':
        // 清理会话存储
        const sessionKeys = Object.keys(sessionStorage);
        sessionStorage.clear();
        message = `已清理 ${sessionKeys.length} 个会话存储项`;
        break;

      case 'indexedDB':
        // 清理IndexedDB
        const dbs = await indexedDB.databases();
        for (const db of dbs) {
          if (db.name) {
            await new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase(db.name);
              request.onsuccess = resolve;
              request.onerror = reject;
            });
          }
        }
        message = `已清理 ${dbs.length} 个IndexedDB数据库`;
        break;

      case 'cookies':
        // 通过background清理cookies
        try {
          const response = await chrome.runtime.sendMessage({ type: 'CLEANUP_COOKIES' });
          if (response && response.success) {
            message = `已清理 ${response.count || 0} 个Cookies`;
          } else {
            message = 'Cookies清理完成';
          }
        } catch (e) {
          message = 'Cookies清理需要后台支持';
        }
        break;

      case 'all':
        // 清理所有资源
        let totalCleaned = 0;

        // 缓存
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
          totalCleaned += cacheNames.length;
        }

        // 本地存储
        totalCleaned += Object.keys(localStorage).length;
        localStorage.clear();

        // 会话存储
        totalCleaned += Object.keys(sessionStorage).length;
        sessionStorage.clear();

        // IndexedDB
        const allDbs = await indexedDB.databases();
        for (const db of allDbs) {
          if (db.name) {
            await new Promise((resolve) => {
              const request = indexedDB.deleteDatabase(db.name);
              request.onsuccess = request.onerror = resolve;
            });
          }
        }
        totalCleaned += allDbs.length;

        message = `已清理全部资源 (${totalCleaned} 项)`;
        break;

      default:
        message = '未知的清理类型';
        success = false;
    }

    resultEl.className = `cleanup-result ${success ? 'success' : 'error'}`;
    resultEl.textContent = message;

    // 3秒后移除提示
    setTimeout(() => {
      if (resultEl.parentNode) {
        resultEl.remove();
      }
    }, 3000);

    // 刷新内存信息
    if (success) {
      setTimeout(() => loadMemoryInfo(), 500);
    }

  } catch (e) {
    resultEl.className = 'cleanup-result error';
    resultEl.textContent = `清理失败: ${e.message}`;
    setTimeout(() => {
      if (resultEl.parentNode) {
        resultEl.remove();
      }
    }, 3000);
  }
}

// 设置自动清理
function setupAutoCleanup() {
  const autoCleanupEnabled = document.getElementById('auto-cleanup-enabled');
  const autoCleanupInterval = document.getElementById('auto-cleanup-interval');

  if (!autoCleanupEnabled || !autoCleanupInterval) return;

  // 加载保存的设置
  chrome.storage.local.get(['autoCleanupEnabled', 'autoCleanupInterval'], (result) => {
    if (result.autoCleanupEnabled !== undefined) {
      autoCleanupEnabled.checked = result.autoCleanupEnabled;
    }
    if (result.autoCleanupInterval !== undefined) {
      autoCleanupInterval.value = result.autoCleanupInterval;
    }

    // 如果已启用，启动定时器
    if (autoCleanupEnabled.checked) {
      startAutoCleanup(parseInt(autoCleanupInterval.value));
    }
  });

  // 切换自动清理
  autoCleanupEnabled.addEventListener('change', () => {
    const enabled = autoCleanupEnabled.checked;
    chrome.storage.local.set({ autoCleanupEnabled: enabled });

    if (enabled) {
      startAutoCleanup(parseInt(autoCleanupInterval.value));
    } else {
      stopAutoCleanup();
    }
  });

  // 修改清理间隔
  autoCleanupInterval.addEventListener('change', () => {
    const interval = parseInt(autoCleanupInterval.value);
    chrome.storage.local.set({ autoCleanupInterval: interval });

    if (autoCleanupEnabled.checked) {
      stopAutoCleanup();
      startAutoCleanup(interval);
    }
  });
}

// 启动自动清理
function startAutoCleanup(interval) {
  stopAutoCleanup();
  autoCleanupTimer = setInterval(() => {
    // 自动清理缓存和会话存储
    cleanupResources('cache');
    cleanupResources('sessionStorage');
  }, interval);

  // 格式化时间间隔显示
  let intervalText = '';
  if (interval >= 31536000000) {
    intervalText = `${interval / 31536000000}年`;
  } else if (interval >= 2592000000) {
    intervalText = `${interval / 2592000000}个月`;
  } else if (interval >= 604800000) {
    intervalText = `${interval / 604800000}周`;
  } else if (interval >= 86400000) {
    intervalText = `${interval / 86400000}天`;
  } else {
    intervalText = `${interval / 1000}秒`;
  }
  console.log(`[Memory] 自动清理已启动，间隔: ${intervalText}`);
}

// 停止自动清理
function stopAutoCleanup() {
  if (autoCleanupTimer) {
    clearInterval(autoCleanupTimer);
    autoCleanupTimer = null;
    console.log('[Memory] 自动清理已停止');
  }
}

// 绑定清理按钮事件
document.querySelectorAll('.cleanup-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const cleanupType = btn.dataset.cleanup;
    cleanupResources(cleanupType);
  });
});

// 初始化自动清理设置
setupAutoCleanup();

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 获取值类型样式类名
function getValueTypeClass(value) {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'object' && value !== null) return 'object';
  return '';
}

// 计算字符串行数
function countLines(str) {
  return str.split('\n').length;
}

// 生成唯一ID
function generateId() {
  return `item-${++itemIdCounter}`;
}

// ========== 代码编辑器风格 JSON 渲染器 ==========
let editorCounter = 0;

// 简单的JSON语法高亮
function highlightJson(jsonStr) {
  return jsonStr
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
      let cls = 'json-string';
      if (/:$/.test(match)) {
        cls = 'json-key';
        match = '<span class="' + cls + '">' + match.slice(0, -1) + '</span>:';
      } else {
        match = '<span class="' + cls + '">' + match + '</span>';
      }
      return match;
    })
    .replace(/\b(true|false)\b/g, '<span class="json-boolean">$1</span>')
    .replace(/\b(null)\b/g, '<span class="json-null">$1</span>')
    .replace(/\b(-?\d+\.?\d*([eE][+-]?\d+)?)\b/g, '<span class="json-number">$1</span>');
}

// 渲染带行号和折叠功能的代码编辑器风格JSON
function renderCodeEditor(jsonStr, maxLines = 10, editable = false) {
  if (!jsonStr) return '<div class="code-editor-empty">(无数据)</div>';

  let parsed;
  let formatted;
  try {
    parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    formatted = JSON.stringify(parsed, null, 2);
  } catch (e) {
    formatted = typeof jsonStr === 'string' ? jsonStr : String(jsonStr);
  }

  const lines = formatted.split('\n');
  const lineCount = lines.length;
  const editorId = `code-editor-${++editorCounter}`;

  // Build line numbers and content
  function buildLines(startLine, endLine) {
    let html = '';
    for (let i = startLine; i < endLine && i < lineCount; i++) {
      const lineNum = i + 1;
      const lineContent = escapeHtml(lines[i]);
      html += `<div class="code-line">
        <span class="line-number">${lineNum}</span>
        <span class="line-content">${lineContent}</span>
      </div>`;
    }
    return html;
  }

  // If small enough, no collapse needed
  if (lineCount <= maxLines) {
    return `
      <div class="code-editor" id="${editorId}">
        <div class="code-header">
          <span class="code-title">JSON</span>
          <span class="code-lines">${lineCount} 行</span>
          <button class="code-copy-btn" onclick="copyCodeEditor('${editorId}')">复制</button>
        </div>
        <div class="code-body">
          ${buildLines(0, lineCount)}
        </div>
      </div>
    `;
  }

  // Need collapse - show preview with expand
  const previewLines = buildLines(0, maxLines);
  const fullLines = buildLines(0, lineCount);
  const remainingLines = lineCount - maxLines;

  return `
    <div class="code-editor collapsible" id="${editorId}">
      <div class="code-header">
        <span class="code-title">JSON</span>
        <span class="code-lines">${lineCount} 行</span>
        <button class="code-copy-btn" onclick="copyCodeEditor('${editorId}')">复制</button>
      </div>
      <div class="code-body-preview">
        ${previewLines}
        <div class="code-collapse-overlay">
          <span class="collapse-info">▼ ${remainingLines} 行已折叠</span>
          <button class="code-expand-btn" onclick="toggleCodeEditor('${editorId}', false)">
            <span class="icon">⤵</span> 展开全部
          </button>
        </div>
      </div>
      <div class="code-body-full" style="display: none;">
        <div class="code-collapse-header">
          <button class="code-collapse-btn" onclick="toggleCodeEditor('${editorId}', true)">
            <span class="icon">⤴</span> 折叠
          </button>
        </div>
        ${fullLines}
      </div>
    </div>
  `;
}

// 切换代码编辑器折叠状态
window.toggleCodeEditor = function (id, collapse) {
  const container = document.getElementById(id);
  if (!container) return;

  const preview = container.querySelector('.code-body-preview');
  const full = container.querySelector('.code-body-full');

  if (collapse) {
    preview.style.display = 'block';
    full.style.display = 'none';
  } else {
    preview.style.display = 'none';
    full.style.display = 'block';
  }
};

// 复制代码编辑器内容
window.copyCodeEditor = function (id) {
  const container = document.getElementById(id);
  if (!container) return;

  // 获取所有行内容
  const lines = container.querySelectorAll('.line-content');
  const text = Array.from(lines).map(l => l.textContent).join('\n');

  copyToClipboard(text).then(() => {
    // 显示反馈
    const btn = container.querySelector('.code-copy-btn');
    if (btn) {
      const originalText = btn.textContent;
      btn.textContent = '已复制!';
      setTimeout(() => btn.textContent = originalText, 1500);
    }
  }).catch(() => {
    showNotification('复制失败');
  });
};

// ========== Chrome DevTools 风格 JSON 预览渲染器 ==========
let previewCounter = 0;

// 获取折叠值的预览文本
function getPreviewText(value, maxLength = 50) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'boolean') return String(value);
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (value.length <= maxLength) return `"${value}"`;
    return `"${value.substring(0, maxLength)}…"`;
  }
  if (Array.isArray(value)) {
    return `Array(${value.length})`;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';
    return `{${keys.length}}`;
  }
  return String(value);
}

// 将JSON值渲染为Chrome DevTools预览树
function renderJsonPreviewValue(value, depth = 0, key = null) {
  const indent = depth * 12;
  const previewId = `json-preview-${++previewCounter}`;

  // 自动展开阈值（最大子元素数量）
  const AUTO_EXPAND_THRESHOLD = 5;
  // 自动展开最大深度
  const AUTO_EXPAND_MAX_DEPTH = 2;

  // 判断节点是否应该默认展开
  const shouldAutoExpand = (childCount, currentDepth) => {
    return currentDepth < AUTO_EXPAND_MAX_DEPTH && childCount <= AUTO_EXPAND_THRESHOLD;
  };

  // null值
  if (value === null) {
    return `<span class="json-null">null</span>`;
  }

  // undefined值
  if (value === undefined) {
    return `<span class="json-null">undefined</span>`;
  }

  // 布尔值
  if (typeof value === 'boolean') {
    return `<span class="json-boolean">${value}</span>`;
  }

  // 数字值
  if (typeof value === 'number') {
    return `<span class="json-number">${value}</span>`;
  }

  // 字符串值
  if (typeof value === 'string') {
    const escaped = escapeHtml(value);
    if (escaped.length <= 100) {
      return `<span class="json-string">"${escaped}"</span>`;
    }
    return `<span class="json-string">"${escaped.substring(0, 100)}…"</span>`;
  }

  // 数组
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return `<span class="json-bracket">[]</span>`;
    }

    const previewText = `Array(${value.length})`;
    const items = value.map((item, index) => {
      // 检查子项是否可展开
      const isExpandable = typeof item === 'object' && item !== null;
      if (isExpandable) {
        const itemPreviewId = `json-preview-${++previewCounter}`;
        const childIndent = indent + 12;

        // 递归渲染子元素
        const childItems = Array.isArray(item)
          ? item.map((childItem, childIndex) => {
            const childHtml = renderJsonPreviewValue(childItem, depth + 2, childIndex);
            const childExpandable = typeof childItem === 'object' && childItem !== null;
            if (childExpandable) {
              return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                  <span class="json-item-label">
                    <span class="json-key">${childIndex}</span><span class="json-colon">:</span>
                  </span>
                  ${childHtml}
                </div>`;
            }
            return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                <span class="json-item-label">
                  <span class="json-key">${childIndex}</span><span class="json-colon">:</span>
                </span>
                ${childHtml}
              </div>`;
          }).join('')
          : Object.keys(item || {}).map(childKey => {
            const childHtml = renderJsonPreviewValue(item[childKey], depth + 2, childKey);
            const childExpandable = typeof item[childKey] === 'object' && item[childKey] !== null;
            if (childExpandable) {
              return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                  <span class="json-item-label">
                    <span class="json-key">"${escapeHtml(childKey)}"</span><span class="json-colon">:</span>
                  </span>
                  ${childHtml}
                </div>`;
            }
            return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                <span class="json-item-label">
                  <span class="json-key">"${escapeHtml(childKey)}"</span><span class="json-colon">:</span>
                </span>
                ${childHtml}
              </div>`;
          }).join('');

        const openBracket = Array.isArray(item) ? '[' : '{';
        const closeBracket = Array.isArray(item) ? ']' : '}';
        const childCount = Array.isArray(item) ? item.length : Object.keys(item || {}).length;
        const previewLabel = Array.isArray(item) ? `Array(${childCount})` : `{${childCount}}`;

        // 嵌套项自动展开
        const childIsExpanded = shouldAutoExpand(childCount, depth + 1);
        const childExpandedClass = childIsExpanded ? 'expanded' : 'collapsed';
        const childExpandedStyle = childIsExpanded ? 'inline' : 'none';
        const childCollapsedStyle = childIsExpanded ? 'none' : 'inline';
        const childToggleClass = childIsExpanded ? 'expanded' : '';

        return `<div class="json-tree-item" style="padding-left: ${indent + 12}px;">
          <span class="json-tree-node ${childExpandedClass}" data-preview-id="${itemPreviewId}">
            <span class="json-node-content">
              <span class="json-toggle ${childToggleClass}" title="展开/折叠"></span>
              <span class="json-key">${index}</span><span class="json-colon">:</span>
              <span class="json-key">${previewLabel}</span>
              <span class="json-collapsed-view" style="display: ${childCollapsedStyle};">{…}</span>
            </span>
            <span class="json-expanded-view" style="display: ${childExpandedStyle};">
              <span class="json-item-label">
                <span class="json-key">${index}</span><span class="json-colon">:</span>
              </span>
              <span class="json-bracket">${openBracket}</span>
              <span class="json-children">
                ${childItems}
              </span>
              <div class="json-tree-item" style="padding-left: ${childIndent + 12}px;"><span class="json-bracket">${closeBracket}</span></div>
            </span>
          </span>
        </div>`;
      }
      const itemHtml = renderJsonPreviewValue(item, depth + 1, index);
      return `<div class="json-tree-item" style="padding-left: ${indent + 12}px;">
        <span class="json-item-label">
          <span class="json-key">${index}</span><span class="json-colon">:</span>
        </span>
        ${itemHtml}
      </div>`;
    }).join('');

    // Determine if root array should be auto-expanded
    const isExpanded = shouldAutoExpand(value.length, depth);
    const expandedClass = isExpanded ? 'expanded' : 'collapsed';
    const expandedStyle = isExpanded ? 'inline' : 'none';
    const collapsedStyle = isExpanded ? 'none' : 'inline';
    const toggleExpandedClass = isExpanded ? 'expanded' : '';

    return `<span class="json-tree-node ${expandedClass}" data-preview-id="${previewId}">
      <span class="json-node-content">
        <span class="json-toggle ${toggleExpandedClass}" title="展开/折叠"></span>
        <span class="json-key">Array(${value.length})</span>
        <span class="json-collapsed-view" style="display: ${collapsedStyle};">[…]</span>
      </span>
      <span class="json-expanded-view" style="display: ${expandedStyle};">
        <span class="json-bracket">[</span>
        <span class="json-children">
          ${items}
        </span>
        <div class="json-tree-item" style="padding-left: ${indent + 12}px;"><span class="json-bracket">]</span></div>
      </span>
    </span>`;
  }

  // Object
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) {
      return `<span class="json-bracket">{}</span>`;
    }

    const items = keys.map(k => {
      // Check if value is expandable
      const isExpandable = typeof value[k] === 'object' && value[k] !== null;
      if (isExpandable) {
        const itemPreviewId = `json-preview-${++previewCounter}`;
        const childIndent = indent + 12;

        // Recursively render children
        const childItems = Array.isArray(value[k])
          ? value[k].map((childItem, childIndex) => {
            const childHtml = renderJsonPreviewValue(childItem, depth + 2, childIndex);
            const childExpandable = typeof childItem === 'object' && childItem !== null;
            if (childExpandable) {
              return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                  <span class="json-item-label">
                    <span class="json-key">${childIndex}</span><span class="json-colon">:</span>
                  </span>
                  ${childHtml}
                </div>`;
            }
            return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                <span class="json-item-label">
                  <span class="json-key">${childIndex}</span><span class="json-colon">:</span>
                </span>
                ${childHtml}
              </div>`;
          }).join('')
          : Object.keys(value[k] || {}).map(childKey => {
            const childHtml = renderJsonPreviewValue(value[k][childKey], depth + 2, childKey);
            const childExpandable = typeof value[k][childKey] === 'object' && value[k][childKey] !== null;
            if (childExpandable) {
              return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                  <span class="json-item-label">
                    <span class="json-key">"${escapeHtml(childKey)}"</span><span class="json-colon">:</span>
                  </span>
                  ${childHtml}
                </div>`;
            }
            return `<div class="json-tree-item" style="padding-left: ${childIndent + 12}px;">
                <span class="json-item-label">
                  <span class="json-key">"${escapeHtml(childKey)}"</span><span class="json-colon">:</span>
                </span>
                ${childHtml}
              </div>`;
          }).join('');

        const openBracket = Array.isArray(value[k]) ? '[' : '{';
        const closeBracket = Array.isArray(value[k]) ? ']' : '}';
        const childCount = Array.isArray(value[k]) ? value[k].length : Object.keys(value[k] || {}).length;
        const previewLabel = Array.isArray(value[k]) ? `Array(${childCount})` : `{${childCount}}`;

        // 嵌套项自动展开
        const childIsExpanded = shouldAutoExpand(childCount, depth + 1);
        const childExpandedClass = childIsExpanded ? 'expanded' : 'collapsed';
        const childExpandedStyle = childIsExpanded ? 'inline' : 'none';
        const childCollapsedStyle = childIsExpanded ? 'none' : 'inline';
        const childToggleClass = childIsExpanded ? 'expanded' : '';

        return `<div class="json-tree-item" style="padding-left: ${indent + 12}px;">
          <span class="json-tree-node ${childExpandedClass}" data-preview-id="${itemPreviewId}">
            <span class="json-node-content">
              <span class="json-toggle ${childToggleClass}" title="展开/折叠"></span>
              <span class="json-key">"${escapeHtml(k)}"</span><span class="json-colon">:</span>
              <span class="json-key">${previewLabel}</span>
              <span class="json-collapsed-view" style="display: ${childCollapsedStyle};">{…}</span>
            </span>
            <span class="json-expanded-view" style="display: ${childExpandedStyle};">
              <span class="json-item-label">
                <span class="json-key">"${escapeHtml(k)}"</span><span class="json-colon">:</span>
              </span>
              <span class="json-bracket">${openBracket}</span>
              <span class="json-children">
                ${childItems}
              </span>
              <div class="json-tree-item" style="padding-left: ${childIndent + 12}px;"><span class="json-bracket">${closeBracket}</span></div>
            </span>
          </span>
        </div>`;
      }
      const itemHtml = renderJsonPreviewValue(value[k], depth + 1, k);
      return `<div class="json-tree-item" style="padding-left: ${indent + 12}px;">
        <span class="json-item-label">
          <span class="json-key">"${escapeHtml(k)}"</span><span class="json-colon">:</span>
        </span>
        ${itemHtml}
      </div>`;
    }).join('');

    // Determine if root object should be auto-expanded
    const isExpanded = shouldAutoExpand(keys.length, depth);
    const expandedClass = isExpanded ? 'expanded' : 'collapsed';
    const expandedStyle = isExpanded ? 'inline' : 'none';
    const collapsedStyle = isExpanded ? 'none' : 'inline';
    const toggleExpandedClass = isExpanded ? 'expanded' : '';

    return `<span class="json-tree-node ${expandedClass}" data-preview-id="${previewId}">
      <span class="json-node-content">
        <span class="json-toggle ${toggleExpandedClass}" title="展开/折叠"></span>
        <span class="json-key">{${keys.length}}</span>
        <span class="json-collapsed-view" style="display: ${collapsedStyle};">{…}</span>
      </span>
      <span class="json-expanded-view" style="display: ${expandedStyle};">
        <span class="json-bracket">{</span>
        <span class="json-children">
          ${items}
        </span>
        <div class="json-tree-item" style="padding-left: ${indent + 12}px;"><span class="json-bracket">}</span></div>
      </span>
    </span>`;
  }

  return escapeHtml(String(value));
}

// 切换JSON预览节点展开/折叠
function toggleJsonPreviewNode(node) {
  if (!node) return;

  const isCollapsed = node.classList.contains('collapsed');
  const toggle = node.querySelector(':scope > .json-node-content > .json-toggle');
  const collapsedView = node.querySelector(':scope > .json-node-content > .json-collapsed-view');
  const expandedView = node.querySelector(':scope > .json-expanded-view');

  if (isCollapsed) {
    node.classList.remove('collapsed');
    node.classList.add('expanded');
    if (toggle) toggle.classList.add('expanded');
    if (collapsedView) collapsedView.style.display = 'none';
    if (expandedView) expandedView.style.display = 'inline';
  } else {
    node.classList.add('collapsed');
    node.classList.remove('expanded');
    if (toggle) toggle.classList.remove('expanded');
    if (collapsedView) collapsedView.style.display = 'inline';
    if (expandedView) expandedView.style.display = 'none';
  }
}

// Setup event delegation for JSON preview clicks
function setupJsonPreviewEvents(container) {
  container.addEventListener('click', (e) => {
    const target = e.target;

    // Toggle node - click on toggle, key, or collapsed-view
    if (target.classList.contains('json-toggle') ||
      target.classList.contains('json-key') ||
      target.classList.contains('json-collapsed-view') ||
      target.classList.contains('json-node-content')) {
      const node = target.closest('.json-tree-node');
      if (node) {
        toggleJsonPreviewNode(node);
      }
      return;
    }

    // Toolbar buttons
    if (target.classList.contains('json-preview-btn')) {
      const action = target.dataset.action;
      if (action === 'expand-all') {
        container.querySelectorAll('.json-tree-node.collapsed').forEach(node => {
          toggleJsonPreviewNode(node);
        });
      } else if (action === 'collapse-all') {
        container.querySelectorAll('.json-tree-node.expanded').forEach(node => {
          toggleJsonPreviewNode(node);
        });
      } else if (action === 'copy') {
        // 使用存储的原始JSON数据而不是显示文本
        const rawJson = container.dataset.rawJson;
        if (rawJson) {
          // 解码HTML实体
          const decodedJson = rawJson
            .replace(/&quot;/g, '"')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&#39;/g, "'");
          copyToClipboard(decodedJson).then(() => {
            showNotification('已复制到剪贴板');
          }).catch(() => {
            showNotification('复制失败');
          });
        } else {
          // 如果没有存储的原始数据，尝试获取内容
          const content = container.querySelector('.json-preview-content');
          if (content) {
            copyToClipboard(content.textContent).then(() => {
              showNotification('已复制到剪贴板');
            }).catch(() => {
              showNotification('复制失败');
            });
          }
        }
      }
    }
  });
}

// 渲染完整的JSON预览容器（Chrome DevTools风格）
function renderJsonPreview(jsonStr) {
  if (!jsonStr) return '<div class="json-preview-empty">(无数据)</div>';

  let parsed;
  let formattedStr = '';
  try {
    parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    formattedStr = JSON.stringify(parsed, null, 2);
  } catch (e) {
    return `<div class="json-preview-error">解析错误: ${escapeHtml(e.message)}</div>`;
  }

  const containerId = `json-preview-container-${++previewCounter}`;
  const content = renderJsonPreviewValue(parsed, 0);

  // 存储原始JSON字符串用于复制
  const escapedJson = escapeHtml(formattedStr).replace(/"/g, '&quot;');

  return `
    <div class="json-preview-container" id="${containerId}" data-raw-json="${escapedJson}">
      <div class="json-preview-toolbar">
        <button class="json-preview-btn" data-action="expand-all">展开全部</button>
        <button class="json-preview-btn" data-action="collapse-all">折叠全部</button>
        <button class="json-preview-btn" data-action="copy">复制</button>
      </div>
      <div class="json-preview-content">
        ${content}
      </div>
    </div>
  `;
}

// Initialize JSON preview events after content is rendered
function initJsonPreviewEvents() {
  document.querySelectorAll('.json-preview-container').forEach(container => {
    if (!container.dataset.eventsInitialized) {
      container.dataset.eventsInitialized = 'true';
      setupJsonPreviewEvents(container);
    }
  });
}

// Render editable JSON with same style as preview
function renderEditableJsonPreview(jsonStr, textareaId) {
  let formatted = '';
  if (jsonStr) {
    try {
      const parsed = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
      formatted = JSON.stringify(parsed, null, 2);
    } catch (e) {
      formatted = typeof jsonStr === 'string' ? jsonStr : String(jsonStr);
    }
  }

  const containerId = `json-edit-container-${++previewCounter}`;

  return `
    <div class="json-preview-container json-edit-container" id="${containerId}">
      <div class="json-preview-toolbar">
        <button class="json-preview-btn" data-action="format">格式化</button>
        <button class="json-preview-btn" data-action="copy">复制</button>
        <button class="json-preview-btn" data-action="toggle-view">切换视图</button>
      </div>
      <div class="json-edit-content">
        <textarea id="${textareaId}" class="json-edit-textarea" spellcheck="false">${escapeHtml(formatted)}</textarea>
      </div>
    </div>
  `;
}

// Setup events for editable JSON preview
function setupEditableJsonEvents(container, textareaId) {
  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  container.addEventListener('click', (e) => {
    const target = e.target;
    if (!target.classList.contains('json-preview-btn')) return;

    const action = target.dataset.action;
    if (action === 'format') {
      try {
        const parsed = JSON.parse(textarea.value);
        textarea.value = JSON.stringify(parsed, null, 2);
        showNotification('JSON 已格式化');
      } catch (e) {
        showNotification('JSON 格式错误: ' + e.message);
      }
    } else if (action === 'copy') {
      copyToClipboard(textarea.value).then(() => {
        showNotification('已复制到剪贴板');
      }).catch(() => {
        showNotification('复制失败');
      });
    }
  });
}

// Render collapsible textarea for mock editing
function renderEditableCodeEditor(value, textareaId, maxLines = 10) {
  if (!value) {
    return `<textarea id="${textareaId}" class="code-textarea" placeholder="输入 Mock 响应数据 (JSON)"></textarea>`;
  }

  let formatted = value;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    formatted = JSON.stringify(parsed, null, 2);
  } catch (e) { }

  const lines = formatted.split('\n');
  const lineCount = lines.length;

  if (lineCount <= maxLines) {
    return `<textarea id="${textareaId}" class="code-textarea">${escapeHtml(formatted)}</textarea>`;
  }

  // Large content - show collapsible preview + textarea
  const editorId = `editable-${textareaId}-${++editorCounter}`;
  const previewLines = lines.slice(0, maxLines);
  const previewStr = previewLines.join('\n');
  const remainingLines = lineCount - maxLines;

  return `
    <div class="editable-wrapper" id="${editorId}">
      <div class="editable-preview">
        <div class="code-editor mini">
          <div class="code-header">
            <span class="code-title">JSON 预览</span>
            <span class="code-lines">${lineCount} 行</span>
          </div>
          <pre class="code-preview-text">${escapeHtml(previewStr)}\n<span class="code-more">... 还有 ${remainingLines} 行</span></pre>
        </div>
        <button class="code-edit-btn" onclick="toggleEditableCode('${editorId}', '${textareaId}', false)">
          <span class="icon">✎</span> 编辑
        </button>
      </div>
      <div class="editable-full" style="display: none;">
        <div class="editable-full-header">
          <button class="code-done-btn" onclick="toggleEditableCode('${editorId}', '${textareaId}', true)">
            <span class="icon">✓</span> 完成
          </button>
        </div>
        <textarea id="${textareaId}" class="code-textarea">${escapeHtml(formatted)}</textarea>
      </div>
    </div>
  `;
}

// Toggle editable code view
window.toggleEditableCode = function (wrapperId, textareaId, showPreview) {
  const wrapper = document.getElementById(wrapperId);
  if (!wrapper) return;

  const preview = wrapper.querySelector('.editable-preview');
  const full = wrapper.querySelector('.editable-full');

  if (showPreview) {
    preview.style.display = 'block';
    full.style.display = 'none';
  } else {
    preview.style.display = 'none';
    full.style.display = 'block';
    // Focus textarea
    const textarea = document.getElementById(textareaId);
    if (textarea) textarea.focus();
  }
};

// Format storage value for display with collapse support
function renderStorageItem(key, value, sectionId) {
  const typeClass = getValueTypeClass(value);
  const itemId = generateId();
  const jsonStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);

  if (typeof value === 'object' && value !== null) {
    // Object/Array value - use JSON tree view
    const isArray = Array.isArray(value);
    const itemCount = isArray ? value.length : Object.keys(value).length;
    const typeLabel = isArray ? '数组' : '对象';

    return `
      <div class="storage-item">
        <div class="storage-item-header">
          <span class="storage-key">${escapeHtml(key)}</span>
          <span class="storage-type-badge">${typeLabel} · ${itemCount} 项</span>
          <div class="storage-item-actions">
            <button class="storage-copy-btn" data-value="${escapeHtml(jsonStr)}" title="复制JSON">
              <span class="icon">📋</span>
            </button>
            <button class="storage-delete-btn" data-section="${sectionId}" data-key="${escapeHtml(key)}" title="删除">
              <span class="icon">🗑️</span>
            </button>
          </div>
        </div>
        <div class="storage-value ${typeClass}">
          <div class="json-tree-view">
            ${createJsonTreeView(value)}
          </div>
        </div>
      </div>
    `;
  } else {
    // Primitive value (string, number, boolean)
    const typeLabel = typeof value === 'string' ? '字符串' :
      typeof value === 'number' ? '数字' : '布尔值';
    const charCount = String(value).length;
    const needsCollapse = charCount > TRUNCATE_LIMIT;

    if (needsCollapse) {
      const previewStr = String(value).substring(0, TRUNCATE_LIMIT);
      const remainingChars = charCount - TRUNCATE_LIMIT;

      return `
        <div class="storage-item">
          <div class="storage-item-header">
            <span class="storage-key">${escapeHtml(key)}</span>
            <span class="storage-type-badge">${typeLabel} · ${charCount} 字符</span>
            <div class="storage-item-actions">
              <button class="storage-copy-btn" data-value="${escapeHtml(String(value))}" title="复制">
                <span class="icon">📋</span>
              </button>
              <button class="storage-delete-btn" data-section="${sectionId}" data-key="${escapeHtml(key)}" title="删除">
                <span class="icon">🗑️</span>
              </button>
            </div>
          </div>
          <span class="storage-value ${typeClass}">
            <div class="value-container" id="${itemId}">
              <span class="value-preview">
                ${escapeHtml(previewStr)}<span class="truncate-indicator">... (+${remainingChars} 字符)</span>
                <button class="toggle-btn">
                  <span class="icon">▼</span>
                  <span>展开</span>
                </button>
              </span>
              <span class="value-full">
                <div class="sticky-header">
                  <span class="sticky-label">${escapeHtml(key)}</span>
                  <button class="toggle-btn expanded sticky-btn">
                    <span class="icon">▲</span>
                    <span>收起</span>
                  </button>
                </div>
                <span class="full-text">${escapeHtml(String(value))}</span>
              </span>
            </div>
          </span>
        </div>
      `;
    } else {
      return `
        <div class="storage-item">
          <div class="storage-item-header">
            <span class="storage-key">${escapeHtml(key)}</span>
            <span class="storage-type-badge">${typeLabel} · ${charCount} 字符</span>
            <div class="storage-item-actions">
              <button class="storage-copy-btn" data-value="${escapeHtml(String(value))}" title="复制">
                <span class="icon">📋</span>
              </button>
              <button class="storage-delete-btn" data-section="${sectionId}" data-key="${escapeHtml(key)}" title="删除">
                <span class="icon">🗑️</span>
              </button>
            </div>
          </div>
          <span class="storage-value ${typeClass}">${escapeHtml(String(value))}</span>
        </div>
      `;
    }
  }
}

// Toggle expand/collapse using event delegation
outputEl.addEventListener('click', (e) => {
  // Handle JSON tree toggle clicks directly
  if (e.target.classList.contains('json-tree-toggle')) {
    const treeItem = e.target.closest('.json-tree-item');
    if (treeItem) {
      treeItem.classList.toggle('collapsed');
      const isCollapsed = treeItem.classList.contains('collapsed');
      e.target.textContent = isCollapsed ? '▶' : '▼';
      const children = treeItem.querySelector('.json-tree-children');
      if (children) children.style.display = isCollapsed ? 'none' : 'block';
    }
    return;
  }

  // Handle toggle buttons
  const btn = e.target.closest('.toggle-btn');
  if (btn) {
    const container = btn.closest('.value-container, .object-value-wrapper, .json-tree-item');
    if (!container) return;

    if (container.classList.contains('value-container')) {
      container.classList.toggle('expanded');
    } else if (container.classList.contains('object-value-wrapper')) {
      container.classList.toggle('collapsed');
      container.classList.toggle('expanded');
    } else if (container.classList.contains('json-tree-item')) {
      container.classList.toggle('collapsed');
      const icon = container.querySelector('.json-tree-toggle');
      if (icon) icon.textContent = container.classList.contains('collapsed') ? '▶' : '▼';
      const children = container.querySelector('.json-tree-children');
      if (children) children.style.display = container.classList.contains('collapsed') ? 'none' : 'block';
    }
    return;
  }

  // Handle copy buttons
  const copyBtn = e.target.closest('.storage-copy-btn');
  if (copyBtn) {
    const textToCopy = copyBtn.dataset.value;
    if (textToCopy) {
      copyToClipboard(textToCopy).then(() => {
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<span class="icon">✓</span><span>已复制</span>';
        setTimeout(() => {
          copyBtn.innerHTML = originalText;
        }, 1500);
      });
    }
    return;
  }

  // Handle delete buttons
  const deleteBtn = e.target.closest('.storage-delete-btn');
  if (deleteBtn) {
    const sectionId = deleteBtn.dataset.section;
    const key = deleteBtn.dataset.key;
    if (sectionId && key) {
      const areaName = sectionId.replace('storage-', '');
      if (confirm(`确定要删除 "${key}" 吗？`)) {
        chrome.storage[areaName].remove(key).then(() => {
          return loadStorageArea(areaName);
        }).then(() => {
          renderAll();
          showNotification(`已删除: ${key}`);
        });
      }
    }
    return;
  }

  // Handle section refresh buttons
  const refreshBtn = e.target.closest('.section-refresh-btn');
  if (refreshBtn) {
    const sectionId = refreshBtn.dataset.section;
    if (sectionId) {
      const areaName = sectionId.replace('storage-', '');
      loadStorageArea(areaName).then(() => {
        renderAll();
        showNotification(`${storageSections[sectionId].title} 已刷新`);
      });
    }
    return;
  }
});

// JSON Syntax Highlighting
function syntaxHighlight(json) {
  if (typeof json !== 'string') {
    json = JSON.stringify(json, null, 2);
  }

  return json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'json-number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'json-key';
        } else {
          cls = 'json-string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'json-boolean';
      } else if (/null/.test(match)) {
        cls = 'json-null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
}

// Create JSON tree view (collapsible)
function createJsonTreeView(data, maxDepth = 5, currentDepth = 0) {
  if (currentDepth >= maxDepth) {
    return `<pre class="json-content">${syntaxHighlight(JSON.stringify(data, null, 2))}</pre>`;
  }

  if (data === null) {
    return '<span class="json-null">null</span>';
  }

  if (typeof data === 'boolean') {
    return `<span class="json-boolean">${data}</span>`;
  }

  if (typeof data === 'number') {
    return `<span class="json-number">${data}</span>`;
  }

  if (typeof data === 'string') {
    return `<span class="json-string">"${escapeHtml(data)}"</span>`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return '<span class="json-bracket">[]</span>';
    }

    let html = '<div class="json-tree-item">';
    html += '<span class="json-tree-toggle">▼</span>';
    html += '<span class="json-bracket">[</span>';
    html += '<span class="json-item-count">' + data.length + ' items</span>';
    html += '<div class="json-tree-children">';

    data.forEach((item, index) => {
      html += '<div class="json-tree-child">';
      html += '<span class="json-index">' + index + ':</span> ';
      html += createJsonTreeView(item, maxDepth, currentDepth + 1);
      html += '</div>';
    });

    html += '</div>';
    html += '<span class="json-bracket">]</span>';
    html += '</div>';

    return html;
  }

  if (typeof data === 'object') {
    const keys = Object.keys(data);
    if (keys.length === 0) {
      return '<span class="json-bracket">{}</span>';
    }

    let html = '<div class="json-tree-item">';
    html += '<span class="json-tree-toggle">▼</span>';
    html += '<span class="json-bracket">{</span>';
    html += '<span class="json-item-count">' + keys.length + ' keys</span>';
    html += '<div class="json-tree-children">';

    keys.forEach(key => {
      html += '<div class="json-tree-child">';
      html += '<span class="json-key">"' + escapeHtml(key) + '"</span>: ';
      html += createJsonTreeView(data[key], maxDepth, currentDepth + 1);
      html += '</div>';
    });

    html += '</div>';
    html += '<span class="json-bracket">}</span>';
    html += '</div>';

    return html;
  }

  return '<span class="json-string">"' + escapeHtml(String(data)) + '"</span>';
}

// Render section
function renderSection(sectionId, section) {
  const typeClass = sectionId.replace('storage-', '');
  const data = section.data || [];
  const count = data.length;

  let contentHtml = '';
  if (section.error) {
    contentHtml = `
      <div class="console-entry error">
        <span class="message">${escapeHtml(section.error)}</span>
      </div>
    `;
  } else if (count === 0) {
    contentHtml = `
      <div class="empty-state">
        <div class="empty-icon">📭</div>
        <div>暂无数据</div>
      </div>
    `;
  } else {
    contentHtml = data.map(item => renderStorageItem(item.key, item.value, sectionId)).join('');
  }

  return `
    <div class="console-section" data-section="${sectionId}">
      <div class="section-header">
        <span class="section-icon">▼</span>
        <span class="section-emoji">${section.icon}</span>
        <span class="section-title ${typeClass}">${section.title}</span>
        ${count > 0 ? `<span class="section-count">${count} 项</span>` : ''}
        <div class="section-actions">
          <button class="section-refresh-btn" data-section="${sectionId}" title="刷新">
            <span>🔄</span>
          </button>
        </div>
      </div>
      <div class="section-content">
        ${contentHtml}
      </div>
    </div>
  `;
}

// Render all sections
function renderAll() {
  outputEl.innerHTML = Object.entries(storageSections)
    .map(([id, section]) => renderSection(id, section))
    .join('');
}

// Load storage data for a specific area
async function loadStorageArea(areaName) {
  const sectionKey = `storage-${areaName}`;
  const section = storageSections[sectionKey];

  try {
    const data = await chrome.storage[areaName].get(null);
    const items = Object.entries(data || {}).map(([key, value]) => ({ key, value }));
    section.data = items;
    section.error = null;
  } catch (error) {
    section.data = [];
    section.error = areaName === 'session'
      ? '会话存储不可用或为空'
      : `读取失败: ${error.message}`;
  }
}

// Load all storage data
async function loadAllStorageData() {
  await Promise.all([
    loadStorageArea('local'),
    loadStorageArea('sync'),
    loadStorageArea('session')
  ]);
  renderAll();
}

// Show notification
function showNotification(message) {
  notificationTextEl.textContent = message;
  notificationEl.classList.add('show');

  setTimeout(() => {
    notificationEl.classList.remove('show');
  }, 2000);
}

// Initial load
loadAllStorageData();

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  const changedKeys = Object.keys(changes);
  showNotification(`${areaName} 存储已更新: ${changedKeys.join(', ')}`);

  // Reload the changed area
  setTimeout(async () => {
    await loadStorageArea(areaName);
    renderAll();
  }, 100);

  // Check if blocked domains changed and update mock exclude patterns
  if (areaName === 'sync' && changes.cy_settings) {
    const newSettings = changes.cy_settings.newValue;
    if (newSettings && newSettings.domainBlockedData) {
      // Reload blocked domains to exclude patterns
      loadBlockedDomainsToExclude();
    }
  }

  // Sync mock rules when they change
  if (areaName === 'local' && changes.mockRules) {
    mockRules = changes.mockRules.newValue || {};
    renderMockList(mockFilterInput.value);
    // If a request is selected, refresh the editor to show updated mock status
    if (selectedRequestId) {
      const req = mockRequests.find(r => r.id === selectedRequestId);
      if (req) {
        renderMockEditor(req);
      }
    }
  }
});

// ============================================
// Mock 标签页功能
// ============================================

// Mock数据存储
let mockRequests = [];
let selectedRequestId = null;
let mockRules = {}; // URL -> mock响应映射
let currentInspectedDomain = ''; // 当前被检查页面的域名
let currentTypeFilter = 'all'; // 当前类型过滤器
let mockFilterSettings = {
  maxDisplayCount: 50,  // 最大显示请求数量
  excludePatterns: []   // 要排除的URL模式
};

// Mock DOM元素
const mockListContent = document.getElementById('mock-list-content');
const mockEditor = document.getElementById('mock-editor');
const mockFilterInput = document.getElementById('mock-filter-input');
const mockClearBtn = document.getElementById('mock-clear-btn');
const mockRefreshBtn = document.getElementById('mock-refresh-btn');
const currentDomainText = document.getElementById('current-domain-text');
const filterCurrentDomainCheckbox = document.getElementById('filter-current-domain');
const autoScrollCheckbox = document.getElementById('auto-scroll');
const maxDisplayCountInput = document.getElementById('max-display-count');
const excludePatternInput = document.getElementById('exclude-pattern-input');
const addExcludeBtn = document.getElementById('add-exclude-btn');
const clearExcludeBtn = document.getElementById('clear-exclude-btn');
const excludePatternsList = document.getElementById('exclude-patterns-list');
const mockTypeTabs = document.getElementById('mock-type-tabs');

// 根据资源类型获取图标类名
function getTypeIconClass(type) {
  const typeMap = {
    'xhr': 'xhr',
    'fetch': 'fetch',
    'document': 'doc',
    'doc': 'doc',
    'javascript': 'js',
    'js': 'js',
    'stylesheet': 'css',
    'css': 'css',
    'image': 'img',
    'img': 'img',
    'media': 'media',
    'font': 'font',
    'websocket': 'ws',
    'ws': 'ws'
  };
  return typeMap[type?.toLowerCase()] || 'other';
}

// 获取类型短标签
function getTypeLabel(type) {
  const typeMap = {
    'xhr': 'XHR',
    'fetch': 'FTC',
    'document': 'DOC',
    'doc': 'DOC',
    'javascript': 'JS',
    'js': 'JS',
    'stylesheet': 'CSS',
    'css': 'CSS',
    'image': 'IMG',
    'img': 'IMG',
    'media': 'MED',
    'font': 'FNT',
    'websocket': 'WS',
    'ws': 'WS'
  };
  return typeMap[type?.toLowerCase()] || 'OTH';
}

// 检查请求类型是否匹配过滤器
function matchesTypeFilter(reqType, filter) {
  if (filter === 'all') return true;
  const type = reqType?.toLowerCase();

  if (filter === 'xhr') {
    return type === 'xhr' || type === 'fetch';
  }
  if (filter === 'doc') {
    return type === 'document' || type === 'doc' || type === 'html';
  }
  if (filter === 'js') {
    return type === 'javascript' || type === 'js' || type === 'script';
  }
  if (filter === 'css') {
    return type === 'stylesheet' || type === 'css';
  }
  if (filter === 'img') {
    return type === 'image' || type === 'img' || type === 'png' || type === 'jpg' || type === 'gif' || type === 'svg';
  }
  if (filter === 'media') {
    return type === 'media' || type === 'video' || type === 'audio';
  }
  if (filter === 'font') {
    return type === 'font' || type === 'woff' || type === 'woff2' || type === 'ttf';
  }
  if (filter === 'ws') {
    return type === 'websocket' || type === 'ws';
  }
  return type === filter;
}

// 从存储加载已存在的mock规则
async function loadMockRules() {
  try {
    const result = await chrome.storage.local.get('mockRules');
    mockRules = result.mockRules || {};
  } catch (e) {
    mockRules = {};
  }
}

// 从存储加载mock过滤设置
async function loadMockFilterSettings() {
  try {
    const result = await chrome.storage.local.get('mockFilterSettings');
    if (result.mockFilterSettings) {
      mockFilterSettings = { ...mockFilterSettings, ...result.mockFilterSettings };
    }
    // Update UI
    if (maxDisplayCountInput) {
      maxDisplayCountInput.value = mockFilterSettings.maxDisplayCount;
    }
    renderExcludePatterns();
  } catch (e) {
    console.error('Failed to load mock filter settings:', e);
  }
}

// 保存mock过滤设置到存储
async function saveMockFilterSettings() {
  try {
    await chrome.storage.local.set({ mockFilterSettings });
  } catch (e) {
    console.error('Failed to save mock filter settings:', e);
  }
}

// 渲染排除模式列表
function renderExcludePatterns() {
  if (!excludePatternsList) return;

  if (mockFilterSettings.excludePatterns.length === 0) {
    excludePatternsList.innerHTML = '<span style="font-size: 10px; color: #555;">无排除关键词</span>';
    return;
  }

  excludePatternsList.innerHTML = mockFilterSettings.excludePatterns.map((pattern, index) => `
    <span class="exclude-pattern-item">
      <span>${escapeHtml(pattern)}</span>
      <button class="remove-btn" data-index="${index}" title="移除">×</button>
    </span>
  `).join('');

  // Add click handlers for remove buttons
  excludePatternsList.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index, 10);
      removeExcludePattern(index);
    });
  });
}

// 添加排除模式
function addExcludePattern(pattern) {
  if (!pattern || pattern.trim() === '') return;

  // Split by space and add each pattern
  const patterns = pattern.trim().split(/\s+/).filter(p => p.length > 0);

  for (const p of patterns) {
    if (!mockFilterSettings.excludePatterns.includes(p)) {
      mockFilterSettings.excludePatterns.push(p);
    }
  }

  saveMockFilterSettings();
  renderExcludePatterns();
  renderMockList(mockFilterInput.value);
}

// 移除排除模式
function removeExcludePattern(index) {
  mockFilterSettings.excludePatterns.splice(index, 1);
  saveMockFilterSettings();
  renderExcludePatterns();
  renderMockList(mockFilterInput.value);
}

// 清空所有排除模式
function clearExcludePatterns() {
  mockFilterSettings.excludePatterns = [];
  saveMockFilterSettings();
  renderExcludePatterns();
  renderMockList(mockFilterInput.value);
}

// 检查扩展上下文是否仍然有效
function isExtensionContextValid() {
  try {
    return !!(chrome.runtime && chrome.runtime.id);
  } catch (e) {
    return false;
  }
}

// 检查错误是否由于上下文失效导致
function isContextInvalidatedError(error) {
  return error && (
    error.message?.includes('Extension context invalidated') ||
    error.message?.includes('Extension not loaded') ||
    error.name === 'Error'
  );
}

// 从后台加载被阻止的域名并添加到排除模式
async function loadBlockedDomainsToExclude() {
  // Check if extension context is still valid
  if (!isExtensionContextValid()) {
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_BLOCKED_DOMAINS' });
    if (response && response.allDomainBlockedData) {
      // Get current domain's blocked domains
      const currentDomain = currentInspectedDomain;
      let blockedList = [];

      // Get blocked domains for current domain
      const blockedDomainsMap = response.allDomainBlockedData.blockedDomains || {};
      if (currentDomain && blockedDomainsMap[currentDomain]) {
        blockedList.push(...blockedDomainsMap[currentDomain]);
      }

      // Get blocked response domains for current domain
      const blockedResponseDomainsMap = response.allDomainBlockedData.blockedResponseDomains || {};
      if (currentDomain && blockedResponseDomainsMap[currentDomain]) {
        blockedList.push(...blockedResponseDomainsMap[currentDomain]);
      }

      // Add to exclude patterns if not already present
      let added = false;
      for (const domain of [...new Set(blockedList)]) {
        if (domain && !mockFilterSettings.excludePatterns.includes(domain)) {
          mockFilterSettings.excludePatterns.push(domain);
          added = true;
        }
      }

      if (added) {
        saveMockFilterSettings();
        renderExcludePatterns();
        renderMockList(mockFilterInput.value);
      }
    }
  } catch (e) {
    // Silently ignore context invalidated errors
    if (!isContextInvalidatedError(e) && isExtensionContextValid()) {
      console.error('Failed to load blocked domains:', e);
    }
  }
}

// 保存mock规则到存储
async function saveMockRules() {
  if (!isExtensionContextValid()) return;
  try {
    await chrome.storage.local.set({ mockRules });
  } catch (e) {
    if (!isContextInvalidatedError(e) && isExtensionContextValid()) {
      console.error('Failed to save mock rules:', e);
    }
  }
}

// 检查URL是否有mock规则
function hasMockRule(url) {
  const urlPath = getUrlPath(url);
  return mockRules.hasOwnProperty(urlPath);
}

// 获取URL路径（不包含查询字符串，用于匹配）
function getUrlPath(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.origin + urlObj.pathname;
  } catch (e) {
    return url;
  }
}

// 获取用于显示的短URL
function getShortUrl(url) {
  try {
    const urlObj = new URL(url);
    let path = urlObj.pathname;
    if (path.length > 40) {
      path = path.substring(0, 37) + '...';
    }
    return path + urlObj.search.substring(0, 20);
  } catch (e) {
    return url.substring(0, 50);
  }
}

// Format bytes
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// 检查URL是否匹配排除模式
function isUrlBlocked(url) {
  try {
    const urlLower = url.toLowerCase();

    // Check against exclude patterns (simple string matching)
    for (const pattern of mockFilterSettings.excludePatterns) {
      if (urlLower.includes(pattern.toLowerCase())) {
        return true;
      }
    }

    return false;
  } catch (e) {
    return false;
  }
}

// 检查请求是否匹配当前过滤条件
function matchesCurrentFilter(req) {
  const filterByDomain = filterCurrentDomainCheckbox && filterCurrentDomainCheckbox.checked;
  const filter = mockFilterInput ? mockFilterInput.value : '';
  const showPatterns = filter.trim().split(/\s+/).filter(p => p.length > 0);

  // Filter by type
  if (!matchesTypeFilter(req.type, currentTypeFilter)) {
    return false;
  }

  // Filter out blocked domains
  if (isUrlBlocked(req.url)) {
    return false;
  }

  // Show-only filter
  if (showPatterns.length > 0) {
    const urlLower = req.url.toLowerCase();
    let matchesAny = false;
    for (const pattern of showPatterns) {
      if (urlLower.includes(pattern.toLowerCase())) {
        matchesAny = true;
        break;
      }
    }
    if (!matchesAny) {
      return false;
    }
  }

  // Domain filter
  if (filterByDomain && currentInspectedDomain) {
    try {
      const reqHostname = new URL(req.url).hostname;
      if (!reqHostname.includes(currentInspectedDomain) && !currentInspectedDomain.includes(reqHostname)) {
        return false;
      }
    } catch (e) {
      return false;
    }
  }

  return true;
}

// 跟踪所有已知请求ID（用于检测新请求）
let knownRequestIds = new Set();

// Render mock request list
function renderMockList(filter = '', forceAnimate = false) {
  const filterByDomain = filterCurrentDomainCheckbox && filterCurrentDomainCheckbox.checked;
  const maxCount = mockFilterSettings.maxDisplayCount || 50;

  // Parse filter into show-only patterns (space-separated) - only show matching requests
  const showPatterns = filter.trim().split(/\s+/).filter(p => p.length > 0);

  const filtered = mockRequests.filter(req => {
    // Filter by type
    if (!matchesTypeFilter(req.type, currentTypeFilter)) {
      return false;
    }

    // Filter out blocked domains (exclude patterns)
    if (isUrlBlocked(req.url)) {
      return false;
    }

    // Show-only filter (space-separated keywords) - only show if URL matches any pattern
    if (showPatterns.length > 0) {
      const urlLower = req.url.toLowerCase();
      let matchesAny = false;
      for (const pattern of showPatterns) {
        if (urlLower.includes(pattern.toLowerCase())) {
          matchesAny = true;
          break;
        }
      }
      if (!matchesAny) {
        return false; // Don't show this request if it doesn't match any pattern
      }
    }

    // Domain filter
    if (filterByDomain && currentInspectedDomain) {
      try {
        const reqHostname = new URL(req.url).hostname;
        if (!reqHostname.includes(currentInspectedDomain) && !currentInspectedDomain.includes(reqHostname)) {
          return false;
        }
      } catch (e) {
        return false;
      }
    }
    return true;
  });

  // Apply max display count limit
  const displayRequests = filtered.slice(0, maxCount);

  // Find truly new requests (new in mockRequests, not just new to the view)
  const currentAllIds = new Set(mockRequests.map(r => r.id));
  const newRequestIds = [...currentAllIds].filter(id => !knownRequestIds.has(id));

  // Update known IDs
  knownRequestIds = currentAllIds;

  if (displayRequests.length === 0) {
    const domainHint = currentInspectedDomain ? `当前域名: ${currentInspectedDomain}` : '';
    const typeHint = currentTypeFilter !== 'all' ? `类型: ${currentTypeFilter.toUpperCase()}` : '';
    mockListContent.innerHTML = `
      <div class="mock-empty-state">
        <div class="icon">📡</div>
        <div class="text">${showPatterns.length > 0 ? '无匹配请求' : (filterByDomain ? '当前域名无请求' : (currentTypeFilter !== 'all' ? '该类型无请求' : '暂无请求'))}</div>
        <div class="hint">${showPatterns.length > 0 || filterByDomain || currentTypeFilter !== 'all' ? '' : '刷新页面或等待网络请求'}</div>
        ${currentInspectedDomain ? `<div class="hint">${domainHint}</div>` : ''}
        ${typeHint ? `<div class="hint">${typeHint}</div>` : ''}
      </div>
    `;
    return;
  }

  // Show count info
  const countInfo = filtered.length > maxCount ?
    `<div class="mock-count-info">显示 ${maxCount} / ${filtered.length} 条请求</div>` : '';

  // Table header
  const tableHeader = `
    <div class="network-table-header">
      <div class="col col-icon"></div>
      <div class="col col-method">Method</div>
      <div class="col col-name">Name</div>
      <div class="col col-status">Status</div>
      <div class="col col-type">Type</div>
      <div class="col col-size">Size</div>
      <div class="col col-time">Time</div>
    </div>
  `;

  // Items wrapper for proper alternating colors
  const itemsHtml = displayRequests.map(req => {
    const isMocked = req.status === 'mocked';
    const isMockPending = req.status === 'mock-pending';
    const statusClass = isMocked ? 'mocked' :
      isMockPending ? 'pending' :
        (req.status >= 200 && req.status < 300) ? 'success' :
          req.status >= 400 ? 'error' : 'pending';
    const methodClass = req.method.toLowerCase();
    const timeStr = req.time ? `${req.time.toFixed(0)}ms` : '';
    const sizeStr = req.responseSize ? formatBytes(req.responseSize) : '';
    const typeIconClass = getTypeIconClass(req.type);
    const typeLabel = getTypeLabel(req.type);
    const shortUrl = getShortUrl(req.url);
    // Only animate if this is a truly new request
    const isNew = newRequestIds.includes(req.id);

    return `
      <div class="mock-item ${selectedRequestId === req.id ? 'active' : ''} ${isMocked ? 'mocked' : ''} ${isNew ? 'new-item' : ''}"
           data-id="${req.id}">
        <div class="col-icon">
          <span class="type-icon ${typeIconClass}" title="${req.type || 'unknown'}">${typeLabel}</span>
        </div>
        <div class="col-method">
          <span class="method ${methodClass}">${req.method}</span>
        </div>
        <div class="col-name">
          <span class="url" title="${escapeHtml(req.url)}">${escapeHtml(shortUrl)}${isMocked ? '<span class="mock-badge">MOCK</span>' : ''}</span>
        </div>
        <div class="col-status">
          <span class="status ${statusClass}">${isMocked ? 'MOCK' : (isMockPending ? 'PEND' : (req.status || '...'))}</span>
        </div>
        <div class="col-type">
          <span class="type-label">${typeLabel}</span>
        </div>
        <div class="col-size">${sizeStr || '-'}</div>
        <div class="col-time">${timeStr || '-'}</div>
        <button class="mock-item-delete" data-id="${req.id}" title="删除">×</button>
      </div>
    `;
  }).join('');

  mockListContent.innerHTML = tableHeader + countInfo + itemsHtml;

  // Add click handlers for items
  mockListContent.querySelectorAll('.mock-item').forEach(item => {
    item.addEventListener('click', (e) => {
      // Don't select if clicking delete button
      if (e.target.classList.contains('mock-item-delete')) {
        return;
      }
      const id = item.dataset.id;
      selectMockRequest(id);
    });
  });

  // Add click handlers for delete buttons
  mockListContent.querySelectorAll('.mock-item-delete').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      deleteMockRequest(id);
    });
  });
}

// Delete a single mock request
function deleteMockRequest(id) {
  const index = mockRequests.findIndex(r => r.id === id);
  if (index >= 0) {
    mockRequests.splice(index, 1);
    if (selectedRequestId === id) {
      selectedRequestId = null;
      renderEmptyEditor();
    }
    renderMockList(mockFilterInput.value);
    showNotification('已删除请求');
  }
}

// Select a mock request
function selectMockRequest(id) {
  selectedRequestId = id;
  const req = mockRequests.find(r => r.id === id);

  // Update list selection immediately (without full re-render)
  if (mockListContent) {
    mockListContent.querySelectorAll('.mock-item').forEach(item => {
      if (item.dataset.id === id) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }

  if (!req) {
    renderEmptyEditor();
    return;
  }

  renderMockEditor(req);
}

// Render empty editor state
function renderEmptyEditor() {
  mockEditor.innerHTML = `
    <div class="mock-empty-state">
      <div class="icon">📝</div>
      <div class="text">选择一个请求查看详情</div>
    </div>
  `;
}

// Render mock editor for a request
function renderMockEditor(req) {
  const urlPath = getUrlPath(req.url);
  const hasMock = hasMockRule(req.url);
  const isMocked = req.status === 'mocked';
  const mockData = mockRules[urlPath];
  const responseBody = req.responseBody || '';

  // Format for display and editing
  let formattedBody = responseBody;
  try {
    const parsed = JSON.parse(responseBody);
    formattedBody = JSON.stringify(parsed, null, 2);
  } catch (e) { }

  // Mock textarea default value
  const mockTextareaValue = mockData
    ? (typeof mockData === 'string' ? mockData : JSON.stringify(mockData, null, 2))
    : formattedBody;

  // Status display
  const statusDisplay = isMocked ? 'MOCKED' : (req.status || 'Pending');
  const statusStyle = isMocked ? 'background: #4ec9b0; color: #1e1e1e; font-weight: 600;' :
    (req.status >= 400 ? 'background: #c53030; color: white;' : '');

  mockEditor.innerHTML = `
    <div class="mock-editor-header">
      <div class="request-info">
        <div class="request-url">${escapeHtml(req.url)}</div>
        <div class="request-meta">
          <span class="method ${req.method.toLowerCase()}" style="display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600;">
            ${req.method}
          </span>
          <span style="margin-left: 8px; padding: 1px 6px; border-radius: 3px; ${statusStyle}">Status: ${statusDisplay}</span>
          ${req.requestDomain ? `<span style="margin-left: 8px; color: #888;">域名: ${escapeHtml(req.requestDomain)}</span>` : ''}
          ${req.responseSize ? `<span style="margin-left: 8px;">Size: ${formatBytes(req.responseSize)}</span>` : ''}
          ${req.time ? `<span style="margin-left: 8px;">Time: ${req.time.toFixed(0)}ms</span>` : ''}
        </div>
      </div>
    </div>
    <div class="mock-editor-tabs">
      <div class="mock-editor-tab active" data-tab="response">Response</div>
      <div class="mock-editor-tab" data-tab="headers">Headers</div>
      <div class="mock-editor-tab" data-tab="mock">Mock</div>
    </div>
    <div class="mock-editor-content">
      <!-- Response Tab -->
      <div class="mock-editor-pane active" id="pane-response">
        <div class="mock-response-viewer">
          ${isMocked ? '<div style="color: #4ec9b0; margin-bottom: 8px; font-weight: 600;">✓ 此请求已被 Mock 拦截</div>' : ''}
          ${renderJsonPreview(responseBody)}
        </div>
      </div>
      <!-- Headers Tab -->
      <div class="mock-editor-pane" id="pane-headers">
        <div class="mock-response-viewer">
          <table class="headers-table">
            <tbody>
              ${Object.entries(req.responseHeaders || {}).map(([key, value]) => `
                <tr>
                  <th>${escapeHtml(key)}</th>
                  <td>${escapeHtml(String(value))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <!-- Mock Tab -->
      <div class="mock-editor-pane" id="pane-mock">
        <div class="mock-response-editor">
          ${renderEditableJsonPreview(mockTextareaValue, 'mock-response-textarea')}
        </div>
        <div class="mock-editor-actions">
          <button class="mock-btn success" id="mock-and-request-btn">Mock一次</button>
          ${hasMock ? '<button class="mock-btn danger" id="remove-mock-btn">移除 Mock</button>' : ''}
        </div>
      </div>
    </div>
  `;

  // Initialize JSON preview events
  initJsonPreviewEvents();

  // Setup editable JSON events
  const editContainer = document.querySelector('.json-edit-container');
  if (editContainer) {
    setupEditableJsonEvents(editContainer, 'mock-response-textarea');
  }

  // Add tab switching
  mockEditor.querySelectorAll('.mock-editor-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      mockEditor.querySelectorAll('.mock-editor-tab').forEach(t => t.classList.remove('active'));
      mockEditor.querySelectorAll('.mock-editor-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      const paneId = 'pane-' + tab.dataset.tab;
      document.getElementById(paneId).classList.add('active');
    });
  });

  // Add button handlers
  document.getElementById('mock-and-request-btn').addEventListener('click', () => mockAndRequest(req));

  const removeBtn = document.getElementById('remove-mock-btn');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => removeMock(req));
  }
}

// Mock once - save current response data and trigger request
async function mockAndRequest(req) {
  if (!isExtensionContextValid()) {
    showNotification('扩展上下文已失效，请刷新面板');
    return;
  }

  const textarea = document.getElementById('mock-response-textarea');
  const value = textarea.value.trim();

  if (!value) {
    showNotification('请输入 Mock 数据');
    return;
  }

  const urlPath = getUrlPath(req.url);

  // Try to parse as JSON, otherwise use as string
  let mockData;
  try {
    mockData = JSON.parse(value);
  } catch (e) {
    mockData = value;
  }

  // Simple structure: URL -> mock response (will be deleted after use)
  mockRules[urlPath] = mockData;

  // Save to storage
  try {
    await chrome.storage.local.set({ mockRules });
  } catch (e) {
    if (!isContextInvalidatedError(e) && isExtensionContextValid()) {
      console.error('Failed to save mock rules:', e);
    }
  }

  showNotification('Mock已设置，正在请求...');

  // Wait for storage to sync to content script
  await new Promise(resolve => setTimeout(resolve, 50));

  // Trigger a request - will be intercepted by content script
  try {
    const code = `
      (async function() {
        try {
          const response = await fetch('${req.url.replace(/'/g, "\\'")}', {
            method: '${req.method || 'GET'}',
            credentials: 'include'
          });
          const text = await response.text();
          return {
            status: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers.entries()),
            body: text
          };
        } catch (e) {
          return { error: e.message };
        }
      })()
    `;

    chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
      if (isException) {
        showNotification('请求失败: ' + (result.description || result));
        return;
      }

      if (result && result.error) {
        showNotification('请求失败: ' + result.error);
        return;
      }

      // Add a NEW entry for mocked request (don't update existing)
      const responseBody = typeof mockData === 'string' ? mockData : JSON.stringify(mockData, null, 2);
      let requestHostname = '';
      try {
        requestHostname = new URL(req.url).hostname;
      } catch (e) { }

      const newMockedRequest = {
        id: 'mock-' + Date.now().toString(),
        url: req.url,
        method: req.method || 'GET',
        status: 'mocked',
        type: 'fetch',
        time: 0,
        responseSize: responseBody.length,
        responseHeaders: { 'x-mock-intercepted': 'true' },
        responseBody: responseBody,
        timestamp: Date.now(),
        requestDomain: requestHostname
      };

      mockRequests.unshift(newMockedRequest);
      console.log('[Mock] Added new mocked request entry');

      showNotification('Mock请求完成');
      renderMockList(mockFilterInput.value);

      // Select the new mocked request
      selectedRequestId = newMockedRequest.id;
      renderMockEditor(newMockedRequest);
    });
  } catch (e) {
    showNotification('请求失败: ' + e.message);
  }
}

// Remove mock for a request
async function removeMock(req) {
  if (!isExtensionContextValid()) {
    showNotification('扩展上下文已失效，请刷新面板');
    return;
  }

  const urlPath = getUrlPath(req.url);
  delete mockRules[urlPath];

  try {
    await chrome.storage.local.set({ mockRules });
  } catch (e) {
    if (!isContextInvalidatedError(e) && isExtensionContextValid()) {
      console.error('Failed to save mock rules:', e);
    }
  }

  showNotification('Mock 已移除');
  renderMockList(mockFilterInput.value);
  renderMockEditor(req);
}

// Network request handler (from devtools API)
function handleRequest(harEntry) {
  // HAR entry structure: https://developer.chrome.com/docs/extensions/reference/api/devtools/network
  // harEntry contains: request, response, time, getContent(), etc.

  // Get request info from HAR entry structure
  // harEntry.request contains: url, method, headers, etc.
  const req = harEntry.request;
  if (!req) return;

  const url = req.url;
  const method = req.method || 'GET';
  // Resource type is stored in _resourceType (undocumented but standard)
  const requestType = (harEntry._resourceType || '').toString().toLowerCase();

  // Only capture XHR/Fetch requests
  if (requestType !== 'xhr' && requestType !== 'fetch') {
    return;
  }

  // Get request hostname for display
  let requestHostname = '';
  try {
    requestHostname = new URL(url).hostname;
  } catch (e) {
    return;
  }

  // Get response content via getContent() method
  harEntry.getContent((content, encoding) => {
    // Get response info from harEntry.response
    const response = harEntry.response || {};

    // Convert headers array [{name, value}] to object {name: value}
    const headersObj = {};
    if (Array.isArray(response.headers)) {
      response.headers.forEach(h => {
        if (h.name && h.value !== undefined) {
          headersObj[h.name] = h.value;
        }
      });
    }

    // Check if this request was mocked by checking response header
    const isMocked = headersObj['x-mock-intercepted'] === 'true';

    // If this is a mocked request, skip - mockAndRequest will handle it
    if (isMocked) {
      console.log('[Network] Skipping mocked request (handled by mockAndRequest)');
      return;
    }

    // Find existing request by URL path
    const urlPath = getUrlPath(url);
    const existingIndex = mockRequests.findIndex(r => getUrlPath(r.url) === urlPath && r.method === method);

    const reqData = {
      id: harEntry._requestId || Date.now().toString(),
      url: url,
      method: method,
      status: isMocked ? 'mocked' : (response.status || 200),
      type: requestType,
      time: harEntry.time ? harEntry.time : 0,
      responseSize: response.contentSize || (content ? content.length : 0),
      responseHeaders: headersObj,
      responseBody: content || '',
      timestamp: Date.now(),
      requestDomain: requestHostname
    };

    // Update existing or add new
    const isNewRequest = existingIndex < 0;
    if (isNewRequest) {
      mockRequests.unshift(reqData);
    } else {
      mockRequests[existingIndex] = reqData;
    }

    // Keep only last 100 requests
    if (mockRequests.length > 100) {
      mockRequests = mockRequests.slice(0, 100);
    }

    // Only render if the request matches current filter (or updating existing visible request)
    const matchesFilter = matchesCurrentFilter(reqData);
    if (matchesFilter || !isNewRequest) {
      scheduleMockListRender();
    }

    // Auto scroll to top if enabled (newest requests are at the top)
    if (mockListContent && autoScrollCheckbox && autoScrollCheckbox.checked) {
      mockListContent.scrollTop = 0;
    }
  });
}

// Debounced render for mock list
let mockListRenderTimer = null;
function scheduleMockListRender() {
  if (mockListRenderTimer) {
    clearTimeout(mockListRenderTimer);
  }
  mockListRenderTimer = setTimeout(() => {
    renderMockList(mockFilterInput.value);
    mockListRenderTimer = null;
  }, 100); // Batch renders within 100ms
}

// Initialize network monitoring
function initNetworkMonitoring() {
  // Get current inspected tab info
  updateCurrentDomain();

  // Listen for network requests via devtools API
  chrome.devtools.network.onRequestFinished.addListener(handleRequest);

  // Listen for navigation to clear requests and update domain
  chrome.devtools.network.onNavigated.addListener((url) => {
    // Update current domain
    try {
      const urlObj = new URL(url);
      currentInspectedDomain = urlObj.hostname;
      updateDomainDisplay();
      // Load blocked domains for new domain
      loadBlockedDomainsToExclude();
    } catch (e) {
      currentInspectedDomain = '';
      updateDomainDisplay();
    }

    // Clear mock requests list on navigation
    mockRequests = [];
    selectedRequestId = null;
    knownRequestIds = new Set(); // Reset known IDs
    renderMockList();
    renderEmptyEditor();

    // Clear mock rules on navigation (they should only last for one request)
    mockRules = {};
    chrome.storage.local.set({ mockRules }).catch(() => { });
  });

  // Add domain filter checkbox listener
  if (filterCurrentDomainCheckbox) {
    filterCurrentDomainCheckbox.addEventListener('change', () => {
      renderMockList(mockFilterInput.value);
    });
  }
}

// Update current domain from inspected window
function updateCurrentDomain() {
  chrome.devtools.inspectedWindow.eval('location.hostname', (result, isException) => {
    if (!isException) {
      currentInspectedDomain = result;
      updateDomainDisplay();
      // Load blocked domains for current domain
      loadBlockedDomainsToExclude();
    }
  });
}

// Update domain display in UI
function updateDomainDisplay() {
  if (currentDomainText) {
    currentDomainText.textContent = currentInspectedDomain ? `域名: ${currentInspectedDomain}` : '-';
    currentDomainText.title = currentInspectedDomain || '';
  }
}

// Filter input handler
mockFilterInput.addEventListener('input', (e) => {
  renderMockList(e.target.value);
});

// Clear button handler
mockClearBtn.addEventListener('click', () => {
  mockRequests = [];
  selectedRequestId = null;
  knownRequestIds = new Set(); // Reset known IDs
  renderMockList();
  renderEmptyEditor();
  showNotification('已清空请求列表');
});

// Refresh button handler - reload the inspected page
mockRefreshBtn.addEventListener('click', () => {
  chrome.devtools.inspectedWindow.reload();
});

// Max display count input handler
if (maxDisplayCountInput) {
  maxDisplayCountInput.addEventListener('change', (e) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 10 && value <= 500) {
      mockFilterSettings.maxDisplayCount = value;
      saveMockFilterSettings();
      renderMockList(mockFilterInput.value);
    }
  });
}

// Add exclude pattern button handler
if (addExcludeBtn) {
  addExcludeBtn.addEventListener('click', () => {
    if (excludePatternInput) {
      addExcludePattern(excludePatternInput.value);
      excludePatternInput.value = '';
    }
  });
}

// Exclude pattern input enter key handler
if (excludePatternInput) {
  excludePatternInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addExcludePattern(excludePatternInput.value);
      excludePatternInput.value = '';
    }
  });
}

// Clear exclude patterns button handler
if (clearExcludeBtn) {
  clearExcludeBtn.addEventListener('click', () => {
    clearExcludePatterns();
    showNotification('已清空排除关键词');
  });
}

// Type filter tabs handler
if (mockTypeTabs) {
  mockTypeTabs.querySelectorAll('.type-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Update active state
      mockTypeTabs.querySelectorAll('.type-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update filter and re-render
      currentTypeFilter = tab.dataset.type;
      renderMockList(mockFilterInput.value);
    });
  });
}

// ========== Clear Browsing Data ==========
const clearCacheCheckbox = document.getElementById('clear-cache');
const clearCookiesCheckbox = document.getElementById('clear-cookies');
const clearHistoryCheckbox = document.getElementById('clear-history');
const clearLocalStorageCheckbox = document.getElementById('clear-local-storage');
const clearIndexedDBCheckbox = document.getElementById('clear-indexeddb');
const clearDownloadsCheckbox = document.getElementById('clear-downloads');
const clearTimeRangeSelect = document.getElementById('clear-time-range');
const clearBrowsingDataBtn = document.getElementById('clear-browsing-data-btn');

/**
 * Get time range in milliseconds since epoch
 */
function getTimeRange(rangeType) {
  const now = Date.now();
  const ranges = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: 0
  };

  const duration = ranges[rangeType] || 0;
  return duration === 0 ? 0 : now - duration;
}

/**
 * Clear browsing data based on selected options
 */
async function clearBrowsingData() {
  const since = getTimeRange(clearTimeRangeSelect.value);

  // Build data types to remove
  const dataTypes = {};

  if (clearCacheCheckbox && clearCacheCheckbox.checked) {
    dataTypes.cache = true;
  }
  if (clearCookiesCheckbox && clearCookiesCheckbox.checked) {
    dataTypes.cookies = true;
  }
  if (clearHistoryCheckbox && clearHistoryCheckbox.checked) {
    dataTypes.history = true;
  }
  if (clearLocalStorageCheckbox && clearLocalStorageCheckbox.checked) {
    dataTypes.localStorage = true;
  }
  if (clearIndexedDBCheckbox && clearIndexedDBCheckbox.checked) {
    dataTypes.indexedDB = true;
  }
  if (clearDownloadsCheckbox && clearDownloadsCheckbox.checked) {
    dataTypes.downloads = true;
  }

  // Check if at least one option is selected
  if (Object.keys(dataTypes).length === 0) {
    showNotification('请至少选择一个要清除的数据项', 'error');
    return;
  }

  // Confirm before clearing
  const timeRangeText = clearTimeRangeSelect.options[clearTimeRangeSelect.selectedIndex].text;
  const selectedItems = Object.keys(dataTypes).map(k => {
    const labels = {
      cache: '缓存',
      cookies: 'Cookies',
      history: '浏览历史',
      localStorage: '本地存储',
      indexedDB: 'IndexedDB',
      downloads: '下载历史'
    };
    return labels[k];
  }).join('、');

  if (!confirm(`确定要清除 ${timeRangeText} 的 ${selectedItems} 吗？\n此操作无法撤销。`)) {
    return;
  }

  try {
    if (clearBrowsingDataBtn) {
      clearBrowsingDataBtn.disabled = true;
      clearBrowsingDataBtn.textContent = '清除中...';
    }

    // Send message to background script to clear browsing data
    console.log('[清除数据] 发送消息:', { since, dataTypes });
    const response = await chrome.runtime.sendMessage({
      type: 'CLEAR_BROWSING_DATA',
      data: {
        since,
        dataTypes
      }
    });
    console.log('[清除数据] 收到响应:', response);

    if (response && response.success) {
      if (clearBrowsingDataBtn) {
        clearBrowsingDataBtn.textContent = '清除成功!';
        setTimeout(() => {
          clearBrowsingDataBtn.textContent = '清除选中的数据';
          clearBrowsingDataBtn.disabled = false;
        }, 2000);
      }
      showNotification(`已清除 ${selectedItems}`, 'success');
      console.log('[清除数据] 已清除:', dataTypes, '时间范围:', timeRangeText);
    } else {
      throw new Error(response?.error || '清除失败');
    }
  } catch (error) {
    console.error('[清除数据] 清除失败:', error);
    showNotification('清除数据失败: ' + error.message, 'error');
    if (clearBrowsingDataBtn) {
      clearBrowsingDataBtn.textContent = '清除选中的数据';
      clearBrowsingDataBtn.disabled = false;
    }
  }
}

// Add event listener for clear browsing data button
if (clearBrowsingDataBtn) {
  clearBrowsingDataBtn.addEventListener('click', clearBrowsingData);
}

// Initialize mock functionality
loadMockRules();
loadMockFilterSettings();
initNetworkMonitoring();

// ============================================
// Bookmarks Tab Functionality
// ============================================
const bookmarksList = document.getElementById('bookmarks-list');
const bookmarksSearchInput = document.getElementById('bookmarks-search-input');
const bookmarksCount = document.getElementById('bookmarks-count');
const bookmarksRefreshBtn = document.getElementById('bookmarks-refresh-btn');

let allBookmarks = [];
let bookmarkTreeRoot = null;
let bookmarksViewMode = 'grid'; // 'tree' or 'grid'

// Flatten bookmark tree into array for search
function flattenBookmarkTree(node, array) {
  if (!node) return;

  if (node.url) {
    array.push(node);
  }

  if (node.children) {
    node.children.forEach(child => flattenBookmarkTree(child, array));
  }
}

// Count total items in a bookmark tree
function countBookmarkItems(node) {
  let count = 0;
  if (node.url) {
    count = 1;
  }
  if (node.children) {
    node.children.forEach(child => {
      count += countBookmarkItems(child);
    });
  }
  return count;
}

// Find bookmark node by id in tree
function findBookmarkNode(node, id) {
  if (node.id === id) return node;
  if (node.children) {
    for (const child of node.children) {
      const found = findBookmarkNode(child, id);
      if (found) return found;
    }
  }
  return null;
}

// Get favicon URL for a domain
function getFaviconUrl(url) {
  try {
    const domain = new URL(url).hostname;
    return `chrome://favicon/${domain}`;
  } catch {
    return '';
  }
}

// Format date for display
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}

// Load bookmarks from chrome.bookmarks API
async function loadBookmarks() {
  if (!bookmarksList) return;

  bookmarksList.innerHTML = '<div class="bookmarks-loading">加载中...</div>';
  console.log('[书签] 开始加载...');

  try {
    // Check if bookmarks API is available
    if (!chrome.bookmarks) {
      throw new Error('chrome.bookmarks API 不可用，请重新加载扩展');
    }

    const tree = await chrome.bookmarks.getTree();
    console.log('[书签] 获取到书签树:', tree);

    // Store tree root
    bookmarkTreeRoot = tree[0];

    // Store original tree for search functionality
    allBookmarks = [];
    flattenBookmarkTree(bookmarkTreeRoot, allBookmarks);
    console.log('[书签] 展平后书签数量:', allBookmarks.length);

    // Render in tree structure
    renderBookmarksTreeRoot(bookmarkTreeRoot);
  } catch (error) {
    console.error('[书签] 加载失败:', error);
    bookmarksList.innerHTML = '<div class="bookmarks-empty"><div class="icon">⚠️</div><div>加载失败: ' + error.message + '</div></div>';
  }
}

// Render bookmarks tree root
function renderBookmarksTreeRoot(rootNode) {
  if (!bookmarksList) return;

  if (!rootNode || !rootNode.children || rootNode.children.length === 0) {
    bookmarksList.innerHTML = '<div class="bookmarks-empty"><div class="icon">📭</div><div>暂无书签</div></div>';
    if (bookmarksCount) bookmarksCount.textContent = '0 个书签';
    return;
  }

  const totalCount = countBookmarkItems(rootNode);
  if (bookmarksCount) bookmarksCount.textContent = `${totalCount} 个书签`;

  bookmarksList.innerHTML = renderBookmarksTree(rootNode.children, bookmarksList, 0);
}

// Render bookmarks in tree structure
function renderBookmarksTree(nodes, container, level = 0) {
  if (!nodes || !Array.isArray(nodes)) return '';

  let html = '';
  const isGridMode = bookmarksViewMode === 'grid';

  for (const node of nodes) {
    if (node.children) {
      // This is a folder
      const childCount = countBookmarkItems(node);
      const hasOnlyBookmarks = node.children.every(c => c.url);

      html += `
        <div class="bookmark-folder" data-id="${node.id}" data-level="${level}">
          <div class="bookmark-folder-header">
            <span class="bookmark-drag-handle" draggable="true" title="拖拽移动">⋮⋮</span>
            <span class="bookmark-folder-icon">▼</span>
            <span class="bookmark-folder-name">${escapeHtml(node.title || '未命名文件夹')}</span>
            <span class="bookmark-folder-count">(${childCount} 项)</span>
            <div class="bookmark-item-actions">
              <button class="bookmark-action-btn" data-action="add-bookmark" title="添加书签">+</button>
              <button class="bookmark-action-btn" data-action="add-folder" title="添加文件夹">📁</button>
            </div>
          </div>
          <div class="bookmark-children ${isGridMode && hasOnlyBookmarks ? 'bookmark-grid' : ''}">
            ${renderBookmarksTree(node.children, container, level + 1)}
          </div>
        </div>
      `;
    } else if (node.url) {
      // This is a bookmark
      const faviconUrl = getFaviconUrl(node.url);
      const dateAdded = formatDate(node.dateAdded);

      html += `
        <div class="bookmark-item" data-url="${escapeHtml(node.url)}" data-id="${node.id}" data-level="${level}">
          <span class="bookmark-drag-handle" draggable="true" title="拖拽移动">⋮⋮</span>
          <div class="bookmark-favicon">
            ${faviconUrl ? `<img src="${faviconUrl}" onerror="this.parentElement.innerHTML='<div class=\\'fallback\\'>🔗</div>'">` : '<div class="fallback">🔗</div>'}
          </div>
          <div class="bookmark-info">
            <div class="bookmark-title" title="${escapeHtml(node.title)}">${escapeHtml(node.title) || '无标题'}</div>
            <div class="bookmark-url" title="${escapeHtml(node.url)}">${escapeHtml(node.url)}</div>
          </div>
          <div class="bookmark-date">${dateAdded}</div>
          <div class="bookmark-item-actions">
            <button class="bookmark-action-btn" data-action="edit" title="编辑">✏️</button>
            <button class="bookmark-action-btn delete" data-action="delete" title="删除">🗑️</button>
          </div>
        </div>
      `;
    }
  }

  return html;
}

// Count total items in a bookmark tree
function countBookmarkItems(node) {
  let count = 0;
  if (node.url) {
    count = 1;
  }
  if (node.children) {
    node.children.forEach(child => {
      count += countBookmarkItems(child);
    });
  }
  return count;
}

// Render bookmarks list
function renderBookmarks(bookmarks) {
  if (!bookmarksList) return;

  if (bookmarks.length === 0) {
    bookmarksList.innerHTML = '<div class="bookmarks-empty"><div class="icon">📭</div><div>暂无书签</div></div>';
    if (bookmarksCount) bookmarksCount.textContent = '0 个书签';
    return;
  }

  if (bookmarksCount) bookmarksCount.textContent = `${bookmarks.length} 个书签`;

  // For search results, show flat list
  bookmarksList.innerHTML = bookmarks.map(bookmark => {
    const faviconUrl = getFaviconUrl(bookmark.url);
    const dateAdded = formatDate(bookmark.dateAdded);

    return `
      <div class="bookmark-item" data-url="${escapeHtml(bookmark.url)}" data-id="${bookmark.id}">
        <div class="bookmark-favicon">
          ${faviconUrl ? `<img src="${faviconUrl}" onerror="this.parentElement.innerHTML='<div class=\\'fallback\\'>🔗</div>'">` : '<div class="fallback">🔗</div>'}
        </div>
        <div class="bookmark-info">
          <div class="bookmark-title" title="${escapeHtml(bookmark.title)}">${escapeHtml(bookmark.title) || '无标题'}</div>
          <div class="bookmark-url" title="${escapeHtml(bookmark.url)}">${escapeHtml(bookmark.url)}</div>
        </div>
        <div class="bookmark-date">${dateAdded}</div>
      </div>
    `;
  }).join('');
}

// Search bookmarks in tree
function searchBookmarksInTree(query) {
  if (!query) {
    // Reload tree view
    if (bookmarkTreeRoot) {
      renderBookmarksTreeRoot(bookmarkTreeRoot);
    } else {
      chrome.bookmarks.getTree().then(tree => {
        bookmarkTreeRoot = tree[0];
        renderBookmarksTreeRoot(bookmarkTreeRoot);
      });
    }
    return;
  }

  // Filter and show flat results
  const lowerQuery = query.toLowerCase();
  const filtered = allBookmarks.filter(bookmark =>
    bookmark.title.toLowerCase().includes(lowerQuery) ||
    bookmark.url.toLowerCase().includes(lowerQuery)
  );

  if (filtered.length === 0) {
    bookmarksList.innerHTML = '<div class="bookmarks-empty"><div class="icon">🔍</div><div>未找到匹配的书签</div></div>';
    if (bookmarksCount) bookmarksCount.textContent = `找到 0 个书签`;
  } else {
    renderBookmarks(filtered);
    if (bookmarksCount) bookmarksCount.textContent = `找到 ${filtered.length} 个书签`;
  }
}

// Search bookmarks
function searchBookmarks(query) {
  searchBookmarksInTree(query);
}

// Bookmarks event listeners
if (bookmarksRefreshBtn) {
  bookmarksRefreshBtn.addEventListener('click', loadBookmarks);
}

const bookmarksViewModeSelect = document.getElementById('bookmarks-view-mode');
if (bookmarksViewModeSelect) {
  bookmarksViewModeSelect.addEventListener('change', (e) => {
    bookmarksViewMode = e.target.value;
    if (bookmarkTreeRoot) {
      renderBookmarksTreeRoot(bookmarkTreeRoot);
    }
  });
}

if (bookmarksSearchInput) {
  let searchTimeout;
  bookmarksSearchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchBookmarks(e.target.value);
    }, 200);
  });
}

// Bookmark click handler - open in new tab or toggle folder
bookmarksList?.addEventListener('click', (e) => {
  // Handle action buttons
  const actionBtn = e.target.closest('.bookmark-action-btn');
  if (actionBtn) {
    e.stopPropagation();
    const action = actionBtn.dataset.action;
    const item = actionBtn.closest('.bookmark-item') || actionBtn.closest('.bookmark-folder');
    const bookmarkId = item?.dataset.id;

    switch (action) {
      case 'edit':
        openBookmarkEditDialog(bookmarkId);
        break;
      case 'delete':
        deleteBookmark(bookmarkId);
        break;
      case 'add-bookmark':
        createNewBookmark(bookmarkId);
        break;
      case 'add-folder':
        createNewFolder(bookmarkId);
        break;
    }
    return;
  }

  // Handle folder collapse/expand (exclude drag handle)
  const folderHeader = e.target.closest('.bookmark-folder-header');
  if (folderHeader && !e.target.closest('.bookmark-item-actions') && !e.target.closest('.bookmark-drag-handle')) {
    const folder = folderHeader.closest('.bookmark-folder');
    if (folder) {
      folder.classList.toggle('collapsed');
      const children = folder.querySelector('.bookmark-children');
      if (children) {
        children.classList.toggle('hidden');
      }
    }
    return;
  }

  // Handle bookmark item click (exclude drag handle)
  const item = e.target.closest('.bookmark-item');
  if (item && !e.target.closest('.bookmark-item-actions') && !e.target.closest('.bookmark-drag-handle')) {
    const url = item.dataset.url;
    if (url) {
      chrome.tabs.create({ url });
    }
  }
});

// ========== Bookmark CRUD Operations ==========
const bookmarkEditOverlay = document.getElementById('bookmark-edit-overlay');
const bookmarkEditDialogTitle = document.getElementById('bookmark-edit-dialog-title');
const bookmarkEditTitleInput = document.getElementById('bookmark-edit-title-input');
const bookmarkEditUrlInput = document.getElementById('bookmark-edit-url-input');
const bookmarkEditUrlField = document.getElementById('bookmark-edit-url-field');
const bookmarkEditSaveBtn = document.getElementById('bookmark-edit-save-btn');
const bookmarkEditCancelBtn = document.getElementById('bookmark-edit-cancel-btn');
const bookmarkEditDeleteBtn = document.getElementById('bookmark-edit-delete-btn');
const bookmarkContextMenu = document.getElementById('bookmark-context-menu');

let currentEditingBookmark = null;
let currentEditingParentId = null;

// Get reference to new-folder menu item
const contextNewFolder = document.getElementById('context-new-folder');

// Right-click context menu for bookmarks
bookmarksList?.addEventListener('contextmenu', (e) => {
  e.preventDefault();

  const folder = e.target.closest('.bookmark-folder');
  const item = e.target.closest('.bookmark-item');
  const target = folder || item;

  if (target) {
    const isFolder = !!folder;
    currentEditingBookmark = {
      id: target.dataset.id,
      isFolder: isFolder
    };
    currentEditingParentId = null;

    // Show/hide "new-folder" option based on target type
    if (contextNewFolder) {
      contextNewFolder.style.display = isFolder ? 'block' : 'none';
    }

    // Show context menu
    bookmarkContextMenu.style.left = e.pageX + 'px';
    bookmarkContextMenu.style.top = e.pageY + 'px';
    bookmarkContextMenu.classList.add('active');
  }
});

// Close context menu when clicking elsewhere
document.addEventListener('click', () => {
  bookmarkContextMenu?.classList.remove('active');
});

// Context menu actions
bookmarkContextMenu?.addEventListener('click', (e) => {
  const action = e.target.closest('.context-menu-item');
  if (!action) return;

  const actionType = action.dataset.action;
  const bookmarkId = currentEditingBookmark?.id;

  switch (actionType) {
    case 'edit':
      openBookmarkEditDialog(bookmarkId);
      break;
    case 'new-folder':
      createNewFolder(bookmarkId);
      break;
    case 'new-bookmark':
      createNewBookmark(bookmarkId);
      break;
    case 'delete':
      deleteBookmark(bookmarkId);
      break;
  }

  bookmarkContextMenu.classList.remove('active');
});

// Open bookmark edit dialog
async function openBookmarkEditDialog(bookmarkId) {
  const bookmark = await chrome.bookmarks.get(bookmarkId);
  if (!bookmark || bookmark.length === 0) return;

  const b = bookmark[0];
  currentEditingBookmark = b;
  currentEditingParentId = b.parentId;

  if (b.url) {
    // It's a bookmark
    bookmarkEditDialogTitle.textContent = '编辑书签';
    bookmarkEditUrlField.style.display = 'block';
    bookmarkEditTitleInput.value = b.title || '';
    bookmarkEditUrlInput.value = b.url || '';
    bookmarkEditDeleteBtn.style.display = 'inline-block';
  } else {
    // It's a folder
    bookmarkEditDialogTitle.textContent = '编辑文件夹';
    bookmarkEditUrlField.style.display = 'none';
    bookmarkEditTitleInput.value = b.title || '';
    bookmarkEditDeleteBtn.style.display = 'inline-block';
  }

  bookmarkEditOverlay.classList.add('active');
}

// Create new folder
async function createNewFolder(parentId = null) {
  const defaultParent = bookmarkTreeRoot?.children?.find(c => !c.url) || bookmarkTreeRoot;
  const targetParentId = parentId || currentEditingBookmark?.id || defaultParent?.id || '1';

  // Open folder dialog instead of directly creating
  openFolderDialog(targetParentId);
}

// Create new bookmark
async function createNewBookmark(parentId = null) {
  const defaultParent = bookmarkTreeRoot?.children?.find(c => !c.url) || bookmarkTreeRoot;
  let targetParentId = parentId || currentEditingBookmark?.id || defaultParent?.id || '1';

  // If parentId is a bookmark (not a folder), get its parent folder instead
  if (parentId && !currentEditingBookmark?.isFolder) {
    try {
      const bookmark = await chrome.bookmarks.get(parentId);
      if (bookmark && bookmark.length > 0) {
        targetParentId = bookmark[0].parentId || targetParentId;
      }
    } catch (e) {
      console.error('Failed to get bookmark parent:', e);
    }
  }

  // Show edit dialog for new bookmark
  currentEditingBookmark = null;
  currentEditingParentId = targetParentId;

  bookmarkEditDialogTitle.textContent = '新建书签';
  bookmarkEditUrlField.style.display = 'block';
  bookmarkEditTitleInput.value = '';
  bookmarkEditUrlInput.value = '';
  bookmarkEditDeleteBtn.style.display = 'none';

  bookmarkEditOverlay.classList.add('active');
}

// Delete bookmark/folder
async function deleteBookmark(bookmarkId) {
  // Check if it's a folder
  const bookmark = await chrome.bookmarks.get(bookmarkId);
  if (!bookmark || bookmark.length === 0) return;

  const isFolder = !bookmark[0].url;
  const confirmMsg = isFolder
    ? '确定要删除此文件夹及其所有内容吗？此操作无法撤销。'
    : '确定要删除此书签吗？';

  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    if (isFolder) {
      // Use removeTree for folders (recursive delete)
      await chrome.bookmarks.removeTree(bookmarkId);
      showNotification('文件夹已删除');
    } else {
      await chrome.bookmarks.remove(bookmarkId);
      showNotification('书签已删除');
    }
    await loadBookmarks();
  } catch (error) {
    console.error('[书签] 删除失败:', error);
    showNotification('删除失败: ' + error.message);
  }
}

// Save bookmark changes
bookmarkEditSaveBtn?.addEventListener('click', async () => {
  const title = bookmarkEditTitleInput.value.trim();
  const url = bookmarkEditUrlInput.value.trim();

  if (!title) {
    showNotification('请输入标题');
    return;
  }

  try {
    if (currentEditingBookmark && currentEditingBookmark.id) {
      // Update existing bookmark/folder
      const updates = { title };
      if (currentEditingBookmark.url) {
        updates.url = url;
        if (!url) {
          showNotification('请输入网址');
          return;
        }
      }

      await chrome.bookmarks.update(currentEditingBookmark.id, updates);
      showNotification('已保存');
    } else {
      // Create new bookmark
      if (!url) {
        showNotification('请输入网址');
        return;
      }
      await chrome.bookmarks.create({
        parentId: currentEditingParentId || '1',
        title,
        url
      });
      showNotification('已创建');
    }

    bookmarkEditOverlay.classList.remove('active');
    await loadBookmarks();
  } catch (error) {
    console.error('[书签] 保存失败:', error);
    showNotification('保存失败: ' + error.message);
  }
});

// Cancel edit
bookmarkEditCancelBtn?.addEventListener('click', () => {
  bookmarkEditOverlay.classList.remove('active');
  currentEditingBookmark = null;
  currentEditingParentId = null;
});

// Delete button in edit dialog
bookmarkEditDeleteBtn?.addEventListener('click', async () => {
  if (currentEditingBookmark && currentEditingBookmark.id) {
    await deleteBookmark(currentEditingBookmark.id);
    bookmarkEditOverlay.classList.remove('active');
  }
});

// Close overlay when clicking outside
bookmarkEditOverlay?.addEventListener('click', (e) => {
  if (e.target === bookmarkEditOverlay) {
    bookmarkEditOverlay.classList.remove('active');
    currentEditingBookmark = null;
    currentEditingParentId = null;
  }
});

// ========== Folder Dialog Functionality ==========
const folderDialogOverlay = document.getElementById('folder-dialog-overlay');
const folderNameInput = document.getElementById('folder-name-input');
const folderDialogCancelBtn = document.getElementById('folder-dialog-cancel-btn');
const folderDialogCreateBtn = document.getElementById('folder-dialog-create-btn');

let currentFolderParentId = null;

// Open folder dialog
function openFolderDialog(parentId = null) {
  currentFolderParentId = parentId;
  folderNameInput.value = '';
  folderDialogOverlay.classList.add('active');
  folderNameInput.focus();
}

// Create folder from dialog
folderDialogCreateBtn?.addEventListener('click', async () => {
  const folderName = folderNameInput.value.trim();

  if (!folderName) {
    showNotification('请输入文件夹名称');
    folderNameInput.focus();
    return;
  }

  try {
    const defaultParent = bookmarkTreeRoot?.children?.find(c => !c.url) || bookmarkTreeRoot;
    const targetParentId = currentFolderParentId || defaultParent?.id || '1';

    await chrome.bookmarks.create({
      parentId: targetParentId,
      title: folderName
    });

    showNotification('文件夹已创建');
    folderDialogOverlay.classList.remove('active');
    await loadBookmarks();
  } catch (error) {
    console.error('[书签] 创建文件夹失败:', error);
    showNotification('创建失败: ' + error.message);
  }
});

// Cancel folder dialog
folderDialogCancelBtn?.addEventListener('click', () => {
  folderDialogOverlay.classList.remove('active');
  currentFolderParentId = null;
});

// Close folder dialog when clicking outside
folderDialogOverlay?.addEventListener('click', (e) => {
  if (e.target === folderDialogOverlay) {
    folderDialogOverlay.classList.remove('active');
    currentFolderParentId = null;
  }
});

// Handle Enter key in folder name input
folderNameInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    folderDialogCreateBtn.click();
  } else if (e.key === 'Escape') {
    folderDialogCancelBtn.click();
  }
});

// ========== Drag and Drop Functionality ==========
let draggedItem = null;
let draggedItemType = null; // 'bookmark' or 'folder'
let folderExpandTimer = null;
let hoveredFolder = null;

// Initialize drag and drop after bookmarks are loaded
function initDragAndDrop() {
  bookmarksList.addEventListener('dragstart', handleDragStart);
  bookmarksList.addEventListener('dragend', handleDragEnd);
  bookmarksList.addEventListener('dragover', handleDragOver);
  bookmarksList.addEventListener('dragleave', handleDragLeave);
  bookmarksList.addEventListener('drop', handleDrop);

  // Add hover detection for auto-expanding folders
  bookmarksList.addEventListener('dragenter', handleDragEnter);
}

function handleDragStart(e) {
  const dragHandle = e.target.closest('.bookmark-drag-handle');
  if (!dragHandle) return;

  const target = dragHandle.closest('.bookmark-item, .bookmark-folder');
  if (!target) return;

  draggedItem = target;
  draggedItemType = target.classList.contains('bookmark-folder') ? 'folder' : 'bookmark';

  target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', target.dataset.id);

  // Store additional info
  e.dataTransfer.setData('drag-type', draggedItemType);

  // Create custom drag image with better styling
  const dragImage = document.createElement('div');
  dragImage.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    padding: 10px 14px;
    background: #252526;
    border: 2px solid #007acc;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 122, 204, 0.4);
    color: #d4d4d4;
    font-size: 13px;
    font-family: "Segoe UI", sans-serif;
    z-index: 10000;
    max-width: 300px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `;

  const icon = draggedItemType === 'folder' ? '📁' : '🔖';
  const title = target.querySelector('.bookmark-title, .bookmark-folder-name')?.textContent || '未命名';

  dragImage.innerHTML = `<span style="margin-right: 8px;">${icon}</span><span>${escapeHtml(title)}</span>`;
  document.body.appendChild(dragImage);

  e.dataTransfer.setDragImage(dragImage, 20, 20);
  setTimeout(() => document.body.removeChild(dragImage), 0);
}

function handleDragEnd(e) {
  if (draggedItem) {
    draggedItem.classList.remove('dragging');
    draggedItem = null;
    draggedItemType = null;
  }

  // Clear folder expand timer
  if (folderExpandTimer) {
    clearTimeout(folderExpandTimer);
    folderExpandTimer = null;
  }
  hoveredFolder = null;

  // Remove all drag-related classes
  bookmarksList.querySelectorAll('.dragging, .drag-over, .drag-over-folder, .drag-over-reorder').forEach(el => {
    el.classList.remove('dragging', 'drag-over', 'drag-over-folder', 'drag-over-reorder');
  });

  // Remove all drop indicators
  bookmarksList.querySelectorAll('.drop-indicator').forEach(el => {
    el.remove();
  });
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const target = e.target.closest('.bookmark-item, .bookmark-folder');
  if (!target || target === draggedItem) return;

  // Check if target is a descendant of dragged item
  if (draggedItem && draggedItem.contains(target)) {
    return;
  }

  // Remove all previous drag states
  bookmarksList.querySelectorAll('.drag-over, .drag-over-folder, .drag-over-reorder').forEach(el => {
    el.classList.remove('drag-over', 'drag-over-folder', 'drag-over-reorder');
  });

  // Remove previous drop indicators
  bookmarksList.querySelectorAll('.drop-indicator').forEach(el => {
    el.remove();
  });

  // Determine drop position with improved detection
  const rect = target.getBoundingClientRect();
  const relativeY = (e.clientY - rect.top) / rect.height;
  const relativeX = (e.clientX - rect.left) / rect.width;

  // Clear zone detection with more precise thresholds
  const isTop = relativeY < 0.2;
  const isBottom = relativeY > 0.8;
  const isMiddle = !isTop && !isBottom;
  const isCenterX = relativeX >= 0.25 && relativeX <= 0.75;

  // Check for keyboard modifiers
  const ctrlKey = e.ctrlKey || e.metaKey;

  if (target.classList.contains('bookmark-folder')) {
    // Target is a folder
    if (target.classList.contains('collapsed')) {
      // Collapsed folder
      if (isMiddle && isCenterX && !ctrlKey) {
        // Center area - drop into folder (with auto-expand)
        target.classList.add('drag-over-folder');
      } else {
        // Edges or ctrl key - reorder
        target.classList.add('drag-over-reorder');
        showDropIndicator(target, isTop ? 'before' : 'after');
      }
    } else {
      // Expanded folder
      if (isMiddle && isCenterX && !ctrlKey) {
        // Center area - drop into folder
        target.classList.add('drag-over-folder');
      } else {
        // Edges or ctrl key - reorder
        target.classList.add('drag-over-reorder');
        showDropIndicator(target, isTop ? 'before' : 'after');
      }
    }
  } else {
    // Target is a bookmark - always show reorder state
    target.classList.add('drag-over');
    // No indicator needed for bookmarks, the border is enough
  }
}

// Helper function to show drop indicator
function showDropIndicator(target, position) {
  // Remove existing indicators
  bookmarksList.querySelectorAll('.drop-indicator').forEach(el => el.remove());

  const indicator = document.createElement('div');
  indicator.className = `drop-indicator drop-indicator-${position}`;

  if (position === 'before') {
    target.parentNode.insertBefore(indicator, target);
  } else {
    target.parentNode.insertBefore(indicator, target.nextSibling);
  }
}

function handleDragLeave(e) {
  const target = e.target.closest('.bookmark-item, .bookmark-folder');
  if (target && !bookmarksList.contains(e.relatedTarget)) {
    target.classList.remove('drag-over', 'drag-over-folder', 'drag-over-reorder');
  }

  // Clear folder expand timer if leaving
  if (hoveredFolder && folderExpandTimer) {
    clearTimeout(folderExpandTimer);
    folderExpandTimer = null;
  }
}

// Handle drag enter for auto-expand folders
function handleDragEnter(e) {
  const folder = e.target.closest('.bookmark-folder');

  // Clear previous timer
  if (folderExpandTimer) {
    clearTimeout(folderExpandTimer);
    folderExpandTimer = null;
  }

  // If hovering over a collapsed folder, set timer to auto-expand
  if (folder && folder.classList.contains('collapsed') && draggedItem && !folder.contains(draggedItem)) {
    hoveredFolder = folder;
    folderExpandTimer = setTimeout(() => {
      // Auto-expand the folder
      folder.classList.remove('collapsed');
      const children = folder.querySelector('.bookmark-children');
      if (children) {
        children.classList.remove('hidden');
      }

      // Update the icon
      const icon = folder.querySelector('.bookmark-folder-icon');
      if (icon) icon.textContent = '▼';

      // Clear hover state
      hoveredFolder = null;
      folderExpandTimer = null;
    }, 800); // Auto-expand after 800ms of hovering
  }
}

async function handleDrop(e) {
  e.preventDefault();

  const target = e.target.closest('.bookmark-item, .bookmark-folder');
  if (!target || !draggedItem || target === draggedItem) return;

  // Check if target is a descendant of dragged item
  if (draggedItem.contains(target)) {
    showNotification('不能将文件夹移动到其子文件夹中');
    return;
  }

  const draggedId = draggedItem.dataset.id;
  const targetId = target.dataset.id;

  try {
    // Get target's info from tree
    const targetNode = await findBookmarkNodeInTree(targetId);
    if (!targetNode) {
      showNotification('找不到目标书签');
      return;
    }

    // Improved position detection - must match handleDragOver thresholds
    const rect = target.getBoundingClientRect();
    const relativeY = (e.clientY - rect.top) / rect.height;
    const relativeX = (e.clientX - rect.left) / rect.width;

    // Clearer zone detection - same as handleDragOver
    const isTop = relativeY < 0.2;
    const isBottom = relativeY > 0.8;
    const isMiddle = !isTop && !isBottom;
    const isCenterX = relativeX >= 0.25 && relativeX <= 0.75;

    const ctrlKey = e.ctrlKey || e.metaKey;

    if (target.classList.contains('bookmark-folder')) {
      // Target is a folder
      if (isMiddle && isCenterX && !ctrlKey && !target.classList.contains('collapsed')) {
        // Drop INTO the expanded folder (center, no modifiers)
        await chrome.bookmarks.move(draggedId, { parentId: targetId });
        showNotification('已移动到文件夹');
      } else if (isMiddle && ctrlKey) {
        // Ctrl + middle = insert at beginning of folder
        await chrome.bookmarks.move(draggedId, { parentId: targetId, index: 0 });
        showNotification('已移动到文件夹顶部');
      } else {
        // Edges or ctrl key - reorder at parent level
        const parentContainer = target.closest('.bookmark-children') || bookmarksList;
        const parentFolder = target.closest('.bookmark-folder');

        // Get all siblings at this level
        const siblings = Array.from(parentContainer.children)
          .filter(el => el.classList.contains('bookmark-item') || el.classList.contains('bookmark-folder'));

        let targetIndex = siblings.indexOf(target);

        await chrome.bookmarks.move(draggedId, {
          parentId: parentFolder?.dataset.id || targetNode.parentId,
          index: isTop ? targetIndex : targetIndex + 1
        });
        showNotification('已重新排序');
      }
    } else {
      // Target is a bookmark
      const parentContainer = target.closest('.bookmark-children') || bookmarksList;
      const parentFolder = target.closest('.bookmark-folder');

      const siblings = Array.from(parentContainer.children)
        .filter(el => el.classList.contains('bookmark-item') || el.classList.contains('bookmark-folder'));

      let targetIndex = siblings.indexOf(target);

      await chrome.bookmarks.move(draggedId, {
        parentId: parentFolder?.dataset.id || targetNode.parentId,
        index: isTop ? targetIndex : targetIndex + 1
      });
      showNotification('已重新排序');
    }

    await loadBookmarks();
  } catch (error) {
    console.error('[书签] 移动失败:', error);
    showNotification('移动失败: ' + error.message);
  }

  // Cleanup
  handleDragEnd(e);
}

// Helper function to find bookmark node in tree
async function findBookmarkNodeInTree(id) {
  const tree = await chrome.bookmarks.getTree();

  function findNode(node, targetId) {
    if (node.id === targetId) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, targetId);
        if (found) return found;
      }
    }
    return null;
  }

  return findNode(tree[0], id);
}

// Initialize drag and drop when bookmarks are loaded
const originalLoadBookmarks = loadBookmarks;
loadBookmarks = async function () {
  await originalLoadBookmarks.call(this);
  initDragAndDrop();
};

// ============================================
// History Tab Functionality
// ============================================
const historyList = document.getElementById('history-list');
const historySearchInput = document.getElementById('history-search-input');
const historyTimeRange = document.getElementById('history-time-range');
const historyCount = document.getElementById('history-count');
const historyRefreshBtn = document.getElementById('history-refresh-btn');
const historyClearBtn = document.getElementById('history-clear-btn');

let allHistory = [];
let filteredHistory = [];

// Get time range in milliseconds since epoch
function getHistoryTimeRange(rangeType) {
  const now = Date.now();
  const ranges = {
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
    all: 0
  };

  const duration = ranges[rangeType] || 0;
  return duration === 0 ? 0 : now - duration;
}

// Load history from chrome.history API
async function loadHistory() {
  if (!historyList) return;

  historyList.innerHTML = '<div class="history-loading">加载中...</div>';
  console.log('[历史] 开始加载...');

  try {
    // Check if history API is available
    if (!chrome.history) {
      throw new Error('chrome.history API 不可用，请重新加载扩展');
    }

    const timeRange = historyTimeRange ? historyTimeRange.value : 'day';
    const since = getHistoryTimeRange(timeRange);
    console.log('[历史] 时间范围:', timeRange, 'since:', since);

    const results = await chrome.history.search({
      text: '',
      maxResults: 10000,
      startTime: since
    });

    console.log('[历史] 获取到历史记录数量:', results.length);

    allHistory = results;
    filteredHistory = results;
    renderHistory(results);
  } catch (error) {
    console.error('[历史] 加载失败:', error);
    historyList.innerHTML = '<div class="history-empty"><div class="icon">⚠️</div><div>加载失败: ' + error.message + '</div></div>';
  }
}

// Render history list grouped by date
function renderHistory(historyItems) {
  if (!historyList) return;

  if (historyItems.length === 0) {
    historyList.innerHTML = '<div class="history-empty"><div class="icon">📭</div><div>暂无历史记录</div></div>';
    if (historyCount) historyCount.textContent = '0 条记录';
    return;
  }

  if (historyCount) historyCount.textContent = `${historyItems.length} 条记录`;

  // Group by date
  const grouped = groupHistoryByDate(historyItems);

  let html = '';
  for (const [date, items] of Object.entries(grouped)) {
    html += `<div class="history-date-group">${date}</div>`;
    html += items.map(item => {
      const faviconUrl = getFaviconUrl(item.url);
      const time = new Date(item.lastVisitTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      const visitCount = item.visitCount > 1 ? ` · ${item.visitCount} 次` : '';

      return `
        <div class="history-item" data-url="${escapeHtml(item.url)}" data-id="${item.id}">
          <div class="history-favicon">
            ${faviconUrl ? `<img src="${faviconUrl}" onerror="this.parentElement.innerHTML='<div class=\\'fallback\\'>🔗</div>'">` : '<div class="fallback">🔗</div>'}
          </div>
          <div class="history-info">
            <div class="history-title" title="${escapeHtml(item.title)}">${escapeHtml(item.title) || '无标题'}</div>
            <div class="history-url" title="${escapeHtml(item.url)}">${escapeHtml(item.url)}</div>
          </div>
          <div class="history-time">${time}${visitCount}</div>
        </div>
      `;
    }).join('');
  }

  historyList.innerHTML = html;
}

// Group history items by date
function groupHistoryByDate(items) {
  const grouped = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 86400000;
  const thisWeek = today - 6 * 86400000;

  for (const item of items) {
    const itemTime = item.lastVisitTime;
    let dateLabel;

    if (itemTime >= today) {
      dateLabel = '今天';
    } else if (itemTime >= yesterday) {
      dateLabel = '昨天';
    } else if (itemTime >= thisWeek) {
      dateLabel = '本周';
    } else {
      const itemDate = new Date(itemTime);
      dateLabel = itemDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' });
    }

    if (!grouped[dateLabel]) {
      grouped[dateLabel] = [];
    }
    grouped[dateLabel].push(item);
  }

  return grouped;
}

// Search history
function searchHistory(query) {
  if (!query) {
    filteredHistory = allHistory;
    renderHistory(allHistory);
    return;
  }

  const lowerQuery = query.toLowerCase();
  filteredHistory = allHistory.filter(item =>
    item.title.toLowerCase().includes(lowerQuery) ||
    item.url.toLowerCase().includes(lowerQuery)
  );

  renderHistory(filteredHistory);
}

// Clear all history
async function clearAllHistory() {
  if (!confirm('确定要清空所有浏览历史吗？\n此操作无法撤销。')) {
    return;
  }

  try {
    await chrome.history.deleteAll();
    allHistory = [];
    filteredHistory = [];
    renderHistory([]);
    showNotification('历史记录已清空');
  } catch (error) {
    console.error('[历史] 清空失败:', error);
    showNotification('清空失败: ' + error.message);
  }
}

// History event listeners
if (historyRefreshBtn) {
  historyRefreshBtn.addEventListener('click', loadHistory);
}

if (historyClearBtn) {
  historyClearBtn.addEventListener('click', clearAllHistory);
}

if (historyTimeRange) {
  historyTimeRange.addEventListener('change', loadHistory);
}

if (historySearchInput) {
  let searchTimeout;
  historySearchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      searchHistory(e.target.value);
    }, 200);
  });
}

// History click handler - open in new tab
historyList?.addEventListener('click', (e) => {
  const item = e.target.closest('.history-item');
  if (item) {
    const url = item.dataset.url;
    if (url) {
      chrome.tabs.create({ url });
    }
  }
});
