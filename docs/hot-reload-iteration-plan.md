# 资源加速器 热更新迭代计划

## 基线版本

基于当前 `main` 分支（commit: 320e9ea）

---

## 完成状态表

| 功能                  | 状态 | 说明                    |
| --------------------- | ---- | ----------------------- |
| 热重载服务器          | ✅   | HTTP + WebSocket 双协议 |
| Service Worker 热重载 | ✅   | Alarms API 轮询         |
| Content Script 热重载 | ✅   | WebSocket 连接          |
| Vite 构建集成         | ✅   | 环境变量注入            |
| ESLint 实时检测       | ✅   | 文件变化触发            |
| 增量构建              | ✅   | 已完成                  |
| 构建缓存              | ✅   | 已完成                  |
| 扩展自动重载          | ✅   | 快速轮询 + 存储同步     |
| DevTools 面板集成     | ✅   | 已完成                  |
| 环境检测增强          | ✅   | 多维环境检测            |

---

## 当前状态

### 已实现模块

```
scripts/
├── dev.js                    # 开发模式入口
├── hot-reload-server.mjs     # 热重载服务器 (HTTP + WebSocket)
├── watch-and-sync.js         # 文件监控同步
├── build-site-bundles.js     # esbuild 打包
└── utils/debounce.js         # 防抖工具

content/
└── hot-reload-client.js      # Content Script 热重载客户端

hot-reload-background.js      # Service Worker 热重载脚本

vite.config.js               # 构建配置（含热重载注入）
```

### 热重载流程

```
┌─────────────────────────────────────────────────────────────┐
│                      开发模式启动                            │
│                     npm run dev                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  scripts/dev.js 并行启动:                                    │
│  ├─ hot-reload-server.mjs (端口 8765)                       │
│  ├─ vite build --watch                                      │
│  └─ ESLint 实时检测                                         │
└─────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │  HTTP 轮询     │ │  WebSocket     │ │  构建通知      │
   │  /check-build  │ │  连接推送      │ │  POST /reload  │
   └────────────────┘ └────────────────┘ └────────────────┘
            │                 │                 │
            ▼                 ▼                 ▼
   ┌────────────────┐ ┌────────────────┐ ┌────────────────┐
   │ Service Worker │ │ Content Script │ │ 页面刷新       │
   │ chrome.runtime │ │ location.reload│ │ 扩展重载       │
   │    .reload()   │ │                │ │                │
   └────────────────┘ └────────────────┘ └────────────────┘
```

---

## 遗留问题

### 1. 构建性能问题

**问题**：每次文件变化触发全量构建，大项目构建慢。

**影响**：

- 修改单个文件需等待 3-5 秒
- 频繁修改时构建队列堆积
- 低端设备开发体验差

**根因**：

- 无增量构建，每次全量打包
- 无构建缓存，重复编译相同代码
- esbuild bundle 未启用缓存

### 2. 扩展重载延迟

**问题**：构建完成后扩展重载不及时。

**影响**：

- Service Worker 轮询间隔 2 秒
- Content Script 刷新依赖 WebSocket
- Manifest 变化需手动刷新扩展

**根因**：

- MV3 Service Worker 不支持持久 WebSocket
- Alarms API 最小间隔 1 分钟（实际用 periodInMinutes）
- 无主动触发扩展重载机制

### 3. 开发环境检测

**问题**：热重载客户端可能误判环境。

**影响**：

- 生产环境意外启用热重载
- 开发环境未正确启用

**根因**：

- 仅依赖 `__HOT_RELOAD__` 变量
- 无多维度环境检测

---

## 迭代目标

### 核心目标

1. **增量构建**：仅重新编译变化的文件，减少 80% 构建时间
2. **即时重载**：构建完成后 500ms 内触发扩展重载
3. **DevTools 集成**：开发状态可视化、构建历史可追溯

### 原则

- **向后兼容**：不破坏现有热重载流程
- **渐进增强**：新功能可选启用
- **最小依赖**：不引入新 npm 包（使用 Node 原生 API）
- **安全优先**：仅开发模式启用

