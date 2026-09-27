# ReplaceGoogleCDN 优质能力融入计划

> 目标：将 ReplaceGoogleCDN 做得好的地方融入 chrome-extension-template，同时补足其缺陷。
> 日期：2025-09-14（v2 — 对齐现有架构）

---

## 现有架构概述

本扩展采用**双层资源加速架构**，理解这一点是本计划的基础：

```
┌─────────────────────────────────────────────────────┐
│  DNR 网络层（declarativeNetRequest）                  │
│  · CSS/字体重定向（ID 3000-3099，5 条）               │
│  · JS 重定向（ID 4000-4999，435 条，自动生成）        │
│  · 域名屏蔽（ID 1000-1999）                           │
│  · CDN 白名单（ID 900-999）                           │
│  特点：浏览器原生处理，零运行时开销，但无法动态切换镜像   │
├─────────────────────────────────────────────────────┤
│  DOM 层（content scripts）                            │
│  · FontReplacer：Google Fonts CSS → fonts.font.im     │
│  · JSReplacer：JS 库 → BootCDN（带降级链）             │
│  · CSSAccelerator：CSS 框架 → BootCDN                 │
│  · CDNHealthProbe：反应式标记（markUnhealthy）          │
│  特点：可动态切换镜像、健康降级，但有 DOM 时序竞争      │
└─────────────────────────────────────────────────────┘
```

**设计原则**：CSS/字体走 DNR 网络层（CSP `style-src` 通常宽松），JS 走 DOM 层安全替换（避免 DNR 重定向引入的安全风险）。这一分工不是偶然，而是经过实测验证的安全策略。

### 现有 DNR 规则 ID 分配

| ID 范围   | 用途                                               | 注册方式                           | 来源文件                             |
| --------- | -------------------------------------------------- | ---------------------------------- | ------------------------------------ |
| 1-27      | 静态域名屏蔽                                       | `manifest.json` → `rule_resources` | `rules.json`                         |
| 900-999   | CDN 白名单（allow，保护 CDN 域名不被屏蔽规则误拦） | `updateDynamicRules()`             | `background.js`                      |
| 1000-1999 | 用户配置域名屏蔽                                   | `updateDynamicRules()`             | `background.js`                      |
| 2000-2999 | 响应屏蔽                                           | `updateDynamicRules()`             | `background.js`                      |
| 3000-3099 | CSS/字体重定向（当前 5 条）                        | `updateDynamicRules()`             | `background.js` `CDN_REDIRECT_RULES` |
| 4000-4999 | 自动生成 JS 重定向（当前 435 条）                  | `updateDynamicRules()`             | `background-csp-bypass.js`           |

> **关于自动生成规则**：`scripts/generate-dnr-rules.js` 从 `JS_CDN_MAP`（50+ 库 × 5 个源 CDN）自动生成 435 条 `regexFilter` + `regexSubstitution` 规则，输出到 `background-dnr-rules-auto.js`，由 `background-csp-bypass.js` 的 `registerJSRedirectRules()` 注册。这不是"每次启动执行 JS 生成规则"——规则在构建时生成，启动时只是注册已有的 JSON 数组。

### 现有 Google 域名覆盖情况

| 域名                           | 覆盖层              | 目标                 | 状态      |
| ------------------------------ | ------------------- | -------------------- | --------- |
| `ajax.googleapis.com`          | DNR（4000-4999）    | `cdn.staticfile.org` | ✅ 已覆盖 |
| `fonts.googleapis.com`         | DOM（FontReplacer） | `fonts.font.im`      | ✅ 已覆盖 |
| `fonts.gstatic.com`            | —                   | —                    | ❌ 未覆盖 |
| `themes.googleusercontent.com` | —                   | —                    | ❌ 未覆盖 |
| `secure.gravatar.com`          | —                   | —                    | ❌ 未覆盖 |
| `www.gstatic.com`              | —                   | —                    | ❌ 未覆盖 |
| `www.google.com/recaptcha`     | —                   | —                    | ❌ 未覆盖 |

---

## 一、ReplaceGoogleCDN 做得好的（要拿过来）

### 1. CSP 头移除机制

跨域重定向后，原始站点的 `content-security-policy` 头会阻止加载镜像站资源。ReplaceGoogleCDN 通过 `modifyHeaders` 规则移除这些头，这是必要的。

**要做的**：创建针对性的 CSP 移除规则，只移除 `content-security-policy` 和 `content-security-policy-report-only`，对所有 HTML 文档响应生效（见阶段 1）。

