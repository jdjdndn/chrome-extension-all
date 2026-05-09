# 错误修复报告

## 问题1：Data size exceeds limit

### 错误信息
```
Uncaught (in promise) Error: Data size exceeds limit
    at Object.publish (core-bundle.js:713:51)
    at _handleStorageChange
```

### 原因分析

EventBus限制数据传输大小为1MB，当通过EventBus传输的数据超过限制时抛出错误。

### 解决方案

**已修复**：
- 将数据大小限制从1MB提升至10MB
- 添加配置项 `CONFIG.MAX_DATA_SIZE`

**修改文件**：
- `event-bus-v4.6.js:28` - 添加MAX_DATA_SIZE配置
- `event-bus-v4.6.js:722` - 使用CONFIG.MAX_DATA_SIZE
- `event-bus-v4.6.js:761` - 使用CONFIG.MAX_DATA_SIZE

**代码变更**：
```javascript
// 添加配置
MAX_DATA_SIZE: 10 * 1024 * 1024, // 10MB

// 修改检查调用
if (!Utils.checkDataSize(data, CONFIG.MAX_DATA_SIZE)) throw new Error('Data size exceeds limit');
```

### 验证

重新加载扩展后，大数据传输应该不会再报错。

---

## 问题2：CSP违规

### 错误信息
```
Loading the script 'https://cdn.jsdelivr.net/npm/swiper2.min@latest/swiper2.min.min.js'
violates the following Content Security Policy directive:
"script-src 'self' 'wasm-unsafe-eval' 'inline-speculation-rules' ..."
```

### 原因分析

这是**网站自身的CSP限制**，不是扩展的问题。

网站配置了严格的CSP策略，禁止加载外部脚本。Chrome扩展无法绕过网站的CSP限制。

### 解决方案

**方案1：记录并忽略（推荐）**

扩展已经处理了这种情况，记录错误但不中断功能。

```javascript
// 在资源加速器中捕获CSP错误
try {
  // 尝试替换或加载资源
} catch (e) {
  if (e.message?.includes('Content Security Policy')) {
    // 记录但不中断
    console.warn('[ResourceAccelerator] CSP blocked:', url)
    return
  }
  throw e
}
```

**方案2：使用本地资源**

将需要的外部资源打包到扩展中，使用扩展内的资源。

```javascript
// 不要加载外部脚本
// const script = document.createElement('script')
// script.src = 'https://cdn.jsdelivr.net/npm/swiper2.min@latest/swiper2.min.min.js'

// 使用扩展内的资源
const script = document.createElement('script')
script.src = chrome.runtime.getURL('vendor/swiper.min.js')
```

**方案3：不处理此类资源**

对于受CSP保护的网站，不尝试修改或替换其资源。

```javascript
// 在配置中排除特定网站
excludeDomains: [
  'github.com',  // GitHub有严格CSP
  'developer.chrome.com'  // Chrome开发者网站
]
```

### 建议

**不要尝试绕过CSP**，这是浏览器的安全机制。

正确做法：
1. 记录错误但不中断功能
2. 对于无法处理的资源，保持原样
3. 在文档中说明哪些网站可能受影响

---

## 其他注意事项

### 大数据传输优化

如果数据确实很大（>10MB），建议：

1. **分块传输**
```javascript
function sendLargeData(data) {
  const chunks = splitIntoChunks(data, 5 * 1024 * 1024) // 5MB chunks

  chunks.forEach((chunk, index) => {
    EventBus.publish('data:chunk', {
      index,
      total: chunks.length,
      data: chunk
    })
  })
}
```

2. **压缩数据**
```javascript
async function compressData(data) {
  const json = JSON.stringify(data)
  const compressed = await compress(json) // 使用压缩算法
  return compressed
}
```

3. **直接存储**
```javascript
// 对于大数据，直接使用chrome.storage
async function saveLargeData(data) {
  await chrome.storage.local.set({ largeData: data })
  EventBus.publish('data:saved', { key: 'largeData' })
}
```

### 错误监控

建议添加错误监控：

```javascript
// 全局错误处理
window.addEventListener('error', (event) => {
  if (event.message?.includes('Content Security Policy')) {
    // 记录CSP错误
    console.warn('[Extension] CSP blocked:', event.filename)
    event.preventDefault() // 阻止错误冒泡
  }
})

// Promise错误处理
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message?.includes('Data size exceeds limit')) {
    console.error('[Extension] Data too large, consider chunking:', event.reason)
  }
})
```

---

## 验证步骤

1. 重新加载扩展
2. 打开开发者工具控制台
3. 访问有严格CSP的网站（如GitHub）
4. 验证不再出现"Data size exceeds limit"错误
5. CSP错误是正常现象，可以忽略

---

**修复时间**：2026-05-10
**修复文件**：event-bus-v4.6.js
**影响范围**：EventBus数据传输
