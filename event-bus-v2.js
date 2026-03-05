/**
 * ========================================
 * EventBus V2 - 增强版统一通信事件总线
 * ========================================
 * 新增功能：
 * - 消息追踪和调试
 * - 连接事件通知
 * - 性能监控
 * - once/clear/off API
 * - 更好的错误处理
 */

(function () {
  'use strict';

  // 获取全局对象
  const globalThis = (typeof self !== 'undefined') ? self :
                     (typeof window !== 'undefined') ? window :
                     (typeof global !== 'undefined') ? global : this;

  // ==================== 配置 ====================
  const CONFIG = {
    HEARTBEAT_INTERVAL: 30000,
    MESSAGE_TIMEOUT: 5000,
    ACK_TIMEOUT: 2000,
    MAX_RETRY: 3,
    RETRY_DELAY: 200,
    DEBUG_MODE: false,
    ENABLE_TRACKING: true,
    MAX_TRACKING_SIZE: 500,
    STORAGE_KEY: '__eventbus_state__',
    BROADCAST_CHANNEL: '__chrome_extension_bus__'
  };

  // ==================== 消息追踪 ====================
  const Tracking = {
    messages: [],
    stats: { sent: 0, received: 0, failed: 0, timeout: 0 },

    log(type, message, data = {}) {
      if (!CONFIG.ENABLE_TRACKING) return;
      this.messages.push({
        timestamp: Date.now(),
        type,
        messageType: message?.type,
        from: message?.from,
        to: message?.target,
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
      if (filter.limit) history = history.slice(-filter.limit);
      return history;
    },

    clear() {
      this.messages = [];
      this.stats = { sent: 0, received: 0, failed: 0, timeout: 0 };
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
    RESPONSE: '__eb_response__'
  };

  // ==================== 状态管理 ====================
  const State = {
    instanceId: `${ENV}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    isReady: false,
    connections: new Map(),
    callbacks: new Map(),
    subscriptions: new Map(),
    onceCallbacks: new Map(),
    handlers: new Map(),
    connectionListeners: [],
    startTime: Date.now(),
    messageCount: 0
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

      // 广播就绪状态
      setTimeout(() => {
        this.publish(MESSAGE_TYPES.READY, {
          from: State.instanceId,
          env: ENV
        });
      }, 100);

      if (CONFIG.DEBUG_MODE) {
        console.log('[EventBus] 初始化完成', { env: ENV, id: State.instanceId });
      }
    },

    /**
     * 发送请求（等待响应）
     */
    async request(type, data = {}, options = {}) {
      const { timeout = CONFIG.MESSAGE_TIMEOUT } = options;
      const messageId = `${State.instanceId}_${++State.messageCount}`;

      const message = {
        __eventbus__: true,
        id: messageId,
        type,
        data,
        from: State.instanceId,
        fromEnv: ENV,
        timestamp: Date.now(),
        expectResponse: true
      };

      Tracking.log('send', message);

      return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          State.callbacks.delete(messageId);
          Tracking.stats.timeout++;
          Tracking.log('timeout', message);
          reject(new Error(`Message timeout: ${type}`));
        }, timeout);

        State.callbacks.set(messageId, {
          resolve: (data) => {
            clearTimeout(timeoutId);
            Tracking.stats.received++;
            resolve(data);
          },
          reject,
          timeoutId
        });

        this._sendMessage(message).catch((error) => {
          clearTimeout(timeoutId);
          State.callbacks.delete(messageId);
          Tracking.stats.failed++;
          Tracking.log('failed', message, { error: error.message });
          reject(error);
        });
      });
    },

    /**
     * 发布事件（不等待响应）
     */
    async publish(type, data = {}) {
      const message = {
        __eventbus__: true,
        id: `${State.instanceId}_${++State.messageCount}`,
        type,
        data,
        from: State.instanceId,
        fromEnv: ENV,
        timestamp: Date.now(),
        expectResponse: false
      };

      Tracking.stats.sent++;
      Tracking.log('send', message);
      return this._sendMessage(message);
    },

    /**
     * 订阅事件
     */
    subscribe(type, callback) {
      if (!State.subscriptions.has(type)) {
        State.subscriptions.set(type, []);
      }
      State.subscriptions.get(type).push(callback);

      if (CONFIG.DEBUG_MODE) {
        console.log(`[EventBus] 订阅: ${type}`);
      }

      // 返回取消订阅函数
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
      if (!State.subscriptions.has(type)) return;

      if (callback) {
        const callbacks = State.subscriptions.get(type);
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      } else {
        State.subscriptions.delete(type);
      }

      if (CONFIG.DEBUG_MODE) {
        console.log(`[EventBus] 取消订阅: ${type}`);
      }
    },

    /**
     * 注册处理器
     */
    on(type, handler) {
      State.handlers.set(type, handler);
      if (CONFIG.DEBUG_MODE) {
        console.log(`[EventBus] 注册处理器: ${type}`);
      }
    },

    /**
     * 移除处理器
     */
    removeHandler(type) {
      State.handlers.delete(type);
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
      State.callbacks.forEach(cb => clearTimeout(cb.timeout));
      State.callbacks.clear();
      Tracking.clear();
      if (CONFIG.DEBUG_MODE) {
        console.log('[EventBus] 已清理');
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
        uptime: Date.now() - State.startTime,
        messageCount: State.messageCount,
        stats: Tracking.getStats()
      };
    },

    /**
     * 设置调试模式
     */
    setDebugMode(enabled) {
      CONFIG.DEBUG_MODE = enabled;
      CONFIG.ENABLE_TRACKING = enabled;
    },

    /**
     * 获取消息历史
     */
    getHistory(filter) {
      return Tracking.getHistory(filter);
    },

    /**
     * 获取统计信息
     */
    getStats() {
      return Tracking.getStats();
    },

    // ==================== 内部方法 ====================

    async _sendMessage(message) {
      try {
        await Transport.broadcast(message);
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

      // 调用处理器
      const handler = State.handlers.get(message.type);
      if (handler && message.expectResponse) {
        try {
          const response = await handler(message.data, {
            from: message.from,
            fromEnv: message.fromEnv
          });
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
      const subscribers = State.subscriptions.get(message.type);
      if (subscribers) {
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
      }

      return null;
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
      if (typeof window === 'undefined') return; // service worker 不需要心跳

      setInterval(() => {
        this.publish(MESSAGE_TYPES.PING, {});

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
    console.log('[EventBus] 模块已加载');
  }

})();
