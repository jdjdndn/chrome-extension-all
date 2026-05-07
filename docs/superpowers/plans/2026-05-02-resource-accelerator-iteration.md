# 资源加速器迭代计划

> 基线版本：v6（第三方脚本延迟 + 性能度量 + AVIF 压缩 + 字体预加载优化）

---

## 当前状态 (v6)

| 模块                  | 状态 | 说明                                               |
| --------------------- | ---- | -------------------------------------------------- |
| JS库替换              | ✅   | 30+ 库，API 拦截 + CDN 降级链 + jsDelivr 动态查询  |
| CSS框架替换           | ✅   | 14+ CSS 库，独立开关                               |
| 字体替换              | ✅   | Google Fonts / FontAwesome 镜像                    |
| 图片懒加载            | ✅   | 原生 `loading="lazy"` + `fetchPriority="low"`      |
| 图片压缩              | ✅   | Canvas 重绘 WebP/JPEG，2048px 缩放，队列控制       |
| AVIF 支持             | ✅   | 浏览器支持时优先使用 AVIF 格式                     |
| CDN健康探测           | ✅   | HEAD 探测，5 分钟缓存，RTT 记录，降级链集成        |
| CDN Preconnect        | ✅   | 优先 preconnect，其余 dns-prefetch                 |
| API 拦截              | ✅   | 拦截 createElement / appendChild / insertBefore    |
| MutationObserver 兜底 | ✅   | 50ms 批量，每次 100 节点                           |
| 统计持久化            | ✅   | 防抖 + 增量写入 chrome.storage.local               |
| 替换详情记录          | ✅   | 最近 50 条，含类型/库名/CDN/时间                   |
| 资源去重              | ✅   | 页面内 Set 去重                                    |
| 压缩结果缓存          | ✅   | 页面内 Map 缓存压缩决策                            |
| 第三方脚本延迟        | ✅   | 自动检测 + 用户规则 + 三级策略（idle/defer/block） |
| 性能度量              | ✅   | Navigation Timing + 资源统计 + 预估节省时间        |
| 字体预加载优化        | ✅   | 按字重优先级，最多 3 个                            |

### v6 遗留问题

1. **无站点级配置** — 用户无法按域名单独启用/禁用加速器或特定功能
2. **图片大小判断仍用像素估算** — `compressImage()` 用 `naturalWidth × naturalHeight × 4` 估算，未用 fetch HEAD 获取实际文件大小
3. **无性能基线对比** — 缺少加速前后的加载时间对比数据
4. **无批量导入/导出配置** — 用户无法备份或迁移配置
5. **无黑白名单模式** — 只支持排除域名，不支持仅在指定域名启用

---

## 迭代目标

**目标**：增强用户可控性 + 提升压缩准确性 + 配置可移植性

**原则**：

- 高 ROI 优先：站点配置 > 精准压缩 > 配置导入导出
- 不改变现有核心拦截架构，增量扩展
- 每个迭代独立可交付、可验证
- 向后兼容：所有新功能有合理默认值

---

## 迭代 1: 站点级配置

**目标**：支持按域名配置加速器行为

### 问题分析

当前加速器是全局生效的，但某些站点可能：

- 自身已有 CDN 加速，不需要替换
- 有特殊 CSP 限制，替换会导致功能异常
- 图片压缩不适用（如图片编辑网站）
- 需要单独控制某些功能（如仅启用字体替换）

### 功能设计

**数据结构**：

```javascript
{
  siteConfig: {
    enabled: true,  // 全局开关
    rules: [
      {
        domain: 'example.com',
        enabled: false,  // 该站点禁用所有功能
      },
      {
        domain: '*.github.io',
        enabled: true,
        jsReplace: false,  // 仅禁用 JS 替换
        imageCompress: true,
      },
      {
        domain: 'cdn.example.com',
        enabled: true,
        jsReplace: true,
        fontReplace: false,
        cssReplace: true,
        imageLazyLoad: false,  // 图片编辑站不懒加载
        imageCompress: false,  // 图片编辑站不压缩
      }
    ]
  }
}
```

