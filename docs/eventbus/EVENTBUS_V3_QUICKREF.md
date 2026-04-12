# EventBus V3 快速参考

## 🚀 V3 新功能

| 功能 | 说明 | API |
|------|------|-----|
| **命名空间** | 避免消息类型冲突 | `namespace(name)` |
| **批量消息** | 一次发送多条消息 | `batch(messages)` |
| **中间件** | 消息处理管道 | `use(middleware)` |
| **优先级队列** | 消息优先级 | `{ priority: 0\|1\|2 }` |
| **重试策略** | 可配置的重试 | `setRetryPolicy(type, policy)` |
| **消息去重** | 自动去重 | 自动启用 |
| **性能监控** | P99延迟等指标 | `getStats().performance` |

## 📚 核心 API

### 基础通信（与 V2 兼容）

```javascript
// 请求-响应
const result = await EventBus.request('GET_DATA', { id: 123 });

// 发布事件
await EventBus.publish('DATA_UPDATED', { id: 123 });

// 订阅事件
const unsubscribe = EventBus.subscribe('DATA_UPDATED', handler);

// 注册处理器
EventBus.on('GET_DATA', (data) => ({ result: '...' }));
```

### V3 新增 API

```javascript
// 命名空间
const api = EventBus.namespace('myModule');
api.request('GET_USER', { id: 1 });    // 发送: myModule:GET_USER
api.subscribe('UPDATED', handler);     // 订阅: myModule:UPDATED

// 批量消息
await EventBus.batch([
  { type: 'UPDATE_1', data: { id: 1 } },
  { type: 'UPDATE_2', data: { id: 2 } },
  { type: 'UPDATE_3', data: { id: 3 } }
]);

// 中间件
EventBus.use((message, next) => {
  console.log('消息发送前:', message);
  return next();
});

// 重试策略
EventBus.setRetryPolicy('API_CALL', {
  maxRetries: 5,
  retryDelay: 1000,
  backoff: 'exponential',
  shouldRetry: (error) => error.status === 503
});

// 优先级消息
await EventBus.request('HIGH_PRIORITY', data, {
  priority: 0  // HIGH=0, NORMAL=1, LOW=2
});
```

## 🎯 命名空间使用

```javascript
// 创建命名空间
const userAPI = EventBus.namespace('user');
const orderAPI = EventBus.namespace('order');

// 命名空间 API
userAPI.request('GET', { id: 1 });        // user:GET
userAPI.publish('CREATED', { user });     // user:CREATED
userAPI.subscribe('DELETED', handler);   // user:DELETED
userAPI.on('UPDATE', handler);           // user:UPDATE

// 避免命名冲突
// user:UPDATED 和 order:UPDATED 是不同的事件
```

## 📦 批量消息

```javascript
// 批量发送
const messages = [
  { type: 'CREATE_USER', data: { name: 'Alice' } },
  { type: 'CREATE_USER', data: { name: 'Bob' } },
  { type: 'CREATE_USER', data: { name: 'Charlie' } }
];
await EventBus.batch(messages);

// 批量请求（通过命名空间）
const api = EventBus.namespace('api');
const results = await Promise.all([
  api.request('GET_USER', { id: 1 }),
  api.request('GET_USER', { id: 2 }),
  api.request('GET_USER', { id: 3 })
]);
```

## 🔧 中间件

```javascript
// 日志中间件
EventBus.use((message, next) => {
  console.log(`[发送] ${message.type}`, message.data);
  return next();
});

// 认证中间件
EventBus.use((message, next) => {
  if (message.type.startsWith('ADMIN:')) {
    // 检查权限
    if (!hasAdminPermission()) {
      throw new Error('需要管理员权限');
    }
  }
  return next();
});

// 性能监控中间件
EventBus.use((message, next) => {
  const start = performance.now();
  return next().then(() => {
    const duration = performance.now() - start;
    console.log(`${message.type} 耗时: ${duration}ms`);
  });
});
```

## 🔄 重试策略

```javascript
// 线性退避（默认）
EventBus.setRetryPolicy('HTTP_REQUEST', {
  maxRetries: 3,
  retryDelay: 500,
  backoff: 'linear'
});
// 延迟: 500ms, 500ms, 500ms

// 指数退避
EventBus.setRetryPolicy('API_CALL', {
  maxRetries: 5,
  retryDelay: 200,
  backoff: 'exponential'
});
// 延迟: 200ms, 400ms, 800ms, 1600ms, 3200ms

// 条件重试
EventBus.setRetryPolicy('DATABASE', {
  maxRetries: 3,
  retryDelay: 1000,
  shouldRetry: (error) => {
    // 只在网络错误时重试
    return error.code === 'NETWORK_ERROR';
  }
});
```

## ⚡ 优先级

```javascript
import { EventBus } from './event-bus';

// 高优先级
await EventBus.request('URGENT', data, { priority: 0 });

// 普通优先级（默认）
await EventBus.request('NORMAL', data, { priority: 1 });

// 低优先级
await EventBus.request('BACKGROUND', data, { priority: 2 });
```

## 📊 性能监控

