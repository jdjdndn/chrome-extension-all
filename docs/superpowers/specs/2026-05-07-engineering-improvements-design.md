# Chrome扩展工程化能力提升设计

日期：2026-05-07
状态：待实现

## 目标

1. **代码质量自动化**：提交时自动检查，杜绝格式混乱和类型错误
2. **开发调试增强**：自动刷新扩展和页面，减少手动操作

## 一、代码格式化

### 1.1 Prettier配置

文件：`.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100
}
```

### 1.2 集成方式

**package.json scripts 新增：**

```json
{
  "format": "prettier --write .",
  "format:check": "prettier --check ."
}
```

**lint-staged配置：**

提交时自动格式化暂存的 `.js` `.ts` `.json` `.md` 文件。

### 1.3 VS Code集成（可选）

`.vscode/settings.json`：

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode"
}
```

## 二、Git提交检查

### 2.1 依赖

- `eslint`：代码检查（已有.eslintrc.json，需安装依赖）
- `prettier`：代码格式化
- `simple-git-hooks`：轻量级git hooks管理
- `lint-staged`：仅检查暂存文件

### 2.2 配置

**package.json：**

```json
{
  "simple-git-hooks": {
    "pre-commit": "npx lint-staged && npm run typecheck"
  },
  "lint-staged": {
    "*.{js,ts}": ["prettier --write", "eslint --fix"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

### 2.3 检查流程

```
git commit
    ↓
pre-commit hook触发
    ↓
lint-staged执行：
  - 格式化暂存文件
  - ESLint检查并自动修复
    ↓
typecheck执行：
  - TypeScript类型检查
    ↓
全部通过 → 提交成功
有错误 → 提交中止，显示错误信息
```

### 2.4 紧急跳过

```bash
git commit --no-verify
```

## 三、扩展热重载

### 3.1 MV3 Service Worker限制

**问题**：MV3的Service Worker会在空闲时休眠，无法维持持久WebSocket连接。

**解决方案**：使用HTTP轮询 + chrome.alarms定期唤醒检查。

### 3.2 架构

```
┌─────────────────┐   HTTP通知    ┌──────────────────┐
│  Vite构建进程   │ ────────────→ │ 热重载服务器     │
│  (文件监听)     │  POST /reload │ localhost:8765  │
└─────────────────┘               │ (HTTP + WS混合)  │
                                  └────────┬─────────┘
                                           │
              ┌────────────────────────────┼────────────────────┐
              ↓                            ↓                    ↓
      ┌───────────────┐            ┌───────────────┐    ┌───────────────┐
      │ Service Worker│            │ Content Script│    │ Content Script│
      │ HTTP轮询检查  │            │ WebSocket连接 │    │ WebSocket连接 │
      │ /check-build  │            │ (持久连接)    │    │ (持久连接)    │
      │ chrome.runtime│            │ location.reload│   │ location.reload│
      │ .reload()     │            └───────────────┘    └───────────────┘
      └───────────────┘
           ↑
           │ chrome.alarms.create
           │ 每2秒唤醒检查一次
           └────────────────────────────┘
```

### 3.3 组件设计

#### 3.3.1 热重载服务器

文件：`scripts/hot-reload-server.js`

职责：

- 启动HTTP服务器（端口8765，支持动态分配）
- 提供`POST /reload`端点接收构建完成通知
- 提供`GET /check-build`端点供Service Worker轮询
- 启动WebSocket服务供content script连接

API设计：

```
POST /reload
  - 构建完成后调用
  - 记录最新构建时间戳
  - 通知所有WebSocket客户端

GET /check-build?last=<timestamp>
  - Service Worker轮询检查
  - 返回 { needsReload: boolean, timestamp: number }
```

#### 3.3.2 Service Worker热重载

文件：`hot-reload-background.js`（根目录，通过Vite复制到dist）

职责：

- 开发模式下加载
- 使用`chrome.alarms.create`每2秒唤醒
- HTTP请求`/check-build`检查是否有新构建
- 检测到新构建 → `chrome.runtime.reload()`

实现要点：

```javascript
// 仅在开发模式下启用
if (typeof chrome !== 'undefined' && chrome.alarms) {
  chrome.alarms.create('hot-reload-check', { periodInMinutes: 2 / 60 }) // 每2秒

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'hot-reload-check') {
      const response = await fetch('http://localhost:8765/check-build?last=' + lastTimestamp)
      const { needsReload } = await response.json()
      if (needsReload) chrome.runtime.reload()
    }
  })
}
```

#### 3.3.3 页面热重载客户端

文件：`content/hot-reload-client.js`

职责：

- 开发模式下注入content script
- WebSocket连接热重载服务器
- 收到重载消息 → `location.reload()`
- 断线自动重连（指数退避）

注入方式：

- 开发模式下通过manifest.content_scripts注入
- 生产构建时通过Vite插件移除该条目

### 3.4 Vite插件集成

修改 `vite.config.js`：

```javascript
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'hot-reload-notifier',
      closeBundle() {
        if (mode === 'development') {
          // 通知热重载服务器构建完成
          fetch('http://localhost:8765/reload', { method: 'POST' }).catch(() => {})
        }
      },
    },
    {
      name: 'dev-manifest-transform',
      // 开发模式：在manifest中添加hot-reload相关脚本
      // 生产模式：移除hot-reload相关脚本
    },
  ],
}))
```

### 3.5 Manifest处理

开发模式需要：

1. Service Worker中引入`hot-reload-background.js`
2. content_scripts中添加`hot-reload-client.js`

**方案**：使用`vite-plugin-web-extension`或自定义插件动态修改manifest。

开发模式manifest：

```json
{
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content/hot-reload-client.js", ...原有脚本]
    }
  ]
}
```

生产模式manifest：移除hot-reload相关条目。

## 四、开发命令

### 4.1 命令设计

| 命令                | 功能                                    |
| ------------------- | --------------------------------------- |
| `npm run dev`       | 启动开发模式：热重载服务器 + Vite watch |
| `npm run build`     | 生产构建（无热重载）                    |
| `npm run format`    | 格式化全部代码                          |
| `npm run typecheck` | TypeScript类型检查                      |
| `npm run lint`      | ESLint检查                              |

### 4.2 dev命令实现

```json
{
  "dev": "node scripts/dev.js"
}
```

`scripts/dev.js`：

```javascript
// 并行启动：
// 1. 热重载服务器
// 2. vite build --watch --mode development
```

## 五、文件清单

### 5.1 新增文件

| 文件                           | 说明                               |
| ------------------------------ | ---------------------------------- |
| `.prettierrc`                  | Prettier配置                       |
| `.prettierignore`              | Prettier忽略文件                   |
| `scripts/hot-reload-server.js` | 热重载HTTP/WebSocket服务器         |
| `scripts/dev.js`               | 开发模式启动脚本                   |
| `hot-reload-background.js`     | Service Worker热重载脚本（根目录） |
| `content/hot-reload-client.js` | 页面热重载客户端                   |

### 5.2 修改文件

| 文件             | 修改内容                           |
| ---------------- | ---------------------------------- |
| `package.json`   | 新增依赖、scripts、lint-staged配置 |
| `vite.config.js` | 添加热重载通知插件、manifest转换   |
| `manifest.json`  | 通过Vite插件动态处理               |

## 六、依赖清单

| 依赖               | 用途          | 类型            |
| ------------------ | ------------- | --------------- |
| `eslint`           | 代码检查      | devDependencies |
| `prettier`         | 代码格式化    | devDependencies |
| `simple-git-hooks` | Git hooks管理 | devDependencies |
| `lint-staged`      | 暂存文件检查  | devDependencies |
| `ws`               | WebSocket服务 | devDependencies |

## 七、风险与缓解

| 风险                         | 缓解措施                                 |
| ---------------------------- | ---------------------------------------- |
| 端口8765被占用               | 支持环境变量配置端口，或自动选择可用端口 |
| Service Worker轮询延迟       | 最小2秒间隔，Chrome保证alarms可靠性      |
| Content Script WebSocket断线 | 实现指数退避重连机制                     |
| 热重载脚本误入生产构建       | Vite插件强制移除，构建后校验manifest     |

## 八、实现顺序

1. Prettier配置 + .prettierignore
2. 安装eslint依赖
3. simple-git-hooks + lint-staged配置
4. 热重载服务器实现（HTTP + WebSocket）
5. Service Worker热重载脚本（HTTP轮询）
6. 页面热重载客户端（WebSocket + 重连）
7. Vite插件集成（通知 + manifest处理）
8. dev命令整合
9. 测试验证