**配置优先级**：

1. 站点规则中明确指定的功能开关 → 最高优先级
2. 站点规则的 `enabled` 字段 → 控制该站点是否启用
3. 全局配置 → 默认行为

**匹配逻辑**：

```javascript
function getSiteConfig(hostname) {
  const rules = state.config.siteConfig?.rules || []

  // 精确匹配优先
  const exact = rules.find((r) => r.domain === hostname)
  if (exact) return exact

  // 通配符匹配 (*.domain.com)
  const wildcard = rules.find((r) => {
    if (!r.domain.startsWith('*')) return false
    const suffix = r.domain.slice(1)
    return hostname.endsWith(suffix)
  })

  return wildcard || null
}

function isSiteEnabled(feature) {
  const site = getSiteConfig(location.hostname)

  // 站点级别完全禁用
  if (site && site.enabled === false) return false

  // 站点级别功能开关
  if (site && feature in site) return site[feature]

  // 回退到全局配置
  return state.config[feature]
}
```

**调用点**：

```javascript
// processScript 开头
function processScript(script) {
  if (!isSiteEnabled('jsReplace')) return
  // ... 现有逻辑 ...
}

// processLink 开头
function processLink(link) {
  if (!isSiteEnabled('fontReplace') && !isSiteEnabled('cssReplace')) return
  // ... 现有逻辑 ...
}

// processImage 开头
function processImage(img) {
  if (!isSiteEnabled('imageLazyLoad')) return
  // ... 现有逻辑 ...
}

// compressImage 开头
function compressImage(url) {
  if (!isSiteEnabled('imageCompress')) return null
  // ... 现有逻辑 ...
}
```

### 文件变更

| 文件                                      | 变更                                                          |
| ----------------------------------------- | ------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `getSiteConfig()`、`isSiteEnabled()`，各处理函数开头调用 |
| `popup.html`                              | 新增站点配置管理 UI                                           |
| `popup.js`                                | 新增站点配置 CRUD 逻辑                                        |

### 配置项

```javascript
{
  siteConfig: {
    enabled: true,
    rules: []
  }
}
```

### 验收标准

- [ ] 按域名精确匹配配置
- [ ] 支持通配符 `*.domain.com`
- [ ] 站点配置优先于全局配置
- [ ] popup 可添加/编辑/删除站点规则
- [ ] 当前站点在 popup 中高亮显示其配置状态
- [ ] 禁用站点时，该站点所有功能不执行
- [ ] 功能级开关正确覆盖全局配置

### 风险

| 风险                     | 影响                   | 缓解                                     |
| ------------------------ | ---------------------- | ---------------------------------------- |
| 规则过多导致匹配性能下降 | 规则匹配耗时增加       | 规则数量限制（最多 50 条）+ 精确匹配优先 |
| 用户配置错误导致功能异常 | 某些站点功能被意外禁用 | 提供重置按钮 + 默认值恢复                |
| 通配符匹配过于宽泛       | 意外匹配到不相关站点   | 提示用户确认通配符规则                   |

---

## 迭代 2: 精准图片压缩

**目标**：使用 fetch HEAD 获取实际文件大小，替代像素估算

### 问题分析

当前图片压缩使用 `naturalWidth × naturalHeight × 4` 估算文件大小，但：

- PNG 无损格式实际体积可能远大于估算
- 已压缩的 JPEG 实际体积可能小于估算
- 导致部分小体积图片被误压缩，或大体积图片被跳过

### 功能设计

**实现方案**：

```javascript
async function getImageActualSize(url) {
  try {
    const response = await fetch(url, { method: 'HEAD', mode: 'no-cors' })
    const contentLength = response.headers.get('content-length')
    if (contentLength) {
      return parseInt(contentLength, 10)
    }
  } catch {
    // CORS 限制或其他错误，降级到估算
  }
  return null
}

async function compressImage(url) {
  // ... 缓存检查 ...

  // 优先获取实际大小
  const actualSize = await getImageActualSize(url)
  const bytes = actualSize || img.naturalWidth * img.naturalHeight * 4

  if (bytes < state.config.imageMinSize) {
    state._compressCache.set(url, { skip: true })
    resolve(null)
    return
  }

  // ... 后续压缩逻辑 ...
}
```

