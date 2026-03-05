/**
 * ========================================
 * EventBus 集成指南
 * ========================================
 *
 * 此文件展示了如何在各个 Chrome 扩展组件中集成 EventBus
 */

// ============================================
// 1. manifest.json 配置
// ============================================

/*
在 manifest.json 中添加：

{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["event-bus.js"],
      "run_at": "document_start"
    }
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "devtools_page": "devtools.html"
}
*/

// ============================================
// 2. Background Script (background.js)
// ============================================

// 在 background.js 开头引入
// importScripts('event-bus.js'); 或在 HTML 中 <script src="event-bus.js"></script>

// 等待 EventBus 就绪
setTimeout(async () => {
  // 注册消息处理器
  EventBus.on('GET_DATA', async (data, source) => {
    console.log('[Background] 收到数据请求:', data, '来自:', source);
    return { status: 'ok', data: { /* ... */ } };
  });

  // 监听事件
  EventBus.subscribe('USER_ACTION', (data, source) => {
    console.log('[Background] 用户操作:', data, '来自:', source);
    // 处理用户操作...
  });

  // 向其他组件发送消息
  const response = await EventBus.request('CONTENT_GET_INFO', { url: '...' });
  console.log('[Background] Content 响应:', response);

}, 1000);

// ============================================
// 3. Content Script (content.js)
// ============================================

// 在 content.js 中
// (event-bus.js 会通过 manifest.json 自动加载)

// 监听来自 background/popup 的消息
EventBus.on('UPDATE_CONFIG', (config) => {
  console.log('[Content] 配置更新:', config);
  // 更新配置...
});

// 向 background 发送请求
async function getData() {
  try {
    const result = await EventBus.request('GET_DATA', { query: '...' });
    console.log('[Content] 收到数据:', result);
  } catch (error) {
    console.error('[Content] 请求失败:', error);
  }
}

// 向 DevTools 发送消息（如果已连接）
EventBus.publish('TO_DEVTOOLS', { action: 'log', message: 'Hello DevTools' });

// ============================================
// 4. Popup (popup.html / popup.js)
// ============================================

// 在 popup.html 中：
/*
<!DOCTYPE html>
<html>
<head>
  <script src="event-bus.js"></script>
</head>
<body>
  <script src="popup.js"></script>
</body>
</html>
*/

// 在 popup.js 中：

// 等待就绪
setTimeout(async () => {
  // 向 content script 发送消息
  const response = await EventBus.request('CONTENT_GET_INFO', {});
  console.log('[Popup] Content 响应:', response);

  // 广播消息到所有组件
  await EventBus.publish('GLOBAL_EVENT', { message: 'Hello everyone!' });

  // 订阅事件
  EventBus.subscribe('CONTENT_UPDATE', (data) => {
    console.log('[Popup] Content 更新:', data);
    updateUI(data);
  });
}, 100);

// ============================================
// 5. DevTools (devtools.js / devtools-panel.js)
// ============================================

// 在 devtools.html 中：
/*
<!DOCTYPE html>
<html>
<head>
  <script src="event-bus.js"></script>
</head>
<body>
  <script src="devtools.js"></script>
</body>
</html>
*/

// 在 devtools.js 或 devtools-panel.js 中：

// 创建 DevTools 面板
chrome.devtools.panels.create('MyPanel', 'icon.png', 'panel.html', (panel) => {
  // 面板创建完成
});

// 在 panel.js 中：

// 监听 content script 的消息
EventBus.subscribe('TO_DEVTOOLS', (data) => {
  console.log('[DevTools] 收到消息:', data);
  // 在 DevTools 面板中显示...
});

// 向 content script 发送命令
async function inspectElement(selector) {
  await EventBus.send('CONTENT_INSPECT', { selector }, { target: 'content' });
}

// ============================================
// 6. Options Page (options.js)
// ============================================

// 在 options.html 中引入 event-bus.js

// 获取所有组件状态
async function getAllStates() {
  // 广播请求状态
  await EventBus.publish('REQUEST_STATE');

  // 等待响应
  await new Promise(r => setTimeout(r, 1000));

  // 向 background 请求汇总状态
  const states = await EventBus.request('GET_ALL_STATES', {});
  console.log('[Options] 所有组件状态:', states);
}