### 2. 正则捕获组重写

对于路径结构不同的 CDN（如 `code.jquery.com` → `cdn.staticfile.org/jquery@...`），用 `regexFilter` + `regexSubstitution` 做精确重写。本扩展的自动生成规则（435 条）已采用此方式，但 ReplaceGoogleCDN 覆盖的某些域名本扩展尚未覆盖。

**要做的**：补充缺失域名的重定向规则（见阶段 1）。

---

## 二、ReplaceGoogleCDN 做得不好的（要补足）

### 1. ❌ 镜像站稳定性无保障

loli.net、baomitu.com 等第三方镜像随时可能挂掉，用户只能手动切换。项目里已标记 4 个 CDN 不可用（极客族、AHDark、BootCDN、静态库）。

**补足方案**：保留现有的**反应式降级**机制（`CDNHealthProbe.markUnhealthy()`），不重新引入主动探测。

> **决策依据（2026-05-22）**：已取消主动 CDN 健康探测。`content script fetch(..., {mode:'no-cors'})` 在弱网/CSP 受限/AdBlock 拦截环境下产生大量噪音，且无收益。`no-cors` 模式下 fetch 对 404/500 不 reject，信号意义极弱。反应式标记（资源真正加载失败时再降级）已足够。

具体增强：

- 确保 `FontReplacer`/`JSReplacer` 的加载失败路径调用 `markUnhealthy`
- 在 popup 中展示镜像状态（通过 `chrome.storage.local` 桥接——background 将 `CDNHealthProbe.getProbeStats()` 的结果定期写入 storage，popup 从 storage 读取。popup 运行在独立隔离世界中，无法直接访问 content script 的 `CDNHealthProbe` 全局变量）
- 用户可在 popup 中手动切换首选镜像（覆盖自动评分）

### 2. ❌ 仅覆盖 Google 相关域名

ReplaceGoogleCDN 只替换了少数几个域名。本扩展的自动生成规则已覆盖 50+ 库的 5 个源 CDN（bootcdn/staticfile/jsdelivr/cdnjs/unpkg），远超 ReplaceGoogleCDN。缺失的是**非 JS 资源**（Google Fonts 字体文件、Gravatar 等）。

### 3. ❌ CSP 移除过于激进

ReplaceGoogleCDN 移除了 16 个安全头，包括 `x-frame-options`、`permissions-policy` 等，降低了整个页面的安全性。

**补足方案**：

- 只移除 `content-security-policy` 和 `content-security-policy-report-only`
- 其他安全头不动
- 对所有页面响应移除（`resourceTypes: ['main_frame', 'sub_frame']`），以最小安全代价换取功能
- **已知局限**：DNR 不支持 `initiatorDomains` + `modifyHeaders` 组合，无法仅对发起过 CDN 请求的页面移除 CSP。所有页面的 CSP 都会被移除，这是当前 Chrome API 的限制

### 4. ❌ 用户配置界面原始

选项页是 JSON 编辑器，用户需要手写规则 JSON，门槛极高。

**补足方案**：利用现有 popup UI，展示域名映射表、镜像状态、一键开关。高级配置才用 JSON 编辑。

### 5. ❌ 规则维护靠手动

CDN 域名变更、镜像站失效都需要手动更新扩展版本。

**补足方案**：支持从远程 URL 拉取规则更新，规则版本号 + ETag 缓存。安全约束见阶段 3。

---

## 三、具体实施步骤

### 阶段 1：补充缺失的 DNR 重定向规则 + CSP 移除（核心）

**目标**：补齐 ReplaceGoogleCDN 覆盖但本扩展缺失的域名，同时添加 CSP 头移除。

**修改文件**：`background.js`

#### 1a. 在 `CDN_REDIRECT_RULES`（ID 3000-3099）中添加新规则

当前 `CDN_REDIRECT_RULES` 只有 5 条 CSS/字体重定向规则（bootstrapcdn/fontawesome/jquery-ui/jquery-mobile），注册时 `resourceTypes` 硬编码为 `['stylesheet', 'font']`。

> **⚠️ `resourceTypes` 不匹配问题**：新规则中 `themes.googleusercontent.com`（image）、`www.gstatic.com`（script）、`secure.gravatar.com`（image）的资源类型不在 `['stylesheet', 'font']` 中，会被静默过滤。需要为每条规则指定独立的 `resourceTypes`。