**优化策略**：

- HEAD 请求缓存结果 30 秒，避免重复请求
- CORS 限制时降级到像素估算
- 并发限制：最多 5 个并发 HEAD 请求

### 文件变更

| 文件                                      | 变更                                                |
| ----------------------------------------- | --------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `getImageActualSize()`，修改 `compressImage()` |

### 验收标准

- [ ] 支持 CORS 的站点使用实际文件大小判断
- [ ] 不支持 CORS 的站点降级到像素估算
- [ ] HEAD 请求结果缓存 30 秒
- [ ] 并发 HEAD 请求不超过 5 个
- [ ] 压缩决策更准确，减少误判

### 风险

| 风险                  | 影响             | 缓解                               |
| --------------------- | ---------------- | ---------------------------------- |
| HEAD 请求增加网络开销 | 额外请求消耗带宽 | 缓存 + 并发限制 + 仅对潜在大图请求 |
| CORS 限制导致失败     | 无法获取实际大小 | 降级到像素估算                     |
| HEAD 请求延迟         | 压缩决策延迟     | 设置超时（3 秒）+ 降级             |

---

## 迭代 3: 配置导入导出

**目标**：支持配置备份和跨设备迁移

### 问题分析

用户配置（站点规则、第三方延迟规则、排除域名等）无法导出，导致：

- 换设备时需要重新配置
- 无法分享配置给其他用户
- 无法备份配置防止丢失

### 功能设计

**导出格式**：

```json
{
  "version": "1.0",
  "exportTime": "2026-05-02T10:00:00Z",
  "config": {
    "enabled": true,
    "jsReplace": true,
    "fontReplace": true,
    "cssReplace": true,
    "imageLazyLoad": true,
    "imageCompress": true,
    "excludeDomains": [],
    "siteConfig": { ... },
    "thirdPartyDeferral": { ... }
  }
}
```

**导入逻辑**：

1. 读取 JSON 文件
2. 验证版本号和结构
3. 合并到现有配置（用户选择覆盖或合并）
4. 保存到 chrome.storage.local

**Popup UI**：

```
┌─────────────────────────────────────┐
│  配置管理                           │
│  ──────────────────────────────     │
│  [导出配置]  [导入配置]  [重置默认]  │
│                                     │
│  最后导出: 2026-05-02 10:00         │
└─────────────────────────────────────┘
```

### 文件变更

| 文件                                      | 变更                                    |
| ----------------------------------------- | --------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `exportConfig()`、`importConfig()` |
| `popup.html`                              | 新增配置管理按钮区域                    |
| `popup.js`                                | 新增导入导出逻辑                        |

### 验收标准

- [ ] 导出配置为 JSON 文件
- [ ] 导入配置时验证格式和版本
- [ ] 导入时可选择覆盖或合并
- [ ] 重置为默认配置功能
- [ ] 导出文件包含时间戳和版本号

### 风险

| 风险             | 影响               | 缓解                    |
| ---------------- | ------------------ | ----------------------- |
| 导入配置格式错误 | 导入失败或配置损坏 | 严格验证 + 错误提示     |
| 配置版本不兼容   | 导入旧版配置失败   | 版本号检查 + 兼容性处理 |
| 导入恶意配置     | 安全风险           | 仅导入 JSON + 验证结构  |

---

## 迭代 4: 性能基线对比

**目标**：记录加速前后的性能数据，提供直观对比

### 问题分析

当前性能度量只显示当前页面的数据，无法对比加速前后的效果。用户无法直观看到加速器的价值。

### 功能设计

**数据采集**：

```javascript
{
  performanceBaseline: {
    // 加速器关闭时的基线数据
    before: {
      ttfb: 150,
      domContentLoaded: 800,
      loadEvent: 1200,
      totalResources: 45,
      totalTransferSize: 3200000,
    },
    // 加速器开启时的数据
    after: {
      ttfb: 120,
      domContentLoaded: 600,
      loadEvent: 900,
      totalResources: 38,  // 替换了 7 个
      totalTransferSize: 2100000,
    }
  }
}
```

