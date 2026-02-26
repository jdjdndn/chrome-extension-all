// Content script runs in the context of the web page
// Can access and modify the DOM
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

// ========== Inject Page Context Script ==========
// Inject the script into the page context to intercept XHR/Fetch at page level
(function() {
  // Check if already injected to avoid duplicate injection
  if (window._injectScriptInjected) return;
  window._injectScriptInjected = true;

  const script = document.createElement('script');
  script.src = chrome.runtime.getURL('inject.js');
  script.onload = function() {
    this.remove();
  };
  (document.head || document.documentElement).appendChild(script);
})();

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

// ========== Mock Rules ==========
// Simple structure: URL -> mock response (deleted after use)
let mockRules = {};

// Clear mock rules on page load (they should only last for one request within a session)
async function initMockRules() {
  try {
    // Clear any stale mock rules from storage
    mockRules = {};
    await chrome.storage.local.set({ mockRules });
  } catch (e) {
    console.error('[Mock] Failed to clear mock rules:', e);
  }
}

// Get and consume mock response for URL (deletes after use)
function getMockResponse(url) {
  try {
    const urlObj = new URL(url);
    const urlPath = urlObj.origin + urlObj.pathname;

    // Check exact match
    if (mockRules.hasOwnProperty(urlPath)) {
      const mockData = mockRules[urlPath];
      // Delete after use (one-time mock)
      delete mockRules[urlPath];
      chrome.storage.local.set({ mockRules }).catch(() => {});
      if (settings.debugMode) {
        console.log('[Mock] Mock used and removed:', urlPath);
      }
      return mockData;
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Initial load - clear stale mock rules
initMockRules();

// Listen for storage changes to update mock rules
StorageUtils.onChanged((changes, areaName) => {
  if (areaName === 'local' && changes.mockRules) {
    mockRules = changes.mockRules.newValue || {};
  }
});

// ========== Fetch Interception ==========
if (!window._originalFetch) {
  window._originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    try {
      const urlString = typeof url === 'string' ? url : url.url;

      // Check for mock response first
      const mockData = getMockResponse(urlString);
      if (mockData !== null) {
        if (settings.debugMode) {
          console.log('[Mock] Intercepting fetch:', urlString);
        }
        const responseBody = typeof mockData === 'string' ? mockData : JSON.stringify(mockData);
        return new Response(responseBody, {
          status: 200,
          statusText: 'OK',
          headers: {
            'Content-Type': 'application/json',
            'X-Mock-Intercepted': 'true'
          }
        });
      }

      const currentDomain = new URL(window.location.href).hostname;
      const requestDomain = new URL(urlString).hostname;

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

      return await window._originalFetch(url, options);
    } catch (error) {
      return window._originalFetch(url, options);
    }
  };
}

// ========== XMLHttpRequest Interception ==========
if (!window._originalXHR) {
  window._originalXHR = window.XMLHttpRequest;

  window.XMLHttpRequest = function() {
    const xhr = new window._originalXHR();
    let _url = '';
    let _method = 'GET';

    const originalOpen = xhr.open;
    const originalSend = xhr.send;

    xhr.open = function(method, url, ...args) {
      _url = url;
      _method = method;
      return originalOpen.call(this, method, url, ...args);
    };

    xhr.send = function(body) {
      // Check for mock response
      const mockData = getMockResponse(_url);
      if (mockData !== null) {
        if (settings.debugMode) {
          console.log('[Mock] Intercepting XHR:', _url);
        }

        const responseBody = typeof mockData === 'string' ? mockData : JSON.stringify(mockData);

        // Simulate async response
        setTimeout(() => {
          Object.defineProperty(xhr, 'status', { value: 200, writable: false });
          Object.defineProperty(xhr, 'readyState', { value: 4, writable: false });
          Object.defineProperty(xhr, 'responseText', { value: responseBody, writable: false });
          Object.defineProperty(xhr, 'response', { value: responseBody, writable: false });

          xhr.getResponseHeader = function(header) {
            if (header.toLowerCase() === 'content-type') {
              return 'application/json';
            }
            if (header.toLowerCase() === 'x-mock-intercepted') {
              return 'true';
            }
            return null;
          };

          if (xhr.onreadystatechange) xhr.onreadystatechange();
          if (xhr.onload) xhr.onload();
          xhr.dispatchEvent(new Event('load'));
          xhr.dispatchEvent(new Event('readystatechange'));
        }, 10);

        return;
      }

      return originalSend.call(this, body);
    };

    return xhr;
  };

  // Copy static properties
  window.XMLHttpRequest.UNSENT = 0;
  window.XMLHttpRequest.OPENED = 1;
  window.XMLHttpRequest.HEADERS_RECEIVED = 2;
  window.XMLHttpRequest.LOADING = 3;
  window.XMLHttpRequest.DONE = 4;
}
