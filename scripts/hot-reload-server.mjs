/**
 * 热重载服务器
 * - HTTP端点供Service Worker轮询检查
 * - WebSocket端点供Content Script连接
 * - 快速重载端点供扩展主动请求
 * - Manifest 变化检测
 */

import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import { createHash } from 'crypto'
import { readFile } from 'fs/promises'
import { watch } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const DEFAULT_PORT = 8765
// 端口声明必须在使用之前
const PORT = process.env.HOT_RELOAD_PORT || DEFAULT_PORT

let buildTimestamp = Date.now()

// 存储所有WebSocket客户端
const wsClients = new Set()

// 扩展重载时间戳记录
const lastReloadTimes = new Map()

// Manifest 监控
let lastManifestHash = null
let manifestWatcher = null

// 获取根目录路径
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = join(__dirname, '..')

/**
 * 计算内容 hash
 */
function computeHash(content) {
  return createHash('md5').update(content).digest('hex')
}

/**
 * 启动 Manifest 监控
 */
function startManifestWatch() {
  const manifestPath = join(rootDir, 'manifest.json')

  // 初始读取
  readFile(manifestPath, 'utf-8')
    .then((content) => {
      lastManifestHash = computeHash(content)
    })
    .catch(() => {})

  // 监控变化
  manifestWatcher = watch(manifestPath, async (eventType) => {
    if (eventType !== 'change') return

    try {
      const content = await readFile(manifestPath, 'utf-8')
      const hash = computeHash(content)

      if (hash !== lastManifestHash) {
        lastManifestHash = hash
        console.log('[HotReload] Manifest 变化检测，通知完全重载')

        // 广播 Manifest 变化消息
        const message = JSON.stringify({
          type: 'manifest-changed',
          timestamp: Date.now()
        })
        wsClients.forEach((client) => {
          if (client.readyState === 1) {
            client.send(message)
          }
        })

        // 更新构建时间戳触发重载
        buildTimestamp = Date.now()
      }
    } catch (err) {
      console.error('[HotReload] 读取 Manifest 失败:', err.message)
    }
  })

  manifestWatcher.on('error', (err) => {
    console.error('[HotReload] Manifest 监控错误:', err.message)
  })
}

// 创建HTTP服务器
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // GET /check-build?last=<timestamp> - Service Worker轮询
  if (req.method === 'GET' && url.pathname === '/check-build') {
    const lastTimestamp = parseInt(url.searchParams.get('last') || '0', 10)
    const needsReload = buildTimestamp > lastTimestamp
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ needsReload, timestamp: buildTimestamp }))
    return
  }

  // GET /ping - 健康检查
  if (req.method === 'GET' && url.pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: Date.now() }))
    return
  }

  // GET /reload-extension - 扩展主动请求重载
  if (req.method === 'GET' && url.pathname === '/reload-extension') {
    const extensionId = url.searchParams.get('id') || 'default'
    const lastReload = lastReloadTimes.get(extensionId) || 0

    // 如果有新构建，返回重载指令
    if (buildTimestamp > lastReload) {
      lastReloadTimes.set(extensionId, buildTimestamp)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ shouldReload: true, timestamp: buildTimestamp }))
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ shouldReload: false }))
    }
    return
  }

  // POST /reload - 构建完成通知
  if (req.method === 'POST' && url.pathname === '/reload') {
    buildTimestamp = Date.now()
    console.log(`[HotReload] 构建完成，时间戳: ${buildTimestamp}`)

    // 通知所有WebSocket客户端
    const message = JSON.stringify({ type: 'reload', timestamp: buildTimestamp })
    wsClients.forEach((client) => {
      if (client.readyState === 1) {
        // WebSocket.OPEN
        client.send(message)
      }
    })

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ success: true, timestamp: buildTimestamp }))
    return
  }

  // 404 for unknown routes
  res.writeHead(404)
  res.end()
})

// WebSocket服务器
const wss = new WebSocketServer({ server })

wss.on('connection', (ws) => {
  wsClients.add(ws)
  console.log(`[HotReload] WebSocket客户端已连接，当前连接数: ${wsClients.size}`)

  ws.on('close', () => {
    wsClients.delete(ws)
    console.log(`[HotReload] WebSocket客户端已断开，当前连接数: ${wsClients.size}`)
  })

  ws.on('error', (err) => {
    console.error('[HotReload] WebSocket错误:', err.message)
    wsClients.delete(ws)
  })
})

// 优雅退出处理
process.on('SIGTERM', () => {
  console.log('[HotReload] 正在关闭服务器...')
  server.close(() => {
    wss.close()
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('[HotReload] 正在关闭服务器...')
  server.close(() => {
    wss.close()
    process.exit(0)
  })
})

server.listen(PORT, () => {
  console.log(`[HotReload] 服务器已启动: http://localhost:${PORT}`)
  console.log(`[HotReload] HTTP端点: GET /check-build, GET /reload-extension, GET /ping, POST /reload`)
  console.log(`[HotReload] WebSocket端点: ws://localhost:${PORT}`)

  // 启动 Manifest 监控
  startManifestWatch()
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[HotReload] 端口 ${PORT} 已被占用，请设置环境变量 HOT_RELOAD_PORT`)
    process.exit(1)
  }
  throw err
})
