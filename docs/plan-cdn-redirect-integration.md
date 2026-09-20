# ReplaceGoogleCDN 优质能力融入计划

> 目标：将 E:\code\ReplaceGoogleCDN\extension 做得好的地方融入 chrome-extension-template，同时补足其缺陷。
> 日期：2025-09-14

---

## 一、ReplaceGoogleCDN 做得好的（要拿过来）

### 1. 静态 JSON 规则（零运行时开销）

ReplaceGoogleCDN 用 `rules_redirect_main.json` 声明式注册规则，浏览器原生处理，不需要 background.js 参与。chrome-extension-template 现在的做法是 `background-dnr-rules-auto.js`（435 条 JS 动态规则），每次启动都要执行 JS 生成规则，有运行时开销且规则不透明。

**要做的**：为 Google 域名创建静态 JSON 规则文件，注册到 `manifest.json` 的 `rule_resources` 中。

### 2. CSP 头移除机制

跨域重定向后，原始站点的 `content-security-policy` 头会阻止加载镜像站资源。ReplaceGoogleCDN 通过 `modifyHeaders` 规则移除这些头，这是必要的。

**要做的**：创建针对性的 CSP 移除规则，但只移除必要的头，不移除全部。

### 3. 多镜像优先级备选模式

`mirrors/` 目录下每个域名有多个镜像候选项，通过 `priority` 字段控制优先级。用户可以在选项页切换首选镜像。

**要做的**：采用类似的优先级机制，但加上健康检查自动降级。

### 4. 正则捕获组重写

对于路径结构不同的 CDN（如 `code.jquery.com` → `fastly.jsdelivr.net/npm/jquery@...`），用 `regexFilter` + `regexSubstitution` 做精确重写，比简单换域名更可靠。

**要做的**：对 jQuery、Bootstrap 等路径不一致的库采用正则重写。

---

## 二、ReplaceGoogleCDN 做得不好的（要补足）

### 1. ❌ 镜像站稳定性无保障

loli.net、baomitu.com 等第三方镜像随时可能挂掉，用户只能手动切换。项目里已标记 4 个 CDN 不可用（极客族、AHDark、BootCDN、静态库）。

**补足方案**：

- 在扩展启动时 + 每 24 小时对镜像站做轻量健康检查（fetch HEAD 请求）
- 健康检查结果存入 `chrome.storage.local`
- 镜像不可用时自动降级到下一个 priority 的候选项
- 在 popup 中显示镜像状态指示灯（绿/黄/红）

### 2. ❌ 仅覆盖 Google 相关域名

只替换了 Google Fonts、jQuery、Bootstrap 等少数几个，不覆盖其他常见慢 CDN。

**补足方案**：

- 保留 chrome-extension-template 现有的 CDN 映射（BootCDN/jsDelivr）
- 补充 ReplaceGoogleCDN 覆盖的 Google 域名
- 合并为统一的规则集，按域名分组管理

### 3. ❌ CSP 移除过于激进

ReplaceGoogleCDN 移除了 16 个安全头，包括 `x-frame-options`、`permissions-policy` 等，降低了整个页面的安全性。

**补足方案**：

- 只移除 `content-security-policy` 和 `content-security-policy-report-only`（这两个是阻止跨域加载的直接原因）
- 其他安全头（`x-frame-options`、`permissions-policy` 等）不动
- 只对被重定向的域名移除，不对所有域名移除

### 4. ❌ 用户配置界面原始

选项页是 JSON 编辑器，用户需要手写规则 JSON，门槛极高。

**补足方案**：

- 利用 chrome-extension-template 现有的 popup UI
- 在 popup 中展示：域名映射表、镜像状态、一键开关
- 高级配置才用 JSON 编辑（保留灵活性）

### 5. ❌ 规则维护靠手动

CDN 域名变更、镜像站失效都需要手动更新扩展版本。

**补足方案**：

- 支持从远程 URL 拉取规则更新（参考 ReplaceGoogleCDN 的 `syncRemoteRules` 思路）
- 规则版本号 + ETag 缓存，避免频繁请求

---

## 三、具体实施步骤

### 阶段 1：静态规则文件（核心，无风险）

**新建文件**：

```
rules/
├── redirect-google-cdn.json       # Google 域名重定向（从 ReplaceGoogleCDN 移植）
├── redirect-jquery-cdn.json       # jQuery CDN 重写（正则方式）
├── redirect-bootstrap-cdn.json    # Bootstrap CDN 重写
├── remove-csp-headers.json        # CSP 头移除（精简版）
└── mirrors/
    ├── ajax.googleapis.com.json    # 多镜像备选
    ├── fonts.googleapis.com.json
    └── ...
```

**修改文件**：

- `manifest.json` → `declarative_net_request.rule_resources` 添加新规则集

**规则 ID 分配**：

| 规则集                 | ID 范围 | 优先级 |
| ---------------------- | ------- | ------ |
| 现有 block 规则        | 1-100   | 1      |
| Google CDN 重定向      | 200-300 | 1      |
| jQuery/Bootstrap 重写  | 300-400 | 1      |
| CSP 头移除             | 500-600 | 1      |
| 动态规则（用户自定义） | 1000+   | 2      |

### 阶段 2：镜像健康检查（中等风险）

**新建文件**：

```
shared/mirror-health.js        # 健康检查逻辑
background-mirror-check.js     # Service Worker 定时检查
```

