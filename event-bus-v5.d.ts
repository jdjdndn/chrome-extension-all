/**
 * EventBus V5 TypeScript 类型定义
 * @version 5.0.0
 */

declare global {
  interface Window {
    EventBus: EventBusStatic
  }

  var EventBus: EventBusStatic
}

// ========== 配置类型 ==========
interface EventBusConfig {
  DEBUG_MODE: boolean
  ENABLE_TRACKING: boolean
  ENABLE_STATISTICS: boolean
  ENABLE_PERFORMANCE_MONITORING: boolean

  // V5 新增配置
  ENABLE_DEVTOOLS_PANEL: boolean
  ENABLE_MESSAGE_RECORDING: boolean
  ENABLE_VISUALIZATION: boolean
  ENABLE_MEMORY_PROFILING: boolean
  ENABLE_SMART_ERRORS: boolean
  ENABLE_MESSAGE_TEMPLATES: boolean
  ENABLE_SERIALIZATION: boolean
  SERIALIZATION_FORMAT: 'json' | 'compact'

  // DevTools 配置
  DEVTOOLS_PANEL_ID: string
  MAX_DISPLAY_MESSAGES: number
  MAX_MEMORY_SAMPLES: number

  // 录制配置
  MAX_RECORDED_MESSAGES: number
  RECORDING_AUTO_START: boolean

  // 可视化配置
  CHART_UPDATE_INTERVAL: number
  PERFORMANCE_HISTORY_SIZE: number

  // 消息模板
  TEMPLATES: Record<string, MessageTemplate>

  // 断路器配置
  ENABLE_CIRCUIT_BREAKER: boolean
  CIRCUIT_BREAKER_THRESHOLD: number
  CIRCUIT_BREAKER_TIMEOUT: number
}

// ========== 消息类型 ==========
interface MessageTemplate {
  schema?: {
    required?: string[]
  }
  defaults?: Record<string, any>
  validate?: (data: any) => string[] | null
  transform?: (data: any) => any
  metadata?: Record<string, any>
}

interface Message {
  __eventbus__: boolean
  type: string
  id: string
  data?: any
  from: string
  fromEnv: string
  timestamp: number
  requestType?: string
  __template?: string
  __recordedAt?: number
  __offset?: number
}

// ========== 状态类型 ==========
interface EventBusState {
  env: string
  instanceId: string
  isReady: boolean
  uptime: number
  messageCount: number
  version: string
  config: EventBusConfig
  subscriptions: Subscription[]
  handlers: number
  connections: {
    tabs: Connection[]
    workers: Connection[]
    extensions: Connection[]
  }
  circuitBreakers: Record<string, CircuitBreakerState>
  plugins: PluginInfo[]
}

interface Subscription {
  id: string
  type: string
  callback: Function
  once: boolean
  namespace: string | null
  priority: number
  createdAt: number
}

interface Connection {
  tabId?: number
  env: string
  connectedAt: number
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open'
  failureCount: number
  lastFailureTime: number | null
  lastSuccessTime: number
}

// ========== 统计类型 ==========
interface EventBusStats {
  sent: number
  received: number
  failed: number
  timeout: number
  retried: number
  compressed: number
  trackedMessages: number
}

// ========== 性能类型 ==========
interface PerformanceMetrics {
  operation: string
  count: number
  total: number
  average: number
  min: number
  max: number
  p50: number
  p95: number
  p99: number
}

interface MemoryReport {
  error?: string
  duration?: number
  samples?: number
  memory?: {
    current: number
    peak: number
    average: number
    trend: number
  }
  messages?: {
    current: number
    peak: number
  }
  subscriptions?: {
    current: number
  }
}

interface HealthAnalysis {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  issues: HealthIssue[]
}

interface HealthIssue {
  severity: 'high' | 'medium' | 'low'
  message: string
  suggestion: string
}

interface ErrorDiagnosis {
  error: string
  pattern: string
  diagnosis: string
  suggestion: string
  severity: 'high' | 'medium'
}

// ========== 录制类型 ==========
interface Recording {
  metadata: {
    startTime: number
    endTime?: number
    duration?: number
    messageCount: number
    version: string
    [key: string]: any
  }
  messages: Message[]
}

// ========== 可视化类型 ==========
interface MessageGraph {
  nodes: Array<{ id: string; count: number }>
  links: Array<{ from: string; to: string; type: string }>
}

interface TimelineEntry {
  timestamp: number
  type: string
  from: string
  duration: number
  success: boolean
}

interface HeatmapEntry {
  hour: number
  type: string
  count: number
}

// ========== 插件类型 ==========
interface Plugin {
  name: string
  version?: string
  description?: string
  hooks?: {
    beforeSend?: (context: any) => void | Promise<void>
    afterReceive?: (context: any) => void | Promise<void>
    beforeHandler?: (context: any) => void | Promise<void>
    afterHandler?: (context: any) => void | Promise<void>
    onError?: (context: any) => void | Promise<void>
    onMessage?: (context: any) => void | Promise<void>
    onResponse?: (context: any) => void | Promise<void>
    onSubscribe?: (context: any) => void | Promise<void>
    onUnsubscribe?: (context: any) => void | Promise<void>
  }
  init?: () => void
  destroy?: () => void
}

