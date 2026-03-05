/**
 * EventBus 集成模块 - 通用版
 * 为所有 content scripts 添加 EventBus 支持
 * 取代 MessagingUtils，提供统一的通信接口
 */

(function () {
  'use strict';

  console.log('[EventBus集成] 初始化...');

  // 兼容 MessagingUtils 的接口
  const MessagingUtilsCompat = {
    isExtensionContext() {
      return typeof chrome !== 'undefined' && chrome.runtime;
    },

    // 发送消息到 background（使用 EventBus）
    async sendToBackground(message) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪');
        return null;
      }
      return await EventBus.request(message.type, message, { target: 'background' });
    },

    // 创建消息处理器（使用 EventBus.on）
    createMessageHandler(handlerId, handlers) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪，跳过注册');
        return false;
      }

      if (window[handlerId]) {
        console.log(`[EventBus兼容] 处理器 ${handlerId} 已存在，跳过注册`);
        return false;
      }

      window[handlerId] = true;
      console.log(`[EventBus兼容] 注册消息处理器: ${handlerId}`);

      // 将所有处理器注册到 EventBus
      for (const [type, handler] of Object.entries(handlers)) {
        EventBus.on(type, (data) => {
          return handler({ type, ...data });
        });
      }

      return true;
    },

    // 注册阻止域名
    async registerBlockedDomains(domain, blockedDomains) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪');
        return null;
      }
      return await EventBus.request('REGISTER_BLOCKED_DOMAINS', {
        domain,
        blockedDomains
      }, { target: 'background' });
    },

    // 检查域名是否被阻止
    async checkDomainBlocked(currentDomain, requestDomain) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪');
        return null;
      }
      return await EventBus.request('CHECK_DOMAIN_BLOCKED', {
        currentDomain,
        requestDomain
      }, { target: 'background' });
    }
  };

  // 导出兼容接口
  window.MessagingUtils = MessagingUtilsCompat;

  // 等待 EventBus 就绪
  function waitForEventBus(callback) {
    const maxWait = 10000;
    const checkInterval = 100;
    let attempts = 0;

    const interval = setInterval(() => {
      attempts++;
      if (window.EventBus && EventBus.getState && EventBus.getState().isReady) {
        clearInterval(interval);
        console.log('[EventBus集成] ✓ EventBus 已就绪');
        callback();
      } else if (attempts * checkInterval >= maxWait) {
        clearInterval(interval);
        console.warn('[EventBus集成] ⚠️ 等待 EventBus 超时，继续使用 MessagingUtils');
        // 即使 EventBus 未就绪，也调用回调以初始化 MessagingUtils 处理器
        callback();
      }
    }, checkInterval);
  }

  // 注册所有消息处理器
  function registerHandlers() {
    // 检查 EventBus 是否可用
    if (!window.EventBus) {
      console.warn('[EventBus集成] EventBus 不可用，跳过处理器注册');
      return;
    }

    console.log('[EventBus集成] 注册消息处理器...');

    // 获取当前网站的默认配置（如果存在）
    const scriptConfig = window[Object.keys(window).find(key => key.includes('ScriptConfig'))];
    if (scriptConfig) {
      console.log('[EventBus集成] 找到配置:', Object.keys(scriptConfig));
    }

    // GET_DEFAULT_HIDE_SELECTORS - 所有网站都需要
    EventBus.on('GET_DEFAULT_HIDE_SELECTORS', () => {
      if (typeof DEFAULT_HIDE_SELECTORS !== 'undefined') {
        console.log('[EventBus集成] 返回默认选择器:', DEFAULT_HIDE_SELECTORS.length, '个');
        return { success: true, selectors: DEFAULT_HIDE_SELECTORS };
      }
      return { success: true, selectors: [] };
    });

    // GET_CURRENT_HIDE_SELECTORS
    EventBus.on('GET_CURRENT_HIDE_SELECTORS', () => {
      if (typeof currentSelectors !== 'undefined') {
        return { success: true, selectors: currentSelectors };
      }
      return { success: true, selectors: [] };
    });

    // UPDATE_HIDE_ELEMENTS - 所有网站都需要
    EventBus.on('UPDATE_HIDE_ELEMENTS', (data) => {
      console.log('[EventBus集成] 收到 UPDATE_HIDE_ELEMENTS');
      if (typeof updateHideElements === 'function') {
        const { enabled, selectors } = data;
        if (enabled && selectors?.length > 0) {
          updateHideElements(selectors);
        } else {
          if (typeof DOMUtils !== 'undefined') {
            const STYLE_TAG_ID = typeof STYLE_TAG_ID !== 'undefined' ? STYLE_TAG_ID : 'hide-elements-style';
            DOMUtils.removeStyle(STYLE_TAG_ID);
          }
        }
      }
      return { success: true };
    });

    // UPDATE_KEYWORDS - douyin, bili 需要
    EventBus.on('UPDATE_KEYWORDS', (data) => {
      console.log('[EventBus集成] 收到 UPDATE_KEYWORDS');
      if (typeof NOT_INTERESTED_KEYWORDS !== 'undefined') {
        const { keywords } = data;
        if (keywords.NOT_INTERESTED_KEYWORDS) {
          NOT_INTERESTED_KEYWORDS.length = 0;
          NOT_INTERESTED_KEYWORDS.push(...[...new Set(keywords.NOT_INTERESTED_KEYWORDS)]);
          console.log('[EventBus集成] 不感兴趣关键词已更新');
        }
      }
      if (typeof AUTO_FOLLOW_KEYWORDS !== 'undefined') {
        const { keywords } = data;
        if (keywords.AUTO_FOLLOW_KEYWORDS) {
          AUTO_FOLLOW_KEYWORDS.length = 0;
          AUTO_FOLLOW_KEYWORDS.push(...[...new Set(keywords.AUTO_FOLLOW_KEYWORDS)]);
          console.log('[EventBus集成] 自动关注关键词已更新');
        }
      }
      return { success: true };
    });

    // TOGGLE_EXTENSION - 所有网站
    EventBus.on('TOGGLE_EXTENSION', (data) => {
      console.log('[EventBus集成] 收到 TOGGLE_EXTENSION:', data.enabled);
      return { success: true };
    });

    // 订阅系统事件
    EventBus.subscribe('PING', () => {
      // 响应 ping
    });

    EventBus.subscribe('COMPONENT_READY', (data) => {
      console.log('[EventBus集成] 组件就绪:', data.component);
    });

    console.log('[EventBus集成] ✓ 处理器注册完成');
  }

  // 标记组件就绪
  function markReady() {
    if (window.EventBus && EventBus.publish) {
      const componentName = window.location.hostname.replace('www.', '').split('.')[0];

      EventBus.publish('COMPONENT_READY', {
        component: componentName + '_script',
        url: window.location.href,
        version: '1.0.0',
        timestamp: Date.now()
      });
      console.log('[EventBus集成] ✓ 已发布 COMPONENT_READY 事件');
    }
  }

  // 初始化
  waitForEventBus(() => {
    registerHandlers();
    markReady();
  });

})();
