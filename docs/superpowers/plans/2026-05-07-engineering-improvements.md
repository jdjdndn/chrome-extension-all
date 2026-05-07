# Chrome扩展工程化能力提升实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为Chrome扩展项目添加代码格式化、Git提交检查、热重载功能，提升开发效率和代码质量。

**Architecture:** Prettier + simple-git-hooks + lint-staged 实现代码质量自动化；HTTP轮询 + WebSocket混合方案实现MV3 Service Worker热重载。

**Tech Stack:** Prettier, simple-git-hooks, lint-staged, ESLint, ws (WebSocket), Vite插件

---

## Task 1: Prettier配置

**Files:**

- Create: `.prettierrc`
- Create: `.prettierignore`
- Modify: `package.json` (添加scripts和依赖)

- [ ] **Step 1: 创建 .prettierrc**

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

- [ ] **Step 2: 创建 .prettierignore**

```
dist/
node_modules/
coverage/
*.min.js
*.bundle.js
event-bus-*.js
content/bundled/
content/core-bundle.js
content/common-bundle.js
```

- [ ] **Step 3: 安装prettier依赖**

```bash
npm install --save-dev prettier
```

- [ ] **Step 4: 添加format scripts到package.json**

在 `package.json` 的 `scripts` 对象中添加以下两个命令：

```json
"format": "prettier --write .",
"format:check": "prettier --check ."
```

- [ ] **Step 5: 验证Prettier工作正常**

```bash
npm run format:check
```

预期：输出需要格式化的文件列表（首次运行可能有文件需要格式化）

- [ ] **Step 6: 格式化现有代码**

```bash
npm run format
```

- [ ] **Step 7: 提交**

```bash
git add .prettierrc .prettierignore package.json package-lock.json
git commit -m "feat: add prettier configuration"
```

---

## Task 2: ESLint依赖补充

**Files:**

- Modify: `package.json` (添加eslint依赖)

- [ ] **Step 1: 安装eslint依赖**

```bash
npm install --save-dev eslint
```

- [ ] **Step 2: 验证ESLint工作正常**

```bash
npx eslint --version
```

预期：输出ESLint版本号

- [ ] **Step 3: 添加lint script到package.json**

在 `package.json` 的 `scripts` 对象中添加：

```json
"lint": "eslint . --ignore-pattern dist --ignore-pattern node_modules"
```

- [ ] **Step 4: 提交**

```bash
git add package.json package-lock.json
git commit -m "feat: add eslint dependency"
```

---

## Task 3: Git提交检查配置

**Files:**

- Modify: `package.json` (添加simple-git-hooks、lint-staged配置和依赖)

- [ ] **Step 1: 安装依赖**

```bash
npm install --save-dev simple-git-hooks lint-staged
```

- [ ] **Step 2: 添加lint-staged配置到package.json**

在 `package.json` 中添加顶级字段：

```json
"lint-staged": {
  "*.{js,ts}": ["prettier --write", "eslint --fix"],
  "*.{json,md}": ["prettier --write"]
}
```

- [ ] **Step 3: 添加simple-git-hooks配置到package.json**

在 `package.json` 中添加顶级字段：

```json
"simple-git-hooks": {
  "pre-commit": "npx lint-staged && npm run typecheck"
}
```

- [ ] **Step 4: 注册git hooks**

```bash
npx simple-git-hooks
```

预期：输出 "Git hooks installed"

- [ ] **Step 5: 验证hooks已注册**

```powershell
Get-Content .git/hooks/pre-commit
```

预期：输出包含 `npx simple-git-hooks` 的内容

- [ ] **Step 6: 提交**

```bash
git add package.json package-lock.json
git commit -m "feat: add git hooks with lint-staged"
```

---

## Task 4: 热重载服务器实现

**Files:**

- Create: `scripts/hot-reload-server.js`

- [ ] **Step 1: 安装ws依赖**