---

## 各迭代详细设计

---

### 迭代 1：增量构建

#### 问题分析

当前构建流程：

```
文件变化 → Vite 全量构建 → esbuild 全量打包 → 复制所有文件到 dist
```

问题：

- 每次构建处理所有文件（30+ 个 bundle）
- 未变化的 bundle 重复编译
- 静态文件每次全量复制

#### 功能设计

**增量构建策略**：

```javascript
// scripts/incremental-build.js

const BuildCache = {
  // 文件 hash 缓存
  fileHashes: new Map(), // filePath → lastHash

  // bundle 输出缓存
  bundleCache: new Map(), // bundleName → lastOutput

  // 依赖图（用于判断影响范围）
  dependencyGraph: new Map(), // filePath → dependentFiles
}

// 增量构建逻辑
async function incrementalBuild(changedFiles) {
  const results = { rebuilt: [], skipped: [], errors: [] }

  for (const file of changedFiles) {
    // 1. 计算新 hash
    const newHash = await computeFileHash(file)
    const oldHash = BuildCache.fileHashes.get(file)

    // 2. 未变化则跳过
    if (newHash === oldHash) {
      results.skipped.push(file)
      continue
    }

    // 3. 更新 hash
    BuildCache.fileHashes.set(file, newHash)

    // 4. 找到受影响的 bundle
    const affectedBundles = findAffectedBundles(file, BuildCache.dependencyGraph)

    // 5. 仅重新构建受影响的 bundle
    for (const bundle of affectedBundles) {
      try {
        await rebuildBundle(bundle)
        results.rebuilt.push(bundle)
      } catch (err) {
        results.errors.push({ bundle, error: err.message })
      }
    }
  }

  return results
}
```

**配置项**：

```javascript
const INCREMENTAL_CONFIG = {
  // 缓存文件路径（位于 node_modules/.cache/ 避免触发 watch 循环）
  cacheFile: 'node_modules/.cache/build-cache.json',

  // 缓存过期时间（毫秒）
  cacheTTL: 24 * 60 * 60 * 1000, // 24 小时

  // 是否启用增量构建
  enabled: process.env.NODE_ENV === 'development',

  // 最大缓存条目
  maxCacheSize: 1000,
}
```

#### 文件变更表

| 文件                                   | 操作     | 说明                                  |
| -------------------------------------- | -------- | ------------------------------------- |
| `scripts/incremental-build.js`         | 新增     | 增量构建核心逻辑                      |
| `node_modules/.cache/build-cache.json` | 自动生成 | 构建缓存存储（被 node_modules/ 忽略） |
| `vite.config.js`                       | 修改     | 集成增量构建                          |
| `scripts/build-site-bundles.js`        | 修改     | 支持增量打包                          |

#### 验收标准

- [x] 修改单个文件，仅重新构建相关 bundle
- [x] 未变化文件跳过构建
- [x] 构建时间减少 60% 以上（实测：无变化 1698ms → 8ms，有变化 1698ms → 148ms）
- [x] 缓存正确更新和清理
- [x] 开发/生产环境行为一致

#### 风险评估

| 风险         | 影响           | 缓解措施                             |
| ------------ | -------------- | ------------------------------------ |
| 缓存不一致   | 构建结果错误   | 提供 `--no-cache` 参数强制全量构建   |
| 依赖图不完整 | 漏构建关联文件 | 启动时验证依赖图，发现缺失时全量构建 |
| 缓存文件损坏 | 构建失败       | 损坏时自动删除重建                   |

---

### 迭代 2：扩展自动重载优化

#### 问题分析

当前重载流程：

```
构建完成 → POST /reload →
  ├─ WebSocket 推送 → Content Script → location.reload()
  └─ 更新时间戳 → Service Worker 轮询 → chrome.runtime.reload()
```

问题：

- Service Worker 轮询间隔固定（2 秒），可能延迟
- 首次启动时 Service Worker 未激活
- Manifest 变化需手动刷新

#### 功能设计

**快速重载机制**：

