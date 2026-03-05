/**
 * EventBus V5 - 开发者增强版
 *
 * V5 新功能：
 * - DevTools 集成面板
 * - 实时消息监控
 * - 可视化性能图表
 * - 消息追踪链路图
 * - 消息录制和回放
 * - 内存使用分析
 * - 交互式调试工具
 * - 智能错误诊断
 * - 消息模板系统
 * - 消息序列化优化
 *
 * @version 5.0.0
 * @author EventBus Team
 */

(function (global, factory) {
  'use strict';

  // ========== 环境检测 ==========
  const ENV = typeof window !== 'undefined' ? 'window' :
              typeof self !== 'undefined' ? 'worker' : 'node';

  const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime;
  const isDevTools = typeof chrome !== 'undefined' && chrome.devTools;

  // ========== 配置管理 ==========
  const CONFIG = {
    // 基础配置
    DEBUG_MODE: false,
    ENABLE_TRACKING: true,
    ENABLE_STATISTICS: true,
    ENABLE_PERFORMANCE_MONITORING: true,

    // V5 新增配置
    ENABLE_DEVTOOLS_PANEL: true,
    ENABLE_MESSAGE_RECORDING: false,
    ENABLE_VISUALIZATION: true,
    ENABLE_MEMORY_PROFILING: true,
    ENABLE_SMART_ERRORS: true,
    ENABLE_MESSAGE_TEMPLATES: true,
    ENABLE_SERIALIZATION: true,
    SERIALIZATION_FORMAT: 'json', // 'json' | 'msgpack' | 'compact'

    // DevTools 配置
    DEVTOOLS_PANEL_ID: 'eventbus-monitor',
    MAX_DISPLAY_MESSAGES: 1000,
    MAX_MEMORY_SAMPLES: 100,

    // 录制配置
    MAX_RECORDED_MESSAGES: 5000,
    RECORDING_AUTO_START: false,

    // 可视化配置
    CHART_UPDATE_INTERVAL: 1000,
    PERFORMANCE_HISTORY_SIZE: 100,

    // 消息模板
    TEMPLATES: {},

    // 断路器配置
    ENABLE_CIRCUIT_BREAKER: true,
    CIRCUIT_BREAKER_THRESHOLD: 5,
    CIRCUIT_BREAKER_TIMEOUT: 30000
  };

  // ========== 消息类型 ==========
  const MESSAGE_TYPES = {
    REQUEST: '__request__',
    RESPONSE: '__response__',
    PUBLISH: '__publish__',
    BATCH: '__batch__',
    // V5 新增
    REPLAY_START: '__replay_start__',
    REPLAY_MESSAGE: '__replay_message__',
    REPLAY_END: '__replay_end__',
    DEVTOOLS_CONNECT: '__devtools_connect__',
    DEVTOOLS_DISCONNECT: '__devtools_disconnect__',
    DEVTOOLS_MESSAGE: '__devtools_message__',
    SNAPSHOT: '__snapshot__'
  };

  // ========== 消息序列化器 ==========
  const Serializer = {
    formats: {
      json: {
        serialize: (data) => JSON.stringify(data),
        deserialize: (str) => JSON.parse(str),
        name: 'JSON'
      },
      compact: {
        serialize: (data) => {
          // 紧凑JSON格式，去除不必要的空格
          return JSON.stringify(data, (key, value) => {
            if (value instanceof Error) {
              return { __error__: true, message: value.message, stack: value.stack };
            }
            if (typeof value === 'function') {
              return { __function__: true, name: value.name || 'anonymous' };
            }
            return value;
          });
        },
        deserialize: (str) => {
          return JSON.parse(str, (key, value) => {
            if (value && value.__error__) {
              const err = new Error(value.message);
              err.stack = value.stack;
              return err;
            }
            if (value && value.__function__) {
              return () => {}; // 返回空函数占位
            }
            return value;
          });
        },
        name: 'Compact JSON'
      }
    },

    currentFormat: 'json',

    init() {
      this.currentFormat = CONFIG.SERIALIZATION_FORMAT;
    },

    serialize(data) {
      try {
        const format = this.formats[this.currentFormat];
        if (!format) throw new Error(`Unknown format: ${this.currentFormat}`);
        return format.serialize(data);
      } catch (error) {
        console.error('[Serializer] 序列化失败:', error);
        return null;
      }
    },

    deserialize(str) {
      try {
        const format = this.formats[this.currentFormat];
        if (!format) throw new Error(`Unknown format: ${this.currentFormat}`);
        return format.deserialize(str);
      } catch (error) {
        console.error('[Serializer] 反序列化失败:', error);
        return null;
      }
    },

    setFormat(format) {
      if (this.formats[format]) {
        this.currentFormat = format;
        console.log(`[Serializer] 格式已切换为: ${this.formats[format].name}`);
      }
    }
  };

  // ========== 消息模板系统 ==========
  const MessageTemplates = {
    templates: {},

    define(name, template) {
      this.templates[name] = {
        name,
        schema: template.schema || {},
        defaults: template.defaults || {},
        validate: template.validate || null,
        transform: template.transform || null,
        metadata: template.metadata || {}
      };
      console.log(`[模板] 已定义: ${name}`);
    },

    create(name, data = {}) {
      const template = this.templates[name];
      if (!template) {
        throw new Error(`模板不存在: ${name}`);
      }

      // 合并默认值
      const message = {
        __template: name,
        ...template.defaults,
        ...data
      };

      // 验证
      if (template.validate) {
        const errors = template.validate(message);
        if (errors) {
          throw new Error(`模板验证失败: ${errors.join(', ')}`);
        }
      }

      // 转换
      if (template.transform) {
        return template.transform(message);
      }

      return message;
    },

    validate(name, data) {
      const template = this.templates[name];
      if (!template) return false;
      if (!template.validate) return true;
      const errors = template.validate(data);
      return !errors || errors.length === 0;
    },

    get(name) {
      return this.templates[name];
    },

    list() {
      return Object.keys(this.templates);
    }
  };

  // ========== 消息录制器 ==========
  const MessageRecorder = {
    isRecording: false,
    recordedMessages: [],
    startTime: null,
    metadata: {},

    start(metadata = {}) {
      this.isRecording = true;
      this.recordedMessages = [];
      this.startTime = Date.now();
      this.metadata = {
        ...metadata,
        startTime: this.startTime,
        version: '5.0.0'
      };
      console.log('[录制器] 开始录制', this.metadata);
      this.notify('start', { metadata: this.metadata });
    },

    stop() {
      if (!this.isRecording) return;

      this.isRecording = false;
      const recording = {
        metadata: {
          ...this.metadata,
          endTime: Date.now(),
          duration: Date.now() - this.startTime,
          messageCount: this.recordedMessages.length
        },
        messages: [...this.recordedMessages]
      };

      console.log(`[录制器] 停止录制: ${recording.messages.length} 条消息`);
      this.notify('stop', { recording });

      // 限制记录数量
      if (this.recordedMessages.length > CONFIG.MAX_RECORDED_MESSAGES) {
        this.recordedMessages = this.recordedMessages.slice(-CONFIG.MAX_RECORDED_MESSAGES);
      }

      return recording;
    },

    record(message) {
      if (!this.isRecording) return;

      const recordedMessage = {
        ...message,
        __recordedAt: Date.now(),
        __offset: Date.now() - this.startTime
      };

      this.recordedMessages.push(recordedMessage);

      // 限制内存使用
      if (this.recordedMessages.length > CONFIG.MAX_RECORDED_MESSAGES) {
        this.recordedMessages.shift();
      }
    },

    clear() {
      this.recordedMessages = [];
      this.startTime = null;
      console.log('[录制器] 已清空录制内容');
    },

    getRecording() {
      if (this.recordedMessages.length === 0) return null;

      return {
        metadata: {
          ...this.metadata,
          endTime: Date.now(),
          duration: Date.now() - this.startTime,
          messageCount: this.recordedMessages.length
        },
        messages: [...this.recordedMessages]
      };
    },

    export() {
      const recording = this.getRecording();
      if (!recording) return null;

      return Serializer.serialize(recording);
    },

    import(data) {
      try {
        const recording = typeof data === 'string' ? Serializer.deserialize(data) : data;
        this.recordedMessages = recording.messages || [];
        this.metadata = recording.metadata || {};
        this.startTime = this.metadata.startTime || Date.now();
        console.log(`[录制器] 已导入: ${this.recordedMessages.length} 条消息`);
        return true;
      } catch (error) {
        console.error('[录制器] 导入失败:', error);
        return false;
      }
    },

    notify(event, data) {
      DevToolsIntegration.notify('recorder', { event, data });
    }
  };

  // ========== 内存分析器 ==========
  const MemoryProfiler = {
    enabled: false,
    samples: [],
    intervals: [],

    start() {
      if (this.enabled) return;
      this.enabled = true;
      this.samples = [];

      this.intervals.push(setInterval(() => {
        this.sample();
      }, 1000));

      console.log('[内存分析器] 已启动');
    },

    stop() {
      this.enabled = false;
      this.intervals.forEach(clearInterval);
      this.intervals = [];
      console.log('[内存分析器] 已停止');
    },

    sample() {
      if (!this.enabled) return;

      const sample = {
        timestamp: Date.now(),
        // 使用 performance.memory (Chrome)
        usedJSHeapSize: typeof performance !== 'undefined' && performance.memory ?
          performance.memory.usedJSHeapSize : null,
        totalJSHeapSize: typeof performance !== 'undefined' && performance.memory ?
          performance.memory.totalJSHeapSize : null,
        // 消息计数
        messageCount: Tracking.messages.length,
        // 订阅者数量
        subscriptionCount: Subscriptions.length,
        // 插件数量
        pluginCount: PluginSystem ? PluginSystem.plugins.size : 0
      };

      this.samples.push(sample);

      // 限制样本数量
      if (this.samples.length > CONFIG.MAX_MEMORY_SAMPLES) {
        this.samples.shift();
      }

      DevToolsIntegration.notify('memory', { sample });
    },

    getReport() {
      if (this.samples.length === 0) {
        return { error: '无样本数据' };
      }

      const usedHeaps = this.samples
        .map(s => s.usedJSHeapSize)
        .filter(Boolean);

      return {
        duration: this.samples[this.samples.length - 1].timestamp - this.samples[0].timestamp,
        samples: this.samples.length,
        memory: {
          current: usedHeaps[usedHeaps.length - 1],
          peak: Math.max(...usedHeaps),
          average: usedHeaps.reduce((a, b) => a + b, 0) / usedHeaps.length,
          trend: usedHeaps.length > 1 ?
            usedHeaps[usedHeaps.length - 1] - usedHeaps[0] : 0
        },
        messages: {
          current: this.samples[this.samples.length - 1].messageCount,
          peak: Math.max(...this.samples.map(s => s.messageCount))
        },
        subscriptions: {
          current: this.samples[this.samples.length - 1].subscriptionCount
        }
      };
    },

    reset() {
      this.samples = [];
      console.log('[内存分析器] 已重置');
    }
  };

  // ========== DevTools 集成 ==========
  const DevToolsIntegration = {
    connected: false,
    port: null,
    messageQueue: [],
    listeners: new Map(),

    connect() {
      if (!isDevTools || this.connected) return;

      try {
        this.port = chrome.runtime.connect({
          name: CONFIG.DEVTOOLS_PANEL_ID
        });

        this.port.onMessage.addListener((message) => {
          this.handleMessage(message);
        });

        this.port.onDisconnect.addListener(() => {
          this.disconnect();
        });

        this.connected = true;
        console.log('[DevTools] 面板已连接');

        // 发送队列中的消息
        this.flushQueue();
      } catch (error) {
        console.warn('[DevTools] 连接失败:', error.message);
      }
    },

    disconnect() {
      this.connected = false;
      this.port = null;
      console.log('[DevTools] 面板已断开');
    },

    handleMessage(message) {
      const { type, data } = message;

      switch (type) {
        case 'getState':
          this.sendState();
          break;
        case 'startRecording':
          MessageRecorder.start(data);
          break;
        case 'stopRecording':
          this.send('recordingStopped', MessageRecorder.stop());
          break;
        case 'clearRecording':
          MessageRecorder.clear();
          break;
        case 'getRecording':
          this.send('recording', MessageRecorder.getRecording());
          break;
        case 'replay':
          this.replay(data);
          break;
        case 'getMemoryReport':
          this.send('memoryReport', MemoryProfiler.getReport());
          break;
        case 'startMemoryProfiler':
          MemoryProfiler.start();
          break;
        case 'stopMemoryProfiler':
          MemoryProfiler.stop();
          break;
        case 'getChart':
          this.sendChart(data.chartType);
          break;
        default:
          // 触发自定义监听器
          this.trigger(type, data);
      }
    },

    send(type, data) {
      const message = { type, data };

      if (this.connected && this.port) {
        try {
          this.port.postMessage(message);
        } catch (error) {
          console.warn('[DevTools] 发送失败:', error.message);
          this.messageQueue.push(message);
        }
      } else {
        this.messageQueue.push(message);
      }
    },

    flushQueue() {
      while (this.messageQueue.length > 0 && this.connected) {
        const message = this.messageQueue.shift();
        try {
          this.port.postMessage(message);
        } catch (error) {
          this.messageQueue.unshift(message);
          break;
        }
      }
    },

    sendState() {
      this.send('state', {
        config: CONFIG,
        stats: Tracking.getStats(),
        subscriptions: Subscriptions.list(),
        circuitBreakers: getAllCircuitBreakerStates ? getAllCircuitBreakerStates() : {},
        isRecording: MessageRecorder.isRecording,
        memoryEnabled: MemoryProfiler.enabled
      });
    },

    notify(category, data) {
      this.send('notification', { category, ...data });
    },

    on(event, callback) {
      if (!this.listeners.has(event)) {
        this.listeners.set(event, []);
      }
      this.listeners.get(event).push(callback);
    },

    off(event, callback) {
      if (!this.listeners.has(event)) return;
      const listeners = this.listeners.get(event);
      const index = listeners.indexOf(callback);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    },

    trigger(event, data) {
      if (!this.listeners.has(event)) return;
      this.listeners.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[DevTools] 监听器错误 (${event}):`, error);
        }
      });
    },

    sendChart(chartType) {
      let data;
      switch (chartType) {
        case 'messages':
          data = this.getMessagesChart();
          break;
        case 'latency':
          data = this.getLatencyChart();
          break;
        case 'memory':
          data = this.getMemoryChart();
          break;
        default:
          data = { error: 'Unknown chart type' };
      }
      this.send('chart', { type: chartType, data });
    },

    getMessagesChart() {
      const stats = Tracking.getStats();
      return {
        sent: stats.sent,
        received: stats.received,
        failed: stats.failed,
        timeout: stats.timeout
      };
    },

    getLatencyChart() {
      const history = Tracking.getHistory({ limit: 100 });
      const latencies = history
        .filter(m => m.latency !== undefined)
        .map(m => ({ x: m.timestamp, y: m.latency }));
      return { latencies };
    },

    getMemoryChart() {
      return {
        samples: MemoryProfiler.samples.map(s => ({
          x: s.timestamp,
          y: s.usedJSHeapSize
        }))
      };
    }
  };

  // ========== 智能错误诊断 ==========
  const SmartDiagnostics = {
    patterns: [
      {
        name: 'Timeout Error',
        pattern: /timeout/i,
        diagnosis: '请求超时，可能是处理器执行时间过长或消息丢失',
        suggestion: '检查处理器性能，增加超时时间，或检查消息是否正确路由'
      },
      {
        name: 'No Handler',
        pattern: /no handler|no listener/i,
        diagnosis: '没有找到对应的消息处理器',
        suggestion: '确保使用 EventBus.on() 或 EventBus.subscribe() 注册了处理器'
      },
      {
        name: 'Connection Lost',
        pattern: /port.*closed|connection.*lost/i,
        diagnosis: '端口连接已断开',
        suggestion: '检查目标环境是否仍在运行，重新建立连接'
      },
      {
        name: 'Serialization Error',
        pattern: /circular|clone|serialize/i,
        diagnosis: '消息包含无法序列化的数据（如循环引用）',
        suggestion: '简化消息数据结构，避免循环引用或使用不可序列化的对象'
      },
      {
        name: 'Memory Leak',
        pattern: /memory|heap/i,
        diagnosis: '可能的内存泄漏',
        suggestion: '检查是否有未清理的订阅者，使用 EventBus.clear() 清理'
      }
    ],

    diagnose(error) {
      const errorMessage = error.message || String(error);
      const errorStack = error.stack || '';

      for (const pattern of this.patterns) {
        if (pattern.pattern.test(errorMessage) || pattern.pattern.test(errorStack)) {
          return {
            error: errorMessage,
            pattern: pattern.name,
            diagnosis: pattern.diagnosis,
            suggestion: pattern.suggestion,
            severity: this.getSeverity(pattern.name)
          };
        }
      }

      return {
        error: errorMessage,
        pattern: 'Unknown',
        diagnosis: '未知的错误类型',
        suggestion: '检查控制台获取更多错误信息',
        severity: 'medium'
      };
    },

    getSeverity(patternName) {
      const severePatterns = ['Memory Leak', 'Connection Lost'];
      return severePatterns.includes(patternName) ? 'high' : 'medium';
    },

    analyzeHealth() {
      const stats = Tracking.getStats();
      const failureRate = stats.sent > 0 ? stats.failed / stats.sent : 0;
      const timeoutRate = stats.sent > 0 ? stats.timeout / stats.sent : 0;

      const issues = [];

      if (failureRate > 0.1) {
        issues.push({
          severity: 'high',
          message: `失败率过高: ${(failureRate * 100).toFixed(1)}%`,
          suggestion: '检查处理器错误处理和异常捕获'
        });
      }

      if (timeoutRate > 0.05) {
        issues.push({
          severity: 'medium',
          message: `超时率较高: ${(timeoutRate * 100).toFixed(1)}%`,
          suggestion: '考虑增加超时时间或优化处理器性能'
        });
      }

      const trackingCount = Tracking.messages.length;
      if (trackingCount > 1000) {
        issues.push({
          severity: 'low',
          message: `消息追踪数量较多: ${trackingCount}`,
          suggestion: '定期清理追踪历史或禁用追踪功能'
        });
      }

      return {
        overall: issues.length === 0 ? 'healthy' :
                 issues.some(i => i.severity === 'high') ? 'unhealthy' : 'degraded',
        issues
      };
    }
  };

  // ========== 可视化数据生成 ==========
  const Visualization = {
    generateMessageGraph(messages) {
      const nodes = new Map();
      const links = [];

      messages.forEach(msg => {
        const from = msg.from || 'unknown';
        const type = msg.type;

        if (!nodes.has(from)) {
          nodes.set(from, { id: from, count: 0 });
        }
        nodes.get(from).count++;

        if (msg.to) {
          links.push({ from, to: msg.to, type });
        }
      });

      return {
        nodes: Array.from(nodes.values()),
        links
      };
    },

    generateTimeline(messages) {
      return messages.map(msg => ({
        timestamp: msg.timestamp,
        type: msg.type,
        from: msg.from,
        duration: msg.latency || 0,
        success: !msg.error
      }));
    },

    generateHeatmap(messages) {
      const heatmap = new Map();

      messages.forEach(msg => {
        const hour = new Date(msg.timestamp).getHours();
        const type = msg.type;
        const key = `${hour}-${type}`;

        if (!heatmap.has(key)) {
          heatmap.set(key, { hour, type, count: 0 });
        }
        heatmap.get(key).count++;
      });

      return Array.from(heatmap.values());
    }
  };

  // ========== 性能追踪 (增强版) ==========
  const PerformanceTracker = {
    metrics: new Map(),
    history: [],

    startOperation(operation) {
      this.metrics.set(operation, {
        startTime: performance.now(),
        endTime: null,
        duration: null
      });
    },

    endOperation(operation) {
      const metric = this.metrics.get(operation);
      if (!metric) return;

      metric.endTime = performance.now();
      metric.duration = metric.endTime - metric.startTime;

      this.history.push({
        operation,
        duration: metric.duration,
        timestamp: Date.now()
      });

      // 限制历史大小
      if (this.history.length > CONFIG.PERFORMANCE_HISTORY_SIZE) {
        this.history.shift();
      }

      this.metrics.delete(operation);
    },

    getMetrics(operation) {
      const operationMetrics = this.history.filter(h => h.operation === operation);
      if (operationMetrics.length === 0) return null;

      const durations = operationMetrics.map(h => h.duration);

      return {
        count: durations.length,
        total: durations.reduce((a, b) => a + b, 0),
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p50: this.percentile(durations, 50),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99)
      };
    },

    percentile(arr, p) {
      const sorted = arr.slice().sort((a, b) => a - b);
      const index = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[index];
    },

    getAllMetrics() {
      const operations = [...new Set(this.history.map(h => h.operation))];
      return operations.map(op => ({
        operation: op,
        ...this.getMetrics(op)
      }));
    }
  };

  // ========== 状态管理 (从 V4 继承并增强) ==========
  const State = {
    env: ENV,
    instanceId: `eventbus_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    isReady: false,
    startTime: Date.now(),
    messageCount: 0,
    version: '5.0.0'
  };

  // ========== 订阅管理 (从 V4 继承) ==========
  const Subscriptions = {
    list: [],
    length: 0,

    add(type, callback, options = {}) {
      const subscription = {
        id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        callback,
        once: options.once || false,
        namespace: options.namespace || null,
        priority: options.priority || 0,
        createdAt: Date.now()
      };

      // 按优先级排序
      this.list.push(subscription);
      this.list.sort((a, b) => b.priority - a.priority);
      this.length = this.list.length;

      return () => this.remove(subscription.id);
    },

    remove(id) {
      const index = this.list.findIndex(s => s.id === id);
      if (index > -1) {
        this.list.splice(index, 1);
        this.length = this.list.length;
        return true;
      }
      return false;
    },

    findByType(type) {
      return this.list.filter(s => s.type === type || s.type === '*');
    },

    clear() {
      this.list = [];
      this.length = 0;
    }
  };

  // ========== 消息追踪 (从 V4 继承并增强) ==========
  const Tracking = {
    messages: [],
    stats: {
      sent: 0,
      received: 0,
      failed: 0,
      timeout: 0,
      retried: 0,
      compressed: 0,
      trackedMessages: 0
    },

    log(type, message, data = {}) {
      const logEntry = {
        timestamp: Date.now(),
        type,
        message,
        ...data
      };

      this.messages.push(logEntry);

      // 限制追踪数量
      const maxTracking = CONFIG.ENABLE_TRACKING ? 10000 : 100;
      if (this.messages.length > maxTracking) {
        this.messages.shift();
      }

      this.stats.trackedMessages = this.messages.length;
    },

    getStats() {
      return { ...this.stats };
    },

    getHistory(filter = {}) {
      let messages = this.messages;

      if (filter.type) {
        messages = messages.filter(m => m.type === filter.type);
      }
      if (filter.limit) {
        messages = messages.slice(-filter.limit);
      }
      if (filter.since) {
        messages = messages.filter(m => m.timestamp >= filter.since);
      }

      return messages;
    },

    clear() {
      this.messages = [];
      this.stats.trackedMessages = 0;
    }
  };

  // ========== 处理器管理 ==========
  const Handlers = new Map();

  // ========== 连接管理 ==========
  const Connections = {
    tabs: new Map(),
    workers: new Map(),
    extensions: new Map(),

    add(source) {
      if (source.tabId) {
        this.tabs.set(source.tabId, { ...source, connectedAt: Date.now() });
      }
    },

    remove(source) {
      if (source.tabId) {
        this.tabs.delete(source.tabId);
      }
    },

    list() {
      return {
        tabs: Array.from(this.tabs.values()),
        workers: Array.from(this.workers.values()),
        extensions: Array.from(this.extensions.values())
      };
    }
  };

  // ========== 断路器 (从 V4 继承) ==========
  const CircuitBreaker = {
    states: { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' },
    breakers: new Map(),

    async execute(type, fn) {
      if (!CONFIG.ENABLE_CIRCUIT_BREAKER) return await fn();

      let breaker = this.breakers.get(type);
      if (!breaker) {
        breaker = {
          state: this.states.CLOSED,
          failureCount: 0,
          lastFailureTime: null,
          lastSuccessTime: Date.now()
        };
        this.breakers.set(type, breaker);
      }

      if (breaker.state === this.states.OPEN) {
        if (Date.now() - breaker.lastFailureTime > CONFIG.CIRCUIT_BREAKER_TIMEOUT) {
          breaker.state = this.states.HALF_OPEN;
        } else {
          throw new Error(`断路器已打开: ${type}`);
        }
      }

      try {
        const result = await fn();
        breaker.state = this.states.CLOSED;
        breaker.failureCount = 0;
        breaker.lastSuccessTime = Date.now();
        return result;
      } catch (error) {
        breaker.failureCount++;
        breaker.lastFailureTime = Date.now();

        if (breaker.failureCount >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
          breaker.state = this.states.OPEN;
          console.warn(`[断路器] 已打开: ${type} (失败次数: ${breaker.failureCount})`);
        }

        throw error;
      }
    },

    getState(type) {
      const breaker = this.breakers.get(type);
      return breaker ? breaker.state : null;
    },

    reset(type) {
      this.breakers.delete(type);
    },

    getAllStates() {
      const states = {};
      this.breakers.forEach((breaker, type) => {
        states[type] = {
          state: breaker.state,
          failureCount: breaker.failureCount,
          lastFailureTime: breaker.lastFailureTime,
          lastSuccessTime: breaker.lastSuccessTime
        };
      });
      return states;
    }
  };

  // ========== 插件系统 (从 V4 继承并增强) ==========
  const PluginSystem = {
    plugins: new Map(),
    hooks: {
      beforeSend: [],
      afterReceive: [],
      beforeHandler: [],
      afterHandler: [],
      onError: [],
      // V5 新增钩子
      onMessage: [],
      onResponse: [],
      onSubscribe: [],
      onUnsubscribe: []
    },

    register(plugin) {
      if (!plugin.name) {
        throw new Error('插件必须包含 name 属性');
      }

      this.plugins.set(plugin.name, {
        name: plugin.name,
        version: plugin.version || '1.0.0',
        description: plugin.description || '',
        enabled: true,
        hooks: plugin.hooks || {},
        init: plugin.init || null,
        destroy: plugin.destroy || null
      });

      // 注册钩子
      if (plugin.hooks) {
        Object.entries(plugin.hooks).forEach(([hook, handler]) => {
          if (this.hooks[hook]) {
            this.hooks[hook].push({ plugin: plugin.name, handler });
          }
        });
      }

      // 初始化插件
      if (plugin.init) {
        try {
          plugin.init();
        } catch (error) {
          console.error(`[插件] 初始化失败 (${plugin.name}):`, error);
        }
      }

      console.log(`[插件] 已注册: ${plugin.name} v${this.plugins.get(plugin.name).version}`);
      DevToolsIntegration.notify('plugin', { event: 'registered', name: plugin.name });
    },

    unregister(name) {
      const plugin = this.plugins.get(name);
      if (!plugin) return false;

      // 移除钩子
      Object.values(this.hooks).forEach(hooks => {
        const index = hooks.findIndex(h => h.plugin === name);
        if (index > -1) hooks.splice(index, 1);
      });

      // 销毁插件
      if (plugin.destroy) {
        try {
          plugin.destroy();
        } catch (error) {
          console.error(`[插件] 销毁失败 (${name}):`, error);
        }
      }

      this.plugins.delete(name);
      console.log(`[插件] 已卸载: ${name}`);
      DevToolsIntegration.notify('plugin', { event: 'unregistered', name });
      return true;
    },

    enable(name) {
      const plugin = this.plugins.get(name);
      if (plugin) {
        plugin.enabled = true;
        console.log(`[插件] 已启用: ${name}`);
        return true;
      }
      return false;
    },

    disable(name) {
      const plugin = this.plugins.get(name);
      if (plugin) {
        plugin.enabled = false;
        console.log(`[插件] 已禁用: ${name}`);
        return true;
      }
      return false;
    },

    async executeHook(hook, context) {
      if (!this.hooks[hook]) return;

      for (const { plugin, handler } of this.hooks[hook]) {
        const pluginObj = this.plugins.get(plugin);
        if (pluginObj && pluginObj.enabled) {
          try {
            await handler.call(pluginObj, context);
          } catch (error) {
            console.error(`[插件] 钩子执行错误 (${plugin}.${hook}):`, error);
          }
        }
      }
    },

    list() {
      return Array.from(this.plugins.values()).map(p => ({
        name: p.name,
        version: p.version,
        description: p.description,
        enabled: p.enabled
      }));
    }
  };

  // ========== 核心功能函数 ==========

  /**
   * 等待连接就绪
   */
  function waitForConnection() {
    return new Promise((resolve) => {
      if (State.isReady) {
        resolve();
        return;
      }

      const checkInterval = setInterval(() => {
        if (State.isReady) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 50);

      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 5000);
    });
  }

  /**
   * 获取消息目标
   */
  function getTargets(target) {
    const targets = [];

    if (!target || target === 'all') {
      // 广播到所有连接
      targets.push(...Connections.list().tabs);
      targets.push(...Connections.list().workers);
    } else if (typeof target === 'string') {
      // 通过目标类型过滤
      if (target === 'content') {
        targets.push(...Connections.list().tabs);
      } else if (target === 'background') {
        targets.push(...Connections.list().workers);
      }
    } else if (Array.isArray(target)) {
      targets.push(...target);
    }

    return targets;
  }

  /**
   * 发送消息
   */
  async function _sendMessage(message, options = {}) {
    const targets = options.target ?
      getTargets(options.target) :
      getTargets('all');

    if (targets.length === 0) {
      // 没有目标，尝试本地处理
      return _handleMessage(message);
    }

    // 执行 beforeSend 钩子
    await PluginSystem.executeHook('beforeSend', { message, options });

    // 添加到录制
    MessageRecorder.record(message);

    // 发送到所有目标
    const results = targets.map(target => {
      return new Promise((resolve) => {
        try {
          chrome.runtime.sendMessage({
            __eventbus__: true,
            message,
            from: State.instanceId,
            fromEnv: ENV
          }, (response) => {
            resolve(response);
          });
        } catch (error) {
          resolve({ error: error.message });
        }
      });
    });

    const responses = await Promise.all(results);

    // 执行 afterReceive 钩子
    await PluginSystem.executeHook('afterReceive', { message, responses });

    return responses;
  }

  /**
   * 处理消息
   */
  async function _handleMessage(message) {
    // 确定实际的消息类型（处理 request 类型消息）
    const actualType = message.requestType || message.type;
    PerformanceTracker.startOperation(actualType);

    try {
      // 执行 beforeHandler 钩子
      await PluginSystem.executeHook('beforeHandler', { message });

      // 查找订阅者（使用实际类型，而不是 __request__）
      const subscriptions = Subscriptions.findByType(actualType);

      if (subscriptions.length === 0) {
        throw new Error(`没有处理器: ${actualType}`);
      }

      const results = [];
      for (const subscription of subscriptions) {
        try {
          const result = await subscription.callback(message.data, message.from, actualType);

          if (subscription.once) {
            Subscriptions.remove(subscription.id);
          }

          results.push(result);
        } catch (error) {
          console.error(`[EventBus] 处理器错误 (${subscription.id}):`, error);
        }
      }

      // 执行 afterHandler 钩子
      await PluginSystem.executeHook('afterHandler', { message, results });

      Tracking.stats.received++;

      return results.length === 1 ? results[0] : results;
    } catch (error) {
      Tracking.stats.failed++;

      // 执行 onError 钩子
      await PluginSystem.executeHook('onError', { message, error });

      // 智能错误诊断
      if (CONFIG.ENABLE_SMART_ERRORS) {
        const diagnosis = SmartDiagnostics.diagnose(error);
        console.error('[EventBus] 错误诊断:', JSON.stringify(diagnosis, null, 2));
        DevToolsIntegration.notify('error', { error: error.message, diagnosis });
      }

      throw error;
    } finally {
      PerformanceTracker.endOperation(actualType);
    }
  }

  // ========== EventBus 公开 API ==========
  const EventBus = {
    /**
     * 获取状态
     */
    getState() {
      return {
        env: State.env,
        instanceId: State.instanceId,
        isReady: State.isReady,
        uptime: Date.now() - State.startTime,
        messageCount: State.messageCount,
        version: State.version,
        config: CONFIG,
        subscriptions: Subscriptions.list,
        handlers: Handlers.size,
        connections: Connections.list(),
        circuitBreakers: CircuitBreaker.getAllStates(),
        plugins: PluginSystem.list()
      };
    },

    /**
     * 获取统计信息
     */
    getStats() {
      return Tracking.getStats();
    },

    /**
     * 获取追踪历史
     */
    getHistory(filter) {
      return Tracking.getHistory(filter);
    },

    /**
     * 订阅消息
     */
    subscribe(type, callback, options) {
      PerformanceTracker.startOperation('subscribe');

      const unsubscribe = Subscriptions.add(type, callback, options);

      // 执行 onSubscribe 钩子
      PluginSystem.executeHook('onSubscribe', { type, options });

      PerformanceTracker.endOperation('subscribe');

      DevToolsIntegration.notify('subscription', { event: 'added', type });

      return unsubscribe;
    },

    /**
     * 一次性订阅
     */
    once(type, callback) {
      return this.subscribe(type, callback, { once: true });
    },

    /**
     * 取消订阅
     */
    off(type, callback) {
      let removed = 0;

      Subscriptions.list.forEach(sub => {
        if (sub.type === type && (!callback || sub.callback === callback)) {
          Subscriptions.remove(sub.id);
          removed++;

          // 执行 onUnsubscribe 钩子
          PluginSystem.executeHook('onUnsubscribe', { type });
        }
      });

      DevToolsIntegration.notify('subscription', { event: 'removed', type, count: removed });

      return removed > 0;
    },

    /**
     * 清空所有订阅
     */
    clear() {
      Subscriptions.clear();
      Tracking.clear();
      console.log('[EventBus] 已清空所有订阅和追踪');
      DevToolsIntegration.notify('subscription', { event: 'cleared' });
    },

    /**
     * 发布消息
     */
    async publish(type, data, options = {}) {
      State.messageCount++;
      Tracking.stats.sent++;

      const message = {
        __eventbus__: true,
        type,
        id: `${State.instanceId}_${++State.messageCount}`,
        data,
        from: State.instanceId,
        fromEnv: ENV,
        timestamp: Date.now()
      };

      Tracking.log(type, message);

      return _sendMessage(message, options);
    },

    /**
     * 请求-响应模式
     */
    async request(type, data, options = {}) {
      const timeout = options.timeout || 5000;

      return CircuitBreaker.execute(type, async () => {
        State.messageCount++;
        Tracking.stats.sent++;

        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const message = {
          __eventbus__: true,
          type: MESSAGE_TYPES.REQUEST,
          id: requestId,
          requestType: type,
          data,
          from: State.instanceId,
          fromEnv: ENV,
          timestamp: Date.now()
        };

        Tracking.log(MESSAGE_TYPES.REQUEST, message);

        const startTime = performance.now();

        try {
          const response = await _sendMessage(message, options);

          const latency = performance.now() - startTime;
          Tracking.log(MESSAGE_TYPES.RESPONSE, message, { latency, response });

          return response;
        } catch (error) {
          const latency = performance.now() - startTime;
          Tracking.log(MESSAGE_TYPES.RESPONSE, message, { latency, error: error.message });

          if (error.message.includes('timeout')) {
            Tracking.stats.timeout++;
          }

          throw error;
        }
      });
    },

    /**
     * 注册处理器
     */
    on(type, handler) {
      Handlers.set(type, handler);

      // 同时订阅
      this.subscribe(type, async (data, from) => {
        const result = await handler(data, from);
        return result;
      });
    },

    /**
     * 配置
     */
    configure(settings) {
      Object.assign(CONFIG, settings);
      console.log('[EventBus] 配置已更新:', settings);
      DevToolsIntegration.notify('config', { settings });
    },

    /**
     * 获取配置
     */
    getConfig() {
      return { ...CONFIG };
    },

    /**
     * 设置调试模式
     */
    setDebugMode(enabled) {
      CONFIG.DEBUG_MODE = enabled;
      console.log(`[EventBus] 调试模式: ${enabled ? '启用' : '禁用'}`);
    },

    /**
     * 初始化（兼容旧版本API）
     */
    async init() {
      // V5 自动初始化，此方法仅为兼容旧代码
      if (State.isReady) {
        return true;
      }
      // 等待就绪
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (State.isReady) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 50);
        // 超时保护
        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(State.isReady);
        }, 5000);
      });
    },

    // ========== V5 新增 API ==========

    /**
     * 连接 DevTools
     */
    connectDevTools() {
      DevToolsIntegration.connect();
    },

    /**
     * 断开 DevTools
     */
    disconnectDevTools() {
      DevToolsIntegration.disconnect();
    },

    /**
     * 开始录制消息
     */
    startRecording(metadata) {
      MessageRecorder.start(metadata);
    },

    /**
     * 停止录制
     */
    stopRecording() {
      return MessageRecorder.stop();
    },

    /**
     * 获取录制内容
     */
    getRecording() {
      return MessageRecorder.getRecording();
    },

    /**
     * 清空录制
     */
    clearRecording() {
      MessageRecorder.clear();
    },

    /**
     * 导出录制
     */
    exportRecording() {
      return MessageRecorder.export();
    },

    /**
     * 导入录制
     */
    importRecording(data) {
      return MessageRecorder.import(data);
    },

    /**
     * 回放消息
     */
    async replay(messages, options = {}) {
      const { delay = 0, speed = 1 } = options;

      console.log(`[回放] 开始回放 ${messages.length} 条消息`);

      for (const msg of messages) {
        const actualDelay = (msg.__offset || 0) / speed;

        if (actualDelay > 0) {
          await new Promise(resolve => setTimeout(resolve, actualDelay));
        }

        try {
          if (msg.requestType) {
            await this.request(msg.requestType, msg.data);
          } else {
            await this.publish(msg.type, msg.data);
          }
        } catch (error) {
          console.error('[回放] 消息失败:', error);
        }
      }

      console.log('[回放] 完成');
    },

    /**
     * 启动内存分析器
     */
    startMemoryProfiler() {
      MemoryProfiler.start();
    },

    /**
     * 停止内存分析器
     */
    stopMemoryProfiler() {
      MemoryProfiler.stop();
    },

    /**
     * 获取内存报告
     */
    getMemoryReport() {
      return MemoryProfiler.getReport();
    },

    /**
     * 获取性能指标
     */
    getPerformanceMetrics(operation) {
      if (operation) {
        return PerformanceTracker.getMetrics(operation);
      }
      return PerformanceTracker.getAllMetrics();
    },

    /**
     * 获取健康分析
     */
    getHealthAnalysis() {
      return SmartDiagnostics.analyzeHealth();
    },

    /**
     * 定义消息模板
     */
    defineTemplate(name, template) {
      MessageTemplates.define(name, template);
    },

    /**
     * 创建模板消息
     */
    createMessage(templateName, data) {
      return MessageTemplates.create(templateName, data);
    },

    /**
     * 列出模板
     */
    listTemplates() {
      return MessageTemplates.list();
    },

    /**
     * 设置序列化格式
     */
    setSerializationFormat(format) {
      Serializer.setFormat(format);
    },

    /**
     * 获取可视化数据
     */
    getVisualization(type) {
      const messages = Tracking.getHistory({ limit: CONFIG.MAX_DISPLAY_MESSAGES });

      switch (type) {
        case 'graph':
          return Visualization.generateMessageGraph(messages);
        case 'timeline':
          return Visualization.generateTimeline(messages);
        case 'heatmap':
          return Visualization.generateHeatmap(messages);
        default:
          throw new Error(`未知的可视化类型: ${type}`);
      }
    },

    /**
     * 获取快照
     */
    getSnapshot() {
      return {
        timestamp: Date.now(),
        state: this.getState(),
        stats: this.getStats(),
        performance: this.getPerformanceMetrics(),
        memory: MemoryProfiler.getReport(),
        health: this.getHealthAnalysis()
      };
    },

    // ========== V4 继承的 API ==========

    /**
     * 注册断路器
     */
    getCircuitBreakerState(type) {
      return CircuitBreaker.getState(type);
    },

    /**
     * 获取所有断路器状态
     */
    getAllCircuitBreakerStates() {
      return CircuitBreaker.getAllStates();
    },

    /**
     * 重置断路器
     */
    resetCircuitBreaker(type) {
      CircuitBreaker.reset(type);
    },

    /**
     * 注册验证模式
     */
    registerSchema(type, schema) {
      // 使用模板系统
      this.defineTemplate(type, {
        schema,
        validate: schema.validate
      });
    },

    /**
     * 注册插件
     */
    registerPlugin(plugin) {
      PluginSystem.register(plugin);
    },

    /**
     * 卸载插件
     */
    unregisterPlugin(name) {
      return PluginSystem.unregister(name);
    },

    /**
     * 启用插件
     */
    enablePlugin(name) {
      return PluginSystem.enable(name);
    },

    /**
     * 禁用插件
     */
    disablePlugin(name) {
      return PluginSystem.disable(name);
    },

    /**
     * 获取插件列表
     */
    getPlugins() {
      return PluginSystem.list();
    }
  };

  // ========== 监听来自其他环境的消息 ==========
  if (isChromeExtension) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message.__eventbus__) return;

      // 记录连接
      if (sender.tab) {
        Connections.add({ tabId: sender.tab.id, env: 'content' });
      }

      // 处理消息
      _handleMessage(message.message || message)
        .then(result => {
          sendResponse({ success: true, data: result });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });

      return true; // 保持消息通道开放
    });
  }

  // ========== 初始化 ==========
  function init() {
    State.isReady = true;

    // 初始化组件
    Serializer.init();
    MemoryProfiler.start();

    // 连接 DevTools
    if (CONFIG.ENABLE_DEVTOOLS_PANEL && isDevTools) {
      DevToolsIntegration.connect();
    }

    // 自动开始录制（如果配置）
    if (CONFIG.RECORDING_AUTO_START) {
      MessageRecorder.start({ auto: true });
    }

    console.log(`[EventBus] V5 已初始化 (${State.instanceId})`);
    console.log('[EventBus] 版本: 5.0.0 - 开发者增强版');
    console.log('[EventBus] 环境:', ENV);
  }

  // ========== 导出 ==========
  global.EventBus = EventBus;

  // 延迟初始化
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  } else {
    init();
  }

})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : global);
