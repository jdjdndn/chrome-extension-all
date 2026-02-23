// Content script for bilibili.com
// Hide elements functionality with domain-specific settings

"use strict";

// ========== 全局命名空间 ==========
// 使用 window 对象存储初始化状态，防止重复初始化
if (!window.BiliScript) {
  window.BiliScript = {};
}
if (!window.BiliScript.isInitialized) {
  window.BiliScript.isInitialized = false;
}

// Style tag ID for identification
const STYLE_TAG_ID = 'bili-content-hide-style';

// State management
let currentSelectors = []; // Will be initialized from DEFAULT_HIDE_SELECTORS or storage

// ========== 不感兴趣关键词列表 ==========
// 包含这些关键词的视频卡片会被隐藏
let NOT_INTERESTED_KEYWORDS = [
];

// 默认关键词（用于重置）
const DEFAULT_NOT_INTERESTED_KEYWORDS = [...NOT_INTERESTED_KEYWORDS];

// 默认隐藏元素选择器（不含关键词生成的）
const BASE_HIDE_SELECTORS = [
  '.left-entry>.v-popover-wrap:nth-child(n+2)',
  '.floor-single-card:has(.living)',
  '.bili-feed-card:has(.bili-live-card)',
  '.floor-single-card:has(.floor-title)',
  '.bili-feed-card:not(:has(a))',
  '.feed-card:not(:has(a))'
];

// 视频卡片选择器模板列表
// 这些是 B 站页面上常见的视频卡片容器
const FEED_CARD_SELECTORS = [
  '.bili-feed-card',           // 首页推荐卡片
  '.feed-card',                // feed 卡片
  '.recommend-list__item',     // 推荐列表项
  '.bili-video-card',          // 视频卡片
  '.video-card',               // 视频卡片
  '.rank-item',                // 排行榜项
  '.bili-rank-list-video',     // 排行榜视频
  '.popular-video-card',       // 热门视频卡片
  '.history-video-card',       // 历史视频卡片
  '.bili-dyn-video-card',      // 动态视频卡片
];

// 网络请求拦截域名列表
const BLOCKED_DOMAINS = [];

/**
 * 生成包含关键词的隐藏选择器
 * @returns {string[]} 完整的选择器数组
 */
function generateHideSelectors() {
  const keywordSelectors = [];

  for (const keyword of NOT_INTERESTED_KEYWORDS) {
    for (const cardSelector of FEED_CARD_SELECTORS) {
      // 匹配标题属性包含关键词的卡片
      keywordSelectors.push(`${cardSelector}:has(h3[title*="${keyword}"])`);
      keywordSelectors.push(`${cardSelector}:has(a[title*="${keyword}"])`);
      keywordSelectors.push(`${cardSelector}:has([title*="${keyword}"])`);
    }
  }

  return [...BASE_HIDE_SELECTORS, ...keywordSelectors];
}

// ========== Hide Elements Default Selectors ==========
// 默认隐藏元素选择器列表（bilibili.com 专用）
let DEFAULT_HIDE_SELECTORS = generateHideSelectors();

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
    console.log('[Bilibili脚本] 已隐藏元素:', currentSelectors.length, '个选择器');
  }
}

/**
 * 刷新隐藏选择器（关键词更新后调用）
 */
function refreshHideSelectors() {
  DEFAULT_HIDE_SELECTORS = generateHideSelectors();
  updateHideElements(DEFAULT_HIDE_SELECTORS);
  console.log('[Bilibili脚本] 已刷新隐藏选择器，关键词数量:', NOT_INTERESTED_KEYWORDS.length);
}

/**
 * 从 storage 加载关键词设置
 */
async function loadKeywords() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  try {
    const result = await chrome.storage.local.get(['biliKeywords']);
    if (result.biliKeywords && result.biliKeywords.notInterested) {
      NOT_INTERESTED_KEYWORDS.length = 0;
      NOT_INTERESTED_KEYWORDS.push(...result.biliKeywords.notInterested);
      console.log('[Bilibili脚本] 已加载关键词设置:', NOT_INTERESTED_KEYWORDS.length, '个');
    }
  } catch (error) {
    console.log('[Bilibili脚本] 加载关键词设置失败:', error);
  }
}

/**
 * 保存关键词到 storage
 */
async function saveKeywords() {
  if (typeof chrome === 'undefined' || !chrome.storage) {
    return;
  }

  try {
    await chrome.storage.local.set({
      biliKeywords: {
        notInterested: NOT_INTERESTED_KEYWORDS
      }
    });
    console.log('[Bilibili脚本] 已保存关键词设置');
  } catch (error) {
    console.error('[Bilibili脚本] 保存关键词设置失败:', error);
  }
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
      console.log('[Bilibili脚本] 已加载域名隐藏设置:', hostname, selectors.length, '个选择器');
    } else {
      // Use default selectors if no custom settings
      updateHideElements(DEFAULT_HIDE_SELECTORS);
    }
  } catch (error) {
    console.log('[Bilibili脚本] 加载设置失败，使用默认设置:', error);
    updateHideElements(DEFAULT_HIDE_SELECTORS);
  }
}