```bash
npm install --save-dev ws
```

- [ ] **Step 2: 创建热重载服务器脚本**

创建 `scripts/hot-reload-server.js`：

```javascript
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
```

- [ ] **Step 3: 提交**

```bash
git add scripts/hot-reload-server.js package.json package-lock.json
git commit -m "feat: add hot reload server with HTTP polling and WebSocket"
```

---

## Task 5: Service Worker热重载脚本

**Files:**

- Create: `hot-reload-background.js`

- [ ] **Step 1: 创建Service Worker热重载脚本**

创建 `hot-reload-background.js`：

```javascript
/**
 * Service Worker热重载脚本
 * 使用chrome.alarms定期轮询检查构建更新
 * 仅在开发模式下使用
 */

;(function () {
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
      if (!response.ok) return

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
    if (alarm.name !== ALARM_NAME) return
    await checkForUpdates()
  })

  // 启动时立即检查一次
  checkForUpdates()

  console.log('[HotReload] Service Worker热重载已启用')
})()
```

- [ ] **Step 2: 提交**

```bash
git add hot-reload-background.js
git commit -m "feat: add service worker hot reload script with HTTP polling"
```

---

## Task 6: 页面热重载客户端

**Files:**

- Create: `content/hot-reload-client.js`

- [ ] **Step 1: 创建页面热重载客户端脚本**

创建 `content/hot-reload-client.js`：

```javascript
/**
 * Content Script热重载客户端
 * 通过WebSocket连接热重载服务器，接收重载通知
 * 仅在开发模式下使用
 */

;(function () {
  const HOT_RELOAD_URL = 'ws://localhost:8765'
  const RECONNECT_DELAY = 1000
  const MAX_RECONNECT_DELAY = 30000

  let ws = null
  let reconnectAttempts = 0
  let reconnectTimeout = null

  function connect() {
    try {
      ws = new WebSocket(HOT_RELOAD_URL)

      ws.onopen = () => {
        console.log(`[HotReload] WebSocket已连接: ${HOT_RELOAD_URL}`)
        reconnectAttempts = 0
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.type === 'reload') {
            console.log('[HotReload] 收到重载通知，刷新页面...')
            location.reload()
          }
        } catch (err) {
          // 忽略解析错误
        }
      }

      ws.onclose = () => {
        console.log('[HotReload] WebSocket已断开')
        scheduleReconnect()
      }

      ws.onerror = (err) => {
        console.log('[HotReload] WebSocket连接错误')
        ws.close()
      }
    } catch (err) {
      scheduleReconnect()
    }
  }

  function scheduleReconnect() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout)
    }

    // 指数退避重连
    const delay = Math.min(RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY)
    reconnectAttempts++

    reconnectTimeout = setTimeout(() => {
      connect()
    }, delay)
  }

  // 检查是否在http/https页面（排除chrome://等特殊页面）
  if (location.protocol === 'http:' || location.protocol === 'https:') {
    connect()
  }
})()
```

- [ ] **Step 2: 提交**

```bash
git add content/hot-reload-client.js
git commit -m "feat: add content script hot reload client with WebSocket"
```

---

## Task 7: Vite插件集成与Manifest处理（合并）

**Files:**

- Modify: `vite.config.js`
- Modify: `background.js`

- [ ] **Step 1: 修改vite.config.js添加热重载支持**

将 `vite.config.js` 修改为：