```javascript
// 获取性能指标
const stats = EventBus.getStats();
console.log(stats.performance);
// {
//   avgLatency: 2.5,      // 平均延迟
//   p99Latency: 8.2,      // P99 延迟
//   avgHandlerTime: 1.2,  // 平均处理时间
//   p99HandlerTime: 4.5,  // P99 处理时间
//   totalMessages: 1234,  // 总消息数
//   totalHandlers: 567    // 总处理器调用
// }

// 显示性能面板
EventBusTestV3.showPerformanceMetrics();

// 运行基准测试
EventBusTestV3.runBenchmark();
```

## 🔍 去重

```javascript
// 自动去重（默认启用）
// 相同类型的消息 + 相同数据，在去重窗口内只处理一次

await EventBus.publish('UPDATE', { id: 1, value: 'A' });
await EventBus.publish('UPDATE', { id: 1, value: 'A' }); // 被去重
await EventBus.publish('UPDATE', { id: 1, value: 'B' }); // 不同数据，处理

// 配置去重窗口
EventBus.configure({
  ENABLE_DEDUPLICATION: true,
  DEDUPLICATION_WINDOW: 2000  // 2秒窗口
});
```

## 🧪 测试命令

```javascript
// 运行所有测试
EventBusTestV3.runAllTests();

// 显示状态
EventBusTestV3.showStatusPanel();
EventBusTestV3.showPerformanceMetrics();
EventBusTestV3.showNamespaces();

// 显示最近消息
EventBusTestV3.showRecentMessages(20);

// 性能基准测试
EventBusTestV3.runBenchmark();

// 调试模式
EventBusTestV3.enableDebugMode();
EventBusTestV3.disableDebugMode();
```

## 💡 使用场景

### 场景 1: 模块化架构

```javascript
// 用户模块
const UserModule = EventBus.namespace('user');
UserModule.on('GET', (data) => fetchUser(data.id));
UserModule.on('CREATE', (data) => createUser(data));

// 订单模块
const OrderModule = EventBus.namespace('order');
OrderModule.on('GET', (data) => fetchOrder(data.id));
OrderModule.on('CREATE', (data) => createOrder(data));

// 使用
const user = await UserModule.request('GET', { id: 1 });
const order = await OrderModule.request('GET', { id: 1 });
```

### 场景 2: 批量操作

```javascript
// 批量创建
const users = [
  { name: 'Alice' },
  { name: 'Bob' },
  { name: 'Charlie' }
];

await EventBus.batch(
  users.map(u => ({ type: 'CREATE_USER', data: u }))
);
```

### 场景 3: 中间件链

```javascript
// 添加认证
EventBus.use(authMiddleware);

// 添加日志
EventBus.use(loggingMiddleware);

// 添加缓存
EventBus.use(cacheMiddleware);

// 添加错误处理
EventBus.use(errorHandlerMiddleware);
```

### 场景 4: 智能重试

```javascript
// 对 API 请求使用指数退避
EventBus.setRetryPolicy('API_REQUEST', {
  maxRetries: 5,
  retryDelay: 200,
  backoff: 'exponential',
  shouldRetry: (error) => error.status >= 500
});

// 对数据库操作使用线性重试
EventBus.setRetryPolicy('DB_QUERY', {
  maxRetries: 2,
  retryDelay: 100,
  backoff: 'linear'
});
```

## 🆚 版本对比

| 功能 | V1 | V2 | V3 |
|------|----|----|-----|
| 基础通信 | ✅ | ✅ | ✅ |
| Once/Off | ❌ | ✅ | ✅ |
| 消息追踪 | ❌ | ✅ | ✅ |
| 连接事件 | ❌ | ✅ | ✅ |
| 命名空间 | ❌ | ❌ | ✅ |
| 批量消息 | ❌ | ❌ | ✅ |
| 中间件 | ❌ | ❌ | ✅ |
| 优先级队列 | ❌ | ❌ | ✅ |
| 重试策略 | ❌ | ❌ | ✅ |
| 消息去重 | ❌ | ❌ | ✅ |
| 性能监控 | ❌ | ❌ | ✅ |
| TypeScript | ❌ | ❌ | ✅ |

## 📈 性能特性

- **P99 延迟监控** - 了解最慢的 1% 消息
- **吞吐量测量** - 消息/秒统计
- **处理器时间** - 监控处理器执行时间
- **内存优化** - 自动清理过期数据
- **采样率控制** - 降低性能监控开销

## 🔧 配置选项

```javascript
EventBus.configure({
  // 功能开关
  ENABLE_NAMESPACES: true,
  ENABLE_PRIORITY: true,
  ENABLE_MIDDLEWARE: true,
  ENABLE_DEDUPLICATION: true,

  // 性能配置
  MAX_PENDING_MESSAGES: 100,
  DEDUPLICATION_WINDOW: 1000,
  PERF_SAMPLE_RATE: 0.1,  // 10% 采样

  // 调试
  DEBUG_MODE: false,
  ENABLE_TRACKING: true,
  MAX_TRACKING_SIZE: 500
});
```

## ⚠️ 注意事项

1. **命名空间**: 启用后，所有消息都会被解析命名空间
2. **去重**: 默认窗口 1000ms，相同消息只处理一次
3. **中间件**: 按注册顺序执行，注意顺序
4. **优先级**: 只影响待处理队列，不影响已发送的消息
5. **性能监控**: 默认 10% 采样率，避免影响性能
