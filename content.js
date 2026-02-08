// Content script runs in the context of the web page
// Can access and modify the DOM

console.log('Extension content script loaded');

// Get extension settings from storage
let settings = {
  enabled: false,
  debugMode: false
};

// Collected URLs set (for deduplication)
const collectedUrls = new Set();

// Throttle timer for printing URLs
let printTimer = null;
const PRINT_THROTTLE_DELAY = 3000; // 3 seconds

// Throttled print function
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
  const result = await chrome.storage.sync.get('settings');
  if (result.settings) {
    settings = { ...settings, ...result.settings };
    console.log('Settings loaded:', settings);
  }
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle hide elements update
  if (message.type === 'UPDATE_HIDE_ELEMENTS') {
    const { enabled, selectors } = message;
    updateHideElements(enabled, selectors);
    sendResponse({ success: true, message: '隐藏元素设置已更新' });
    return true;
  }

  // Handle extension toggle
  if (message.type === 'TOGGLE_EXTENSION') {
    settings.enabled = message.enabled;
    settings.debugMode = message.debugMode || false;
    sendResponse({ success: true });
    return true;
  }

  // Return false for unhandled messages (let other scripts handle them)
  return false;
});

// Intercept fetch calls to collect URLs and check domain blocking
if (!window._originalFetch) {
  window._originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    // Check if URL should be blocked
    const currentDomain = new URL(window.location.href).hostname;
    const requestDomain = new URL(url).hostname;

    try {
      const result = await chrome.runtime.sendMessage({
        type: 'CHECK_DOMAIN_BLOCKED',
        currentDomain: currentDomain,
        requestDomain: requestDomain
      });

      if (result.blocked) {
        // Log blocked request in debug mode
        if (settings.debugMode) {
          console.log(`Fetch blocked: ${url}`, result);
        }

        // Return a rejected promise with error
        return Promise.reject(new Error(`API request blocked: ${result.blockedReason}`));
      }

      // Collect unblocked URLs (deduplicated)
      if (typeof url === 'string' && !collectedUrls.has(url)) {
        collectedUrls.add(url);
        throttledPrintUrls();
      }

      // If not blocked, proceed with original fetch
      return window._originalFetch(url, options);
    } catch (error) {
      // If message sending fails, proceed with original fetch
      return window._originalFetch(url, options);
    }
  };
}

// ========== Hide Elements Functionality ==========
// Style tag ID for identification
const HIDE_ELEMENTS_STYLE_ID = 'extension-hide-elements-style';

// State management for hide elements
let hideElementsState = {
  enabled: false,
  selectors: []
};

/**
 * Apply hide elements by creating/updating style tag
 * @param {string[]} selectors - CSS selectors to hide
 */
function applyHideElementsStyle(selectors) {
  // Remove existing style tag if present
  const existingStyle = document.getElementById(HIDE_ELEMENTS_STYLE_ID);
  if (existingStyle) {
    existingStyle.remove();
  }

  // If no selectors, don't create new style tag
  if (!selectors || selectors.length === 0) {
    return;
  }

  // Create and insert new style tag
  const style = document.createElement('style');
  style.id = HIDE_ELEMENTS_STYLE_ID;

  // Build CSS rules
  const cssRules = selectors
    .filter(s => s && s.trim())
    .map(selector => `${selector} { display: none !important; }`)
    .join('\n');

  style.textContent = cssRules;
  document.head?.appendChild(style) || document.documentElement.appendChild(style);

  console.log(`[隐藏元素] 已应用隐藏规则，共 ${selectors.length} 个选择器`);
}

/**
 * Get current domain
 * @returns {string|null} Current domain or null
 */
function getCurrentDomain() {
  try {
    return window.location.hostname;
  } catch (error) {
    console.error('[隐藏元素] 获取域名失败:', error);
    return null;
  }
}

/**
 * Update hide elements settings (domain-specific)
 * @param {boolean} enabled - Whether hide elements is enabled
 * @param {string[]} selectors - CSS selectors to hide
 */
function updateHideElements(enabled, selectors) {
  console.log('[隐藏元素] 更新设置:', { enabled, selectors });

  // Update state
  hideElementsState.enabled = enabled;
  hideElementsState.selectors = selectors;

  // Apply or remove style based on enabled state
  if (enabled && selectors && selectors.length > 0) {
    applyHideElementsStyle(selectors);
  } else {
    // Remove style tag if disabled or no selectors
    const existingStyle = document.getElementById(HIDE_ELEMENTS_STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
      console.log('[隐藏元素] 已移除隐藏规则');
    }
  }

  // Save to storage for persistence (domain-specific)
  const domain = getCurrentDomain();
  if (domain) {
    chrome.storage.local.get(['hideElementsSettings'], (result) => {
      const allSettings = result.hideElementsSettings || {};
      allSettings[domain] = { enabled, selectors };
      chrome.storage.local.set({ hideElementsSettings: allSettings }).catch(() => { });
    });
  }
}

/**
 * Initialize hide elements from storage (domain-specific)
 */
async function initHideElements() {
  try {
    const domain = getCurrentDomain();
    if (!domain) {
      console.log('[隐藏元素] 无法获取当前域名，跳过初始化');
      return;
    }

    const result = await chrome.storage.local.get(['hideElementsSettings']);
    const allSettings = result.hideElementsSettings || {};
    const settings = allSettings[domain];

    if (settings && settings.enabled) {
      updateHideElements(settings.enabled, settings.selectors || []);
      console.log(`[隐藏元素] 已加载 ${domain} 的设置:`, settings);
    }
  } catch (error) {
    console.error('[隐藏元素] 初始化失败:', error);
  }
}

// Initialize hide elements on script load
initHideElements();

// Expose functions to page context via window object (if needed)
window.ExtensionAPI = {
  isEnabled: () => settings.enabled,
  getVersion: () => chrome.runtime.getManifest().version,
};

// Initialize
loadSettings().catch(console.error);

// Listen for storage changes from other contexts
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync' && changes.settings) {
    settings = { ...settings, ...changes.settings.newValue };
  }
});