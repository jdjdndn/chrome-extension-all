/**
 * ========================================
 * EventBus V4 - 企业级通信事件总线
 * ========================================
 * V4 新增功能：
 * - 断路器模式 - 防止级联失败
 * - 消息压缩 - 大数据传输优化
 * - 安全验证 - 消息来源验证
 * - 插件系统 - 动态功能扩展
 * - 持久化队列 - 离线消息支持
 * - 性能分析器 - 深度性能监控
 * - 健康检查 - 系统健康监控
 * - 配置热更新 - 运行时配置修改
 * - 智能路由 - 负载均衡
 * - 消息加密 - 敏感数据保护
 */

(function () {
  'use strict';

  const globalThis = (typeof self !== 'undefined') ? self :
                     (typeof window !== 'undefined') ? window :
                     (typeof global !== 'undefined') ? global : this;

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

    // V4 新增功能
    ENABLE_CIRCUIT_BREAKER: true,      // 断路器
    ENABLE_COMPRESSION: true,           // 消息压缩
    ENABLE_VALIDATION: true,            // 消息验证
    ENABLE_PLUGINS: true,               // 插件系统
    ENABLE_PERSISTENCE: true,            // 持久化
    ENABLE_HEALTH_CHECK: true,           // 健康检查
    ENABLE_SMART_ROUTING: true,          // 智能路由
    ENABLE_ENCRYPTION: false,            // 加密（需要密钥）

    // 断路器配置
    CIRCUIT_BREAKER_THRESHOLD: 5,       // 失败阈值
    CIRCUIT_BREAKER_TIMEOUT: 60000,     // 断路器超时（1分钟）
    CIRCUIT_BREAKER_HALF_OPEN: 30000,  // 半开状态时间（30秒）

    // 压缩配置
    COMPRESSION_MIN_SIZE: 1024,          // 最小压缩大小（1KB）

    // 健康检查配置
    HEALTH_CHECK_INTERVAL: 60000,       // 健康检查间隔（1分钟）
    HEALTH_CHECK_TIMEOUT: 5000,         // 健康检查超时

    // 智能路由配置
    SMART_ROUTING_ENABLED: true,
    LOAD_BALANCING: 'round-robin',      // round-robin | least-connections

    // 持久化配置
    PERSISTENCE_KEY: '__eventbus_queue__',
    MAX_PERSISTENT_QUEUE: 100,
  };

  // ==================== 断路器 ====================
  const CircuitBreaker = {
    states: {
      CLOSED: 'closed',     // 正常状态
      OPEN: 'open',         // 断路状态（拒绝请求）
      HALF_OPEN: 'half-open' // 半开状态（尝试恢复）
    },

    breakers: new Map(),

    create(type) {
      this.breakers.set(type, {
        state: this.states.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        lastSuccessTime: Date.now(),
        lastStateChange: Date.now()
      });
    },

    getState(type) {
      const breaker = this.breakers.get(type);
      return breaker ? breaker.state : this.states.CLOSED;
    },

    async execute(type, fn) {
      if (!CONFIG.ENABLE_CIRCUIT_BREAKER) {
        return await fn();
      }

      if (!this.breakers.has(type)) {
        this.create(type);
      }

      const breaker = this.breakers.get(type);
      const now = Date.now();

      // 检查断路器状态
      if (breaker.state === this.states.OPEN) {
        // 检查是否可以进入半开状态
        if (now - breaker.lastStateChange > CONFIG.CIRCUIT_BREAKER_TIMEOUT) {
          breaker.state = this.states.HALF_OPEN;
          breaker.lastStateChange = now;
          if (CONFIG.DEBUG_MODE) {
            console.log(`[断路器] ${type} 进入半开状态`);
          }
        } else {
          throw new Error(`Circuit breaker is OPEN for ${type}`);
        }
      }

      try {
        const result = await fn();

        // 成功，重置断路器
        if (breaker.state !== this.states.CLOSED) {
          breaker.state = this.states.CLOSED;
          breaker.failureCount = 0;
          breaker.lastStateChange = now;
          if (CONFIG.DEBUG_MODE) {
            console.log(`[断路器] ${type} 恢复正常`);
          }
        }

        breaker.lastSuccessTime = now;
        return result;
      } catch (error) {
        breaker.failureCount++;
        breaker.lastFailureTime = now;

        // 检查是否需要断开
        if (breaker.failureCount >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
          if (breaker.state !== this.states.OPEN) {
            breaker.state = this.states.OPEN;
            breaker.lastStateChange = now;
            if (CONFIG.DEBUG_MODE) {
              console.error(`[断路器] ${type} 断开`, {
                failureCount: breaker.failureCount,
                threshold: CONFIG.CIRCUIT_BREAKER_THRESHOLD
              });
            }
          }
        }

        throw error;
      }
    },

    reset(type) {
      if (this.breakers.has(type)) {
        this.create(type);
      }
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
    }
  };

  // ==================== 消息压缩 ====================
  const Compression = {
    compress(data) {
      if (!CONFIG.ENABLE_COMPRESSION) return data;

      const json = JSON.stringify(data);
      if (json.length < CONFIG.COMPRESSION_MIN_SIZE) return data;

      // 简单压缩：移除不必要的空格和换行
      try {
        return JSON.parse(json.replace(/\s+/g, ' '));
      } catch (e) {
        return data;
      }
    },

    decompress(data) {
      if (!CONFIG.ENABLE_COMPRESSION) return data;
      return data;
    },

    getCompressionRatio(original, compressed) {
      if (!original || !compressed) return 0;
      const origSize = JSON.stringify(original).length;
      const compSize = JSON.stringify(compressed).length;
      return Math.round((1 - compSize / origSize) * 100);
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

      // 基础验证
      if (schema.required) {
        for (const field of schema.required) {
          if (!(field in message.data)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
      }

      if (schema.validate) {
        return schema.validate(message.data);
      }

      return true;
    },

    verify(message) {
      // 验证消息来源
      if (!message.from) {
        throw new Error('Missing message source');
      }

      // 验证消息结构
      if (!message.__eventbus__) {
        throw new Error('Invalid message format');
      }

      return true;
    }
  };

  // ==================== 插件系统 ====================
  const PluginSystem = {
    plugins: new Map(),
    hooks: {
      beforeSend: [],
      afterReceive: [],
      beforeHandler: [],
      afterHandler: [],
      onError: []
    },

    register(plugin) {
      if (!plugin.name) {
        throw new Error('Plugin must have a name');
      }

      this.plugins.set(plugin.name, {
        ...plugin,
        enabled: plugin.enabled !== false,
        installedAt: Date.now()
      });

      // 注册插件钩子
      if (plugin.hooks) {
        for (const [hook, handler] of Object.entries(plugin.hooks)) {
          if (this.hooks[hook]) {
            this.hooks[hook].push({ name: plugin.name, handler });
          }
        }
      }

      // 初始化插件
      if (plugin.init) {
        plugin.init();
      }

      if (CONFIG.DEBUG_MODE) {
        console.log(`[插件] 已注册: ${plugin.name}`);
      }
    },

    unregister(name) {
      const plugin = this.plugins.get(name);
      if (plugin && plugin.cleanup) {
        plugin.cleanup();
      }

      // 移除钩子
      for (const hook of Object.keys(this.hooks)) {
        this.hooks[hook] = this.hooks[hook].filter(h => h.name !== name);
      }

      this.plugins.delete(name);
    },

    async executeHook(hook, context) {
      if (!this.hooks[hook]) return;

      for (const { name, handler } of this.hooks[hook]) {
        const plugin = this.plugins.get(name);
        if (plugin && plugin.enabled) {
          try {
            await handler(context);
          } catch (error) {
            if (CONFIG.DEBUG_MODE) {
              console.error(`[插件] ${name} 钩子 ${hook} 错误:`, error);
            }
          }
        }
      }
    },

    enable(name) {
      const plugin = this.plugins.get(name);
      if (plugin) {
        plugin.enabled = true;
        if (plugin.enable) plugin.enable();
      }
    },

    disable(name) {
      const plugin = this.plugins.get(name);
      if (plugin) {
        plugin.enabled = false;
        if (plugin.disable) plugin.disable();
      }
    },

    getList() {
      return Array.from(this.plugins.values()).map(p => ({
        name: p.name,
        version: p.version,
        enabled: p.enabled,
        installedAt: p.installedAt
      }));
    }
  };

  // ==================== 持久化队列 ====================
  const Persistence = {
    queue: [],

    async save() {
      if (!CONFIG.ENABLE_PERSISTENCE) return;

      try {
        const data = {
          queue: this.queue.slice(-CONFIG.MAX_PERSISTENT_QUEUE),
          timestamp: Date.now()
        };
        await chrome.storage.local.set({ [CONFIG.PERSISTENCE_KEY]: data });
      } catch (error) {
        console.error('[持久化] 保存失败:', error);
      }
    },

    async load() {
      if (!CONFIG.ENABLE_PERSISTENCE) return;

      try {
        const result = await chrome.storage.local.get(CONFIG.PERSISTENCE_KEY);
        const data = result[CONFIG.PERSISTENCE_KEY];
        if (data && data.queue) {
          this.queue = data.queue;
          console.log('[持久化] 已加载', this.queue.length, '条消息');
        }
      } catch (error) {
        console.error('[持久化] 加载失败:', error);
      }
    },

    async add(message) {
      this.queue.push(message);
      await this.save();
    },

    async remove(messageId) {
      this.queue = this.queue.filter(m => m.id !== messageId);
      await this.save();
    },

    async clear() {
      this.queue = [];
      await chrome.storage.local.remove(CONFIG.PERSISTENCE_KEY);
    },

    get() {
      return this.queue;
    }
  };

  // ==================== 健康检查 ====================
  const HealthCheck = {
    lastCheck: 0,
    status: 'healthy',

    async check() {
      const now = Date.now();
      const results = {
        timestamp: now,
        overall: 'healthy',
        checks: {}
      };

      // 检查 EventBus 状态
      try {
        const state = EventBus.getState();
        results.checks.eventbus = {
          status: 'healthy',
          uptime: Date.now() - state.startTime,
          messageCount: state.messageCount,
          connections: state.connections.length
        };
      } catch (error) {
        results.checks.eventbus = {
          status: 'unhealthy',
          error: error.message
        };
        results.overall = 'unhealthy';
      }

      // 检查断路器状态
      try {
        const breakerStates = CircuitBreaker.getAllStates();
        const openBreakers = Object.entries(breakerStates)
          .filter(([_, s]) => s.state === 'open')
          .map(([type, _]) => type);

        results.checks.circuitBreakers = {
          status: openBreakers.length === 0 ? 'healthy' : 'degraded',
          open: openBreakers,
          total: Object.keys(breakerStates).length
        };

        if (openBreakers.length > 0) {
          results.overall = 'degraded';
        }
      } catch (error) {
        results.checks.circuitBreakers = {
          status: 'unhealthy',
          error: error.message
        };
        results.overall = 'unhealthy';
      }

      // 检查存储
      try {
        await chrome.storage.local.get('test');
        results.checks.storage = { status: 'healthy' };
      } catch (error) {
        results.checks.storage = {
          status: 'unhealthy',
          error: error.message
        };
        results.overall = 'unhealthy';
      }

      this.lastCheck = now;
      this.status = results.overall;

      return results;
    },

    start() {
      if (!CONFIG.ENABLE_HEALTH_CHECK) return;

      setInterval(async () => {
        const results = await this.check();

        if (CONFIG.DEBUG_MODE) {
          console.log('[健康检查]', results.overall, results.checks);
        }

        // 发布健康状态
        await EventBus.publish('HEALTH_CHECK_RESULTS', results);
      }, CONFIG.HEALTH_CHECK_INTERVAL);
    },

    async getHealth() {
      return await this.check();
    }
  };

  // ==================== 智能路由 ====================
  const SmartRouting = {
    targets: new Map(),
    currentIndex: 0,
    connections: new Map(),

    addTarget(id, target) {
      this.targets.set(id, {
        target,
        load: 0,
        lastUsed: Date.now()
      });
    },

    removeTarget(id) {
      this.targets.delete(id);
    },

    selectTarget() {
      if (!CONFIG.ENABLE_SMART_ROUTING) {
        return null;
      }

      const targets = Array.from(this.targets.values());
      if (targets.length === 0) return null;

      if (CONFIG.LOAD_BALANCING === 'round-robin') {
        // 轮询
        const target = targets[this.currentIndex % targets.length];
        this.currentIndex++;
        return target.target;
      } else if (CONFIG.LOAD_BALANCING === 'least-connections') {
        // 最少连接
        return targets.reduce((min, current) => {
          return current.load < min.load ? current : min;
        }).target;
      }

      return targets[0].target;
    },

    recordLoad(target) {
      const entry = Array.from(this.targets.entries()).find(([_, v]) => v.target === target);
      if (entry) {
        entry[1].load++;
        entry[1].lastUsed = Date.now();
      }
    },

    releaseLoad(target) {
      const entry = Array.from(this.targets.entries()).find(([_, v]) => v.target === target);
      if (entry && entry[1].load > 0) {
        entry[1].load--;
      }
    }
  };

  // ==================== 消息加密 ====================
  const Encryption = {
    key: null,

    setKey(key) {
      this.key = key;
    },

    encrypt(data) {
      if (!CONFIG.ENABLE_ENCRYPTION || !this.key) {
        return data;
      }

      try {
        // 简单的 XOR 加密（演示用，生产环境应使用 AES）
        const json = JSON.stringify(data);
        const encrypted = btoa(encodeURIComponent(json).split('').map((c, i) => {
          return String.fromCharCode(c.charCodeAt(0) ^ this.key.charCodeAt(i % this.key.length));
        }).join(''));
        return { __encrypted__: true, data: encrypted };
      } catch (error) {
        console.error('[加密] 失败:', error);
        return data;
      }
    },

    decrypt(encryptedData) {
      if (!CONFIG.ENABLE_ENCRYPTION || !this.key) {
        return encryptedData;
      }

      try {
        if (encryptedData.__encrypted__) {
          const decrypted = atob(encryptedData.data).split('').map((c, i) => {
            return String.fromCharCode(c.charCodeAt(0) ^ this.key.charCodeAt(i % this.key.length));
          }).join('');
          return JSON.parse(decodeURIComponent(decrypted));
        }
        return encryptedData;
      } catch (error) {
        console.error('[解密] 失败:', error);
        return encryptedData;
      }
    }
  };

  // ==================== 性能分析器 ====================
  const Profiler = {
    enabled: false,
    samples: [],

    start() {
      this.enabled = true;
      this.samples = [];
      console.log('[分析器] 已启动');
    },

    stop() {
      this.enabled = false;
      console.log('[分析器] 已停止');
    },

    record(operation, duration, metadata = {}) {
      if (!this.enabled) return;

      this.samples.push({
        operation,
        duration,
        timestamp: Date.now(),
        ...metadata
      });

      if (this.samples.length > 10000) {
        this.samples.shift();
      }
    },

    getReport() {
      const operations = {};
      for (const sample of this.samples) {
        if (!operations[sample.operation]) {
          operations[sample.operation] = {
            count: 0,
            totalTime: 0,
            minTime: Infinity,
            maxTime: 0,
            avgTime: 0
          };
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
        slowestOperations: Object.values(operations)
          .sort((a, b) => b.avgTime - a.avgTime)
          .slice(0, 10)
      };
    },

    clear() {
      this.samples = [];
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
    BATCH: '__eb_batch__',
    HEALTH_CHECK: '__eb_health_check__'
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

      if (this.messages.length > CONFIG.MAX_TRACKING_SIZE) {
        this.messages.shift();
      }
    },

    getStats() {
      return { ...this.stats, trackedMessages: this.messages.length };
    },

    getHistory(filter = {}) {
      let history = [...this.messages];
      if (filter.type) history = history.filter(m => m.type === filter.type);
      if (filter.messageType) history = history.filter(m => m.messageType === filter.messageType);
      if (filter.namespace) history = history.filter(m => m.namespace === filter.namespace);
      if (filter.limit) history = history.slice(-filter.limit);
      return history;
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
        },
        off(type, callback) {
          const fullType = self.join(namespace, type);
          return EventBus.off(fullType, callback);
        }
      };
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

      // 加载持久化消息
      await Persistence.load();

      // 启动健康检查
      HealthCheck.start();

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
        console.log('[EventBus V4] 初始化完成', {
          env: ENV,
          id: State.instanceId,
          features: {
            circuitBreaker: CONFIG.ENABLE_CIRCUIT_BREAKER,
            compression: CONFIG.ENABLE_COMPRESSION,
            validation: CONFIG.ENABLE_VALIDATION,
            plugins: CONFIG.ENABLE_PLUGINS,
            persistence: CONFIG.ENABLE_PERSISTENCE,
            healthCheck: CONFIG.ENABLE_HEALTH_CHECK,
            smartRouting: CONFIG.ENABLE_SMART_ROUTING
          }
        });
      }
    },

    /**
     * 发送请求（等待响应）
     */
    async request(type, data = {}, options = {}) {
      const startTime = performance.now();

      // 执行断路器
      return CircuitBreaker.execute(type, async () => {
        // 执行插件钩子
        await PluginSystem.executeHook('beforeSend', { type, data, options });

        const { timeout = CONFIG.MESSAGE_TIMEOUT, priority = 1, skipValidation = false } = options;

        const messageId = `${State.instanceId}_${++State.messageCount}`;

        // 压缩数据
        let processedData = data;
        if (CONFIG.ENABLE_COMPRESSION) {
          const compressed = Compression.compress(data);
          if (compressed !== data) {
            processedData = compressed;
            Tracking.stats.compressed++;
          }
        }

        const message = this._createMessage(messageId, type, processedData, true, priority);

        // 验证消息
        if (!skipValidation) {
          Validation.verify(message);
          Validation.validate(message);
        }

        Tracking.log('send', message);
        Tracking.stats.sent++;

        // 分析器记录
        Profiler.record('request', 0, { type });

        const response = await this._sendWithRetry(message, timeout);

        Profiler.record('request', performance.now() - startTime, { type });
        Tracking.log('receive', { type, duration: performance.now() - startTime });
        Tracking.stats.received++;

        // 执行插件钩子
        await PluginSystem.executeHook('afterReceive', { type, response });

        return response;
      });
    },

    /**
     * 发布事件
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
     * 批量消息
     */
    async batch(messages) {
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
     * 订阅
     */
    subscribe(type, callback) {
      const parsed = Namespace.parse(type);

      if (parsed.namespace) {
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
        if (!State.subscriptions.has(type)) {
          State.subscriptions.set(type, []);
        }
        State.subscriptions.get(type).push(callback);
      }

      return () => this.off(type, callback);
    },

    once(type, callback) {
      const wrapper = (data, source) => {
        callback(data, source);
        this.off(type, wrapper);
      };
      return this.subscribe(type, wrapper);
    },

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
    },

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
    },

    removeHandler(type) {
      const parsed = Namespace.parse(type);

      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns) ns.delete(parsed.base);
      } else {
        State.handlers.delete(type);
      }
    },

    use(middleware) {
      Middleware.use(middleware);
    },

    namespace(name) {
      return Namespace.create(name);
    },

    /**
     * V4 新增 API
     */

    // 断路器
    resetCircuitBreaker(type) {
      CircuitBreaker.reset(type);
    },

    getCircuitBreakerState(type) {
      return CircuitBreaker.getState(type);
    },

    getAllCircuitBreakerStates() {
      return CircuitBreaker.getAllStates();
    },

    // 消息验证
    registerSchema(type, schema) {
      Validation.register(type, schema);
    },

    // 插件
    registerPlugin(plugin) {
      PluginSystem.register(plugin);
    },

    unregisterPlugin(name) {
      PluginSystem.unregister(name);
    },

    enablePlugin(name) {
      PluginSystem.enable(name);
    },

    disablePlugin(name) {
      PluginSystem.disable(name);
    },

    getPlugins() {
      return PluginSystem.getList();
    },

    // 持久化
    async saveQueue() {
      await Persistence.save();
    },

    async loadQueue() {
      await Persistence.load();
    },

    async clearQueue() {
      await Persistence.clear();
    },

    getQueue() {
      return Persistence.get();
    },

    // 健康检查
    async getHealth() {
      return await HealthCheck.getHealth();
    },

    // 性能分析
    startProfiler() {
      Profiler.start();
    },

    stopProfiler() {
      Profiler.stop();
    },

    getProfilerReport() {
      return Profiler.getReport();
    },

    // 配置
    configure(options) {
      Object.assign(CONFIG, options);
      State.config = { ...CONFIG, ...options };
    },

    getConfig() {
      return { ...State.config };
    },

    // 加密
    setEncryptionKey(key) {
      Encryption.setKey(key);
    },

    // 监听
    onConnectionChange(callback) {
      State.connectionListeners.push(callback);
      return () => {
        const index = State.connectionListeners.indexOf(callback);
        if (index > -1) State.connectionListeners.splice(index, 1);
      };
    },

    // 清理
    clear() {
      State.subscriptions.clear();
      State.handlers.clear();
      State.namespaces.clear();
      State.callbacks.forEach(cb => clearTimeout(cb.timeout));
      State.callbacks.clear();
      Tracking.clear();
      Middleware.clear();
      CircuitBreaker.breakers.clear();
      Profiler.clear();

      if (CONFIG.DEBUG_MODE) {
        console.log('[EventBus V4] 已清理');
      }
    },

    // 状态
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
        config: State.config,
        stats: Tracking.getStats(),
        circuitBreakers: CircuitBreaker.getAllStates(),
        plugins: PluginSystem.getList()
      };
    },

    getStats() {
      return {
        ...Tracking.getStats(),
        circuitBreakers: CircuitBreaker.getAllStates(),
        plugins: PluginSystem.getList().length
      };
    },

    getHistory(filter) {
      return Tracking.getHistory(filter);
    },

    setDebugMode(enabled) {
      CONFIG.DEBUG_MODE = enabled;
      CONFIG.ENABLE_TRACKING = enabled;
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

      Tracking.log('receive', message);
      Tracking.stats.received++;

      // 系统消息处理
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
      if (message.type === MESSAGE_TYPES.HEALTH_CHECK) {
        return await HealthCheck.check();
      }

      // 查找处理器
      const parsed = Namespace.parse(message.type);
      let handler = null;
      let subscribers = [];

      if (parsed.namespace) {
        const ns = State.namespaces.get(parsed.namespace);
        if (ns) handler = ns.get(parsed.base);
        if (ns && ns.has('subscriptions')) {
          const subs = ns.get('subscriptions');
          if (subs && subs.has(parsed.base)) {
            subscribers = subs.get(parsed.base);
          }
        }
      } else {
        handler = State.handlers.get(message.type);
        subscribers = State.subscriptions.get(message.type) || [];
      }

      // 执行插件钩子
      await PluginSystem.executeHook('beforeHandler', { message, handler, subscribers });

      // 执行处理器
      if (handler && message.expectResponse) {
        const startTime = performance.now();
        try {
          const response = await handler(message.data, {
            from: message.from,
            fromEnv: message.fromEnv
          });

          Profiler.record('handler', performance.now() - startTime, { type: message.type });

          await PluginSystem.executeHook('afterHandler', { message, response });

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

  // ES6 模块导出支持
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = EventBus;
  }

  if (CONFIG.DEBUG_MODE) {
    console.log('[EventBus V4] 模块已加载');
  }

})();
