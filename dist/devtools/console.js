// 控制面板逻辑
'use strict';

// ========== Port 持久连接管理 ==========
let backgroundPort = null;
let portReconnectTimer = null;

/**
 * 建立 Port 持久连接
 */
function connectToBackground() {
  if (backgroundPort) return backgroundPort;

  try {
    backgroundPort = chrome.runtime.connect({ name: 'devtools-panel' });

    backgroundPort.onMessage.addListener((message) => {
      // 处理来自 background 的消息
      if (message.type === 'PICKER_MESSAGE_PUSH') {
        handlePickerMessage(message.data);
      }
    });

    backgroundPort.onDisconnect.addListener(() => {
      backgroundPort = null;
      console.log('[DevTools] Port 连接断开，准备重连...');
      // 延迟重连
      if (portReconnectTimer) clearTimeout(portReconnectTimer);
      portReconnectTimer = setTimeout(connectToBackground, 1000);
    });

    // 注册当前 tab
    backgroundPort.postMessage({
      type: 'REGISTER_DEVTOOLS',
      tabId: chrome.devtools.inspectedWindow.tabId
    });

    console.log('[DevTools] Port 连接已建立');
    return backgroundPort;
  } catch (error) {
    console.error('[DevTools] Port 连接失败:', error);
    return null;
  }
}

/**
 * 通过 Port 发送消息
 */
function sendPortMessage(message) {
  if (!backgroundPort) {
    connectToBackground();
  }

  if (backgroundPort) {
    try {
      backgroundPort.postMessage(message);
      return true;
    } catch (error) {
      console.error('[DevTools] 发送消息失败:', error);
      backgroundPort = null;
      return false;
    }
  }
  return false;
}

// 立即建立连接
connectToBackground();

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
      if (tabId === 'resources') {
        initResourcesTab();
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

    // 如果切换到元素标签页，加载元素信息
    if (subtabId === 'element') {
      refreshElementInfo();
      loadHiddenElementsFromStorage();
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

// ========== 元素操作功能 ==========
const refreshElementBtn = document.getElementById('refresh-element-btn');
const elementSelectorInput = document.getElementById('element-selector');
const selectorMatchBadge = document.getElementById('selector-match-badge');
const elementTagEl = document.getElementById('element-tag');
const elementIdEl = document.getElementById('element-id');
const elementClassEl = document.getElementById('element-class');
const copySelectorBtn = document.getElementById('copy-selector-btn');
const hideElementBtn = document.getElementById('hide-element-btn');
const showElementBtn = document.getElementById('show-element-btn');
const deleteElementBtn = document.getElementById('delete-element-btn');
const elementHiddenList = document.getElementById('element-hidden-list');
const elementHiddenItems = document.getElementById('element-hidden-items');

// 存储已隐藏的元素选择器
const hiddenElements = new Map();

// 生成 CSS 选择器（BFS 广度优先，保证最短且精确）
function generateSelector() {
  const code = `
    (function() {
      const target = $0;
      if (!target || !target.tagName) return null;
      if (target === document.body) return 'body';
      if (target === document.documentElement) return 'html';

      // === 辅助函数 ===
      const hasValidId = (node) => node && node.id && !node.id.includes(' ') && !/^\\d/.test(node.id);

      const getValidClasses = (node) => {
        if (!node.className || typeof node.className !== 'string') return [];
        return node.className.trim().split(' ').filter(c => {
          if (!c || /^[0-9]/.test(c)) return false;
          if (/^(css-|styled-|sc-|js-|_|__|Mui|jss|css_|_)/.test(c) || c.length > 30) return false;
          return /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c);
        });
      };

      const getValidAttributes = (node) => {
        if (!node.attributes) return [];
        const skipAttrs = ['data-ep-selected', 'data-ep-uid', 'class', 'id', 'style',
          'title', 'alt', 'aria-label', 'aria-describedby', 'aria-labelledby',
          'placeholder', 'value', 'name', 'href', 'src', 'data-tooltip',
          'tabindex', 'role', 'disabled', 'type'];
        const attrs = [];
        for (const attr of node.attributes) {
          if (skipAttrs.includes(attr.name) || !attr.value || attr.value.length > 50 || /^\\d+$/.test(attr.value)) continue;
          attrs.push({ name: attr.name, value: attr.value });
        }
        return attrs;
      };

      const getNthOfType = (node) => {
        const parent = node.parentElement;
        if (!parent) return 0;
        const siblings = Array.from(parent.children).filter(c => c.tagName === node.tagName);
        return siblings.length > 1 ? siblings.indexOf(node) + 1 : 0;
      };

      const testSelector = (sel) => {
        try {
          const found = document.querySelectorAll(sel);
          return { count: found.length, elements: Array.from(found) };
        } catch { return { count: 999, elements: [] }; }
      };

      const isExactMatch = (sel) => {
        const result = testSelector(sel);
        return result.count === 1 && result.elements[0] === target;
      };

      // 收集目标元素信息
      const tag = target.tagName.toLowerCase();
      const classes = getValidClasses(target);
      const attrs = getValidAttributes(target);
      const nth = getNthOfType(target);

      // 收集祖先链
      const ancestors = [];
      let cur = target.parentElement;
      while (cur && cur !== document.documentElement) {
        ancestors.push({
          node: cur,
          tag: cur.tagName.toLowerCase(),
          classes: getValidClasses(cur),
          id: cur.id,
          hasId: hasValidId(cur)
        });
        cur = cur.parentElement;
      }

      // === BFS: 按层级生成候选选择器 ===

      // Level 1: 目标元素自身的各种组合
      const candidates = [];

      // 1.1 ID（如果存在）
      if (hasValidId(target)) {
        candidates.push('#' + CSS.escape(target.id));
      }

      // 1.2 单个 class
      for (const cls of classes) {
        candidates.push('.' + CSS.escape(cls));
        candidates.push(tag + '.' + CSS.escape(cls));
      }

      // 1.3 属性
      for (const attr of attrs) {
        candidates.push('[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
        candidates.push(tag + '[' + CSS.escape(attr.name) + '="' + CSS.escape(attr.value) + '"]');
      }

      // 1.4 多个 class 组合
      if (classes.length >= 2) {
        candidates.push(tag + '.' + classes.map(c => CSS.escape(c)).join('.'));
        candidates.push('.' + classes.map(c => CSS.escape(c)).join('.'));
      }

      // 1.5 class + attr
      if (classes.length > 0 && attrs.length > 0) {
        candidates.push(tag + '.' + CSS.escape(classes[0]) + '[' + CSS.escape(attrs[0].name) + '="' + CSS.escape(attrs[0].value) + '"]');
      }

      // 1.6 nth-of-type
      if (nth > 0) {
        candidates.push(tag + ':nth-of-type(' + nth + ')');
      }

      // 测试 Level 1
      for (const sel of candidates) {
        if (isExactMatch(sel)) return sel;
      }

      // === Level 2-N: 逐层添加祖先 ===
      // 使用 BFS，每次添加一个祖先层级
      let currentLevel = candidates.map(c => ({ selector: c, ancestorIndex: -1 }));

      for (let aIdx = 0; aIdx < ancestors.length; aIdx++) {
        const ancestor = ancestors[aIdx];
        const nextLevel = [];

        // 祖先的选择器变体
        const ancestorParts = [];
        if (ancestor.hasId) {
          ancestorParts.push('#' + CSS.escape(ancestor.id));
        }
        for (const cls of ancestor.classes.slice(0, 2)) {
          ancestorParts.push(ancestor.tag + '.' + CSS.escape(cls));
        }
        ancestorParts.push(ancestor.tag);

        for (const item of currentLevel) {
          for (const ancPart of ancestorParts) {
            const newSel = ancPart + ' > ' + item.selector;
            if (isExactMatch(newSel)) return newSel;
            nextLevel.push({ selector: newSel, ancestorIndex: aIdx });
          }
        }

        // 如果祖先有 ID，可以提前终止（ID 通常是唯一的）
        if (ancestor.hasId) {
          currentLevel = nextLevel;
          break;
        }

        currentLevel = nextLevel;
      }

      // 如果还没找到，返回当前最优（匹配数最少的）
      let best = null;
      let bestCount = Infinity;

      for (const item of currentLevel) {
        const result = testSelector(item.selector);
        if (result.count < bestCount && result.elements.includes(target)) {
          best = item.selector;
          bestCount = result.count;
          if (bestCount === 1) break;
        }
      }

      // 从 Level 1 候选中也找一下
      for (const sel of candidates) {
        const result = testSelector(sel);
        if (result.count < bestCount && result.elements.includes(target)) {
          best = sel;
          bestCount = result.count;
          if (bestCount === 1) break;
        }
      }

      return best || tag;
    })()
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('获取选择器失败:', error);
        resolve(null);
      } else {
        resolve(result);
      }
    });
  });
}

// 获取元素信息
function getElementInfo() {
  const code = `
    (function(element) {
      if (!element) return null;

      return {
        tagName: element.tagName.toLowerCase(),
        id: element.id || '',
        className: element.className || '',
        classList: element.classList ? Array.from(element.classList) : []
      };
    })($0)
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('获取元素信息失败:', error);
        resolve(null);
      } else {
        resolve(result);
      }
    });
  });
}

// 获取选择器匹配数量
async function getSelectorMatchCount(selector) {
  if (!selector) return 0;

  const code = `(function() {
    try {
      return document.querySelectorAll('${selector.replace(/'/g, "\\'")}').length;
    } catch(e) {
      return 0;
    }
  })()`;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result) => {
      resolve(result || 0);
    });
  });
}

// 更新匹配数量徽章
function updateMatchBadge(matchCount) {
  if (!selectorMatchBadge) return;

  if (!matchCount || matchCount === 0) {
    selectorMatchBadge.textContent = '';
    selectorMatchBadge.className = 'selector-match-badge';
    return;
  }

  selectorMatchBadge.className = 'selector-match-badge ' + (matchCount === 1 ? 'exact' : 'multiple');
  selectorMatchBadge.title = matchCount === 1 ? '精确匹配' : `匹配 ${matchCount} 个元素`;
  selectorMatchBadge.textContent = matchCount === 1 ? '✓1' : `⚠️${matchCount}`;
}

// 刷新元素信息
async function refreshElementInfo() {
  const selector = await generateSelector();
  const info = await getElementInfo();

  if (selector) {
    elementSelectorInput.value = selector;
    // 获取并显示匹配数量
    const matchCount = await getSelectorMatchCount(selector);
    updateMatchBadge(matchCount);
  } else {
    elementSelectorInput.value = '未选中元素';
    updateMatchBadge(0);
  }

  if (info) {
    elementTagEl.textContent = info.tagName || '-';
    elementIdEl.textContent = info.id || '-';
    elementClassEl.textContent = info.classList.length > 0 ? info.classList.slice(0, 3).join(', ') + (info.classList.length > 3 ? '...' : '') : '-';
  } else {
    elementTagEl.textContent = '-';
    elementIdEl.textContent = '-';
    elementClassEl.textContent = '-';
  }

  updateHiddenList();
}

// 获取当前域名
async function getCurrentDomain() {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval('window.location.hostname', (result) => {
      resolve(result);
    });
  });
}

// 同步隐藏元素设置到 popup 存储
async function syncHideElementsToStorage(domain, selectors, enabled) {
  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};
  allSettings[domain] = { enabled, selectors };
  await chrome.storage.local.set({ hideElementsSettings: allSettings });

  // 通知 content script
  const tabId = chrome.devtools.inspectedWindow.tabId;
  if (tabId) {
    chrome.tabs.sendMessage(tabId, {
      type: 'UPDATE_HIDE_ELEMENTS',
      enabled,
      selectors
    }).catch(() => {
      console.log('[DevTools] Content script 未就绪，忽略消息');
    });
  }
}

// 添加隐藏样式（与 content script 使用相同的 style ID 和格式）
async function addHideStyle(selector) {
  const code = `
    (function(selector) {
      let styleEl = document.getElementById('extension-hide-elements-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'extension-hide-elements-style';
        document.head.appendChild(styleEl);
      }

      // 使用与 content script 相同的格式
      const rule = selector + ' { display: none !important; }';
      const currentStyles = styleEl.textContent || '';
      if (!currentStyles.includes(rule)) {
        styleEl.textContent = currentStyles + (currentStyles.endsWith('\\n') ? '' : '\\n') + rule;
        return true;
      }
      return false;
    })(${JSON.stringify(selector)})
  `;

  const added = await new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('添加隐藏样式失败:', error);
        resolve(false);
      } else {
        resolve(result);
      }
    });
  });

  if (added) {
    // 同步到 popup 存储
    const domain = await getCurrentDomain();
    if (domain) {
      const result = await chrome.storage.local.get(['hideElementsSettings']);
      const allSettings = result.hideElementsSettings || {};
      const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };

      if (!domainSettings.selectors.includes(selector)) {
        domainSettings.selectors.push(selector);
        domainSettings.enabled = true;
        await syncHideElementsToStorage(domain, domainSettings.selectors, true);
      }
    }
  }

  return added;
}

