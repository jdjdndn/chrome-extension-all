// Content script for bilibili.com
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js

'use strict';

if (window.BiliScriptLoaded) {
  console.log('[Bilibili脚本] 已加载，跳过');
} else {
  window.BiliScriptLoaded = true;

  // ========== 配置 ==========
  const STYLE_TAG_ID = 'bili-content-hide-style';
  const LOCAL_SERVER_URL = 'http://localhost:3000';
  const DOMAIN = 'bilibili.com';

  // 状态
  let currentSelectors = [];
  let localServerAvailable = false;

  // 关键词配置
  let NOT_INTERESTED_KEYWORDS = [];
  const DEFAULT_NOT_INTERESTED_KEYWORDS = [];

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
    '.floor-single-card'
  ];

  const BLOCKED_DOMAINS = [];

  // ========== 本地服务通信 ==========

  /**
   * 通过 background script 发送请求到本地服务
   */
  async function localServerFetch(endpoint, options = {}) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('请求超时'));
      }, 5000);

      chrome.runtime.sendMessage({
        type: 'LOCAL_SERVER_FETCH',
        url: `${LOCAL_SERVER_URL}${endpoint}`,
        method: options.method || 'GET',
        headers: options.headers,
        body: options.body
      }, (response) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response?.error || '请求失败'));
        }
      });
    });
  }

  /**
   * 检查本地服务是否可用
   */
  async function checkLocalServer() {
    try {
      const result = await localServerFetch('/api/health');
      localServerAvailable = result.status === 'ok';
      console.log('[Bilibili脚本] 本地服务状态:', localServerAvailable ? '可用' : '不可用');
      return localServerAvailable;
    } catch (error) {
      localServerAvailable = false;
      console.log('[Bilibili脚本] 本地服务不可用:', error.message);
      return false;
    }
  }

  /**
   * 从本地服务获取关键词
   */
  async function loadKeywordsFromServer() {
    try {
      const result = await localServerFetch(`/api/data/keywords/${DOMAIN}`);
      // localServerFetch 返回 { success: true, data: { notInterested: [...] } }
      if (result && result.success && result.data) {
        return result.data;
      }
    } catch (error) {
      console.log('[Bilibili脚本] 从本地服务获取关键词失败:', error.message);
    }
    return null;
  }

  /**
   * 保存关键词到本地服务
   */
  async function saveKeywordsToServer(keywords) {
    if (!localServerAvailable) return false;
    try {
      await localServerFetch(`/api/data/keywords/${DOMAIN}`, {
        method: 'POST',
        body: { notInterested: keywords }
      });
      return true;
    } catch (error) {
      console.log('[Bilibili脚本] 保存关键词到本地服务失败:', error.message);
      return false;
    }
  }

  /**
   * 从本地服务获取选择器
   */
  async function loadSelectorsFromServer() {
    try {
      const result = await localServerFetch(`/api/data/selectors/${DOMAIN}`);
      console.log('[Bilibili脚本] loadSelectorsFromServer 结果:', JSON.stringify(result));
      // localServerFetch 返回整个响应对象
      if (result && result.success && result.data) {
        const selectors = result.data;
        console.log('[Bilibili脚本] selectors 类型:', typeof selectors, '是否数组:', Array.isArray(selectors));
        if (Array.isArray(selectors) && selectors.length > 0) {
          return selectors;
        }
      }
    } catch (error) {
      console.log('[Bilibili脚本] 从本地服务获取选择器失败:', error.message);
    }
    return null;
  }

  /**
   * 保存选择器到本地服务
   */
  async function saveSelectorsToServer(selectors) {
    if (!localServerAvailable) return false;
    try {
      await localServerFetch(`/api/data/selectors/${DOMAIN}`, {
        method: 'POST',
        body: selectors
      });
      return true;
    } catch (error) {
      console.log('[Bilibili脚本] 保存选择器到本地服务失败:', error.message);
      return false;
    }
  }

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
    // 不在这里直接应用，让 loadDomainHideSettings 统一处理
    console.log('[Bilibili脚本] 已生成隐藏选择器，关键词数量:', NOT_INTERESTED_KEYWORDS.length);
  }

  // ========== 存储 ==========
  async function loadKeywords() {
    // 优先从本地服务加载
    if (localServerAvailable) {
      const serverData = await loadKeywordsFromServer();
      if (serverData?.notInterested?.length > 0) {
        NOT_INTERESTED_KEYWORDS.length = 0;
        NOT_INTERESTED_KEYWORDS.push(...serverData.notInterested);
        console.log('[Bilibili脚本] 从本地服务加载关键词:', NOT_INTERESTED_KEYWORDS.length, '个');
        return;
      }
    }

    // 回退到 Chrome 存储
    const result = await StorageUtils.getLocal(['biliKeywords']);
    if (result.biliKeywords?.notInterested) {
      NOT_INTERESTED_KEYWORDS.length = 0;
      NOT_INTERESTED_KEYWORDS.push(...result.biliKeywords.notInterested);
      console.log('[Bilibili脚本] 从Chrome存储加载关键词:', NOT_INTERESTED_KEYWORDS.length, '个');
    }
  }

  async function saveKeywords() {
    // 保存到 Chrome 存储
    await StorageUtils.setLocal({
      biliKeywords: { notInterested: NOT_INTERESTED_KEYWORDS }
    });

    // 同时保存到本地服务
    if (localServerAvailable) {
      await saveKeywordsToServer(NOT_INTERESTED_KEYWORDS);
    }

    console.log('[Bilibili脚本] 已保存关键词设置');
  }

  async function loadDomainHideSettings() {
    const domain = DOMUtils.getCurrentDomain();
    const settings = await StorageUtils.getDomainSettings('hideElementsSettings', domain);
    console.log('[Bilibili脚本] 域名设置:', JSON.stringify(settings));
    console.log('[Bilibili脚本] DEFAULT_HIDE_SELECTORS 数量:', DEFAULT_HIDE_SELECTORS.length);

    // 尝试从本地服务获取选择器
    let serverSelectors = [];
    if (localServerAvailable) {
      serverSelectors = await loadSelectorsFromServer();
      if (serverSelectors && Array.isArray(serverSelectors) && serverSelectors.length > 0) {
        console.log('[Bilibili脚本] 从本地服务加载选择器:', serverSelectors.length, '个');
      } else {
        serverSelectors = [];
      }
    }

    // 合并：默认 + 本地服务器 + 用户添加
    const userSelectors = settings?.selectors || [];
    const mergedSelectors = [...new Set([...DEFAULT_HIDE_SELECTORS, ...serverSelectors, ...userSelectors])];

    updateHideElements(mergedSelectors);
    console.log('[Bilibili脚本] 合并后选择器:', mergedSelectors.length, '个 (默认:', DEFAULT_HIDE_SELECTORS.length, ', 服务器:', serverSelectors.length, ', 用户:', userSelectors.length, ')');
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
    FEED_CARD_SELECTORS,
    get localServerAvailable() { return localServerAvailable; }
  };

  // 通过 DOM 存储配置（CSP 安全方式）
  function updatePageConfig() {
    const config = {
      localServerAvailable,
      keywordsCount: NOT_INTERESTED_KEYWORDS.length,
      selectorsCount: DEFAULT_HIDE_SELECTORS.length
    };
    console.log('[Bilibili脚本] 配置已更新:', JSON.stringify(config));

    // 通过 meta 标签存储配置
    let meta = document.getElementById('bili-config-meta');
    if (!meta) {
      meta = document.createElement('meta');
      meta.id = 'bili-config-meta';
      meta.name = 'bili-config';
      document.head.appendChild(meta);
    }
    meta.content = JSON.stringify(config);
  }

  // 初始化后更新页面配置（在 init() 中调用）
  // updatePageConfig();

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
        // 保存到本地服务
        if (localServerAvailable) {
          saveSelectorsToServer(selectors);
        }
        console.log('[Bilibili脚本] 隐藏元素已更新:', selectors.length, '个选择器');
      } else {
        DOMUtils.removeStyle(STYLE_TAG_ID);
        console.log('[Bilibili脚本] 隐藏元素已禁用');
      }
      return { success: true };
    },

    // 同步数据到本地服务
    'SYNC_TO_SERVER': async () => {
      if (!localServerAvailable) {
        return { success: false, message: '本地服务不可用' };
      }
      const keywordsSaved = await saveKeywordsToServer(NOT_INTERESTED_KEYWORDS);
      const selectorsSaved = await saveSelectorsToServer(currentSelectors);
      return {
        success: keywordsSaved && selectorsSaved,
        message: keywordsSaved && selectorsSaved ? '同步成功' : '同步失败'
      };
    },

    // 从本地服务同步数据
    'SYNC_FROM_SERVER': async () => {
      if (!localServerAvailable) {
        return { success: false, message: '本地服务不可用' };
      }
      await loadKeywords();
      refreshHideSelectors();
      await loadDomainHideSettings();
      return { success: true, message: '同步成功' };
    }
  });

  // ========== 启动 ==========
  async function init() {
    // 先检查本地服务
    await checkLocalServer();

    // 加载关键词和设置
    await loadKeywords();
    refreshHideSelectors();
    await loadDomainHideSettings();
    await registerBlockedDomains().catch(err => console.error('[Bilibili脚本] 注册域名失败:', err));

    // 更新页面配置（暴露到页面上下文）
    updatePageConfig();

    console.log('[Bilibili脚本] 初始化完成，本地服务:', localServerAvailable ? '已连接' : '未连接');
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  console.log('[Bilibili脚本] 已加载');
}
