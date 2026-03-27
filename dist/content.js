// Content script runs in the context of the web page
// Can access and modify the DOM
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// 核心: content/core/store.js, content/core/services.js, content/core/pipeline.js

'use strict';

// 防止重复注入
if (window._contentScriptLoaded) {
  console.log('[Extension] Content script already loaded, skipping');
  throw new Error('Content script already loaded');
}
window._contentScriptLoaded = true;

// ========== 懒初始化支持 ==========
// 使用 LazyInitManager 进行分层懒初始化
// L1: 基础层 - 立即初始化（EventBus、Logger、Storage）
// L2: 核心层 - 懒初始化（Store、Services、Pipeline）
// L3: DevTools层 - DevTools 打开时初始化
// L4: 功能层 - 首次使用时初始化

let storeReady = false;

/**
 * 注册 L2 核心层初始化回调
 */
function registerL2InitCallbacks() {
  if (!window.LazyInitManager) return;

  // Store 初始化
  LazyInitManager.registerInitCallback('L2', async () => {
    if (typeof AppStore !== 'undefined' && !storeReady) {
      try {
        await AppStore.init({
          storageArea: 'local',
          storageKey: 'contentState',
          initialState: {
            enabled: false,
            debugMode: false,
            hideElements: { enabled: false, selectors: [] }
          }
        });
        storeReady = true;
        console.log('[Content] Store 初始化完成');
      } catch (e) {
        console.warn('[Content] Store 初始化失败:', e);
      }
    }
  }, 'Store初始化');
}

/**
 * 注册 L4 功能层初始化回调
 */
function registerL4InitCallbacks() {
  if (!window.LazyInitManager) return;

  // 隐藏元素功能初始化
  LazyInitManager.registerInitCallback('L4', async () => {
    await initHideElements();
    console.log('[Content] 隐藏元素功能初始化完成');
  }, '隐藏元素初始化');
}

// 立即注册回调（不执行）
registerL2InitCallbacks();
registerL4InitCallbacks();

// ========== Inject Page Context Script ==========
// Inject the script into the page context to intercept XHR/Fetch at page level
function injectPageScript() {
  // Check if already injected to avoid duplicate injection
  if (window._injectScriptInjected) return;
  window._injectScriptInjected = true;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
}

// 立即尝试注入
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', injectPageScript);
} else {
  injectPageScript();
}

// ========== Domain-specific Default Hide Selectors ==========
const DOMAIN_DEFAULT_HIDE_SELECTORS = {
  '4hu.tv': ['.kkm-content'],
  'www.4hu.tv': ['.kkm-content']
};

/**
 * Get default hide selectors for current domain
 */
function getDomainDefaultHideSelectors() {
  // 安全检查 DOMUtils 是否可用
  if (typeof DOMUtils === 'undefined' || !DOMUtils.getCurrentDomain) {
    console.warn('[Content] DOMUtils 未加载，无法获取域名');
    return [];
  }
  const domain = DOMUtils.getCurrentDomain();
  return DOMAIN_DEFAULT_HIDE_SELECTORS[domain] || [];
}

// ========== Domain-specific Script Loading ==========
// 域名脚本通过 manifest.json 的 content_scripts 配置加载
// 此处仅保留注释说明，实际加载由 manifest.json 管理

console.log('[Extension] Extension content script loaded');

// Extension settings
let settings = {
  enabled: false,
  debugMode: false
};

// Collected URLs set (for deduplication)
const collectedUrls = new Set();
let printTimer = null;
const PRINT_THROTTLE_DELAY = 3000;

function throttledPrintUrls() {
  if (printTimer || !settings.debugMode) return;

  printTimer = setTimeout(() => {
    if (collectedUrls.size > 0) {
      console.log('=== Unblocked URLs collected ===');
      console.log(`Total: ${collectedUrls.size} URLs`);
      console.log(Array.from(collectedUrls));
      console.log('================================');
    }
    printTimer = null;
  }, PRINT_THROTTLE_DELAY);
}

// Load settings from storage
async function loadSettings() {
  const result = await StorageUtils.getSync('settings');
  if (result.settings) {
    settings = { ...settings, ...result.settings };
    console.log('Settings loaded:', settings);
  }
}

// ========== Hide Elements Functionality ==========
const HIDE_ELEMENTS_STYLE_ID = 'extension-hide-elements-style';

let hideElementsState = {
  enabled: false,
  selectors: []
};

/**
 * 安全检查 DOMUtils 是否可用
 */
function isDOMUtilsReady() {
  if (typeof DOMUtils === 'undefined') {
    // 静默返回，不显示警告（因为在某些时序下这是正常的）
    return false;
  }
  return true;
}

/**
 * Apply hide elements by creating/updating style tag
 */