**对比展示**：

```
┌─────────────────────────────────────┐
│  ⚡ 加速效果对比                     │
│  ──────────────────────────────     │
│  指标          加速前    加速后      │
│  页面加载      1.2s      0.9s       │
│  资源请求      45 个     38 个       │
│  传输体积      3.2 MB    2.1 MB     │
│  ──────────────────────────────     │
│  节省时间: ~300ms (25%)            │
│  节省流量: 1.1 MB (34%)            │
└─────────────────────────────────────┘
```

**实现方案**：

```javascript
// 保存基线数据（加速器关闭时）
function savePerformanceBaseline() {
  const metrics = collectPerformanceMetrics()
  chrome.storage.local.set({ performanceBaseline: metrics })
}

// 对比当前数据与基线
function getPerformanceComparison() {
  const baseline = chrome.storage.local.get('performanceBaseline')
  const current = state.performance

  if (!baseline || !current) return null

  return {
    loadTime: {
      before: baseline.loadEvent,
      after: current.loadEvent,
      saved: baseline.loadEvent - current.loadEvent,
      percent: Math.round(((baseline.loadEvent - current.loadEvent) / baseline.loadEvent) * 100),
    },
    transferSize: {
      before: baseline.totalTransferSize,
      after: current.totalTransferSize || estimateTransferSize(),
      saved: baseline.totalTransferSize - (current.totalTransferSize || estimateTransferSize()),
      percent: Math.round(
        ((baseline.totalTransferSize - (current.totalTransferSize || estimateTransferSize())) /
          baseline.totalTransferSize) *
          100
      ),
    },
    resources: {
      before: baseline.totalResources,
      after: current.totalResources,
      replaced: baseline.totalResources - current.totalResources,
    },
  }
}
```

### 文件变更

| 文件                                      | 变更                                                           |
| ----------------------------------------- | -------------------------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `savePerformanceBaseline()`、`getPerformanceComparison()` |
| `popup.html`                              | 新增性能对比展示区域                                           |
| `popup.js`                                | 新增性能对比逻辑                                               |

### 验收标准

- [ ] 首次使用时保存基线数据
- [ ] 对比当前数据与基线
- [ ] popup 显示加速前后对比
- [ ] 计算节省时间和流量百分比
- [ ] 支持重置基线数据

### 风险

| 风险           | 影响           | 缓解                               |
| -------------- | -------------- | ---------------------------------- |
| 基线数据不准确 | 对比结果失真   | 多次采集取平均 + 用户可手动重置    |
| 首次使用无基线 | 无法对比       | 首次使用提示用户关闭加速器采集基线 |
| 性能数据波动   | 对比结果不稳定 | 采集多次取中位数                   |

---

## 迭代 5: 高级过滤规则

**目标**：支持更灵活的 URL 过滤规则

### 问题分析

当前排除功能只支持域名和 URL 模式匹配，无法满足：

- 按文件类型过滤（如不压缩 PNG）
- 按 URL 路径过滤（如不处理 /api/ 路径）
- 按请求方法过滤（如不处理 POST 请求）

### 功能设计

**规则结构**：

```javascript
{
  advancedFilter: {
    enabled: false,
    rules: [
      {
        type: 'exclude',
        match: 'extension',
        value: 'png',
        action: 'skipCompress',
        description: '不压缩 PNG 图片'
      },
      {
        type: 'exclude',
        match: 'path',
        value: '/api/',
        action: 'skipAll',
        description: '跳过 API 请求'
      },
      {
        type: 'include',
        match: 'domain',
        value: 'cdn.example.com',
        action: 'forceReplace',
        description: '强制替换该 CDN'
      }
    ]
  }
}
```

**匹配类型**：

- `extension`：文件扩展名
- `path`：URL 路径
- `domain`：域名
- `query`：查询参数
- `regex`：正则表达式

**动作类型**：

- `skipAll`：跳过所有处理
- `skipCompress`：跳过压缩
- `skipReplace`：跳过替换
- `forceReplace`：强制替换（忽略 CDN 检测）