修改 `CDN_REDIRECT_RULES` 的数据结构，为每条规则添加 `resourceTypes` 字段：

```javascript
// 修改前（现有规则，resourceTypes 在注册时硬编码）：
{ id: 3020, regex: '...', sub: '...' }

// 修改后（每条规则自带 resourceTypes）：
{ id: 3020, regex: '...', sub: '...', resourceTypes: ['stylesheet', 'font'] }
```

新增规则：

```javascript
// Google Fonts 字体文件（浏览器解析 fonts.googleapis.com CSS 后直接请求）
// 资源类型: font
{
  id: 3030,
  regex: '^https://fonts\\.gstatic\\.com/(.*)',
  sub: 'https://fonts.loli.net/gstatic/\\1',
  resourceTypes: ['font'],
},
// Google 用户头像
{
  id: 3031,
  regex: '^https://themes\\.googleusercontent\\.com/(.*)',
  sub: 'https://themes.loli.net/\\1',
  resourceTypes: ['image'],
},
// Gravatar 头像
{
  id: 3032,
  regex: '^https://secure\\.gravatar\\.com/(.*)',
  sub: 'https://gravatar.loli.net/\\1',
  resourceTypes: ['image'],
},
// Google 静态资源
{
  id: 3033,
  regex: '^https://www\\.gstatic\\.com/(.*)',
  sub: 'https://www.gstatic.cn/\\1',
  resourceTypes: ['script'],
},
// reCAPTCHA（简单域名替换）
{
  id: 3034,
  regex: '^https://www\\.google\\.com/recaptcha/(.*)',
  sub: 'https://www.recaptcha.net/recaptcha/\\1',
  resourceTypes: ['script'],
},
```

同步修改 `updateCDNRedirectRules()` 中的规则注册逻辑，从每条规则的 `resourceTypes` 字段读取（默认 `['stylesheet', 'font']`）：

```javascript
// 修改前：
const rules = CDN_REDIRECT_RULES.map((r) => ({
  ...
  condition: {
    regexFilter: r.regex,
    resourceTypes: ['stylesheet', 'font'],  // 硬编码
    ...
  },
}))

// 修改后：
const rules = CDN_REDIRECT_RULES.map((r) => ({
  ...
  condition: {
    regexFilter: r.regex,
    resourceTypes: r.resourceTypes || ['stylesheet', 'font'],  // 从规则读取
    ...
  },
}))
```

> **注意**：`fonts.googleapis.com`（CSS 文件）已由 DOM 层 `FontReplacer` 处理，不需要 DNR 规则。`fonts.gstatic.com`（CSS 中引用的 font-url）浏览器直接请求，不经过 DOM，**必须**用 DNR 处理。

#### 1b. 添加 CSP 头移除规则（ID 3100-3199，新增规则集）

> **⚠️ 关键设计决策**：CSP 头由页面服务器（如 `example.com`）设置，阻止加载跨域资源。DNR `modifyHeaders` 的 `requestDomains` 匹配的是**请求目标 URL 的域名**，不是页面域名。用 `requestDomains: ['fonts.googleapis.com']` 只能移除 `fonts.googleapis.com` 自身响应中的 CSP（它通常没有），无法移除 `example.com` 的 CSP。
>
> **正确做法**：对所有 HTML 文档响应移除 CSP 头。Chrome DNR 的 `resourceTypes` 合法值为 `main_frame`（顶层文档）和 `sub_frame`（iframe），没有 `document`。用 `resourceTypes: ['main_frame', 'sub_frame']` 匹配所有页面响应。这是 ReplaceGoogleCDN 等扩展的通用做法——以安全性换功能性。本方案只移除 `content-security-policy` 和 `content-security-policy-report-only`（最小范围），不移除 `x-frame-options` 等其他安全头。

```javascript
// CSP 头移除规则（ID 3100-3199）
// 对所有页面响应移除 CSP，允许跨域加载镜像站资源
// 安全权衡：禁用了页面的 CSP 防护，但只移除两个 CSP 头，保留其他安全头
const CSP_REMOVE_RULES = [
  {
    id: 3100,
    priority: 1,
    action: {
      type: 'modifyHeaders',
      responseHeaders: [
        { header: 'content-security-policy', operation: 'remove' },
        { header: 'content-security-policy-report-only', operation: 'remove' },
      ],
    },
    condition: {
      // 不使用 requestDomains：CSP 是页面设置的，需要用 main_frame/sub_frame 匹配文档响应
      resourceTypes: ['main_frame', 'sub_frame'],
    },
  },
]
```