function applyHideElementsStyle(selectors) {
  if (!isDOMUtilsReady()) return;

  if (!selectors || selectors.length === 0) {
    DOMUtils.removeStyle(HIDE_ELEMENTS_STYLE_ID);
    return;
  }

  DOMUtils.applyHideStyle(HIDE_ELEMENTS_STYLE_ID, selectors);
  console.log(`[隐藏元素] 已应用隐藏规则，共 ${selectors.length} 个选择器`);
}

/**
 * Update hide elements settings
 */
function updateHideElements(enabled, selectors) {
  console.log('[隐藏元素] 更新设置:', { enabled, selectors });

  hideElementsState.enabled = enabled;
  hideElementsState.selectors = selectors;

  if (!isDOMUtilsReady()) return;

  if (enabled && selectors && selectors.length > 0) {
    applyHideElementsStyle(selectors);
  } else {
    DOMUtils.removeStyle(HIDE_ELEMENTS_STYLE_ID);
    console.log('[隐藏元素] 已移除隐藏规则');
  }

  // Save to storage
  const domain = DOMUtils.getCurrentDomain();
  if (domain) {
    StorageUtils.setDomainSettings('hideElementsSettings', domain, { enabled, selectors });
  }
}

/**
 * Initialize hide elements from storage
 * 分功能控制：默认选择器始终自动应用，用户自定义选择器根据设置决定
 */
async function initHideElements() {
  if (!isDOMUtilsReady()) {
    console.log('[隐藏元素] DOMUtils 未就绪，跳过初始化');
    return;
  }

  const domain = DOMUtils.getCurrentDomain();
  if (!domain) {
    console.log('[隐藏元素] 无法获取当前域名，跳过初始化');
    return;
  }

  const defaultSelectors = getDomainDefaultHideSelectors();
  const domainSettings = await StorageUtils.getDomainSettings('hideElementsSettings', domain);

  // 尝试从本地服务器加载选择器
  let serverSelectors = [];
  try {
    const normalizedDomain = domain.startsWith('www.') ? domain.slice(4) : domain;
    const response = await fetch(`http://localhost:3000/api/data/selectors/${normalizedDomain}`, {
      signal: AbortSignal.timeout(1000)
    });
    const data = await response.json();
    if (data.success && data.data) {
      if (Array.isArray(data.data)) {
        serverSelectors = data.data;
      } else if (typeof data.data === 'string' && data.data.trim()) {
        serverSelectors = data.data.split(',').map(s => s.trim()).filter(s => s);
      }
      if (serverSelectors.length > 0) {
        console.log(`[隐藏元素] ${domain} 从本地服务器加载选择器:`, serverSelectors.length, '个');
      }
    }
  } catch (e) {
    // 忽略本地服务器错误
  }

  // 获取用户自定义选择器
  const userSelectors = domainSettings?.selectors || [];

  // 合并：默认 + 本地服务器 + 用户添加
  const mergedSelectors = [...new Set([...defaultSelectors, ...serverSelectors, ...userSelectors])];

  // 应用合并后的选择器
  applyHideElementsStyle(mergedSelectors);
  hideElementsState.selectors = mergedSelectors;

  console.log(`[隐藏元素] ${domain} 合并后选择器:`, mergedSelectors.length, '个 (默认:', defaultSelectors.length, ', 服务器:', serverSelectors.length, ', 用户:', userSelectors.length, ')');
}

// Initialize hide elements - 延迟到激活时初始化
// initHideElements(); // 移除立即初始化
console.log('[Content] 隐藏元素功能已注册为懒初始化');

// Expose API
window.ExtensionAPI = {
  isEnabled: () => settings.enabled,
  getVersion: () => chrome.runtime.getManifest().version,
};

// Initialize
loadSettings().catch(console.error);

// Listen for storage changes
StorageUtils.onChanged((changes, areaName) => {
  if (areaName === 'sync' && changes.settings) {
    settings = { ...settings, ...changes.settings.newValue };
  }
});

