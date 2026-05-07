# EventBus 统一通信系统

## 🎯 核心特性

- **统一 API**：一套 API 支持所有组件间通信
- **双向通信**：支持 Request-Response 和 Publish-Subscribe
- **自动重试**：消息失败自动重试，确保送达
- **连接感知**：自动检测组件状态，未就绪时排队
- **心跳机制**：30秒心跳保持连接活跃
- **广播支持**：一对多消息通知
- **零依赖**：纯 JavaScript 实现

## 📦 集成步骤

### 1. 添加到 manifest.json

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["event-bus.js"],
      "run_at": "document_start"
    }
  ]
}
```

### 2. 在各组件中引入

**HTML 文件** (popup.html, devtools.html, options.html):

```html
<script src="event-bus.js"></script>
<script src="your-script.js"></script>
```

**Background Script** (background.js):

```javascript
importScripts('event-bus.js')
```

### 3. 开始使用

```javascript
// 发送并等待响应
const response = await EventBus.request('GET_DATA', { query: '...' })
console.log(response)

// 发布事件（不等待响应）
await EventBus.publish('LOG_EVENT', { message: 'Hello' })

// 订阅事件
EventBus.subscribe('LOG_EVENT', (data) => {
  console.log('收到:', data)
})

// 注册处理器
EventBus.on('GET_DATA', (data) => {
  return { result: '...' }
})
```

## 📖 API 参考

### send(type, data, options)

发送消息（可选择等待响应）

```javascript
// 发送不等待响应
await EventBus.send('NOTIFY', { message: 'Hello' })

// 发送并等待响应
const response = await EventBus.send(
  'GET_INFO',
  {},
  {
    target: 'content', // 目标组件
    expectResponse: true, // 等待响应
    timeout: 5000, // 超时时间
  }
)
```

### request(type, data, options)

请求-响应模式（简化的 send）

```javascript
const result = await EventBus.request('GET_USER', { id: 123 })
console.log(result)
```

### publish(type, data)

发布事件到所有订阅者

```javascript
await EventBus.publish('THEME_CHANGED', { theme: 'dark' })
```

### subscribe(type, callback)

订阅事件，返回取消函数

```javascript
const unsubscribe = EventBus.subscribe('UPDATE', (data) => {
  console.log('更新:', data)
})
// 取消订阅
unsubscribe()
```

### on(type, handler)

注册消息处理器

```javascript
EventBus.on('CALCULATE', (data) => {
  return { result: data.a + data.b }
})
```

### getState()

获取系统状态

```javascript
const state = EventBus.getState()
console.log(state)
// {
//   env: 'popup',
//   instanceId: 'popup_xxx',
//   isReady: true,
//   connections: ['background_yyy', 'content_zzz'],
//   subscriptions: ['UPDATE', 'LOG'],
//   uptime: 12345,
//   messageCount: 42
// }
```

## 🔄 通信模式

### 1. Request-Response (请求-响应)

```javascript
// Popup
const userInfo = await EventBus.request('GET_USER_INFO', { userId: 123 })
console.log(userInfo)

// Content Script
EventBus.on('GET_USER_INFO', (data) => {
  const user = fetchUser(data.userId)
  return { name: user.name, email: user.email }
})
```

### 2. Publish-Subscribe (发布-订阅)

```javascript
// Background
EventBus.publish('SETTINGS_UPDATED', { theme: 'dark' })

// Popup
EventBus.subscribe('SETTINGS_UPDATED', (settings) => {
  applyTheme(settings.theme)
})

// Content Script
EventBus.subscribe('SETTINGS_UPDATED', (settings) => {
  updateUI(settings)
})
```

### 3. Broadcast (广播)

```javascript
// 任何组件
await EventBus.send(
  'ANNOUNCEMENT',
  { message: 'System update' },
  {
    target: 'all', // 默认就是 'all'
  }
)
```

### 4. Directed (定向)

```javascript
// 只发送到 Background
await EventBus.send('SECRET_OPERATION', data, { target: 'background' })

