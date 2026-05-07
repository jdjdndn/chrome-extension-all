/**
 * EventBus V3 TypeScript 类型定义
 */

declare namespace EventBusV3 {
  // ==================== 基础类型 ====================

  type Environment = 'content_script' | 'background' | 'popup' | 'options' | 'devtools' | 'unknown'

  type Priority = 0 | 1 | 2 // HIGH | NORMAL | LOW

  type BackoffType = 'linear' | 'exponential'

  // ==================== 消息类型 ====================

  interface Message<T = any> {
    __eventbus__: true
    id: string
    type: string
    data: T
    from: string
    fromEnv: Environment
    timestamp: number
    expectResponse: boolean
    priority?: Priority
  }

  interface Response<T = any> {
    __eventbus__: true
    id: string
    type: '__eb_response__'
    data: T
    from: string
  }

  // ==================== 配置 ====================

  interface EventBusConfig {
    HEARTBEAT_INTERVAL?: number
    MESSAGE_TIMEOUT?: number
    ACK_TIMEOUT?: number
    MAX_RETRY?: number
    RETRY_DELAY?: number
    DEBUG_MODE?: boolean
    ENABLE_TRACKING?: boolean
    MAX_TRACKING_SIZE?: number
    ENABLE_NAMESPACES?: boolean
    ENABLE_PRIORITY?: boolean
    ENABLE_MIDDLEWARE?: boolean
    ENABLE_DEDUPLICATION?: boolean
    DEDUPLICATION_WINDOW?: number
    MAX_PENDING_MESSAGES?: number
    PERSISTENCE_ENABLED?: boolean
    ENABLE_PERFORMANCE_MONITORING?: boolean
    PERF_SAMPLE_RATE?: number
  }

  // ==================== 重试策略 ====================

  interface RetryPolicy {
    maxRetries?: number
    retryDelay?: number
    backoff?: BackoffType
    shouldRetry?: (error: Error) => boolean
  }

  // ==================== 选项 ====================

  interface RequestOptions {
    timeout?: number
    priority?: Priority
  }

  // ==================== 状态 ====================

  interface ConnectionState {
    ready: boolean
    lastSeen: number
    env: Environment
  }

  interface EventBusState {
    env: Environment
    instanceId: string
    isReady: boolean
    connections: string[]
    subscriptions: string[]
    handlers: string[]
    namespaces: string[]
    uptime: number
    messageCount: number
    queueSize: number
    stats: Statistics
    performance: PerformanceMetrics
  }

  // ==================== 统计 ====================

  interface Statistics {
    sent: number
    received: number
    failed: number
    timeout: number
    retried: number
    trackedMessages: number
  }

  interface PerformanceMetrics {
    avgLatency: number
    p99Latency: number
    avgHandlerTime: number
    p99HandlerTime: number
    totalMessages: number
    totalHandlers: number
  }

  // ==================== 消息历史 ====================

  interface MessageRecord {
    timestamp: number
    type: 'send' | 'receive' | 'timeout' | 'failed'
    messageType: string
    namespace?: string
    from?: string
    to?: string
    priority?: Priority
    error?: string
  }

  interface HistoryFilter {
    type?: string
    namespace?: string
    limit?: number
  }

  // ==================== 命名空间 ====================

  interface ParsedNamespace {
    namespace: string
    base: string
  }

  interface NamespaceAPI {
    request<T = any, R = any>(type: string, data?: T, options?: RequestOptions): Promise<R>
    publish<T = any>(type: string, data?: T): Promise<void>
    subscribe<T = any>(type: string, callback: (data: T) => void): () => void
    on<T = any, R = any>(type: string, handler: (data: T) => R): void
    once<T = any>(type: string, callback: (data: T) => void): () => void
  }

  // ==================== 中间件 ====================

  type MiddlewareFunction = (message: Message, next: () => Promise<void>) => Promise<void> | void

  // ==================== 连接事件 ====================

  type ConnectionChangeListener = (
    instanceId: string,
    status: 'connected' | 'disconnected' | 'ready',
    info?: ConnectionState
  ) => void

  // ==================== 处理器/订阅者 ====================

  type MessageHandler<T = any, R = any> = (
    data: T,
    source: { from: string; fromEnv: Environment }
  ) => R | Promise<R>

  type MessageSubscriber<T = any> = (
    data: T,
    source: { from: string; fromEnv: Environment }
  ) => void | Promise<void>

  // ==================== EventBus 接口 ====================

  interface EventBus {
    // 初始化
    init(): Promise<void>

    // 发送消息
    request<T = any, R = any>(type: string, data?: T, options?: RequestOptions): Promise<R>
    publish<T = any>(type: string, data?: T): Promise<void>
    batch(messages: Array<{ type: string; data?: any }>): Promise<any>

    // 订阅
    subscribe<T = any>(type: string, callback: MessageSubscriber<T>): () => void
    once<T = any>(type: string, callback: MessageSubscriber<T>): () => void
    off(type: string, callback?: MessageSubscriber<any>): void

    // 处理器
    on<T = any, R = any>(type: string, handler: MessageHandler<T, R>): void
    removeHandler(type: string): void

    // 中间件
    use(middleware: MiddlewareFunction): void

    // 命名空间
    namespace(name: string): NamespaceAPI

    // 重试策略
    setRetryPolicy(type: string, policy: RetryPolicy): void

    // 连接事件
    onConnectionChange(callback: ConnectionChangeListener): () => void

    // 清理
    clear(): void

    // 状态查询
    getState(): EventBusState
    getStats(): Statistics & { performance: PerformanceMetrics; queueSize: number }
    getHistory(filter?: HistoryFilter): MessageRecord[]

    // 配置
    setDebugMode(enabled: boolean): void
    configure(options: EventBusConfig): void
  }

  // ==================== 全局声明 ====================

  interface Window {
    EventBus: EventBus
  }

  interface ServiceWorkerGlobalScope {
    EventBus: EventBus
  }

  // ==================== 测试工具 ====================

  namespace EventBusTestV3 {
    interface TestResult {
      name: string
      passed: boolean
      error?: string
    }

    interface TestSummary {
      passed: number
      failed: number
      results: TestResult[]
    }

    function runAllTests(): Promise<TestSummary>
    function showStatusPanel(): void
    function showRecentMessages(count?: number): void
    function showPerformanceMetrics(): void
    function enableDebugMode(): void
    function disableDebugMode(): void

    // 测试命令
    function testBasicState(): Promise<TestResult>
    function testSubscribe(): Promise<TestResult>
    function testPublish(): Promise<TestResult>
    function testRequestResponse(): Promise<TestResult>
    function testOnce(): Promise<TestResult>
    function testNamespaces(): Promise<TestResult>
    function testBatch(): Promise<TestResult>
    function testMiddleware(): Promise<TestResult>
    function testDeduplication(): Promise<TestResult>
    function testRetryPolicy(): Promise<TestResult>
  }
}

// ==================== 导出 ====================

export = EventBusV3
export as namespace EventBusV3
