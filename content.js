// Content script runs in the context of the web page
// Can access and modify the DOM
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

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
  }
});

// ========== Fetch Interception ==========
if (!window._originalFetch) {
  window._originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    try {
      const currentDomain = new URL(window.location.href).hostname;
      const requestDomain = new URL(url).hostname;

      const result = await MessagingUtils.checkDomainBlocked(currentDomain, requestDomain);

      if (result && result.blocked) {
        if (settings.debugMode) {
          console.log(`Fetch blocked: ${url}`, result);
        }
        return Promise.reject(new Error(`API request blocked: ${result.blockedReason}`));
      }

      if (typeof url === 'string' && !collectedUrls.has(url)) {
        collectedUrls.add(url);
        throttledPrintUrls();
      }

      return window._originalFetch(url, options);
    } catch (error) {
      return window._originalFetch(url, options);
    }
  };
}