// Cleanup function before reload
function cleanup() {
  console.log('[Bilibili脚本] 清理状态...');
  const existingStyle = document.getElementById(STYLE_TAG_ID);
  if (existingStyle) {
    existingStyle.remove();
  }
  window.BiliScript.isInitialized = false;
}

// Initialize function
async function init() {
  // 防止重复初始化
  if (window.BiliScript.isInitialized) {
    console.log('[Bilibili脚本] 已经初始化，跳过重复初始化');
    return;
  }
  window.BiliScript.isInitialized = true;

  // 加载关键词设置
  await loadKeywords();

  // 生成选择器
  refreshHideSelectors();

  // Load domain-specific hide settings and apply
  await loadDomainHideSettings();

  // 向 background.js 注册 blockedDomains
  registerBlockedDomains();
}

/**
 * 向 background.js 注册当前域名的 blockedDomains 配置
 */
async function registerBlockedDomains() {
  if (typeof chrome === 'undefined' || !chrome.runtime) {
    console.log('[Bilibili脚本] 非扩展环境，跳过注册 blockedDomains');
    return;
  }

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'REGISTER_BLOCKED_DOMAINS',
      domain: 'bilibili.com',
      blockedDomains: BLOCKED_DOMAINS
    });
    if (response && response.success) {
      console.log('[Bilibili脚本] 已向 background 注册 blockedDomains');
    }
  } catch (error) {
    console.error('[Bilibili脚本] 注册 blockedDomains 失败:', error);
  }
}

// 导出配置供外部使用
window.BiliScriptConfig = {
  get DEFAULT_HIDE_SELECTORS() { return DEFAULT_HIDE_SELECTORS; },
  BLOCKED_DOMAINS,
  get NOT_INTERESTED_KEYWORDS() { return NOT_INTERESTED_KEYWORDS; },
  DEFAULT_NOT_INTERESTED_KEYWORDS,
  FEED_CARD_SELECTORS
};

// ========== Chrome Extension Message Handler ==========
// 使用全局标志防止重复注册消息监听器
if (typeof chrome !== 'undefined' && chrome.runtime) {
  const MESSAGE_HANDLER_ID = 'bili_message_handler_v1';

  if (!window[MESSAGE_HANDLER_ID]) {
    window[MESSAGE_HANDLER_ID] = true;
    console.log('[Bilibili脚本] 注册消息监听器');

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      // Handle extension toggle
      if (message.type === 'TOGGLE_EXTENSION') {
        const { enabled } = message;
        console.log('[Bilibili脚本] 扩展状态:', enabled ? '启用' : '禁用');
        sendResponse({ success: true });
        return true;
      }

      // Handle keywords update
      if (message.type === 'UPDATE_KEYWORDS') {
        const { keywords } = message;
        let updated = false;

        if (keywords.NOT_INTERESTED_KEYWORDS) {
          NOT_INTERESTED_KEYWORDS.length = 0;
          NOT_INTERESTED_KEYWORDS.push(...[...new Set(keywords.NOT_INTERESTED_KEYWORDS)]);
          console.log('[Bilibili脚本] 不感兴趣关键词已更新:', NOT_INTERESTED_KEYWORDS.length, '个');
          updated = true;
        }

        if (updated) {
          // 保存到 storage
          saveKeywords();
          // 刷新隐藏选择器
          refreshHideSelectors();
        }

        sendResponse({ success: true, message: '关键词已更新' });
        return true;
      }

      // Handle get keywords
      if (message.type === 'GET_KEYWORDS') {
        sendResponse({
          success: true,
          keywords: {
            NOT_INTERESTED_KEYWORDS: [...NOT_INTERESTED_KEYWORDS],
            DEFAULT_NOT_INTERESTED_KEYWORDS: [...DEFAULT_NOT_INTERESTED_KEYWORDS]
          }
        });
        return true;
      }

      // Handle reset keywords
      if (message.type === 'RESET_KEYWORDS') {
        NOT_INTERESTED_KEYWORDS.length = 0;
        NOT_INTERESTED_KEYWORDS.push(...DEFAULT_NOT_INTERESTED_KEYWORDS);
        saveKeywords();
        refreshHideSelectors();
        console.log('[Bilibili脚本] 关键词已重置为默认值');
        sendResponse({ success: true, keywords: [...NOT_INTERESTED_KEYWORDS] });
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
          console.log('[Bilibili脚本] 隐藏元素已更新:', selectors.length, '个选择器');
        } else {
          // Disable hiding by removing style tag
          const existingStyle = document.getElementById(STYLE_TAG_ID);
          if (existingStyle) {
            existingStyle.remove();
          }
          console.log('[Bilibili脚本] 隐藏元素已禁用');
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