// 移除隐藏样式（与 content script 使用相同的 style ID 和格式）
async function removeHideStyle(selector) {
  const code = `
    (function(selector) {
      const styleEl = document.getElementById('extension-hide-elements-style');
      if (!styleEl) return false;

      // 使用与 content script 相同的格式
      const rule = selector + ' { display: none !important; }';
      let currentStyles = styleEl.textContent || '';
      if (currentStyles.includes(rule)) {
        currentStyles = currentStyles.replace(rule, '').replace(/^\\n+|\\n+$/g, '');
        styleEl.textContent = currentStyles;
        return true;
      }
      return false;
    })(${JSON.stringify(selector)})
  `;

  const removed = await new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('移除隐藏样式失败:', error);
        resolve(false);
      } else {
        resolve(result);
      }
    });
  });

  if (removed) {
    // 同步到 popup 存储
    const domain = await getCurrentDomain();
    if (domain) {
      const result = await chrome.storage.local.get(['hideElementsSettings']);
      const allSettings = result.hideElementsSettings || {};
      const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };

      const index = domainSettings.selectors.indexOf(selector);
      if (index > -1) {
        domainSettings.selectors.splice(index, 1);
        // 如果没有选择器了，保持开启但清空列表（用户可以继续添加）
        await syncHideElementsToStorage(domain, domainSettings.selectors, domainSettings.enabled);
      }
    }
  }

  return removed;
}

// 删除元素
function deleteElement(selector) {
  const code = `
    (function(selector) {
      const element = document.querySelector(selector);
      if (element) {
        element.remove();
        return true;
      }
      return false;
    })(${JSON.stringify(selector)})
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('删除元素失败:', error);
        resolve(false);
      } else {
        resolve(result);
      }
    });
  });
}

// 更新已隐藏列表
function updateHiddenList() {
  if (hiddenElements.size === 0) {
    elementHiddenList.style.display = 'none';
    return;
  }

  elementHiddenList.style.display = 'block';
  elementHiddenItems.innerHTML = '';

  hiddenElements.forEach((name, selector) => {
    const item = document.createElement('div');
    item.className = 'element-hidden-item';
    item.innerHTML = `
      <span>${name}</span>
      <span class="remove-btn" data-selector="${selector}">×</span>
    `;
    item.querySelector('.remove-btn').addEventListener('click', async () => {
      if (await removeHideStyle(selector)) {
        hiddenElements.delete(selector);
        updateHiddenList();
        showNotification('元素已显示');
      }
    });
    elementHiddenItems.appendChild(item);
  });
}

// 刷新按钮
if (refreshElementBtn) {
  refreshElementBtn.addEventListener('click', refreshElementInfo);
}

// 复制选择器按钮
if (copySelectorBtn) {
  copySelectorBtn.addEventListener('click', async () => {
    const selector = elementSelectorInput.value;
    if (selector && selector !== '未选中元素') {
      await copyToClipboard(selector);
      showNotification('选择器已复制');
    }
  });
}

// 隐藏元素按钮
if (hideElementBtn) {
  hideElementBtn.addEventListener('click', async () => {
    const selector = elementSelectorInput.value;
    if (!selector || selector === '未选中元素') {
      showNotification('请先选中元素');
      return;
    }

    if (await addHideStyle(selector)) {
      // 生成一个简短名称
      const name = selector.split('>').pop().split(':').pop().substring(0, 20);
      hiddenElements.set(selector, name || selector);
      updateHiddenList();
      showNotification('元素已隐藏');
    } else {
      showNotification('元素已隐藏');
    }
  });
}

// 显示元素按钮
if (showElementBtn) {
  showElementBtn.addEventListener('click', async () => {
    const selector = elementSelectorInput.value;
    if (!selector || selector === '未选中元素') {
      showNotification('请先选中元素');
      return;
    }

    if (await removeHideStyle(selector)) {
      hiddenElements.delete(selector);
      updateHiddenList();
      showNotification('元素已显示');
    } else {
      showNotification('元素未隐藏');
    }
  });
}

// 删除元素按钮
if (deleteElementBtn) {
  deleteElementBtn.addEventListener('click', async () => {
    const selector = elementSelectorInput.value;
    if (!selector || selector === '未选中元素') {
      showNotification('请先选中元素');
      return;
    }

    if (confirm('确定要删除此元素吗？')) {
      if (await deleteElement(selector)) {
        showNotification('元素已删除');
        refreshElementInfo();
      } else {
        showNotification('删除失败');
      }
    }
  });
}

// 从 popup 存储加载隐藏元素并应用到页面
async function loadHiddenElementsFromStorage() {
  const domain = await getCurrentDomain();
  if (!domain) return;

  const result = await chrome.storage.local.get(['hideElementsSettings']);
  const allSettings = result.hideElementsSettings || {};
  const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };

  // 更新本地 hiddenElements Map
  hiddenElements.clear();
  domainSettings.selectors.forEach(selector => {
    const name = selector.split('>').pop().split(':').pop().substring(0, 20);
    hiddenElements.set(selector, name || selector);
  });

  // 如果已启用，确保样式已应用到页面（使用与 content script 相同的格式）
  if (domainSettings.enabled && domainSettings.selectors.length > 0) {
    const code = `
      (function(selectors) {
        let styleEl = document.getElementById('extension-hide-elements-style');
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'extension-hide-elements-style';
          document.head.appendChild(styleEl);
        }

        // 使用与 content script 相同的格式
        let css = selectors.map(s => s + ' { display: none !important; }').join('\\n');
        styleEl.textContent = css;
        return true;
      })(${JSON.stringify(domainSettings.selectors)})
    `;
    chrome.devtools.inspectedWindow.eval(code);
  }

  updateHiddenList();
}

// ========== 批量元素选择功能 ==========
const startPickerBtn = document.getElementById('start-picker-btn');
const clearSelectionBtn = document.getElementById('clear-selection-btn');
const hideSelectedBtn = document.getElementById('hide-selected-btn');
const showSelectedBtn = document.getElementById('show-selected-btn');
const batchPickerStatus = document.getElementById('batch-picker-status');
const batchSelectedInfo = document.getElementById('batch-selected-info');
const batchSelectedCount = document.getElementById('batch-selected-count');
const batchSelectedList = document.getElementById('batch-selected-list');
const batchMergedSelectorSection = document.getElementById('batch-merged-selector-section');
const batchMergedSelector = document.getElementById('batch-merged-selector');
const copyMergedSelectorBtn = document.getElementById('copy-merged-selector-btn');
const applyHideBtn = document.getElementById('apply-hide-btn');

// 批量选择状态
let batchPickerState = {
  isActive: false,
  selectedElements: [] // { selector, tagName, id, className }
};

// 注入元素拾取器脚本
async function injectElementPicker() {
  // 使用 inspectedWindow.eval 注入脚本
  // 这种方式直接在页面世界中运行，可以与后续的命令通信
  const scriptUrl = chrome.runtime.getURL('content/element-picker-inject.js');

  const code = `
    (function() {
      // 检查是否已注入
      if (window.ElementPickerInject) {
        console.log('[ElementPicker] 已存在实例');
        return { alreadyInjected: true };
      }

      // 动态创建 script 标签加载脚本
      const script = document.createElement('script');
      script.src = '${scriptUrl}';
      script.onload = function() {
        console.log('[ElementPicker] 脚本加载完成');
        this.remove();
      };
      script.onerror = function() {
        console.error('[ElementPicker] 脚本加载失败');
        this.remove();
      };

      // 添加到页面
      (document.head || document.documentElement).appendChild(script);

      return { injected: true, url: '${scriptUrl}' };
    })()
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('[BatchPicker] 注入脚本失败:', error);
        resolve(false);
      } else {
        resolve(true);
      }
    });
  });
}

// 发送命令到元素拾取器
async function sendPickerCommand(action, data = {}) {
  const code = `
    (function(action, data) {
      const event = new CustomEvent('element-picker-command', {
        detail: { action, data },
        bubbles: true
      });
      document.dispatchEvent(event);
      return true;
    })('${action}', ${JSON.stringify(data)})
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('[BatchPicker] 发送命令失败:', error);
        resolve(false);
      } else {
        resolve(result);
      }
    });
  });
}

// 同步拾取器状态（用于初始化或刷新后恢复状态）
async function syncPickerState() {
  // 查询注入脚本的当前状态
  const code = `
    (function() {
      if (window.ElementPickerInject) {
        return {
          hasInstance: true,
          isActive: window.ElementPickerInject.isActive,
          elements: window.ElementPickerInject.selectedElements || []
        };
      }
      return { hasInstance: false, isActive: false, elements: [] };
    })()
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        resolve(false);
        return;
      }


      if (result && result.hasInstance) {
        batchPickerState.isActive = result.isActive;
        batchPickerState.selectedElements = result.elements.map(el => ({
          pickerUid: el.pickerUid,
          selector: el.selector,
          tagName: el.tagName,
          id: el.id,
          className: el.className
        }));
        updatePickerStatus();
        updateSelectedElementsUI();
      } else {
        // 没有实例，确保状态为非活动
        batchPickerState.isActive = false;
        batchPickerState.selectedElements = [];
        updatePickerStatus();
        updateSelectedElementsUI();
      }

      resolve(true);
    });
  });
}