```javascript
// scripts/hot-reload-server.mjs 新增端点

// GET /reload-extension - 扩展主动请求重载
if (req.method === 'GET' && url.pathname === '/reload-extension') {
  const extensionId = url.searchParams.get('id')
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
```

**Service Worker 优化**：

```javascript
// hot-reload-background.js 改进

// 1. 缩短轮询间隔（使用 setTimeout 模拟）
let checkInterval = 500 // 500ms

async function startPolling() {
  while (true) {
    await checkForUpdates()
    await sleep(checkInterval)
  }
}

// 2. 构建完成后立即检查
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'BUILD_COMPLETE') {
    checkForUpdates()
  }
})

// 3. 激进模式：监听存储变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.buildTimestamp) {
    chrome.runtime.reload()
  }
})
```

**Manifest 变化检测**：

```javascript
// scripts/hot-reload-server.mjs

// 监控 manifest.json 变化
let lastManifestHash = null

function watchManifest() {
  const manifestPath = path.join(rootDir, 'manifest.json')
  fs.watch(manifestPath, async () => {
    const content = await fs.promises.readFile(manifestPath, 'utf-8')
    const hash = computeHash(content)

    if (hash !== lastManifestHash) {
      lastManifestHash = hash
      // 通知扩展需要完全重载（不只是刷新页面）
      broadcast({ type: 'manifest-changed', timestamp: Date.now() })
    }
  })
}
```

#### 文件变更表

| 文件                            | 操作 | 说明                            |
| ------------------------------- | ---- | ------------------------------- |
| `scripts/hot-reload-server.mjs` | 修改 | 新增快速重载端点、Manifest 监控 |
| `hot-reload-background.js`      | 修改 | 优化轮询策略、存储同步          |
| `content/hot-reload-client.js`  | 修改 | 处理 Manifest 变化通知          |

#### 验收标准

- [x] 构建完成后 500ms 内触发扩展重载
- [x] Manifest 变化自动触发完全重载
- [x] 多个标签页同步重载
- [ ] 重载不丢失 DevTools 状态（断点保留）

#### 风险评估

| 风险     | 影响           | 缓解措施                 |
| -------- | -------------- | ------------------------ |
| 频繁重载 | 开发体验差     | 设置最小重载间隔（1 秒） |
| 重载失败 | 扩展崩溃       | 提供手动重载备选方案     |
| 端口冲突 | 服务器启动失败 | 支持端口自动切换         |

---

### 迭代 3：DevTools 面板集成

#### 问题分析

当前开发状态不可见：

- 不清楚热重载是否工作
- 不知道构建进度
- 看不到错误历史

#### 功能设计

**DevTools 面板**：

```
┌─────────────────────────────────────────────────────────┐
│ 🔥 Hot Reload DevTools                                  │
├─────────────────────────────────────────────────────────┤
│ Status: 🟢 Connected                                    │
│ Server: http://localhost:8765                           │
│ Last Build: 2024-01-15 10:30:45 (2.3s ago)              │
├─────────────────────────────────────────────────────────┤
│ Build History:                                          │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ 10:30:45 ✅ 3 files rebuilt (234ms)                 │ │
│ │ 10:28:12 ✅ 1 file rebuilt (89ms)                   │ │
│ │ 10:25:33 ❌ Error in content/main.js:42             │ │
│ │ 10:22:01 ✅ Full rebuild (1.2s)                     │ │
│ └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────┤
│ Actions:                                                │
│ [Force Reload]  [Clear Cache]  [Open Settings]          │
└─────────────────────────────────────────────────────────┘
```

**实现架构**：

```javascript
// devtools/panel.js

// 创建 DevTools 面板
chrome.devtools.panels.create(
  'Hot Reload',
  'icons/hot-reload.png',
  'devtools/panel.html',
  (panel) => {
    panel.onShown.addListener((window) => {
      // 连接到热重载服务器
      connectToServer()
    })
  }
)

// 与热重载服务器通信
function connectToServer() {
  const ws = new WebSocket('ws://localhost:8765')

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)

    switch (data.type) {
      case 'build-start':
        updateStatus('building')
        break
      case 'build-complete':
        updateStatus('ready')
        addToHistory(data)
        break
      case 'build-error':
        updateStatus('error')
        showError(data)
        break
    }
  }
}
```

