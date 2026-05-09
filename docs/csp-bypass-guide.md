# CSP绕过技术方案

## 重要说明

**CSP是浏览器安全机制**，完全绕过不可行也不安全。但可以使用技术手段**规避部分限制**。

⚠️ **注意**：
- 不保证所有网站都能绕过
- 可能影响扩展审核
- 建议优先使用降级策略

---

## 当前方案

已实现的CSP处理：

| 方案 | 适用资源 | 效果 |
|------|---------|------|
| declarativeNetRequest | CSS/字体 | ✅ 网络层拦截，不受CSP影响 |
| DOM层替换 | JS | ⚠️ 受CSP限制 |
| CSP检测降级 | 所有 | ✅ 检测到CSP禁用功能 |

---

## 技术方案

### 方案1：完全使用 declarativeNetRequest（推荐）

**原理**：在网络层拦截所有资源请求，包括JS

**优点**：
- 不受页面CSP限制
- 性能最好
- 符合Manifest V3规范

**缺点**：
- 只能重定向，不能修改内容
- 需要预定义规则

**实现**：

```javascript
// manifest.json - 添加权限
{
  "permissions": [
    "declarativeNetRequest",
    "declarativeNetRequestFeedback"
  ]
}

// background.js - 添加JS重定向规则
const JS_REDIRECT_RULES = [
  // Swiper.js
  {
    id: 4001,
    priority: 1,
    action: {
      type: 'redirect',
      redirect: {
        url: 'https://cdn.bootcdn.net/ajax/libs/Swiper/11.0.5/swiper-bundle.min.js'
      }
    },
    condition: {
      urlFilter: '*://cdn.jsdelivr.net/npm/swiper*',
      resourceTypes: ['script']
    }
  },
  // 其他常用库...
]

// 更新规则
await chrome.declarativeNetRequest.updateDynamicRules({
  addRules: JS_REDIRECT_RULES
})
```

**限制**：
- 目标URL必须允许被重定向（支持CORS）
- 不能处理动态生成的URL

---

### 方案2：Background Fetch + Message

**原理**：在background脚本中fetch资源，通过消息传给content script

**优点**：
- Background不受页面CSP限制
- 可以处理任意URL

**缺点**：
- 需要消息传递，性能开销
- 数据大小受chrome.message限制

**实现**：

```javascript
// background.js
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'fetchResource') {
    fetch(message.url)
      .then(res => res.text())
      .then(code => {
        sendResponse({ success: true, code })
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message })
      })
    return true // 保持消息通道开启
  }
})

// content script
async function loadScriptBypassCSP(url) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'fetchResource', url },
      response => {
        if (response?.success) {
          // 创建script标签注入代码
          const script = document.createElement('script')
          script.textContent = response.code
          document.head.appendChild(script)
          resolve()
        } else {
          reject(new Error(response?.error || 'Fetch failed'))
        }
      }
    )
  })
}

// 使用
try {
  await loadScriptBypassCSP('https://cdn.jsdelivr.net/npm/swiper@latest/swiper-bundle.min.js')
} catch (e) {
  console.warn('CSP bypass failed:', e)
}
```

**限制**：
- 某些网站可能有CORS限制
- 大文件传输需要分块

---

### 方案3：chrome.scripting.executeScript

**原理**：使用扩展API直接注入脚本到页面

**优点**：
- 官方API，安全可靠
- 不受CSP限制

**缺点**：
- 需要注入到MAIN世界（页面上下文）
- Manifest V3限制较多

**实现**：

```javascript
// manifest.json
{
  "permissions": ["scripting", "activeTab"]
}

// content script或background
async function injectScript(url) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  
  // 方法1：注入代码字符串
  const code = await fetch(url).then(r => r.text())
  
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: 'MAIN', // 注入到页面上下文
    func: (scriptCode) => {
      const script = document.createElement('script')
      script.textContent = scriptCode
      document.head.appendChild(script)
    },
    args: [code]
  })
}

// 方法2：使用injectImmediately
await chrome.scripting.executeScript({
  target: { tabId: tab.id },
  files: ['injected-script.js'],
  injectImmediately: true
})
```

**限制**：
- 需要activeTab或host权限
- 代码在隔离环境中执行

---

### 方案4：Sandboxed iframe

**原理**：创建一个没有CSP限制的iframe来加载资源

**优点**：
- 完全隔离
- 不受主页面CSP影响

**缺点**：
- iframe本身可能有CSP
- 跨域通信复杂

**实现**：

