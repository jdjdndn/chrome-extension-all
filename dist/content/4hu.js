// Content script for 4hu.tv
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

// ========== 全局命名空间 ==========
if (!window.Hu4Script) {
  window.Hu4Script = { isInitialized: false };
}

// ========== 配置 ==========
const STYLE_TAG_ID = 'kkm-content-hide-style';
let observer = null;
let currentSelectors = [];

const DEFAULT_HIDE_SELECTORS = ['.kkm-content'];
const BLOCKED_DOMAINS = [];

// ========== 隐藏元素 ==========
function updateHideElements(selectors) {
  DOMUtils.removeStyle(STYLE_TAG_ID);
  currentSelectors = selectors?.length > 0 ? selectors : [];

  if (currentSelectors.length > 0) {
    DOMUtils.applyHideStyle(STYLE_TAG_ID, currentSelectors);
    console.log('[4hu脚本] 已隐藏元素:', currentSelectors);
  }
}

function hideKkmContent() {
  updateHideElements(DEFAULT_HIDE_SELECTORS);
}

// ========== 自动点击 ==========
function autoClickTiaozhuan() {
  const tiaozhuan = document.querySelector('#tiaozhuan');
  if (tiaozhuan) {
    tiaozhuan.click();
    console.log('[4hu脚本] 已自动点击 #tiaozhuan');
  }
}

function setupObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.id === 'tiaozhuan') {
            node.click();
            console.log('[4hu脚本] 已自动点击动态添加的 #tiaozhuan');
          }
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

function cleanup() {
  console.log('[4hu脚本] 清理状态...');
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  window.Hu4Script.isInitialized = false;
}

// ========== 存储 ==========
async function loadDomainHideSettings() {
  const domain = DOMUtils.getCurrentDomain();
  const settings = await StorageUtils.getDomainSettings('hideElementsSettings', domain);

  if (settings?.enabled && settings.selectors?.length > 0) {
    // 合并默认选择器和用户选择器
    const mergedSelectors = [...new Set([...DEFAULT_HIDE_SELECTORS, ...(settings.selectors || [])])];
    updateHideElements(mergedSelectors);
    console.log('[4hu脚本] 已加载隐藏设置，合并后:', mergedSelectors.length, '个选择器');
  } else {
    // 使用默认选择器
    updateHideElements(DEFAULT_HIDE_SELECTORS);
    console.log('[4hu脚本] 使用默认选择器:', DEFAULT_HIDE_SELECTORS.length, '个');
  }
}

// ========== 初始化 ==========
async function registerBlockedDomains() {
  const result = await MessagingUtils.registerBlockedDomains('4hu.tv', BLOCKED_DOMAINS);
  if (result?.success) console.log('[4hu脚本] 已向 background 注册 blockedDomains');
}

function init() {
  if (window.Hu4Script.isInitialized) {
    console.log('[4hu脚本] 已经初始化，跳过重复初始化');
    return;
  }

  // 确保 document.body 存在
  if (!document.body) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      setTimeout(init, 50);
    }
    return;
  }

  window.Hu4Script.isInitialized = true;

  // 异步加载设置，错误时使用默认值
  loadDomainHideSettings().catch(err => console.error('[4hu脚本] 加载设置失败:', err));
  registerBlockedDomains().catch(err => console.error('[4hu脚本] 注册域名失败:', err));

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoClickTiaozhuan);
  } else {
    autoClickTiaozhuan();
  }

  setupObserver();
}

// ========== 导出配置 ==========
window.Hu4ScriptConfig = {
  DEFAULT_HIDE_SELECTORS,
  BLOCKED_DOMAINS
};

// ========== 消息处理 ==========
MessagingUtils.createMessageHandler('hu4_message_handler', {
  'TOGGLE_EXTENSION': (message) => {
    console.log('[4hu脚本] 扩展状态:', message.enabled ? '启用' : '禁用');
    return { success: true };
  },

  'UPDATE_KEYWORDS': (message) => {
    console.log('[4hu脚本] 关键词更新:', message.keywords);
    return { success: true, message: '关键词已更新' };
  },

  'GET_DEFAULT_HIDE_SELECTORS': () => ({ success: true, selectors: DEFAULT_HIDE_SELECTORS }),
  'GET_CURRENT_HIDE_SELECTORS': () => ({ success: true, selectors: currentSelectors }),

  'UPDATE_HIDE_ELEMENTS': (message) => {
    const { enabled, selectors } = message;
    if (enabled && selectors?.length > 0) {
      updateHideElements(selectors);
      console.log('[4hu脚本] 隐藏元素已更新:', selectors);
    } else {
      DOMUtils.removeStyle(STYLE_TAG_ID);
      console.log('[4hu脚本] 隐藏元素已禁用');
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
