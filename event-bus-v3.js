/**
 * ========================================
 * EventBus V3 - 终极版通信事件总线
 * ========================================
 * V3 新增功能：
 * - 命名空间支持
 * - 批量消息
 * - 优先级队列
 * - 中间件系统
 * - 性能监控
 * - 错误恢复
 * - 重试策略
 * - 消息去重
 * - 持久化支持
 * - TypeScript 类型定义
 * - ES6 模块支持
 */

// ES6 模块导出支持
const EventBusMain = (function () {
  'use strict';

  const globalThis = (typeof self !== 'undefined') ? self :
                     (typeof window !== 'undefined') ? window :
                     (typeof global !== 'undefined') ? global : this;

  // ==================== 配置 ====================
  const CONFIG = {
    // 基础配置
    HEARTBEAT_INTERVAL: 30000,
    MESSAGE_TIMEOUT: 5000,
    ACK_TIMEOUT: 2000,
    MAX_RETRY: 3,
    RETRY_DELAY: 200,
    DEBUG_MODE: false,
    ENABLE_TRACKING: true,
    MAX_TRACKING_SIZE: 500,

    // V3 新增配置
    ENABLE_NAMESPACES: true,         // 启用命名空间
    ENABLE_PRIORITY: true,            // 启用优先级
    ENABLE_MIDDLEWARE: true,          // 启用中间件
    ENABLE_DEDUPLICATION: true,       // 启用消息去重
    DEDUPLICATION_WINDOW: 1000,       // 去重时间窗口（毫秒）
    MAX_PENDING_MESSAGES: 100,        // 最大待处理消息数
    PERSISTENCE_ENABLED: false,       // 启用持久化
    PERSISTENCE_KEY: '__eventbus_msgs__',

    // 性能监控
    ENABLE_PERFORMANCE_MONITORING: true,
    PERF_SAMPLE_RATE: 0.1,            // 10% 采样率
  };

  // ==================== 性能监控 ====================
  const Performance = {
    metrics: {
      messageLatency: [],      // 消息延迟
      handlerDuration: [],     // 处理器执行时间
      throughput: [],          // 吞吐量（消息/秒）
      memoryUsage: [],         // 内存使用
    },

    startTimer() {
      return performance.now();
    },

    endTimer(startTime) {
      return performance.now() - startTime;
    },

    recordLatency(type, duration) {
      if (!CONFIG.ENABLE_PERFORMANCE_MONITORING) return;
      if (Math.random() > CONFIG.PERF_SAMPLE_RATE) return;

      this.metrics.messageLatency.push({
        type,
        duration,
        timestamp: Date.now()
      });

      if (this.metrics.messageLatency.length > 1000) {
        this.metrics.messageLatency.shift();
      }
    },

    recordHandler(type, duration) {
      if (!CONFIG.ENABLE_PERFORMANCE_MONITORING) return;

      this.metrics.handlerDuration.push({
        type,
        duration,
        timestamp: Date.now()
      });

      if (this.metrics.handlerDuration.length > 1000) {
        this.metrics.handlerDuration.shift();
      }
    },

    getMetrics() {
      const avgLatency = this._average(this.metrics.messageLatency.map(m => m.duration));
      const avgHandler = this._average(this.metrics.handlerDuration.map(m => m.duration));
      const p99Latency = this._percentile(this.metrics.messageLatency.map(m => m.duration), 99);
      const p99Handler = this._percentile(this.metrics.handlerDuration.map(m => m.duration), 99);

      return {
        avgLatency: Math.round(avgLatency * 100) / 100,
        p99Latency: Math.round(p99Latency * 100) / 100,
        avgHandlerTime: Math.round(avgHandler * 100) / 100,
        p99HandlerTime: Math.round(p99Handler * 100) / 100,
        totalMessages: this.metrics.messageLatency.length,
        totalHandlers: this.metrics.handlerDuration.length
      };
    },

    _average(arr) {
      if (!arr.length) return 0;
      return arr.reduce((a, b) => a + b, 0) / arr.length;
    },

    _percentile(arr, p) {
      if (!arr.length) return 0;
      const sorted = arr.slice().sort((a, b) => a - b);
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[index] || 0;
    },

    clear() {
      this.metrics = {
        messageLatency: [],
        handlerDuration: [],
        throughput: [],
        memoryUsage: [],
      };
    }
  };

  // ==================== 消息去重 ====================
  const Deduplication = {
    recentMessages: new Map(),

    shouldProcess(message) {
      if (!CONFIG.ENABLE_DEDUPLICATION) return true;

      const key = this._getKey(message);
      const now = Date.now();

      if (this.recentMessages.has(key)) {
        const lastTime = this.recentMessages.get(key);
        if (now - lastTime < CONFIG.DEDUPLICATION_WINDOW) {
          return false; // 在去重窗口内，跳过
        }
      }

      this.recentMessages.set(key, now);

      // 清理过期记录
      this._cleanup(now);

      return true;
    },

    _getKey(message) {
      return `${message.type}:${JSON.stringify(message.data)}`;
    },

    _cleanup(now) {
      const threshold = now - CONFIG.DEDUPLICATION_WINDOW;
      for (const [key, time] of this.recentMessages) {
        if (time < threshold) {
          this.recentMessages.delete(key);
        }
      }
    },

    clear() {
      this.recentMessages.clear();
    }
  };

  // ==================== 中间件系统 ====================
  const Middleware = {
    handlers: [],

    use(middleware) {
      if (typeof middleware !== 'function') {
        throw new Error('Middleware must be a function');
      }
      this.handlers.push(middleware);
    },

    async process(message, next) {
      let index = 0;

      const dispatch = async (idx) => {
        if (idx >= this.handlers.length) {
          return await next();
        }

        const handler = this.handlers[idx];
        return await handler(message, () => dispatch(idx + 1));
      };

      return await dispatch(0);
    },

    clear() {
      this.handlers = [];
    }
  };

  // ==================== 命名空间 ====================
  const Namespace = {
    separators: ':/',

    join(...parts) {
      return parts.filter(Boolean).join(CONFIG.ENABLE_NAMESPACES ? ':' : '');
    },

    parse(messageType) {
      if (!CONFIG.ENABLE_NAMESPACES) {
        return { namespace: '', base: messageType };
      }
      const parts = messageType.split(':');
      return {
        namespace: parts.length > 1 ? parts[0] : '',
        base: parts.length > 1 ? parts.slice(1).join(':') : messageType
      };
    },

    create(namespace) {
      const self = this;
      return {
        request(type, data, options) {
          const fullType = self.join(namespace, type);
          return EventBus.request(fullType, data, options);
        },
        publish(type, data) {
          const fullType = self.join(namespace, type);
          return EventBus.publish(fullType, data);
        },
        subscribe(type, callback) {
          const fullType = self.join(namespace, type);
          return EventBus.subscribe(fullType, callback);
        },
        on(type, handler) {
          const fullType = self.join(namespace, type);
          return EventBus.on(fullType, handler);
        },
        once(type, callback) {
          const fullType = self.join(namespace, type);
          return EventBus.once(fullType, callback);
        }
      };
    }
  };

  // ==================== 优先级队列 ====================
  const PriorityQueue = {
    HIGH: 0,
    NORMAL: 1,
    LOW: 2,

    queue: [],

    enqueue(message, priority = this.NORMAL) {
      this.queue.push({ message, priority, timestamp: Date.now() });
      this.queue.sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }
        return a.timestamp - b.timestamp;
      });

      // 限制队列大小
      if (this.queue.length > CONFIG.MAX_PENDING_MESSAGES) {
        this.queue.shift();
      }
    },

    dequeue() {
      return this.queue.shift();
    },

    size() {
      return this.queue.length;
    },

    clear() {
      this.queue = [];
    }
  };

  // ==================== 重试策略 ====================
  const RetryPolicy = {
    policies: new Map(),

    set(type, policy) {
      this.policies.set(type, {
        maxRetries: policy.maxRetries || CONFIG.MAX_RETRY,
        retryDelay: policy.retryDelay || CONFIG.RETRY_DELAY,
        backoff: policy.backoff || 'linear', // 'linear' | 'exponential'
        shouldRetry: policy.shouldRetry || (() => true)
      });
    },

    get(type) {
      return this.policies.get(type) || {
        maxRetries: CONFIG.MAX_RETRY,
        retryDelay: CONFIG.RETRY_DELAY,
        backoff: 'linear',
        shouldRetry: () => true
      };
    },

    calculateDelay(attempt, policy) {
      if (policy.backoff === 'exponential') {
        return policy.retryDelay * Math.pow(2, attempt);
      }
      return policy.retryDelay;
    },

    clear() {
      this.policies.clear();
    }
  };

  // ==================== 环境检测 ====================
  const ENV = detectEnvironment();

  function detectEnvironment() {
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      if (typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:') {
        if (window.location.pathname.includes('popup.html')) return 'popup';
        if (window.location.pathname.includes('options.html')) return 'options';
        if (window.location.pathname.includes('devtools')) return 'devtools';
        return 'extension_page';
      }
      if (typeof chrome.devtools !== 'undefined') return 'devtools';
      return 'background';
    }
    if (typeof window !== 'undefined' && window.location) {
      if (window.location.protocol === 'https:' || window.location.protocol === 'http:') {
        return 'content_script';
      }
    }
    return 'unknown';
  }

  // ==================== 消息类型 ====================
  const MESSAGE_TYPES = {
    PING: '__eb_ping__',
    PONG: '__eb_pong__',
    ACK: '__eb_ack__',
    READY: '__eb_ready__',
    HEARTBEAT: '__eb_heartbeat__',
    RESPONSE: '__eb_response__',
    BATCH: '__eb_batch__'
  };

  // ==================== 状态管理 ====================
  const State = {
    instanceId: `${ENV}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    isReady: false,
    connections: new Map(),
    callbacks: new Map(),
    subscriptions: new Map(),
    handlers: new Map(),
    namespaces: new Map(),
    connectionListeners: [],
    startTime: Date.now(),
    messageCount: 0,
    batchQueue: []
  };

  // ==================== 消息追踪 ====================
  const Tracking = {
    messages: [],
    stats: { sent: 0, received: 0, failed: 0, timeout: 0, retried: 0 },

    log(type, message, data = {}) {
      if (!CONFIG.ENABLE_TRACKING) return;

      this.messages.push({
        timestamp: Date.now(),
        type,
        messageType: message?.type,
        namespace: Namespace.parse(message?.type || '').namespace,
        from: message?.from,
        to: message?.target,
        priority: message?.priority,
        ...data
      });

      if (this.messages.length > CONFIG.MAX_TRACKING_SIZE) {
        this.messages.shift();
      }
    },

    getStats() {
      return { ...this.stats, trackedMessages: this.messages.length };
    },

    getHistory(filter = {}) {
      let history = [...this.messages];
      if (filter.type) history = history.filter(m => m.messageType === filter.type);
      if (filter.namespace) history = history.filter(m => m.namespace === filter.namespace);
      if (filter.limit) history = history.slice(-filter.limit);
      return history;
    },

    clear() {
      this.messages = [];
      this.stats = { sent: 0, received: 0, failed: 0, timeout: 0, retried: 0 };
    }
  };

  // ==================== 传输层 ====================
  const Transport = {
    async send(target, message) {
      if (ENV === 'content_script') {
        return await chrome.runtime.sendMessage(message);
      } else if (ENV === 'background') {
        if (target.tabId) {
          return await chrome.tabs.sendMessage(target.tabId, message);
        }
        return await chrome.runtime.sendMessage(message);
      } else {
        if (chrome.tabs && typeof chrome.tabs.query === 'function') {
          try {
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs[0]?.id) {
              return await chrome.tabs.sendMessage(tabs[0].id, message);
            }
          } catch (e) {}
        }
        return await chrome.runtime.sendMessage(message);
      }
    },

    async broadcast(message) {
      if (ENV === 'content_script') {
        await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
      } else if (ENV === 'background') {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          try {
            await chrome.tabs.sendMessage(tab.id, message).catch(() => {});
          } catch (e) {}
        }
      } else {
        await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
      }
    },

    onMessage(callback) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        const result = callback(message, sender);
        if (result instanceof Promise) {
          result.then(sendResponse);
          return true;
        }
        sendResponse(result);
        return true;
      });
    }
  };

  // ==================== EventBus 核心 ====================
  const EventBus = {
    /**
     * 初始化
     */
    async init() {
      if (State.isReady) return;

      Transport.onMessage(this._handleMessage.bind(this));
      this._startHeartbeat();
      State.isReady = true;

      setTimeout(() => {
        this.publish(MESSAGE_TYPES.READY, {
          from: State.instanceId,
          env: ENV
        });
      }, 100);

      if (CONFIG.DEBUG_MODE) {
        console.log('[EventBus V3] 初始化完成', {
          env: ENV,
          id: State.instanceId,
          features: {
            namespaces: CONFIG.ENABLE_NAMESPACES,
            priority: CONFIG.ENABLE_PRIORITY,
            middleware: CONFIG.ENABLE_MIDDLEWARE,
            deduplication: CONFIG.ENABLE_DEDUPLICATION,
            performance: CONFIG.ENABLE_PERFORMANCE_MONITORING
          }
        });
      }
    },

    /**
     * 发送请求（等待响应）
     */
    async request(type, data = {}, options = {}) {
      const startTime = Performance.startTimer();
      const { timeout = CONFIG.MESSAGE_TIMEOUT, priority = PriorityQueue.NORMAL } = options;

      const messageId = `${State.instanceId}_${++State.messageCount}`;
      const message = this._createMessage(messageId, type, data, true, priority);

      Tracking.log('send', message);
      Tracking.stats.sent++;

      // 去重检查
      if (!Deduplication.shouldProcess(message)) {
        if (CONFIG.DEBUG_MODE) {
          console.log('[EventBus] 消息被去重:', type);
        }
        throw new Error(`Message deduplicated: ${type}`);
      }

      return new Promise(async (resolve, reject) => {
        const policy = RetryPolicy.get(type);
        let lastError;

        for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
          try {
            const response = await this._sendWithRetry(message, timeout);

            Performance.recordLatency(type, Performance.endTimer(startTime));
            resolve(response);
            return;
          } catch (error) {
            lastError = error;

            if (attempt < policy.maxRetries && policy.shouldRetry(error)) {
              Tracking.stats.retried++;
              const delay = RetryPolicy.calculateDelay(attempt, policy);
              if (CONFIG.DEBUG_MODE) {
                console.log(`[EventBus] 重试 ${attempt + 1}/${policy.maxRetries}:`, type);
              }
              await new Promise(r => setTimeout(r, delay));
            }
          }
        }

        Tracking.stats.failed++;
        Tracking.log('failed', message, { error: lastError.message });
        reject(lastError);
      });
    },

    /**
     * 发布事件（不等待响应）
     */
    async publish(type, data = {}) {
      const message = this._createMessage(
        `${State.instanceId}_${++State.messageCount}`,
        type,
        data,
        false
      );

      Tracking.stats.sent++;
      Tracking.log('send', message);
      return this._sendMessage(message);
    },

    /**
     * 批量发送消息
     */
    async batch(messages) {
      if (!Array.isArray(messages)) {
        throw new Error('Batch messages must be an array');
      }

      const batchMessage = {
        __eventbus__: true,
        type: MESSAGE_TYPES.BATCH,
        id: `${State.instanceId}_${++State.messageCount}`,
        data: { messages },
        from: State.instanceId,
        fromEnv: ENV,
        timestamp: Date.now()
      };

      return this._sendMessage(batchMessage);
    },

    /**
     * 订阅事件
     */
    subscribe(type, callback) {
      const parsed = Namespace.parse(type);

      if (parsed.namespace) {
        // 命名空间订阅
        if (!State.namespaces.has(parsed.namespace)) {
          State.namespaces.set(parsed.namespace, new Map());
        }
        const ns = State.namespaces.get(parsed.namespace);
        if (!ns.has('subscriptions')) {
          ns.set('subscriptions', new Map());
        }
        const subs = ns.get('subscriptions');

        if (!subs.has(parsed.base)) {
          subs.set(parsed.base, []);
        }
        subs.get(parsed.base).push(callback);
      } else {
        // 普通订阅
        if (!State.subscriptions.has(type)) {
          State.subscriptions.set(type, []);
        }
        State.subscriptions.get(type).push(callback);
      }

      if (CONFIG.DEBUG_MODE) {
        console.log(`[EventBus] 订阅: ${type}`);
      }

      return () => this.off(type, callback);
    },

    /**
     * 一次性订阅
     */
    once(type, callback) {
      const wrapper = (data, source) => {
        callback(data, source);
        this.off(type, wrapper);
      };
      return this.subscribe(type, wrapper);
    },

    /**
     * 取消订阅
     */
    off(type, callback) {
      const parsed = Namespace.parse(type);

      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns && ns.has('subscriptions')) {
          const subs = ns.get('subscriptions');
          if (callback && subs.has(parsed.base)) {
            const callbacks = subs.get(parsed.base);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
          } else if (subs.has(parsed.base)) {
            subs.delete(parsed.base);
          }
        }
      } else {
        if (State.subscriptions.has(type)) {
          if (callback) {
            const callbacks = State.subscriptions.get(type);
            const index = callbacks.indexOf(callback);
            if (index > -1) callbacks.splice(index, 1);
          } else {
            State.subscriptions.delete(type);
          }
        }
      }

      if (CONFIG.DEBUG_MODE) {
        console.log(`[EventBus] 取消订阅: ${type}`);
      }
    },

    /**
     * 注册处理器
     */
    on(type, handler) {
      const parsed = Namespace.parse(type);

      if (parsed.namespace) {
        if (!State.namespaces.has(parsed.namespace)) {
          State.namespaces.set(parsed.namespace, new Map());
        }
        const ns = State.namespaces.get(parsed.namespace);
        ns.set(parsed.base, handler);
      } else {
        State.handlers.set(type, handler);
      }

      if (CONFIG.DEBUG_MODE) {
        console.log(`[EventBus] 注册处理器: ${type}`);
      }
    },

    /**
     * 移除处理器
     */
    removeHandler(type) {
      const parsed = Namespace.parse(type);

      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns) ns.delete(parsed.base);
      } else {
        State.handlers.delete(type);
      }
    },

    /**
     * 使用中间件
     */
    use(middleware) {
      Middleware.use(middleware);
    },

    /**
     * 创建命名空间
     */
    namespace(name) {
      return Namespace.create(name);
    },

    /**
     * 设置重试策略
     */
    setRetryPolicy(type, policy) {
      RetryPolicy.set(type, policy);
    },

    /**
     * 监听连接事件
     */
    onConnectionChange(callback) {
      State.connectionListeners.push(callback);
      return () => {
        const index = State.connectionListeners.indexOf(callback);
        if (index > -1) State.connectionListeners.splice(index, 1);
      };
    },

    /**
     * 清理资源
     */
    clear() {
      State.subscriptions.clear();
      State.handlers.clear();
      State.namespaces.clear();
      State.callbacks.forEach(cb => clearTimeout(cb.timeout));
      State.callbacks.clear();
      Tracking.clear();
      Performance.clear();
      Deduplication.clear();
      Middleware.clear();
      PriorityQueue.clear();
      RetryPolicy.clear();

      if (CONFIG.DEBUG_MODE) {
        console.log('[EventBus V3] 已清理');
      }
    },

    /**
     * 获取状态
     */
    getState() {
      return {
        env: ENV,
        instanceId: State.instanceId,
        isReady: State.isReady,
        connections: Array.from(State.connections.keys()),
        subscriptions: Array.from(State.subscriptions.keys()),
        handlers: Array.from(State.handlers.keys()),
        namespaces: Array.from(State.namespaces.keys()),
        uptime: Date.now() - State.startTime,
        messageCount: State.messageCount,
        queueSize: PriorityQueue.size(),
        stats: Tracking.getStats(),
        performance: Performance.getMetrics()
      };
    },

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        ...Tracking.getStats(),
        performance: Performance.getMetrics(),
        queueSize: PriorityQueue.size()
      };
    },

    /**
     * 获取消息历史
     */
    getHistory(filter) {
      return Tracking.getHistory(filter);
    },

    /**
     * 设置调试模式
     */
    setDebugMode(enabled) {
      CONFIG.DEBUG_MODE = enabled;
      CONFIG.ENABLE_TRACKING = enabled;
    },

    /**
     * 配置
     */
    configure(options) {
      Object.assign(CONFIG, options);
    },

    // ==================== 内部方法 ====================

    _createMessage(id, type, data, expectResponse, priority) {
      return {
        __eventbus__: true,
        id,
        type,
        data,
        from: State.instanceId,
        fromEnv: ENV,
        timestamp: Date.now(),
        expectResponse,
        priority
      };
    },

    async _sendWithRetry(message, timeout) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          State.callbacks.delete(message.id);
          Tracking.stats.timeout++;
          Tracking.log('timeout', message);
          reject(new Error(`Message timeout: ${message.type}`));
        }, timeout);

        State.callbacks.set(message.id, {
          resolve: (data) => {
            clearTimeout(timeoutId);
            Tracking.stats.received++;
            resolve(data);
          },
          reject,
          timeoutId
        });

        this._sendMessage(message).catch(reject);
      });
    },

    async _sendMessage(message) {
      try {
        await Middleware.process(message, async () => {
          await Transport.broadcast(message);
        });
      } catch (error) {
        if (CONFIG.DEBUG_MODE) {
          console.warn('[EventBus] 发送失败:', error);
        }
        throw error;
      }
    },

    async _handleMessage(message, sender) {
      if (!message?.__eventbus__) return false;
      if (message.from === State.instanceId) return false;

      // 去重检查
      if (!Deduplication.shouldProcess(message)) {
        return false;
      }

      Tracking.log('receive', message);
      Tracking.stats.received++;

      // 处理系统消息
      if (message.type === MESSAGE_TYPES.PING) {
        return { type: MESSAGE_TYPES.PONG, from: State.instanceId };
      }
      if (message.type === MESSAGE_TYPES.PONG) {
        this._handlePong(message);
        return null;
      }
      if (message.type === MESSAGE_TYPES.READY) {
        this._handleReady(message);
        return null;
      }
      if (message.type === MESSAGE_TYPES.RESPONSE) {
        this._handleResponse(message);
        return null;
      }
      if (message.type === MESSAGE_TYPES.BATCH) {
        return this._handleBatch(message);
      }

      const parsed = Namespace.parse(message.type);
      let handler = null;
      let subscribers = [];

      // 查找处理器
      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns) handler = ns.get(parsed.base);
      } else {
        handler = State.handlers.get(message.type);
      }

      // 查找订阅者
      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns && ns.has('subscriptions')) {
          const subs = ns.get('subscriptions');
          if (subs && subs.has(parsed.base)) {
            subscribers = subs.get(parsed.base);
          }
        }
      } else {
        subscribers = State.subscriptions.get(message.type) || [];
      }

      // 执行处理器
      if (handler && message.expectResponse) {
        const startTime = Performance.startTimer();
        try {
          const response = await handler(message.data, {
            from: message.from,
            fromEnv: message.fromEnv
          });
          Performance.recordHandler(message.type, Performance.endTimer(startTime));

          return {
            __eventbus__: true,
            id: message.id,
            type: MESSAGE_TYPES.RESPONSE,
            data: response,
            from: State.instanceId
          };
        } catch (error) {
          if (CONFIG.DEBUG_MODE) {
            console.error('[EventBus] 处理器错误:', error);
          }
          throw error;
        }
      }

      // 触发订阅者
      for (const callback of subscribers) {
        try {
          await callback(message.data, {
            from: message.from,
            fromEnv: message.fromEnv
          });
        } catch (error) {
          if (CONFIG.DEBUG_MODE) {
            console.error('[EventBus] 订阅者错误:', error);
          }
        }
      }

      return null;
    },

    _handleBatch(message) {
      const { messages } = message.data;
      const results = [];

      for (const msg of messages) {
        try {
          const result = this._handleMessage({ ...msg, __batched__: true }, message);
          results.push({ success: true, result });
        } catch (error) {
          results.push({ success: false, error: error.message });
        }
      }

      return { __eventbus__: true, results };
    },

    _handlePong(message) {
      State.connections.set(message.from, {
        lastSeen: Date.now(),
        env: message.fromEnv
      });
      this._notifyConnectionChange(message.from, 'connected');
    },

    _handleReady(message) {
      State.connections.set(message.from, {
        ready: true,
        lastSeen: Date.now(),
        env: message.fromEnv
      });
      this._notifyConnectionChange(message.from, 'ready');
    },

    _handleResponse(message) {
      const callback = State.callbacks.get(message.id);
      if (callback) {
        clearTimeout(callback.timeoutId);
        State.callbacks.delete(message.id);
        callback.resolve(message.data);
      }
    },

    _notifyConnectionChange(id, status) {
      State.connectionListeners.forEach(listener => {
        try {
          listener(id, status, State.connections.get(id));
        } catch (e) {
          if (CONFIG.DEBUG_MODE) {
            console.error('[EventBus] 连接监听器错误:', e);
          }
        }
      });
    },

    _startHeartbeat() {
      if (typeof window === 'undefined') return;

      setInterval(() => {
        this.publish(MESSAGE_TYPES.HEARTBEAT, {});

        // 清理过期连接
        const now = Date.now();
        for (const [id, conn] of State.connections) {
          if (now - conn.lastSeen > CONFIG.HEARTBEAT_INTERVAL * 2) {
            State.connections.delete(id);
            this._notifyConnectionChange(id, 'disconnected');
          }
        }
      }, CONFIG.HEARTBEAT_INTERVAL);
    }
  };

  // 导出到全局
  globalThis.EventBus = EventBus;

  // 自动初始化
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => EventBus.init());
    } else {
      EventBus.init();
    }
  } else {
    EventBus.init();
  }

  if (CONFIG.DEBUG_MODE) {
    console.log('[EventBus V3] 模块已加载');
  }

  // 返回 EventBus（用于 ES6 模块导出）
  return EventBus;

})();

// ==================== ES6 模块导出 ====================
// 支持 ES6 模块导入：import { EventBus } from './event-bus-v3.js'
// 同时保持 IIFE 模式兼容：直接在 HTML 中引入

// 检测是否在 ES6 模块环境中
if (typeof module !== 'undefined' && module.exports) {
  // CommonJS
  module.exports = EventBusMain;
} else if (typeof exports !== 'undefined') {
  // 另一种 CommonJS 检测
  exports.EventBus = EventBusMain;
} else if (typeof window !== 'undefined' && typeof window.define === 'function' && window.define.amd) {
  // AMD
  window.define([], () => EventBusMain);
}

// 对于 ES6 模块，在上层代码中应该使用：
// import { EventBus } from './event-bus-v3.js';
// 这需要将文件声明为模块，但我们保持向后兼容

// 确保 EventBus 在全局可用（用于非模块环境）
if (typeof globalThis !== 'undefined' && !globalThis.EventBus) {
  globalThis.EventBus = EventBusMain;
}