```javascript
function createSandboxedLoader() {
  const iframe = document.createElement('iframe')
  iframe.sandbox.add('allow-scripts')
  iframe.style.display = 'none'
  document.body.appendChild(iframe)
  
  return {
    async loadScript(url) {
      return new Promise((resolve, reject) => {
        const handler = (event) => {
          if (event.data?.type === 'scriptLoaded') {
            window.removeEventListener('message', handler)
            resolve()
          }
        }
        
        window.addEventListener('message', handler)
        
        iframe.srcdoc = `
          <script>
            fetch('${url}')
              .then(r => r.text())
              .then(code => {
                eval(code)
                parent.postMessage({ type: 'scriptLoaded' }, '*')
              })
              .catch(e => parent.postMessage({ type: 'scriptError', error: e.message }, '*'))
          </script>
        `
        
        setTimeout(() => reject(new Error('Timeout')), 10000)
      })
    }
  }
}

// 使用
const loader = createSandboxedLoader()
await loader.loadScript('https://cdn.jsdelivr.net/npm/swiper@latest/swiper-bundle.min.js')
```

**限制**：
- 某些CSP会阻止iframe的sandbox属性
- 需要CORS支持

---

### 方案5：Blob URL（不推荐）

**原理**：将代码转换为Blob URL然后加载

**缺点**：
- 大多数严格CSP会阻止blob:协议
- 不稳定

**代码示例**：

```javascript
// ❌ 通常会被CSP阻止
async function loadAsBlob(url) {
  const code = await fetch(url).then(r => r.text())
  const blob = new Blob([code], { type: 'application/javascript' })
  const blobUrl = URL.createObjectURL(blob)
  
  const script = document.createElement('script')
  script.src = blobUrl  // CSP通常会阻止blob:
  document.head.appendChild(script)
}
```

---

## 推荐策略

### 优先级排序

1. **declarativeNetRequest**（首选）
   - 网络层拦截
   - 不受CSP影响
   - 性能最好

2. **Background Fetch + Message**
   - 兜底方案
   - 适用于无法预先定义规则的情况

3. **chrome.scripting.executeScript**
   - 官方API
   - 需要权限

4. **降级处理**（最终方案）
   - 检测CSP限制
   - 禁用相关功能
   - 不影响其他功能

### 实现建议

```javascript
// resource-accelerator.js

class CSPBypassManager {
  constructor() {
    this.strategies = [
      { name: 'dnr', priority: 1, handler: this._useDNR },
      { name: 'background', priority: 2, handler: this._useBackgroundFetch },
      { name: 'scripting', priority: 3, handler: this._useScripting },
      { name: 'fallback', priority: 99, handler: this._fallback }
    ]
  }

  async loadResource(url, type) {
    for (const strategy of this.strategies) {
      try {
        const result = await strategy.handler(url, type)
        if (result?.success) {
          console.log(`[CSP] Strategy ${strategy.name} succeeded`)
          return result
        }
      } catch (e) {
        console.warn(`[CSP] Strategy ${strategy.name} failed:`, e.message)
      }
    }
    
    return { success: false, reason: 'All strategies failed' }
  }

  async _useDNR(url, type) {
    // DNR已在网络层处理，这里只是检查
    return { success: true, source: 'dnr' }
  }

  async _useBackgroundFetch(url, type) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'fetchResource', url, resourceType: type },
        response => {
          if (response?.success) {
            // 注入到页面
            this._injectCode(response.code, type)
            resolve({ success: true, source: 'background' })
          } else {
            resolve({ success: false })
          }
        }
      )
    })
  }

  async _useScripting(url, type) {
    if (!chrome.scripting) {
      return { success: false }
    }

    const code = await fetch(url).then(r => r.text())
    
    // 需要 background 配合
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: 'MAIN',
      func: (c) => {
        const s = document.createElement('script')
        s.textContent = c
        document.head.appendChild(s)
      },
      args: [code]
    })
    
    return { success: true, source: 'scripting' }
  }

  _fallback(url, type) {
    console.log(`[CSP] Fallback: keeping original URL ${url}`)
    return { success: false, reason: 'CSP restricted' }
  }

  _injectCode(code, type) {
    if (type === 'js') {
      const script = document.createElement('script')
      script.textContent = code
      document.head.appendChild(script)
    } else if (type === 'css') {
      const style = document.createElement('style')
      style.textContent = code
      document.head.appendChild(style)
    }
  }
}

// 使用
const cspBypass = new CSPBypassManager()
await cspBypass.loadResource('https://cdn.jsdelivr.net/npm/swiper@latest/swiper-bundle.min.js', 'js')
```

---

## 风险提示

1. **Chrome Web Store审核**
   - 绕过CSP可能导致审核拒绝
   - 需要说明正当用途

2. **兼容性**
   - 不同网站CSP策略不同
   - 需要测试兼容性

3. **安全性**
   - 注意不要注入恶意代码
   - 验证资源来源

4. **性能**
   - 多种策略尝试会增加延迟
   - 建议优先使用DNR

---

## 最终建议

**生产环境**：使用declarativeNetRequest + 降级策略

**开发测试**：可以尝试Background Fetch方案

**不推荐**：完全绕过所有CSP（安全风险）

---

**文档创建时间**：2026-05-10
**适用版本**：Manifest V3
