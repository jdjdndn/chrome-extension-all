/**
 * EventBus 集成模块 - 通用版
 * 为所有 content scripts 添加 EventBus 支持
 * 取代 MessagingUtils，提供统一的通信接口
 *
 * 使用 ScriptLoader 进行依赖管理
 */

;(function () {
  'use strict'

  console.log('[EventBus集成] 初始化...')

  // 兼容 MessagingUtils 的接口
  const MessagingUtilsCompat = {
    isExtensionContext() {
      return typeof chrome !== 'undefined' && chrome.runtime
    },

    // 检查扩展上下文是否有效
    isExtensionContextValid() {
      try {
        return typeof chrome !== 'undefined' && chrome.runtime && !!chrome.runtime.id
      } catch {
        return false
      }
    },

    // 发送消息到 background（使用 EventBus）
    async sendToBackground(message) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪')
        return null
      }
      return await EventBus.request(message.type, message, { target: 'background' })
    },

    // 创建消息处理器（使用 EventBus.on）
    createMessageHandler(handlerId, handlers) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪，跳过注册')
        return false
      }

      if (window[handlerId]) {
        console.log(`[EventBus兼容] 处理器 ${handlerId} 已存在，跳过注册`)
        return false
      }

      window[handlerId] = true
      console.log(`[EventBus兼容] 注册消息处理器: ${handlerId}`)

      // 将所有处理器注册到 EventBus
      for (const [type, handler] of Object.entries(handlers)) {
        EventBus.on(type, (data) => {
          return handler({ type, ...data })
        })
      }

      return true
    },

    // 注册阻止域名
    async registerBlockedDomains(domain, blockedDomains) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪')
        return null
      }
      return await EventBus.request(
        'REGISTER_BLOCKED_DOMAINS',
        {
          domain,
          blockedDomains,
        },
        { target: 'background' }
      )
    },

    // 检查域名是否被阻止
    async checkDomainBlocked(currentDomain, requestDomain) {
      if (!window.EventBus) {
        console.warn('[EventBus兼容] EventBus 未就绪')
        return null
      }
      return await EventBus.request(
        'CHECK_DOMAIN_BLOCKED',
        {
          currentDomain,
          requestDomain,
        },
        { target: 'background' }
      )
    },

    // 检查 EventBus 是否就绪
    isEventBusReady() {
      return typeof EventBus !== 'undefined' && EventBus.getState && EventBus.getState().isReady
    },

    // 等待 EventBus 就绪（使用 ScriptLoader 事件驱动）
    async waitForEventBus(timeout = 3000) {
      // 如果已就绪，立即返回
      if (this.isEventBusReady()) {
        return true
      }

      // 优先使用 ScriptLoader 的事件驱动机制
      if (window.ScriptLoader) {
        return ScriptLoader.waitFor(['EventBus'], timeout)
      }

      // 降级到轮询（兼容旧代码）
      return new Promise((resolve) => {
        const startTime = Date.now()
        const checkInterval = setInterval(() => {
          if (this.isEventBusReady()) {
            clearInterval(checkInterval)
            resolve(true)
          } else if (Date.now() - startTime > timeout) {
            clearInterval(checkInterval)
            resolve(false)
          }
        }, 100)
      })
    },

    // 订阅事件
    subscribe(type, callback) {
      if (this.isEventBusReady()) {
        return EventBus.subscribe(type, callback)
      }
      return () => {}
    },

    // 发布事件
    async publish(type, data) {
      if (this.isEventBusReady()) {
        await EventBus.publish(type, data)
      }
    },
  }

  // 导出兼容接口
  window.MessagingUtils = MessagingUtilsCompat

  // 等待 EventBus 就绪
  function waitForEventBus(callback) {
    const maxWait = 10000
    const checkInterval = 100
    let attempts = 0

    // 立即检查一次，如果 EventBus 已就绪则直接执行
    if (window.EventBus && EventBus.getState && EventBus.getState().isReady) {
      console.log('[EventBus集成] ✓ EventBus 已就绪（立即）')
      // 通知 ScriptLoader
      if (window.ScriptLoader) {
        ScriptLoader.markReady('EventBus')
      }
      callback()
      return
    }

    // 如果 EventBus 存在但未初始化，尝试主动初始化
    if (window.EventBus && EventBus.init && EventBus.getState && !EventBus.getState().isReady) {
      console.log('[EventBus集成] 触发 EventBus 初始化')
      try {
        EventBus.init()
      } catch (e) {
        console.warn('[EventBus集成] EventBus 初始化失败:', e)
      }
    }

    // 如果 EventBus 不存在，检查是否需要等待
    if (!window.EventBus) {
      console.warn('[EventBus集成] EventBus 未定义，可能未正确加载')
    }

    const interval = setInterval(() => {
      attempts++

      // 检查 EventBus 是否存在且就绪
      if (window.EventBus && EventBus.getState && EventBus.getState().isReady) {
        clearInterval(interval)
        console.log('[EventBus集成] ✓ EventBus 已就绪')
        // 通知 ScriptLoader
        if (window.ScriptLoader) {
          ScriptLoader.markReady('EventBus')
        }
        callback()
      } else if (attempts * checkInterval >= maxWait) {
        clearInterval(interval)
        console.warn('[EventBus集成] ⚠️ 等待 EventBus 超时，继续使用 MessagingUtils')
        // 即使 EventBus 未就绪，也调用回调以初始化 MessagingUtils 处理器
        callback()
      }
    }, checkInterval)
  }

  // 注册所有消息处理器
  function registerHandlers() {
    // 检查 EventBus 是否可用
    if (!window.EventBus) {
      console.warn('[EventBus集成] EventBus 不可用，使用降级模式')
      // 即使 EventBus 不可用，也标记 MessagingUtils 就绪以允许其他脚本继续
      if (window.ScriptLoader) {
        ScriptLoader.markReady('MessagingUtils')
      }
      return
    }

    // 检查 EventBus 是否已初始化
    if (!EventBus.getState || !EventBus.getState().isReady) {
      console.warn('[EventBus集成] EventBus 存在但未初始化，尝试初始化...')
      try {
        if (EventBus.init) {
          EventBus.init()
        }
      } catch (e) {
        console.warn('[EventBus集成] 初始化失败:', e)
      }
    }

    console.log('[EventBus集成] 注册消息处理器...')

    // 获取当前网站的默认配置（如果存在）
    const scriptConfig = window[Object.keys(window).find((key) => key.includes('ScriptConfig'))]
    if (scriptConfig) {
      console.log('[EventBus集成] 找到配置:', Object.keys(scriptConfig))
    }

    // GET_DEFAULT_HIDE_SELECTORS - 所有网站都需要
    EventBus.on('GET_DEFAULT_HIDE_SELECTORS', () => {
      if (typeof DEFAULT_HIDE_SELECTORS !== 'undefined') {
        console.log('[EventBus集成] 返回默认选择器:', DEFAULT_HIDE_SELECTORS.length, '个')
        return { success: true, selectors: DEFAULT_HIDE_SELECTORS }
      }
      return { success: true, selectors: [] }
    })

    // GET_CURRENT_HIDE_SELECTORS
    EventBus.on('GET_CURRENT_HIDE_SELECTORS', () => {
      if (typeof currentSelectors !== 'undefined') {
        return { success: true, selectors: currentSelectors }
      }
      return { success: true, selectors: [] }
    })

    // UPDATE_HIDE_ELEMENTS - 所有网站都需要
    EventBus.on('UPDATE_HIDE_ELEMENTS', (data) => {
      console.log('[EventBus集成] 收到 UPDATE_HIDE_ELEMENTS')
      if (typeof updateHideElements === 'function') {
        const { enabled, selectors } = data
        if (enabled && selectors?.length > 0) {
          updateHideElements(selectors)
        } else {
          if (typeof DOMUtils !== 'undefined') {
            const STYLE_TAG_ID =
              typeof STYLE_TAG_ID !== 'undefined' ? STYLE_TAG_ID : 'hide-elements-style'
            DOMUtils.removeStyle(STYLE_TAG_ID)
          }
        }
      }
      return { success: true }
    })

    // UPDATE_KEYWORDS - douyin, bili 需要
    EventBus.on('UPDATE_KEYWORDS', (data) => {
      console.log('[EventBus集成] 收到 UPDATE_KEYWORDS')
      if (typeof NOT_INTERESTED_KEYWORDS !== 'undefined') {
        const { keywords } = data
        if (keywords.NOT_INTERESTED_KEYWORDS) {
          NOT_INTERESTED_KEYWORDS.length = 0
          NOT_INTERESTED_KEYWORDS.push(...[...new Set(keywords.NOT_INTERESTED_KEYWORDS)])
          console.log('[EventBus集成] 不感兴趣关键词已更新')
        }
      }
      if (typeof AUTO_FOLLOW_KEYWORDS !== 'undefined') {
        const { keywords } = data
        if (keywords.AUTO_FOLLOW_KEYWORDS) {
          AUTO_FOLLOW_KEYWORDS.length = 0
          AUTO_FOLLOW_KEYWORDS.push(...[...new Set(keywords.AUTO_FOLLOW_KEYWORDS)])
          console.log('[EventBus集成] 自动关注关键词已更新')
        }
      }
      return { success: true }
    })

    // TOGGLE_EXTENSION - 所有网站
    EventBus.on('TOGGLE_EXTENSION', (data) => {
      console.log('[EventBus集成] 收到 TOGGLE_EXTENSION:', data.enabled)
      return { success: true }
    })

    // 订阅系统事件
    EventBus.subscribe('PING', () => {
      // 响应 ping
    })

    EventBus.subscribe('COMPONENT_READY', (data) => {
      console.log('[EventBus集成] 组件就绪:', data.component)
    })

    console.log('[EventBus集成] ✓ 处理器注册完成')
  }

  // 标记组件就绪
  function markReady() {
    if (window.EventBus && EventBus.publish) {
      const componentName = window.location.hostname.replace('www.', '').split('.')[0]

      EventBus.publish('COMPONENT_READY', {
        component: componentName + '_script',
        url: window.location.href,
        version: '1.0.0',
        timestamp: Date.now(),
      })
      console.log('[EventBus集成] ✓ 已发布 COMPONENT_READY 事件')
    }
  }

  // 初始化
  waitForEventBus(() => {
    registerHandlers()
    markReady()

    // 通知 ScriptLoader：MessagingUtils 已就绪
    if (window.ScriptLoader) {
      ScriptLoader.markReady('MessagingUtils')
      console.log('[EventBus集成] ✓ 已通知 ScriptLoader: MessagingUtils 就绪')
    }
  })
})()