// 只发送到 Content Script
await EventBus.send('INSPECT_ELEMENT', { selector: '.class' }, { target: 'content' })
```

## 🛠️ 实际示例

### 示例 1: Popup 获取 Content 数据

```javascript
// popup.js
async function loadContentData() {
  try {
    const data = await EventBus.request('GET_CONTENT_DATA', {})
    console.log('Content 数据:', data)
    renderData(data)
  } catch (error) {
    console.error('获取失败:', error)
    showErrorMessage()
  }
}
```

### 示例 2: Content 监听 Popup 命令

```javascript
// content.js
EventBus.on('EXECUTE_COMMAND', async (command) => {
  console.log('执行命令:', command.action)

  switch (command.action) {
    case 'scroll':
      window.scrollTo(0, command.y)
      return { success: true }
    case 'click':
      document.querySelector(command.selector)?.click()
      return { success: true }
    default:
      return { success: false, error: 'Unknown command' }
  }
})
```

### 示例 3: 多组件同步状态

```javascript
// 任何组件修改状态后
await EventBus.publish('STATE_CHANGED', {
  component: 'Settings',
  state: { theme: 'dark', language: 'zh-CN' },
})

// 其他组件监听
EventBus.subscribe('STATE_CHANGED', (newState) => {
  console.log('状态已更新:', newState)
  syncState(newState)
})
```

### 示例 4: Background 协调通信

```javascript
// background.js
// 跟踪所有在线组件
const onlineComponents = new Set()

EventBus.subscribe('COMPONENT_READY', (data) => {
  onlineComponents.add(data.from)
  console.log('在线组件:', Array.from(onlineComponents))
})

// 广播到所有组件
async function broadcastToAll(type, data) {
  await EventBus.publish(type, data)
  console.log(`已广播到 ${onlineComponents.size} 个组件`)
}
```

## ⚡ 性能优化

### 大数据传输

❌ **不推荐**：

```javascript
await EventBus.send('LARGE_DATA', hugeArray) // 可能有 10MB+
```

✅ **推荐**：

```javascript
// 发送方
await chrome.storage.local.set({ temp: hugeArray })
await EventBus.publish('DATA_READY', { key: 'temp' })

// 接收方
EventBus.subscribe('DATA_READY', async (data) => {
  const result = await chrome.storage.local.get(data.key)
  const hugeArray = result[data.key]
  // 处理...
  await chrome.storage.local.remove(data.key)
})
```

### 频繁更新

```javascript
// 使用节流
const throttledUpdate = throttle((data) => {
  EventBus.publish('UPDATE', data)
}, 100)

function onDataChange(data) {
  throttledUpdate(data)
}
```

### 及时取消订阅

```javascript
// 组件卸载时
component.addEventListener('unload', () => {
  unsubscribe() // 取消订阅
})
```

## 🔍 调试

### 启用详细日志

```javascript
localStorage.setItem('eventbus_debug', 'true')
```

### 监听所有消息

```javascript
EventBus.subscribe('*', (data, source) => {
  console.log('[All Messages]', data, 'from', source)
})
```

### 查看状态

```javascript
console.log(EventBus.getState())
```

## ❓ 常见问题

**Q: 消息超时怎么办？**
A: 检查目标组件是否已调用 `EventBus.init()` 并注册了对应的处理器。

**Q: DevTools 收不到消息？**
A: 确保在 DevTools 面板 HTML 中引入了 `event-bus.js`。

**Q: 如何确认组件已连接？**
A: 检查 `EventBus.getState().connections` 是否包含目标组件。

**Q: 可以在网页中使用吗？**
A: 可以，但 `event-bus.js` 需要在扩展环境中才能正常工作。

## 📊 消息流

```
Popup ──┐
        │
        ├── EventBus ──┬───> Background
        │              │
        └──────────────┼───> Content Script
                       │
                       └───> DevTools
```

## 🚀 快速测试

```javascript
// 在任意组件控制台测试

// 1. 检查 EventBus 是否就绪
console.log(EventBus.getState())

// 2. 广播测试消息
EventBus.publish('TEST', { hello: 'world' })

// 3. 订阅测试
EventBus.subscribe('TEST', (data) => {
  console.log('收到测试消息:', data)
})

// 4. 请求测试
EventBus.on('TEST_REQUEST', (data) => {
  return { pong: data.ping }
})

// 在另一个组件控制台
const result = await EventBus.request('TEST_REQUEST', { ping: 'hello' })
console.log(result) // { pong: 'hello' }
```
