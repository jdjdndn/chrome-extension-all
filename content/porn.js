// Content script for pornhub.com
// Hide elements with class .cnhmmcccai, .alpha and id #dbdcdkcbbd

"use strict";

// ========== 全局命名空间 ==========
// 使用 window 对象存储初始化状态，防止重复初始化
if (!window.PornScript) {
  window.PornScript = {};
}
if (!window.PornScript.isInitialized) {
  window.PornScript.isInitialized = false;
}

// Style tag ID for identification
const STYLE_TAG_ID = 'porn-content-hide-style';

// State management
let styleElement = null;
let currentSelectors = []; // Will be initialized from DEFAULT_HIDE_SELECTORS or storage

// ========== Hide Elements Default Selectors ==========
// 默认隐藏元素选择器列表（pornhub.com 专用）
const DEFAULT_HIDE_SELECTORS = [
  '.cnhmmcccai',
  '.alpha',
  '#dbdcdkcbbd',
  '#countryRedirectMessage',
  '.video-wrapper>.hd.clear.original',
  '#welcome'
];

// 网络请求拦截域名列表
const BLOCKED_DOMAINS = [];

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
    document.head?.appendChild(style) || document.documentElement.appendChild(style);
    console.log('[Pornhub脚本] 已隐藏元素:', currentSelectors);
  }
}

// Legacy function name for backward compatibility
function injectHideStyle() {
  updateHideElements(DEFAULT_HIDE_SELECTORS);
}

function isElementInViewportAndVisible(element) {
  const rect = element.getBoundingClientRect();
  const isVisible = rect.top >= 0 && rect.left >= 0 && Math.floor(rect.right) <= window.innerWidth && rect.bottom <= window.innerHeight && rect.width != 0 && rect.height != 0;
  return isVisible && (window.getComputedStyle(element).display !== 'none');
}

// 找到唯一一个在页面中的元素
function findOne(selector) {
  const list = [...document.querySelectorAll(selector)].filter(item => isElementInViewportAndVisible(item));
  if (list.length == 1) return list[0];
  return null;
}

// Function to click 18+ button
function clickOver18Button() {
  const button = findOne('.buttonOver18');
  if (button) {
    button.click();
    console.log('[Pornhub脚本] 已点击 18+ 按钮');
  }
}

// Cleanup function before reload
function cleanup() {
  console.log('[Pornhub脚本] 清理状态...');
  const existingStyle = document.getElementById(STYLE_TAG_ID);
  if (existingStyle) {
    existingStyle.remove();
  }
  window.PornScript.isInitialized = false;
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
      console.log('[Pornhub脚本] 已加载域名隐藏设置:', hostname, selectors);
    } else {
      // Use default selectors if no custom settings
      updateHideElements(DEFAULT_HIDE_SELECTORS);
    }
  } catch (error) {
    console.log('[Pornhub脚本] 加载设置失败，使用默认设置:', error);
    updateHideElements(DEFAULT_HIDE_SELECTORS);
  }
}

// Initialize function
function init() {
  // 防止重复初始化
  if (window.PornScript.isInitialized) {
    console.log('[Pornhub脚本] 已经初始化，跳过重复初始化');
    return;
  }
  window.PornScript.isInitialized = true;

  // Load domain-specific hide settings and apply
  loadDomainHideSettings();

  // 向 background.js 注册 blockedDomains
  registerBlockedDomains();

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      clickOver18Button();
    });
  } else {
    clickOver18Button();
  }
}

/**
 * 向 background.js 注册当前域名的 blockedDomains 配置
 */
async function registerBlockedDomains() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[Pornhub脚本] 非扩展环境，跳过注册 blockedDomains');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REGISTER_BLOCKED_DOMAINS',
      domain: 'pornhub.com',
      blockedDomains: BLOCKED_DOMAINS
    });
    if (response && response.success) {
      console.log('[Pornhub脚本] 已向 background 注册 blockedDomains');
    }
  } catch (error) {
    console.error('[Pornhub脚本] 注册 blockedDomains 失败:', error);
  }
}

// 导出配置供外部使用
window.PornScriptConfig = {
  DEFAULT_HIDE_SELECTORS,
  BLOCKED_DOMAINS
};

// ========== Chrome Extension Message Handler ==========
// 使用全局标志防止重复注册消息监听器
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const MESSAGE_HANDLER_ID = 'porn_message_handler_v1';

  if (!window[MESSAGE_HANDLER_ID]) {
    window[MESSAGE_HANDLER_ID] = true;
    console.log('[Pornhub脚本] 注册消息监听器');

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // Handle extension toggle
      if (message.type === 'TOGGLE_EXTENSION') {
        const { enabled } = message;
        console.log('[Pornhub脚本] 扩展状态:', enabled ? '启用' : '禁用');
        sendResponse({ success: true });
        return true;
      }

      // Handle keywords update
      if (message.type === 'UPDATE_KEYWORDS') {
        const { keywords } = message;
        console.log('[Pornhub脚本] 关键词更新:', keywords);
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
          console.log('[Pornhub脚本] 隐藏元素已更新:', selectors);
        } else {
          // Disable hiding by removing style tag
          const existingStyle = document.getElementById(STYLE_TAG_ID);
          if (existingStyle) {
            existingStyle.remove();
          }
          console.log('[Pornhub脚本] 隐藏元素已禁用');
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