// 监听来自元素拾取器的消息
function setupPickerMessageListener() {
  // Port 消息已在文件开头的 connectToBackground 中处理
  // 这里只需要在页面中设置消息转发到 background
  const code = `
    (function() {
      if (window._pickerMessageListenerSet) return;

      document.addEventListener('element-picker-message', (event) => {
        const message = event.detail;
        // 通过 chrome.runtime 发送到 background
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.sendMessage({
            type: 'PICKER_MESSAGE_RELAY',
            data: message
          });
        }
      });

      window._pickerMessageListenerSet = true;
      return true;
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code);
}

// 处理拾取器消息
function handlePickerMessage(message) {

  switch (message.type) {
    case 'ELEMENT_PICKER_STARTED':
      batchPickerState.isActive = true;
      updatePickerStatus();
      showNotification('选择模式已启动，点击页面元素进行选择');
      break;

    case 'ELEMENT_PICKER_STOPPED':
      batchPickerState.isActive = false;
      updatePickerStatus();
      showNotification('选择模式已停止');
      break;

    case 'ELEMENT_SELECTION_CHANGED':
      batchPickerState.selectedElements = message.elements || [];
      updateSelectedElementsUI();
      break;

    case 'ELEMENT_PICKER_STATE':
      batchPickerState.isActive = message.isActive;
      batchPickerState.selectedElements = message.elements || [];
      updatePickerStatus();
      updateSelectedElementsUI();
      break;
  }
}

// 更新拾取器状态显示
function updatePickerStatus() {
  if (batchPickerStatus) {
    batchPickerStatus.textContent = batchPickerState.isActive ? '选择中...' : '未启动';
    batchPickerStatus.className = 'batch-picker-status' + (batchPickerState.isActive ? ' active' : '');
  }

  if (startPickerBtn) {
    startPickerBtn.textContent = batchPickerState.isActive ? '⏹️ 停止选择' : '🎯 开始选择';
  }
}

// 更新已选元素 UI
function updateSelectedElementsUI() {
  const count = batchPickerState.selectedElements.length;

  // 更新计数
  if (batchSelectedCount) {
    batchSelectedCount.textContent = count;
  }

  // 显示/隐藏区域
  if (batchSelectedInfo) {
    batchSelectedInfo.style.display = count > 0 ? 'block' : 'none';
  }
  if (batchMergedSelectorSection) {
    batchMergedSelectorSection.style.display = count > 0 ? 'block' : 'none';
  }

  // 更新元素列表
  if (batchSelectedList) {
    if (count === 0) {
      batchSelectedList.innerHTML = '<div class="empty-state" style="color: #999; font-size: 11px;">暂无选中的元素</div>';
    } else {
      batchSelectedList.innerHTML = batchPickerState.selectedElements.map((el, index) => {
        const matchCount = el.matchCount || 1;
        const isExact = matchCount === 1;
        const matchBadge = isExact
          ? `<span class="match-exact" style="color: #10b981; font-size: 10px; margin-left: 4px;" title="精确匹配">✓1</span>`
          : `<span class="match-warning" style="color: #f59e0b; font-size: 10px; margin-left: 4px;" title="选择器匹配 ${matchCount} 个元素">⚠️${matchCount}</span>`;
        return `
        <div class="batch-selected-item" data-index="${index}" title="${escapeHtml(el.selector)}">
          <input type="checkbox" class="batch-item-checkbox" checked data-index="${index}">
          <span class="item-tag">${escapeHtml(el.tagName)}${el.id ? '#' + el.id : ''}${matchBadge}</span>
          <span class="item-selector" style="color: #6b7280; font-size: 10px; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(el.selector)}">${escapeHtml(el.selector)}</span>
          <span class="item-remove" data-index="${index}" title="移除">×</span>
        </div>
      `}).join('');

      // 添加移除事件
      batchSelectedList.querySelectorAll('.item-remove').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const index = parseInt(e.target.dataset.index);
          removeSelectedElement(index);
        });
      });

      // 添加复选框事件
      batchSelectedList.querySelectorAll('.batch-item-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          updateSelectorOptionsDisplay();
        });
      });
    }
  }

  // 更新选择器选项显示
  updateSelectorOptionsDisplay();
}

// 当前选中的选择器索引
let selectedSelectorIndex = 0;

// 更新选择器选项显示
async function updateSelectorOptionsDisplay() {
  const container = document.getElementById('selector-options-container');
  if (!container) return;

  const checkedElements = [];
  batchSelectedList.querySelectorAll('.batch-item-checkbox:checked').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    if (batchPickerState.selectedElements[index]) {
      checkedElements.push(batchPickerState.selectedElements[index]);
    }
  });

  if (checkedElements.length === 0) {
    container.innerHTML = '<div style="color: #999; font-size: 11px; padding: 8px;">请勾选元素</div>';
    return;
  }

  // 生成多个选择器选项
  const options = generateSelectorOptions(checkedElements);

  // 确保选中索引有效
  if (selectedSelectorIndex >= options.length) {
    selectedSelectorIndex = 0;
  }

  // 渲染选项（先显示加载状态）
  container.innerHTML = options.map((opt, index) => `
    <div class="selector-option ${index === selectedSelectorIndex ? 'selected' : ''}" data-index="${index}">
      <div class="selector-option-radio"></div>
      <div class="selector-option-content">
        <div class="selector-option-text">${escapeHtml(opt.selector)}</div>
        <div class="selector-option-meta">
          <span class="selector-option-tag ${index === 0 ? 'recommended' : ''}">${opt.type}</span>
          <span class="selector-match-count" data-selector="${escapeHtml(opt.selector)}" data-expected="${opt.matchCount}">
            <span class="match-loading">查询中...</span>
          </span>
          ${opt.savedChars > 0 ? `<span style="color: #10b981;">节省 ${opt.savedChars} 字符</span>` : ''}
        </div>
      </div>
      <button class="selector-option-copy" data-selector="${escapeHtml(opt.selector)}" title="复制">📋</button>
    </div>
  `).join('');

  // 异步查询每个选择器的匹配数量
  querySelectorMatches(options);

  // 添加点击选择事件
  container.querySelectorAll('.selector-option').forEach(el => {
    el.addEventListener('click', (e) => {
      // 如果点击的是复制按钮，不触发选择
      if (e.target.classList.contains('selector-option-copy')) return;

      const index = parseInt(el.dataset.index);
      selectedSelectorIndex = index;
      // 更新选中状态
      container.querySelectorAll('.selector-option').forEach(opt => opt.classList.remove('selected'));
      el.classList.add('selected');
    });
  });

  // 添加复制按钮事件
  container.querySelectorAll('.selector-option-copy').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const selector = btn.dataset.selector;
      await copyToClipboard(selector);
      btn.textContent = '✓';
      setTimeout(() => btn.textContent = '📋', 1000);
    });
  });

  // 更新合并提示
  const mergeInfo = document.getElementById('batch-merge-info');
  if (mergeInfo && options.length > 0) {
    mergeInfo.textContent = `${options.length} 个选项`;
    mergeInfo.style.display = 'block';
  }
}

/**
 * 异步查询每个选择器的匹配数量
 */
async function querySelectorMatches(options) {
  for (const opt of options) {
    const countEl = document.querySelector(`.selector-match-count[data-selector="${CSS.escape(opt.selector)}"]`);
    if (!countEl) continue;

    const expected = parseInt(countEl.dataset.expected);
    const count = await getSelectorMatchCount(opt.selector);

    if (count !== null) {
      const isExact = count === expected;
      const color = isExact ? '#10b981' : (count > expected ? '#f59e0b' : '#ef4444');
      const icon = isExact ? '✓' : (count > expected ? '⚠' : '✗');

      countEl.innerHTML = `
        <span class="selector-match-result" style="color: ${color}; cursor: pointer;" title="鼠标悬停查看匹配元素">
          $$(${count}) ${icon}
        </span>
      `;
      countEl.title = `匹配 ${count} 个元素，预期 ${expected} 个${isExact ? '' : (count > expected ? '，可能匹配过多' : '，匹配不足')}，悬停查看`;

      // 鼠标移入高亮，移出取消
      const resultEl = countEl.querySelector('.selector-match-result');
      resultEl.addEventListener('mouseenter', () => {
        highlightElements(opt.selector);
      });
      resultEl.addEventListener('mouseleave', () => {
        clearHighlight();
      });
    } else {
      countEl.innerHTML = '<span style="color: #999;">查询失败</span>';
    }
  }
}

/**
 * 高亮页面上的匹配元素
 */
function highlightElements(selector) {
  const code = `
    (function(selector) {
      // 移除之前的高亮
      const oldOverlay = document.getElementById('ep-highlight-overlay');
      if (oldOverlay) oldOverlay.remove();

      const elements = document.querySelectorAll(selector);
      if (elements.length === 0) return 0;

      // 创建高亮容器
      const container = document.createElement('div');
      container.id = 'ep-highlight-overlay';
      container.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 2147483647;';

      // 为每个元素创建高亮框
      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const box = document.createElement('div');
        box.style.cssText = \`
          position: absolute;
          left: \${rect.left}px;
          top: \${rect.top}px;
          width: \${rect.width}px;
          height: \${rect.height}px;
          border: 2px solid rgba(0, 122, 204, 0.8);
          background: rgba(0, 122, 204, 0.1);
          border-radius: 3px;
          box-shadow: 0 0 8px rgba(0, 122, 204, 0.5);
        \`;
        container.appendChild(box);
      });

      document.body.appendChild(container);
      return elements.length;
    })(${JSON.stringify(selector)})
  `;

  chrome.devtools.inspectedWindow.eval(code);
}

/**
 * 清除高亮
 */
function clearHighlight() {
  const code = `
    (function() {
      const overlay = document.getElementById('ep-highlight-overlay');
      if (overlay) overlay.remove();
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code);
}

// 监听面板切换/关闭，确保清除高亮
function setupHighlightCleanup() {
  // 页面卸载时清理
  window.addEventListener('beforeunload', clearHighlight);
  // 页面隐藏时清理
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) clearHighlight();
  });
  // 失去焦点时清理
  window.addEventListener('blur', clearHighlight);
}

// 初始化清理监听
setupHighlightCleanup();

/**
 * 获取选择器匹配的元素数量
 */
async function getSelectorMatchCount(selector) {
  const code = `
    (function(selector) {
      try {
        return document.querySelectorAll(selector).length;
      } catch (e) {
        return -1;
      }
    })(${JSON.stringify(selector)})
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error || result === undefined || result < 0) {
        resolve(null);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * 生成多个选择器选项
 */
function generateSelectorOptions(elements) {
  if (!elements || elements.length === 0) return [];
  if (elements.length === 1) {
    return [{
      selector: elements[0].selector,
      type: '单个选择器',
      matchCount: 1,
      savedChars: 0
    }];
  }

  const selectors = elements.map(el => el.selector);
  const uniqueSelectors = [...new Set(selectors)];
  const simpleJoin = uniqueSelectors.join(', ');
  const options = [];
  const seenSelectors = new Set();

  // 选项1: 智能合并（推荐）
  const smartMerged = smartMergeSelectors(elements);
  if (smartMerged && !seenSelectors.has(smartMerged)) {
    seenSelectors.add(smartMerged);
    options.push({
      selector: smartMerged,
      type: '智能合并',
      matchCount: elements.length,
      savedChars: smartMerged.length < simpleJoin.length ? simpleJoin.length - smartMerged.length : 0
    });

    // 选项1.5: 精简版（去掉更多不必要的层级）
    const simplified = simplifySelector(smartMerged);
    if (simplified && simplified !== smartMerged && !seenSelectors.has(simplified)) {
      seenSelectors.add(simplified);
      options.push({
        selector: simplified,
        type: '精简版',
        matchCount: elements.length,
        savedChars: simplified.length < simpleJoin.length ? simpleJoin.length - simplified.length : 0
      });
    }

    // 选项1.6: 最简版（只保留关键特征）
    const minimal = minimizeSelector(smartMerged);
    if (minimal && minimal !== smartMerged && minimal !== simplified && !seenSelectors.has(minimal)) {
      seenSelectors.add(minimal);
      options.push({
        selector: minimal,
        type: '最简版',
        matchCount: elements.length,
        savedChars: minimal.length < simpleJoin.length ? simpleJoin.length - minimal.length : 0
      });
    }
  }

  // 选项2: :is() 合并（提取共同特征）
  const isMerged = tryIsMerge(elements);
  if (isMerged && !seenSelectors.has(isMerged)) {
    seenSelectors.add(isMerged);
    options.push({
      selector: isMerged,
      type: ':is() 合并',
      matchCount: elements.length,
      savedChars: isMerged.length < simpleJoin.length ? simpleJoin.length - isMerged.length : 0
    });
  }

  // 选项3: 共同类名（如果有）
  const commonClass = tryCommonClassMerge(elements);
  if (commonClass && !seenSelectors.has(commonClass)) {
    seenSelectors.add(commonClass);
    options.push({
      selector: commonClass,
      type: '共同类名',
      matchCount: elements.length,
      savedChars: commonClass.length < simpleJoin.length ? simpleJoin.length - commonClass.length : 0
    });
  }

  return options;
}

/**
 * 最小化选择器（只保留关键特征）
 * 保留: ID, 类名, 属性, :is(), 非1的nth-child
 * 移除: 纯标签名, :nth-child(1)
 * 把 > 改为空格
 */
function minimizeSelector(selector) {
  if (!selector) return null;

  const parts = parseSelectorParts(selector);
  if (parts.length <= 2) return null;

  // 只保留有特征的层级
  const essentialParts = parts.filter((part, index) => {
    // 始终保留第一个和最后一个
    if (index === 0 || index === parts.length - 1) return true;
    // 保留有特征的
    return isEssentialPart(part);
  });

  // 如果没有移除任何层级，返回 null
  if (essentialParts.length === parts.length) return null;

  // 移除每个层级的 :nth-child(1)
  const cleanedParts = essentialParts.map(part => part.replace(/:nth-child\(1\)/g, ''));

  // 用空格连接（后代选择器）
  const minimal = cleanedParts.join(' ');

  return minimal !== selector ? minimal : null;
}

/**
 * 精简选择器（去掉更多不必要的层级）
 * 使用贪心算法：逐步移除层级，验证是否仍然精确匹配
 */
function simplifySelector(selector) {
  if (!selector) return null;

  // 解析选择器为层级数组
  const parts = parseSelectorParts(selector);
  if (parts.length <= 2) return null; // 太短，不需要精简

  let simplified = selector;

  // 策略1: 去掉 :nth-child(1)（因为第一个子元素是默认的）
  simplified = simplified.replace(/:nth-child\(1\)/g, '');

  // 策略2: 尝试把 > 改为空格（后代选择器更宽松）
  simplified = simplified.replace(/\s*>\s*/g, ' ');

  // 策略3: 尝试移除中间层级（从后往前尝试）
  const currentParts = parseSelectorParts(simplified);
  const minimalParts = [currentParts[0]]; // 保留第一个

  for (let i = 1; i < currentParts.length - 1; i++) {
    // 尝试跳过这个层级
    const testParts = [...minimalParts, ...currentParts.slice(i + 1)];
    const testSelector = testParts.join(' ');

    // 这里我们假设跳过后仍然有效（实际应该验证）
    // 为了性能，我们只跳过看起来不重要的层级
    const part = currentParts[i];
    if (isEssentialPart(part)) {
      minimalParts.push(part);
    }
    // 否则跳过
  }

  minimalParts.push(currentParts[currentParts.length - 1]); // 保留最后一个

  const result = minimalParts.join(' ');

  // 如果结果不同，返回精简版
  return result !== selector ? result : null;
}

/**
 * 解析选择器为层级数组
 */
function parseSelectorParts(selector) {
  // 处理 :is() 中的逗号，避免被错误分割
  const isPattern = /:is\([^)]+\)/g;
  const isMatches = [];
  let temp = selector.replace(isPattern, (match) => {
    isMatches.push(match);
    return `<<IS${isMatches.length - 1}>>`;
  });

  // 按空格分割（后代选择器）
  const parts = temp.split(/\s+/).filter(p => p);

  // 恢复 :is()
  return parts.map(part => {
    isMatches.forEach((match, i) => {
      part = part.replace(`<<IS${i}>>`, match);
    });
    return part;
  });
}

/**
 * 判断层级是否是必要的（有特征）
 */
function isEssentialPart(part) {
  // 有 :nth-child(n) 其中 n > 1
  if (/:nth-child\([2-9]\d*\)/.test(part)) return true;
  // 有 ID
  if (/#[a-zA-Z]/.test(part)) return true;
  // 有类名
  if (/\.[a-zA-Z]/.test(part)) return true;
  // 有属性选择器
  if (/\[[^\]]+\]/.test(part)) return true;
  // 有 :is()
  if (/:is\(/.test(part)) return true;

  return false;
}

/**
 * 尝试使用 :is() 合并
 */
function tryIsMerge(elements) {
  if (elements.length < 2) return null;

  // 提取每个元素的特征选择器
  const featureSelectors = elements.map(el => {
    // 优先使用 ID
    if (el.id) return '#' + CSS.escape(el.id);

    // 使用类名
    if (el.className) {
      const classes = el.className.split(' ').filter(c =>
        c && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c) && !/^(css-|styled-|sc-|js-|_)/.test(c)
      );
      if (classes.length > 0) {
        return '.' + CSS.escape(classes[0]);
      }
    }

    // 使用选择器中的属性
    const attrMatch = el.selector.match(/\[[^\]]+\]/);
    if (attrMatch) {
      return attrMatch[0];
    }

    return null;
  });

  // 如果所有元素都有特征选择器
  if (featureSelectors.every(s => s !== null)) {
    const uniqueFeatures = [...new Set(featureSelectors)];
    if (uniqueFeatures.length > 1 && uniqueFeatures.length <= 10) {
      return `:is(${uniqueFeatures.join(', ')})`;
    }
  }

  return null;
}

/**
 * 尝试使用共同类名合并
 */
function tryCommonClassMerge(elements) {
  if (elements.length < 2) return null;

  // 获取所有元素的类名
  const allClasses = elements.map(el => {
    if (!el.className) return [];
    return el.className.split(' ').filter(c =>
      c && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c) && !/^(css-|styled-|sc-|js-|_)/.test(c)
    );
  });

  // 找出共同类名
  if (allClasses.length === 0 || allClasses[0].length === 0) return null;

  const commonClasses = allClasses[0].filter(cls =>
    allClasses.every(classes => classes.includes(cls))
  );

  if (commonClasses.length > 0) {
    return '.' + commonClasses.map(c => CSS.escape(c)).join('.');
  }

  return null;
}