#### 文件变更表

| 文件                  | 操作 | 说明               |
| --------------------- | ---- | ------------------ |
| `devtools/panel.html` | 新增 | DevTools 面板 UI   |
| `devtools/panel.js`   | 新增 | 面板逻辑           |
| `devtools/panel.css`  | 新增 | 面板样式           |
| `manifest.json`       | 修改 | 注册 DevTools 面板 |

#### 验收标准

- [x] DevTools 中显示热重载面板
- [x] 实时显示构建状态
- [x] 显示构建历史
- [x] 提供手动操作按钮

#### 风险评估

| 风险               | 影响       | 缓解措施                 |
| ------------------ | ---------- | ------------------------ |
| WebSocket 连接失败 | 面板不可用 | 显示连接状态和重试按钮   |
| 面板性能影响       | 页面卡顿   | 使用虚拟列表渲染历史记录 |

---

### 迭代 4：环境检测增强

#### 问题分析

当前环境检测：

- 仅依赖 `__HOT_RELOAD__` 变量
- 生产环境可能误启用
- 开发环境可能未正确启用

#### 功能设计

**多维环境检测**：

```javascript
// content/hot-reload-client.js 改进

const EnvironmentDetector = {
  // 1. 构建时注入标记
  hasBuildMarker() {
    return typeof __HOT_RELOAD__ !== 'undefined' && __HOT_RELOAD__
  },

  // 2. URL 参数检测
  hasUrlParam() {
    const params = new URLSearchParams(location.search)
    return params.has('hotreload') || params.has('dev')
  },

  // 3. 扩展 ID 检测（开发版本通常使用临时 ID）
  isDevExtension() {
    // 开发模式下扩展 ID 通常包含特定模式
    return chrome.runtime.id.includes('tmp') || localStorage.getItem('dev_mode') === 'true'
  },

  // 4. 服务器可达性检测
  async canReachServer() {
    try {
      const response = await fetch('http://localhost:8765/ping', {
        signal: AbortSignal.timeout(1000),
      })
      return response.ok
    } catch {
      return false
    }
  },

  // 综合判断
  async isDevelopment() {
    // 构建标记优先级最高
    if (this.hasBuildMarker()) return true

    // URL 参数次之
    if (this.hasUrlParam()) return true

    // 检测服务器（仅当其他条件满足时）
    if (await this.canReachServer()) {
      return true
    }

    return false
  },
}
```

**安全开关**：

```javascript
// manifest.json 中的开发配置

{
  "development": {
    "hotReload": {
      "enabled": true,
      "serverPort": 8765,
      "checkInterval": 500
    }
  }
}
```

#### 文件变更表

| 文件                           | 操作 | 说明           |
| ------------------------------ | ---- | -------------- |
| `content/hot-reload-client.js` | 修改 | 多维环境检测   |
| `hot-reload-background.js`     | 修改 | 一致的检测逻辑 |
| `manifest.json`                | 修改 | 开发配置节     |

#### 验收标准

- [x] 生产环境不启用热重载
- [x] 开发环境正确启用热重载
- [x] 提供手动开关（localStorage / chrome.storage）
- [x] 环境变化时正确切换

#### 风险评估

| 风险             | 影响     | 缓解措施                 |
| ---------------- | -------- | ------------------------ |
| 检测逻辑过于复杂 | 性能影响 | 异步检测，不阻塞页面加载 |
| 误判环境         | 功能异常 | 提供手动覆盖开关         |

---

## 实施顺序

### 优先级排序

| 优先级 | 迭代                  | 理由                   |
| ------ | --------------------- | ---------------------- |
| P0     | 迭代 1：增量构建      | 核心性能优化，影响最大 |
| P0     | 迭代 2：扩展自动重载  | 开发体验直接相关       |
| P1     | 迭代 3：DevTools 面板 | 增强可视化、错误追溯   |
| P2     | 迭代 4：环境检测增强  | 提高稳定性             |

