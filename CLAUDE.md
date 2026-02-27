# Chrome Extension - 减少资源使用

## 项目概述

Chrome 扩展，用于减少接口信息使用。包含 DevTools 面板，支持 Mock 功能。

## 前置条件

1. **中文优先**：能用中文的地方用中文（注释、日志、变量名酌情）
2. **深度思考**：确保问题能一次性解决，思考完整流程再动工
3. **减少问题**：每次 coding 尽可能减少新问题出现
4. **不确定就问**：不确定的问题通过选择方式询问用户
5. **代码质量**：以最优美最易懂的方式实现功能

## 技术栈

- Manifest V3
- Chrome DevTools API
- Content Script + Inject Script 分离架构

## 关键架构

```
DevTools Panel (console.js)
    ↓ chrome.devtools.inspectedWindow.eval()
Page Context (inject.js) - 拦截 fetch/XHR
    ↓ postMessage
Content Script (content.js) - DOM 操作、消息转发
    ↓ chrome.runtime.sendMessage
Background Service Worker (background.js)
```

## Mock 流程

1. 用户在 DevTools 点击 Mock
2. `mockAndRequest()` 通过 `inspectedWindow.eval()` 在页面上下文设置 `window.__mockData[key]`
3. 同时发送真实 fetch 请求
4. inject.js 拦截 fetch，发现 mock 数据，发送真实网络请求，替换响应体
5. Network API 捕获请求，`handleRequest()` 处理并添加到列表

## 关键文件

- `inject.js` - 页面上下文脚本，拦截 fetch/XHR
- `content.js` - 内容脚本，DOM 操作
- `devtools/console.js` - DevTools 面板逻辑
- `devtools/console.html` - DevTools 面板 UI
- `background.js` - 后台服务
- `manifest.json` - 扩展配置

## 注意事项

- inject.js 在页面上下文运行，能直接拦截 fetch/XHR
- content.js 和 inject.js 隔离，通过 postMessage 通信
- DevTools 面板只能通过 `inspectedWindow.eval()` 执行页面上下文代码
- Network API 只捕获真实网络请求
- 不要在 inject.js 和 content.js 中重复拦截 fetch/XHR
