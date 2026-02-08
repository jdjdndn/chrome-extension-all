// Content script for 4hu.tv
// Hide elements with class .kkm-content

"use strict";

// ========== 全局命名空间 ==========
// 使用 window 对象存储初始化状态，防止重复初始化
if (!window.Hu4Script) {
  window.Hu4Script = {};
}
if (!window.Hu4Script.isInitialized) {
  window.Hu4Script.isInitialized = false;
}

// Style tag ID for identification
const STYLE_TAG_ID = 'kkm-content-hide-style';

// State management
let observer = null;
let currentSelectors = []; // Will be initialized from DEFAULT_HIDE_SELECTORS or storage

// ========== Hide Elements Default Selectors ==========
// 默认隐藏元素选择器列表（4hu.tv 专用）
const DEFAULT_HIDE_SELECTORS = [
  '.kkm-content'  // 4hu.tv 默认隐藏的元素
];

/**
 * Update hide elements by creating/updating style tag
 * @param {string[]} selectors - Array of CSS selectors to hide
 */
function updateHideElements(selectors) {
  // Remove existing style tag if present
  const existingStyle = document.getElementById(STYLE_TAG_ID);
  if (existingStyle) {
    existingStyle.remove();
  }

  // Update current selectors
  currentSelectors = selectors && selectors.length > 0 ? selectors : [];

  // Create and insert new style tag with all selectors
  if (currentSelectors.length > 0) {
    const style = document.createElement('style');
    style.id = STYLE_TAG_ID;
    // Generate CSS rules for all selectors
    const cssRules = currentSelectors
      .map(selector => `${selector} { display: none !important; }`)
      .join('\n');
    style.textContent = cssRules;
    document.head.appendChild(style);
    console.log('[4hu脚本] 已隐藏元素:', currentSelectors);
  }
}

// Legacy function name for backward compatibility
function hideKkmContent() {
  updateHideElements(DEFAULT_HIDE_SELECTORS);
}

// Function to auto-click #tiaozhuan element
function autoClickTiaozhuan() {
  const tiaozhuan = document.querySelector('#tiaozhuan');
  if (tiaozhuan) {
    tiaozhuan.click();
    console.log('[4hu脚本] 已自动点击 #tiaozhuan');
  }
}

// Use MutationObserver to handle dynamically added #tiaozhuan element
function setupObserver() {
  // Disconnect existing observer if any
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) { // Element node
          // Check if the added node is #tiaozhuan
          if (node.id === 'tiaozhuan') {
            node.click();
            console.log('[4hu脚本] 已自动点击动态添加的 #tiaozhuan');
          }
          // Check children for #tiaozhuan
          const tiaozhuanInChildren = node.querySelectorAll?.('#tiaozhuan');
          tiaozhuanInChildren?.forEach(el => {
            el.click();
            console.log('[4hu脚本] 已自动点击子节点中的 #tiaozhuan');
          });
        }
      });
    });
  });

  observer.observe(document.body || document.documentElement, {
    childList: true,
    subtree: true
  });
}

// Cleanup function before reload
function cleanup() {
  console.log('[4hu脚本] 清理状态...');
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  window.Hu4Script.isInitialized = false;
}

/**
 * Get current domain's hide elements settings from storage
 */
async function loadDomainHideSettings() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    // Fallback to default if not in extension context
    updateHideElements(DEFAULT_HIDE_SELECTORS);
    return;
  }

  try {
    const hostname = window.location.hostname;
    const result = await chrome.storage.local.get(['hideElementsSettings']);
    const allSettings = result.hideElementsSettings || {};

    if (allSettings[hostname] && allSettings[hostname].enabled) {
      const selectors = allSettings[hostname].selectors || DEFAULT_HIDE_SELECTORS;
      updateHideElements(selectors);
      console.log('[4hu脚本] 已加载域名隐藏设置:', hostname, selectors);
    } else {
      // Use default selectors if no custom settings
      updateHideElements(DEFAULT_HIDE_SELECTORS);
    }
  } catch (error) {
    console.log('[4hu脚本] 加载设置失败，使用默认设置:', error);
    updateHideElements(DEFAULT_HIDE_SELECTORS);
  }
}

// Initialize function
function init() {
  // 防止重复初始化
  if (window.Hu4Script.isInitialized) {
    console.log('[4hu脚本] 已经初始化，跳过重复初始化');
    return;
  }
  window.Hu4Script.isInitialized = true;

  // Load domain-specific hide settings and apply
  loadDomainHideSettings();

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      autoClickTiaozhuan();
    });
  } else {
    autoClickTiaozhuan();
  }

  // Setup observer
  setupObserver();
}

// 导出配置供外部使用
window.Hu4ScriptConfig = {
  DEFAULT_HIDE_SELECTORS
};

// ========== Chrome Extension Message Handler ==========
// 使用全局标志防止重复注册消息监听器
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const MESSAGE_HANDLER_ID = 'hu4_message_handler_v1';

  if (!window[MESSAGE_HANDLER_ID]) {
    window[MESSAGE_HANDLER_ID] = true;
    console.log('[4hu脚本] 注册消息监听器');

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    // Handle extension toggle
    if (message.type === 'TOGGLE_EXTENSION') {
      const { enabled } = message;
      console.log('[4hu脚本] 扩展状态:', enabled ? '启用' : '禁用');
      sendResponse({ success: true });
      return true;
    }

    // Handle keywords update
    if (message.type === 'UPDATE_KEYWORDS') {
      const { keywords } = message;
      console.log('[4hu脚本] 关键词更新:', keywords);
      sendResponse({ success: true, message: '关键词已更新' });
      return true;
    }

    // Handle get default hide selectors
    if (message.type === 'GET_DEFAULT_HIDE_SELECTORS') {
      sendResponse({ success: true, selectors: DEFAULT_HIDE_SELECTORS });
      return true;
    }

    // Handle get current hide selectors
    if (message.type === 'GET_CURRENT_HIDE_SELECTORS') {
      sendResponse({ success: true, selectors: currentSelectors });
      return true;
    }

    // Handle update hide elements
    if (message.type === 'UPDATE_HIDE_ELEMENTS') {
      const { enabled, selectors } = message;
      if (enabled && selectors && selectors.length > 0) {
        updateHideElements(selectors);
        console.log('[4hu脚本] 隐藏元素已更新:', selectors);
      } else {
        // Disable hiding by removing style tag
        const existingStyle = document.getElementById(STYLE_TAG_ID);
        if (existingStyle) {
          existingStyle.remove();
        }
        console.log('[4hu脚本] 隐藏元素已禁用');
      }
      sendResponse({ success: true });
      return true;
    }

    // Return false to indicate message not handled (let other scripts handle it)
    return false;
  });
  }
}

// Start the script
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
