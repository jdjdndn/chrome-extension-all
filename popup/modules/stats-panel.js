/**
 * Popup 统计面板模块
 * 负责统计数据的加载、渲染和导出
 * 按需加载：仅在 stats tab 使用
 */

import { sendMessage } from '../popup-core.js'

/**
 * 初始化统计面板
 */
export async function initStatsPanel() {
  console.log('[StatsPanel] 初始化')

  // 绑定按钮事件
  initStatsButtons()
}

/**
 * 初始化统计按钮事件
 */
function initStatsButtons() {
  const refreshBtn = document.getElementById('refresh-stats')
  const resetBtn = document.getElementById('reset-stats')
  const exportCsvBtn = document.getElementById('export-stats-csv')

  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadStatsData()
      drawStatsChart()
    })
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
      if (await showConfirm('确定要重置所有统计数据吗？')) {
        await chrome.storage.local.remove('usageStats')
        loadStatsData()
        drawStatsChart()
      }
    })
  }

  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', exportStatsToCSV)
  }
}

/**
 * 加载统计数据
 */
export async function loadStatsData() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' })
    if (response?.success && response.stats) {
      renderStats(response.stats)
    }
  } catch (error) {
    console.error('[Stats] 加载统计数据失败:', error)
  }
}

/**
 * 渲染统计数据
 */
function renderStats(stats) {
  // 今日数据
  const todayBlocked = document.getElementById('today-blocked')
  const todayHidden = document.getElementById('today-hidden')
  const todayBytes = document.getElementById('today-bytes')

  if (todayBlocked) {todayBlocked.textContent = formatNumber(stats.today?.blocked || 0)}
  if (todayHidden) {todayHidden.textContent = formatNumber(stats.today?.hidden || 0)}
  if (todayBytes) {todayBytes.textContent = formatBytes(stats.today?.bytes || 0)}

  // 累计数据
  const totalBlocked = document.getElementById('total-blocked')
  const totalHidden = document.getElementById('total-hidden')
  const totalBytes = document.getElementById('total-bytes')

  if (totalBlocked) {totalBlocked.textContent = formatNumber(stats.totalBlocked || 0)}
  if (totalHidden) {totalHidden.textContent = formatNumber(stats.totalHidden || 0)}
  if (totalBytes) {totalBytes.textContent = formatBytes(stats.estimatedBytesSaved || 0)}

  // 域名排行
  renderDomainRanking(stats.domainStats || {})
}

/**
 * 渲染域名排行
 */
function renderDomainRanking(domainStats) {
  const container = document.getElementById('domain-ranking')
  if (!container) {return}

  const entries = Object.entries(domainStats)
    .map(([domain, data]) => ({
      domain,
      total: (data.blocked || 0) + (data.hidden || 0),
    }))
    .filter(e => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  if (entries.length === 0) {
    container.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无数据</div>'
    return
  }

  const maxTotal = entries[0].total
  container.innerHTML = entries
    .map((e, i) => {
      const percent = Math.round((e.total / maxTotal) * 100)
      return `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
          <span style="width: 16px; color: #666; font-size: 11px;">${i + 1}.</span>
          <div style="flex: 1;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
              <span style="font-size: 11px; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">${escapeHtml(e.domain)}</span>
              <span style="font-size: 11px; color: #666;">${e.total}</span>
            </div>
            <div style="height: 4px; background: #e9ecef; border-radius: 2px; overflow: hidden;">
              <div style="height: 100%; width: ${percent}%; background: linear-gradient(90deg, #007bff, #0056b3); border-radius: 2px;"></div>
            </div>
          </div>
        </div>
      `
    })
    .join('')
}

/**
 * 格式化数字
 */
function formatNumber(num) {
  if (num >= 1000000) {return (num / 1000000).toFixed(1) + 'M'}
  if (num >= 1000) {return (num / 1000).toFixed(1) + 'K'}
  return String(num)
}

/**
 * 格式化字节
 */
function formatBytes(bytes) {
  if (bytes >= 1073741824) {return (bytes / 1073741824).toFixed(1) + 'GB'}
  if (bytes >= 1048576) {return (bytes / 1048576).toFixed(1) + 'MB'}
  if (bytes >= 1024) {return (bytes / 1024).toFixed(1) + 'KB'}
  return bytes + 'B'
}

/**
 * 绘制统计图表
 */
export function drawStatsChart() {
  const canvas = document.getElementById('stats-chart')
  if (!canvas) {return}

  const ctx = canvas.getContext('2d')
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight

  canvas.width = width * 2
  canvas.height = height * 2
  ctx.scale(2, 2)

  ctx.clearRect(0, 0, width, height)

  const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  const data = [120, 150, 80, 200, 180, 90, 140]

  const maxVal = Math.max(...data, 1)
  const padding = 30
  const chartWidth = width - padding * 2
  const chartHeight = height - padding * 2
  const barWidth = chartWidth / days.length - 10

  // 绘制背景网格
  ctx.strokeStyle = '#e9ecef'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = padding + (chartHeight / 4) * i
    ctx.beginPath()
    ctx.moveTo(padding, y)
    ctx.lineTo(width - padding, y)
    ctx.stroke()
  }

  // 绘制柱状图
  const gradient = ctx.createLinearGradient(0, height, 0, 0)
  gradient.addColorStop(0, '#007bff')
  gradient.addColorStop(1, '#0056b3')

  data.forEach((val, i) => {
    const barHeight = (val / maxVal) * chartHeight
    const x = padding + i * (chartWidth / days.length) + 5
    const y = height - padding - barHeight

    ctx.fillStyle = gradient
    ctx.fillRect(x, y, barWidth, barHeight)

    ctx.fillStyle = '#666'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(days[i], x + barWidth / 2, height - 10)
  })
}

/**
 * 导出统计 CSV
 */
async function exportStatsToCSV() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' })
    if (!response?.stats) {
      showToast('暂无数据可导出', 'info')
      return
    }

    const stats = response.stats
    let csv = '日期,拦截请求,隐藏元素,节省流量\n'

    const today = new Date().toISOString().split('T')[0]
    csv += `${today},${stats.today?.blocked || 0},${stats.today?.hidden || 0},${stats.today?.bytes || 0}\n`
    csv += `累计,${stats.totalBlocked || 0},${stats.totalHidden || 0},${stats.estimatedBytesSaved || 0}\n`

    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `extension-stats-${today}.csv`
    a.click()
    URL.revokeObjectURL(url)
  } catch (error) {
    console.error('[导出CSV] 失败:', error)
    showToast('导出失败: ' + error.message, 'error')
  }
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
