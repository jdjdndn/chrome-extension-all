# EventBus V2 - 增强版通信事件总线

## 🎉 新增功能

### 1. 消息追踪

```javascript
// 获取统计信息
const stats = EventBus.getStats()
console.log(stats)
// { sent: 10, received: 8, failed: 0, timeout: 1, trackedMessages: 18 }

// 获取消息历史
const history = EventBus.getHistory({ limit: 20, type: 'UPDATE_DATA' })
```

### 2. Once 订阅（一次性）

```javascript
// 只触发一次
EventBus.once('CONFIG_LOADED', (config) => {
  console.log('配置加载完成:', config)
})
```

### 3. Off 取消订阅

```javascript
// 取消特定订阅
const unsubscribe = EventBus.subscribe('DATA_UPDATE', handler)
// 稍后...
unsubscribe()

// 或使用 off
EventBus.off('DATA_UPDATE', callback)
EventBus.off('DATA_UPDATE') // 取消该类型的所有订阅
```

### 4. 连接事件监听

```javascript
// 监听组件连接/断开
EventBus.onConnectionChange((instanceId, status, info) => {
  console.log(`${instanceId} ${status}`, info)
})
```

### 5. 清理功能

```javascript
// 清理所有资源
EventBus.clear()
```

### 6. 调试模式

```javascript
// 启用调试模式
EventBus.setDebugMode(true)

// 禁用调试模式
EventBus.setDebugMode(false)
```

## 📊 完整 API 参考

### 发送消息

| 方法                           | 说明                   | 返回值          |
| ------------------------------ | ---------------------- | --------------- |
| `request(type, data, options)` | 发送请求（等待响应）   | `Promise<any>`  |
| `publish(type, data)`          | 发布事件（不等待响应） | `Promise<void>` |

### 订阅消息

| 方法                        | 说明       | 返回值       |
| --------------------------- | ---------- | ------------ |
| `subscribe(type, callback)` | 订阅事件   | 取消订阅函数 |
| `once(type, callback)`      | 一次性订阅 | 取消订阅函数 |
| `off(type, callback?)`      | 取消订阅   | `void`       |

### 处理器

| 方法                  | 说明       | 返回值 |
| --------------------- | ---------- | ------ |
| `on(type, handler)`   | 注册处理器 | `void` |
| `removeHandler(type)` | 移除处理器 | `void` |

### 状态查询

| 方法                 | 说明         | 返回值   |
| -------------------- | ------------ | -------- |
| `getState()`         | 获取状态     | 状态对象 |
| `getStats()`         | 获取统计     | 统计对象 |
| `getHistory(filter)` | 获取消息历史 | 历史数组 |

### 配置

| 方法                    | 说明         | 返回值 |
| ----------------------- | ------------ | ------ |
| `setDebugMode(enabled)` | 设置调试模式 | `void` |
| `clear()`               | 清理资源     | `void` |

### 连接

| 方法                           | 说明         | 返回值       |
| ------------------------------ | ------------ | ------------ |
| `onConnectionChange(callback)` | 监听连接变化 | 取消监听函数 |

## 🧪 测试工具

```javascript
// 运行所有测试
EventBusTestV2.runAllTests()

// 显示状态面板
EventBusTestV2.showStatusPanel()

// 显示最近消息
EventBusTestV2.showRecentMessages(20)

// 启用/禁用调试模式
EventBusTestV2.enableDebugMode()
EventBusTestV2.disableDebugMode()
```

## 📈 状态对象

```javascript
{
  env: 'content_script',      // 运行环境
  instanceId: '...',          // 实例ID
  isReady: true,              // 就绪状态
  connections: [...],         // 已连接的组件
  subscriptions: [...],       // 订阅的事件类型
  handlers: [...],            // 注册的处理器
  uptime: 12345,              // 运行时间（毫秒）
  messageCount: 100,          // 消息计数
  stats: {
    sent: 50,                 // 已发送
    received: 45,             // 已接收
    failed: 2,                // 失败数
    timeout: 1,               // 超时数
    trackedMessages: 98       // 追踪的消息数
  }
}
```

## 🔧 使用示例

### 示例 1: 基础请求-响应

```javascript
// 在 Content Script 中注册处理器
EventBus.on('GET_USER_DATA', async (data) => {
  const user = await fetchUser(data.userId)
  return { name: user.name, email: user.email }
})

// 在 Popup 中发送请求
const userData = await EventBus.request('GET_USER_DATA', { userId: 123 })
console.log(userData) // { name: '...', email: '...' }
```