```javascript
import { defineConfig } from 'vite'
import { resolve } from 'path'
import {
  existsSync,
  copyFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from 'fs'
import { build as esbuildBuild } from 'esbuild'

// ========== Content script bundles (from build-site-bundles.js) ==========
const CONTENT_BUNDLES = [
  { name: 'core', entry: 'content/entries/core.js', outfile: 'content/core-bundle.js' },
  { name: 'common', entry: 'content/entries/common.js', outfile: 'content/common-bundle.js' },
  { name: 'bili', entry: 'content/entries/bili.js', outfile: 'content/bundled/bili.bundle.js' },
  {
    name: 'douyin',
    entry: 'content/entries/douyin.js',
    outfile: 'content/bundled/douyin.bundle.js',
  },
  { name: '4hu', entry: 'content/entries/4hu.js', outfile: 'content/bundled/4hu.bundle.js' },
  {
    name: 'weread',
    entry: 'content/entries/weread.js',
    outfile: 'content/bundled/weread.bundle.js',
  },
  {
    name: 'youtube',
    entry: 'content/entries/youtube.js',
    outfile: 'content/bundled/youtube.bundle.js',
  },
  {
    name: 'modelscope',
    entry: 'content/entries/modelscope.js',
    outfile: 'content/bundled/modelscope.bundle.js',
  },
  { name: 'quark', entry: 'content/entries/quark.js', outfile: 'content/bundled/quark.bundle.js' },
  {
    name: 'xiaohongshu',
    entry: 'content/entries/xiaohongshu.js',
    outfile: 'content/bundled/xiaohongshu.bundle.js',
  },
  {
    name: 'aliyun',
    entry: 'content/entries/aliyun.js',
    outfile: 'content/bundled/aliyun.bundle.js',
  },
  {
    name: 'baiduPan',
    entry: 'content/entries/baiduPan.js',
    outfile: 'content/bundled/baiduPan.bundle.js',
  },
  { name: 'boss', entry: 'content/entries/boss.js', outfile: 'content/bundled/boss.bundle.js' },
  {
    name: 'dianGong',
    entry: 'content/entries/dianGong.js',
    outfile: 'content/bundled/dianGong.bundle.js',
  },
  {
    name: 'gongkong',
    entry: 'content/entries/gongkong.js',
    outfile: 'content/bundled/gongkong.bundle.js',
  },
  {
    name: 'comic18',
    entry: 'content/entries/comic18.js',
    outfile: 'content/bundled/comic18.bundle.js',
  },
  {
    name: 'github',
    entry: 'content/entries/github.js',
    outfile: 'content/bundled/github.bundle.js',
  },
]

// ========== File sync config (from watch-and-sync.js) ==========
const STATIC_FILES = [
  'manifest.json',
  'background.js',
  'content.js',
  'inject.js',
  'popup.html',
  'popup.js',
  'newtab.html',
  'newtab.js',
  'styles.css',
  'rules.json',
  'welcome.html',
  'event-bus-v4.6.js',
  'eventbus-test.js',
]

const FILE_MAPPINGS = [
  { src: 'eventbus-devtools.html', dest: 'devtools/eventbus-devtools.html' },
  { src: 'eventbus-devtools.js', dest: 'devtools/eventbus-devtools.js' },
]

const STATIC_DIRS = ['icons', 'devtools', 'shared', 'src']
const SKIP_CONTENT_DIRS = ['entries', 'utils']

// ========== Hot Reload Notification ==========
async function notifyHotReloadServer() {
  const HOT_RELOAD_URL = process.env.HOT_RELOAD_URL || 'http://localhost:8765'
  try {
    await fetch(`${HOT_RELOAD_URL}/reload`, { method: 'POST' })
    console.log('[HotReload] 已通知热重载服务器')
  } catch (err) {
    // 服务器可能未启动，静默失败
  }
}

// ========== Helpers ==========
function copyDir(src, dest, skipDirs = []) {
  if (!existsSync(src)) return
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.isDirectory() && skipDirs.includes(entry.name)) continue
    const srcPath = resolve(src, entry.name)
    const destPath = resolve(dest, entry.name)
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, skipDirs)
    } else {
      copyFileSync(srcPath, destPath)
    }
  }
}

function addWatchFilesRecursive(dir, ctx) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = resolve(dir, entry.name)
    if (entry.isDirectory()) {
      addWatchFilesRecursive(fullPath, ctx)
    } else {
      ctx.addWatchFile(fullPath)
    }
  }
}

function copyAllToDist(dist) {
  mkdirSync(dist, { recursive: true })

  for (const f of STATIC_FILES) {
    if (existsSync(f)) copyFileSync(resolve(f), resolve(dist, f))
  }
  for (const m of FILE_MAPPINGS) {
    if (existsSync(m.src)) {
      const dest = resolve(dist, m.dest)
      mkdirSync(resolve(dest, '..'), { recursive: true })
      copyFileSync(resolve(m.src), dest)
    }
  }
  for (const d of STATIC_DIRS) {
    if (existsSync(d)) copyDir(resolve(d), resolve(dist, d))
  }
  if (existsSync('content')) {
    copyDir(resolve('content'), resolve(dist, 'content'), SKIP_CONTENT_DIRS)
  }
}

async function buildContentScripts(dist) {
  for (const bundle of CONTENT_BUNDLES) {
    const entry = resolve(bundle.entry)
    if (!existsSync(entry)) continue
    const outfile = resolve(dist, bundle.outfile)
    mkdirSync(resolve(outfile, '..'), { recursive: true })
    await esbuildBuild({
      entryPoints: [entry],
      bundle: true,
      format: 'iife',
      outfile,
      target: ['chrome100'],
      sourcemap: true,
      minify: false,
      define: { 'process.env.NODE_ENV': '"production"' },
    })
  }
}

// ========== Vite Plugin ==========
const DUMMY_ID = '\0chrome-ext-dummy'

function chromeExtensionPlugin() {
  return {
    name: 'chrome-extension',

    // Provide a virtual module as entry so Vite doesn't process real files
    resolveId(id) {
      if (id === DUMMY_ID) return DUMMY_ID
    },
    load(id) {
      if (id === DUMMY_ID) return '// chrome extension build dummy'
    },

    buildStart() {
      for (const f of STATIC_FILES) {
        if (existsSync(f)) this.addWatchFile(resolve(f))
      }
      for (const m of FILE_MAPPINGS) {
        if (existsSync(m.src)) this.addWatchFile(resolve(m.src))
      }
      for (const d of STATIC_DIRS) {
        addWatchFilesRecursive(d, this)
      }
      addWatchFilesRecursive('content', this)
    },

    async generateBundle() {
      const dist = resolve('dist')
      copyAllToDist(dist)
      await buildContentScripts(dist)

      // 开发模式：处理manifest.json添加热重载支持
      if (process.env.NODE_ENV !== 'production') {
        const manifestPath = resolve(dist, 'manifest.json')
        if (existsSync(manifestPath)) {
          const manifestContent = readFileSync(manifestPath, 'utf-8')
          const manifest = JSON.parse(manifestContent)

          // 为content_scripts添加热重载客户端
          if (manifest.content_scripts) {
            manifest.content_scripts = manifest.content_scripts.map((cs) => ({
              ...cs,
              js: ['content/hot-reload-client.js', ...(cs.js || [])],
            }))
          }

          // 复制热重载后台脚本到dist
          const hotReloadBg = resolve('hot-reload-background.js')
          if (existsSync(hotReloadBg)) {
            copyFileSync(hotReloadBg, resolve(dist, 'hot-reload-background.js'))
          }

          // 复制热重载客户端到dist
          const hotReloadClient = resolve('content/hot-reload-client.js')
          const distClientDir = resolve(dist, 'content')
          if (!existsSync(distClientDir)) {
            mkdirSync(distClientDir, { recursive: true })
          }
          if (existsSync(hotReloadClient)) {
            copyFileSync(hotReloadClient, resolve(distClientDir, 'hot-reload-client.js'))
          }

          // 写回manifest
          writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
          console.log('[HotReload] manifest.json已更新，添加热重载支持')
        }
      }
    },

    writeBundle() {
      // Remove the dummy output file
      const dummy = resolve('dist/dummy.js')
      if (existsSync(dummy)) unlinkSync(dummy)
    },

    async closeBundle() {
      // 构建完成后通知热重载服务器（开发模式）
      if (process.env.NODE_ENV !== 'production') {
        await notifyHotReloadServer()
      }
    },
  }
}

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome100',
    minify: false,
    sourcemap: false,
    rollupOptions: {
      input: { dummy: DUMMY_ID },
      output: {
        entryFileNames: 'dummy.js',
      },
    },
  },
  plugins: [chromeExtensionPlugin()],
})
```

