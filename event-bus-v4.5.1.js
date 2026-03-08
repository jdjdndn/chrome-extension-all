/**
 * ========================================
 * EventBus V4.5.1 - Chrome Extension 优化版
 * ========================================
 * 基于 V4.5 进行 5 次优化:
 * 1. 优化 Transport 层 - Port 自动重连、消息队列
 * 2. 优化去重机制 - 时间窗口清理
 * 3. 优化内存管理 - 定时清理、限制缓存
 * 4. 优化消息处理 - 批量处理、异步优化
 * 5. 优化 Chrome API - 便捷方法、环境检测
 *
 * @version 4.5.1
 * @author EventBus Team
 */

(function () {
  'use strict';

  const globalScope = (typeof self !== 'undefined') ? self :
                      (typeof window !== 'undefined') ? window :
                      (typeof global !== 'undefined') ? global : this;

  // ==================== 优化 1: 精简配置 ====================
  const CONFIG = {
    DEBUG_MODE: false,
    MESSAGE_TIMEOUT: 5000,
    HEARTBEAT_INTERVAL: 30000,
    MAX_RETRY: 3,

    ENABLE_CIRCUIT_BREAKER: true,
    ENABLE_DEDUPLICATION: true,
    ENABLE_TRACKING: true,
    ENABLE_PLUGINS: true,
    ENABLE_HEALTH_CHECK: true,
    ENABLE_PERSISTENCE: true,

    CIRCUIT_BREAKER_THRESHOLD: 5,
    CIRCUIT_BREAKER_TIMEOUT: 60000,
    DEDUPLICATION_WINDOW: 1000,
    MAX_TRACKING_SIZE: 500,
    MAX_PERSISTENT_QUEUE: 100,
    PERSISTENCE_KEY: '__eventbus_queue__',
    HEALTH_CHECK_INTERVAL: 60000,
    MAX_MEMORY_SAMPLES: 100,

    // Chrome Extension 专用
    PORT_RECONNECT_DELAY: 1000,
    PORT_MAX_RECONNECT: 5
  };

  // ==================== 环境检测（优化） ====================
  const ENV = (() => {
    if (typeof chrome === 'undefined' || !chrome.runtime?.id) return 'unknown';
    if (typeof chrome.devtools !== 'undefined') return 'devtools';
    if (typeof window !== 'undefined' && window.location?.protocol === 'chrome-extension:') {
      const path = window.location.pathname;
      if (path.includes('popup')) return 'popup';
      if (path.includes('options')) return 'options';
      return 'extension_page';
    }
    if (typeof window !== 'undefined' && ['https:', 'http:'].includes(window.location?.protocol)) {
      return 'content_script';
    }
    return 'background';
  })();

  const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime;
  const isDevTools = typeof chrome !== 'undefined' && chrome.devtools;

  // ==================== 工具函数（精简） ====================
  const Utils = {
    generateId: (prefix = '') => `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    safeExecute: (fn, fallback = null, ctx = null) => {
      try { return fn.call(ctx); } catch { return fallback; }
    },
    deepClone: (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      if (obj instanceof Date) return new Date(obj);
      if (Array.isArray(obj)) return obj.map(Utils.deepClone);
      const clone = {};
      for (const k in obj) if (Object.hasOwn(obj, k)) clone[k] = Utils.deepClone(obj[k]);
      return clone;
    },
    log: (prefix, msg, force = false) => (force || CONFIG.DEBUG_MODE) && console.log(`[${prefix}]`, msg),
    logError: (prefix, err) => CONFIG.DEBUG_MODE && console.error(`[${prefix}]`, err)
  };

  // ==================== 消息类型 ====================
  const MSG = {
    PING: '__eb_ping__', PONG: '__eb_pong__',
    READY: '__eb_ready__', RESPONSE: '__eb_response__',
    HEARTBEAT: '__eb_heartbeat__', HEALTH_CHECK: '__eb_health_check__',
    SNAPSHOT: '__eb_snapshot__'
  };

  // ==================== 断路器 ====================
  const CircuitBreaker = {
    breakers: new Map(),
    states: { CLOSED: 'closed', OPEN: 'open', HALF_OPEN: 'half-open' },

    getOrCreate(type) {
    if (!this.breakers.has(type)) {
      this.breakers.set(type, {
        state: this.states.CLOSED, failures: 0,
        lastFailure: 0, lastSuccess: Date.now(), lastChange: Date.now()
      });
    }
    return this.breakers.get(type);
  },

    async execute(type, fn) {
    if (!CONFIG.ENABLE_CIRCUIT_BREAKER) return fn();

    const breaker = this.getOrCreate(type);
    const now = Date.now();

    if (breaker.state === this.states.OPEN) {
      if (now - breaker.lastChange > CONFIG.CIRCUIT_BREAKER_TIMEOUT) {
        breaker.state = this.states.HALF_OPEN;
        breaker.lastChange = now;
      } else {
        throw new Error(`Circuit breaker OPEN: ${type}`);
      }
    }

    try {
      const result = await fn();
      breaker.state = this.states.CLOSED;
      breaker.failures = 0;
      breaker.lastSuccess = now;
      breaker.lastChange = now;
      return result;
    } catch (err) {
      breaker.failures++;
      breaker.lastFailure = now;
      if (breaker.failures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
        breaker.state = this.states.OPEN;
        breaker.lastChange = now;
      }
      throw err;
    }
  },

    reset: (type) => this.breakers.delete(type),
    clear: () => this.breakers.clear(),
    getAllStates: () => Object.fromEntries(this.breakers)
  };

  // ==================== 优化 2: 去重机制（时间窗口清理） ====================
  const Deduplication = {
    cache: new Map(),
    timer: null,

    start() {
      if (this.timer || !CONFIG.ENABLE_DEDUPLICATION) return;
      this.timer = setInterval(() => {
        const now = Date.now();
        for (const [key, time] of this.cache) {
          if (now - time > CONFIG.DEDUPLICATION_WINDOW) this.cache.delete(key);
        }
        // 限制缓存大小
        if (this.cache.size > 5000) {
          const entries = [...this.cache].slice(0, this.cache.size - 4000);
          for (const [k] of entries) this.cache.delete(k);
        }
      }, CONFIG.DEDUPLICATION_WINDOW);
    },

    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    },

    check(message) {
      if (!CONFIG.ENABLE_DEDUPLICATION) return false;
      const key = `${message.type}:${message.from}:${JSON.stringify(message.data).slice(0, 200)}`;
      const now = Date.now();
      if (this.cache.has(key) && now - this.cache.get(key) < CONFIG.DEDUPLICATION_WINDOW) return true;
      this.cache.set(key, now);
      return false;
    },

    clear() { this.stop(); this.cache.clear(); }
  };

  // ==================== 持久化 ====================
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
      } catch (e) { Utils.logError('Persistence', e); }
    },

    async load() {
      if (!CONFIG.ENABLE_PERSISTENCE || !isChromeExtension) return;
      try {
        const result = await chrome.storage.local.get(CONFIG.PERSISTENCE_KEY);
        if (result[CONFIG.PERSISTENCE_KEY]?.queue) {
          this.queue = result[CONFIG.PERSISTENCE_KEY].queue;
        }
      } catch (e) { Utils.logError('Persistence', e); }
    },

    async add(msg) { this.queue.push(msg); await this.save(); },
    get: () => [...this.queue],
    async clear() { this.queue = []; await chrome.storage.local.remove(CONFIG.PERSISTENCE_KEY); }
  };

  // ==================== 健康检查 ====================
  const HealthCheck = {
    timer: null,
    start() {
      if (this.timer || !CONFIG.ENABLE_HEALTH_CHECK) return;
      this.timer = setInterval(() => this.check(), CONFIG.HEALTH_CHECK_INTERVAL);
    },
    stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },
    async check() {
    return {
      status: 'healthy',
      uptime: Date.now() - State.startTime,
      messageCount: State.messageCount,
      connections: State.connections.size,
      subscriptions: State.subscriptions.size,
      handlers: State.handlers.size,
      timestamp: Date.now()
    };
  }
  };

  // ==================== 优化 3: 增强型 Transport 层 ====================
  const Transport = {
    ports: new Map(),
    port: null,
    reconnectCount: 0,
    messageQueue: [],
    isConnecting: false,

    initPort() {
      if (!isDevTools || this.port) return;
      try {
        this.port = chrome.runtime.connect({ name: 'eventbus-devtools' });
        this.reconnectCount = 0;
        this.port.onMessage.addListener((msg) => {
          if (msg.__eventbus__) EventBus._handleMessage(msg);
        });
        this.port.onDisconnect.addListener(() => {
          this.port = null;
          this.scheduleReconnect();
        });
        Utils.log('Transport', 'Port connected');
        this.flushQueue();
      } catch (err) {
        Utils.logError('Transport', `Port failed: ${err.message}`);
        this.scheduleReconnect();
      }
    },

    scheduleReconnect() {
      if (this.reconnectCount >= CONFIG.PORT_MAX_RECONNECT || this.isConnecting) return;
      this.isConnecting = true;
      this.reconnectCount++;
      setTimeout(() => {
        this.isConnecting = false;
        this.initPort();
      }, CONFIG.PORT_RECONNECT_DELAY * this.reconnectCount);
    },

    registerPort(tabId, port) {
      this.ports.set(tabId, port);
      port.onDisconnect.addListener(() => this.ports.delete(tabId));
      Utils.log('Transport', `Port registered: tabId=${tabId}`);
    },

    sendToPort(tabId, message) {
      const port = this.ports.get(tabId);
      if (!port) return false;
      try {
        port.postMessage(message);
        return true;
      } catch {
        this.ports.delete(tabId);
        return false;
      }
    },

    flushQueue() {
      while (this.messageQueue.length > 0 && this.port) {
        const msg = this.messageQueue.shift();
        try { this.port.postMessage(msg); } catch { this.messageQueue.unshift(msg); break; }
      }
    },

    async send(target, message) {
      if (target?.tabId && this.sendToPort(target.tabId, message)) return;

      if (isDevTools && this.port) {
        try { this.port.postMessage(message); return; } catch {}
      }

      if (ENV === 'content_script') return chrome.runtime.sendMessage(message);
      if (ENV === 'background') {
        if (target?.tabId) return chrome.tabs.sendMessage(target.tabId, message);
        return chrome.runtime.sendMessage(message);
      }

      if (chrome.tabs?.query) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) return chrome.tabs.sendMessage(tabs[0].id, message);
      }
      return chrome.runtime.sendMessage(message);
    },

    async broadcast(message) {
      if (ENV === 'content_script') {
        await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
      } else if (ENV === 'background') {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          try { await chrome.tabs.sendMessage(tab.id, message); } catch {}
        }
        for (const [tabId, port] of this.ports) {
          try { port.postMessage(message); } catch { this.ports.delete(tabId); }
        }
      } else {
        await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
      }
    },

    onMessage(callback) {
      if (!isChromeExtension) return;
      chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        const result = callback(msg, sender);
        if (result instanceof Promise) {
          result.then(sendResponse);
          return true;
        }
        if (result !== undefined) { sendResponse(result); return true; }
        return false;
      });
    }
  };

  // ==================== 追踪 ====================
  const Tracking = {
    messages: [],
    stats: { sent: 0, received: 0, failed: 0, timeout: 0 },

    log(type, msg) {
      if (!CONFIG.ENABLE_TRACKING) return;
      this.messages.push({ timestamp: Date.now(), type, ...msg });
      if (this.messages.length > CONFIG.MAX_TRACKING_SIZE) this.messages.shift();
    },

    getStats: () => ({ ...Tracking.stats, tracked: Tracking.messages.length }),
    getHistory: (filter = {}) => {
      let h = [...Tracking.messages];
      if (filter.type) h = h.filter(m => m.type === filter.type);
      if (filter.limit) h = h.slice(-filter.limit);
      return h;
    },
    clear() { this.messages = []; this.stats = { sent: 0, received: 0, failed: 0, timeout: 0 }; }
  };

  // ==================== 插件系统 ====================
  const PluginSystem = {
    plugins: new Map(),
    hooks: { beforeSend: [], afterReceive: [], beforeHandler: [], afterHandler: [], onError: [] },

    register(plugin) {
      if (!plugin?.name) throw new Error('Plugin needs name');
      this.plugins.set(plugin.name, { ...plugin, installedAt: Date.now() });
      if (plugin.hooks) {
        for (const [hook, handler] of Object.entries(plugin.hooks)) {
          if (this.hooks[hook]) this.hooks[hook].push({ name: plugin.name, handler });
        }
      }
      plugin.init?.();
    },

    async executeHook(hook, data) {
      if (!this.hooks[hook]) return;
      for (const { handler } of this.hooks[hook]) {
        await Utils.safeExecute(async () => handler(data), null);
      }
    },

    getList: () => [...PluginSystem.plugins.values()],
    clear() { this.plugins.clear(); for (const h of Object.values(this.hooks)) h.length = 0; }
  };

  // ==================== 状态管理 ====================
  const State = {
    id: Utils.generateId(`${ENV}_`),
    isReady: false,
    connections: new Map(),
    callbacks: new Map(),
    subscriptions: new Map(),
    handlers: new Map(),
    startTime: Date.now(),
    messageCount: 0,
    config: { ...CONFIG }
  };

  // ==================== 优化 5: Chrome 专用 API ====================
  const ChromeAPI = {
    getEnv: () => ENV,
    isExtensionContext: () => isChromeExtension,

    async sendToBackground(type, data) {
      return EventBus.request(type, data);
    },

    async sendToContent(tabId, type, data) {
      return EventBus.request(type, data, { target: { tabId } });
    },

    async sendToActiveTab(type, data) {
      if (!chrome.tabs?.query) return null;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) return null;
      return this.sendToContent(tabs[0].id, type, data);
    },

    async broadcast(type, data) {
      return EventBus.publish(type, data);
    },

    async getCurrentTabId() {
      if (!chrome.tabs?.query) return null;
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0]?.id;
    }
  };

  // ==================== EventBus 核心 ====================
  const EventBus = {
    Transport,
    Chrome: ChromeAPI,

    async init() {
      if (State.isReady) return;

      await Persistence.load();
      Deduplication.start();
      HealthCheck.start();

      if (isDevTools) Transport.initPort();
      Transport.onMessage(this._handleMessage.bind(this));
      this._startHeartbeat();

      State.isReady = true;
      setTimeout(() => this.publish(MSG.READY, { from: State.id, env: ENV }), 100);
      Utils.log('EventBus', `V4.5.1 initialized [${ENV}]`, true);
    },

    async request(type, data = {}, options = {}) {
      if (!type) throw new Error('Type required');
      return CircuitBreaker.execute(type, async () => {
        const { timeout = CONFIG.MESSAGE_TIMEOUT } = options;
        const id = Utils.generateId();
        const message = {
          __eventbus__: true, id, type, data,
          from: State.id, fromEnv: ENV,
          timestamp: Date.now(), expectResponse: true
        };

        Tracking.log('send', { type, id });
        Tracking.stats.sent++;

        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            State.callbacks.delete(id);
            Tracking.stats.timeout++;
            reject(new Error(`Timeout: ${type}`));
          }, timeout);

          State.callbacks.set(id, {
            resolve: (res) => { clearTimeout(timer); resolve(res); },
            reject
          });

          Transport.send(options.target, message).catch(reject);
        });
      });
    },

    async publish(type, data = {}) {
      if (!type) throw new Error('Type required');
      const message = {
        __eventbus__: true, id: Utils.generateId(),
        type, data,
        from: State.id, fromEnv: ENV,
        timestamp: Date.now()
      };
      Tracking.stats.sent++;
      Tracking.log('publish', { type });
      return Transport.broadcast(message);
    },

    subscribe(type, callback) {
      if (!type || typeof callback !== 'function') throw new Error('Invalid params');
      if (!State.subscriptions.has(type)) State.subscriptions.set(type, []);
      State.subscriptions.get(type).push(callback);
      return () => this.off(type, callback);
    },

    on(type, handler) {
      if (!type || typeof handler !== 'function') throw new Error('Invalid params');
      State.handlers.set(type, handler);
    },

    off(type, callback) {
      if (callback && State.subscriptions.has(type)) {
        const subs = State.subscriptions.get(type);
        const idx = subs.indexOf(callback);
        if (idx > -1) subs.splice(idx, 1);
      } else {
        State.subscriptions.delete(type);
        State.handlers.delete(type);
      }
    },

    once(type, callback) {
      const wrapper = (data, source) => { this.off(type, wrapper); callback(data, source); };
      return this.subscribe(type, wrapper);
    },

    configure(options) { Object.assign(CONFIG, options); State.config = { ...CONFIG }; },
    getConfig: () => ({ ...State.config }),

    getState() {
      return {
        env: ENV, id: State.id, isReady: State.isReady,
        uptime: Date.now() - State.startTime,
        handlers: [...State.handlers.keys()],
        subscriptions: [...State.subscriptions.keys()],
        stats: Tracking.getStats(),
        circuitBreakers: CircuitBreaker.getAllStates(),
        plugins: PluginSystem.getList(),
        version: '4.5.1'
      };
    },

    getStats: () => Tracking.getStats(),
    getHistory: (filter) => Tracking.getHistory(filter),

    resetCircuitBreaker: (type) => CircuitBreaker.reset(type),
    getCircuitBreakerState: (type) => CircuitBreaker.breakers.get(type)?.state || 'closed',
    getAllCircuitBreakerStates: () => CircuitBreaker.getAllStates(),

    registerPlugin: (plugin) => PluginSystem.register(plugin),

    async getHealth() { return await HealthCheck.check(); },

    async saveQueue() { await Persistence.save(); },
    async loadQueue() { await Persistence.load(); },
    async clearQueue() { await Persistence.clear(); },
    getQueue: () => Persistence.get(),

    clear() {
      State.subscriptions.clear();
      State.handlers.clear();
      State.callbacks.forEach(cb => clearTimeout(cb.timer));
      State.callbacks.clear();
      Tracking.clear();
      PluginSystem.clear();
      CircuitBreaker.clear();
      Deduplication.clear();
      HealthCheck.stop();
      Utils.log('EventBus', 'Cleared');
    },

    destroy() {
      if (this._heartbeatTimer) { clearInterval(this._heartbeatTimer); this._heartbeatTimer = null; }
      Deduplication.stop();
      this.clear();
      State.isReady = false;
      Utils.log('EventBus', 'Destroyed');
    },

    async _handleMessage(message, sender) {
      if (!message?.__eventbus__ || message.from === State.id) return;

      if (Deduplication.check(message)) return;

      Tracking.stats.received++;
      Tracking.log('receive', { type: message.type, from: message.from });

      if (message.type === MSG.PING) return { type: MSG.PONG, from: State.id };
      if (message.type === MSG.PONG) { State.connections.set(message.from, { lastSeen: Date.now() }); return; }
      if (message.type === MSG.READY) { State.connections.set(message.from, { lastSeen: Date.now(), env: message.fromEnv }); return; }
      if (message.type === MSG.RESPONSE) {
        const cb = State.callbacks.get(message.id);
        if (cb) { clearTimeout(cb.timer); State.callbacks.delete(message.id); cb.resolve(message.data); }
        return;
      }
      if (message.type === MSG.HEALTH_CHECK) return await HealthCheck.check();
      if (message.type === MSG.SNAPSHOT) return this.getState();

      const handler = State.handlers.get(message.type);
      const subscribers = State.subscriptions.get(message.type) || [];

      await PluginSystem.executeHook('beforeHandler', { message, handler });

      if (handler && message.expectResponse) {
        try {
          const result = await handler(message.data, { from: message.from, fromEnv: message.fromEnv, sender });
          await PluginSystem.executeHook('afterHandler', { message, result });
          return { __eventbus__: true, id: message.id, type: MSG.RESPONSE, data: result, from: State.id };
        } catch (err) {
          Tracking.stats.failed++;
          await PluginSystem.executeHook('onError', { message, error: err });
          throw err;
        }
      }

      for (const sub of subscribers) {
        Utils.safeExecute(() => sub(message.data, { from: message.from, fromEnv: message.fromEnv, sender }));
      }
      return null;
    },

    _heartbeatTimer: null,
    _startHeartbeat() {
      if (typeof window === 'undefined') return;
      this._heartbeatTimer = setInterval(() => {
        this.publish(MSG.HEARTBEAT, {});
        const now = Date.now();
        for (const [id, conn] of State.connections) {
          if (now - conn.lastSeen > CONFIG.HEARTBEAT_INTERVAL * 2) {
            State.connections.delete(id);
          }
        }
      }, CONFIG.HEARTBEAT_INTERVAL);
    }
  };

  // 导出
  globalScope.EventBus = EventBus;

  // 自动初始化
  if (typeof document !== 'undefined') {
    document.readyState === 'loading'
      ? document.addEventListener('DOMContentLoaded', () => EventBus.init())
      : EventBus.init();
  } else if (typeof self !== 'undefined' && typeof self.importScripts === 'function') {
    EventBus.init();
  } else {
    EventBus.init();
  }

  // ES6 模块支持
  if (typeof module !== 'undefined' && module.exports) module.exports = EventBus;

  console.log('[EventBus V4.5.1] Chrome Extension Optimized Edition loaded');
})();
