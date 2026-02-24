// Content script for pornhub.com
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

// ========== 全局命名空间 ==========
if (!window.PornScript) {
  window.PornScript = { isInitialized: false };
}

// ========== 配置 ==========
const STYLE_TAG_ID = 'porn-content-hide-style';
let styleElement = null;
let currentSelectors = [];

const DEFAULT_HIDE_SELECTORS = [
  '.cnhmmcccai',
  '.alpha',
  '#dbdcdkcbbd',
  '#countryRedirectMessage',
  '.video-wrapper>.hd.clear.original',
  '#welcome'
];

const BLOCKED_DOMAINS = [];

// ========== 工具函数 ==========
function isElementInViewportAndVisible(element) {
  const rect = element.getBoundingClientRect();
  const isVisible = rect.top >= 0 && rect.left >= 0 &&
    Math.floor(rect.right) <= window.innerWidth &&
    rect.bottom <= window.innerHeight &&
    rect.width != 0 && rect.height != 0;
  return isVisible && window.getComputedStyle(element).display !== 'none';
}

function findOne(selector) {
  const list = [...document.querySelectorAll(selector)].filter(item => isElementInViewportAndVisible(item));
  return list.length === 1 ? list[0] : null;
}

// ========== 隐藏元素 ==========
function updateHideElements(selectors) {
  DOMUtils.removeStyle(STYLE_TAG_ID);
  currentSelectors = selectors?.length > 0 ? selectors : [];

  if (currentSelectors.length > 0) {
    DOMUtils.applyHideStyle(STYLE_TAG_ID, currentSelectors);
    console.log('[Pornhub脚本] 已隐藏元素:', currentSelectors);
  }
}

function injectHideStyle() {
  updateHideElements(DEFAULT_HIDE_SELECTORS);
}

// ========== 自动点击 ==========
function clickOver18Button() {
  const button = findOne('.buttonOver18');
  if (button) {
    button.click();
    console.log('[Pornhub脚本] 已点击 18+ 按钮');
  }
}

function cleanup() {
  console.log('[Pornhub脚本] 清理状态...');
  DOMUtils.removeStyle(STYLE_TAG_ID);
  window.PornScript.isInitialized = false;
}

// ========== 存储 ==========
async function loadDomainHideSettings() {
  const domain = DOMUtils.getCurrentDomain();
  const settings = await StorageUtils.getDomainSettings('hideElementsSettings', domain);

  if (settings?.enabled) {
    updateHideElements(settings.selectors || DEFAULT_HIDE_SELECTORS);
    console.log('[Pornhub脚本] 已加载域名隐藏设置:', domain, settings.selectors);
  } else {
    updateHideElements(DEFAULT_HIDE_SELECTORS);
  }
}

// ========== 初始化 ==========
async function registerBlockedDomains() {
  const result = await MessagingUtils.registerBlockedDomains('pornhub.com', BLOCKED_DOMAINS);
  if (result?.success) console.log('[Pornhub脚本] 已向 background 注册 blockedDomains');
}

function init() {
  if (window.PornScript.isInitialized) {
    console.log('[Pornhub脚本] 已经初始化，跳过重复初始化');
    return;
  }
  window.PornScript.isInitialized = true;

  loadDomainHideSettings();
  registerBlockedDomains();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', clickOver18Button);
  } else {
    clickOver18Button();
  }
}

// ========== 导出配置 ==========
window.PornScriptConfig = {
  DEFAULT_HIDE_SELECTORS,
  BLOCKED_DOMAINS
};

// ========== 消息处理 ==========
MessagingUtils.createMessageHandler('porn_message_handler', {
  'TOGGLE_EXTENSION': (message) => {
    console.log('[Pornhub脚本] 扩展状态:', message.enabled ? '启用' : '禁用');
    return { success: true };
  },

  'UPDATE_KEYWORDS': (message) => {
    console.log('[Pornhub脚本] 关键词更新:', message.keywords);
    return { success: true, message: '关键词已更新' };
  },

  'GET_DEFAULT_HIDE_SELECTORS': () => ({ success: true, selectors: DEFAULT_HIDE_SELECTORS }),
  'GET_CURRENT_HIDE_SELECTORS': () => ({ success: true, selectors: currentSelectors }),

  'UPDATE_HIDE_ELEMENTS': (message) => {
    const { enabled, selectors } = message;
    if (enabled && selectors?.length > 0) {
      updateHideElements(selectors);
      console.log('[Pornhub脚本] 隐藏元素已更新:', selectors);
    } else {
      DOMUtils.removeStyle(STYLE_TAG_ID);
      console.log('[Pornhub脚本] 隐藏元素已禁用');
    }
    return { success: true };
  }
});

// ========== 启动 ==========
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