interface PluginInfo {
  name: string
  version: string
  description: string
  enabled: boolean
}

// ========== 快照类型 ==========
interface EventBusSnapshot {
  timestamp: number
  state: EventBusState
  stats: EventBusStats
  performance: PerformanceMetrics[]
  memory: MemoryReport
  health: HealthAnalysis
}

// ========== 订阅选项 ==========
interface SubscribeOptions {
  once?: boolean
  namespace?: string
  priority?: number
}

// ========== 发送选项 ==========
interface SendOptions {
  target?: string | string[]
  timeout?: number
}

// ========== 回放选项 ==========
interface ReplayOptions {
  delay?: number
  speed?: number
}

// ========== 主接口 ==========
interface EventBusStatic {
  // ========== 核心通信 API ==========

  /**
   * 发布消息
   */
  publish(type: string, data?: any, options?: SendOptions): Promise<any>

  /**
   * 订阅消息
   * @returns 取消订阅函数
   */
  subscribe(
    type: string,
    callback: (data: any, from: string, type: string) => void,
    options?: SubscribeOptions
  ): () => void

  /**
   * 请求-响应模式
   */
  request<T = any>(type: string, data?: any, options?: SendOptions): Promise<T>

  /**
   * 注册处理器
   */
  on(type: string, handler: (data: any, from: string) => any): void

  /**
   * 一次性订阅
   */
  once(type: string, callback: (data: any, from: string, type: string) => void): () => void

  /**
   * 取消订阅
   */
  off(type: string, callback?: Function): boolean

  /**
   * 清空所有订阅
   */
  clear(): void

  // ========== 状态 API ==========

  /**
   * 获取状态
   */
  getState(): EventBusState

  /**
   * 获取统计信息
   */
  getStats(): EventBusStats

  /**
   * 获取追踪历史
   */
  getHistory(filter?: { type?: string; limit?: number; since?: number }): Message[]

  // ========== 配置 API ==========

  /**
   * 配置
   */
  configure(settings: Partial<EventBusConfig>): void

  /**
   * 获取配置
   */
  getConfig(): EventBusConfig

  /**
   * 设置调试模式
   */
  setDebugMode(enabled: boolean): void

  // ========== V5 新增 API ==========

  // DevTools
  connectDevTools(): void
  disconnectDevTools(): void

  // 录制
  startRecording(metadata?: Record<string, any>): void
  stopRecording(): Recording | undefined
  getRecording(): Recording | null
  clearRecording(): void
  exportRecording(): string | null
  importRecording(data: string | Recording): boolean
  replay(messages: Message[], options?: ReplayOptions): Promise<void>

  // 模板
  defineTemplate(name: string, template: MessageTemplate): void
  createMessage(templateName: string, data?: any): any
  listTemplates(): string[]

  // 内存分析
  startMemoryProfiler(): void
  stopMemoryProfiler(): void
  getMemoryReport(): MemoryReport

  // 性能指标
  getPerformanceMetrics(operation?: string): PerformanceMetrics | PerformanceMetrics[] | null

  // 健康分析
  getHealthAnalysis(): HealthAnalysis

  // 可视化
  getVisualization(type: 'graph'): MessageGraph
  getVisualization(type: 'timeline'): TimelineEntry[]
  getVisualization(type: 'heatmap'): HeatmapEntry[]

  // 序列化
  setSerializationFormat(format: 'json' | 'compact'): void

  // 快照
  getSnapshot(): EventBusSnapshot

  // ========== V4 继承 API ==========

  // 断路器
  getCircuitBreakerState(type: string): string | null
  getAllCircuitBreakerStates(): Record<string, CircuitBreakerState>
  resetCircuitBreaker(type: string): void

  // 插件
  registerPlugin(plugin: Plugin): void
  unregisterPlugin(name: string): boolean
  enablePlugin(name: string): boolean
  disablePlugin(name: string): boolean
  getPlugins(): PluginInfo[]

  // Schema
  registerSchema(type: string, schema: { validate?: (data: any) => string[] | null }): void
}

export {
  EventBusStatic,
  EventBusConfig,
  MessageTemplate,
  Message,
  EventBusState,
  Subscription,
  Connection,
  CircuitBreakerState,
  EventBusStats,
  PerformanceMetrics,
  MemoryReport,
  HealthAnalysis,
  HealthIssue,
  ErrorDiagnosis,
  Recording,
  MessageGraph,
  TimelineEntry,
  HeatmapEntry,
  Plugin,
  PluginInfo,
  EventBusSnapshot,
  SubscribeOptions,
  SendOptions,
  ReplayOptions,
}