### 示例 2: 广播事件

```javascript
// 发布事件（所有订阅者都会收到）
await EventBus.publish('SETTINGS_CHANGED', {
  theme: 'dark',
  language: 'zh-CN',
})

// 在任意组件中订阅
EventBus.subscribe('SETTINGS_CHANGED', (settings) => {
  applySettings(settings)
})
```

### 示例 3: 一次性订阅

```javascript
// 只在第一次加载时执行
EventBus.once('PAGE_READY', () => {
  console.log('页面首次就绪')
  initializeUI()
})
```

### 示例 4: 监听连接

```javascript
// 监听其他组件的连接状态
EventBus.onConnectionChange((instanceId, status) => {
  if (status === 'connected') {
    console.log('新组件连接:', instanceId)
  } else if (status === 'disconnected') {
    console.log('组件断开:', instanceId)
  }
})
```

### 示例 5: 消息追踪

```javascript
// 发送一些消息
await EventBus.request('DATA_1', {})
await EventBus.publish('DATA_2', {})

// 查看统计
const stats = EventBus.getStats()
console.log('发送:', stats.sent)
console.log('接收:', stats.received)
console.log('失败:', stats.failed)

// 查看历史
const history = EventBus.getHistory({ limit: 10 })
history.forEach((msg) => {
  console.log(msg.timestamp, msg.type, msg.messageType)
})
```

## 🆚 V1 vs V2 对比

| 功能      | V1  | V2  |
| --------- | --- | --- |
| 基础通信  | ✅  | ✅  |
| 自动重试  | ✅  | ✅  |
| 连接感知  | ✅  | ✅  |
| `once()`  | ❌  | ✅  |
| `off()`   | ❌  | ✅  |
| `clear()` | ❌  | ✅  |
| 消息追踪  | ❌  | ✅  |
| 连接事件  | ❌  | ✅  |
| 调试模式  | ❌  | ✅  |
| 性能统计  | ❌  | ✅  |

## 🚀 迁移指南

### 从 V1 迁移到 V2

EventBus V2 完全兼容 V1 的 API，无需修改现有代码：

```javascript
// V1 代码仍然可用
EventBus.request('TYPE', data)
EventBus.publish('TYPE', data)
EventBus.subscribe('TYPE', callback)
EventBus.on('TYPE', handler)
```

### 使用新功能

```javascript
// 新增的 once
EventBus.once('TYPE', callback)

// 新增的 off
EventBus.off('TYPE', callback)

// 新增的 clear
EventBus.clear()

// 新增的调试
EventBus.setDebugMode(true)
EventBus.getStats()
EventBus.getHistory()
```

## 🐛 调试技巧

### 1. 启用调试模式

```javascript
EventBus.setDebugMode(true)
// 所有操作都会输出详细日志
```

### 2. 查看消息历史

```javascript
EventBusTestV2.showRecentMessages(20)
```

### 3. 监控连接状态

```javascript
EventBus.onConnectionChange((id, status, info) => {
  console.log(`[连接] ${id}: ${status}`, info)
})
```

### 4. 运行测试

```javascript
await EventBusTestV2.runAllTests()
```

## 📝 最佳实践

1. **使用 request/publish 而不是 send**

   ```javascript
   // ✅ 推荐
   await EventBus.request('GET_DATA', {})
   await EventBus.publish('EVENT', {})

   // ❌ 不推荐（底层 API）
   await EventBus.send('TYPE', {}, { target: 'all' })
   ```

2. **及时清理订阅**

   ```javascript
   // ✅ 推荐
   const unsubscribe = EventBus.subscribe('TYPE', handler)
   // 稍后...
   unsubscribe()

   // ❌ 可能导致内存泄漏
   EventBus.subscribe('TYPE', handler)
   // 忘记取消订阅
   ```

3. **使用 once 处理一次性事件**

   ```javascript
   // ✅ 推荐
   EventBus.once('READY', init)

   // ❌ 手动取消
   EventBus.subscribe('READY', () => {
     init()
     EventBus.off('READY', arguments.callee)
   })
   ```

4. **合理使用超时**
   ```javascript
   // 根据操作类型设置合适的超时
   await EventBus.request('FAST_OPERATION', data, { timeout: 2000 })
   await EventBus.request('SLOW_OPERATION', data, { timeout: 10000 })
   ```