### 文件变更

| 文件                                      | 变更                                         |
| ----------------------------------------- | -------------------------------------------- |
| `content/modules/resource-accelerator.js` | 新增 `matchAdvancedFilter()`，各处理函数调用 |
| `popup.html`                              | 新增高级过滤规则管理 UI                      |
| `popup.js`                                | 新增规则 CRUD 逻辑                           |

### 验收标准

- [ ] 支持多种匹配类型
- [ ] 支持多种动作类型
- [ ] 规则按顺序匹配，先匹配先执行
- [ ] popup 可管理规则列表
- [ ] 规则有描述字段便于理解

### 风险

| 风险         | 影响               | 缓解                        |
| ------------ | ------------------ | --------------------------- |
| 规则过于复杂 | 用户难以理解和配置 | 提供预设模板 + 清晰的描述   |
| 规则冲突     | 行为不确定         | 明确的优先级规则 + 文档说明 |
| 性能影响     | 规则匹配耗时       | 规则数量限制 + 简单规则优先 |

---

## 实施顺序

```
迭代1: 站点配置 → 迭代2: 精准压缩 → 迭代3: 配置导入导出 → 迭代4: 性能基线 → 迭代5: 高级过滤
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3 > 迭代 4 > 迭代 5

**理由**：

- 迭代 1（站点配置）ROI 最高：解决用户可控性问题，是长期使用的基础设施
- 迭代 2（精准压缩）提升压缩准确性，减少误判
- 迭代 3（配置导入导出）提升用户体验，支持配置迁移
- 迭代 4（性能基线）让用户看到加速效果，提升使用粘性
- 迭代 5（高级过滤）锦上添花，满足高级用户需求

---

## 风险评估

| 风险                         | 影响               | 缓解措施                                 |
| ---------------------------- | ------------------ | ---------------------------------------- |
| 站点配置规则过多导致性能问题 | 规则匹配耗时       | 规则数量限制（50 条）+ 精确匹配优先      |
| HEAD 请求增加网络开销        | 额外请求消耗带宽   | 缓存 + 并发限制 + 仅对潜在大图请求       |
| 导入配置格式错误             | 导入失败或配置损坏 | 严格验证 + 错误提示 + 版本号检查         |
| 基线数据不准确               | 对比结果失真       | 多次采集取平均 + 用户可手动重置          |
| 高级规则过于复杂             | 用户难以理解和配置 | 提供预设模板 + 清晰的描述 + 规则数量限制 |

---

## 文件变更汇总

| 文件                                      | 迭代1 | 迭代2 | 迭代3 | 迭代4 | 迭代5 |
| ----------------------------------------- | ----- | ----- | ----- | ----- | ----- |
| `content/modules/resource-accelerator.js` | ✅    | ✅    | ✅    | ✅    | ✅    |
| `popup.html`                              | ✅    | -     | ✅    | ✅    | ✅    |
| `popup.js`                                | ✅    | -     | ✅    | ✅    | ✅    |

---

## 与 v6 的关系

v6 完成了第三方脚本延迟、性能度量、AVIF 压缩、字体预加载优化。v7 在此基础上：

| v6 基础设施                | v7 扩展                  |
| -------------------------- | ------------------------ |
| 全局配置 `DEFAULT_CONFIG`  | 扩展为支持站点级配置覆盖 |
| `compressImage()` 像素估算 | 扩展为 HEAD 获取实际大小 |
| `state.stats` 统计收集     | 扩展为性能基线对比       |
| 排除域名/URL               | 扩展为高级过滤规则       |
| 配置存储在 chrome.storage  | 扩展为支持导入导出       |

---

## 约束条件

1. **向后兼容** — 所有修改在现有功能基础上增量叠加，不删除已有逻辑
2. **降级可用** — 新功能不可用时回退到现有行为
3. **性能安全** — 新增功能不显著影响页面加载性能
4. **配置安全** — 导入配置需验证格式，防止恶意配置
5. **测试覆盖** — 每个迭代需配套测试用例