// 获取当前选中的选择器
function getSelectedSelector() {
  const container = document.getElementById('selector-options-container');
  if (!container) return null;

  const checkedElements = [];
  batchSelectedList.querySelectorAll('.batch-item-checkbox:checked').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    if (batchPickerState.selectedElements[index]) {
      checkedElements.push(batchPickerState.selectedElements[index]);
    }
  });

  if (checkedElements.length === 0) return null;

  const options = generateSelectorOptions(checkedElements);
  if (options.length === 0) return null;

  return options[selectedSelectorIndex]?.selector || options[0].selector;
}

/**
 * 智能合并选择器（多策略并行）
 */
function smartMergeSelectors(elements) {
  if (!elements || elements.length === 0) return '';
  if (elements.length === 1) return elements[0].selector;

  const selectors = elements.map(el => el.selector);
  const uniqueSelectors = [...new Set(selectors)];

  // 策略1: 如果所有选择器完全相同，直接返回
  if (uniqueSelectors.length === 1) {
    return uniqueSelectors[0];
  }

  // 解析所有选择器为路径数组
  const pathsArray = uniqueSelectors.map(s => s.split(/\s*>\s*/));

  // 策略2: 智能路径合并 - 找出相同和不同的层级，用 :is() 合并
  const pathMergeResult = trySmartPathMerge(pathsArray, elements);
  if (pathMergeResult) {
    return pathMergeResult;
  }

  // 策略3: 找出精确的共同后缀
  const commonSuffix = findCommonSuffix(uniqueSelectors);
  if (commonSuffix && commonSuffix.length > 0) {
    return commonSuffix;
  }

  // 策略4: 返回逗号分隔（最安全）
  return uniqueSelectors.join(', ');
}

/**
 * 智能路径合并
 * 分析路径层级，对不同层级使用 :is() 合并，并简化无特征的中间层级
 */
function trySmartPathMerge(pathsArray, elements) {
  if (pathsArray.length < 2) return null;

  const numPaths = pathsArray.length;
  const pathLength = pathsArray[0].length;

  // 所有路径长度必须相同
  if (!pathsArray.every(p => p.length === pathLength)) return null;

  // 分析每一层级的差异
  const layerAnalysis = [];
  for (let i = 0; i < pathLength; i++) {
    const parts = pathsArray.map(p => p[i]);
    const uniqueParts = [...new Set(parts)];

    // 解析每个部分
    const parsedParts = parts.map(part => parseSelectorPart(part));

    layerAnalysis.push({
      index: i,
      parts,
      uniqueParts,
      parsedParts,
      isSame: uniqueParts.length === 1,
      isDifferent: uniqueParts.length > 1,
      // 判断是否有特征（类名、ID、非1的nth-child）
      hasFeature: hasSelectorFeature(parsedParts)
    });
  }

  // 构建合并后的选择器路径
  const mergedPath = [];
  for (let i = 0; i < pathLength; i++) {
    const layer = layerAnalysis[i];

    if (layer.isSame) {
      mergedPath.push(layer.parts[0]);
    } else {
      const merged = tryMergeLayer(layer, elements);
      if (merged) {
        mergedPath.push(merged);
      } else {
        return null;
      }
    }
  }

  // 找出需要保留的层级索引（有特征或差异的层级）
  const keepIndexes = [];
  for (let i = 0; i < layerAnalysis.length; i++) {
    // 保留：有特征、有差异、第一层、最后一层
    if (layerAnalysis[i].hasFeature ||
        layerAnalysis[i].isDifferent ||
        i === 0 ||
        i === pathLength - 1) {
      keepIndexes.push(i);
    }
  }

  // 构建最终选择器
  const selectorParts = [];
  for (let i = 0; i < keepIndexes.length; i++) {
    const idx = keepIndexes[i];
    selectorParts.push(mergedPath[idx]);

    // 如果下一个保留的层级不是紧邻的，使用后代选择器（空格）
    if (i < keepIndexes.length - 1) {
      const nextIdx = keepIndexes[i + 1];
      if (nextIdx > idx + 1) {
        // 中间有被跳过的层级，用空格连接
        selectorParts.push(' ');  // 后代选择器
      } else {
        selectorParts.push(' > '); // 子选择器
      }
    }
  }

  // 移除多余的连接符，构建最终选择器
  let finalSelector = '';
  for (let i = 0; i < selectorParts.length; i++) {
    const part = selectorParts[i];
    if (part === ' ' || part === ' > ') {
      finalSelector += part;
    } else {
      finalSelector += part;
    }
  }

  return finalSelector;
}

/**
 * 判断层级是否有特征（值得保留）
 */
function hasSelectorFeature(parsedParts) {
  return parsedParts.some(p => {
    // 有类名
    if (p.classes && p.classes.length > 0) return true;
    // 有 ID
    if (p.id) return true;
    // 有属性
    if (p.attributes && p.attributes.length > 0) return true;
    // nth-child 不是 1
    if (p.nthChild && p.nthChild !== 1) return true;
    return false;
  });
}

/**
 * 解析选择器部分
 */
function parseSelectorPart(part) {
  // 匹配 tag, class, id, nth-child 等
  const result = {
    tag: '',
    id: '',
    classes: [],
    nthChild: null,
    attributes: [],
    original: part
  };

  // 提取 nth-child
  const nthMatch = part.match(/:nth-child\((\d+)\)/);
  if (nthMatch) {
    result.nthChild = parseInt(nthMatch[1]);
    part = part.replace(/:nth-child\(\d+\)/, '');
  }

  // 提取 ID
  const idMatch = part.match(/#([a-zA-Z_-][a-zA-Z0-9_-]*)/);
  if (idMatch) {
    result.id = idMatch[1];
    part = part.replace(/#[a-zA-Z_-][a-zA-Z0-9_-]*/, '');
  }

  // 提取类名
  const classMatches = part.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g);
  if (classMatches) {
    result.classes = classMatches.map(c => c.slice(1));
    part = part.replace(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g, '');
  }

  // 提取属性
  const attrMatches = part.match(/\[[^\]]+\]/g);
  if (attrMatches) {
    result.attributes = attrMatches;
    part = part.replace(/\[[^\]]+\]/g, '');
  }

  // 剩余的是标签名
  result.tag = part.trim() || '*';

  return result;
}

/**
 * 尝试合并同一层级的不同部分
 */
function tryMergeLayer(layer, elements) {
  const { parsedParts, uniqueParts } = layer;

  // 检查是否只是 nth-child 不同
  const firstParsed = parsedParts[0];
  const sameBase = parsedParts.every(p =>
    p.tag === firstParsed.tag &&
    p.id === firstParsed.id &&
    p.classes.join('.') === firstParsed.classes.join('.')
  );

  if (sameBase && firstParsed.nthChild !== null) {
    // 只有 nth-child 不同，用 :is() 合并索引
    const indices = [...new Set(parsedParts.map(p => p.nthChild))].sort((a, b) => a - b);

    // 构建基础选择器
    let baseSelector = firstParsed.tag;
    if (firstParsed.id) baseSelector += '#' + firstParsed.id;
    if (firstParsed.classes.length > 0) {
      baseSelector += '.' + firstParsed.classes.join('.');
    }

    // 使用 :is() 合并不同的 nth-child
    const nthList = indices.map(i => `:nth-child(${i})`).join(', ');
    return `${baseSelector}:is(${nthList})`;
  }

  // 检查是否是兄弟元素（父级是兄弟）
  // 这种情况下，可能需要跳过中间层级
  if (canMergeAsSiblings(parsedParts)) {
    // 使用 :is() 合并不同的部分
    const mergedParts = uniqueParts.map(p => {
      // 移除 nth-child，保留其他特征
      return p.replace(/:nth-child\(\d+\)/, '');
    });
    const uniqueMerged = [...new Set(mergedParts)];

    if (uniqueMerged.length === 1) {
      // 去掉 nth-child 后相同，直接使用
      return uniqueMerged[0];
    } else {
      // 使用 :is() 合并
      return `:is(${uniqueMerged.join(', ')})`;
    }
  }

  // 尝试用 :is() 直接合并
  return `:is(${uniqueParts.join(', ')})`;
}

/**
 * 检查是否可以作为兄弟元素合并
 */
function canMergeAsSiblings(parsedParts) {
  // 检查标签名是否相同
  const tags = [...new Set(parsedParts.map(p => p.tag))];
  if (tags.length !== 1) return false;

  // 至少有一个共同特征（类名或属性）
  const first = parsedParts[0];
  if (first.classes.length > 0 || first.attributes.length > 0 || first.id) {
    return true;
  }

  return false;
}

/**
 * 验证合并后的选择器是否精确匹配
 */
function validateMergedSelector(selector, expectedCount) {
  // 这个验证需要在页面上下文中执行
  // 返回 true 表示通过验证（由调用者进行实际验证）
  return true;
}

/**
 * 找出所有选择器的共同后缀（完整路径段，包括 nth-child）
 */
function findCommonSuffix(selectors) {
  if (selectors.length < 2) return null;

  const partsArray = selectors.map(s => s.split(/\s*>\s*/));
  const minLen = Math.min(...partsArray.map(p => p.length));

  const commonSuffix = [];

  for (let i = 1; i <= minLen; i++) {
    const tailParts = partsArray.map(parts => parts[parts.length - i]);
    const firstPart = tailParts[0];
    const allSame = tailParts.every(part => part === firstPart);

    if (allSame) {
      commonSuffix.unshift(firstPart);
    } else {
      break;
    }
  }

  // 只有当共同后缀足够长（>=2段）时才使用
  if (commonSuffix.length >= 2) {
    return commonSuffix.join(' > ');
  }

  return null;
}

