# EventBus V2 快速参考

## 🚀 快速开始

```javascript
// 1. 检查状态
EventBus.getState()

// 2. 发送请求（等待响应）
const result = await EventBus.request('GET_DATA', { id: 123 })

// 3. 发布事件（不等待响应）
await EventBus.publish('DATA_UPDATED', { id: 123, name: 'test' })

// 4. 订阅事件
EventBus.subscribe('DATA_UPDATED', (data) => {
  console.log('数据更新:', data)
})

// 5. 注册处理器
EventBus.on('GET_DATA', (data) => {
  return { success: true, result: '...' }
})
```

## 📚 核心 API

### 发送消息

```javascript
// 请求-响应
const response = await EventBus.request(type, data, { timeout: 5000 })

// 发布-订阅
await EventBus.publish(type, data)
```

### 订阅消息

```javascript
// 持续订阅
const unsubscribe = EventBus.subscribe(type, callback)
unsubscribe() // 取消订阅

// 一次性订阅
EventBus.once(type, callback)

// 取消订阅
EventBus.off(type, callback)
EventBus.off(type) // 取消该类型的所有订阅
```

### 处理器

```javascript
// 注册处理器
EventBus.on(type, handler)

// 移除处理器
EventBus.removeHandler(type)
```

## 🧪 测试命令

```javascript
// 运行所有测试
EventBusTestV2.runAllTests()

// 显示状态
EventBusTestV2.showStatusPanel()

// 显示最近消息
EventBusTestV2.showRecentMessages(10)

// 启用调试
EventBusTestV2.enableDebugMode()
EventBusTestV2.disableDebugMode()
```

## 📊 状态查询

```javascript
// 获取完整状态
const state = EventBus.getState()
// { env, instanceId, isReady, connections, uptime, messageCount, stats }

// 获取统计信息
const stats = EventBus.getStats()
// { sent, received, failed, timeout, trackedMessages }

// 获取消息历史
const history = EventBus.getHistory({ limit: 20, type: 'EVENT_NAME' })
```

## 🔧 配置

```javascript
// 调试模式
EventBus.setDebugMode(true)
EventBus.setDebugMode(false)

// 清理资源
EventBus.clear()
```

## 🔗 连接事件

```javascript
// 监听连接变化
const unsubscribe = EventBus.onConnectionChange((id, status, info) => {
  console.log(`${id}: ${status}`, info)
})
unsubscribe()
```

## 💡 常用模式

### 模式 1: Popup 获取数据

```javascript
// Content Script 处理器
EventBus.on('GET_DEFAULT_SELECTORS', () => {
  return { success: true, selectors: DEFAULT_SELECTORS }
})

// Popup 发送请求
const response = await EventBus.request('GET_DEFAULT_SELECTORS', {})
const selectors = response.selectors
```

### 模式 2: 广播设置更新

```javascript
// 任意组件发布
await EventBus.publish('SETTINGS_UPDATED', { theme: 'dark' })

// 所有组件订阅
EventBus.subscribe('SETTINGS_UPDATED', (settings) => {
  applySettings(settings)
})
```

### 模式 3: 一次性事件

```javascript
// 只在第一次触发时执行
EventBus.once('INIT_COMPLETE', () => {
  initializeFeature()
})
```

### 模式 4: 错误处理

```javascript
try {
  const result = await EventBus.request('OPERATION', data, { timeout: 5000 })
  console.log('成功:', result)
} catch (error) {
  console.error('失败:', error)
  // 处理超时或其他错误
}
```

## 🎯 调试技巧

```javascript
// 1. 启用调试模式
EventBus.setDebugMode(true)

// 2. 查看实时状态
EventBusTestV2.showStatusPanel()

// 3. 查看最近消息
EventBusTestV2.showRecentMessages(20)

// 4. 运行完整测试
await EventBusTestV2.runAllTests()
```

## ⚡ 性能提示

1. **及时清理订阅** - 使用 `unsubscribe()` 或 `off()`
2. **合理设置超时** - 根据操作复杂度调整
3. **使用 once** - 一次性事件用 `once()` 代替 `subscribe()`
4. **批量处理** - 多个相关消息考虑合并
5. **定期清理** - 长时间运行的应用定期调用 `clear()`

## 🔍 故障排除

### 问题 1: 消息超时

```javascript
// 增加超时时间
const result = await EventBus.request('TYPE', data, { timeout: 10000 })

// 或检查处理器是否注册
console.log('已注册的处理器:', EventBus.getState().handlers)
```

### 问题 2: 收不到消息

```javascript
// 检查订阅
const state = EventBus.getState()
console.log('订阅列表:', state.subscriptions)

// 启用调试模式
EventBus.setDebugMode(true)
```

### 问题 3: 内存泄漏

```javascript
// 定期清理
EventBus.clear()

// 或检查未取消的订阅
console.log('订阅数:', EventBus.getState().subscriptions.length)
```
