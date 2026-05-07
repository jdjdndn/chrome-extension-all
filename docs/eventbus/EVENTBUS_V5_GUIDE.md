# EventBus V5 完整指南

## 🎉 V5 新功能

EventBus V5 是**开发者增强版**，专注于提升开发体验和可视化调试能力。

### 1. DevTools 集成面板

实时监控 EventBus 运行状态，可视化消息流。

```javascript
// 连接 DevTools 面板
EventBus.connectDevTools()

// 断开连接
EventBus.disconnectDevTools()
```

**面板功能**：

- 📊 实时统计仪表板
- 📨 消息列表和详情查看
- 📈 性能图表（吞吐量、延迟、内存）
- ⏺️ 消息录制和回放
- 🏥 健康状态分析

### 2. 消息录制和回放

记录消息流用于调试和测试。

```javascript
// 开始录制
EventBus.startRecording({
  name: '测试录制',
  description: '录制用户操作流程',
})

// ... 发送消息 ...

// 停止录制
const recording = EventBus.stopRecording()
// recording.messages 包含所有录制的消息

// 导出录制
const exported = EventBus.exportRecording()
// 保存到文件或发送到服务器

// 导入录制
EventBus.importRecording(exported)

// 回放消息
await EventBus.replay(recording.messages, {
  speed: 2, // 2倍速回放
  delay: 100, // 消息间延迟
})
```

### 3. 消息模板系统

定义可重用的消息类型。

```javascript
// 定义模板
EventBus.defineTemplate('USER_ACTION', {
  schema: {
    required: ['userId', 'action', 'timestamp'],
  },
  defaults: {
    timestamp: Date.now(),
  },
  validate: (data) => {
    const errors = []
    if (!data.userId) errors.push('userId required')
    if (!data.action) errors.push('action required')
    return errors.length > 0 ? errors : null
  },
})

// 创建模板消息
const message = EventBus.createMessage('USER_ACTION', {
  userId: '123',
  action: 'click',
})
// message = { __template: 'USER_ACTION', userId: '123', action: 'click', timestamp: ... }

// 列出所有模板
const templates = EventBus.listTemplates()
```

### 4. 内存分析器

监控内存使用情况，检测内存泄漏。

```javascript
// 启动内存分析
EventBus.startMemoryProfiler()

// ... 执行操作 ...

// 停止分析
EventBus.stopMemoryProfiler()

// 获取报告
const report = EventBus.getMemoryReport()
console.log(report)
// {
//   samples: 100,
//   duration: 100000,
//   memory: {
//     current: 52428800,
//     peak: 67108864,
//     average: 55000000,
//     trend: 1048576
//   }
// }
```

### 5. 智能错误诊断

自动分析错误并提供修复建议。

```javascript
// 获取健康分析
const health = EventBus.getHealthAnalysis()

console.log(health.overall) // 'healthy' | 'degraded' | 'unhealthy'

health.issues.forEach((issue) => {
  console.log(issue.severity) // 'high' | 'medium' | 'low'
  console.log(issue.message) // 问题描述
  console.log(issue.suggestion) // 修复建议
})
```

**诊断的错误类型**：

- 超时错误
- 缺少处理器
- 连接丢失
- 序列化错误
- 内存泄漏

### 6. 性能指标增强

详细的性能分析，包括百分位数。

```javascript
// 获取所有性能指标
const metrics = EventBus.getPerformanceMetrics()

metrics.forEach((m) => {
  console.log(m.operation)
  console.log('  count:', m.count)
  console.log('  average:', m.average.toFixed(2), 'ms')
  console.log('  min:', m.min.toFixed(2), 'ms')
  console.log('  max:', m.max.toFixed(2), 'ms')
  console.log('  P50:', m.p50.toFixed(2), 'ms')
  console.log('  P95:', m.p95.toFixed(2), 'ms')
  console.log('  P99:', m.p99.toFixed(2), 'ms')
})

// 获取特定操作的指标
const requestMetrics = EventBus.getPerformanceMetrics('REQUEST')
```

### 7. 可视化数据生成

生成图表数据用于自定义可视化。

```javascript
// 消息图（节点和边）
const graph = EventBus.getVisualization('graph')
// { nodes: [...], links: [...] }

// 时间线
const timeline = EventBus.getVisualization('timeline')
// [{ timestamp, type, from, duration, success }, ...]

// 热力图
const heatmap = EventBus.getVisualization('heatmap')
// [{ hour, type, count }, ...]
```

### 8. 消息序列化优化

支持多种序列化格式。

```javascript
// 设置序列化格式
EventBus.setSerializationFormat('json') // 标准 JSON
EventBus.setSerializationFormat('compact') // 紧凑 JSON（支持 Error 和 Function）
```

### 9. 系统快照

获取完整系统状态快照。

