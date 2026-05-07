/**
 * 热重载服务器
 * - HTTP端点供Service Worker轮询检查
 * - WebSocket端点供Content Script连接
 */

import { createServer } from 'http'
import { WebSocketServer } from 'ws'

const DEFAULT_PORT = 8765
// 端口声明必须在使用之前
const PORT = process.env.HOT_RELOAD_PORT || DEFAULT_PORT

let buildTimestamp = Date.now()

// 存储所有WebSocket客户端
const wsClients = new Set()

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

  // POST /reload - 构建完成通知
  if (req.method === 'POST' && url.pathname === '/reload') {
    buildTimestamp = Date.now()
    console.log(`[HotReload] 构建完成，时间戳: ${buildTimestamp}`)

    // 通知所有WebSocket客户端
    const message = JSON.stringify({ type: 'reload', timestamp: buildTimestamp })
    wsClients.forEach((client) => {
      if (client.readyState === 1) { // WebSocket.OPEN
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
  console.log(`[HotReload] HTTP端点: GET /check-build, POST /reload`)
  console.log(`[HotReload] WebSocket端点: ws://localhost:${PORT}`)
})

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[HotReload] 端口 ${PORT} 已被占用，请设置环境变量 HOT_RELOAD_PORT`)
    process.exit(1)
  }
  throw err
})
