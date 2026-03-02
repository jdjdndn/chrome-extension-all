// Content script runs in the context of the web page
// Can access and modify the DOM
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

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
 * Apply hide elements by creating/updating style tag
 */
function applyHideElementsStyle(selectors) {
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
 */
async function initHideElements() {
  const domain = DOMUtils.getCurrentDomain();
  if (!domain) {
    console.log('[隐藏元素] 无法获取当前域名，跳过初始化');
    return;
  }

  const defaultSelectors = getDomainDefaultHideSelectors();
  const settings = await StorageUtils.getDomainSettings('hideElementsSettings', domain);

  if (settings && settings.enabled) {
    const mergedSelectors = [...new Set([...defaultSelectors, ...(settings.selectors || [])])];
    updateHideElements(settings.enabled, mergedSelectors);
    console.log(`[隐藏元素] 已加载 ${domain} 的设置:`, { enabled: settings.enabled, selectors: mergedSelectors });
  } else if (defaultSelectors.length > 0) {
    hideElementsState.selectors = defaultSelectors;
    console.log(`[隐藏元素] ${domain} 有默认选择器:`, defaultSelectors);
  }
}

// Initialize hide elements
initHideElements();

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

  // 如果是元素选择变化消息
  if (message.type === 'ELEMENT_SELECTION_CHANGED') {
    // 转发给 devtools
    chrome.runtime.sendMessage({
      type: 'ELEMENT_SELECTION_CHANGED',
      elements: message.elements || []
    }).catch(() => {});

    // 如果有元素，保存最新选中的元素到临时存储
    if (message.elements && message.elements.length > 0) {
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
  }

  // 转发所有消息到 background，供 DevTools 轮询获取
  MessagingUtils.sendToBackground({
    type: 'PICKER_MESSAGE_RELAY',
    data: message
  }).catch(() => {});
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