// ========== Message Handler ==========
MessagingUtils.createMessageHandler('content_main_handler', {
  // ========== 激活消息处理 ==========
  'EXTENSION_ACTIVATE': async (message) => {
    const source = message.source || 'unknown';
    console.log(`[Content] 收到激活消息 (来源: ${source})`);

    if (window.LazyInitManager) {
      const result = await LazyInitManager.activate(source);
      console.log('[Content] 激活结果:', result);
    }

    return { success: true, activated: true };
  },

  'DEVTOOLS_ACTIVATE': async (message) => {
    console.log('[Content] 收到 DevTools 激活消息');

    if (window.LazyInitManager) {
      await LazyInitManager.onDevToolsOpen();
      console.log('[Content] DevTools 激活完成');
    }

    return { success: true };
  },

  'GET_LAZY_INIT_STATE': () => {
    if (window.LazyInitManager) {
      return { success: true, state: LazyInitManager.getState() };
    }
    return { success: false, error: 'LazyInitManager 未加载' };
  },

  'GET_DEFAULT_HIDE_SELECTORS': () => {
    const selectors = getDomainDefaultHideSelectors();
    console.log('[Content] 返回默认隐藏选择器:', selectors);
    return { success: true, selectors };
  },

  'GET_CURRENT_HIDE_SELECTORS': () => {
    return { success: true, selectors: hideElementsState.selectors };
  },

  'UPDATE_HIDE_ELEMENTS': (message) => {
    const { enabled, selectors } = message;
    updateHideElements(enabled, selectors);
    return { success: true, message: '隐藏元素设置已更新' };
  },

  'TOGGLE_EXTENSION': (message) => {
    settings.enabled = message.enabled;
    settings.debugMode = message.debugMode || false;
    return { success: true };
  },

  // ========== 元素拾取器消息处理 ==========
  'START_ELEMENT_PICKER': () => {
    // 注入元素拾取器脚本
    injectElementPickerScript();
    return { success: true };
  },

  'STOP_ELEMENT_PICKER': () => {
    // 发送停止命令到注入脚本
    const event = new CustomEvent('element-picker-command', {
      detail: { action: 'STOP' },
      bubbles: true
    });
    document.dispatchEvent(event);
    return { success: true };
  }
});

// ========== 元素拾取器脚本注入 ==========
function injectElementPickerScript() {
  // 检查注入脚本是否有效（不仅仅是标志位）
  // 扩展重新加载后，旧的注入脚本会失效
  if (window._elementPickerInjected && window.ElementPickerInject) {
    // 验证注入脚本是否仍然有效
    try {
      // 尝试访问注入脚本的方法，如果失效会抛出错误
      const isValid = typeof window.ElementPickerInject.start === 'function';
      if (isValid) {
        const event = new CustomEvent('element-picker-command', {
          detail: { action: 'START' },
          bubbles: true
        });
        document.dispatchEvent(event);
        return;
      }
    } catch (e) {
      window._elementPickerInjected = false;
      window.ElementPickerInject = null;
    }
  }

  // 需要注入脚本
  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('content/element-picker-inject.js');
  script.onload = function() {
    this.remove();
    window._elementPickerInjected = true;

    // 发送启动命令
    setTimeout(() => {
      const event = new CustomEvent('element-picker-command', {
        detail: { action: 'START' },
        bubbles: true
      });
      document.dispatchEvent(event);
    }, 100);
  };
  (document.head || document.documentElement).appendChild(script);
}

// 监听来自元素拾取器注入脚本的消息
document.addEventListener('element-picker-message', (event) => {
  const message = event.detail;
  console.log('[Content] 收到元素拾取器消息:', message.type);

  // 直接转发到 background，由 background 处理
  chrome.runtime.sendMessage({
    type: 'PICKER_MESSAGE_RELAY',
    data: message
  }).then((response) => {
    console.log('[Content] PICKER_MESSAGE_RELAY 成功:', response);
  }).catch((e) => {
    console.warn('[Content] PICKER_MESSAGE_RELAY 失败:', e);
  });

  // 如果是元素选择变化消息，也保存到临时存储
  if (message.type === 'ELEMENT_SELECTION_CHANGED' && message.elements?.length > 0) {
    console.log('[Content] 元素选择变化, 数量:', message.elements.length);

    // 保存最新选中的元素到临时存储
    const latestElement = message.elements[message.elements.length - 1];
    chrome.storage.local.set({
      pendingPickedElement: {
        selector: latestElement.selector,
        matchCount: latestElement.matchCount || 1,
        tagName: latestElement.tagName,
        id: latestElement.id,
        className: latestElement.className,
        timestamp: Date.now()
      }
    });

    // 尝试发送给 popup（如果还在打开状态）
    chrome.runtime.sendMessage({
      type: 'ELEMENT_PICKED',
      data: latestElement
    }).catch(() => {});
  }
});

// ========== Fetch Interception ==========
// For domain blocking and URL collection (mocking handled by inject.js)
if (!window._originalFetch) {
  window._originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    try {
      const urlString = typeof url === 'string' ? url : url.url;

      // Domain blocking check
      const currentDomain = new URL(window.location.href).hostname;
      const requestDomain = new URL(urlString).hostname;

      const result = await MessagingUtils.checkDomainBlocked(currentDomain, requestDomain);

      if (result && result.blocked) {
        if (settings.debugMode) {
          console.log(`Fetch blocked: ${url}`, result);
        }
        return Promise.reject(new Error(`API request blocked: ${result.blockedReason}`));
      }

      // URL collection
      if (typeof url === 'string' && !collectedUrls.has(url)) {
        collectedUrls.add(url);
        throttledPrintUrls();
      }

      return await window._originalFetch(url, options);
    } catch (error) {
      return window._originalFetch(url, options);
    }
  };
}