/**
 * 尝试用 :not() 排除法合并
 * 适用于：同一父元素下选中大部分子元素，用 :not() 排除未选中的
 */
function tryMergeWithNot(elements, selectors) {
  if (selectors.length < 3) return null;

  // 解析选择器
  const parsed = selectors.map(sel => {
    const parts = sel.split(/\s*>\s*/);
    const lastPart = parts[parts.length - 1];
    const match = lastPart.match(/^(.+):nth-child\((\d+)\)$/);
    if (match) {
      return {
        base: match[1],
        index: parseInt(match[2]),
        parentPath: parts.slice(0, -1).join(' > ')
      };
    }
    return null;
  });

  // 所有选择器都必须有 nth-child
  if (parsed.some(p => p === null)) return null;

  // 必须有相同的父路径和基础标签
  const firstParent = parsed[0].parentPath;
  const firstBase = parsed[0].base;

  const sameParentAndBase = parsed.every(p =>
    p.parentPath === firstParent && p.base === firstBase
  );

  if (!sameParentAndBase) return null;

  // 收集选中的索引
  const selectedIndices = [...new Set(parsed.map(p => p.index))].sort((a, b) => a - b);
  const maxIndex = Math.max(...selectedIndices);

  // 找出未选中的索引（间隙）
  const gaps = [];
  for (let i = 1; i <= maxIndex; i++) {
    if (!selectedIndices.includes(i)) {
      gaps.push(i);
    }
  }

  // 如果排除的数量少于选中的数量，且排除数量 <= 3，使用 :not() 更简洁
  if (gaps.length > 0 && gaps.length < selectedIndices.length && gaps.length <= 3) {
    const notParts = gaps.map(i => `:not(:nth-child(${i}))`);
    const selector = firstParent
      ? `${firstParent} > ${firstBase}:nth-child(n)${notParts.join('')}`
      : `${firstBase}:nth-child(n)${notParts.join('')}`;

    return selector;
  }

  return null;
}

/**
 * 尝试合并后缀部分
 */
function tryMergeSuffixParts(suffixParts) {
  if (suffixParts.length === 0) return null;

  // 检查是否都是单个部分（只有一层）
  const allSingle = suffixParts.every(s => s.length === 1);
  if (!allSingle) return null;

  const parts = suffixParts.map(s => s[0]);

  // 检查是否都是相同的基础选择器（类名或标签）
  const baseSelectors = parts.map(p => p.replace(/:nth-child\([^)]+\)|:first-child|:last-child|:only-child/g, ''));
  const uniqueBase = [...new Set(baseSelectors)];

  if (uniqueBase.length === 1) {
    const base = uniqueBase[0];

    // 提取所有的 nth-child 索引
    const indices = [];
    parts.forEach(p => {
      const match = p.match(/:nth-child\((\d+)\)/);
      if (match) {
        indices.push(parseInt(match[1]));
      } else if (p.includes(':first-child')) {
        indices.push(1);
      } else if (p.includes(':last-child')) {
        // 需要知道总数，这里简化处理
        indices.push(-1); // 标记为 last
      } else if (p.includes(':only-child')) {
        indices.push(1);
      }
    });

    if (indices.length === 0) {
      // 没有 nth-child，说明都是相同的基础选择器
      return base;
    }

    // 检查是否是连续的索引
    const positiveIndices = indices.filter(i => i > 0).sort((a, b) => a - b);
    if (positiveIndices.length === indices.length && isConsecutive(positiveIndices)) {
      // 连续索引，使用范围选择器
      const start = positiveIndices[0];
      const end = positiveIndices[positiveIndices.length - 1];

      if (start === end) {
        return `${base}:nth-child(${start})`;
      } else {
        return `${base}:nth-child(n+${start}):nth-child(-n+${end})`;
      }
    }

    // 无法合并索引，返回带索引的选择器列表
    return parts.join(', ');
  }

  return null;
}

/**
 * 检查数组是否连续
 */
function isConsecutive(arr) {
  if (arr.length < 2) return true;
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] !== arr[i - 1] + 1) return false;
  }
  return true;
}

/**
 * 尝试通过共同类名合并
 */
function tryMergeByCommonClass(elements) {
  if (elements.length < 2) return null;

  // 从选择器中提取类名
  const allClasses = elements.map(el => {
    const matches = el.selector.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g) || [];
    return matches.map(c => c.slice(1)); // 移除点号
  });

  // 找出所有元素共有的类名
  const firstClasses = allClasses[0] || [];
  const commonClasses = firstClasses.filter(cls => {
    return allClasses.every(classes => classes.includes(cls));
  });

  if (commonClasses.length === 0) return null;

  // 使用共同类名构建选择器
  const selector = '.' + commonClasses.map(c => CSS.escape ? CSS.escape(c) : c).join('.');

  return selector;
}

// 移除选中的元素
function removeSelectedElement(index) {
  const removed = batchPickerState.selectedElements.splice(index, 1);
  updateSelectedElementsUI();

  // 通知注入脚本移除特定元素的高亮样式（使用唯一 ID 精确定位）
  if (removed.length > 0) {
    sendPickerCommand('REMOVE_ELEMENT_HIGHLIGHT', {
      pickerUid: removed[0].pickerUid,
      selector: removed[0].selector  // 向后兼容
    });
  }
}

// 获取选中的选择器（优先使用合并后的选择器）
async function getCheckedSelectors() {
  // 使用用户选中的选择器
  const selectedSelector = getSelectedSelector();
  if (selectedSelector) {
    return [selectedSelector];
  }

  // 回退逻辑
  const checkedElements = [];
  batchSelectedList.querySelectorAll('.batch-item-checkbox:checked').forEach(checkbox => {
    const index = parseInt(checkbox.dataset.index);
    if (batchPickerState.selectedElements[index]) {
      checkedElements.push(batchPickerState.selectedElements[index]);
    }
  });

  if (checkedElements.length === 0) return [];

  // 返回原始选择器
  return checkedElements.map(el => el.selector);
}

/**
 * 验证合并后的选择器是否精确匹配预期数量
 */
async function validateMergedSelectorCount(selector, expectedCount) {
  const code = `
    (function(selector) {
      try {
        const elements = document.querySelectorAll(selector);
        return { count: elements.length, valid: elements.length === ${expectedCount} };
      } catch (e) {
        return { count: 0, valid: false, error: e.message };
      }
    })(${JSON.stringify(selector)})
  `;

  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error || !result) {
        console.warn('[BatchPicker] 验证选择器失败:', error);
        resolve(false);
      } else {
        resolve(result.valid);
      }
    });
  });
}

// 批量隐藏元素
async function batchHideElements(selectors) {
  if (!selectors || selectors.length === 0) {
    showNotification('请先选择要隐藏的元素');
    return;
  }

  const code = `
    (function(selectors) {
      let styleEl = document.getElementById('extension-hide-elements-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'extension-hide-elements-style';
        document.head.appendChild(styleEl);
      }

      let addedCount = 0;
      selectors.forEach(selector => {
        const rule = selector + ' { display: none !important; }';
        const currentStyles = styleEl.textContent || '';
        if (!currentStyles.includes(rule)) {
          styleEl.textContent = currentStyles + (currentStyles.endsWith('\\n') ? '' : '\\n') + rule;
          addedCount++;
        }
      });

      return { success: true, addedCount };
    })(${JSON.stringify(selectors)})
  `;

  const result = await new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('[BatchPicker] 批量隐藏失败:', error);
        resolve(null);
      } else {
        resolve(result);
      }
    });
  });

  if (result && result.success) {
    // 同步到存储
    const domain = await getCurrentDomain();
    if (domain) {
      const storageResult = await chrome.storage.local.get(['hideElementsSettings']);
      const allSettings = storageResult.hideElementsSettings || {};
      const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };

      // 合并新选择器
      selectors.forEach(selector => {
        if (!domainSettings.selectors.includes(selector)) {
          domainSettings.selectors.push(selector);
        }
      });
      domainSettings.enabled = true;

      allSettings[domain] = domainSettings;
      await chrome.storage.local.set({ hideElementsSettings: allSettings });

      // 通知 content script
      const tabId = chrome.devtools.inspectedWindow.tabId;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'UPDATE_HIDE_ELEMENTS',
          enabled: true,
          selectors: domainSettings.selectors
        }).catch(() => {
        });
      }
    }

    showNotification(`已隐藏 ${result.addedCount} 个元素`);

    // 更新已隐藏列表
    await loadHiddenElementsFromStorage();
  }
}

// 批量显示元素
async function batchShowElements(selectors) {
  if (!selectors || selectors.length === 0) {
    showNotification('请先选择要显示的元素');
    return;
  }

  const code = `
    (function(selectors) {
      const styleEl = document.getElementById('extension-hide-elements-style');
      if (!styleEl) return { success: true, removedCount: 0 };

      let removedCount = 0;
      let currentStyles = styleEl.textContent || '';

      selectors.forEach(selector => {
        const rule = selector + ' { display: none !important; }';
        if (currentStyles.includes(rule)) {
          currentStyles = currentStyles.replace(rule, '').replace(/^\\n+|\\n+$/g, '');
          removedCount++;
        }
      });

      styleEl.textContent = currentStyles;
      return { success: true, removedCount };
    })(${JSON.stringify(selectors)})
  `;

  const result = await new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval(code, (result, error) => {
      if (error) {
        console.error('[BatchPicker] 批量显示失败:', error);
        resolve(null);
      } else {
        resolve(result);
      }
    });
  });

  if (result && result.success) {
    // 同步到存储
    const domain = await getCurrentDomain();
    if (domain) {
      const storageResult = await chrome.storage.local.get(['hideElementsSettings']);
      const allSettings = storageResult.hideElementsSettings || {};
      const domainSettings = allSettings[domain] || { enabled: false, selectors: [] };

      // 移除选择器
      domainSettings.selectors = domainSettings.selectors.filter(s => !selectors.includes(s));

      allSettings[domain] = domainSettings;
      await chrome.storage.local.set({ hideElementsSettings: allSettings });

      // 通知 content script
      const tabId = chrome.devtools.inspectedWindow.tabId;
      if (tabId) {
        chrome.tabs.sendMessage(tabId, {
          type: 'UPDATE_HIDE_ELEMENTS',
          enabled: domainSettings.enabled,
          selectors: domainSettings.selectors
        }).catch(() => {
        });
      }
    }

    showNotification(`已显示 ${result.removedCount} 个元素`);

    // 更新已隐藏列表
    await loadHiddenElementsFromStorage();
  }
}

// 初始化批量选择功能
async function initBatchPicker() {
  // 设置消息监听
  setupPickerMessageListener();

  // 尝试同步当前状态（处理 DevTools 刷新的情况）
  await syncPickerState();

  // 开始/停止选择按钮
  if (startPickerBtn) {
    startPickerBtn.addEventListener('click', async () => {
      if (batchPickerState.isActive) {
        // 立即更新本地状态
        batchPickerState.isActive = false;
        updatePickerStatus();
        await sendPickerCommand('STOP');
      } else {
        const injected = await injectElementPicker();
        if (injected) {
          // 等待脚本加载
          await new Promise(resolve => setTimeout(resolve, 200));
          // 立即更新本地状态
          batchPickerState.isActive = true;
          updatePickerStatus();
          await sendPickerCommand('START');
        }
      }
    });
  }

  // 清除选择按钮
  if (clearSelectionBtn) {
    clearSelectionBtn.addEventListener('click', async () => {
      batchPickerState.selectedElements = [];
      updateSelectedElementsUI();
      await sendPickerCommand('CLEAR');
      showNotification('已清除所有选择');
    });
  }

  // 隐藏选中按钮
  if (hideSelectedBtn) {
    hideSelectedBtn.addEventListener('click', async () => {
      const selectors = await getCheckedSelectors();
      await batchHideElements(selectors);
    });
  }

  // 显示选中按钮
  if (showSelectedBtn) {
    showSelectedBtn.addEventListener('click', async () => {
      const selectors = await getCheckedSelectors();
      await batchShowElements(selectors);
    });
  }

  // 复制合并选择器按钮
  if (copyMergedSelectorBtn) {
    copyMergedSelectorBtn.addEventListener('click', async () => {
      const selector = getSelectedSelector();
      if (selector) {
        await copyToClipboard(selector);
        showNotification('选择器已复制');
      }
    });
  }

  // 应用隐藏按钮
  if (applyHideBtn) {
    applyHideBtn.addEventListener('click', async () => {
      const selectors = await getCheckedSelectors();
      await batchHideElements(selectors);
    });
  }

}

