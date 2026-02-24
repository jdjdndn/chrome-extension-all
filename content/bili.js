// Content script for bilibili.com
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (window.BiliScriptLoaded) {
  console.log('[Bilibili脚本] 已加载，跳过');
} else {
  window.BiliScriptLoaded = true;

  // Style tag ID
  const STYLE_TAG_ID = 'bili-content-hide-style';

  // State
  let currentSelectors = [];

  // ========== 配置 ==========
  let NOT_INTERESTED_KEYWORDS = [];
  const DEFAULT_NOT_INTERESTED_KEYWORDS = [...NOT_INTERESTED_KEYWORDS];

  const BASE_HIDE_SELECTORS = [
    '.left-entry>.v-popover-wrap:nth-child(n+2)',
    '.floor-single-card:has(.living)',
    '.bili-feed-card:has(.bili-live-card)',
    '.floor-single-card:has(.floor-title)',
    '.bili-feed-card:not(:has(a))',
    '.feed-card:not(:has(a))'
  ];

  const FEED_CARD_SELECTORS = [
    '.bili-feed-card',
    '.feed-card',
    '.recommend-list__item',
    '.bili-video-card',
    '.video-card',
    '.rank-item',
    '.bili-rank-list-video',
    '.popular-video-card',
    '.history-video-card',
    '.bili-dyn-video-card',
  ];

  const BLOCKED_DOMAINS = [];

  // ========== 选择器生成 ==========
  function generateHideSelectors() {
    const keywordSelectors = [];
    for (const keyword of NOT_INTERESTED_KEYWORDS) {
      for (const cardSelector of FEED_CARD_SELECTORS) {
        keywordSelectors.push(`${cardSelector}:has(h3[title*="${keyword}"])`);
        keywordSelectors.push(`${cardSelector}:has(img:nth-child(1))`);
      }
    }
    return [...BASE_HIDE_SELECTORS, ...keywordSelectors];
  }

  let DEFAULT_HIDE_SELECTORS = generateHideSelectors();

  // ========== 隐藏元素 ==========
  function updateHideElements(selectors) {
    DOMUtils.removeStyle(STYLE_TAG_ID);
    currentSelectors = selectors && selectors.length > 0 ? selectors : [];

    if (currentSelectors.length > 0) {
      DOMUtils.applyHideStyle(STYLE_TAG_ID, currentSelectors);
      console.log('[Bilibili脚本] 已隐藏元素:', currentSelectors.length, '个选择器');
    }
  }

  function refreshHideSelectors() {
    DEFAULT_HIDE_SELECTORS = generateHideSelectors();
    updateHideElements(DEFAULT_HIDE_SELECTORS);
    console.log('[Bilibili脚本] 已刷新隐藏选择器，关键词数量:', NOT_INTERESTED_KEYWORDS.length);
  }

  // ========== 存储 ==========
  async function loadKeywords() {
    const result = await StorageUtils.getLocal(['biliKeywords']);
    if (result.biliKeywords?.notInterested) {
      NOT_INTERESTED_KEYWORDS.length = 0;
      NOT_INTERESTED_KEYWORDS.push(...result.biliKeywords.notInterested);
      console.log('[Bilibili脚本] 已加载关键词设置:', NOT_INTERESTED_KEYWORDS.length, '个');
    }
  }

  async function saveKeywords() {
    await StorageUtils.setLocal({
      biliKeywords: { notInterested: NOT_INTERESTED_KEYWORDS }
    });
    console.log('[Bilibili脚本] 已保存关键词设置');
  }

  async function loadDomainHideSettings() {
    const domain = DOMUtils.getCurrentDomain();
    const settings = await StorageUtils.getDomainSettings('hideElementsSettings', domain);

    if (settings?.enabled) {
      const selectors = settings.selectors || DEFAULT_HIDE_SELECTORS;
      updateHideElements(selectors);
      console.log('[Bilibili脚本] 已加载域名隐藏设置:', domain, selectors.length, '个选择器');
    } else {
      updateHideElements(DEFAULT_HIDE_SELECTORS);
    }
  }

  // ========== 初始化 ==========
  async function registerBlockedDomains() {
    const result = await MessagingUtils.registerBlockedDomains('bilibili.com', BLOCKED_DOMAINS);
    if (result?.success) {
      console.log('[Bilibili脚本] 已向 background 注册 blockedDomains');
    }
  }

  // ========== 导出配置 ==========
  window.BiliScriptConfig = {
    get DEFAULT_HIDE_SELECTORS() { return DEFAULT_HIDE_SELECTORS; },
    BLOCKED_DOMAINS,
    get NOT_INTERESTED_KEYWORDS() { return NOT_INTERESTED_KEYWORDS; },
    DEFAULT_NOT_INTERESTED_KEYWORDS,
    FEED_CARD_SELECTORS
  };

  // ========== 消息处理 ==========
  MessagingUtils.createMessageHandler('bili_message_handler', {
    'TOGGLE_EXTENSION': (message) => {
      console.log('[Bilibili脚本] 扩展状态:', message.enabled ? '启用' : '禁用');
      return { success: true };
    },

    'UPDATE_KEYWORDS': (message) => {
      const { keywords } = message;
      let updated = false;

      if (keywords.NOT_INTERESTED_KEYWORDS) {
        NOT_INTERESTED_KEYWORDS.length = 0;
        NOT_INTERESTED_KEYWORDS.push(...[...new Set(keywords.NOT_INTERESTED_KEYWORDS)]);
        console.log('[Bilibili脚本] 不感兴趣关键词已更新:', NOT_INTERESTED_KEYWORDS.length, '个');
        updated = true;
      }

      if (updated) {
        saveKeywords();
        refreshHideSelectors();
      }

      return { success: true, message: '关键词已更新' };
    },

    'GET_KEYWORDS': () => ({
      success: true,
      keywords: {
        NOT_INTERESTED_KEYWORDS: [...NOT_INTERESTED_KEYWORDS],
        DEFAULT_NOT_INTERESTED_KEYWORDS: [...DEFAULT_NOT_INTERESTED_KEYWORDS]
      }
    }),

    'RESET_KEYWORDS': () => {
      NOT_INTERESTED_KEYWORDS.length = 0;
      NOT_INTERESTED_KEYWORDS.push(...DEFAULT_NOT_INTERESTED_KEYWORDS);
      saveKeywords();
      refreshHideSelectors();
      console.log('[Bilibili脚本] 关键词已重置为默认值');
      return { success: true, keywords: [...NOT_INTERESTED_KEYWORDS] };
    },

    'GET_DEFAULT_HIDE_SELECTORS': () => ({ success: true, selectors: DEFAULT_HIDE_SELECTORS }),

    'GET_CURRENT_HIDE_SELECTORS': () => ({ success: true, selectors: currentSelectors }),

    'UPDATE_HIDE_ELEMENTS': (message) => {
      const { enabled, selectors } = message;
      if (enabled && selectors?.length > 0) {
        updateHideElements(selectors);
        console.log('[Bilibili脚本] 隐藏元素已更新:', selectors.length, '个选择器');
      } else {
        DOMUtils.removeStyle(STYLE_TAG_ID);
        console.log('[Bilibili脚本] 隐藏元素已禁用');
      }
      return { success: true };
    }
  });

  // ========== 启动 ==========
  async function init() {
    await loadKeywords();
    refreshHideSelectors();
    await loadDomainHideSettings();
    registerBlockedDomains();
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Bilibili脚本] 已加载');
}