```javascript
const snapshot = EventBus.getSnapshot()

console.log(snapshot)
// {
//   timestamp: ...,
//   state: { ... },
//   stats: { ... },
//   performance: [ ... ],
//   memory: { ... },
//   health: { ... }
// }
```

---

## 📊 完整 API

### 核心通信 API

```javascript
// 发布-订阅
await EventBus.publish(type, data, options)
const unsubscribe = EventBus.subscribe(type, callback, options)

// 请求-响应
const response = await EventBus.request(type, data, options)
EventBus.on(type, handler)

// 一次性订阅
EventBus.once(type, callback)

// 取消订阅
EventBus.off(type, callback)
EventBus.clear()
```

### V5 新增 API

```javascript
// DevTools
EventBus.connectDevTools()
EventBus.disconnectDevTools()

// 录制
EventBus.startRecording(metadata)
const recording = EventBus.stopRecording()
EventBus.getRecording()
EventBus.clearRecording()
const exported = EventBus.exportRecording()
EventBus.importRecording(data)
await EventBus.replay(messages, options)

// 模板
EventBus.defineTemplate(name, template)
const message = EventBus.createMessage(name, data)
const templates = EventBus.listTemplates()

// 内存分析
EventBus.startMemoryProfiler()
EventBus.stopMemoryProfiler()
const report = EventBus.getMemoryReport()

// 性能指标
const metrics = EventBus.getPerformanceMetrics(operation)

// 健康分析
const health = EventBus.getHealthAnalysis()

// 可视化
const graph = EventBus.getVisualization('graph')
const timeline = EventBus.getVisualization('timeline')
const heatmap = EventBus.getVisualization('heatmap')

// 序列化
EventBus.setSerializationFormat(format)

// 快照
const snapshot = EventBus.getSnapshot()
```

### V4 继承 API

```javascript
// 配置
EventBus.configure(settings)
EventBus.getConfig()

// 断路器
EventBus.getCircuitBreakerState(type)
EventBus.getAllCircuitBreakerStates()
EventBus.resetCircuitBreaker(type)

// 插件
EventBus.registerPlugin(plugin)
EventBus.unregisterPlugin(name)
EventBus.enablePlugin(name)
EventBus.disablePlugin(name)
EventBus.getPlugins()

// 状态
EventBus.getState()
EventBus.getStats()
EventBus.getHistory(filter)
```

---

## 🎯 使用场景

### 场景 1: 调试消息流

```javascript
// 1. 启动录制
EventBus.startRecording({ scenario: '用户登录流程' })

// 2. 执行操作
await EventBus.publish('USER_LOGIN', { username: 'test' })
await EventBus.publish('USER_AUTH', { token: '...' })
await EventBus.publish('NAVIGATE', { page: 'dashboard' })

// 3. 停止录制
const recording = EventBus.stopRecording()

// 4. 导出用于分享或分析
const json = EventBus.exportRecording()
console.log(json) // 可以保存到文件

// 5. 回放用于复现
await EventBus.replay(recording.messages)
```

### 场景 2: 性能优化

```javascript
// 1. 启动性能监控
EventBus.startMemoryProfiler()

// 2. 执行操作
for (let i = 0; i < 1000; i++) {
  await EventBus.request('PROCESS_DATA', { id: i })
}

// 3. 停止并分析
EventBus.stopMemoryProfiler()
const memReport = EventBus.getMemoryReport()
const perfMetrics = EventBus.getPerformanceMetrics('PROCESS_DATA')

// 4. 检查问题
const health = EventBus.getHealthAnalysis()
if (health.overall !== 'healthy') {
  console.warn('发现性能问题:', health.issues)
}
```

### 场景 3: 使用消息模板

```javascript
// 定义常用消息模板
EventBus.defineTemplate('API_CALL', {
  schema: { required: ['endpoint', 'method'] },
  defaults: {
    timestamp: Date.now(),
    retryCount: 0,
  },
})

EventBus.defineTemplate('UI_EVENT', {
  schema: { required: ['eventType', 'element'] },
  validate: (data) => {
    if (!['click', 'hover', 'focus'].includes(data.eventType)) {
      return ['Invalid eventType']
    }
    return null
  },
})

// 使用模板
await EventBus.publish(
  EventBus.createMessage('API_CALL', {
    endpoint: '/api/users',
    method: 'GET',
  })
)

await EventBus.publish(
  EventBus.createMessage('UI_EVENT', {
    eventType: 'click',
    element: '#submit-button',
  })
)
```

### 场景 4: DevTools 实时监控

```javascript
// 在应用启动时连接 DevTools
if (process.env.NODE_ENV === 'development') {
  EventBus.connectDevTools()
}

// DevTools 面板会自动显示：
// - 实时消息流
// - 性能指标
// - 内存使用
// - 健康状态
```

---

## 🧪 测试工具命令

