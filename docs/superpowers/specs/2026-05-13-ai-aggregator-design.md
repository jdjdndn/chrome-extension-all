# AI 聚合问答功能设计文档

## 概述

实现一个 AI 聚合问答功能，用户输入一个问题，自动发送到多个国产 AI 网站（豆包、通义千问、Kimi、文心一言等），在一个页面上分栏实时显示所有 AI 的回答。

## 目标用户

需要同时对比多个 AI 回答的用户，希望一次性获得多角度答案。

## 核心需求

1. **单入口输入** - 在一个页面输入问题，发送到多个 AI
2. **分栏对比显示** - 各 AI 回答分栏展示，便于对比
3. **实时流式更新** - 哪个 AI 先回答就先显示
4. **可配置 AI 列表** - 用户可选择启用/禁用不同 AI
5. **覆盖 newtab** - 打开新标签页即可使用

## 架构设计

```
┌──────────────────────────────────────────────────────────────────┐
│                    AI 聚合问答页面 (newtab)                       │
├──────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 输入区域                                                    │  │
│  │ [                    问题输入框                      ] [发送]│  │
│  │ [✓豆包] [✓通义] [✓Kimi] [✓文心]  ← 选择要使用的 AI         │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────┬───────────────┬───────────────┬────────────┐  │
│  │ 豆包          │ 通义千问       │ Kimi          │ 文心一言    │  │
│  │ ─────────────│ ─────────────│ ─────────────│ ────────────│  │
│  │ 状态: 回答中  │ 状态: 已完成   │ 状态: 等待中  │ 状态: 失败  │  │
│  │ ─────────────│ ─────────────│ ─────────────│ ────────────│  │
│  │               │               │               │            │  │
│  │ AI 回复内容   │ AI 回复内容   │ (等待...)     │ 登录已过期  │  │
│  │ 实时流式显示  │ 已完整显示    │               │ 请先登录    │  │
│  │               │               │               │            │  │
│  └───────────────┴───────────────┴───────────────┴────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 交互流程

1. 用户打开新标签页 → 显示聚合问答页面
2. 输入问题，勾选要使用的 AI
3. 点击发送 → 后台打开各 AI 网站标签页
4. 注入脚本自动填入问题并发送
5. 监听各 AI 回复，实时推送到聚合页面分栏显示
6. 全部完成后可关闭各 AI 标签页

### 消息通信

```
AI 标签页 Inject Script
       │
       │ chrome.runtime.sendMessage({ type: 'ai_response', site, content, status })
       ▼
Background Service Worker
       │
       │ chrome.tabs.sendMessage(aggregatorTabId, { type: 'update', site, content, status })
       ▼
聚合页面 (newtab)
       │
       │ 更新对应分栏内容
       ▼
```

## AI 网站适配方案

### 配置结构

```javascript
{
  "ai_sites": [
    {
      "id": "doubao",
      "name": "豆包",
      "url": "https://www.doubao.com/chat/",
      "enabled": true,
      "selectors": {
        "input": "textarea, [contenteditable='true']",
        "sendButton": "button[type='submit'], [aria-label*='发送']",
        "responseContainer": "[class*='message'], [class*='chat']",
        "loginIndicator": "[class*='avatar'], [class*='user']"
      },
      "notes": "选择器需实际调试确认，当前为通用模式"
    },
    {
      "id": "tongyi",
      "name": "通义千问",
      "url": "https://tongyi.aliyun.com/qianwen/",
      "enabled": true,
      "selectors": {
        "input": "textarea, [contenteditable='true']",
        "sendButton": "button[class*='send']",
        "responseContainer": "[class*='message'], [class*='response']",
        "loginIndicator": "[class*='avatar'], [class*='user']"
      }
    }
    // 其他 AI 网站选择器需实际调试确认
  ],
  "maxConcurrent": 3,  // 最大并发标签页数
  "autoCloseTabs": true  // 完成后自动关闭 AI 标签页
}
```

### 适配逻辑

1. 优先使用已配置的选择器
2. 若失败，尝试通用选择器（`textarea`、`[contenteditable]` 等）
3. 配置支持导入/导出，方便分享和更新

## 回复监听机制

### MutationObserver + 轮询结合

```javascript
class ResponseWatcher {
  constructor(config) {
    this.container = document.querySelector(config.selectors.responseContainer)
    this.lastContent = ''
  }

  // 方式1: MutationObserver 监听 DOM 变化
  startObserver() {
    const observer = new MutationObserver(() => {
      const content = this.extractContent()
      if (content !== this.lastContent) {
        this.lastContent = content
        this.sendToAggregator(content)
      }
    })
    observer.observe(this.container, {
      childList: true,
      subtree: true,
      characterData: true,
    })
  }

