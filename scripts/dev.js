/**
 * 开发模式启动脚本
 * 并行启动热重载服务器、Vite watch 和 ESLint watch
 */

import { spawn } from 'child_process'
import { watch } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve, relative } from 'path'
import { debounce } from './utils/debounce.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const rootDir = resolve(__dirname, '..')

// 设置环境变量
process.env.NODE_ENV = 'development'

// Lint 状态
let lintProcess = null
let lastLintTime = 0

// 执行 lint
const runLint = debounce(() => {
  const now = Date.now()
  if (now - lastLintTime < 1000) {
    return
  } // 防抖 1秒
  lastLintTime = now

  if (lintProcess) {
    lintProcess.kill()
  }

  lintProcess = spawn('npx', ['eslint', '.', '--ignore-pattern', 'dist'], {
    cwd: rootDir,
    stdio: 'inherit',
    shell: true,
  })

  lintProcess.on('exit', (code) => {
    if (code === 0) {
      console.log('\n[Lint] ✓ 无错误\n')
    }
    lintProcess = null
  })
}, 1000)

// 监听文件变化
const watchOptions = { recursive: true }
const watchDirs = ['content', 'background', 'popup', 'scripts', 'lib']
const watchers = []

watchDirs.forEach((dir) => {
  const fullPath = resolve(rootDir, dir)
  try {
    const watcher = watch(fullPath, watchOptions, (eventType, filename) => {
      if (filename && (filename.endsWith('.js') || filename.endsWith('.ts'))) {
        const relPath = relative(rootDir, resolve(fullPath, filename))
        console.log(`\n[Lint] 检测到变化: ${relPath}`)
        runLint()
      }
    })
    watchers.push(watcher)
  } catch (e) {
    // 目录不存在时忽略
  }
})

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
  if (lintProcess) {
    lintProcess.kill()
  }
  watchers.forEach((w) => w.close())
  process.exit(0)
})

hotReloadServer.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('[Dev] 热重载服务器异常退出')
    vite.kill()
    if (lintProcess) {
      lintProcess.kill()
    }
    watchers.forEach((w) => w.close())
    process.exit(code)
  }
})

vite.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error('[Dev] Vite构建异常退出')
    hotReloadServer.kill()
    if (lintProcess) {
      lintProcess.kill()
    }
    watchers.forEach((w) => w.close())
    process.exit(code)
  }
})

console.log('[Dev] 开发模式已启动')
console.log('[Dev] 热重载服务器: http://localhost:8765')
console.log('[Dev] Vite构建监听中...')
console.log('[Dev] ESLint 实时检测已启用')