#### 1c. 注册新规则

添加 `updateCSPRemoveRules()` 函数，与现有 `updateCDNRedirectRules()` 模式一致：

- 移除旧规则（`getDynamicRules()` 过滤 ID 3100-3199）
- 添加新规则（`updateDynamicRules({ addRules })`）
- 在 `loadSettings()` 中、`updateCDNRedirectRules()` 之后调用（DNR 规则注册统一在 `loadSettings()` 中进行，不在 `initialize()` 中）

**关键约束**：

- 每条 `CDN_REDIRECT_RULES` 规则必须指定 `resourceTypes`，不能一概用 `['stylesheet', 'font']`
- CSP 移除规则用 `resourceTypes: ['main_frame', 'sub_frame']`，不使用 `requestDomains`（见上方说明）
- 不删除 `background-dnr-rules-auto.js`，它是 JS 重定向的核心逻辑

#### 1a-bis. 更新 `CDN_REDIRECT_DOMAINS`

新增的目标域名（`fonts.loli.net`、`themes.loli.net`、`gravatar.loli.net`、`www.gstatic.cn`、`www.recaptcha.net`）必须加入 `CDN_REDIRECT_DOMAINS`。原因：

1. `CDNRegistry` 从该列表提取域名生成 ID 900-999 的 CDN 白名单（allow 规则）。不在列表中的目标域名不会被白名单保护，可能被用户的屏蔽规则误拦。
2. `CDN_REDIRECT_DOMAINS` 同时作为 `updateCDNRedirectRules()` 中 `excludedRequestDomains` 的值，防止已处于目标域名的请求被重复重定向。

修改方式：在 `CDN_REDIRECT_DOMAINS` 数组末尾追加 5 个新域名。

**静态 vs 动态的选择**：

| 方案                                            | 优点                         | 缺点                         | 适用场景           |
| ----------------------------------------------- | ---------------------------- | ---------------------------- | ------------------ |
| 静态 JSON（`manifest.json` → `rule_resources`） | 零运行时开销，浏览器原生处理 | 无法动态增删规则，更新需发版 | 映射关系固定的规则 |
| 动态注册（`updateDynamicRules()`）              | 可运行时增删，支持远程更新   | 启动时有注册开销             | 需要动态管理的规则 |

本阶段选择**动态注册**（沿用现有 `CDN_REDIRECT_RULES` 模式），原因：

1. 镜像目标域名可能变化（如 `fonts.loli.net` 不可用时需切换）
2. 远程规则同步（阶段 3）需要动态增删能力
3. 与现有 `updateCDNRedirectRules()` 模式一致，维护成本低

**镜像可靠性与降级策略**：

| 目标域名            | 可靠性 | 说明                                 |
| ------------------- | ------ | ------------------------------------ |
| `fonts.loli.net`    | 中等   | 知名 Google Fonts 镜像，有过宕机记录 |
| `themes.loli.net`   | 低     | 不常见，无法确认长期可用性           |
| `gravatar.loli.net` | 低     | 不常见，无法确认长期可用性           |
| `www.gstatic.cn`    | 高     | Google 自有中国 CDN                  |
| `www.recaptcha.net` | 高     | Google 官方 reCAPTCHA 备用域名       |

降级策略：

- **低可靠性镜像**（`themes.loli.net`、`gravatar.loli.net`）：在 `CDN_REDIRECT_RULES` 中预留备用目标（如 `themes.googleusercontent.cn`），由 background 的 `CDNHealthProbe` 反应式标记不可用后，通过 `updateDynamicRules()` 动态切换
- **中等可靠性镜像**（`fonts.loli.net`）：保持现有目标，`markUnhealthy` 触发后用户可在 popup 中手动切换
- **高可靠性镜像**（`www.gstatic.cn`、`www.recaptcha.net`）：无需降级

### 阶段 2：Popup 集成（低风险）

**修改文件**：`popup.html` / `popup.js`

**展示内容**：

- 当前启用的 CDN 映射（开关）
- 各镜像站状态（从 `chrome.storage.local` 读取，数据由 background 的 `CDNHealthProbe.getProbeStats()` 定期写入）
- 切换首选镜像的按钮
- 替换统计

### 阶段 3：远程规则同步（中等风险，需安全评审）

**新建文件**：`shared/rule-sync.js`

**安全约束**：