  // 方式2: 轮询兜底
  startPolling() {
    setInterval(() => {
      const content = this.extractContent()
      if (content !== this.lastContent) {
        this.lastContent = content
        this.sendToAggregator(content)
      }
    }, 500)
  }

  // 检测回复完成
  isComplete() {
    // 检测"重新生成"、"复制"等按钮出现
  }
}
```

### 状态流转

```
等待中 → 回答中 → 已完成
                 ↘ 失败（登录过期/网络错误）
```

## UI 设计

### 状态指示器

- 🟢 已完成 - 绿色，回复完整
- 🟡 回答中 - 黄色，流式输出中
- 🔴 失败 - 红色，显示错误原因
- ⚪ 未选中/等待中 - 灰色

### 交互功能

- 每栏独立滚动
- 每栏有复制按钮
- 支持导出全部回答（Markdown/文本）
- 设置入口管理 AI 列表和选择器配置

## 错误处理

| 场景             | 检测方式             | 处理方案                       |
| ---------------- | -------------------- | ------------------------------ |
| 未登录           | 登录指示元素不存在   | 显示"请先登录"，点击跳转登录页 |
| 网络错误         | 页面加载失败/超时    | 显示"网络错误，点击重试"       |
| 发送失败         | 发送按钮点击后无响应 | 3秒后检测，提示重试            |
| 选择器失效       | 找不到输入框/按钮    | 显示"页面已更新，请更新配置"   |
| 标签页被手动关闭 | 发送消息无响应       | 标记该 AI 为"已中断"           |

### 超时配置

```javascript
const CONFIG = {
  PAGE_LOAD_TIMEOUT: 15000, // 页面加载超时 15秒
  RESPONSE_TIMEOUT: 60000, // 回复超时 60秒
  RETRY_COUNT: 2, // 重试次数
}
```

### 数据恢复

- 用户刷新聚合页面时，保留已收到的回复（存 localStorage）
- 用户关闭聚合页面时，各 AI 标签页自动关闭

### 并发控制

为避免同时打开过多标签页影响性能：

1. 最大并发数默认为 3，用户可配置
2. 超过并发数的请求排队等待
3. 标签页加载完成后，按顺序注入脚本
4. 全部回答完成后，自动关闭各 AI 标签页（可配置关闭/保留）

```javascript
// 并发队列示例
async function processQueue(sites, question) {
  const maxConcurrent = config.maxConcurrent || 3
  const results = []

  for (let i = 0; i < sites.length; i += maxConcurrent) {
    const batch = sites.slice(i, i + maxConcurrent)
    const batchResults = await Promise.all(batch.map((site) => sendToAI(site, question)))
    results.push(...batchResults)
  }

  return results
}
```

## 文件结构

```
chrome-extension-template/
├── newtab.html                    # 聚合问答页面（改造）
├── newtab.js                      # 聚合页面逻辑
├── content/
│   └── modules/
│       └── ai-aggregator/         # 新模块目录
│           ├── config.js          # AI 网站配置
│           ├── tab-manager.js     # 标签页管理
│           ├── injector.js        # 注入脚本
│           ├── response-watcher.js # 回复监听
│           └── messenger.js       # 消息通信
├── background.js                  # 添加消息路由逻辑
└── styles/
    └── aggregator.css             # 聚合页面样式
```

### 模块职责

| 模块                  | 职责                                   |
| --------------------- | -------------------------------------- |
| `config.js`           | AI 网站列表、选择器配置、启用/禁用状态 |
| `tab-manager.js`      | 创建/关闭 AI 标签页、批量管理          |
| `injector.js`         | 注入到 AI 标签页，自动填入问题并发送   |
| `response-watcher.js` | 监听 AI 回复内容，实时上报             |
| `messenger.js`        | 封装消息通信，处理跨 tab 通信          |
| `newtab.js`           | 聚合页面主逻辑、UI 更新、状态管理      |

## 登录机制

- 用户需预先在各 AI 网站登录
- 扩展检测登录状态，未登录时提示用户去登录
- 不存储任何账号密码信息

## 默认支持的 AI 网站

1. 豆包 (doubao.com)
2. 通义千问 (tongyi.aliyun.com)
3. Kimi (kimi.moonshot.cn)
4. 文心一言 (yiyan.baidu.com)
5. 智谱清言 (chatglm.cn)

用户可在设置中添加更多 AI 网站。
