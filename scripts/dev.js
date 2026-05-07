/**
 * 开发模式启动脚本
 * 并行启动热重载服务器和Vite watch
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// 设置环境变量
process.env.NODE_ENV = 'development'

// 启动热重载服务器
const hotReloadServer = spawn('node', [resolve(__dirname, 'hot-reload-server.mjs')], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env },
})

// 启动Vite watch
const vite = spawn('npx', ['vite', 'build', '--watch'], {
  cwd: rootDir,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'development' },
  shell: true,
})

// 处理进程退出
process.on('SIGINT', () => {
  console.log('\n[Dev] 正在停止...')
  hotReloadServer.kill()
  vite.kill()
  process.exit(0)
})

hotReloadServer.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('[Dev] 热重载服务器异常退出')
    vite.kill()
    process.exit(code)
  }
})

vite.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('[Dev] Vite构建异常退出')
    hotReloadServer.kill()
    process.exit(code)
  }
})

console.log('[Dev] 开发模式已启动')
console.log('[Dev] 热重载服务器: http://localhost:8765')
console.log('[Dev] Vite构建监听中...')
