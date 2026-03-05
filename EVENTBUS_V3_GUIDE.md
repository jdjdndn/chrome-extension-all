# EventBus V3 完整指南

## 📖 目录

1. [简介](#简介)
2. [核心概念](#核心概念)
3. [V3 新功能](#v3-新功能)
4. [API 参考](#api-参考)
5. [最佳实践](#最佳实践)
6. [性能优化](#性能优化)
7. [故障排除](#故障排除)
8. [迁移指南](#迁移指南)

---

## 简介

EventBus V3 是一个功能强大、高性能的 Chrome 扩展通信事件总线。它提供了简洁的 API 来处理所有组件间的通信。

### 核心特性

- ✅ 统一 API - 所有组件使用相同的方法
- ✅ 类型安全 - TypeScript 支持
- ✅ 高性能 - P99 延迟监控
- ✅ 可靠性 - 自动重试、消息去重
- ✅ 可扩展 - 中间件系统
- ✅ 模块化 - 命名空间支持
- ✅ 可观测 - 完整的追踪和监控

---

## 核心概念

### 消息类型

EventBus 支持两种消息模式：

#### 1. 请求-响应模式
```javascript
// 发送请求，等待响应
const result = await EventBus.request('GET_USER', { userId: 123 });
// 返回: { name: 'Alice', email: 'alice@example.com' }
```

#### 2. 发布-订阅模式
```javascript
// 发布事件，不等待响应
await EventBus.publish('USER_CREATED', { userId: 123, name: 'Alice' });

// 订阅事件
EventBus.subscribe('USER_CREATED', (user) => {
  console.log('新用户:', user);
});
```

### 运行环境

EventBus 支持所有 Chrome 扩展环境：

- `content_script` - 内容脚本
- `background` - 后台服务
- `popup` - 弹出窗口
- `options` - 选项页面
- `devtools` - 开发者工具

---

## V3 新功能

### 1. 命名空间

避免不同模块间的消息类型冲突：

```javascript
// 创建命名空间
const UserAPI = EventBus.namespace('user');
const OrderAPI = EventBus.namespace('order');

// 使用命名空间 API
UserAPI.request('GET', { id: 1 });        // 发送: user:GET
UserAPI.publish('CREATED', { user });     // 发送: user:CREATED

OrderAPI.request('GET', { id: 1 });       // 发送: order:GET
OrderAPI.publish('CREATED', { order });    // 发送: order:CREATED
```

### 2. 批量消息

一次发送多条消息，提高效率：

```javascript
await EventBus.batch([
  { type: 'UPDATE_USER', data: { id: 1, name: 'Alice' } },
  { type: 'UPDATE_USER', data: { id: 2, name: 'Bob' } },
  { type: 'UPDATE_USER', data: { id: 3, name: 'Charlie' } }
]);
```

### 3. 中间件系统

在消息处理链中添加自定义逻辑：

```javascript
// 日志中间件
EventBus.use((message, next) => {
  console.log(`[${message.type}] 发送消息`, message.data);
  return next();
});

// 认证中间件
EventBus.use((message, next) => {
  if (message.type.startsWith('ADMIN:') && !isAdmin()) {
    throw new Error('需要管理员权限');
  }
  return next();
});

// 缓存中间件
EventBus.use((message, next) => {
  if (message.expectResponse) {
    const cached = cache.get(message.type, message.data);
    if (cached) return cached;
  }
  return next();
});
```

### 4. 优先级队列

为重要消息设置更高优先级：

```javascript
// 高优先级（紧急）
await EventBus.request('URGENT', data, { priority: 0 });

// 普通优先级（默认）
await EventBus.request('NORMAL', data, { priority: 1 });

// 低优先级（后台）
await EventBus.request('BACKGROUND', data, { priority: 2 });
```

### 5. 智能重试

为不同类型的消息配置重试策略：

```javascript
// 指数退避 - 适合 API 调用
EventBus.setRetryPolicy('API_CALL', {
  maxRetries: 5,
  retryDelay: 200,
  backoff: 'exponential'
});
// 延迟: 200ms, 400ms, 800ms, 1600ms, 3200ms

// 线性重试 - 适合快速操作
EventBus.setRetryPolicy('QUICK_OP', {
  maxRetries: 3,
  retryDelay: 100,
  backoff: 'linear'
});
// 延迟: 100ms, 100ms, 100ms

// 条件重试 - 只对特定错误重试
EventBus.setRetryPolicy('DATABASE', {
  maxRetries: 2,
  retryDelay: 500,
  shouldRetry: (error) => error.code === 'CONNECTION_ERROR'
});
```

### 6. 消息去重

自动去重相同消息，避免重复处理：

```javascript
// 配置去重窗口
EventBus.configure({
  ENABLE_DEDUPLICATION: true,
  DEDUPLICATION_WINDOW: 2000  // 2秒窗口
});

// 这些消息只处理一次
await EventBus.publish('UPDATE', { id: 1, value: 'A' });
await EventBus.publish('UPDATE', { id: 1, value: 'A' }); // 被去重
```

### 7. 性能监控

实时监控消息性能：

```javascript
// 获取性能指标
const stats = EventBus.getStats();
console.log(stats.performance);
// {
//   avgLatency: 2.5,      // 平均延迟
//   p99Latency: 8.2,      // P99 延迟
//   avgHandlerTime: 1.2,  // 平均处理时间
//   p99HandlerTime: 4.5   // P99 处理时间
// }

// 显示性能面板
EventBusTestV3.showPerformanceMetrics();
```

---

## API 参考

### 发送消息

#### EventBus.request(type, data, options)
发送请求并等待响应。

```javascript
const result = await EventBus.request('GET_USER', { userId: 123 }, {
  timeout: 5000,    // 超时时间（毫秒）
  priority: 0       // 优先级（0=高, 1=普通, 2=低）
});
```

#### EventBus.publish(type, data)
发布事件，不等待响应。

```javascript
await EventBus.publish('USER_UPDATED', {
  userId: 123,
  name: 'Alice'
});
```

#### EventBus.batch(messages)
批量发送多条消息。

```javascript
await EventBus.batch([
  { type: 'CREATE_USER', data: { name: 'Alice' } },
  { type: 'CREATE_USER', data: { name: 'Bob' } }
]);
```

### 订阅消息

#### EventBus.subscribe(type, callback)
订阅事件，返回取消订阅函数。

```javascript
const unsubscribe = EventBus.subscribe('USER_UPDATED', (user) => {
  console.log('用户更新:', user);
});

// 取消订阅
unsubscribe();
```

#### EventBus.once(type, callback)
一次性订阅，只触发一次。

```javascript
EventBus.once('INIT_COMPLETE', () => {
  console.log('初始化完成');
});
```

#### EventBus.off(type, callback?)
取消订阅。

```javascript
// 取消特定回调
EventBus.off('USER_UPDATED', specificCallback);

// 取消该类型的所有订阅
EventBus.off('USER_UPDATED');
```

### 处理器

#### EventBus.on(type, handler)
注册消息处理器。

```javascript
EventBus.on('GET_USER', (data) => {
  const user = fetchUser(data.userId);
  return { name: user.name, email: user.email };
});
```

#### EventBus.removeHandler(type)
移除处理器。

```javascript
EventBus.removeHandler('GET_USER');
```

### 命名空间

#### EventBus.namespace(name)
创建命名空间 API。

```javascript
const api = EventBus.namespace('mymodule');

api.request('ACTION', data);      // mymodule:ACTION
api.publish('EVENT', data);       // mymodule:EVENT
api.subscribe('EVENT', handler);  // mymodule:EVENT
api.on('ACTION', handler);       // mymodule:ACTION
api.once('EVENT', handler);       // mymodule:EVENT
```

### 中间件

#### EventBus.use(middleware)
添加中间件。

```javascript
EventBus.use((message, next) => {
  // 前置处理
  console.log('发送前:', message);

  return next().then(() => {
    // 后置处理
    console.log('发送后');
  });
});
```

### 重试策略

#### EventBus.setRetryPolicy(type, policy)
设置重试策略。

```javascript
EventBus.setRetryPolicy('API_CALL', {
  maxRetries: 3,           // 最大重试次数
  retryDelay: 500,         // 重试延迟（毫秒）
  backoff: 'exponential',  // 退避方式：linear | exponential
  shouldRetry: (error) => true  // 是否重试
});
```

### 配置

#### EventBus.configure(options)
配置 EventBus。

```javascript
EventBus.configure({
  ENABLE_NAMESPACES: true,
  ENABLE_PRIORITY: true,
  ENABLE_MIDDLEWARE: true,
  ENABLE_DEDUPLICATION: true,
  DEDUPLICATION_WINDOW: 1000,
  DEBUG_MODE: false,
  ENABLE_TRACKING: true,
  ENABLE_PERFORMANCE_MONITORING: true
});
```

#### EventBus.setDebugMode(enabled)
设置调试模式。

```javascript
EventBus.setDebugMode(true);
```

### 状态查询

#### EventBus.getState()
获取完整状态。

```javascript
const state = EventBus.getState();
// {
//   env: 'content_script',
//   instanceId: '...',
//   isReady: true,
//   connections: [...],
//   subscriptions: [...],
//   handlers: [...],
//   namespaces: [...],
//   uptime: 12345,
//   messageCount: 100,
//   queueSize: 0,
//   stats: {...},
//   performance: {...}
// }
```

#### EventBus.getStats()
获取统计信息。

```javascript
const stats = EventBus.getStats();
// {
//   sent: 50,
//   received: 45,
//   failed: 2,
//   timeout: 1,
//   retried: 3,
//   trackedMessages: 98,
//   performance: {...},
//   queueSize: 0
// }
```

#### EventBus.getHistory(filter)
获取消息历史。

```javascript
const history = EventBus.getHistory({
  type: 'receive',        // 按类型过滤
  namespace: 'user',      // 按命名空间过滤
  limit: 20              // 限制数量
});
```

### 清理

#### EventBus.clear()
清理所有资源。

```javascript
EventBus.clear();
```

---

## 最佳实践

### 1. 使用命名空间组织代码

```javascript
// ✅ 推荐 - 使用命名空间
const UserAPI = EventBus.namespace('user');
const OrderAPI = EventBus.namespace('order');

UserAPI.on('GET', getUserHandler);
OrderAPI.on('GET', getOrderHandler);

// ❌ 不推荐 - 全局命名
EventBus.on('USER_GET', getUserHandler);
EventBus.on('ORDER_GET', getOrderHandler);
```

### 2. 及时清理订阅

```javascript
// ✅ 推荐 - 自动清理
const unsubscribe = EventBus.subscribe('DATA', handler);
// 稍后...
unsubscribe();

// ❌ 不推荐 - 可能导致内存泄漏
EventBus.subscribe('DATA', handler);
// 忘记取消订阅
```

### 3. 使用 Once 处理一次性事件

```javascript
// ✅ 推荐
EventBus.once('READY', init);

// ❌ 不推荐
EventBus.subscribe('READY', () => {
  init();
  EventBus.off('READY', arguments.callee);
});
```

### 4. 合理使用批量消息

```javascript
// ✅ 推荐 - 批量处理相似操作
await EventBus.batch(
  users.map(u => ({ type: 'CREATE_USER', data: u }))
);

// ❌ 不推荐 - 逐个发送
for (const user of users) {
  await EventBus.publish('CREATE_USER', user);
}
```

### 5. 配置合适的重试策略

```javascript
// ✅ 推荐 - 根据操作类型配置
EventBus.setRetryPolicy('QUICK_API', {
  maxRetries: 2,
  retryDelay: 100,
  backoff: 'linear'
});

EventBus.setRetryPolicy('SLOW_API', {
  maxRetries: 5,
  retryDelay: 500,
  backoff: 'exponential'
});

// ❌ 不推荐 - 使用默认配置
// 所有操作使用相同的重试策略
```

### 6. 使用中间件统一处理

```javascript
// ✅ 推荐 - 中间件处理横切关注点
EventBus.use(authMiddleware);
EventBus.use(loggingMiddleware);
EventBus.use(errorHandlerMiddleware);

// ❌ 不推荐 - 在每个处理器中重复逻辑
EventBus.on('ACTION1', (data) => {
  checkAuth();
  log('ACTION1');
  try {
    handleAction1(data);
  } catch (e) {
    handleError(e);
  }
});
```

---

## 性能优化

### 1. 启用消息去重

```javascript
EventBus.configure({
  ENABLE_DEDUPLICATION: true,
  DEDUPLICATION_WINDOW: 1000
});
```

### 2. 使用批量消息

```javascript
// 减少 Chrome API 调用次数
await EventBus.batch(messages);
```

### 3. 调整采样率

```javascript
EventBus.configure({
  PERF_SAMPLE_RATE: 0.1  // 只监控 10% 的消息
});
```

### 4. 使用命名空间

```javascript
// 减少消息冲突，提高路由效率
const api = EventBus.namespace('module');
api.request('ACTION', data);
```

### 5. 配置合适的超时

```javascript
// 根据操作复杂度设置超时
await EventBus.request('FAST_OP', data, { timeout: 2000 });
await EventBus.request('SLOW_OP', data, { timeout: 10000 });
```

---

## 故障排除

### 问题 1: 消息超时

**原因**: 处理器未注册或执行时间过长

**解决**:
```javascript
// 检查处理器是否注册
console.log('处理器:', EventBus.getState().handlers);

// 增加超时时间
await EventBus.request('TYPE', data, { timeout: 10000 });

// 检查性能
EventBusTestV3.showPerformanceMetrics();
```

### 问题 2: 收不到消息

**原因**: 命名空间不匹配或订阅错误

**解决**:
```javascript
// 检查订阅
console.log('订阅:', EventBus.getState().subscriptions);

// 检查命名空间
EventBusTestV3.showNamespaces();

// 启用调试模式
EventBus.setDebugMode(true);
```

### 问题 3: 性能问题

**原因**: 消息过多或处理器慢

**解决**:
```javascript
// 查看性能指标
const perf = EventBus.getStats().performance;
console.log('P99 延迟:', perf.p99Latency);

// 启用批量消息
await EventBus.batch(messages);

// 优化处理器
EventBus.on('SLOW_OP', async (data) => {
  // 异步处理
  return await processSlowly(data);
});
```

### 问题 4: 内存泄漏

**原因**: 未取消订阅

**解决**:
```javascript
// 使用 once 代替 subscribe
EventBus.once('EVENT', handler);

// 或确保取消订阅
const unsubscribe = EventBus.subscribe('EVENT', handler);
// 稍后...
unsubscribe();

// 定期清理
setInterval(() => {
  EventBus.clear();
}, 60000); // 每分钟
```

---

## 迁移指南

### 从 V1 迁移到 V3

V3 完全兼容 V1 的基础 API：

```javascript
// V1 代码在 V3 中仍然可用
await EventBus.request('TYPE', data);
await EventBus.publish('TYPE', data);
EventBus.subscribe('TYPE', callback);
EventBus.on('TYPE', handler);
```

### 采用 V3 新功能

```javascript
// 1. 使用命名空间
const api = EventBus.namespace('module');

// 2. 使用批量消息
await EventBus.batch(messages);

// 3. 使用中间件
EventBus.use(middleware);

// 4. 配置重试策略
EventBus.setRetryPolicy('TYPE', policy);
```

### 配置 V3

```javascript
EventBus.configure({
  ENABLE_NAMESPACES: true,
  ENABLE_PRIORITY: true,
  ENABLE_MIDDLEWARE: true,
  ENABLE_DEDUPLICATION: true,
  ENABLE_PERFORMANCE_MONITORING: true
});
```

---

## TypeScript 支持

V3 提供完整的 TypeScript 类型定义：

```typescript
import { EventBus } from './event-bus-v3';

// 类型安全的请求
interface User {
  id: number;
  name: string;
}

const user = await EventBus.request<User>('GET_USER', { userId: 123 });

// 类型安全的处理器
EventBus.on<{ userId: number }, User>('GET_USER', async (data) => {
  return await fetchUser(data.userId);
});

// 类型安全的订阅
EventBus.subscribe<User>('USER_UPDATED', (user) => {
  console.log(user.name);
});
```

---

## 更多资源

- **快速参考**: `EVENTBUS_V3_QUICKREF.md`
- **类型定义**: `event-bus-v3.d.ts`
- **测试工具**: `EventBusTestV3` 对象
- **示例代码**: 查看各模块中的实际使用