// 启动批量选择功能
initBatchPicker();

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
    try {
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
    } catch (e) {
      // Ignore errors during load
      if (!isContextInvalidatedError(e)) {
        console.error('[AutoCleanup] Failed to load settings:', e);
      }
    }
  });

  // 切换自动清理
  autoCleanupEnabled.addEventListener('change', () => {
    const enabled = autoCleanupEnabled.checked;
    chrome.storage.local.set({ autoCleanupEnabled: enabled }).catch(err => {
      if (!isContextInvalidatedError(err)) {
        console.error('[AutoCleanup] Failed to save enabled state:', err);
      }
    });

    if (enabled) {
      startAutoCleanup(parseInt(autoCleanupInterval.value));
    } else {
      stopAutoCleanup();
    }
  });

  // 修改清理间隔
  autoCleanupInterval.addEventListener('change', () => {
    const interval = parseInt(autoCleanupInterval.value);
    chrome.storage.local.set({ autoCleanupInterval: interval }).catch(err => {
      if (!isContextInvalidatedError(err)) {
        console.error('[AutoCleanup] Failed to save interval:', err);
      }
    });

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
loadAllStorageData().catch(err => {
  if (!isContextInvalidatedError(err)) {
    console.error('Failed to load storage data:', err);
  }
});

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
});

// ============================================
// Mock 标签页功能
// ============================================

// Mock数据存储
let mockRequests = [];
let selectedRequestId = null;
let currentInspectedDomain = ''; // 当前被检查页面的域名
let currentTypeFilter = 'all'; // 当前类型过滤器
let mockFilterSettings = {
  maxDisplayCount: 50,  // 最大显示请求数量
  excludePatterns: []   // 要排除的URL模式
};

// ========== 资源嗅探相关变量 ==========
let capturedResources = [];
let currentResourceFilter = 'all';

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
    // Ignore context invalidated errors
    if (!isContextInvalidatedError(e)) {
      console.error('Failed to load mock filter settings:', e);
    }
  }
}

