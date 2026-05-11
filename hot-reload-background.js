/**
 * Service Worker热重载脚本
 * 使用存储同步 + 快速轮询检查构建更新
 * 仅在开发模式下使用
 *
 * 环境检测策略：
 * 1. 构建时注入标记（最高优先级）
 * 2. 存储标记
 * 3. 服务器可达性检测
 */

(function () {
  // 检查是否在扩展环境中
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  const HOT_RELOAD_URL = 'http://localhost:8765'
  const ALARM_NAME = 'hot-reload-check'
  const CHECK_INTERVAL_MS = 500
  const MIN_RELOAD_INTERVAL = 1000
  const SERVER_TIMEOUT = 2000
  const ALARM_INTERVAL = 1

  // 环境检测器
  const EnvironmentDetector = {
    /**
     * 构建时注入标记检测
     */
    hasBuildMarker() {
      return typeof __HOT_RELOAD__ !== 'undefined' && __HOT_RELOAD__
    },

    /**
     * 存储标记检测
     */
    async hasStorageFlag() {
      try {
        const result = await chrome.storage.local.get('hotreload_enabled')
        return result.hotreload_enabled === true
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

        const response = await fetch(`${HOT_RELOAD_URL}/ping`, {
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
     */
    async isDevelopment() {
      // 构建标记优先
      if (this.hasBuildMarker()) {
        return true
      }

      // 存储标记
      if (await this.hasStorageFlag()) {
        return true
      }

      // 服务器可达性
      if (await this.canReachServer()) {
        return true
      }

      return false
    },
  }

  // 状态变量
  let lastBuildTimestamp = 0
  let lastReloadTime = 0
  let isPolling = false
  let isDev = false

  /**
   * 检查是否应该重载
   */
  function shouldReload() {
    const now = Date.now()
    return now - lastReloadTime >= MIN_RELOAD_INTERVAL
  }

  /**
   * 检查构建更新
   */
  async function checkForUpdates() {
    if (!isDev) {
      return
    }

    try {
      const extensionId = chrome.runtime.id
      const response = await fetch(`${HOT_RELOAD_URL}/reload-extension?id=${extensionId}`, {
        signal: AbortSignal.timeout(SERVER_TIMEOUT),
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()

      if (data.shouldReload && shouldReload()) {
        console.log('[HotReload] 检测到新构建，重新加载扩展...')
        lastReloadTime = Date.now()
        chrome.storage.local.set({ lastBuildTimestamp: data.timestamp })
        chrome.runtime.reload()
      }

      lastBuildTimestamp = data.timestamp
    } catch {
      // 静默失败
    }
  }

  /**
   * 快速轮询循环
   */
  async function startPolling() {
    if (isPolling || !isDev) {
      return
    }
    isPolling = true

    while (isPolling && isDev) {
      await checkForUpdates()
      await new Promise((resolve) => setTimeout(resolve, CHECK_INTERVAL_MS))
    }
  }

  /**
   * 停止轮询
   */
  function stopPolling() {
    isPolling = false
  }

  /**
   * 初始化
   */
  async function init() {
    isDev = await EnvironmentDetector.isDevelopment()

    if (!isDev) {
      console.log('[HotReload] 非开发环境，跳过热重载')
      return
    }

    console.log('[HotReload] 开发环境检测通过，启动热重载')
    startPolling()
  }

  // 监听存储变化
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local' && changes.lastBuildTimestamp) {
      const newTimestamp = changes.lastBuildTimestamp.newValue
      if (newTimestamp > lastBuildTimestamp && shouldReload()) {
        console.log('[HotReload] 存储变化触发重载...')
        lastReloadTime = Date.now()
        chrome.runtime.reload()
      }
    }

    // 监听热重载开关变化
    if (areaName === 'local' && changes.hotreload_enabled) {
      const enabled = changes.hotreload_enabled.newValue
      if (enabled && !isDev) {
        isDev = true
        startPolling()
      } else if (!enabled && isDev) {
        isDev = false
        stopPolling()
      }
    }
  })

  // 监听消息
  chrome.runtime.onMessage.addListener((message) => {
    if (!isDev) {
      return
    }

    if (message.type === 'BUILD_COMPLETE') {
      checkForUpdates()
    }
    if (message.type === 'MANIFEST_CHANGED') {
      console.log('[HotReload] Manifest 变化，完全重载...')
      chrome.runtime.reload()
    }
  })

  // Alarms API 备用
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: ALARM_INTERVAL,
  })

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) {
      return
    }
    if (!isDev) {
      // 定期重新检测环境
      await init()
    } else if (!isPolling) {
      startPolling()
    }
  })

  // 生命周期事件
  chrome.runtime.onStartup.addListener(init)
  chrome.runtime.onInstalled.addListener(init)

  // 立即初始化
  init()

  // 暴露环境检测器
  globalThis.__HotReloadDetector__ = EnvironmentDetector

  console.log('[HotReload] Service Worker 热重载模块已加载')
})()
