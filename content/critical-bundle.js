"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (const key of __getOwnPropNames(from))
        {if (!__hasOwnProp.call(to, key) && key !== except)
          {__defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });}}
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // event-bus-v4.6.js
  var require_event_bus_v4_6 = __commonJS({
    "event-bus-v4.6.js"(exports, module) {
      "use strict";
      (function() {
        "use strict";
        const globalScope = typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : this;
        const CONFIG = {
          // 核心配置
          DEBUG_MODE: false,
          MESSAGE_TIMEOUT: 5e3,
          HEARTBEAT_INTERVAL: 3e4,
          MAX_RETRY: 3,
          MAX_DATA_SIZE: 10 * 1024 * 1024,
          // 10MB（从1MB提升）
          // 功能开关
          ENABLE_CIRCUIT_BREAKER: true,
          ENABLE_DEDUPLICATION: true,
          ENABLE_TRACKING: true,
          ENABLE_PLUGINS: true,
          ENABLE_HEALTH_CHECK: true,
          ENABLE_PERSISTENCE: true,
          // 断路器
          CIRCUIT_BREAKER_THRESHOLD: 5,
          CIRCUIT_BREAKER_TIMEOUT: 6e4,
          // 去重
          DEDUPLICATION_WINDOW: 1e3,
          DEDUPLICATION_MAX_SIZE: 5e3,
          // 追踪
          MAX_TRACKING_SIZE: 500,
          // 持久化
          MAX_PERSISTENT_QUEUE: 100,
          PERSISTENCE_KEY: "__eventbus_queue__",
          // 健康检查
          HEALTH_CHECK_INTERVAL: 6e4,
          // Port 连接（Chrome Extension 专用）
          PORT_RECONNECT_DELAY: 1e3,
          PORT_MAX_RECONNECT: 5,
          PORT_QUEUE_MAX_SIZE: 100
        };
        const ENV = (() => {
          if (typeof chrome === "undefined" || !chrome.runtime?.id) {
            return "unknown";
          }
          if (typeof chrome.devtools !== "undefined") {
            return "devtools";
          }
          if (typeof window !== "undefined" && window.location?.protocol === "chrome-extension:") {
            const path = window.location.pathname;
            if (path.includes("popup")) {
              return "popup";
            }
            if (path.includes("options")) {
              return "options";
            }
            return "extension_page";
          }
          if (typeof window !== "undefined" && ["https:", "http:"].includes(window.location?.protocol)) {
            return "content_script";
          }
          return "background";
        })();
        const isChromeExtension = typeof chrome !== "undefined" && chrome.runtime;
        const isDevTools = typeof chrome !== "undefined" && chrome.devtools;
        const Utils = {
          generateId: (prefix = "") => `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
          safeExecute: (fn, fallback = null, ctx = null) => {
            try {
              return fn.call(ctx);
            } catch {
              return fallback;
            }
          },
          async safeExecuteAsync(fn, fallback = null) {
            try {
              return await fn();
            } catch {
              return fallback;
            }
          },
          deepClone: (obj) => {
            if (!obj || typeof obj !== "object") {
              return obj;
            }
            if (obj instanceof Date) {
              return new Date(obj);
            }
            if (Array.isArray(obj)) {
              return obj.map(Utils.deepClone);
            }
            const clone = {};
            for (const k in obj) {
              if (Object.hasOwn(obj, k)) {
                clone[k] = Utils.deepClone(obj[k]);
              }
            }
            return clone;
          },
          log: (prefix, msg, force = false) => (force || CONFIG.DEBUG_MODE) && console.log(`[${prefix}]`, msg),
          logError: (prefix, err) => CONFIG.DEBUG_MODE && console.error(`[${prefix}]`, err),
          // 消息类型验证
          validateType: (type) => typeof type === "string" && type.length > 0 && type.length <= 200,
          // 数据大小检查
          checkDataSize: (data, maxSize = 1024 * 1024) => {
            try {
              return JSON.stringify(data).length <= maxSize;
            } catch {
              return false;
            }
          }
        };
        const MSG = {
          PING: "__eb_ping__",
          PONG: "__eb_pong__",
          READY: "__eb_ready__",
          RESPONSE: "__eb_response__",
          HEARTBEAT: "__eb_heartbeat__",
          HEALTH_CHECK: "__eb_health_check__",
          SNAPSHOT: "__eb_snapshot__"
        };
        const CircuitBreaker = {
          breakers: /* @__PURE__ */ new Map(),
          states: { CLOSED: "closed", OPEN: "open", HALF_OPEN: "half-open" },
          getOrCreate(type) {
            if (!this.breakers.has(type)) {
              this.breakers.set(type, {
                state: this.states.CLOSED,
                failures: 0,
                lastFailure: 0,
                lastSuccess: Date.now(),
                lastChange: Date.now()
              });
            }
            return this.breakers.get(type);
          },
          async execute(type, fn) {
            if (!CONFIG.ENABLE_CIRCUIT_BREAKER) {
              return fn();
            }
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
              if (breaker.failures >= CONFIG.CIRCUIT_BREAKER_THRESHOLD && breaker.state !== this.states.OPEN) {
                breaker.state = this.states.OPEN;
                breaker.lastChange = now;
              }
              throw err;
            }
          },
          reset(type) {
            return this.breakers.delete(type);
          },
          clear() {
            this.breakers.clear();
          },
          getAllStates() {
            return Object.fromEntries(this.breakers);
          }
        };
        const Deduplication = {
          cache: /* @__PURE__ */ new Map(),
          timer: null,
          start() {
            if (this.timer || !CONFIG.ENABLE_DEDUPLICATION) {
              return;
            }
            this.timer = setInterval(() => {
              const now = Date.now();
              for (const [key, time] of this.cache) {
                if (now - time > CONFIG.DEDUPLICATION_WINDOW) {
                  this.cache.delete(key);
                }
              }
              if (this.cache.size > CONFIG.DEDUPLICATION_MAX_SIZE) {
                const entries = [...this.cache].slice(0, this.cache.size - 4e3);
                for (const [k] of entries) {
                  this.cache.delete(k);
                }
              }
            }, CONFIG.DEDUPLICATION_WINDOW);
          },
          stop() {
            if (this.timer) {
              clearInterval(this.timer);
              this.timer = null;
            }
          },
          check(message) {
            if (!CONFIG.ENABLE_DEDUPLICATION) {
              return false;
            }
            const key = `${message.type}:${message.from}:${JSON.stringify(message.data).slice(0, 200)}`;
            const now = Date.now();
            if (this.cache.has(key) && now - this.cache.get(key) < CONFIG.DEDUPLICATION_WINDOW) {
              return true;
            }
            this.cache.set(key, now);
            return false;
          },
          clear() {
            this.stop();
            this.cache.clear();
          }
        };
        const DevToolsMonitor = {
          enabled: false,
          throttleTimer: null,
          eventQueue: [],
          THROTTLE_MS: 100,
          // 100ms 节流
          enable() {
            if (ENV !== "content_script") {
              return;
            }
            this.enabled = true;
            Utils.log("DevToolsMonitor", "Enabled");
          },
          disable() {
            this.enabled = false;
            this.eventQueue = [];
            Utils.log("DevToolsMonitor", "Disabled");
          },
          // 记录事件（带节流）
          logEvent(eventType, message, direction = "publish") {
            if (!this.enabled || ENV !== "content_script") {
              return;
            }
            this.eventQueue.push({
              type: message.type,
              direction,
              eventType,
              data: message.data,
              from: message.from,
              fromEnv: message.fromEnv || ENV,
              timestamp: message.timestamp || Date.now(),
              id: message.id
            });
            if (!this.throttleTimer) {
              this.throttleTimer = setTimeout(() => {
                this.flush();
              }, this.THROTTLE_MS);
            }
          },
          // 批量发送到 background
          flush() {
            if (this.eventQueue.length === 0) {
              this.throttleTimer = null;
              return;
            }
            const events = [...this.eventQueue];
            this.eventQueue = [];
            this.throttleTimer = null;
            try {
              chrome.runtime.sendMessage({
                type: "EVENTBUS_DEVTOOLS_LOG",
                events
              }).catch(() => {
              });
            } catch (e) {
            }
          },
          clear() {
            this.enabled = false;
            this.eventQueue = [];
            if (this.throttleTimer) {
              clearTimeout(this.throttleTimer);
              this.throttleTimer = null;
            }
          }
        };
        const Persistence = {
          queue: [],
          async save() {
            if (!CONFIG.ENABLE_PERSISTENCE || !isChromeExtension) {
              return;
            }
            try {
              await chrome.storage.local.set({
                [CONFIG.PERSISTENCE_KEY]: {
                  queue: this.queue.slice(-CONFIG.MAX_PERSISTENT_QUEUE),
                  timestamp: Date.now()
                }
              });
            } catch (e) {
              Utils.logError("Persistence", e);
            }
          },
          async load() {
            if (!CONFIG.ENABLE_PERSISTENCE || !isChromeExtension) {
              return;
            }
            try {
              const result = await chrome.storage.local.get(CONFIG.PERSISTENCE_KEY);
              if (result[CONFIG.PERSISTENCE_KEY]?.queue) {
                this.queue = result[CONFIG.PERSISTENCE_KEY].queue;
              }
            } catch (e) {
              Utils.logError("Persistence", e);
            }
          },
          async add(msg) {
            this.queue.push(msg);
            await this.save();
          },
          get: () => [...this.queue],
          async clear() {
            this.queue = [];
            await chrome.storage.local.remove(CONFIG.PERSISTENCE_KEY);
          }
        };
        const HealthCheck = {
          timer: null,
          lastCheck: null,
          errorCount: 0,
          start() {
            if (this.timer || !CONFIG.ENABLE_HEALTH_CHECK) {
              return;
            }
            this.timer = setInterval(async () => {
              const status = await this.check();
              this.lastCheck = status;
              if (status.status !== "healthy") {
                Utils.log("HealthCheck", status);
                this.errorCount++;
              }
            }, CONFIG.HEALTH_CHECK_INTERVAL);
          },
          stop() {
            if (this.timer) {
              clearInterval(this.timer);
              this.timer = null;
            }
          },
          async check() {
            const stats = Tracking.getStats();
            const now = Date.now();
            const uptime = now - State.startTime;
            const issues = [];
            if (stats.successRate < 80) {
              issues.push(`Low success rate: ${stats.successRate}%`);
            }
            if (stats.avgLatency > 1e3) {
              issues.push(`High latency: ${stats.avgLatency}ms`);
            }
            const openBreakers = Object.entries(CircuitBreaker.getAllStates()).filter(([, b]) => b.state === "open");
            if (openBreakers.length > 0) {
              issues.push(`Open circuit breakers: ${openBreakers.length}`);
            }
            return {
              status: issues.length === 0 ? "healthy" : "degraded",
              uptime,
              messageCount: State.messageCount,
              connections: State.connections.size,
              subscriptions: State.subscriptions.size,
              handlers: State.handlers.size,
              stats,
              issues,
              timestamp: now
            };
          }
        };
        const Transport = {
          ports: /* @__PURE__ */ new Map(),
          port: null,
          reconnectCount: 0,
          messageQueue: [],
          isConnecting: false,
          initPort() {
            if (!isDevTools || this.port) {
              return;
            }
            try {
              this.port = chrome.runtime.connect({ name: "eventbus-devtools" });
              this.reconnectCount = 0;
              this.port.onMessage.addListener((msg) => {
                if (msg.__eventbus__) {
                  EventBus._handleMessage(msg);
                }
              });
              this.port.onDisconnect.addListener(() => {
                this.port = null;
                this.scheduleReconnect();
              });
              Utils.log("Transport", "Port connected");
              this.flushQueue();
            } catch (err) {
              Utils.logError("Transport", `Port failed: ${err.message}`);
              this.scheduleReconnect();
            }
          },
          scheduleReconnect() {
            if (this.reconnectCount >= CONFIG.PORT_MAX_RECONNECT || this.isConnecting) {
              return;
            }
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
            Utils.log("Transport", `Port registered: tabId=${tabId}`);
          },
          sendToPort(tabId, message) {
            const port = this.ports.get(tabId);
            if (!port) {
              return false;
            }
            try {
              port.postMessage(message);
              return true;
            } catch {
              this.ports.delete(tabId);
              return false;
            }
          },
          // 向后兼容别名
          sendViaPort(tabId, message) {
            return this.sendToPort(tabId, message);
          },
          flushQueue() {
            while (this.messageQueue.length > 0 && this.port) {
              const msg = this.messageQueue.shift();
              try {
                this.port.postMessage(msg);
              } catch {
                this.messageQueue.unshift(msg);
                break;
              }
            }
          },
          async send(target, message) {
            try {
              if (target?.tabId && this.sendToPort(target.tabId, message)) {
                return;
              }
              if (isDevTools && this.port) {
                try {
                  this.port.postMessage(message);
                  return;
                } catch {
                }
              }
              if (ENV === "content_script") {
                return await chrome.runtime.sendMessage(message);
              }
              if (ENV === "background") {
                if (target?.tabId) {
                  return await chrome.tabs.sendMessage(target.tabId, message);
                }
                return await chrome.runtime.sendMessage(message);
              }
              if (chrome.tabs?.query) {
                const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                if (tabs[0]?.id) {
                  return await chrome.tabs.sendMessage(tabs[0].id, message);
                }
              }
              return await chrome.runtime.sendMessage(message);
            } catch (error) {
              if (error.message?.includes("Extension context invalidated")) {
                DevToolsMonitor.disable();
                return;
              }
              throw error;
            }
          },
          async broadcast(message) {
            try {
              if (ENV === "content_script") {
                await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
              } else if (ENV === "background") {
                const tabs = await chrome.tabs.query({});
                for (const tab of tabs) {
                  try {
                    await chrome.tabs.sendMessage(tab.id, message);
                  } catch {
                  }
                }
                for (const [tabId, port] of this.ports) {
                  try {
                    port.postMessage(message);
                  } catch {
                    this.ports.delete(tabId);
                  }
                }
              } else {
                await chrome.runtime.sendMessage({ ...message, __broadcast__: true });
              }
            } catch (error) {
              if (error.message?.includes("Extension context invalidated")) {
                DevToolsMonitor.disable();
                return;
              }
            }
          },
          onMessage(callback) {
            if (!isChromeExtension) {
              return;
            }
            chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
              console.log("[EventBus Transport] \u6536\u5230\u6D88\u606F:", msg?.type, msg);
              const result = callback(msg, sender);
              console.log("[EventBus Transport] \u5904\u7406\u7ED3\u679C:", result);
              if (result instanceof Promise) {
                result.then(sendResponse).catch((err) => {
                  console.error("[EventBus Transport] \u5904\u7406\u9519\u8BEF:", err);
                  sendResponse({ __eventbus__: true, error: err.message });
                });
                return true;
              }
              if (result !== void 0) {
                sendResponse(result);
                return true;
              }
              console.log("[EventBus Transport] \u975E EventBus \u6D88\u606F\uFF0C\u8FD4\u56DE false");
              return false;
            });
          }
        };
        const Tracking = {
          messages: [],
          stats: { sent: 0, received: 0, failed: 0, timeout: 0, avgLatency: 0 },
          latencies: [],
          log(type, msg) {
            if (!CONFIG.ENABLE_TRACKING) {
              return;
            }
            this.messages.push({ timestamp: Date.now(), type, ...msg });
            if (this.messages.length > CONFIG.MAX_TRACKING_SIZE) {
              this.messages.shift();
            }
          },
          recordLatency(startTime) {
            const latency = Date.now() - startTime;
            this.latencies.push(latency);
            if (this.latencies.length > 100) {
              this.latencies.shift();
            }
            this.stats.avgLatency = Math.round(this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length);
          },
          getStats() {
            return {
              ...this.stats,
              tracked: this.messages.length,
              successRate: this.stats.sent > 0 ? Math.round((this.stats.sent - this.stats.failed - this.stats.timeout) / this.stats.sent * 100) : 100
            };
          },
          getHistory(filter = {}) {
            let h = [...this.messages];
            if (filter.type) {
              h = h.filter((m) => m.type === filter.type);
            }
            if (filter.since) {
              h = h.filter((m) => m.timestamp > filter.since);
            }
            if (filter.limit) {
              h = h.slice(-filter.limit);
            }
            return h;
          },
          clear() {
            this.messages = [];
            this.latencies = [];
            this.stats = { sent: 0, received: 0, failed: 0, timeout: 0, avgLatency: 0 };
          }
        };
        const PluginSystem = {
          plugins: /* @__PURE__ */ new Map(),
          hooks: { beforeSend: [], afterReceive: [], beforeHandler: [], afterHandler: [], onError: [] },
          register(plugin) {
            if (!plugin?.name) {
              throw new Error("Plugin needs name");
            }
            this.plugins.set(plugin.name, { ...plugin, installedAt: Date.now() });
            if (plugin.hooks) {
              for (const [hook, handler] of Object.entries(plugin.hooks)) {
                if (this.hooks[hook]) {
                  this.hooks[hook].push({ name: plugin.name, handler });
                }
              }
            }
            plugin.init?.();
          },
          async executeHook(hook, data) {
            if (!this.hooks[hook]) {
              return;
            }
            for (const { handler } of this.hooks[hook]) {
              await Utils.safeExecute(async () => handler(data), null);
            }
          },
          getList: () => [...PluginSystem.plugins.values()],
          clear() {
            this.plugins.clear();
            for (const h of Object.values(this.hooks)) {
              h.length = 0;
            }
          }
        };
        const MessageTemplates = {
          templates: /* @__PURE__ */ new Map(),
          define(name, template) {
            if (!name || typeof name !== "string") {
              throw new Error("Template name required");
            }
            this.templates.set(name, {
              name,
              schema: template.schema || {},
              defaults: template.defaults || {},
              validate: template.validate || null,
              createdAt: Date.now()
            });
            Utils.log("MessageTemplates", `Template defined: ${name}`);
          },
          create(templateName, data = {}) {
            const template = this.templates.get(templateName);
            if (!template) {
              throw new Error(`Template not found: ${templateName}`);
            }
            const message = { ...template.defaults, ...data };
            if (template.schema.required) {
              for (const field of template.schema.required) {
                if (message[field] === void 0) {
                  throw new Error(`Missing required field: ${field}`);
                }
              }
            }
            if (template.validate) {
              const errors = template.validate(message);
              if (errors && errors.length > 0) {
                throw new Error(`Validation failed: ${errors.join(", ")}`);
              }
            }
            return { type: templateName, ...message };
          },
          list() {
            return [...this.templates.entries()].map(([name, t]) => ({
              name,
              hasValidation: !!t.validate,
              requiredFields: t.schema.required || []
            }));
          },
          clear() {
            this.templates.clear();
          }
        };
        const State = {
          id: Utils.generateId(`${ENV}_`),
          isReady: false,
          connections: /* @__PURE__ */ new Map(),
          callbacks: /* @__PURE__ */ new Map(),
          subscriptions: /* @__PURE__ */ new Map(),
          handlers: /* @__PURE__ */ new Map(),
          startTime: Date.now(),
          messageCount: 0,
          config: { ...CONFIG }
        };
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
            if (!chrome.tabs?.query) {
              return null;
            }
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tabs[0]?.id) {
              return null;
            }
            return this.sendToContent(tabs[0].id, type, data);
          },
          async broadcast(type, data) {
            return EventBus.publish(type, data);
          },
          async getCurrentTabId() {
            if (!chrome.tabs?.query) {
              return null;
            }
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            return tabs[0]?.id;
          },
          async getSnapshot() {
            return {
              timestamp: Date.now(),
              state: EventBus.getState(),
              stats: EventBus.getStats(),
              health: await EventBus.getHealth(),
              circuitBreakers: CircuitBreaker.getAllStates()
            };
          }
        };
        const EventBus = {
          Transport,
          Chrome: ChromeAPI,
          async init() {
            if (State.isReady) {
              return;
            }
            await Persistence.load();
            Deduplication.start();
            HealthCheck.start();
            if (isDevTools) {
              Transport.initPort();
            }
            Transport.onMessage(this._handleMessage.bind(this));
            this._startHeartbeat();
            State.isReady = true;
            setTimeout(() => this.publish(MSG.READY, { from: State.id, env: ENV }), 100);
            Utils.log("EventBus", `V4.6.0 initialized [${ENV}]`, true);
          },
          async request(type, data = {}, options = {}) {
            if (!Utils.validateType(type)) {
              throw new Error("Invalid message type");
            }
            if (!Utils.checkDataSize(data, CONFIG.MAX_DATA_SIZE)) {
              throw new Error("Data size exceeds limit");
            }
            return CircuitBreaker.execute(type, async () => {
              const { timeout = CONFIG.MESSAGE_TIMEOUT } = options;
              const id = Utils.generateId();
              const message = {
                __eventbus__: true,
                id,
                type,
                data,
                from: State.id,
                fromEnv: ENV,
                timestamp: Date.now(),
                expectResponse: true
              };
              Tracking.log("send", { type, id });
              Tracking.stats.sent++;
              DevToolsMonitor.logEvent("request", message, "send");
              return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                  State.callbacks.delete(id);
                  Tracking.stats.timeout++;
                  reject(new Error(`Timeout: ${type}`));
                }, timeout);
                State.callbacks.set(id, {
                  resolve: (res) => {
                    clearTimeout(timer);
                    resolve(res);
                  },
                  reject,
                  timer
                });
                Transport.send(options.target, message).catch((err) => {
                  clearTimeout(timer);
                  State.callbacks.delete(id);
                  reject(err);
                });
              });
            });
          },
          async publish(type, data = {}) {
            if (!Utils.validateType(type)) {
              throw new Error("Invalid message type");
            }
            if (!Utils.checkDataSize(data, CONFIG.MAX_DATA_SIZE)) {
              throw new Error("Data size exceeds limit");
            }
            const message = {
              __eventbus__: true,
              id: Utils.generateId(),
              type,
              data,
              from: State.id,
              fromEnv: ENV,
              timestamp: Date.now()
            };
            Tracking.stats.sent++;
            Tracking.log("publish", { type });
            DevToolsMonitor.logEvent("publish", message, "send");
            return Transport.broadcast(message);
          },
          subscribe(type, callback) {
            if (!type || typeof callback !== "function") {
              throw new Error("Invalid params");
            }
            if (!State.subscriptions.has(type)) {
              State.subscriptions.set(type, []);
            }
            State.subscriptions.get(type).push(callback);
            return () => this.off(type, callback);
          },
          on(type, handler) {
            if (!type || typeof handler !== "function") {
              throw new Error("Invalid params");
            }
            State.handlers.set(type, handler);
          },
          off(type, callback) {
            if (callback && State.subscriptions.has(type)) {
              const subs = State.subscriptions.get(type);
              const idx = subs.indexOf(callback);
              if (idx > -1) {
                subs.splice(idx, 1);
              }
            } else {
              State.subscriptions.delete(type);
              State.handlers.delete(type);
            }
          },
          once(type, callback) {
            const wrapper = (data, source) => {
              this.off(type, wrapper);
              callback(data, source);
            };
            return this.subscribe(type, wrapper);
          },
          configure(options) {
            Object.assign(CONFIG, options);
            State.config = { ...CONFIG };
          },
          getConfig: () => ({ ...State.config }),
          getState() {
            return {
              env: ENV,
              id: State.id,
              isReady: State.isReady,
              uptime: Date.now() - State.startTime,
              handlers: [...State.handlers.keys()],
              subscriptions: [...State.subscriptions.keys()],
              connections: State.connections.size,
              stats: Tracking.getStats(),
              circuitBreakers: CircuitBreaker.getAllStates(),
              plugins: PluginSystem.getList(),
              config: { ...State.config },
              version: "4.6.0"
            };
          },
          getStats: () => Tracking.getStats(),
          getHistory: (filter) => Tracking.getHistory(filter),
          getPerformanceReport() {
            const stats = Tracking.getStats();
            const health = HealthCheck.lastCheck || {};
            return {
              timestamp: Date.now(),
              uptime: Date.now() - State.startTime,
              messageStats: stats,
              healthStatus: health.status,
              activeConnections: State.connections.size,
              activeHandlers: State.handlers.size,
              activeSubscriptions: State.subscriptions.size,
              circuitBreakerIssues: Object.entries(CircuitBreaker.getAllStates()).filter(([, b]) => b.state !== "closed").length,
              recommendations: this._generateRecommendations(stats, health)
            };
          },
          _generateRecommendations(stats, health) {
            const recs = [];
            if (stats.avgLatency > 500) {
              recs.push("Consider optimizing message handlers");
            }
            if (stats.timeout > stats.sent * 0.1) {
              recs.push("High timeout rate - check target availability");
            }
            if (health.issues?.length > 0) {
              recs.push(...health.issues);
            }
            return recs;
          },
          resetCircuitBreaker: (type) => CircuitBreaker.reset(type),
          getCircuitBreakerState: (type) => CircuitBreaker.breakers.get(type)?.state || "closed",
          getAllCircuitBreakerStates: () => CircuitBreaker.getAllStates(),
          registerPlugin: (plugin) => PluginSystem.register(plugin),
          // 消息模板系统
          defineTemplate: (name, template) => MessageTemplates.define(name, template),
          createMessage: (templateName, data) => MessageTemplates.create(templateName, data),
          listTemplates: () => MessageTemplates.list(),
          async getHealth() {
            return await HealthCheck.check();
          },
          // DevTools 监控控制
          enableDevToolsMonitor: () => DevToolsMonitor.enable(),
          disableDevToolsMonitor: () => DevToolsMonitor.disable(),
          isDevToolsMonitorEnabled: () => DevToolsMonitor.enabled,
          async saveQueue() {
            await Persistence.save();
          },
          async loadQueue() {
            await Persistence.load();
          },
          async clearQueue() {
            await Persistence.clear();
          },
          getQueue: () => Persistence.get(),
          clear() {
            State.subscriptions.clear();
            State.handlers.clear();
            State.callbacks.forEach((cb) => clearTimeout(cb.timer));
            State.callbacks.clear();
            Tracking.clear();
            PluginSystem.clear();
            CircuitBreaker.clear();
            Deduplication.clear();
            HealthCheck.stop();
            Utils.log("EventBus", "Cleared");
          },
          destroy() {
            if (this._heartbeatTimer) {
              clearInterval(this._heartbeatTimer);
              this._heartbeatTimer = null;
            }
            Deduplication.stop();
            this.clear();
            State.isReady = false;
            Utils.log("EventBus", "Destroyed");
          },
          async _handleMessage(message, sender) {
            if (!message?.__eventbus__ || message.from === State.id) {
              return;
            }
            if (Deduplication.check(message)) {
              return;
            }
            State.messageCount++;
            Tracking.stats.received++;
            Tracking.log("receive", { type: message.type, from: message.from });
            DevToolsMonitor.logEvent("receive", message, "receive");
            if (message.type === MSG.PING) {
              return { type: MSG.PONG, from: State.id };
            }
            if (message.type === MSG.PONG) {
              State.connections.set(message.from, { lastSeen: Date.now() });
              return;
            }
            if (message.type === MSG.READY) {
              State.connections.set(message.from, { lastSeen: Date.now(), env: message.fromEnv });
              return;
            }
            if (message.type === MSG.RESPONSE) {
              const cb = State.callbacks.get(message.id);
              if (cb) {
                clearTimeout(cb.timer);
                State.callbacks.delete(message.id);
                Tracking.recordLatency(message.timestamp);
                cb.resolve(message.data);
              }
              return;
            }
            if (message.type === MSG.HEALTH_CHECK) {
              return await HealthCheck.check();
            }
            if (message.type === MSG.SNAPSHOT) {
              return this.getState();
            }
            const handler = State.handlers.get(message.type);
            const subscribers = State.subscriptions.get(message.type) || [];
            await PluginSystem.executeHook("beforeHandler", { message, handler });
            if (handler && message.expectResponse) {
              try {
                const result = await handler(message.data, { from: message.from, fromEnv: message.fromEnv, sender });
                await PluginSystem.executeHook("afterHandler", { message, result });
                return { __eventbus__: true, id: message.id, type: MSG.RESPONSE, data: result, from: State.id };
              } catch (err) {
                Tracking.stats.failed++;
                await PluginSystem.executeHook("onError", { message, error: err });
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
            if (typeof window === "undefined") {
              return;
            }
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
        globalScope.EventBus = EventBus;
        if (typeof document !== "undefined") {
          document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", () => EventBus.init()) : EventBus.init();
        } else if (typeof self !== "undefined" && typeof self.importScripts === "function") {
          EventBus.init();
        } else {
          EventBus.init();
        }
        if (typeof module !== "undefined" && module.exports) {
          module.exports = EventBus;
        }
        console.log("[EventBus V4.6.0] Chrome Extension Optimized Edition loaded");
      })();
    }
  });

  // content/core/load-scheduler.js
  (function() {
    "use strict";
    if (window.LoadScheduler) {
      console.log("[LoadScheduler] \u5DF2\u5B58\u5728\uFF0C\u8DF3\u8FC7\u521D\u59CB\u5316");
      return;
    }
    const CONFIG = {
      // 空闲任务超时时间（ms）- 统一 aggressive 策略
      idleTimeout: 100,
      // 最大并发空闲任务数
      maxConcurrentIdle: 1,
      // 调试模式
      debug: false,
      // 强制执行阈值（ms）
      forceExecuteTimeout: 300
    };
    const state = {
      // 已加载的模块
      loaded: /* @__PURE__ */ new Set(),
      // 等待空闲加载的任务队列
      idleQueue: [],
      // 正在执行的空闲任务
      executingIdle: /* @__PURE__ */ new Set(),
      // 浏览器是否空闲
      isIdle: false,
      // 空闲回调 ID
      idleCallbackId: null,
      // MutationObserver 监听器
      observer: null,
      // 事件监听器引用（用于清理）
      interactionListeners: [],
      interactionTimer: null,
      // 性能监控指标
      performanceMetrics: {
        // 模块加载耗时记录 { moduleName: duration }
        moduleLoadTimes: {},
        // 空闲任务统计
        idleTasks: {
          total: 0,
          completed: 0,
          timedOut: 0
        },
        // 关键路径耗时
        criticalPath: {
          schedulerInitTime: 0,
          firstIdleTime: 0
        }
      }
    };
    function safeExecute(name, callback) {
      try {
        const result = callback();
        if (result instanceof Promise) {
          result.catch((err) => log(`"${name}" \u6267\u884C\u9519\u8BEF: ${err.message}`, "error"));
        }
      } catch (err) {
        log(`"${name}" \u6267\u884C\u9519\u8BEF: ${err.message}`, "error");
      }
    }
    function log(message, level = "info") {
      if (!CONFIG.debug && level !== "error") {
        return;
      }
      const prefix = "[LoadScheduler]";
      switch (level) {
        case "error":
          console.error(prefix, message);
          break;
        case "warn":
          console.warn(prefix, message);
          break;
        default:
          if (CONFIG.debug) {
            console.log(prefix, message);
          }
      }
    }
    function requestIdle(callback, options = {}) {
      if (typeof scheduler !== "undefined" && scheduler.postTask) {
        return scheduler.postTask(callback, {
          priority: "user-visible"
        }).then(() => {
          callback({ didTimeout: false, timeRemaining: () => 50 });
        }).catch(() => {
          _fallbackRequestIdle(callback, options);
        });
      }
      return _fallbackRequestIdle(callback, options);
    }
    function _fallbackRequestIdle(callback, options) {
      if (typeof requestIdleCallback !== "undefined") {
        return requestIdleCallback(callback, {
          timeout: options.timeout || CONFIG.idleTimeout
        });
      }
      return setTimeout(() => {
        callback({ didTimeout: false, timeRemaining: () => 50 });
      }, options.timeout || CONFIG.idleTimeout);
    }
    function startIdleScheduler() {
      if (state.idleCallbackId !== null) {
        return;
      }
      function scheduleIdle(deadline) {
        const hasTime = deadline && typeof deadline.timeRemaining === "function" ? deadline.timeRemaining() > 10 : true;
        if (hasTime && state.idleQueue.length > 0) {
          const task = state.idleQueue.shift();
          state.executingIdle.add(task.name);
          log(`\u6267\u884C\u7A7A\u95F2\u4EFB\u52A1: ${task.name}`);
          const startTime = performance.now();
          safeExecute(task.name, task.callback);
          const duration = performance.now() - startTime;
          state.performanceMetrics.moduleLoadTimes[task.name] = duration;
          state.performanceMetrics.idleTasks.completed++;
          if (CONFIG.debug) {
            log(`\u7A7A\u95F2\u4EFB\u52A1 "${task.name}" \u6267\u884C\u8017\u65F6: ${duration.toFixed(2)}ms`);
          }
          state.executingIdle.delete(task.name);
        }
        if (state.idleQueue.length > 0) {
          state.idleCallbackId = requestIdle(scheduleIdle, {
            timeout: CONFIG.idleTimeout
          });
        } else {
          state.idleCallbackId = null;
          log("\u7A7A\u95F2\u4EFB\u52A1\u961F\u5217\u5DF2\u6E05\u7A7A");
        }
      }
      state.idleCallbackId = requestIdle(scheduleIdle, {
        timeout: CONFIG.idleTimeout
      });
      log("\u7A7A\u95F2\u8C03\u5EA6\u5668\u5DF2\u542F\u52A8");
    }
    function observePageActivity() {
      const interactionEvents = ["mousedown", "keydown", "touchstart", "scroll"];
      function onInteraction() {
        state.isIdle = false;
        if (state.interactionTimer) {
          clearTimeout(state.interactionTimer);
        }
        state.interactionTimer = setTimeout(() => {
          state.isIdle = true;
          log("\u9875\u9762\u8FDB\u5165\u7A7A\u95F2\u72B6\u6001");
        }, 1e3);
      }
      interactionEvents.forEach((event) => {
        document.addEventListener(event, onInteraction, { passive: true });
        state.interactionListeners.push({ event, listener: onInteraction, target: document });
      });
      state.isIdle = true;
    }
    function destroy() {
      if (state.idleCallbackId !== null) {
        if (typeof cancelIdleCallback !== "undefined") {
          cancelIdleCallback(state.idleCallbackId);
        }
        state.idleCallbackId = null;
      }
      if (state.interactionTimer) {
        clearTimeout(state.interactionTimer);
        state.interactionTimer = null;
      }
      state.interactionListeners.forEach(({ event, listener, target }) => {
        target.removeEventListener(event, listener);
      });
      state.interactionListeners = [];
      if (state.observer) {
        state.observer.disconnect();
        state.observer = null;
      }
      state.idleQueue = [];
      state.executingIdle.clear();
      state.loaded.clear();
      log("LoadScheduler \u5DF2\u9500\u6BC1");
    }
    function registerCritical(name, callback) {
      if (state.loaded.has(name)) {
        log(`\u5173\u952E\u6A21\u5757 "${name}" \u5DF2\u52A0\u8F7D`);
        return;
      }
      log(`\u6CE8\u518C\u5173\u952E\u6A21\u5757: ${name}`);
      state.loaded.add(name);
      const startTime = performance.now();
      safeExecute(name, callback);
      const duration = performance.now() - startTime;
      state.performanceMetrics.moduleLoadTimes[name] = duration;
      if (CONFIG.debug) {
        log(`\u6A21\u5757 "${name}" \u52A0\u8F7D\u8017\u65F6: ${duration.toFixed(2)}ms`);
      }
    }
    function registerIdle(name, callback, options = {}) {
      if (state.loaded.has(name)) {
        log(`\u7A7A\u95F2\u6A21\u5757 "${name}" \u5DF2\u52A0\u8F7D`);
        return;
      }
      const { priority = 0, dependencies = [] } = options;
      log(`\u6CE8\u518C\u7A7A\u95F2\u6A21\u5757: ${name} (\u4F18\u5148\u7EA7: ${priority})`);
      const missingDeps = dependencies.filter((dep) => !state.loaded.has(dep));
      if (missingDeps.length > 0) {
        log(`\u6A21\u5757 "${name}" \u7B49\u5F85\u4F9D\u8D56: ${missingDeps.join(", ")}`);
        setTimeout(() => registerIdle(name, callback, options), 100);
        return;
      }
      state.idleQueue.push({ name, callback, priority });
      state.idleQueue.sort((a, b) => b.priority - a.priority);
      state.loaded.add(name);
      state.performanceMetrics.idleTasks.total++;
      startIdleScheduler();
    }
    function registerDeferred(name, callback) {
      if (state.loaded.has(name)) {
        log(`\u5EF6\u8FDF\u6A21\u5757 "${name}" \u5DF2\u52A0\u8F7D`);
        return;
      }
      log(`\u6CE8\u518C\u5EF6\u8FDF\u6A21\u5757: ${name}`);
      state.loaded.add(name);
      function loadWhenReady() {
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", () => {
            safeExecute(name, callback);
          });
        } else {
          safeExecute(name, callback);
        }
      }
      loadWhenReady();
    }
    function isLoaded(name) {
      return state.loaded.has(name);
    }
    function getStats() {
      return {
        loaded: Array.from(state.loaded),
        idleQueueLength: state.idleQueue.length,
        executingIdle: Array.from(state.executingIdle),
        isIdle: state.isIdle
      };
    }
    function getPerformanceMetrics() {
      return {
        moduleLoadTimes: { ...state.performanceMetrics.moduleLoadTimes },
        idleTasks: { ...state.performanceMetrics.idleTasks },
        criticalPath: { ...state.performanceMetrics.criticalPath }
      };
    }
    function setDebug(enabled) {
      CONFIG.debug = enabled;
      log(`\u8C03\u8BD5\u6A21\u5F0F ${enabled ? "\u5DF2\u542F\u7528" : "\u5DF2\u7981\u7528"}`);
    }
    function loadCoreBundle() {
      if (state.loaded.has("core-bundle")) {
        log("core-bundle \u5DF2\u52A0\u8F7D");
        return Promise.resolve();
      }
      state.loaded.add("core-bundle");
      return new Promise((resolve) => {
        function inject() {
          if (!chrome?.runtime?.getURL) {
            log("\u975E Chrome \u6269\u5C55\u73AF\u5883\uFF0C\u8DF3\u8FC7 core-bundle \u52A0\u8F7D", "warn");
            resolve();
            return;
          }
          const script = document.createElement("script");
          script.src = chrome.runtime.getURL("content/core-bundle.js");
          script.onload = () => {
            log("core-bundle.js \u52A0\u8F7D\u5B8C\u6210");
            script.remove();
            resolve();
          };
          script.onerror = (e) => {
            log(`core-bundle.js \u52A0\u8F7D\u5931\u8D25: ${e.message || e.type}`, "error");
            script.remove();
            resolve();
          };
          (document.head || document.documentElement).appendChild(script);
        }
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", inject, { once: true });
        } else {
          inject();
        }
      });
    }
    function triggerLazyLoad() {
      if (state.loaded.has("core-bundle")) {
        log("core-bundle \u5DF2\u5728\u961F\u5217\u4E2D");
        return;
      }
      log("\u6CE8\u518C core-bundle \u61D2\u52A0\u8F7D\u4EFB\u52A1");
      registerIdle("core-bundle", loadCoreBundle, {
        priority: 10
      });
    }
    observePageActivity();
    window.LoadScheduler = {
      registerCritical,
      registerIdle,
      registerDeferred,
      triggerLazyLoad,
      loadCoreBundle,
      isLoaded,
      getStats,
      getPerformanceMetrics,
      setDebug,
      destroy
    };
    console.log("[LoadScheduler] \u52A0\u8F7D\u8C03\u5EA6\u5668\u5DF2\u521D\u59CB\u5316");
  })();

  // content/entries/critical.js
  var import_event_bus_v4_6 = __toESM(require_event_bus_v4_6());

  // content/domain-config.js
  (function() {
    "use strict";
    function matchDomain(pattern, hostname) {
      if (pattern === "*") {
        return true;
      }
      if (pattern.startsWith("*://")) {
        const domain = pattern.replace("*://*.", "").replace("*://", "").replace("/*", "");
        return hostname === domain || hostname.endsWith("." + domain);
      }
      return hostname === pattern || hostname.endsWith("." + pattern);
    }
    const COMMON_SCRIPTS = ["content/common-bundle.js"];
    const DOMAIN_SCRIPTS = [
      {
        patterns: ["*://*.bilibili.com/*"],
        scripts: ["content/bundled/bili.bundle.js"]
      },
      {
        patterns: ["*://*.douyin.com/*"],
        scripts: ["content/bundled/douyin.bundle.js"],
        runAt: "document_start"
      },
      {
        patterns: ["*://*.4hu.tv/*"],
        scripts: ["content/bundled/4hu.bundle.js"]
      },
      {
        patterns: ["*://*.weread.qq.com/*"],
        scripts: ["content/bundled/weread.bundle.js"]
      },
      {
        patterns: ["*://*.quark.cn/*"],
        scripts: ["content/bundled/quark.bundle.js"]
      },
      {
        patterns: ["*://*.18comic.vip/*"],
        scripts: ["content/bundled/comic18.bundle.js"]
      },
      {
        patterns: ["*://*.aliyundrive.com/*"],
        scripts: ["content/bundled/aliyun.bundle.js"]
      },
      {
        patterns: ["*://*.baidu.com/*"],
        scripts: ["content/bundled/baiduPan.bundle.js"]
      },
      {
        patterns: ["*://*.zhipin.com/*"],
        scripts: ["content/bundled/boss.bundle.js"]
      },
      {
        patterns: ["*://*.xiaohongshu.com/*"],
        scripts: ["content/bundled/xiaohongshu.bundle.js"]
      },
      {
        patterns: ["*://*.wyaqpx.com/*"],
        scripts: ["content/bundled/dianGong.bundle.js"]
      },
      {
        patterns: ["*://*.ymmfa.com/*"],
        scripts: ["content/bundled/gongkong.bundle.js"]
      },
      {
        patterns: ["*://*.youtube.com/*"],
        scripts: ["content/bundled/youtube.bundle.js"],
        runAt: "document_start"
      },
      {
        patterns: ["*://github.com/*", "*://*.github.com/*"],
        scripts: ["content/bundled/github.bundle.js"],
        runAt: "document_start"
      },
      {
        patterns: ["*://modelscope.cn/models*", "*://*.modelscope.cn/models*"],
        scripts: ["content/bundled/modelscope.bundle.js"]
      }
    ];
    function getScriptConfig(hostname) {
      const result = {
        commonScripts: [...COMMON_SCRIPTS],
        domainScripts: [],
        runAtStart: [],
        eventbusIntegration: false,
        eventbusScript: "content/eventbus-integration.js"
      };
      for (const config of DOMAIN_SCRIPTS) {
        const matched = config.patterns.some((pattern) => matchDomain(pattern, hostname));
        if (matched) {
          if (config.runAt === "document_start") {
            result.runAtStart.push(...config.scripts);
          } else {
            result.domainScripts.push(...config.scripts);
          }
          if (config.eventbusIntegration) {
            result.eventbusIntegration = true;
          }
          if (config.eventbusScript) {
            result.eventbusScript = config.eventbusScript;
          }
        }
      }
      return result;
    }
    window.DomainConfig = {
      getScriptConfig,
      COMMON_SCRIPTS,
      DOMAIN_SCRIPTS,
      matchDomain
    };
    console.log("[DomainConfig] \u57DF\u540D\u914D\u7F6E\u6A21\u5757\u5DF2\u52A0\u8F7D");
  })();

  // content/entries/critical.js
  (function injectPageScript() {
    if (!chrome?.runtime?.getURL) {
      return;
    }
    if (window._injectScriptInjected) {
      return;
    }
    window._injectScriptInjected = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("inject.js");
    script.onload = function() {
      this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  })();
  if (window.LoadScheduler) {
    window.LoadScheduler.triggerLazyLoad();
  }
})();
//# sourceMappingURL=critical-bundle.js.map