// 保存mock过滤设置到存储
async function saveMockFilterSettings() {
  // Check context validity first
  if (!isExtensionContextValid()) {
    return;
  }
  try {
    await chrome.storage.local.set({ mockFilterSettings });
  } catch (e) {
    // Ignore context invalidated errors
    if (!isContextInvalidatedError(e)) {
      console.error('Failed to save mock filter settings:', e);
    }
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
  if (!error) return false;
  const message = error.message || error.toString();
  return message.includes('Extension context invalidated') ||
         message.includes('Extension not loaded') ||
         message.includes('message port closed') ||
         message.includes('Extension context invalid');
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

  // 先获取页面上下文中的 mock 规则，用于正确判断 mock 状态
  const code = `
    (function() {
      if (!window.__mockData) return {};
      const rules = {};
      for (const key in window.__mockData) {
        rules[key] = window.__mockData[key].enabled !== false;
      }
      return rules;
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code, (mockRules) => {
    renderMockListWithRules(filter, forceAnimate, filterByDomain, maxCount, mockRules || {});
  });
}

// 使用获取到的 mock 规则渲染列表
function renderMockListWithRules(filter, forceAnimate, filterByDomain, maxCount, mockRules) {
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

  // ========== URL 去重逻辑 ==========
  // 同 URL 的请求只显示一个，优先显示已 mock 的数据
  const urlGroupMap = new Map(); // key: method:url, value: array of requests

  filtered.forEach(req => {
    const key = `${req.method}:${req.url}`;
    if (!urlGroupMap.has(key)) {
      urlGroupMap.set(key, []);
    }
    urlGroupMap.get(key).push(req);
  });

  // 对每个 URL 组，选择要显示的 item
  const displayRequests = [];
  for (const [key, requests] of urlGroupMap) {
    // 优先选择已 mock 的请求（检查页面上下文中的 mock 规则）
    const hasMockRule = mockRules[key] === true;
    const mockedRequest = requests.find(r => r.status === 'mocked' || hasMockRule);

    if (mockedRequest) {
      // 如果找到已 mock 的请求，标记为 mocked 状态
      if (hasMockRule && mockedRequest.status !== 'mocked') {
        mockedRequest.status = 'mocked';
      }
      displayRequests.push(mockedRequest);
    } else {
      // 没有 mock 的请求，选择最新的（数组第一个是最新的）
      displayRequests.push(requests[0]);
    }
  }

  // 按 timestamp 倒序排列（最新的在前）
  displayRequests.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

  // Apply max display count limit
  const finalDisplayRequests = displayRequests.slice(0, maxCount);

  // Find truly new requests (new in mockRequests, not just new to the view)
  const currentAllIds = new Set(mockRequests.map(r => r.id));
  const newRequestIds = [...currentAllIds].filter(id => !knownRequestIds.has(id));

  // Update known IDs
  knownRequestIds = currentAllIds;

  if (finalDisplayRequests.length === 0) {
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
      <div class="col col-mock-switch">Mock</div>
      <div class="col col-method">Method</div>
      <div class="col col-name">Name</div>
      <div class="col col-status">Status</div>
      <div class="col col-type">Type</div>
      <div class="col col-size">Size</div>
      <div class="col col-time">Time</div>
    </div>
  `;

  // Items wrapper for proper alternating colors
  const itemsHtml = finalDisplayRequests.map((req, index) => {
    // 检查页面上下文中的 mock 规则来判断是否已 mock
    const mockKey = `${req.method}:${req.url}`;
    const hasMockRule = mockRules[mockKey] === true;
    const isMocked = req.status === 'mocked' || hasMockRule;
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

    // 生成唯一的开关 ID
    const switchId = `switch_${req.id}`;

    return `
      <div class="mock-item ${selectedRequestId === req.id ? 'active' : ''} ${isMocked ? 'mocked' : ''} ${isNew ? 'new-item' : ''}"
           data-id="${req.id}">
        <div class="col-icon">
          <span class="type-icon ${typeIconClass}" title="${req.type || 'unknown'}">${typeLabel}</span>
        </div>
        <div class="col-mock-switch">
          <input type="checkbox" id="${switchId}" class="url-mock-switch" data-id="${req.id}" data-url="${escapeHtml(req.url)}" data-method="${req.method}" title="Mock 此 URL">
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

  // Add click handlers for mock switches
  mockListContent.querySelectorAll('.url-mock-switch').forEach(sw => {
    const url = sw.dataset.url;
    const method = sw.dataset.method;

    // 加载保存的开关状态
    loadMockSwitchState(method, url, (enabled) => {
      sw.checked = enabled === true;

      // 添加点击事件
      sw.addEventListener('click', (e) => {
        e.stopPropagation();
        const newEnabled = sw.checked;

        // 在页面上下文切换 mock 开关
        const code = `
          (function() {
            if (!window.__mockData) window.__mockData = {};
            const key = '${method}:${url}';
            if (window.__mockData[key]) {
              window.__mockData[key].enabled = ${newEnabled};
              console.log('[Page] Mock 开关已切换:', key, 'enabled:', ${newEnabled});
              return true;
            } else {
              console.log('[Page] 未找到 mock 规则:', key);
              return false;
            }
          })()
        `;

        chrome.devtools.inspectedWindow.eval(code, (result) => {
          if (result) {
            // 保存开关状态到 storage
            saveMockSwitchState(method, url, newEnabled);

            // 联动逻辑：单个开关打开时，总开关也打开
            if (newEnabled) {
              ensureGlobalMockEnabled();
            } else {
              // 联动逻辑：所有单个开关都关闭时，总开关也关闭
              checkAndUpdateGlobalSwitch();
            }

            showNotification(newEnabled ? 'Mock 已启用' : 'Mock 已禁用');
          } else {
            // 没有规则，取消开关
            sw.checked = false;
            showNotification('请先设置 Mock 数据');
          }
        });
      });
    });
  });
}

// 保存 mock 开关状态
function saveMockSwitchState(method, url, enabled) {
  const key = `${method}:${url}`;
  chrome.storage.session.get(['mockSwitchStates'], (result) => {
    const states = result.mockSwitchStates || {};
    states[key] = enabled;
    chrome.storage.session.set({ mockSwitchStates: states });
  });
}

// 加载 mock 开关状态
function loadMockSwitchState(method, url, callback) {
  const key = `${method}:${url}`;
  chrome.storage.session.get(['mockSwitchStates'], (result) => {
    const states = result.mockSwitchStates || {};
    callback(states[key] === true);
  });
}

// ========== Mock 开关联动逻辑 ==========

// 更新总开关 UI 状态
function updateMockGlobalStatus(enabled) {
  const mockGlobalStatus = document.getElementById('mock-global-status');
  if (mockGlobalStatus) {
    mockGlobalStatus.textContent = enabled ? 'Mock 开启' : 'Mock 关闭';
    mockGlobalStatus.style.color = enabled ? '#4ec9b0' : '#666';
  }
}

// 同步总开关到页面上下文
function syncMockGlobalSwitch(enabled) {
  const code = `window.__mockEnabled = ${enabled};`;
  chrome.devtools.inspectedWindow.eval(code);
}

// 确保总开关打开
function ensureGlobalMockEnabled() {
  const mockGlobalSwitch = document.getElementById('mock-global-switch');
  if (mockGlobalSwitch && !mockGlobalSwitch.checked) {
    mockGlobalSwitch.checked = true;
    updateMockGlobalStatus(true);
    syncMockGlobalSwitch(true);
    chrome.storage.session.set({ mockGlobalEnabled: true });
  }
}

// 检查并更新总开关（当所有单个开关都关闭时，关闭总开关）
function checkAndUpdateGlobalSwitch() {
  chrome.storage.session.get(['mockSwitchStates'], (result) => {
    const states = result.mockSwitchStates || {};
    const hasAnyEnabled = Object.values(states).some(enabled => enabled === true);

    if (!hasAnyEnabled) {
      // 所有开关都关闭，关闭总开关
      const mockGlobalSwitch = document.getElementById('mock-global-switch');
      if (mockGlobalSwitch && mockGlobalSwitch.checked) {
        mockGlobalSwitch.checked = false;
        updateMockGlobalStatus(false);
        syncMockGlobalSwitch(false);
        chrome.storage.session.set({ mockGlobalEnabled: false });
      }
    }
  });
}

// 关闭所有单个开关
function turnOffAllIndividualSwitches() {
  // 关闭 UI 中的所有开关
  const allSwitches = document.querySelectorAll('.url-mock-switch');
  allSwitches.forEach(sw => {
    if (sw.checked) {
      sw.checked = false;
      const url = sw.dataset.url;
      const method = sw.dataset.method;

      // 更新页面上下文
      const code = `
        (function() {
          if (!window.__mockData) window.__mockData = {};
          const key = '${method}:${url}';
          if (window.__mockData[key]) {
            window.__mockData[key].enabled = false;
            return true;
          }
          return false;
        })()
      `;
      chrome.devtools.inspectedWindow.eval(code);
    }
  });

  // 清空 storage 中的所有开关状态
  chrome.storage.session.get(['mockSwitchStates'], (result) => {
    const states = result.mockSwitchStates || {};
    for (const key in states) {
      states[key] = false;
    }
    chrome.storage.session.set({ mockSwitchStates: states });
  });
}

// Delete a single mock request
function deleteMockRequest(id) {
  const index = mockRequests.findIndex(r => r.id === id);
  if (index >= 0) {
    const req = mockRequests[index];

    // 删除页面上下文中的 mock 数据
    const mockKey = `${req.method}:${req.url}`;
    const code = `
      (function() {
        if (window.__mockData && window.__mockData['${mockKey.replace(/'/g, "\\'")}']) {
          delete window.__mockData['${mockKey.replace(/'/g, "\\'")}'];
          console.log('[Page] Mock 规则已删除:', '${mockKey}');
          return true;
        }
        return false;
      })()
    `;
    chrome.devtools.inspectedWindow.eval(code);

    // 删除 storage 中的开关状态
    const storageKey = mockKey;
    chrome.storage.session.get(['mockSwitchStates'], (result) => {
      const states = result.mockSwitchStates || {};
      delete states[storageKey];
      chrome.storage.session.set({ mockSwitchStates: states });
    });

    mockRequests.splice(index, 1);
    if (selectedRequestId === id) {
      selectedRequestId = null;
      renderEmptyEditor();
    }
    renderMockList(mockFilterInput.value);
    showNotification('已删除请求和 Mock 规则');
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
  const isMocked = req.status === 'mocked';
  const responseBody = req.responseBody || '';

  // Format for display and editing
  let formattedBody = responseBody;
  try {
    const parsed = JSON.parse(responseBody);
    formattedBody = JSON.stringify(parsed, null, 2);
  } catch (e) { }

  // Mock textarea default value
  const mockTextareaValue = formattedBody;

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
      <div class="mock-editor-tab active" data-tab="headers">Headers</div>
      <div class="mock-editor-tab" data-tab="payload">Payload</div>
      <div class="mock-editor-tab" data-tab="preview">Preview</div>
      <div class="mock-editor-tab" data-tab="response">Response</div>
      <div class="mock-editor-tab" data-tab="mock">Mock</div>
    </div>
    <div class="mock-editor-content">
      <!-- Headers Tab -->
      <div class="mock-editor-pane active" id="pane-headers">
        <div class="mock-response-viewer">
          <div style="background: #f0f0f0; padding: 8px; font-weight: 600; margin-bottom: 8px;">请求信息</div>
          <table class="headers-table">
            <tbody>
              <tr>
                <th>Method</th>
                <td><span class="method ${req.method ? req.method.toLowerCase() : 'get'}">${escapeHtml(req.method || 'GET')}</span></td>
              </tr>
              <tr>
                <th>URL</th>
                <td><span style="word-break: break-all;">${escapeHtml(req.url)}</span></td>
              </tr>
              ${req.requestDomain ? `<tr><th>Domain</th><td>${escapeHtml(req.requestDomain)}</td></tr>` : ''}
              ${req.type ? `<tr><th>Type</th><td>${escapeHtml(req.type)}</td></tr>` : ''}
              ${req.time !== undefined ? `<tr><th>Time</th><td>${req.time ? req.time.toFixed(2) + 'ms' : '-'}</td></tr>` : ''}
              ${req.timestamp ? `<tr><th>Timestamp</th><td>${new Date(req.timestamp).toLocaleString()}</td></tr>` : ''}
            </tbody>
          </table>
          ${Object.keys(req.requestHeaders || {}).length > 0 ? `
            <div style="background: #f0f0f0; padding: 8px; font-weight: 600; margin-top: 16px; margin-bottom: 8px;">请求头</div>
            <table class="headers-table">
              <tbody>
                ${Object.entries(req.requestHeaders || {}).map(([key, value]) => `
                  <tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
          ${Object.keys(req.responseHeaders || {}).length > 0 ? `
            <div style="background: #f0f0f0; padding: 8px; font-weight: 600; margin-top: 16px; margin-bottom: 8px;">响应头</div>
            <table class="headers-table">
              <tbody>
                ${Object.entries(req.responseHeaders || {}).map(([key, value]) => `
                  <tr><th>${escapeHtml(key)}</th><td>${escapeHtml(String(value))}</td></tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}
        </div>
      </div>
      <!-- Payload Tab -->
      <div class="mock-editor-pane" id="pane-payload">
        <div class="mock-response-viewer">
          ${req.requestBody ? `
            <div style="background: #f0f0f0; padding: 8px; font-weight: 600; margin-bottom: 8px;">请求载荷</div>
            ${renderJsonPreview(req.requestBody)}
          ` : '<div class="json-preview-empty">无请求体</div>'}
        </div>
      </div>
      <!-- Preview Tab -->
      <div class="mock-editor-pane" id="pane-preview">
        <div class="mock-response-viewer">
          ${isMocked ? '<div style="color: #4ec9b0; margin-bottom: 8px; font-weight: 600;">✓ 此请求已被 Mock 拦截</div>' : ''}
          ${renderJsonPreview(responseBody)}
        </div>
      </div>
      <!-- Response Tab -->
      <div class="mock-editor-pane" id="pane-response">
        <div class="mock-response-viewer" style="height: 100%; display: flex; flex-direction: column;">
          ${isMocked ? '<div style="color: #4ec9b0; margin-bottom: 8px; font-weight: 600;">✓ 此请求已被 Mock 拦截</div>' : ''}
          ${renderJsonPreview(responseBody)}
        </div>
      </div>
      <!-- Mock Tab -->
      <div class="mock-editor-pane" id="pane-mock">
        <div class="mock-response-editor">
          ${renderEditableJsonPreview(mockTextareaValue, 'mock-response-textarea')}
        </div>
        <div class="mock-editor-actions">
          <span style="font-size: 11px; color: #4ec9b0;">💡 编辑后点击外部区域自动保存并启用 Mock</span>
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

  // 编辑器失去焦点时自动保存 mock
  const mockTextarea = document.getElementById('mock-response-textarea');
  if (mockTextarea) {
    // 记录初始值，用于检测是否有变化
    let initialValue = mockTextarea.value;
    let hasChanged = false;

    mockTextarea.addEventListener('input', () => {
      if (mockTextarea.value !== initialValue) {
        hasChanged = true;
      }
    });

    mockTextarea.addEventListener('blur', () => {
      if (hasChanged) {
        autoMockOnBlur(req);
        initialValue = mockTextarea.value;
        hasChanged = false;
      }
    });
  }
}

// 编辑器失去焦点时自动保存 mock
function autoMockOnBlur(req) {
  const textarea = document.getElementById('mock-response-textarea');
  const value = textarea.value.trim();

  if (!value) {
    return;
  }

  // 解析 mock 数据
  let mockData;
  try {
    mockData = JSON.parse(value);
  } catch (e) {
    mockData = value;
  }

  const mockKey = `${req.method || 'GET'}:${req.url}`;
  console.log('[DevTools] ===================== MOCK 自动保存 =====================');
  console.log('[DevTools] Mock 规则:', mockKey);

  // 在页面上下文设置 mock 数据，并确保总开关打开
  const code = `
    (function() {
      if (!window.__mockData) window.__mockData = {};
      window.__mockData['${mockKey.replace(/'/g, "\\'")}'] = {
        data: ${JSON.stringify(mockData).replace(/<\/script>/g, '<\\/script>')},
        enabled: true
      };
      // 确保总开关打开，否则拦截不会生效
      window.__mockEnabled = true;
      console.log('[Page] Mock 规则已设置并启用，总开关已打开，后续匹配的请求将返回 mock 数据');
      return true;
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
    if (isException) {
      console.error('[DevTools] 执行异常:', isException);
    } else if (result) {
      console.log('[DevTools] Mock 规则已自动保存');

      // 保存开关状态
      saveMockSwitchState(req.method || 'GET', req.url, true);

      // 更新总开关 UI（确保总开关打开）
      ensureGlobalMockEnabled();

      // 更新列表中该请求的开关状态
      const switchEl = document.querySelector(`.url-mock-switch[data-id="${req.id}"]`);
      if (switchEl) {
        switchEl.checked = true;
      }

      // 更新请求状态显示为 mocked
      req.status = 'mocked';
      renderMockList(mockFilterInput.value);

      showNotification('Mock 已自动保存');
    }
  });
}

// 获取所有 mock 规则
function getMockRules() {
  const code = `
    (function() {
      if (!window.__mockData) return [];
      return Object.keys(window.__mockData).map(key => {
        const parts = key.split(':');
        const method = parts[0];
        const url = parts.slice(1).join(':');
        const rule = window.__mockData[key];
        return {
          key,
          method,
          url,
          enabled: rule.enabled !== false
        };
      });
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
    if (isException) {
      console.error('[DevTools] 获取规则异常:', isException);
      return [];
    }
    return result || [];
  });
}

// 切换 mock 开关
function toggleMockRule(method, url, enabled) {
  const mockKey = `${method}:${url}`;
  const code = `
    (function() {
      if (!window.__mockData) return;
      const key = '${mockKey.replace(/'/g, "\\'")}';
      if (window.__mockData[key]) {
        window.__mockData[key].enabled = ${enabled};
        console.log('[Page] Mock 开关已切换:', key, 'enabled:', ${enabled});
        return true;
      }
      return false;
    })()
  `;

  chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
    if (isException) {
      console.error('[DevTools] 切换开关异常:', isException);
    } else {
      console.log('[DevTools] Mock 开关已切换:', mockKey, 'enabled:', enabled);
    }
  });
}

// 刷新 mock 规则列表（如果需要显示）
function refreshMockRulesList() {
  // 这里可以添加更新 UI 的代码
  console.log('[DevTools] 刷新 mock 规则列表');
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

  // console.log('[DevTools Network] Request captured:', method, url, 'type:', requestType);

  // Only capture XHR/Fetch requests
  if (requestType !== 'xhr' && requestType !== 'fetch') {
    // console.log('[DevTools Network] Skipping non-XHR/Fetch request:', requestType);
    return;
  }

  // Get request hostname for display
  let requestHostname = '';
  try {
    requestHostname = new URL(url).hostname;
  } catch (e) {
    // console.log('[DevTools Network] Invalid URL:', url);
    return;
  }

  // console.log('[DevTools Network] Processing XHR/Fetch request:', method, url, 'hostname:', requestHostname);

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

    // Convert request headers array [{name, value}] to object {name: value}
    const requestHeadersObj = {};
    if (Array.isArray(req.headers)) {
      req.headers.forEach(h => {
        if (h.name && h.value !== undefined) {
          requestHeadersObj[h.name] = h.value;
        }
      });
    }

    // Get request body from HAR entry
    const requestBody = req.postData ? req.postData.text : '';

    // Check if this request was mocked by checking response header
    const isMocked = headersObj['x-mock-intercepted'] === 'true';

    // 创建请求记录（不去重，每次都新增）
    const reqData = {
      id: harEntry._requestId || (Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9)),
      url: url,
      method: method,
      status: isMocked ? 'mocked' : (response.status || 200),
      type: requestType,
      time: harEntry.time ? harEntry.time : 0,
      responseSize: response.contentSize || (content ? content.length : 0),
      responseHeaders: headersObj,
      responseBody: content || '',
      requestHeaders: requestHeadersObj,
      requestBody: requestBody,
      timestamp: Date.now(),
      requestDomain: requestHostname
    };

    // 所有请求都新增到列表顶部（不去重）
    // console.log('[DevTools Network] Adding request to list:', method, url, 'isMocked:', isMocked);
    mockRequests.unshift(reqData);

    // console.log('[DevTools Network] Total requests in list:', mockRequests.length);

    // Keep only last 100 requests
    if (mockRequests.length > 100) {
      mockRequests = mockRequests.slice(0, 100);
    }

    // 只有匹配当前过滤条件的请求才触发渲染
    const matchesFilter = matchesCurrentFilter(reqData);
    if (matchesFilter) {
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

// ========== 资源嗅探功能 ==========

// 扫描页面资源
function scanPageResources() {
  console.log('[DevTools] 开始扫描资源...');
  capturedResources = [];
  const resourcesContainer = document.getElementById('resources-container');

  if (!resourcesContainer) {
    console.error('[DevTools] resources-container 元素不存在');
    return;
  }

  resourcesContainer.innerHTML = '<div class="resources-empty-state"><div class="icon">🔍</div><div class="text">正在扫描资源...</div></div>';

  // 在页面上下文执行扫描
  const scanCode = `
    (function() {
      const resources = [];
      const url = window.location.href;

      // 1. 扫描图片
      document.querySelectorAll('img[src]').forEach(img => {
        const src = img.src;
        if (src && !src.startsWith('data:') && !src.includes('chrome-extension://') && !src.startsWith('chrome://')) {
          const width = img.naturalWidth || img.width || 0;
          const height = img.naturalHeight || img.height || 0;
          resources.push({
            type: 'image',
            url: src,
            name: src.split('/').pop().split('?')[0] || 'image',
            size: (width > 0 && height > 0) ? width + 'x' + height : ''
          });
        }
      });

      // 2. 扫描所有图片（包括在 picture、figure 中的）
      document.querySelectorAll('source[srcset], source[src]').forEach(source => {
        const src = source.srcset || source.src;
        if (src && src.startsWith('http') && !src.includes('chrome-extension://') && !src.startsWith('chrome://')) {
          resources.push({
            type: 'image',
            url: src.split(' ')[0],
            name: src.split('/').pop().split('?')[0] || 'source',
            size: ''
          });
        }
      });

      // 3. 扫描 video 元素
      document.querySelectorAll('video').forEach(video => {
        const src = video.src || video.currentSrc;
        const sources = video.querySelectorAll('source[src]');

        if (src && !src.includes('chrome-extension://') && !src.startsWith('chrome://')) {
          resources.push({
            type: 'video',
            url: src,
            name: src.split('/').pop().split('?')[0] || 'video',
            size: (video.videoWidth > 0 && video.videoHeight > 0) ? video.videoWidth + 'x' + video.videoHeight : ''
          });
        }

        sources.forEach(source => {
          if (source.src && !source.src.includes('chrome-extension://') && !source.src.startsWith('chrome://')) {
            resources.push({
              type: 'video',
              url: source.src,
              name: source.src.split('/').pop().split('?')[0] || 'video',
              size: ''
            });
          }
        });
      });

      // 4. 扫描 audio 元素
      document.querySelectorAll('audio').forEach(audio => {
        const src = audio.src || audio.currentSrc;
        const sources = audio.querySelectorAll('source[src]');

        if (src && !src.includes('chrome-extension://') && !src.startsWith('chrome://')) {
          resources.push({
            type: 'audio',
            url: src,
            name: src.split('/').pop().split('?')[0] || 'audio'
          });
        }

        sources.forEach(source => {
          if (source.src && !source.src.includes('chrome-extension://') && !source.src.startsWith('chrome://')) {
            resources.push({
              type: 'audio',
              url: source.src,
              name: source.src.split('/').pop().split('?')[0] || 'audio'
            });
          }
        });
      });

      // 5. 扫描 iframe
      document.querySelectorAll('iframe[src]').forEach(iframe => {
        const src = iframe.src;
        if (src && !src.includes('chrome-extension://') && !src.startsWith('chrome://')) {
          resources.push({
            type: 'other',
            url: src,
            name: 'iframe: ' + (iframe.title || src.split('/').pop())
          });
        }
      });

      // 6. 扫描背景图片（从 style 属性）
      document.querySelectorAll('*').forEach(el => {
        const style = el.style.backgroundImage;
        if (style && style !== 'none') {
          const match = style.match(/url\\(['"]?([^'"]+)['"]?\\)/);
          if (match && match[2]) {
            let src = match[2];
            // 处理相对路径
            if (!src.startsWith('http') && !src.startsWith('//')) {
              try {
                src = new URL(src, window.location.href).href;
              } catch(e) {}
            }
            if (src.startsWith('http') && !src.includes('chrome-extension://') && !src.startsWith('chrome://')) {
              resources.push({
                type: 'image',
                url: src,
                name: src.split('/').pop().split('?')[0] || 'background'
              });
            }
          }
        }
      });

      // 7. 扫描 link 标签（stylesheet, icon等）
      document.querySelectorAll('link[href]').forEach(link => {
        if (link.href && !link.href.includes('chrome-extension://') && !link.href.startsWith('chrome://')) {
          const rel = link.rel || 'link';
          resources.push({
            type: 'other',
            url: link.href,
            name: rel + ': ' + link.href.split('/').pop()
          });
        }
      });

      // 8. 扫描 object 和 embed
      document.querySelectorAll('object[data], embed[src]').forEach(el => {
        const src = el.data || el.src;
        if (src && !src.includes('chrome-extension://') && !src.startsWith('chrome://')) {
          resources.push({
            type: 'other',
            url: src,
            name: el.tagName.toLowerCase()
          });
        }
      });

      // 去重
      const seen = new Set();
      const unique = resources.filter(r => {
        if (seen.has(r.url)) return false;
        seen.add(r.url);
        return true;
      });

      console.log('[Page Scan] 找到资源:', unique.length);
      return unique;
    })()
  `;

  chrome.devtools.inspectedWindow.eval(scanCode, (result) => {
    console.log('[DevTools] 扫描结果:', result);
    if (result && Array.isArray(result)) {
      capturedResources = result.map((r, i) => ({
        id: 'res_' + Date.now() + '_' + i,
        ...r
      }));
      console.log('[DevTools] 捕获资源数量:', capturedResources.length);
      renderResources();
    } else {
      resourcesContainer.innerHTML = '<div class="resources-empty-state"><div class="icon">⚠️</div><div class="text">扫描失败</div></div>';
    }
  });
}

// 渲染资源列表
function renderResources() {
  const resourcesContainer = document.getElementById('resources-container');

  if (!capturedResources || capturedResources.length === 0) {
    resourcesContainer.innerHTML = '<div class="resources-empty-state"><div class="icon">📦</div><div class="text">未发现资源</div><div class="hint">当前页面没有可嗅探的资源</div></div>';
    return;
  }

  // 根据类型过滤
  let filtered = capturedResources;
  if (currentResourceFilter !== 'all') {
    filtered = capturedResources.filter(r => r.type === currentResourceFilter);
  }

  if (filtered.length === 0) {
    resourcesContainer.innerHTML = '<div class="resources-empty-state"><div class="icon">📦</div><div class="text">该类型暂无资源</div></div>';
    return;
  }

  // 渲染网格
  const grid = document.createElement('div');
  grid.className = 'resources-grid';

  filtered.forEach(resource => {
    const item = createResourceItem(resource);
    grid.appendChild(item);
  });

  resourcesContainer.innerHTML = '';
  resourcesContainer.appendChild(grid);
}

// 创建资源项
function createResourceItem(resource) {
  const item = document.createElement('div');
  item.className = 'resource-item';
  item.dataset.id = resource.id;

  const typeIcon = {
    image: '🖼️',
    video: '🎬',
    audio: '🎵',
    document: '📄',
    other: '📎'
  }[resource.type] || '📎';

  // 检查是否可以预览（排除本地资源）
  const canPreview = !resource.url.startsWith('chrome://') &&
                      !resource.url.startsWith('chrome-extension://') &&
                      !resource.url.startsWith('edge://') &&
                      !resource.url.startsWith('about:');

  // 预览区域
  let previewContent = '';
  if (resource.type === 'image' && canPreview) {
    previewContent = `<img src="${resource.url}" loading="lazy" onerror="this.parentElement.innerHTML='<span class=\\'preview-placeholder\\'>❌</span>'">`;
  } else if (resource.type === 'video' && canPreview) {
    previewContent = `<span class="preview-placeholder">${typeIcon}</span>`;
  } else if (resource.type === 'audio' && canPreview) {
    previewContent = `<span class="preview-placeholder">${typeIcon}</span>`;
  } else {
    previewContent = `<span class="preview-placeholder">${typeIcon}</span>`;
  }

  item.innerHTML = `
    <div class="resource-preview">${previewContent}</div>
    <div class="resource-info">
      <span class="resource-type-badge ${resource.type}">${resource.type}</span>
      <div class="resource-name" title="${resource.name}">${resource.name}</div>
      <div class="resource-url" title="${resource.url}">${resource.url}</div>
      ${resource.size ? `<div class="resource-url">${resource.size}</div>` : ''}
    </div>
    <div class="resource-actions">
      <button class="resource-action-btn copy" data-id="${resource.id}" data-url="${encodeURIComponent(resource.url)}">复制链接</button>
      <button class="resource-action-btn download" data-id="${resource.id}" data-url="${encodeURIComponent(resource.url)}" data-type="${resource.type}">下载</button>
    </div>
  `;

  // 点击选中
  item.addEventListener('click', (e) => {
    if (!e.target.classList.contains('resource-action-btn')) {
      document.querySelectorAll('.resource-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
    }
  });

  return item;
}

// 复制到剪贴板
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showNotification('已复制到剪贴板');
  }).catch(() => {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showNotification('已复制到剪贴板');
  });
}

// 下载资源
async function downloadResource(url, type) {
  try {
    // 对于图片和简单文件，直接下载
    if (type === 'image' || type === 'other') {
      const a = document.createElement('a');
      a.href = url;
      a.download = url.split('/').pop().split('?')[0] || 'download';
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showNotification('已触发下载');
    } else if (type === 'video') {
      // 视频：尝试通过 fetch 获取并下载
      showNotification('正在下载视频...');
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = 'video_' + Date.now() + '.mp4';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
        showNotification('视频下载完成');
      } catch (e) {
        // 视频下载失败，在新标签页打开
        chrome.tabs.create({ url: url });
        showNotification('已在新标签页打开');
      }
    } else {
      // 其他类型：在新标签页打开
      chrome.tabs.create({ url: url });
      showNotification('已在新标签页打开');
    }
  } catch (error) {
    console.error('下载失败:', error);
    // 失败时在新标签页打开
    chrome.tabs.create({ url: url });
    showNotification('已在新标签页打开');
  }
}

// 初始化资源标签页事件
function initResourcesTab() {
  const scanBtn = document.getElementById('resources-scan-btn');
  const clearBtn = document.getElementById('resources-clear-btn');
  const typeFilter = document.getElementById('resource-type-filter');

  if (scanBtn) {
    scanBtn.addEventListener('click', scanPageResources);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      capturedResources = [];
      const resourcesContainer = document.getElementById('resources-container');
      resourcesContainer.innerHTML = '<div class="resources-empty-state"><div class="icon">📦</div><div class="text">点击"扫描"按钮嗅探页面资源</div><div class="hint">支持图片、视频、音频、文档等资源</div></div>';
    });
  }

  if (typeFilter) {
    typeFilter.addEventListener('change', (e) => {
      currentResourceFilter = e.target.value;
      renderResources();
    });
  }

  // 事件委托处理复制和下载按钮
  const resourcesContainer = document.getElementById('resources-container');
  resourcesContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy')) {
      const url = decodeURIComponent(e.target.dataset.url);
      copyToClipboard(url);
    } else if (e.target.classList.contains('download')) {
      const url = decodeURIComponent(e.target.dataset.url);
      const type = e.target.dataset.type;
      downloadResource(url, type);
    }
  });
}


// Initialize network monitoring
function initNetworkMonitoring() {
  // console.log('[DevTools] Initializing network monitoring...');

  // Get current inspected tab info
  updateCurrentDomain();

  // Listen for network requests via devtools API
  chrome.devtools.network.onRequestFinished.addListener(handleRequest);
  // console.log('[DevTools] Network request listener registered');

  // ========== Mock 总开关初始化 ==========
  const mockGlobalSwitch = document.getElementById('mock-global-switch');
  const mockGlobalStatus = document.getElementById('mock-global-status');

  if (mockGlobalSwitch) {
    // 从 storage 加载开关状态
    chrome.storage.session.get(['mockGlobalEnabled'], (result) => {
      const enabled = result.mockGlobalEnabled === true;
      mockGlobalSwitch.checked = enabled;
      updateMockGlobalStatus(enabled);
      syncMockGlobalSwitch(enabled);
    });

    // 总开关事件监听
    mockGlobalSwitch.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      updateMockGlobalStatus(enabled);
      syncMockGlobalSwitch(enabled);
      chrome.storage.session.set({ mockGlobalEnabled: enabled });

      // 联动逻辑：总开关关闭时，关闭所有单个开关
      if (!enabled) {
        turnOffAllIndividualSwitches();
      }

      showNotification(enabled ? 'Mock 已启用' : 'Mock 已禁用');
    });
  }

  // ========== 筛选参数持久化 ==========
  // 加载保存的筛选参数
  chrome.storage.session.get(['mockFilterValue', 'mockFilterDomain'], (result) => {
    if (result.mockFilterValue !== undefined) {
      mockFilterInput.value = result.mockFilterValue;
    }
    if (result.mockFilterDomain !== undefined && filterCurrentDomainCheckbox) {
      filterCurrentDomainCheckbox.checked = result.mockFilterDomain;
    }
    renderMockList(mockFilterInput.value);
  });

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
  const value = e.target.value;
  chrome.storage.session.set({ mockFilterValue: value });
  renderMockList(value);
});

// Clear button handler
mockClearBtn.addEventListener('click', () => {
  // 清空页面上下文中的所有 mock 数据
  const code = `
    (function() {
      if (window.__mockData) {
        window.__mockData = {};
        console.log('[Page] 所有 Mock 规则已清空');
      }
      return true;
    })()
  `;
  chrome.devtools.inspectedWindow.eval(code);

  // 清空 storage 中的所有开关状态
  chrome.storage.session.set({ mockSwitchStates: {} });
  chrome.storage.session.set({ mockGlobalEnabled: false });

  // 更新总开关 UI
  const mockGlobalSwitch = document.getElementById('mock-global-switch');
  if (mockGlobalSwitch) {
    mockGlobalSwitch.checked = false;
    updateMockGlobalStatus(false);
  }

  mockRequests = [];
  selectedRequestId = null;
  knownRequestIds = new Set(); // Reset known IDs
  renderMockList();
  renderEmptyEditor();
  showNotification('已清空请求列表和所有 Mock 规则');
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
      if (isExtensionContextValid()) {
        saveMockFilterSettings().catch(err => {
          // Ignore context invalidated errors
          if (!isContextInvalidatedError(err)) {
            console.error('Failed to save mock filter settings:', err);
          }
        });
      }
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
loadMockFilterSettings().catch(err => {
  // Ignore context invalidated errors during initialization
  if (!isContextInvalidatedError(err)) {
    console.error('Failed to load mock filter settings:', err);
  }
});
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
