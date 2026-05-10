/**
 * Service Worker热重载脚本
 * 使用chrome.alarms定期轮询检查构建更新
 * 仅在开发模式下使用
 */

(function () {
  // 检查是否在扩展环境中
  if (typeof chrome === 'undefined' || !chrome.alarms) {
    return
  }

  const HOT_RELOAD_URL = 'http://localhost:8765'
  const ALARM_NAME = 'hot-reload-check'
  const CHECK_INTERVAL = 2 // 秒

  // 记录上次检查的时间戳
  let lastBuildTimestamp = 0

  // 检查构建更新的函数
  async function checkForUpdates() {
    try {
      const response = await fetch(`${HOT_RELOAD_URL}/check-build?last=${lastBuildTimestamp}`)
      if (!response.ok) {return}

      const data = await response.json()

      if (data.needsReload) {
        console.log('[HotReload] 检测到新构建，重新加载扩展...')
        chrome.runtime.reload()
      }

      lastBuildTimestamp = data.timestamp
    } catch (err) {
      // 静默失败，服务器可能未启动
    }
  }

  // 创建定期检查的alarm
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL / 60,
  })

  // 监听alarm
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name !== ALARM_NAME) {return}
    await checkForUpdates()
  })

  // 启动时立即检查一次
  checkForUpdates()

  console.log('[HotReload] Service Worker热重载已启用')
})()