```javascript
// 基础测试
EventBusTestV5.runAllTests()

// 状态查看
EventBusTestV5.showFullStatus()
EventBusTestV5.showPerformanceMetrics()
EventBusTestV5.showMemoryReport()
EventBusTestV5.showHealthAnalysis()
EventBusTestV5.showTemplates()

// 性能测试
EventBusTestV5.runBenchmark()

// 演示
EventBusTestV5.demoRecordingAndReplay()

// 快照
EventBusTestV5.getSnapshot()
```

---

## 📈 V4 vs V5 对比

| 功能          | V4  | V5  |
| ------------- | --- | --- |
| 基础通信      | ✅  | ✅  |
| 断路器        | ✅  | ✅  |
| 插件系统      | ✅  | ✅  |
| 消息压缩      | ✅  | ✅  |
| 健康检查      | ✅  | ✅  |
| DevTools 面板 | ❌  | ✅  |
| 消息录制      | ❌  | ✅  |
| 消息回放      | ❌  | ✅  |
| 消息模板      | ❌  | ✅  |
| 内存分析器    | ❌  | ✅  |
| 智能错误诊断  | ❌  | ✅  |
| 性能百分位    | ❌  | ✅  |
| 可视化数据    | ❌  | ✅  |
| 序列化优化    | ❌  | ✅  |

---

## 🔧 配置选项

```javascript
EventBus.configure({
  // V4 配置
  DEBUG_MODE: true,
  ENABLE_CIRCUIT_BREAKER: true,
  ENABLE_COMPRESSION: true,
  ENABLE_PLUGINS: true,
  ENABLE_HEALTH_CHECK: true,

  // V5 新增配置
  ENABLE_DEVTOOLS_PANEL: true,
  ENABLE_MESSAGE_RECORDING: false,
  ENABLE_VISUALIZATION: true,
  ENABLE_MEMORY_PROFILING: true,
  ENABLE_SMART_ERRORS: true,
  ENABLE_MESSAGE_TEMPLATES: true,
  ENABLE_SERIALIZATION: true,
  SERIALIZATION_FORMAT: 'json',

  // DevTools 配置
  DEVTOOLS_PANEL_ID: 'eventbus-monitor',
  MAX_DISPLAY_MESSAGES: 1000,

  // 录制配置
  MAX_RECORDED_MESSAGES: 5000,
  RECORDING_AUTO_START: false,

  // 可视化配置
  CHART_UPDATE_INTERVAL: 1000,
  PERFORMANCE_HISTORY_SIZE: 100,
})
```

---

## 💡 最佳实践

### 1. 开发环境

```javascript
// 启用所有调试功能
EventBus.configure({
  DEBUG_MODE: true,
  ENABLE_DEVTOOLS_PANEL: true,
  ENABLE_MEMORY_PROFILING: true,
  ENABLE_SMART_ERRORS: true,
  ENABLE_TRACKING: true,
})

EventBus.connectDevTools()
EventBus.startMemoryProfiler()
```

### 2. 生产环境

```javascript
// 仅启用必要功能
EventBus.configure({
  DEBUG_MODE: false,
  ENABLE_CIRCUIT_BREAKER: true,
  ENABLE_COMPRESSION: true,
  ENABLE_PLUGINS: false,
  ENABLE_SMART_ERRORS: true,
  SERIALIZATION_FORMAT: 'compact',
})
```

### 3. 测试环境

```javascript
// 使用录制和回放
beforeEach(() => {
  EventBus.startRecording({ test: testName })
})

afterEach(() => {
  const recording = EventBus.stopRecording()
  // 保存录制用于调试
  recordings[testName] = recording
})

// 回放测试场景
await EventBus.replay(recording.messages)
```

---

## 🔍 DevTools 面板使用

### 安装 DevTools 面板

1. 将 `eventbus-devtools.html` 和 `eventbus-devtools.js` 复制到扩展目录

2. 在 `manifest.json` 中添加 DevTools 页面：

```json
{
  "devtools_page": "eventbus-devtools.html"
}
```

3. 打开开发者工具，切换到 "EventBus Monitor" 面板

### 面板功能

**仪表板**：

- 实时统计（发送/接收/失败/延迟）
- 吞吐量图表
- 延迟分布图表

**消息**：

- 消息列表
- 消息详情
- 搜索和过滤
- 导出消息

**性能**：

- 内存使用图表
- 性能指标列表
- P50/P95/P99 延迟

**录制**：

- 开始/停止录制
- 回放消息
- 导出录制
- 清空录制

**健康**：

- 系统健康状态
- 问题列表
- 修复建议

---

## 📚 更多资源

- **V4 指南**: `EVENTBUS_V4_GUIDE.md`
- **版本对比**: `EVENTBUS_VERSION_COMPARISON.md`
- **测试工具**: `EventBusTestV5` 对象
- **DevTools**: 打开 DevTools 查看可视化面板
