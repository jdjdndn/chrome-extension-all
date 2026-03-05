/**
 * ========================================
 * EventBus 实际集成示例
 * ========================================
 *
 * 此文件展示如何在你的项目中快速集成 EventBus
 */

// ============================================
// 快速开始（3步）
// ============================================

// 步骤 1: 在 manifest.json 中添加
/*
{
  "content_scripts": [
    {
      "matches": ["*://*.douyin.com/*"],
      "js": ["event-bus.js", "content/douyin.js"]
    }
  ]
}
*/

// 步骤 2: 在各组件 JS 文件开头引入
// content/douyin.js, popup.js, background.js 等文件中
// (event-bus.js 会自动初始化)

// 步骤 3: 使用 EventBus 替换现有通信

// ============================================
// 实际场景示例
// ============================================

// ========== 场景 1: Content Script 向 Background 请求数据 ==========

// 在 content/douyin.js 中：

// 旧代码：
/*
const result = await MessagingUtils.checkDomainBlocked(currentDomain, requestDomain);
*/

// 新代码：
try {
  const result = await EventBus.request('CHECK_DOMAIN_BLOCKED', {
    currentDomain,
    requestDomain
  });
  if (result && result.blocked) {
    console.log('域名被阻止:', result.blockedReason);
  }
} catch (error) {
  console.error('域名检查失败:', error);
}


// ========== 场景 2: Popup 向 Content Script 请求配置 ==========

// 在 popup.js 中：

// 旧代码（当前代码）：
/*
async function getDefaultHideSelectors() {
  const response = await sendMessageToContentScript({
    type: 'GET_DEFAULT_HIDE_SELECTORS'
  });
  return response?.selectors || [];
}
*/

// 新代码：
async function getDefaultHideSelectors() {
  try {
    const response = await EventBus.request('GET_DEFAULT_HIDE_SELECTORS', {}, {
      target: 'content',
      timeout: 3000
    });
    return response?.selectors || [];
  } catch (error) {
    console.warn('获取默认选择器失败，使用备用方案:', error);
    return getHardcodedSelectors(); // 降级方案
  }
}


// ========== 场景 3: 广播通知（一对多） ==========

// 在 popup.js 中保存设置后通知所有组件：

async function saveSettings(settings) {
  // 保存到 storage
  await chrome.storage.sync.set({ settings });

  // 旧代码：需要逐个发送消息
  /*
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    chrome.tabs.sendMessage(tab.id, { type: 'SETTINGS_UPDATED', settings })
      .catch(() => {});
  }
  */

  // 新代码：一条广播搞定
  await EventBus.publish('SETTINGS_UPDATED', settings);
}


// ========== 场景 4: Content Script 监听 Popup 指令 ==========

// 在 content/douyin.js 中：

// 注册处理器
EventBus.on('UPDATE_KEYWORDS', (data) => {
  const { keywords } = data;
  if (keywords.NOT_INTERESTED_KEYWORDS) {
    NOT_INTERESTED_KEYWORDS.length = 0;
    NOT_INTERESTED_KEYWORDS.push(...keywords.NOT_INTERESTED_KEYWORDS);
    console.log('[抖音] 关键词已更新');
  }
  return { success: true };
});

// 监听事件（不需要响应）
EventBus.subscribe('TOGGLE_DEBUG', (enabled) => {
  DEBUG_MODE = enabled;
  console.log('[抖音] 调试模式:', enabled ? '开启' : '关闭');
});


// ========== 场景 5: DevTools 与 Content Script 通信 ==========

// 在 devtools/panel.js 中：

// 监听 Content Script 的日志
EventBus.subscribe('CONTENT_LOG', (logEntry) => {
  const logDiv = document.getElementById('logs');
  const logItem = document.createElement('div');
  logItem.textContent = `[${logEntry.level}] ${logEntry.message}`;
  logItem.className = logEntry.level;
  logDiv.appendChild(logItem);
});

// 向 Content Script 发送调试命令
document.getElementById('inspectBtn').addEventListener('click', async () => {
  await EventBus.send('INSPECT_ELEMENT', { selector: '.video-container' }, {
    target: 'content'
  });
});


// ========== 场景 6: Background 协调多个组件 ==========

// 在 background.js 中：

// 跟踪所有组件状态
const componentStates = new Map();

EventBus.subscribe('COMPONENT_READY', (data) => {
  componentStates.set(data.from, {
    ready: true,
    lastSeen: Date.now(),
    ...data.state
  });
  console.log('组件就绪:', data.from);
});

EventBus.subscribe('COMPONENT_HEARTBEAT', (data) => {
  const state = componentStates.get(data.from);
  if (state) {
    state.lastSeen = Date.now();
  }
});

// 提供状态查询接口
EventBus.on('GET_ALL_STATES', () => {
  return Object.fromEntries(componentStates);
});


// ========== 场景 7: 错误恢复和重试 ==========

// 在任何组件中：

async function reliableRequest(type, data, options = {}) {
  const { retries = 3, delay = 200 } = options;

  for (let i = 0; i < retries; i++) {
    try {
      const response = await EventBus.request(type, data, {
        timeout: 5000
      });
      return { success: true, data: response };
    } catch (error) {
      console.warn(`请求失败 (${i + 1}/${retries}):`, error.message);

      if (i < retries - 1) {
        // 等待后重试
        await new Promise(r => setTimeout(r, delay * (i + 1)));
        // 检查目标组件是否恢复
        const state = await EventBus.request('GET_STATE', {})
          .catch(() => null);
        if (state && state.connections.length > 0) {
          i = retries; // 已恢复，跳出循环
        }
      }
    }
  }

  // 所有重试失败，使用降级方案
  return { success: false, error: 'All retries failed' };
}


