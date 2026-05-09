# CSP绕过实现完成报告

## 实现概述

已完成三种CSP绕过方式的实现：

1. ✅ **declarativeNetRequest**（网络层拦截）
2. ✅ **Background Fetch + Message**（后台fetch）
3. ✅ **chrome.scripting.executeScript**（官方API）

---

## 文件结构

```
chrome-extension-template/
├── background.js                       # 修改：加载CSP绕过模块
├── background-csp-bypass.js            # 新增：CSP绕过background处理
├── content/modules/csp-bypass-manager.js # 新增：CSP绕过管理器
└── manifest.json                       # 修改：添加权限
```

---

## 策略详情

### 策略1：declarativeNetRequest

**文件**：`background-csp-bypass.js`

**已注册规则**：
- ID 4001-4010
- 覆盖常用库：Swiper、jQuery、Bootstrap、Vue、React、Lodash、Axios、Moment、Chart.js

**工作原理**：
```
请求JS → DNR拦截 → 重定向到国内CDN → 不受CSP限制
```

**优点**：
- 网络层拦截，性能最好
- 完全不受页面CSP影响
- 符合Manifest V3规范

**限制**：
- 只能重定向，不能修改内容
- 需要预定义规则

### 策略2：Background Fetch + Message

**文件**：
- `background-csp-bypass.js` - background消息处理
- `csp-bypass-manager.js` - 前端调用逻辑

**工作原理**：
```
Content Script → 发送消息 → Background fetch → 返回代码 → 注入页面
```

**消息类型**：
- `CSP_BYPASS_FETCH` - 请求fetch资源

**优点**：
- Background不受页面CSP限制
- 可以处理任意URL
- 支持JS和CSS

**限制**：
- 需要消息传递，有性能开销
- 某些URL可能有CORS限制

### 策略3：chrome.scripting.executeScript

**文件**：
- `background-csp-bypass.js` - scripting注入处理
- `csp-bypass-manager.js` - 前端调用逻辑

**工作原理**：
```
Content Script → 发送代码 → Background → scripting注入到MAIN世界
```

**消息类型**：
- `CSP_BYPASS_SCRIPTING` - 请求注入脚本

**优点**：
- 官方API，安全可靠
- 不受CSP限制
- 支持JS和CSS

**限制**：
- 需要scripting权限
- 代码需要先fetch

---

## 使用方式

### 在资源加速器中集成

```javascript
// 1. 创建CSPBypassManager实例
const cspBypass = new CSPBypassManager()

// 2. 加载资源（自动尝试所有策略）
const result = await cspBypass.loadResource(
  'https://cdn.jsdelivr.net/npm/swiper@latest/swiper-bundle.min.js',
  'js'
)

if (result.success) {
  console.log(`加载成功，使用策略: ${result.source}`)
} else {
  console.log(`加载失败: ${result.reason}`)
}

// 3. 查看统计信息
const stats = cspBypass.getStats()
console.log(`成功率: ${stats.successRate}`)
console.log(`各策略使用次数:`, stats.byStrategy)
```

### 在processScript中集成

```javascript
async function processScript(script) {
  const url = script.src

  // ... CDN替换逻辑 ...

  // CDN无法替换时，尝试CSP绕过
  if (!match) {
    // 尝试CSP绕过加载
    if (window.__cspBypassManager) {
      const result = await window.__cspBypassManager.loadResource(url, 'js')

      if (result.success) {
        addLog('info', 'script', 'csp_bypass', {
          url,
          strategy: result.source,
          size: result.size
        })
        return
      }
    }

    // CSP绕过也失败，继续原有逻辑
    addLog('info', 'script', 'skip', { url, reason: 'no_cdn_match' })
    return
  }

  // ... CDN替换逻辑继续 ...
}
```

---

## DNR规则列表

| ID | 库名 | 原始URL | 替换URL |
|----|------|---------|---------|
| 4001 | Swiper | cdn.jsdelivr.net/npm/swiper | cdn.bootcdn.net/ajax/libs/Swiper/11.0.5 |
| 4002 | jQuery | code.jquery.com/jquery | cdn.bootcdn.net/ajax/libs/jquery |
| 4003 | Bootstrap | bootstrapcdn.com/bootstrap | cdn.bootcdn.net/ajax/libs/bootstrap |
| 4004 | Vue | cdn.jsdelivr.net/npm/vue | cdn.bootcdn.net/ajax/libs/vue |
| 4005 | React | unpkg.com/react | cdn.bootcdn.net/ajax/libs/react |
| 4006 | React DOM | unpkg.com/react-dom | cdn.bootcdn.net/ajax/libs/react-dom |
| 4007 | Lodash | cdn.jsdelivr.net/npm/lodash | cdn.bootcdn.net/ajax/libs/lodash.js |
| 4008 | Axios | cdn.jsdelivr.net/npm/axios | cdn.bootcdn.net/ajax/libs/axios/1.6.2 |
| 4009 | Moment | cdn.jsdelivr.net/npm/moment | cdn.bootcdn.net/ajax/libs/moment.js |
| 4010 | Chart.js | cdn.jsdelivr.net/npm/chart.js | cdn.bootcdn.net/ajax/libs/Chart.js |

---

## 配置说明

### manifest.json权限

已添加：
```json
{
  "permissions": [
    "scripting",
    "declarativeNetRequest",
    "declarativeNetRequestFeedback"
  ]
}
```

### web_accessible_resources

已添加：
```json
{
  "resources": [
    "background-csp-bypass.js"
  ]
}
```

---

## 测试验证

### 测试步骤

1. 重新加载扩展
2. 打开开发者工具控制台
3. 访问有严格CSP的网站（如GitHub）
4. 查看日志输出

### 预期日志

```
[Background] CSP bypass handlers registered
[Background] JS重定向规则已注册: 10 条
[CSPBypass] Trying strategy: dnr for https://cdn.jsdelivr.net/npm/swiper@latest/...
[CSPBypass] Strategy dnr succeeded for https://cdn.jsdelivr.net/npm/swiper@latest/...
```

### 成功标志

- DNR规则生效：JS请求被重定向
- Background Fetch：成功获取代码并注入
- Scripting注入：代码成功执行
- 控制台无CSP错误

---

## 性能影响

| 策略 | 性能 | 延迟 |
|------|------|------|
| DNR | 最优 | 0ms（网络层） |
| Background Fetch | 良好 | 50-200ms |
| Scripting | 一般 | 100-300ms |

**建议**：优先使用DNR，仅在有需要时使用其他策略

---

## 后续优化

### 可添加的DNR规则

```javascript
// 更多常用库
{
  id: 4011,
  regex: '^https?://cdn\\.jsdelivr\\.net/npm/uuid@([\\d.]+)/dist/uuid(?:\\.min)?\\.js',
  sub: 'https://cdn.bootcdn.net/ajax/libs/uuid/\\1/uuid.min.js'
}
```

### 可优化的点

1. **规则动态更新**：从服务器获取最新CDN映射
2. **智能策略选择**：根据历史成功率选择最优策略
3. **预加载**：提前加载常用库
4. **错误上报**：收集CSP绕过失败案例

---

## 注意事项

1. **安全风险**：只加载可信来源的资源
2. **CORS限制**：某些URL可能因CORS无法fetch
3. **权限要求**：scripting需要用户授权
4. **审核风险**：绕过CSP可能影响Chrome Web Store审核

---

**实现完成时间**：2026-05-10
**新增代码**：~450行
**新增文件**：2个
**修改文件**：2个