- [ ] **Step 2: 修改background.js添加热重载脚本加载**

在 `background.js` 第7-9行的 `importScripts` 块内添加热重载脚本：

找到：

```javascript
if (typeof self !== 'undefined' && typeof self.importScripts === 'function') {
  self.importScripts('event-bus-v4.6.js')
}
```

修改为：

```javascript
if (typeof self !== 'undefined' && typeof self.importScripts === 'function') {
  self.importScripts('event-bus-v4.6.js')
  // 热重载支持（开发模式下通过Vite复制到dist）
  try {
    self.importScripts('hot-reload-background.js')
  } catch (e) {
    /* 生产环境忽略 */
  }
}
```

- [ ] **Step 3: 验证Vite配置语法正确**

```bash
node -e "import('./vite.config.js').then(() => console.log('OK')).catch(e => console.error(e))"
```

预期：输出 "OK"

- [ ] **Step 4: 提交**

```bash
git add vite.config.js background.js
git commit -m "feat: integrate hot reload in vite build with manifest injection"
```

---

## Task 8: 开发命令整合

**Files:**

- Create: `scripts/dev.js`
- Modify: `package.json`

- [ ] **Step 1: 创建开发模式启动脚本**

创建 `scripts/dev.js`：

```javascript
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
const hotReloadServer = spawn('node', [resolve(__dirname, 'hot-reload-server.js')], {
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
```