**逻辑**：

1. 扩展启动时对每个启用的镜像站发 `HEAD` 请求（超时 3 秒）
2. 结果写入 `chrome.storage.local`：`{ mirror: "ajax.loli.net", status: "ok", latency: 120, lastCheck: "2025-09-14T10:00:00Z" }`
3. 不可用时通过 `chrome.declarativeNetRequest.updateDynamicRules()` 切换到备用镜像
4. 每 24 小时重新检查一次（`chrome.alarms`）

### 阶段 3：Popup 集成（低风险）

**修改文件**：

- `popup.html` / `popup.js` → 添加 CDN 加速面板

**展示内容**：

- 当前启用的 CDN 映射（开关）
- 各镜像站状态（绿=正常，黄=延迟高，红=不可用）
- 切换首选镜像的按钮
- 替换统计（今日替换次数、节省时间）

### 阶段 4：远程规则同步（低风险）

**新建文件**：

```
shared/rule-sync.js             # 规则同步逻辑
```

**逻辑**：

1. 从配置的远程 URL 拉取规则 JSON
2. 与本地规则对比（ETag / Last-Modified）
3. 有更新时通过 `chrome.declarativeNetRequest.updateDynamicRules()` 应用
4. 用户可在高级设置中配置同步 URL

---

## 四、优先级排序

| 优先级 | 任务                         | 依赖 | 预估工作量 |
| ------ | ---------------------------- | ---- | ---------- |
| P0     | 静态规则文件 + manifest 注册 | 无   | 小         |
| P0     | 精简版 CSP 移除规则          | 无   | 小         |
| P1     | 镜像健康检查                 | P0   | 中         |
| P1     | Popup 镜像状态展示           | P1   | 中         |
| P2     | 远程规则同步                 | P0   | 中         |
| P2     | 替换统计展示                 | P1   | 小         |

---

## 五、从 ReplaceGoogleCDN 移植的规则清单

### 直接移植（transform.host 方式，路径相同）

| 源域名                         | 目标域名              | 说明            |
| ------------------------------ | --------------------- | --------------- |
| `ajax.googleapis.com`          | `ajax.loli.net`       | 前端公共库      |
| `fonts.googleapis.com`         | `fonts.googleapis.cn` | Google Fonts    |
| `fonts.gstatic.com`            | `fonts.gstatic.cn`    | Fonts 资源      |
| `themes.googleusercontent.com` | `themes.loli.net`     | Fonts 引用      |
| `secure.gravatar.com`          | `gravatar.loli.net`   | Gravatar 头像   |
| `cdn.jsdelivr.net`             | `fastly.jsdelivr.net` | jsDelivr 镜像   |
| `cdnjs.cloudflare.com`         | `cdnjs.loli.net`      | Cloudflare 镜像 |
| `www.gstatic.com`              | `www.gstatic.cn`      | Google 静态资源 |

### 正则重写（路径结构不同）

| 源域名                                           | 目标域名                                                  | 正则               |
| ------------------------------------------------ | --------------------------------------------------------- | ------------------ |
| `code.jquery.com/jquery-{ver}.js`                | `fastly.jsdelivr.net/npm/jquery@{ver}/dist/jquery.min.js` | 捕获版本号重写路径 |
| `maxcdn.bootstrapcdn.com/bootstrap/{ver}/{file}` | `lib.baomitu.com/twitter-bootstrap/{ver}/{file}`          | 捕获版本+文件重写  |
| `www.google.com/recaptcha/api.js`                | `www.recaptcha.net/recaptcha/api.js`                      | 简单域名替换       |

### 不移植的

| 规则                                             | 原因                                                      |
| ------------------------------------------------ | --------------------------------------------------------- | ------------------ |
| `developer.android.com` → `.google.cn`           | 不是 CDN 加速，是开发者文档                               |
| `developers.google.com` → `.google.cn`           | 同上                                                      |
| `source.android.com` → `.google.cn`              | 同上                                                      |
| `lh3.googleusercontent.com`                      | 镜像不稳定，且主要是图片                                  |
| `imgur.com`                                      | 非 CDN 场景                                               |
| --------                                         | ---------                                                 | ------             |
| `code.jquery.com/jquery-{ver}.js`                | `fastly.jsdelivr.net/npm/jquery@{ver}/dist/jquery.min.js` | 捕获版本号重写路径 |
| `maxcdn.bootstrapcdn.com/bootstrap/{ver}/{file}` | `lib.baomitu.com/twitter-bootstrap/{ver}/{file}`          | 捕获版本+文件重写  |
| `www.google.com/recaptcha/api.js`                | `www.recaptcha.net/recaptcha/api.js`                      | 简单域名替换       |

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

1. **不要删除现有的 block 规则**（rules.json 中的 27 条阻止规则），它们是独立功能
2. **不要删除 background-dnr-rules-auto.js**，它是 BootCDN 的 JS 重定向逻辑，与静态规则互补
3. **规则 ID 不能冲突**，静态规则用 200-600，动态规则保持 4000+
4. **CSP 移除用 `resourceTypes: ['document']`**，不使用 `requestDomains`（CSP 是页面设置的，`requestDomains` 匹配不到页面域名）
5. **健康检查要有降级策略**，不能因为检查本身失败就切换镜像（可能是网络问题）