### 实施顺序

```
Phase 1 (Week 1): P0 迭代并行开发
  ├─ 迭代 1：增量构建
  └─ 迭代 2：扩展自动重载

Phase 2 (Week 2): P1 迭代
  └─ 迭代 3：DevTools 面板

Phase 3 (Week 3): P2 迭代
  └─ 迭代 4：环境检测增强
```

---

## 风险评估汇总

### 技术风险

| 风险               | 概率 | 影响 | 缓解措施                       |
| ------------------ | ---- | ---- | ------------------------------ |
| 增量构建缓存不一致 | 中   | 高   | 提供 `--no-cache` 强制全量构建 |
| 热重载服务器崩溃   | 低   | 高   | 进程守护 + 自动重启            |
| 扩展重载失败       | 中   | 中   | 提供手动重载按钮               |

### 兼容性风险

| 风险             | 概率 | 影响 | 缓解措施               |
| ---------------- | ---- | ---- | ---------------------- |
| MV3 限制         | 高   | 中   | 使用 Alarms API + 轮询 |
| 不同 Chrome 版本 | 低   | 低   | 最低支持 Chrome 100    |

---

## 文件变更汇总

### 新增文件

| 文件                           | 用途              |
| ------------------------------ | ----------------- |
| `scripts/incremental-build.js` | 增量构建核心      |
| `scripts/build-cache.json`     | 构建缓存          |
| `devtools/panel.html`          | DevTools 面板 UI  |
| `devtools/panel.js`            | DevTools 面板逻辑 |
| `devtools/panel.css`           | DevTools 面板样式 |

### 修改文件

| 文件                            | 修改内容                    |
| ------------------------------- | --------------------------- |
| `vite.config.js`                | 集成增量构建                |
| `scripts/build-site-bundles.js` | 支持增量打包                |
| `scripts/hot-reload-server.mjs` | 快速重载端点、Manifest 监控 |
| `hot-reload-background.js`      | 优化轮询策略                |
| `content/hot-reload-client.js`  | 多维环境检测                |
| `manifest.json`                 | DevTools 面板注册、开发配置 |

---

## 与前版本的关系

### 保持兼容

- 现有 `npm run dev` 命令不变
- 现有热重载流程保持工作
- 新功能通过配置启用

### 新增功能

| 功能          | 启用方式                |
| ------------- | ----------------------- |
| 增量构建      | 开发模式自动启用        |
| 快速重载      | 开发模式自动启用        |
| DevTools 面板 | 通过 manifest.json 注册 |

### 配置迁移

```javascript
// 旧配置（.env）
HOT_RELOAD=true

// 新配置（manifest.json development 节）
{
  "development": {
    "hotReload": {
      "enabled": true,
      "incrementalBuild": true,
      "serverPort": 8765
    }
  }
}
```

---

## 约束条件

### 必须遵守

1. **MV3 兼容**：所有功能必须符合 Manifest V3 规范
2. **无新依赖**：不引入新 npm 包，使用 Node 原生 API
3. **向后兼容**：不破坏现有开发流程
4. **安全优先**：生产环境禁用所有开发功能
5. **性能优先**：热重载不应影响页面性能

### 技术限制

- Service Worker 不支持持久 WebSocket
- Alarms API 最小间隔 1 分钟（需用 setTimeout 模拟）
- Content Script 不能访问 chrome.devtools API
- 跨域限制（需在 manifest.json 声明权限）

---

## 验收标准

### 功能验收

- [x] 修改单个文件，构建时间 < 500ms
- [x] 构建完成后扩展重载延迟 < 500ms
- [x] DevTools 显示热重载面板
- [x] 生产环境不启用热重载

### 性能验收

| 指标           | 当前 | 目标    |
| -------------- | ---- | ------- |
| 单文件构建时间 | 3-5s | < 500ms |
| 扩展重载延迟   | 2s   | < 500ms |
| 内存占用增量   | N/A  | < 50MB  |

### 兼容性验收

- [x] Chrome 100+ 正常工作
- [x] 开发/生产环境正确切换