- 强制 HTTPS（HTTP 直接拒绝）
- 规则签名验证（HMAC-SHA256）
- 拉取频率限制（最少间隔 1 小时）
- 回滚机制：新规则应用前备份旧规则，异常时自动回滚
- 规则白名单：只允许 `redirect`/`block`/`allow` 类型，禁止 `modifyHeaders`（防止远程规则注入恶意头修改）

---

## 四、优先级排序

| 优先级 | 任务                                                                      | 依赖 | 预估工作量       |
| ------ | ------------------------------------------------------------------------- | ---- | ---------------- |
| P0     | 补充 `CDN_REDIRECT_RULES`（5 条新规则 + resourceTypes 改造）              | 无   | 中               |
| P0     | CSP 头移除规则（3100-3199，`resourceTypes: ['main_frame', 'sub_frame']`） | 无   | 小               |
| P1     | Popup 镜像状态展示                                                        | 无   | 中               |
| P2     | 远程规则同步                                                              | P0   | 中（含安全评审） |

---

## 五、从 ReplaceGoogleCDN 移植的规则清单

### 需要补充的（本扩展未覆盖）

| 源域名                         | 目标域名                 | 资源类型 | 说明                  |
| ------------------------------ | ------------------------ | -------- | --------------------- |
| `fonts.gstatic.com`            | `fonts.loli.net/gstatic` | font     | Google Fonts 字体文件 |
| `themes.googleusercontent.com` | `themes.loli.net`        | image    | Google 用户头像       |
| `secure.gravatar.com`          | `gravatar.loli.net`      | image    | Gravatar 头像         |
| `www.gstatic.com`              | `www.gstatic.cn`         | script   | Google 静态资源       |
| `www.google.com/recaptcha`     | `www.recaptcha.net`      | script   | reCAPTCHA（正则重写） |

### 已覆盖的（无需重复）

| 域名                      | 现有覆盖方式                           |
| ------------------------- | -------------------------------------- |
| `ajax.googleapis.com`     | DNR 自动生成规则（ID 4000-4999）       |
| `fonts.googleapis.com`    | DOM 层 FontReplacer（→ fonts.font.im） |
| `cdn.jsdelivr.net`        | DNR 自动生成规则 + DOM 层              |
| `cdnjs.cloudflare.com`    | DNR 自动生成规则 + DOM 层              |
| `maxcdn.bootstrapcdn.com` | DNR 自动生成规则（ID 4000-4999）       |
| `code.jquery.com`         | DNR 自动生成规则（ID 4000-4999）       |

### 不移植的

| 规则                                   | 原因                        |
| -------------------------------------- | --------------------------- |
| `developer.android.com` → `.google.cn` | 不是 CDN 加速，是开发者文档 |
| `developers.google.com` → `.google.cn` | 同上                        |
| `source.android.com` → `.google.cn`    | 同上                        |
| `lh3.googleusercontent.com`            | 镜像不稳定，且主要是图片    |
| `imgur.com`                            | 非 CDN 场景                 |

---

## 六、注意事项

1. **不要删除现有的 block 规则**（`rules.json` 中的 27 条阻止规则），它们是独立功能
2. **不要删除 `background-dnr-rules-auto.js`**，它是 JS 重定向的核心逻辑（435 条规则），与静态规则互补
3. **规则 ID 不能冲突**：CSS/字体重定向用 3000-3099，CSP 移除用 3100-3199，JS 重定向保持 4000-4999，用户屏蔽保持 1000-1999，CDN 白名单保持 900-999
4. **CSP 移除用 `resourceTypes: ['main_frame', 'sub_frame']`**，不使用 `requestDomains`（CSP 是页面设置的，`requestDomains` 匹配不到页面域名；`document` 不是合法的 DNR 资源类型）
5. **不要重新引入主动 CDN 健康探测**——反应式 `markUnhealthy` 已足够（见上方决策依据）
6. **JS 资源不走 DNR 重定向**——这是现有架构的安全设计，JS 走 DOM 层替换，DNR 只处理 CSS/字体
7. **远程规则同步必须有安全约束**——详见阶段 3
8. **DNR 静态规则无法动态降级**——`fonts.loli.net` 等镜像如果不可用，DNR 规则无法自动切换到备选镜像。这是选择动态注册的原因之一；如果未来改为静态规则，需要确保镜像稳定性足够高
9. **CSP 移除是安全性换功能性**——移除页面的 CSP 头会禁用其跨域资源防护，本方案只移除两个 CSP 头（最小范围），但使用方应了解这一权衡
