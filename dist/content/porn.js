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
// 使用 DOMUtils.findOneInViewport 替代本地实现
function findOne(selector) {
  return DOMUtils.findOneInViewport(selector, { checkVisibility: true, checkDimensions: true });
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

  if (settings?.enabled && settings.selectors?.length > 0) {
    // 合并默认选择器和用户选择器
    const mergedSelectors = [...new Set([...DEFAULT_HIDE_SELECTORS, ...(settings.selectors || [])])];
    updateHideElements(mergedSelectors);
    console.log('[Pornhub脚本] 已加载隐藏设置，合并后:', mergedSelectors.length, '个选择器');
  } else {
    // 使用默认选择器
    updateHideElements(DEFAULT_HIDE_SELECTORS);
    console.log('[Pornhub脚本] 使用默认选择器:', DEFAULT_HIDE_SELECTORS.length, '个');
  }
}

// ========== 初始化 ==========
async function registerBlockedDomains() {
  const result = await MessagingUtils.registerBlockedDomains('pornhub.com', BLOCKED_DOMAINS);
  if (result?.success) console.log('[Pornhub脚本] 已向 background 注册 blockedDomains');
}

// ========== 链接点击处理 ==========
function handleLinkClick(event) {
  const link = event.target.closest('a');
  if (!link || !link.href) return;

  // 只处理 target="_blank" 的链接
  if (link.target !== '_blank') return;

  // 阻止其他监听器
  event.preventDefault();
  event.stopImmediatePropagation();

  // 在新标签页打开
  window.open(link.href, '_blank');
  console.log('[Pornhub脚本] 新标签页打开:', link.href);
}

// ========== 初始化 ==========
function init() {
  if (window.PornScript.isInitialized) {
    console.log('[Pornhub脚本] 已经初始化，跳过重复初始化');
    return;
  }
  window.PornScript.isInitialized = true;

  // 异步加载设置，错误时使用默认值
  loadDomainHideSettings().catch(err => console.error('[Pornhub脚本] 加载设置失败:', err));
  registerBlockedDomains().catch(err => console.error('[Pornhub脚本] 注册域名失败:', err));

  // 在捕获阶段处理链接点击
  document.addEventListener('click', handleLinkClick, true);

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