- [ ] **Step 2: 更新package.json scripts**

将 `package.json` 的 `scripts` 中的 `dev` 命令修改为：

```json
"dev": "node scripts/dev.js"
```

- [ ] **Step 3: 提交**

```bash
git add scripts/dev.js package.json
git commit -m "feat: add dev script with hot reload server integration"
```

---

## Task 9: 测试验证

**Files:**

- 无新文件

- [ ] **Step 1: 运行类型检查**

```bash
npm run typecheck
```

预期：无错误

- [ ] **Step 2: 运行ESLint检查**

```bash
npm run lint
```

预期：无严重错误（warning可接受）

- [ ] **Step 3: 运行Prettier检查**

```bash
npm run format:check
```

预期：所有文件格式正确

- [ ] **Step 4: 测试Git提交检查**

创建一个测试提交：

```bash
echo "// test" >> test-commit.js
git add test-commit.js
git commit -m "test: verify pre-commit hook"
```

预期：pre-commit hook执行lint-staged和typecheck

- [ ] **Step 5: 清理测试文件**

```powershell
git reset HEAD~1
Remove-Item test-commit.js
```

- [ ] **Step 6: 测试开发模式启动**

```bash
npm run dev
```

预期：

- 热重载服务器启动在 http://localhost:8765
- Vite构建开始监听文件变化

按 Ctrl+C 停止。

- [ ] **Step 7: 最终提交（如有修改）**

```bash
git status
# 如有未提交的修改
git add -A
git commit -m "chore: final cleanup for engineering improvements"
```

---

## 验收标准

1. ✅ `npm run format` 能格式化代码
2. ✅ `npm run lint` 能检查代码
3. ✅ `git commit` 自动执行 lint-staged + typecheck
4. ✅ `npm run dev` 启动热重载服务器和Vite watch
5. ✅ 修改代码后扩展自动重载（Service Worker HTTP轮询）
6. ✅ 修改代码后页面自动刷新（Content Script WebSocket）