// ============================================
// 与现有代码平滑迁移
// ============================================

/**
 * 迁移策略：
 * 1. 保留旧代码作为降级方案
 * 2. 新代码优先使用 EventBus
 * 3. 失败时降级到旧方式
 */

// 示例：平滑迁移的 sendMessage 函数
async function sendMessageToContentScript(message) {
  // 优先尝试 EventBus
  if (window.EventBus) {
    try {
      const response = await EventBus.request(message.type, message, {
        timeout: 3000
      });
      if (response) {
        return response;
      }
    } catch (error) {
      console.warn('[EventBus] 失败，降级到旧方式:', error.message);
    }
  }

  // 降级到旧方式
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]?.id) {
    return await chrome.tabs.sendMessage(tabs[0].id, message);
  }

  throw new Error('无法发送消息');
}


// ============================================
// 调试和监控
// ============================================

// 在开发环境启用详细日志
if (chrome.runtime?.id?.includes('development')) {
  // 监听所有消息
  const originalSend = EventBus.send.bind(EventBus);
  EventBus.send = function(type, data, options) {
    console.log(`[EventBus Send]`, { type, data, options });
    return originalSend(type, data, options);
  };

  // 订阅所有事件
  EventBus.subscribe('*', (data, source) => {
    console.log(`[EventBus Event]`, { data, source });
  });
}

// 定期打印状态
setInterval(() => {
  const state = EventBus.getState();
  console.log('[EventBus State]', {
    env: state.env,
    connections: state.connections.length,
    subscriptions: state.subscriptions.length,
    uptime: Math.floor(state.uptime / 1000) + 's',
    messages: state.messageCount
  });
}, 60000); // 每分钟一次


// ============================================
// 常见问题解决
// ============================================

/**
 * 问题 1: "Message timeout"
 * 原因：目标组件未就绪或未注册处理器
 * 解决：确保目标组件已调用 EventBus.init() 并注册了对应类型的处理器
 */

/**
 * 问题 2: "Cannot read property 'send' of undefined"
 * 原因：EventBus 未加载或未初始化
 * 解决：确保 event-bus.js 在当前脚本之前加载
 */

/**
 * 问题 3: 消息发送但收不到响应
 * 原因：处理器未返回值或返回 Promise
 * 解决：确保处理器使用 async 或返回 Promise
 */

/**
 * 问题 4: DevTools 收不到消息
 * 原因：DevTools 面板未正确初始化 EventBus
 * 解决：在 DevTools 面板 HTML 中引入 event-bus.js
 */


// ============================================
// 性能优化建议
// ============================================

/**
 * 1. 大数据传输
 * ❌ 不推荐：EventBus.send('LARGE_DATA', largeArray)
 * ✅ 推荐：使用 chrome.storage 传输，EventBus 只发送通知
 */
// 发送方：
/*
await chrome.storage.local.set({ tempData: largeArray });
await EventBus.send('LARGE_DATA_READY', { key: 'tempData' });
*/
// 接收方：
/*
EventBus.on('LARGE_DATA_READY', async (data) => {
  const result = await chrome.storage.local.get(data.key);
  const largeArray = result[data.key];
  // 处理数据...
  await chrome.storage.local.remove(data.key);
});
*/

/**
 * 2. 频繁更新
 * ❌ 不推荐：每次更新都发送消息
 * ✅ 推荐：使用节流合并更新
 */
// 使用节流
const throttledUpdate = throttle((data) => {
  EventBus.publish('DATA_UPDATE', data);
}, 100);

function onDataChange(data) {
  throttledUpdate(data);
}

/**
 * 3. 订阅管理
 * ❌ 不推荐：订阅后不取消
 * ✅ 推荐：及时取消订阅
 */
// 正确做法：
const unsubscribe = EventBus.subscribe('EVENT', handler);
// 不再需要时
unsubscribe();


// ============================================
// 完整的组件模板
// ============================================

/**
 * 这是一个可以复制到任何组件的模板
 */
(function () {
  'use strict';

  // 等待 EventBus 就绪
  const waitForEventBus = () => {
    return new Promise(resolve => {
      if (window.EventBus && EventBus.getState().isReady) {
        resolve();
      } else {
        setTimeout(() => waitForEventBus().then(resolve), 100);
      }
    });
  };

  // 初始化函数
  async function init() {
    await waitForEventBus();
    console.log('[Component] EventBus 已就绪');

    // 注册消息处理器
    setupHandlers();

    // 订阅事件
    setupSubscriptions();

    // 通知其他组件我已就绪
    await EventBus.publish('COMPONENT_READY', {
      component: 'YOUR_COMPONENT_NAME',
      version: '1.0.0'
    });
  }

  // 设置消息处理器
  function setupHandlers() {
    // 处理请求并返回响应
    EventBus.on('YOUR_REQUEST_TYPE', async (data, source) => {
      console.log('[Component] 收到请求:', data);
      // 处理逻辑...
      return { success: true, result: /* ... */ };
    });
  }

  // 设置订阅
  function setupSubscriptions() {
    // 订阅事件（不返回响应）
    EventBus.subscribe('YOUR_EVENT_TYPE', (data, source) => {
      console.log('[Component] 收到事件:', data);
      // 处理逻辑...
    });
  }

  // 启动
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
