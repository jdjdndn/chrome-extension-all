/**
 * ========================================
 * EventBus V4.5 - 企业级通信事件总线 (优化版)
 * ========================================
 * 基于 V4 + 合并 V5 新功能
 *
 * @version 4.5.5
 * @author EventBus Team
 */

(function () {
  'use strict';

  const globalThis = (typeof self !== 'undefined') ? self :
                     (typeof window !== 'undefined') ? window :
                     (typeof global !== 'undefined') ? global : this;

  // ==================== 工具函数 ====================
  const Utils = {
    // 生成唯一ID
    generateId(prefix = '') {
      return `${prefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },

    // 安全执行函数
    safeExecute(fn, fallback = null, context = null) {
      try {
        return fn.call(context);
      } catch (e) {
        return fallback;
      }
    },

    // 安全执行异步函数
    async safeExecuteAsync(fn, fallback = null, context = null) {
      try {
        return await fn.call(context);
      } catch (e) {
        return fallback;
      }
    },

    // 防抖函数
    debounce(fn, delay) {
      let timer = null;
      return function(...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
      };
    },

    // 节流函数
    throttle(fn, limit) {
      let inThrottle = false;
      return function(...args) {
        if (!inThrottle) {
          fn.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    },

    // 深拷贝（简化版）
    deepClone(obj) {
      if (obj === null || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj);
      if (obj instanceof Array) return obj.map(item => Utils.deepClone(item));
      if (obj instanceof Map) return new Map([...obj]);
      if (obj instanceof Set) return new Set([...obj]);
      const clone = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          clone[key] = Utils.deepClone(obj[key]);
        }
      }
      return clone;
    },

    // 判断是否为空对象
    isEmpty(obj) {
      if (!obj) return true;
      if (Array.isArray(obj)) return obj.length === 0;
      if (obj instanceof Map || obj instanceof Set) return obj.size === 0;
      return Object.keys(obj).length === 0;
    },

    // 统一日志输出
    log(prefix, message, force = false) {
      (force || CONFIG.DEBUG_MODE) && console.log(`[${prefix}]`, message);
    },

    // 统一错误日志
    logError(prefix, error, context = {}) {
      (CONFIG.DEBUG_MODE || !CONFIG.ENABLE_SMART_ERRORS) && console.error(`[${prefix}]`, error, context);
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

  const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime;
  const isDevTools = typeof chrome !== 'undefined' && chrome.devtools;

  // ==================== 配置 ====================
  const CONFIG = {
    // 基础配置
    HEARTBEAT_INTERVAL: 30000,
    MESSAGE_TIMEOUT: 5000,
    MAX_RETRY: 3,
    RETRY_DELAY: 200,
    DEBUG_MODE: false,
    ENABLE_TRACKING: true,
    MAX_TRACKING_SIZE: 500,

    // V3 功能
    ENABLE_NAMESPACES: true,
    ENABLE_PRIORITY: true,
    ENABLE_MIDDLEWARE: true,
    ENABLE_DEDUPLICATION: true,
    DEDUPLICATION_WINDOW: 1000,

    // V4 核心功能
    ENABLE_CIRCUIT_BREAKER: true,
    ENABLE_COMPRESSION: true,
    ENABLE_VALIDATION: true,
    ENABLE_PLUGINS: true,
    ENABLE_PERSISTENCE: true,
    ENABLE_HEALTH_CHECK: true,
    ENABLE_ENCRYPTION: false,

    // 断路器配置
    CIRCUIT_BREAKER_THRESHOLD: 5,
    CIRCUIT_BREAKER_TIMEOUT: 60000,

    // 压缩配置
    COMPRESSION_MIN_SIZE: 1024,

    // 健康检查配置
    HEALTH_CHECK_INTERVAL: 60000,

    // 持久化配置
    PERSISTENCE_KEY: '__eventbus_queue__',
    MAX_PERSISTENT_QUEUE: 100,

    // V5 新增配置
    ENABLE_DEVTOOLS_PANEL: true,
    ENABLE_MEMORY_PROFILING: true,
    ENABLE_SMART_ERRORS: true,
    SERIALIZATION_FORMAT: 'json',

    // DevTools 配置
    DEVTOOLS_PANEL_ID: 'eventbus-monitor',
    MAX_DISPLAY_MESSAGES: 1000,
    MAX_MEMORY_SAMPLES: 100,

    // 录制配置
    MAX_RECORDED_MESSAGES: 5000,
    RECORDING_AUTO_START: false,
    PERFORMANCE_HISTORY_SIZE: 100
  };

  // ==================== 消息类型 ====================
  const MESSAGE_TYPES = {
    PING: '__eb_ping__',
    PONG: '__eb_pong__',
    ACK: '__eb_ack__',
    READY: '__eb_ready__',
    HEARTBEAT: '__eb_heartbeat__',
    RESPONSE: '__eb_response__',
    BATCH: '__eb_batch__',
    HEALTH_CHECK: '__eb_health_check__',
    REQUEST: '__eb_request__',
    PUBLISH: '__eb_publish__',
    REPLAY_START: '__eb_replay_start__',
    REPLAY_MESSAGE: '__eb_replay_message__',
    REPLAY_END: '__eb_replay_end__',
    DEVTOOLS_CONNECT: '__eb_devtools_connect__',
    DEVTOOLS_DISCONNECT: '__eb_devtools_disconnect__',
    DEVTOOLS_MESSAGE: '__eb_devtools_message__',
    SNAPSHOT: '__eb_snapshot__'
  };

  // 连接状态常量
  const CONNECTION_STATUS = {
    CONNECTED: 'connected',
    DISCONNECTED: 'disconnected',
    READY: 'ready'
  };

  // ==================== 断路器 ====================
  const CircuitBreaker = {
    states: { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' },
    breakers: new Map(),

    getOrCreate(type) {
      if (!this.breakers.has(type)) {
        this.breakers.set(type, {
          state: this.states.CLOSED,
          failureCount: 0,
          lastFailureTime: 0,
          lastSuccessTime: Date.now(),
          lastStateChange: Date.now()
        });
      }
      return this.breakers.get(type);
    },

    getState(type) {
      const breaker = this.breakers.get(type);
      return breaker ? breaker.state : this.states.CLOSED;
    },

    async execute(type, fn) {
      if (!CONFIG.ENABLE_CIRCUIT_BREAKER) return await fn();

      const breaker = this.getOrCreate(type);
      const now = Date.now();

      if (breaker.state === this.states.OPEN) {
        if (now - breaker.lastStateChange > CONFIG.CIRCUIT_BREAKER_TIMEOUT) {
          breaker.state = this.states.HALF_OPEN;
          breaker.lastStateChange = now;
          Utils.log('断路器', `${type} 进入半开状态`);
        } else {
          throw new Error(`Circuit breaker is OPEN for ${type}`);
        }
      }

      try {
        const result = await fn();
        if (breaker.state !== this.states.CLOSED) {
          breaker.state = this.states.CLOSED;
          breaker.failureCount = 0;
          breaker.lastStateChange = now;
          Utils.log('断路器', `${type} 恢复正常`);
        }
        breaker.lastSuccessTime = now;
        return result;
      } catch (error) {
        breaker.failureCount++;
        breaker.lastFailureTime = now;
        if (breaker.failureCount >= CONFIG.CIRCUIT_BREAKER_THRESHOLD && breaker.state !== this.states.OPEN) {
          breaker.state = this.states.OPEN;
          breaker.lastStateChange = now;
          Utils.logError('断路器', `${type} 断开`, { failureCount: breaker.failureCount });
        }
        throw error;
      }
    },

    reset(type) {
      this.breakers.delete(type);
    },

    getAllStates() {
      const states = {};
      for (const [type, breaker] of this.breakers) {
        states[type] = {
          state: breaker.state,
          failureCount: breaker.failureCount,
          lastFailureTime: breaker.lastFailureTime,
          lastSuccessTime: breaker.lastSuccessTime
        };
      }
      return states;
    },

    clear() {
      this.breakers.clear();
    }
  };

  // ==================== 消息压缩 ====================
  const Compression = {
    compress(data) {
      if (!CONFIG.ENABLE_COMPRESSION) return data;
      const json = JSON.stringify(data);
      if (json.length < CONFIG.COMPRESSION_MIN_SIZE) return data;
      try {
        return JSON.parse(json.replace(/\s+/g, ' '));
      } catch (e) {
        return data;
      }
    },

    decompress(data) {
      return data;
    }
  };

  // ==================== 消息序列化器 (V5) ====================
  const Serializer = {
    formats: {
      json: {
        serialize: (data) => JSON.stringify(data),
        deserialize: (str) => JSON.parse(str),
        name: 'JSON'
      },
      compact: {
        serialize: (data) => JSON.stringify(data, (key, value) => {
          if (value instanceof Error) return { __error__: true, message: value.message, stack: value.stack };
          if (typeof value === 'function') return { __function__: true, name: value.name || 'anonymous' };
          return value;
        }),
        deserialize: (str) => JSON.parse(str, (key, value) => {
          if (value?.__error__) { const err = new Error(value.message); err.stack = value.stack; return err; }
          if (value?.__function__) return () => {};
          return value;
        }),
        name: 'Compact JSON'
      }
    },
    currentFormat: 'json',

    init() {
      this.currentFormat = CONFIG.SERIALIZATION_FORMAT;
    },

    serialize(data) {
      const format = this.formats[this.currentFormat];
      if (!format) return null;
      try { return format.serialize(data); }
      catch (e) { Utils.logError('Serializer', '序列化失败:', e); return null; }
    },

    deserialize(str) {
      const format = this.formats[this.currentFormat];
      if (!format) return null;
      try { return format.deserialize(str); }
      catch (e) { Utils.logError('Serializer', '反序列化失败:', e); return null; }
    },

    setFormat(format) {
      if (this.formats[format]) {
        this.currentFormat = format;
        Utils.log('Serializer', `格式已切换为: ${this.formats[format].name}`);
      }
    }
  };

  // ==================== 消息验证 ====================
  const Validation = {
    schemas: new Map(),

    register(type, schema) {
      this.schemas.set(type, schema);
    },

    validate(message) {
      if (!CONFIG.ENABLE_VALIDATION) return true;
      const schema = this.schemas.get(message.type);
      if (!schema) return true;

      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in message.data)) throw new Error(`Missing required field: ${field}`);
        }
      }
      return schema.validate ? schema.validate(message.data) : true;
    },

    verify(message) {
      if (!message.from) throw new Error('Missing message source');
      if (!message.__eventbus__) throw new Error('Invalid message format');
      return true;
    },

    clear() {
      this.schemas.clear();
    }
  };

  // ==================== 消息去重 ====================
  const Deduplication = {
    seen: new Map(),
    cleanupTimer: null,
    maxEntries: 5000,

    // 启动定时清理
    startCleanup() {
      if (this.cleanupTimer) return;
      this.cleanupTimer = setInterval(() => this.cleanup(), CONFIG.DEDUPLICATION_WINDOW);
    },

    // 停止定时清理
    stopCleanup() {
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = null;
      }
    },

    // 清理过期记录
    cleanup() {
      const now = Date.now();
      for (const [key, time] of this.seen) {
        if (now - time > CONFIG.DEDUPLICATION_WINDOW) this.seen.delete(key);
      }
    },

    check(message) {
      if (!CONFIG.ENABLE_DEDUPLICATION) return false;

      const key = `${message.type}:${message.from}:${JSON.stringify(message.data)}`;
      const now = Date.now();

      // 超过最大条目时触发清理
      if (this.seen.size > this.maxEntries) this.cleanup();

      if (this.seen.has(key)) {
        const elapsed = now - this.seen.get(key);
        if (elapsed < CONFIG.DEDUPLICATION_WINDOW) return true;
      }

      this.seen.set(key, now);
      return false;
    },

    clear() {
      this.stopCleanup();
      this.seen.clear();
    }
  };

  // ==================== 消息模板系统 (V5) ====================
  const MessageTemplates = {
    templates: {},

    define(name, template) {
      if (!name || typeof name !== 'string') throw new Error('模板名称必须是非空字符串');
      this.templates[name] = {
        name,
        schema: template.schema || {},
        defaults: template.defaults || {},
        validate: template.validate || null,
        transform: template.transform || null,
        metadata: template.metadata || {}
      };
      Utils.log('模板', `已定义: ${name}`);
    },

    create(name, data = {}) {
      const template = this.templates[name];
      if (!template) throw new Error(`模板不存在: ${name}`);

      const message = { __template: name, ...template.defaults, ...data };

      if (template.validate) {
        const errors = template.validate(message);
        if (errors) throw new Error(`模板验证失败: ${errors.join(', ')}`);
      }

      return template.transform ? template.transform(message) : message;
    },

    validate(name, data) {
      const template = this.templates[name];
      if (!template || !template.validate) return true;
      const errors = template.validate(data);
      return !errors || errors.length === 0;
    },

    get(name) {
      return this.templates[name];
    },

    list() {
      return Object.keys(this.templates);
    },

    remove(name) {
      delete this.templates[name];
    },

    clear() {
      this.templates = {};
    }
  };

  // ==================== 插件系统 ====================
  const PluginSystem = {
    plugins: new Map(),
    hooks: {
      beforeSend: [], afterReceive: [], beforeHandler: [], afterHandler: [], onError: [],
      onMessage: [], onResponse: [], onSubscribe: [], onUnsubscribe: []
    },

    register(plugin) {
      if (!plugin?.name) throw new Error('Plugin must have a name');

      this.plugins.set(plugin.name, {
        ...plugin,
        version: plugin.version || '1.0.0',
        enabled: plugin.enabled !== false,
        installedAt: Date.now()
      });

      if (plugin.hooks) {
        for (const [hook, handler] of Object.entries(plugin.hooks)) {
          if (this.hooks[hook]) this.hooks[hook].push({ name: plugin.name, handler });
        }
      }

      plugin.init?.();
      Utils.log('插件', `已注册: ${plugin.name}`);
    },

    unregister(name) {
      const plugin = this.plugins.get(name);
      if (!plugin) return false;
      plugin.cleanup?.();
      for (const hook of Object.keys(this.hooks)) {
        this.hooks[hook] = this.hooks[hook].filter(h => h.name !== name);
      }
      this.plugins.delete(name);
      return true;
    },

    async executeHook(hook, context) {
      if (!this.hooks[hook]) return;
      for (const { name, handler } of this.hooks[hook]) {
        const plugin = this.plugins.get(name);
        if (plugin?.enabled) {
          try { await handler(context); }
          catch (e) { Utils.logError('插件', `${name} 钩子 ${hook} 错误:`, e); }
        }
      }
    },

    enable(name) {
      const plugin = this.plugins.get(name);
      if (plugin) { plugin.enabled = true; plugin.enable?.(); return true; }
      return false;
    },

    disable(name) {
      const plugin = this.plugins.get(name);
      if (plugin) { plugin.enabled = false; plugin.disable?.(); return true; }
      return false;
    },

    getList() {
      return Array.from(this.plugins.values()).map(p => ({
        name: p.name, version: p.version, enabled: p.enabled, installedAt: p.installedAt
      }));
    },

    clear() {
      for (const plugin of this.plugins.values()) plugin.cleanup?.();
      this.plugins.clear();
      for (const hook of Object.keys(this.hooks)) this.hooks[hook] = [];
    }
  };

  // ==================== 持久化队列 ====================
  const Persistence = {
    queue: [],

    async save() {
      if (!CONFIG.ENABLE_PERSISTENCE || !isChromeExtension) return;
      try {
        await chrome.storage.local.set({
          [CONFIG.PERSISTENCE_KEY]: {
            queue: this.queue.slice(-CONFIG.MAX_PERSISTENT_QUEUE),
            timestamp: Date.now()
          }
        });
      } catch (e) { Utils.logError('持久化', '保存失败:', e); }
    },

    async load() {
      if (!CONFIG.ENABLE_PERSISTENCE || !isChromeExtension) return;
      try {
        const result = await chrome.storage.local.get(CONFIG.PERSISTENCE_KEY);
        if (result[CONFIG.PERSISTENCE_KEY]?.queue) {
          this.queue = result[CONFIG.PERSISTENCE_KEY].queue;
          Utils.log('持久化', `已加载 ${this.queue.length} 条消息`);
        }
      } catch (e) { Utils.logError('持久化', '加载失败:', e); }
    },

    async add(message) { this.queue.push(message); await this.save(); },
    async remove(messageId) { this.queue = this.queue.filter(m => m.id !== messageId); await this.save(); },
    async clear() { this.queue = []; isChromeExtension && await chrome.storage.local.remove(CONFIG.PERSISTENCE_KEY); },
    get() { return this.queue; }
  };

  // ==================== 消息录制器 (V5) ====================
  const MessageRecorder = {
    isRecording: false,
    recordedMessages: [],
    startTime: null,
    metadata: {},

    start(metadata = {}) {
      this.isRecording = true;
      this.recordedMessages = [];
      this.startTime = Date.now();
      this.metadata = { ...metadata, startTime: this.startTime, version: '4.5.5' };
      Utils.log('录制器', '开始录制', true);
      DevToolsIntegration.notify('recorder', { event: 'start', metadata: this.metadata });
    },

    stop() {
      if (!this.isRecording) return null;
      this.isRecording = false;
      const recording = {
        metadata: { ...this.metadata, endTime: Date.now(), duration: Date.now() - this.startTime, messageCount: this.recordedMessages.length },
        messages: [...this.recordedMessages]
      };
      Utils.log('录制器', `停止录制: ${recording.messages.length} 条消息`, true);
      DevToolsIntegration.notify('recorder', { event: 'stop', recording });
      return recording;
    },

    record(message) {
      if (!this.isRecording) return;
      this.recordedMessages.push({
        ...message,
        __recordedAt: Date.now(),
        __offset: Date.now() - this.startTime
      });
      if (this.recordedMessages.length > CONFIG.MAX_RECORDED_MESSAGES) this.recordedMessages.shift();
    },

    clear() { this.recordedMessages = []; this.startTime = null; Utils.log('录制器', '已清空'); },
    getRecording() {
      if (this.recordedMessages.length === 0) return null;
      return {
        metadata: { ...this.metadata, endTime: Date.now(), duration: this.startTime ? Date.now() - this.startTime : 0, messageCount: this.recordedMessages.length },
        messages: [...this.recordedMessages]
      };
    },
    export() { const r = this.getRecording(); return r ? Serializer.serialize(r) : null; },
    import(data) {
      try {
        const recording = typeof data === 'string' ? Serializer.deserialize(data) : data;
        this.recordedMessages = recording.messages || [];
        this.metadata = recording.metadata || {};
        this.startTime = this.metadata.startTime || Date.now();
        Utils.log('录制器', `已导入: ${this.recordedMessages.length} 条消息`, true);
        return true;
      } catch (e) { Utils.logError('录制器', '导入失败:', e); return false; }
    }
  };

  // ==================== 健康检查 ====================
  const HealthCheck = {
    timer: null,
    lastCheck: 0,
    status: 'healthy',

    async check() {
      const now = Date.now();
      const results = { timestamp: now, overall: 'healthy', checks: {} };

      // EventBus 状态
      try {
        const state = EventBus.getState();
        results.checks.eventbus = { status: 'healthy', uptime: now - state.startTime, messageCount: state.messageCount, connections: state.connections.length };
      } catch (e) {
        results.checks.eventbus = { status: 'unhealthy', error: e.message };
        results.overall = 'unhealthy';
      }

      // 断路器状态
      try {
        const breakerStates = CircuitBreaker.getAllStates();
        const openBreakers = Object.entries(breakerStates).filter(([_, s]) => s.state === 'open').map(([t]) => t);
        results.checks.circuitBreakers = { status: openBreakers.length === 0 ? 'healthy' : 'degraded', open: openBreakers, total: Object.keys(breakerStates).length };
        if (openBreakers.length > 0) results.overall = 'degraded';
      } catch (e) {
        results.checks.circuitBreakers = { status: 'unhealthy', error: e.message };
        results.overall = 'unhealthy';
      }

      // 存储状态
      if (isChromeExtension) {
        try {
          await chrome.storage.local.get('test');
          results.checks.storage = { status: 'healthy' };
        } catch (e) {
          results.checks.storage = { status: 'unhealthy', error: e.message };
          results.overall = 'unhealthy';
        }
      }

      this.lastCheck = now;
      this.status = results.overall;
      return results;
    },

    start() {
      if (!CONFIG.ENABLE_HEALTH_CHECK || this.timer) return;
      this.timer = setInterval(async () => {
        const results = await this.check();
        Utils.log('健康检查', `${results.overall} ${JSON.stringify(results.checks)}`);
        await EventBus.publish('HEALTH_CHECK_RESULTS', results);
      }, CONFIG.HEALTH_CHECK_INTERVAL);
    },

    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },

    async getHealth() { return await this.check(); }
  };

  // ==================== 消息加密 ====================
  const Encryption = {
    key: null,

    setKey(key) { this.key = key; },

    encrypt(data) {
      if (!CONFIG.ENABLE_ENCRYPTION || !this.key) return data;
      try {
        const json = JSON.stringify(data);
        const encrypted = btoa(encodeURIComponent(json).split('').map((c, i) =>
          String.fromCharCode(c.charCodeAt(0) ^ this.key.charCodeAt(i % this.key.length))
        ).join(''));
        return { __encrypted__: true, data: encrypted };
      } catch (e) { Utils.logError('加密', '失败:', e); return data; }
    },

    decrypt(encryptedData) {
      if (!CONFIG.ENABLE_ENCRYPTION || !this.key || !encryptedData?.__encrypted__) return encryptedData;
      try {
        const decrypted = atob(encryptedData.data).split('').map((c, i) =>
          String.fromCharCode(c.charCodeAt(0) ^ this.key.charCodeAt(i % this.key.length))
        ).join('');
        return JSON.parse(decodeURIComponent(decrypted));
      } catch (e) { Utils.logError('解密', '失败:', e); return encryptedData; }
    }
  };

  // ==================== 性能分析器 ====================
  const Profiler = {
    enabled: false,
    samples: [],
    maxSamples: 10000,

    start() { this.enabled = true; this.samples = []; Utils.log('分析器', '已启动'); },
    stop() { this.enabled = false; Utils.log('分析器', '已停止'); },

    record(operation, duration, metadata = {}) {
      if (!this.enabled) return;
      this.samples.push({ operation, duration, timestamp: Date.now(), ...metadata });
      if (this.samples.length > this.maxSamples) this.samples.shift();
    },

    getReport() {
      const operations = {};
      for (const sample of this.samples) {
        if (!operations[sample.operation]) {
          operations[sample.operation] = { count: 0, totalTime: 0, minTime: Infinity, maxTime: 0 };
        }
        const op = operations[sample.operation];
        op.count++;
        op.totalTime += sample.duration;
        op.minTime = Math.min(op.minTime, sample.duration);
        op.maxTime = Math.max(op.maxTime, sample.duration);
        op.avgTime = op.totalTime / op.count;
      }
      return {
        totalSamples: this.samples.length,
        operations,
        slowestOperations: Object.values(operations).sort((a, b) => b.avgTime - a.avgTime).slice(0, 10)
      };
    },

    clear() { this.samples = []; }
  };

  // ==================== 内存分析器 (V5) ====================
  const MemoryProfiler = {
    enabled: false,
    samples: [],
    timer: null,

    start() {
      if (this.enabled) return;
      this.enabled = true;
      this.samples = [];
      this.timer = setInterval(() => this.sample(), 1000);
      Utils.log('内存分析器', '已启动');
    },

    stop() {
      this.enabled = false;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
      Utils.log('内存分析器', '已停止');
    },

    sample() {
      if (!this.enabled) return;
      const sample = {
        timestamp: Date.now(),
        usedJSHeapSize: performance?.memory?.usedJSHeapSize || null,
        totalJSHeapSize: performance?.memory?.totalJSHeapSize || null,
        messageCount: Tracking.messages.length,
        subscriptionCount: State.subscriptions.size,
        pluginCount: PluginSystem.plugins.size
      };
      this.samples.push(sample);
      if (this.samples.length > CONFIG.MAX_MEMORY_SAMPLES) this.samples.shift();
      DevToolsIntegration.notify('memory', { sample });
    },

    getReport() {
      if (this.samples.length === 0) return { error: '无样本数据' };
      const usedHeaps = this.samples.map(s => s.usedJSHeapSize).filter(Boolean);
      const last = this.samples[this.samples.length - 1];
      return {
        duration: last.timestamp - this.samples[0].timestamp,
        samples: this.samples.length,
        memory: {
          current: usedHeaps[usedHeaps.length - 1],
          peak: usedHeaps.length > 0 ? Math.max(...usedHeaps) : 0,
          average: usedHeaps.length > 0 ? usedHeaps.reduce((a, b) => a + b, 0) / usedHeaps.length : 0,
          trend: usedHeaps.length > 1 ? usedHeaps[usedHeaps.length - 1] - usedHeaps[0] : 0
        },
        messages: { current: last.messageCount, peak: Math.max(...this.samples.map(s => s.messageCount)) },
        subscriptions: { current: last.subscriptionCount }
      };
    },

    reset() { this.samples = []; Utils.log('内存分析器', '已重置'); }
  };

  // ==================== DevTools 集成 (V5) ====================
  const DevToolsIntegration = {
    connected: false,
    port: null,
    messageQueue: [],
    listeners: new Map(),

    connect() {
      if (!isDevTools || this.connected) return;
      try {
        this.port = chrome.runtime.connect({ name: CONFIG.DEVTOOLS_PANEL_ID });
        this.port.onMessage.addListener((msg) => this.handleMessage(msg));
        this.port.onDisconnect.addListener(() => this.disconnect());
        this.connected = true;
        Utils.log('DevTools', '面板已连接', true);
        this.flushQueue();
      } catch (e) { Utils.logError('DevTools', '连接失败:', e.message); }
    },

    disconnect() {
      this.connected = false;
      this.port = null;
      Utils.log('DevTools', '面板已断开', true);
    },

    handleMessage(message) {
      const { type, data } = message;
      const handlers = {
        getState: () => this.sendState(),
        startRecording: () => MessageRecorder.start(data),
        stopRecording: () => this.send('recordingStopped', MessageRecorder.stop()),
        clearRecording: () => MessageRecorder.clear(),
        getRecording: () => this.send('recording', MessageRecorder.getRecording()),
        replay: () => this.replay(data),
        getMemoryReport: () => this.send('memoryReport', MemoryProfiler.getReport()),
        startMemoryProfiler: () => MemoryProfiler.start(),
        stopMemoryProfiler: () => MemoryProfiler.stop(),
        getChart: () => this.sendChart(data?.chartType)
      };
      if (handlers[type]) handlers[type]();
      else this.trigger(type, data);
    },

    send(type, data) {
      const msg = { type, data };
      if (this.connected && this.port) {
        try { this.port.postMessage(msg); }
        catch (e) { this.messageQueue.push(msg); }
      } else { this.messageQueue.push(msg); }
    },

    flushQueue() {
      while (this.messageQueue.length > 0 && this.connected) {
        const msg = this.messageQueue.shift();
        try { this.port.postMessage(msg); }
        catch (e) { this.messageQueue.unshift(msg); break; }
      }
    },

    sendState() {
      this.send('state', {
        config: CONFIG,
        stats: Tracking.getStats(),
        subscriptions: Array.from(State.subscriptions.keys()),
        circuitBreakers: CircuitBreaker.getAllStates(),
        isRecording: MessageRecorder.isRecording,
        memoryEnabled: MemoryProfiler.enabled
      });
    },

    notify(category, data) { this.send('notification', { category, ...data }); },

    on(event, callback) {
      if (!this.listeners.has(event)) this.listeners.set(event, []);
      this.listeners.get(event).push(callback);
    },

    off(event, callback) {
      if (!this.listeners.has(event)) return;
      const idx = this.listeners.get(event).indexOf(callback);
      if (idx > -1) this.listeners.get(event).splice(idx, 1);
    },

    trigger(event, data) {
      if (!this.listeners.has(event)) return;
      this.listeners.get(event).forEach(cb => Utils.safeExecute(() => cb(data)));
    },

    sendChart(chartType) {
      const charts = {
        messages: () => { const s = Tracking.getStats(); return { sent: s.sent, received: s.received, failed: s.failed, timeout: s.timeout }; },
        latency: () => ({ latencies: Tracking.getHistory({ limit: 100 }).filter(m => m.latency).map(m => ({ x: m.timestamp, y: m.latency })) }),
        memory: () => ({ samples: MemoryProfiler.samples.map(s => ({ x: s.timestamp, y: s.usedJSHeapSize })) })
      };
      this.send('chart', { type: chartType, data: charts[chartType]?.() || { error: 'Unknown chart type' } });
    },

    async replay(messages) {
      // 复用 EventBus 的 replay 方法
      await EventBus.replay(messages, { source: 'DevTools' });
    }
  };

  // ==================== 智能错误诊断 (V5) ====================
  const SmartDiagnostics = {
    patterns: [
      { name: 'Timeout Error', pattern: /timeout/i, diagnosis: '请求超时，可能是处理器执行时间过长或消息丢失', suggestion: '检查处理器性能，增加超时时间，或检查消息是否正确路由', severity: 'medium' },
      { name: 'No Handler', pattern: /no handler|no listener/i, diagnosis: '没有找到对应的消息处理器', suggestion: '确保使用 EventBus.on() 或 EventBus.subscribe() 注册了处理器', severity: 'medium' },
      { name: 'Connection Lost', pattern: /port.*closed|connection.*lost/i, diagnosis: '端口连接已断开', suggestion: '检查目标环境是否仍在运行，重新建立连接', severity: 'high' },
      { name: 'Serialization Error', pattern: /circular|clone|serialize/i, diagnosis: '消息包含无法序列化的数据（如循环引用）', suggestion: '简化消息数据结构，避免循环引用或使用不可序列化的对象', severity: 'medium' },
      { name: 'Memory Leak', pattern: /memory|heap/i, diagnosis: '可能的内存泄漏', suggestion: '检查是否有未清理的订阅者，使用 EventBus.clear() 清理', severity: 'high' }
    ],

    diagnose(error) {
      const msg = error.message || String(error);
      const stack = error.stack || '';
      for (const p of this.patterns) {
        if (p.pattern.test(msg) || p.pattern.test(stack)) {
          return { error: msg, pattern: p.name, diagnosis: p.diagnosis, suggestion: p.suggestion, severity: p.severity };
        }
      }
      return { error: msg, pattern: 'Unknown', diagnosis: '未知的错误类型', suggestion: '检查控制台获取更多错误信息', severity: 'medium' };
    },

    analyzeHealth() {
      const stats = Tracking.getStats();
      const failureRate = stats.sent > 0 ? stats.failed / stats.sent : 0;
      const timeoutRate = stats.sent > 0 ? stats.timeout / stats.sent : 0;
      const issues = [];

      if (failureRate > 0.1) issues.push({ severity: 'high', message: `失败率过高: ${(failureRate * 100).toFixed(1)}%`, suggestion: '检查处理器错误处理和异常捕获' });
      if (timeoutRate > 0.05) issues.push({ severity: 'medium', message: `超时率较高: ${(timeoutRate * 100).toFixed(1)}%`, suggestion: '考虑增加超时时间或优化处理器性能' });
      if (Tracking.messages.length > 1000) issues.push({ severity: 'low', message: `消息追踪数量较多: ${Tracking.messages.length}`, suggestion: '定期清理追踪历史或禁用追踪功能' });

      return {
        overall: issues.length === 0 ? 'healthy' : issues.some(i => i.severity === 'high') ? 'unhealthy' : 'degraded',
        issues
      };
    }
  };

  // ==================== 可视化数据生成 (V5) ====================
  const Visualization = {
    generateMessageGraph(messages) {
      const nodes = new Map();
      const links = [];
      messages.forEach(msg => {
        const from = msg.from || 'unknown';
        if (!nodes.has(from)) nodes.set(from, { id: from, count: 0 });
        nodes.get(from).count++;
        if (msg.to) links.push({ from, to: msg.to, type: msg.type });
      });
      return { nodes: Array.from(nodes.values()), links };
    },

    generateTimeline(messages) {
      return messages.map(msg => ({ timestamp: msg.timestamp, type: msg.type, from: msg.from, duration: msg.latency || 0, success: !msg.error }));
    },

    generateHeatmap(messages) {
      const heatmap = new Map();
      messages.forEach(msg => {
        const key = `${new Date(msg.timestamp).getHours()}-${msg.type}`;
        if (!heatmap.has(key)) heatmap.set(key, { hour: new Date(msg.timestamp).getHours(), type: msg.type, count: 0 });
        heatmap.get(key).count++;
      });
      return Array.from(heatmap.values());
    }
  };

  // ==================== 性能追踪 (增强版 V5) ====================
  const PerformanceTracker = {
    metrics: new Map(),
    history: [],

    startOperation(op) {
      this.metrics.set(op, { startTime: performance.now(), endTime: null, duration: null });
    },

    endOperation(op) {
      const m = this.metrics.get(op);
      if (!m) return;
      m.endTime = performance.now();
      m.duration = m.endTime - m.startTime;
      this.history.push({ operation: op, duration: m.duration, timestamp: Date.now() });
      if (this.history.length > CONFIG.PERFORMANCE_HISTORY_SIZE) this.history.shift();
      this.metrics.delete(op);
    },

    getMetrics(op) {
      const opMetrics = this.history.filter(h => h.operation === op);
      if (opMetrics.length === 0) return null;
      const durations = opMetrics.map(h => h.duration);
      const sorted = [...durations].sort((a, b) => a - b);
      return {
        count: durations.length,
        total: durations.reduce((a, b) => a + b, 0),
        average: durations.reduce((a, b) => a + b, 0) / durations.length,
        min: Math.min(...durations),
        max: Math.max(...durations),
        p50: sorted[Math.ceil(0.5 * sorted.length) - 1],
        p95: sorted[Math.ceil(0.95 * sorted.length) - 1],
        p99: sorted[Math.ceil(0.99 * sorted.length) - 1]
      };
    },

    getAllMetrics() {
      const ops = [...new Set(this.history.map(h => h.operation))];
      return ops.map(op => ({ operation: op, ...this.getMetrics(op) }));
    },

    clear() { this.metrics.clear(); this.history = []; }
  };

  // ==================== 状态管理 ====================
  const State = {
    instanceId: Utils.generateId(`${ENV}_`),
    isReady: false,
    connections: new Map(),
    callbacks: new Map(),
    subscriptions: new Map(),
    handlers: new Map(),
    namespaces: new Map(),
    connectionListeners: [],
    startTime: Date.now(),
    messageCount: 0,
    config: { ...CONFIG }
  };

  // ==================== 消息追踪 ====================
  const Tracking = {
    messages: [],
    stats: { sent: 0, received: 0, failed: 0, timeout: 0, retried: 0, compressed: 0 },

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
        compressed: message?.compressed,
        ...data
      });
      if (this.messages.length > CONFIG.MAX_TRACKING_SIZE) this.messages.shift();
    },

    getStats() { return { ...this.stats, trackedMessages: this.messages.length }; },

    getHistory(filter = {}) {
      let h = [...this.messages];
      if (filter.type) h = h.filter(m => m.type === filter.type);
      if (filter.messageType) h = h.filter(m => m.messageType === filter.messageType);
      if (filter.namespace) h = h.filter(m => m.namespace === filter.namespace);
      if (filter.since) h = h.filter(m => m.timestamp >= filter.since);
      if (filter.limit) h = h.slice(-filter.limit);
      return h;
    },

    clear() {
      this.messages = [];
      this.stats = { sent: 0, received: 0, failed: 0, timeout: 0, retried: 0, compressed: 0 };
    }
  };

  // ==================== 中间件系统 ====================
  const Middleware = {
    handlers: [],

    use(middleware) {
      if (typeof middleware !== 'function') throw new Error('Middleware must be a function');
      this.handlers.push(middleware);
    },

    async process(message, next) {
      let idx = 0;
      const dispatch = async (i) => i >= this.handlers.length ? await next() : await this.handlers[i](message, () => dispatch(i + 1));
      return await dispatch(0);
    },

    clear() { this.handlers = []; }
  };

  // ==================== 命名空间 ====================
  const Namespace = {
    join(...parts) {
      return parts.filter(Boolean).join(CONFIG.ENABLE_NAMESPACES ? ':' : '');
    },

    parse(messageType) {
      if (!CONFIG.ENABLE_NAMESPACES) return { namespace: '', base: messageType };
      const parts = messageType.split(':');
      return { namespace: parts.length > 1 ? parts[0] : '', base: parts.length > 1 ? parts.slice(1).join(':') : messageType };
    },

    create(namespace) {
      const self = this;
      return {
        request: (type, data, opts) => EventBus.request(self.join(namespace, type), data, opts),
        publish: (type, data) => EventBus.publish(self.join(namespace, type), data),
        subscribe: (type, cb) => EventBus.subscribe(self.join(namespace, type), cb),
        on: (type, handler) => EventBus.on(self.join(namespace, type), handler),
        once: (type, cb) => EventBus.once(self.join(namespace, type), cb),
        off: (type, cb) => EventBus.off(self.join(namespace, type), cb)
      };
    }
  };

  // ==================== 传输层 ====================
  const Transport = {
    // Port 连接管理（用于 DevTools）
    ports: new Map(), // tabId -> port
    portListeners: [],

    // 注册 Port 连接
    registerPort(tabId, port) {
      this.ports.set(tabId, port);
      port.onDisconnect.addListener(() => {
        this.ports.delete(tabId);
        Utils.log('Transport', `Port 断开: tabId=${tabId}`);
      });
      Utils.log('Transport', `Port 注册: tabId=${tabId}`);
    },

    // 通过 Port 发送消息
    sendViaPort(tabId, message) {
      const port = this.ports.get(tabId);
      if (port) {
        try {
          port.postMessage(message);
          return true;
        } catch (e) {
          this.ports.delete(tabId);
          return false;
        }
      }
      return false;
    },

    // 监听 Port 消息
    onPortMessage(callback) {
      this.portListeners.push(callback);
    },

    async send(target, message) {
      // 优先使用 Port（DevTools 场景）
      if (target?.tabId && this.ports.has(target.tabId)) {
        return this.sendViaPort(target.tabId, message);
      }
      if (ENV === 'content_script') return await chrome.runtime.sendMessage(message);
      if (ENV === 'background') {
        if (target?.tabId) return await chrome.tabs.sendMessage(target.tabId, message);
        return await chrome.runtime.sendMessage(message);
      }
      if (chrome.tabs?.query) {
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs[0]?.id) return await chrome.tabs.sendMessage(tabs[0].id, message);
        } catch (e) {}
      }
      return await chrome.runtime.sendMessage(message);
    },

    async broadcast(message) {
      if (ENV === 'content_script') {
        await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
      } else if (ENV === 'background') {
        // 广播到所有 tabs
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          try { await chrome.tabs.sendMessage(tab.id, message); } catch (e) {}
        }
        // 同时广播到所有 Port
        for (const [tabId, port] of this.ports) {
          try { port.postMessage(message); } catch (e) { this.ports.delete(tabId); }
        }
      } else {
        await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
      }
    },

    onMessage(callback) {
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        const result = callback(msg, sender);
        if (result instanceof Promise) { result.then(sendResponse); return true; }
        if (result !== undefined) { sendResponse(result); return true; }
        return false;
      });
    }
  };

  // ==================== EventBus 核心 ====================
  const EventBus = {
    async init() {
      if (State.isReady) return;

      await Persistence.load();
      HealthCheck.start();
      Serializer.init();

      if (CONFIG.ENABLE_DEVTOOLS_PANEL && isDevTools) DevToolsIntegration.connect();
      if (CONFIG.RECORDING_AUTO_START) MessageRecorder.start({ auto: true });
      if (CONFIG.ENABLE_MEMORY_PROFILING) MemoryProfiler.start();
      if (CONFIG.ENABLE_DEDUPLICATION) Deduplication.startCleanup();

      Transport.onMessage(this._handleMessage.bind(this));
      this._startHeartbeat();
      State.isReady = true;

      setTimeout(() => this.publish(MESSAGE_TYPES.READY, { from: State.instanceId, env: ENV }), 100);

      if (CONFIG.DEBUG_MODE) {
        console.log('[EventBus V4.5.5] 初始化完成', {
          env: ENV, id: State.instanceId,
          features: {
            circuitBreaker: CONFIG.ENABLE_CIRCUIT_BREAKER,
            compression: CONFIG.ENABLE_COMPRESSION,
            validation: CONFIG.ENABLE_VALIDATION,
            deduplication: CONFIG.ENABLE_DEDUPLICATION,
            plugins: CONFIG.ENABLE_PLUGINS,
            persistence: CONFIG.ENABLE_PERSISTENCE,
            healthCheck: CONFIG.ENABLE_HEALTH_CHECK,
            devTools: CONFIG.ENABLE_DEVTOOLS_PANEL,
            memoryProfiling: CONFIG.ENABLE_MEMORY_PROFILING
          }
        });
      }
    },

    async request(type, data = {}, options = {}) {
      if (!type || typeof type !== 'string') throw new Error('消息类型必须是非空字符串');

      const startTime = performance.now();
      return CircuitBreaker.execute(type, async () => {
        await PluginSystem.executeHook('beforeSend', { type, data, options });
        const { timeout = CONFIG.MESSAGE_TIMEOUT, priority = 1, skipValidation = false } = options;
        const messageId = Utils.generateId(`${State.instanceId}_`);

        let processedData = data;
        if (CONFIG.ENABLE_COMPRESSION) {
          const compressed = Compression.compress(data);
          if (compressed !== data) { processedData = compressed; Tracking.stats.compressed++; }
        }

        const message = this._createMessage(messageId, type, processedData, true, priority);
        if (!skipValidation) { Validation.verify(message); Validation.validate(message); }

        Tracking.log('send', message);
        Tracking.stats.sent++;
        Profiler.record('request', 0, { type });
        PerformanceTracker.startOperation(type);
        MessageRecorder.record(message);

        const response = await this._sendWithRetry(message, timeout);

        Profiler.record('request', performance.now() - startTime, { type });
        PerformanceTracker.endOperation(type);
        Tracking.log('receive', { type, duration: performance.now() - startTime });
        Tracking.stats.received++;
        await PluginSystem.executeHook('afterReceive', { type, response });

        return response;
      });
    },

    async publish(type, data = {}) {
      if (!type || typeof type !== 'string') throw new Error('消息类型必须是非空字符串');

      const message = this._createMessage(Utils.generateId(`${State.instanceId}_`), type, data, false);
      Tracking.stats.sent++;
      Tracking.log('send', message);
      MessageRecorder.record(message);
      return this._sendMessage(message);
    },

    async batch(messages) {
      if (!Array.isArray(messages) || messages.length === 0) throw new Error('批量消息必须是非空数组');
      return this._sendMessage({
        __eventbus__: true,
        type: MESSAGE_TYPES.BATCH,
        id: Utils.generateId(`${State.instanceId}_`),
        data: { messages },
        from: State.instanceId,
        fromEnv: ENV,
        timestamp: Date.now()
      });
    },

    subscribe(type, callback) {
      if (!type || typeof type !== 'string') throw new Error('订阅类型必须是非空字符串');
      if (typeof callback !== 'function') throw new Error('回调必须是函数');

      const parsed = Namespace.parse(type);
      if (parsed.namespace) {
        if (!State.namespaces.has(parsed.namespace)) State.namespaces.set(parsed.namespace, new Map());
        const ns = State.namespaces.get(parsed.namespace);
        if (!ns.has('subscriptions')) ns.set('subscriptions', new Map());
        const subs = ns.get('subscriptions');
        if (!subs.has(parsed.base)) subs.set(parsed.base, []);
        subs.get(parsed.base).push(callback);
      } else {
        if (!State.subscriptions.has(type)) State.subscriptions.set(type, []);
        State.subscriptions.get(type).push(callback);
      }

      PluginSystem.executeHook('onSubscribe', { type });
      DevToolsIntegration.notify('subscription', { event: 'added', type });
      return () => this.off(type, callback);
    },

    once(type, callback) {
      const wrapper = (data, source) => { callback(data, source); this.off(type, wrapper); };
      return this.subscribe(type, wrapper);
    },

    // 辅助方法：从数组中移除回调
    _removeCallback(arr, callback) {
      if (!arr) return false;
      if (callback) {
        const idx = arr.indexOf(callback);
        return idx > -1 ? (arr.splice(idx, 1), true) : false;
      }
      return false;
    },

    off(type, callback) {
      const parsed = Namespace.parse(type);
      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns?.has('subscriptions')) {
          const subs = ns.get('subscriptions');
          if (!this._removeCallback(subs.get(parsed.base), callback) && !callback) {
            subs.delete(parsed.base);
          }
        }
      } else if (State.subscriptions.has(type)) {
        if (!this._removeCallback(State.subscriptions.get(type), callback) && !callback) {
          State.subscriptions.delete(type);
        }
      }
      PluginSystem.executeHook('onUnsubscribe', { type });
    },

    on(type, handler) {
      if (!type || typeof type !== 'string') throw new Error('消息类型必须是非空字符串');
      if (typeof handler !== 'function') throw new Error('处理器必须是函数');

      const parsed = Namespace.parse(type);
      if (parsed.namespace) {
        if (!State.namespaces.has(parsed.namespace)) State.namespaces.set(parsed.namespace, new Map());
        State.namespaces.get(parsed.namespace).set(parsed.base, handler);
      } else {
        State.handlers.set(type, handler);
      }
    },

    removeHandler(type) {
      const parsed = Namespace.parse(type);
      if (parsed.namespace) {
        State.namespaces.get(parsed.namespace)?.delete(parsed.base);
      } else {
        State.handlers.delete(type);
      }
    },

    use(middleware) { Middleware.use(middleware); },
    namespace(name) { return Namespace.create(name); },

    // V4 API
    resetCircuitBreaker(type) { CircuitBreaker.reset(type); },
    getCircuitBreakerState(type) { return CircuitBreaker.getState(type); },
    getAllCircuitBreakerStates() { return CircuitBreaker.getAllStates(); },
    registerSchema(type, schema) { Validation.register(type, schema); },
    registerPlugin(plugin) { PluginSystem.register(plugin); },
    unregisterPlugin(name) { return PluginSystem.unregister(name); },
    enablePlugin(name) { return PluginSystem.enable(name); },
    disablePlugin(name) { return PluginSystem.disable(name); },
    getPlugins() { return PluginSystem.getList(); },
    async saveQueue() { await Persistence.save(); },
    async loadQueue() { await Persistence.load(); },
    async clearQueue() { await Persistence.clear(); },
    getQueue() { return Persistence.get(); },
    async getHealth() { return await HealthCheck.getHealth(); },
    startProfiler() { Profiler.start(); },
    stopProfiler() { Profiler.stop(); },
    getProfilerReport() { return Profiler.getReport(); },
    configure(options) { Object.assign(CONFIG, options); State.config = { ...CONFIG, ...options }; },
    getConfig() { return { ...State.config }; },
    setEncryptionKey(key) { Encryption.setKey(key); },

    onConnectionChange(callback) {
      State.connectionListeners.push(callback);
      return () => {
        const idx = State.connectionListeners.indexOf(callback);
        if (idx > -1) State.connectionListeners.splice(idx, 1);
      };
    },

    clear() {
      State.subscriptions.clear();
      State.handlers.clear();
      State.namespaces.clear();
      State.callbacks.forEach(cb => clearTimeout(cb.timeout));
      State.callbacks.clear();
      Tracking.clear();
      Middleware.clear();
      CircuitBreaker.clear();
      Profiler.clear();
      MessageRecorder.clear();
      MemoryProfiler.reset();
      Deduplication.clear();
      Validation.clear();
      PerformanceTracker.clear();
      HealthCheck.stop();
      CONFIG.DEBUG_MODE && console.log('[EventBus V4.5.5] 已清理');
      DevToolsIntegration.notify('subscription', { event: 'cleared' });
    },

    // 完全销毁 EventBus（包括停止所有定时器）
    destroy() {
      // 停止心跳
      if (this._heartbeatTimer) {
        clearInterval(this._heartbeatTimer);
        this._heartbeatTimer = null;
      }
      // 停止内存分析器
      MemoryProfiler.stop();
      // 断开 DevTools
      DevToolsIntegration.disconnect();
      // 执行清理
      this.clear();
      // 重置状态
      State.isReady = false;
      State.connections.clear();
      State.connectionListeners = [];
      PluginSystem.clear();
      MessageTemplates.clear();
      Utils.log('EventBus V4.5.5', '已销毁');
    },

    getState() {
      return {
        env: ENV, instanceId: State.instanceId, isReady: State.isReady,
        connections: Array.from(State.connections.keys()),
        subscriptions: Array.from(State.subscriptions.keys()),
        handlers: Array.from(State.handlers.keys()),
        namespaces: Array.from(State.namespaces.keys()),
        uptime: Date.now() - State.startTime, messageCount: State.messageCount,
        config: State.config, stats: Tracking.getStats(),
        circuitBreakers: CircuitBreaker.getAllStates(),
        plugins: PluginSystem.getList(), version: '4.5.5'
      };
    },

    getStats() {
      return { ...Tracking.getStats(), circuitBreakers: CircuitBreaker.getAllStates(), plugins: PluginSystem.getList().length };
    },
    getHistory(filter) { return Tracking.getHistory(filter); },
    setDebugMode(enabled) { CONFIG.DEBUG_MODE = enabled; CONFIG.ENABLE_TRACKING = enabled; },

    // V5 新增 API
    connectDevTools() { DevToolsIntegration.connect(); },
    disconnectDevTools() { DevToolsIntegration.disconnect(); },
    startRecording(metadata) { MessageRecorder.start(metadata); },
    stopRecording() { return MessageRecorder.stop(); },
    getRecording() { return MessageRecorder.getRecording(); },
    clearRecording() { MessageRecorder.clear(); },
    exportRecording() { return MessageRecorder.export(); },
    importRecording(data) { return MessageRecorder.import(data); },

    async replay(messages, options = {}) {
      if (!Array.isArray(messages)) throw new Error('回放消息必须是数组');
      const { speed = 1 } = options;
      Utils.log('回放', `开始回放 ${messages.length} 条消息`, true);
      for (const msg of messages) {
        if (msg.__offset) await new Promise(r => setTimeout(r, msg.__offset / speed));
        try {
          msg.requestType ? await this.request(msg.requestType, msg.data) : await this.publish(msg.type, msg.data);
        } catch (e) { Utils.logError('回放', '消息失败:', e); }
      }
      Utils.log('回放', '完成', true);
    },

    startMemoryProfiler() { MemoryProfiler.start(); },
    stopMemoryProfiler() { MemoryProfiler.stop(); },
    getMemoryReport() { return MemoryProfiler.getReport(); },
    getPerformanceMetrics(operation) { return operation ? PerformanceTracker.getMetrics(operation) : PerformanceTracker.getAllMetrics(); },
    getHealthAnalysis() { return SmartDiagnostics.analyzeHealth(); },
    defineTemplate(name, template) { MessageTemplates.define(name, template); },
    createMessage(templateName, data) { return MessageTemplates.create(templateName, data); },
    listTemplates() { return MessageTemplates.list(); },
    setSerializationFormat(format) { Serializer.setFormat(format); },

    getVisualization(type) {
      const messages = Tracking.getHistory({ limit: CONFIG.MAX_DISPLAY_MESSAGES });
      const generators = { graph: Visualization.generateMessageGraph, timeline: Visualization.generateTimeline, heatmap: Visualization.generateHeatmap };
      if (!generators[type]) throw new Error(`未知的可视化类型: ${type}`);
      return generators[type](messages);
    },

    getSnapshot() {
      return {
        timestamp: Date.now(), state: this.getState(), stats: this.getStats(),
        performance: this.getPerformanceMetrics(), memory: MemoryProfiler.getReport(),
        health: this.getHealthAnalysis()
      };
    },

    // 暴露 Transport 供外部使用
    Transport,

    // ==================== 内部方法 ====================
    _createMessage(id, type, data, expectResponse, priority) {
      return {
        __eventbus__: true, id, type, data,
        from: State.instanceId, fromEnv: ENV,
        timestamp: Date.now(), expectResponse, priority
      };
    },

    // 统一错误诊断处理
    _handleError(error, context = {}) {
      CONFIG.DEBUG_MODE && console.error('[EventBus] 错误:', error, context);
      if (CONFIG.ENABLE_SMART_ERRORS) {
        const diagnosis = SmartDiagnostics.diagnose(error);
        console.error('[EventBus] 错误诊断:', diagnosis);
        DevToolsIntegration.notify('error', { error: error.message || String(error), diagnosis, ...context });
      }
    },

    _sendWithRetry(message, timeout) {
      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          State.callbacks.delete(message.id);
          Tracking.stats.timeout++;
          Tracking.log('timeout', message);
          const error = new Error(`Message timeout: ${message.type}`);
          this._handleError(error, { type: message.type });
          reject(error);
        }, timeout);

        State.callbacks.set(message.id, {
          resolve: (data) => { clearTimeout(timeoutId); Tracking.stats.received++; resolve(data); },
          reject, timeoutId
        });
        this._sendMessage(message).catch(reject);
      });
    },

    async _sendMessage(message) {
      try {
        await Middleware.process(message, async () => await Transport.broadcast(message));
      } catch (error) {
        Tracking.stats.failed++;
        await PluginSystem.executeHook('onError', { message, error });
        this._handleError(error, { type: message.type });
        throw error;
      }
    },

    async _handleMessage(message, sender) {
      if (!message?.__eventbus__ || message.from === State.instanceId) return false;

      // 消息去重
      if (Deduplication.check(message)) return null;

      Tracking.log('receive', message);
      Tracking.stats.received++;
      await PluginSystem.executeHook('onMessage', { message, sender });

      // 系统消息处理
      const systemHandlers = {
        [MESSAGE_TYPES.PING]: () => ({ type: MESSAGE_TYPES.PONG, from: State.instanceId }),
        [MESSAGE_TYPES.PONG]: () => { this._handlePong(message); return null; },
        [MESSAGE_TYPES.READY]: () => { this._handleReady(message); return null; },
        [MESSAGE_TYPES.RESPONSE]: () => { this._handleResponse(message); return null; },
        [MESSAGE_TYPES.BATCH]: () => this._handleBatch(message),
        [MESSAGE_TYPES.HEALTH_CHECK]: () => HealthCheck.check(),
        [MESSAGE_TYPES.SNAPSHOT]: () => this.getSnapshot()
      };

      if (systemHandlers[message.type]) return await systemHandlers[message.type]();

      // 查找处理器
      const parsed = Namespace.parse(message.type);
      let handler = null;
      let subscribers = [];

      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns) {
          handler = ns.get(parsed.base);
          if (ns.has('subscriptions')) {
            const subs = ns.get('subscriptions');
            if (subs?.has(parsed.base)) subscribers = subs.get(parsed.base);
          }
        }
      } else {
        handler = State.handlers.get(message.type);
        subscribers = State.subscriptions.get(message.type) || [];
      }

      await PluginSystem.executeHook('beforeHandler', { message, handler, subscribers });
      MessageRecorder.record(message);

      if (handler && message.expectResponse) {
        const startTime = performance.now();
        try {
          const response = await handler(message.data, { from: message.from, fromEnv: message.fromEnv });
          Profiler.record('handler', performance.now() - startTime, { type: message.type });
          await PluginSystem.executeHook('afterHandler', { message, response });
          await PluginSystem.executeHook('onResponse', { message, response });
          return { __eventbus__: true, id: message.id, type: MESSAGE_TYPES.RESPONSE, data: response, from: State.instanceId };
        } catch (error) {
          Tracking.stats.failed++;
          await PluginSystem.executeHook('onError', { message, error });
          this._handleError(error, { type: message.type, handler: true });
          throw error;
        }
      }

      // 触发订阅者
      for (const callback of subscribers) {
        try { await callback(message.data, { from: message.from, fromEnv: message.fromEnv }); }
        catch (e) { CONFIG.DEBUG_MODE && console.error('[EventBus] 订阅者错误:', e); }
      }
      return null;
    },

    _handleBatch(message) {
      const results = [];
      for (const msg of message.data.messages) {
        try { results.push({ success: true, result: this._handleMessage({ ...msg, __batched__: true }, message) }); }
        catch (e) { results.push({ success: false, error: e.message }); }
      }
      return { __eventbus__: true, results };
    },

    _handlePong(msg) {
      State.connections.set(msg.from, { lastSeen: Date.now(), env: msg.fromEnv });
      this._notifyConnectionChange(msg.from, CONNECTION_STATUS.CONNECTED);
    },

    _handleReady(msg) {
      State.connections.set(msg.from, { ready: true, lastSeen: Date.now(), env: msg.fromEnv });
      this._notifyConnectionChange(msg.from, CONNECTION_STATUS.READY);
    },

    _handleResponse(msg) {
      const callback = State.callbacks.get(msg.id);
      if (callback) {
        clearTimeout(callback.timeout);
        State.callbacks.delete(msg.id);
        callback.resolve(msg.data);
      }
    },

    _notifyConnectionChange(id, status) {
      for (const listener of State.connectionListeners) {
        Utils.safeExecute(() => listener(id, status, State.connections.get(id)));
      }
    },

    _heartbeatTimer: null,
    _startHeartbeat() {
      if (typeof window === 'undefined') return;
      this._heartbeatTimer = setInterval(() => {
        this.publish(MESSAGE_TYPES.HEARTBEAT, {});
        const now = Date.now();
        for (const [id, conn] of State.connections) {
          if (now - conn.lastSeen > CONFIG.HEARTBEAT_INTERVAL * 2) {
            State.connections.delete(id);
            this._notifyConnectionChange(id, CONNECTION_STATUS.DISCONNECTED);
          }
        }
      }, CONFIG.HEARTBEAT_INTERVAL);
    }
  };

  // 导出到全局
  globalThis.EventBus = EventBus;

  // 自动初始化
  if (typeof document !== 'undefined') {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', () => EventBus.init())
      : EventBus.init();
  } else {
    EventBus.init();
  }

  // ES6 模块导出支持
  if (typeof module !== 'undefined' && module.exports) module.exports = EventBus;

  CONFIG.DEBUG_MODE && console.log('[EventBus V4.5.5] 模块已加载');
})();
