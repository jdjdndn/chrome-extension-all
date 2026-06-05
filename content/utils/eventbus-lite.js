/**
 * EventBus Lite - 精简版EventBus
 * 仅包含document_start阶段必需的核心功能
 * 非关键功能延迟加载
 */

'use strict'

/**
 * 创建精简版EventBus
 * @param {Object} config - 配置对象
 * @returns {Object} EventBus实例
 */
export function createEventBusLite(config = {}) {
  const CONFIG = {
    DEBUG_MODE: false,
    MESSAGE_TIMEOUT: 5000,
    MAX_DATA_SIZE: 10 * 1024 * 1024,
    ...config,
  }

  const MSG = {
    PING: '__eb_ping__',
    PONG: '__eb_pong__',
    READY: '__eb_ready__',
    RESPONSE: '__eb_response__',
  }

  // 核心状态
  const State = {
    id: `eb_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    isReady: false,
    handlers: new Map(),
    subscriptions: new Map(),
    callbacks: new Map(),
    startTime: Date.now(),
    messageCount: 0,
    connections: new Map(),
  }

  // 工具函数
  const Utils = {
    generateId: (prefix = '') =>
      `${prefix}${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    safeExecute: (fn, fallback = null) => {
      try {
        return fn()
      } catch {
        return fallback
      }
    },
    log: (prefix, msg, force = false) =>
      (force || CONFIG.DEBUG_MODE) && console.log(`[${prefix}]`, msg),
    logError: (prefix, err) => CONFIG.DEBUG_MODE && console.error(`[${prefix}]`, err),
    validateType: (type) => typeof type === 'string' && type.length > 0 && type.length <= 200,
    checkDataSize: (data, maxSize = 1024 * 1024) => {
      try {
        return JSON.stringify(data).length <= maxSize
      } catch {
        return false
      }
    },
  }

  // 简化的Transport
  const Transport = {
    port: null,

    initPort() {
      if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
        return
      }
      try {
        this.port = chrome.runtime.connect({ name: 'eventbus-lite' })
        this.port.onMessage.addListener((msg) => {
          if (msg?.__eventbus__) {
            EventBus._handleMessage(msg)
          }
        })
      } catch (e) {
        Utils.logError('Transport', e)
      }
    },

    send(data) {
      if (this.port) {
        try {
          this.port.postMessage(data)
        } catch (e) {
          Utils.logError('Transport', e)
        }
      } else if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        chrome.runtime.sendMessage(data).catch(() => {})
      }
    },

    onMessage(handler) {
      if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
          if (message?.__eventbus__) {
            handler(message, sender).then(sendResponse)
            return true
          }
        })
      }
    },
  }

  // 核心EventBus
  const EventBus = {
    async init() {
      if (State.isReady) {
        return
      }

      if (typeof chrome !== 'undefined' && chrome.devtools) {
        Transport.initPort()
      }
      Transport.onMessage(this._handleMessage.bind(this))

      State.isReady = true
      setTimeout(() => this.publish(MSG.READY, { from: State.id }), 100)
      Utils.log('EventBus', `Lite initialized`, true)
    },

    publish(type, data, options = {}) {
      if (!State.isReady) {
        Utils.log('EventBus', 'Not ready, queuing message')
        return Promise.resolve(null)
      }

      if (!Utils.validateType(type)) {
        Utils.logError('EventBus', `Invalid type: ${type}`)
        return Promise.resolve(null)
      }

      if (!Utils.checkDataSize(data, CONFIG.MAX_DATA_SIZE)) {
        Utils.logError('EventBus', `Data too large: ${type}`)
        return Promise.resolve(null)
      }

      const message = {
        __eventbus__: true,
        id: Utils.generateId('msg_'),
        type,
        data,
        from: State.id,
        timestamp: Date.now(),
        expectResponse: options.expectResponse !== false,
      }

      State.messageCount++

      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          State.callbacks.delete(message.id)
          reject(new Error(`Timeout: ${type}`))
        }, CONFIG.MESSAGE_TIMEOUT)

        State.callbacks.set(message.id, { resolve, reject, timer })
        Transport.send(message)
      })
    },

    subscribe(type, callback) {
      if (!State.subscriptions.has(type)) {
        State.subscriptions.set(type, [])
      }
      State.subscriptions.get(type).push(callback)
      return () => this.off(type, callback)
    },

    on(type, handler) {
      State.handlers.set(type, handler)
    },

    off(type, callback) {
      if (callback && State.subscriptions.has(type)) {
        const subs = State.subscriptions.get(type)
        const idx = subs.indexOf(callback)
        if (idx > -1) {
          subs.splice(idx, 1)
        }
      } else {
        State.subscriptions.delete(type)
        State.handlers.delete(type)
      }
    },

    once(type, callback) {
      const wrapper = (data, source) => {
        this.off(type, wrapper)
        callback(data, source)
      }
      return this.subscribe(type, wrapper)
    },

    async _handleMessage(message) {
      if (!message?.__eventbus__ || message.from === State.id) {
        return
      }

      State.messageCount++

      if (message.type === MSG.PING) {
        return { type: MSG.PONG, from: State.id }
      }
      if (message.type === MSG.PONG) {
        State.connections.set(message.from, { lastSeen: Date.now() })
        return
      }
      if (message.type === MSG.READY) {
        State.connections.set(message.from, { lastSeen: Date.now() })
        return
      }
      if (message.type === MSG.RESPONSE) {
        const cb = State.callbacks.get(message.id)
        if (cb) {
          clearTimeout(cb.timer)
          State.callbacks.delete(message.id)
          cb.resolve(message.data)
        }
        return
      }

      const handler = State.handlers.get(message.type)
      const subscribers = State.subscriptions.get(message.type) || []

      if (handler && message.expectResponse) {
        const result = await handler(message.data, { from: message.from })
        return {
          __eventbus__: true,
          id: message.id,
          type: MSG.RESPONSE,
          data: result,
          from: State.id,
        }
      }

      for (const sub of subscribers) {
        Utils.safeExecute(() => sub(message.data, { from: message.from }))
      }
      return null
    },

    getState() {
      return {
        id: State.id,
        isReady: State.isReady,
        uptime: Date.now() - State.startTime,
        handlers: [...State.handlers.keys()],
        subscriptions: [...State.subscriptions.keys()],
        connections: State.connections.size,
        version: 'lite',
      }
    },

    clear() {
      State.subscriptions.clear()
      State.handlers.clear()
      State.callbacks.forEach((cb) => clearTimeout(cb.timer))
      State.callbacks.clear()
      Utils.log('EventBus', 'Cleared')
    },

    destroy() {
      this.clear()
      State.isReady = false
      Utils.log('EventBus', 'Destroyed')
    },
  }

  return EventBus
}

// 全局注册
if (typeof window !== 'undefined') {
  window.EventBusLite = createEventBusLite
}

export default createEventBusLite