// ============================================
// 7. 完整通信流程示例
// ============================================

/*
示例：Popup 从 Content Script 获取数据

1. Popup 发送请求：
   const data = await EventBus.request('GET_USER_INFO', { userId: 123 });

2. EventBus 处理：
   - 创建消息 ID
   - 添加到 callback 队列
   - 通过 Transport 发送到 content script

3. Content Script 接收：
   - EventBus.on('GET_USER_INFO', (data) => { ... })

4. Content Script 响应：
   - 处理器返回数据
   - 自动发送响应回 Popup

5. Popup 收到响应：
   - Promise resolve
   - 返回数据
*/

// ============================================
// 8. 高级用法
// ============================================

// 8.1 广播消息（一对多）
await EventBus.publish('THEME_CHANGED', { theme: 'dark' });
// 所有订阅了 THEME_CHANGED 的组件都会收到

// 8.2 定向发送（发送到特定组件）
await EventBus.send('PRIVATE_MESSAGE', data, { target: 'background' });

// 8.3 超时控制
const result = await EventBus.request('SLOW_OPERATION', data, {
  timeout: 10000  // 10秒超时
});

// 8.4 订阅并自动取消
const unsubscribe = EventBus.subscribe('LOG_EVENT', (data) => {
  console.log(data);
});
// 稍后取消订阅
unsubscribe();

// 8.5 获取系统状态
const state = await EventBus.request('GET_STATE', {});
console.log(state);
// 输出:
// {
//   env: 'popup',
//   connections: ['background_xxx', 'content_yyy'],
//   subscriptions: ['LOG_EVENT', 'DATA_UPDATE'],
//   uptime: 12345,
//   messageCount: 42
// }

// ============================================
// 9. 错误处理
// ============================================

// 使用 try-catch 处理请求错误
try {
  const result = await EventBus.request('RISKY_OPERATION', data);
  console.log('成功:', result);
} catch (error) {
  if (error.message === 'Message timeout') {
    console.error('操作超时，可能目标组件未就绪');
  } else {
    console.error('操作失败:', error);
  }
}

// ============================================
// 10. 调试技巧
// ============================================

// 开启详细日志
localStorage.setItem('eventbus_debug', 'true');

// 在控制台查看所有消息
EventBus.subscribe('*', (data, source) => {
  console.log('[Debug] 所有消息:', data, 'from:', source);
});

// 查看当前状态
console.log(EventBus.getState());

// ============================================
// 11. 与现有代码集成
// ============================================

// 替换现有的 chrome.runtime.sendMessage：
// 旧代码：
/*
chrome.runtime.sendMessage({ type: 'GET_DATA' }, (response) => {
  console.log(response);
});
*/

// 新代码：
/*
const response = await EventBus.request('GET_DATA', {});
console.log(response);
*/

// 替换现有的 chrome.tabs.sendMessage：
// 旧代码：
/*
chrome.tabs.query({active: true}, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, { type: 'PING' });
});
*/

// 新代码：
/*
await EventBus.send('PING', {}, { target: 'content' });
*/

// ============================================
// 12. 最佳实践
// ============================================

/**
 * 1. 消息类型命名规范
 * - 使用大写下划线：GET_DATA, UPDATE_CONFIG
 * - 按功能分组：USER_LOGIN, USER_LOGOUT, USER_UPDATE
 * - 避免与系统消息冲突（已使用 __eb__ 前缀）
 */

/**
 * 2. 数据格式规范
 * - 所有消息数据封装在 data 对象中
 * - 响应格式：{ success: boolean, data: any, error?: string }
 * - 时间戳统一使用 Date.now()
 */

/**
 * 3. 错误处理
 * - 所有 request 都应该用 try-catch 包裹
 * - 处理器应该捕获并记录错误
 * - 超时应该有合理的降级方案
 */

/**
 * 4. 性能优化
 * - 大数据应该通过 chrome.storage 传递，不是消息
 * - 频繁更新应该节流/防抖
 * - 取消订阅不再使用的事件
 */

/**
 * 5. 安全考虑
 * - 验证消息来源（source.from, source.fromEnv）
 * - 敏感数据应该加密
 * - Content Script 不应该暴露内部逻辑
 */
