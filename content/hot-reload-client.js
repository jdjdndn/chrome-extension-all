/**
 * Content Script热重载客户端
 * 通过WebSocket连接热重载服务器，接收重载通知
 * 仅在开发模式下使用
 *
 * 环境检测策略：
 * 1. 构建时注入标记（最高优先级）
 * 2. URL 参数检测（?hotreload 或 ?dev）
 * 3. 服务器可达性检测
 */

(function () {
  'use strict'

  const HOT_RELOAD_URL = 'ws://localhost:8765'
  const HTTP_URL = 'http://localhost:8765'
  const SERVER_TIMEOUT = 2000

  // 环境检测器
  const EnvironmentDetector = {
    /**
     * 构建时注入标记检测
     */
    hasBuildMarker() {
      return typeof __HOT_RELOAD__ !== 'undefined' && __HOT_RELOAD__
    },

    /**
     * URL 参数检测
     */
    hasUrlParam() {
      try {
        const params = new URLSearchParams(location.search)
        return params.has('hotreload') || params.has('dev')
      } catch {
        return false
      }
    },

    /**
     * 存储标记检测
     */
    hasStorageFlag() {
      try {
        return localStorage.getItem('hotreload_enabled') === 'true'
      } catch {
        return false
      }
    },

    /**
     * 服务器可达性检测
     */
    async canReachServer() {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), SERVER_TIMEOUT)

        const response = await fetch(`${HTTP_URL}/ping`, {
          method: 'GET',
          signal: controller.signal,
        })

        clearTimeout(timeout)
        return response.ok
      } catch {
        return false
      }
    },

    /**
     * 综合判断是否在开发环境
     * @returns {Promise<boolean>}
     */
    async isDevelopment() {
      // 构建标记优先级最高
      if (this.hasBuildMarker()) {
        return true
      }

      // URL 参数次之
      if (this.hasUrlParam()) {
        return true
      }

      // 存储标记
      if (this.hasStorageFlag()) {
        return true
      }

      // 服务器可达性检测
      if (await this.canReachServer()) {
        return true
      }

      return false
    },
  }

  // 状态变量
  let ws = null
  let reconnectTimeout = null
  let hasConnected = false
  let serverAvailable = false
  let isDev = false
  let checkCount = 0
  const MAX_CHECKS = 3

  /**
   * 检查热重载服务器是否可用
   */
  async function checkServerAvailable() {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), SERVER_TIMEOUT)

      const response = await fetch(`${HTTP_URL}/ping`, {
        method: 'GET',
        signal: controller.signal,
      })

      clearTimeout(timeout)

      if (response.ok) {
        serverAvailable = true
        return true
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * 通知 Service Worker Manifest 变化
   */
  function notifyManifestChanged() {
    try {
      chrome.runtime.sendMessage({ type: 'MANIFEST_CHANGED' })
    } catch {
      // 扩展可能已重载，静默失败
    }
  }

  /**
   * 连接 WebSocket
   */
  function connect() {
    if (!serverAvailable || !isDev) {
      return
    }

    try {
      ws = new WebSocket(HOT_RELOAD_URL)

      ws.onopen = () => {
        console.log('[HotReload] 已连接到开发服务器')
        hasConnected = true
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)

          switch (data.type) {
            case 'reload':
              console.log('[HotReload] 检测到文件变更，正在刷新...')
              location.reload()
              break

            case 'manifest-changed':
              console.log('[HotReload] Manifest 变化，通知扩展重载...')
              notifyManifestChanged()
              break

            default:
              break
          }
        } catch {
          // 忽略解析错误
        }
      }

      ws.onclose = () => {
        if (hasConnected) {
          hasConnected = false
          scheduleReconnect()
        }
      }

      ws.onerror = () => {
        if (ws) {
          ws.close()
        }
      }
    } catch {
      // 静默处理异常
    }
  }

  /**
   * 重连逻辑
   */
  function scheduleReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }

    if (!hasConnected || !isDev) {
      return
    }

    reconnectTimeout = setTimeout(() => {
      checkServerAvailable().then((available) => {
        if (available) {
          connect()
        }
      })
    }, 1000)
  }

  /**
   * 初始化
   */
  async function init() {
    // 检查是否在 http/https 页面
    if (location.protocol !== 'http:' && location.protocol !== 'https:') {
      return
    }

    // 环境检测
    isDev = await EnvironmentDetector.isDevelopment()

    if (!isDev) {
      console.log('[HotReload] 非开发环境，跳过热重载')
      return
    }

    console.log('[HotReload] 开发环境检测通过，启动热重载')

    // 延迟检测服务器
    await new Promise((resolve) => setTimeout(resolve, 500))

    const available = await checkServerAvailable()

    if (available) {
      connect()
      return
    }

    // 服务器未启动，延迟重试
    checkCount++
    if (checkCount < MAX_CHECKS) {
      setTimeout(() => init(), 3000)
    }
  }

  // 暴露环境检测器供外部使用
  window.__HotReloadDetector__ = EnvironmentDetector

  // 启动初始化
  init()
})()
