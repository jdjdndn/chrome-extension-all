# 插件推荐功能设计文档

## 概述

根据当前域名，从 GitHub 搜索并推荐可用的 Chrome 扩展插件。

## 功能特性

- 手动触发查询当前域名可用插件
- GitHub 搜索为主，本地 IndexedDB 缓存加速
- 关键词搜索 + manifest.json 域名匹配过滤
- 展示插件信息 + 一键跳转安装

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Popup 面板                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ 查询按钮    │───→│ 插件推荐器  │───→│ 结果展示列表    │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PluginRecommender                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────┐  │
│  │ 缓存管理器  │    │ GitHub 搜索 │    │ Manifest 过滤器 │  │
│  │ (IndexedDB) │    │    API      │    │                 │  │
│  └─────────────┘    └─────────────┘    └─────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     存储层                                   │
│  ┌─────────────────────┐    ┌─────────────────────────────┐ │
│  │ IndexedDB (持久缓存)│    │ GitHub Token (chrome.storage)│ │
│  └─────────────────────┘    └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 数据流

```
用户点击查询 → 获取域名 → 检查缓存
                          │
                          ├─ 缓存命中 → 返回结果
                          │
                          └─ 缓存未命中
                                │
                                ▼
                          GitHub 搜索（关键词: 域名）
                                │
                                ▼
                          获取仓库列表（限前 30 个）
                                │
                                ▼
                          并行获取 manifest.json
                                │
                                ▼
                          过滤匹配域名
                                │
                                ▼
                          写入缓存 → 返回结果
```

## 核心接口

### PluginRecommender 类

```javascript
class PluginRecommender {
  constructor()

  // 主入口：查询域名可用插件
  async queryPlugins(domain: string): Promise<PluginResult[]>

  // 清除缓存
  async clearCache(domain?: string): Promise<void>
}
```

### 数据结构

```typescript
// 插件结果
interface PluginResult {
  id: string // GitHub repo ID
  name: string // 仓库名
  fullName: string // owner/repo
  description: string // 描述
  stars: number // star 数
  url: string // GitHub 链接
  manifestUrl: string // raw manifest 链接
  matchedDomains: string[] // manifest 中匹配的域名
  chromeStoreUrl?: string // Chrome 商店链接（如有）
  installType: 'github' | 'chrome-store' // 安装类型
}

// 缓存条目
interface CacheEntry {
  domain: string
  plugins: PluginResult[]
  timestamp: number
  expiresAt: number
}
```

## GitHub API

### 搜索仓库

```
GET https://api.github.com/search/repositories
  ?q={domain}+chrome+extension+in:readme,description
  &sort=stars
  &per_page=30
```

### 获取 manifest.json

```
GET https://raw.githubusercontent.com/{owner}/{repo}/{branch}/manifest.json
```

## 缓存策略

| 配置项   | 值                                          |
| -------- | ------------------------------------------- |
| 缓存键   | 域名（如 `taobao.com`）                     |
| 缓存内容 | 插件列表 + 时间戳                           |
| 过期时间 | 7 天                                        |
| 存储位置 | IndexedDB（`plugin-recommendations` store） |

## UI 设计

### Popup 新增区块

```
┌─────────────────────────────────────────┐
│  🔍 插件推荐                        [刷新] │
├─────────────────────────────────────────┤
│  当前域名: taobao.com                   │
│                                         │
│  [查询可用插件]                         │
├─────────────────────────────────────────┤
│  查询结果:                              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 淘宝助手                        │ ⭐ │
│  │ 淘宝购物增强工具                │ 2.3k│
│  │ 匹配: *.taobao.com              │    │
│  │ [GitHub] [Chrome 商店]          │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [清除缓存]                             │
└─────────────────────────────────────────┘
```

### 状态展示

| 状态         | 展示内容                           |
| ------------ | ---------------------------------- |
| 加载中       | spinner + "正在查询..."            |
| 无结果       | "当前域名暂无推荐插件"             |
| 错误         | 错误信息 + 重试按钮                |
| Token 未配置 | "配置 GitHub Token 可提高查询限额" |

## 错误处理

| 场景                   | 处理方式                         |
| ---------------------- | -------------------------------- |
| GitHub API 限流 (403)  | 提示配置 Token，显示配置入口     |
| 网络超时               | "网络超时，请重试"，提供重试按钮 |
| manifest.json 不存在   | 跳过该仓库，继续处理其他结果     |
| manifest.json 解析失败 | 跳过该仓库，记录日志             |
| 无匹配结果             | "暂无推荐插件"                   |
| 缓存过期               | 自动触发新查询                   |
| Token 无效             | "Token 无效，请检查"             |

## 性能优化

| 优化项   | 配置                       |
| -------- | -------------------------- |
| 并行请求 | 最多 5 个并发获取 manifest |
| 请求超时 | 5 秒                       |
| 结果截断 | 最多返回 10 个插件         |

## 文件清单

| 文件                                   | 用途         |
| -------------------------------------- | ------------ |
| `content/modules/PluginRecommender.js` | 核心推荐逻辑 |
| `popup.html`                           | UI 更新      |
| `popup.js`                             | UI 交互逻辑  |

## 实现顺序

1. 实现 `PluginRecommender` 核心类
2. 实现 IndexedDB 缓存管理
3. 实现 GitHub API 调用与 manifest 过滤
4. 更新 Popup UI
5. 集成测试
