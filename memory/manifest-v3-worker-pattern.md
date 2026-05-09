---
name: Manifest V3 Worker 创建模式
description: Content script 中使用扩展资源创建 Worker 的最佳实践
type: reference
---

# Manifest V3 Worker 创建模式

## 问题背景

在 Manifest V3 中，content script 运行在网页上下文中，受网页 CSP 限制。使用 `blob:` URL 或 `data:` URL 创建 Worker 会被严格的 CSP（如 GitHub 的 `worker-src` 指令）阻止。

**错误示例：**
```
Creating a worker from 'blob:https://github.com/...' violates the following Content Security Policy directive: "worker-src github.githubassets.com ...". The action has been blocked.
```

## 解决方案

使用 `chrome.runtime.getURL()` 加载扩展包内的独立 Worker 文件。

### 1. 创建独立 Worker 文件

将 Worker 代码放在 `content/workers/` 目录下：

```javascript
// content/workers/xxx.worker.js
self.onmessage = function(e) {
  // Worker 逻辑
  const result = process(e.data)
  self.postMessage({ result })
}
```

### 2. manifest.json 声明资源

```json
{
  "web_accessible_resources": [
    {
      "resources": ["content/workers/*.js"],
      "matches": ["<all_urls>"]
    }
  ]
}
```

### 3. 使用 chrome.runtime.getURL() 创建 Worker

```javascript
// content/modules/xxx.js
function createWorker() {
  try {
    const workerUrl = chrome.runtime.getURL('content/workers/xxx.worker.js')
    const worker = new Worker(workerUrl)
    
    worker.onerror = (e) => {
      if (e.message?.includes('Content Security Policy')) {
        console.warn('[Worker] CSP 阻止，禁用功能')
        return
      }
    }
    
    return worker
  } catch (e) {
    console.warn('[Worker] 创建失败:', e.message)
    return null
  }
}
```

## 关键要点

1. **避免 Blob URL**：`new Worker(URL.createObjectURL(blob))` 在受 CSP 限制的网站上会失败
2. **独立文件**：Worker 代码必须放在扩展包内的独立文件中
3. **web_accessible_resources**：必须声明 Worker 文件为可访问资源
4. **错误处理**：捕获 CSP 错误并提供降级方案

## 已修复文件

- `content/modules/SelectorWorker.js` - 从 Blob URL 改为 `chrome.runtime.getURL()`
- `content/workers/selector.worker.js` - 新建独立 Worker 文件
- `content/modules/resource-accelerator.js` - 已使用正确模式（`image-compressor.worker.js`）
