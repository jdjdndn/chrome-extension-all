---
name: 热重载架构
description: Chrome扩展MV3热重载实现方案
type: reference
---

# Chrome扩展MV3热重载架构

## 问题背景

MV3的Service Worker会在空闲时休眠，无法维持持久WebSocket连接。

## 解决方案

**HTTP轮询 + WebSocket混合架构**

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
```

## 组件

### 1. 热重载服务器

**文件**: `scripts/hot-reload-server.mjs`

**端点**:

- `GET /check-build?last=<timestamp>` — Service Worker轮询检查
- `POST /reload` — 构建完成通知
- `ws://localhost:8765` — WebSocket端点

### 2. Service Worker热重载

**文件**: `hot-reload-background.js`

**机制**: chrome.alarms每2秒唤醒，HTTP请求检查构建时间戳

### 3. Content Script热重载

**文件**: `content/hot-reload-client.js`

**机制**: WebSocket连接，断线自动重连（指数退避）

## 使用方式

```bash
npm run dev  # 启动开发模式（热重载 + Vite watch）
```

## 环境变量

- `HOT_RELOAD_PORT` — 自定义热重载服务器端口（默认8765）
- `NODE_ENV=development` — 开发模式，启用热重载

## Why

- Service Worker无法维持WebSocket连接 → 使用HTTP轮询
- Content Script可以维持WebSocket → 使用实时推送
- 分离两种场景，各自最优
