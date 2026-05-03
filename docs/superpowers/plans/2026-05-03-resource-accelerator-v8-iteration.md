# 资源加速器 v8 迭代计划

> 基线版本：v7（站点配置 + 精准压缩 + 配置导入导出 + 性能基线 + 高级过滤）

---

## 当前状态 (v7)

| 模块 | 状态 | 说明 |
|------|------|------|
| JS库替换 | ✅ | 30+ 库，API 拦截 + CDN 降级链 + jsDelivr 动态查询 |
| CSS框架替换 | ✅ | 14+ CSS 库，独立开关 |
| 字体替换 | ✅ | Google Fonts / FontAwesome 镜像 |
| 图片懒加载 | ✅ | 原生 `loading="lazy"` + `fetchPriority="low"` |
| 图片压缩 | ✅ | Canvas 重绘 WebP/JPEG/AVIF，HEAD 获取实际大小 |
| 站点级配置 | ✅ | 按域名精确/通配符匹配，功能级开关 |
| 高级过滤规则 | ✅ | 5 种匹配类型 + 4 种动作类型 |
| 配置导入导出 | ✅ | JSON 格式，版本号校验 |
| 性能基线对比 | ✅ | 加速前后数据对比 |
| 第三方脚本延迟 | ✅ | 自动检测 + 用户规则 + 三级策略 |
| CDN健康探测 | ✅ | HEAD 探测，5 分钟缓存，RTT 记录 |

### v7 遗留问题

1. **无智能调度** — 图片压缩队列 FIFO，无优先级；MutationObserver 批量大小固定
2. **无资源预加载优先级** — Preload 提示无优先级控制，可能浪费带宽
3. **无 SVG 优化** — SVG 文件未处理，可压缩或内联
4. **无实时日志** — 用户无法查看加速器运行日志，调试困难
5. **无性能图表** — 统计数据只有数字，缺少可视化趋势

---

## 迭代目标

**目标**：智能调度 + 可视化监控 + 格式扩展

**原则**：
- 高 ROI 优先：智能调度 > 实时日志 > 性能图表 > SVG 优化
- 不改变现有核心架构，增量扩展
- 每个迭代独立可交付、可验证
- 向后兼容：所有新功能有合理默认值

---

## 迭代 1: 智能调度系统

**目标**：优化资源处理队列，提升页面加载性能

### 问题分析

当前实现的问题：
- 图片压缩队列 FIFO，大图可能阻塞小图
- MutationObserver 批量大小固定（100 节点），无法适应页面复杂度
- CDN 健康探测无优先级，可能浪费探测资源

### 功能设计

**1. 图片压缩优先级队列**

```javascript
// 优先级：可视区域 > 小图 > 大图
function getCompressPriority(img) {
  const rect = img.getBoundingClientRect();
  const inView = rect.top < window.innerHeight && rect.bottom > 0;
  if (inView) return 0;  // 可视区域最高优先级
  
  const size = img.naturalWidth * img.naturalHeight;
  if (size < 100000) return 1;  // 小图次之
  return 2;  // 大图最低
}

// 替换 state.compressQueue 为优先级队列
state._compressPQueue = [];  // [{ img, src, priority }]
```

**2. 动态批量处理**

```javascript
// 根据页面负载动态调整批量大小
function getBatchSize() {
  const pending = state._mutationBatch.length;
  if (pending > 500) return 200;  // 高负载：大批次
  if (pending > 100) return 100;  // 中负载：中批次
  return 50;  // 低负载：小批次
}

// 动态调整间隔
function getBatchInterval() {
  const pending = state._mutationBatch.length;
  if (pending > 200) return 30;   // 高负载：更快处理
  if (pending > 50) return 50;    // 中负载：正常
  return 100;  // 低负载：节省资源
}
```

**3. CDN 探测优先级**

```javascript
// 根据页面使用的 CDN 优先探测
function getCDNPriorities() {
  const pageCDNs = new Set();
  document.querySelectorAll('script[src], link[href]').forEach(el => {
    const url = el.src || el.href;
    if (isCDNUrl(url)) {
      const cdn = getCDNInfo(url);
      if (cdn) pageCDNs.add(cdn.id);
    }
  });
  return Array.from(pageCDNs);
}
```

### 文件变更

| 文件 | 变更 |
|------|------|
| `content/modules/resource-accelerator.js` | 新增优先级队列、动态批量、探测优先级 |

### 验收标准

- [ ] 图片压缩支持优先级调度
- [ ] 可视区域图片优先处理
- [ ] MutationObserver 批量大小动态调整
- [ ] CDN 探测优先处理页面使用的 CDN
- [ ] 性能提升可测量（LCP 改善）

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 优先级计算增加开销 | 性能下降 | 优先级计算轻量化，缓存结果 |
| 动态调整过于激进 | 页面卡顿 | 设置上下限，平滑过渡 |

---

## 迭代 2: 实时日志系统

**目标**：提供加速器运行日志，便于调试和监控

### 问题分析

当前问题：
- 用户无法查看加速器做了什么
- 出问题时难以定位原因
- 无法验证功能是否正常工作

### 功能设计

**日志结构**

```javascript
{
  timestamp: Date.now(),
  level: 'info' | 'warn' | 'error',
  module: 'script' | 'style' | 'image' | 'cdn' | 'deferral',
  action: 'replace' | 'compress' | 'lazy' | 'defer' | 'skip',
  details: {
    url: string,
    original: string,
    cdn: string,
    reason: string,
    duration: number
  }
}
```

**日志存储**

```javascript
// 内存环形缓冲区（最近 200 条）
state._logBuffer = [];
const MAX_LOG_SIZE = 200;

function addLog(level, module, action, details) {
  state._logBuffer.push({
    timestamp: Date.now(),
    level, module, action, details
  });
  if (state._logBuffer.length > MAX_LOG_SIZE) {
    state._logBuffer.shift();
  }
  // 持久化到 storage（仅 error 级别）
  if (level === 'error') {
    persistErrorLog(...arguments);
  }
}
```

**Popup UI**

```
┌─────────────────────────────────────┐
│  📋 运行日志                        │
│  ──────────────────────────────     │
│  筛选: [全部▼] [模块▼] [级别▼]      │
│                                     │
│  10:30:01 [INFO] script replace    │
│    jquery.min.js → cdn.bootcdn.com  │
│                                     │
│  10:30:02 [INFO] image compress    │
│    photo.jpg (2.1MB → 800KB)       │
│                                     │
│  10:30:03 [WARN] cdn health        │
│    jsdelivr.com 响应慢 (RTT: 2s)   │
│                                     │
│  [导出日志]  [清空日志]              │
└─────────────────────────────────────┘
```

### 文件变更

| 文件 | 变更 |
|------|------|
| `content/modules/resource-accelerator.js` | 新增 `addLog()`、日志缓冲区 |
| `popup.html` | 新增日志面板 UI |
| `popup.js` | 新增日志展示和筛选逻辑 |

### 验收标准

- [ ] 记录所有资源替换操作
- [ ] 记录图片压缩操作
- [ ] 记录 CDN 健康状态
- [ ] 支持按模块/级别筛选
- [ ] 支持导出日志文件
- [ ] 日志不显著影响性能

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 日志过多影响性能 | 内存占用增加 | 环形缓冲区 + 按需持久化 |
| 日志存储占用空间 | storage 超限 | 仅持久化 error 级别 |

---

## 迭代 3: 性能可视化图表

**目标**：将统计数据可视化，直观展示加速效果

### 问题分析

当前问题：
- 统计数据只有数字，缺少直观感受
- 无法看到趋势变化
- 用户难以理解加速效果

### 功能设计

**图表类型**

1. **加速效果对比柱状图**
   - 加速前 vs 加速后
   - 页面加载时间、资源数量、传输体积

2. **替换类型分布饼图**
   - JS / CSS / 字体 / 图片压缩占比

3. **近 7 天趋势折线图**
   - 每日替换数量、节省流量

**实现方案**

```javascript
// 使用 Canvas 绘制简单图表
function drawBarChart(canvas, data) {
  const ctx = canvas.getContext('2d');
  // ... 绘制逻辑
}

// 数据聚合
function aggregateStats(days = 7) {
  // 从 storage 读取历史数据
  // 聚合为每日统计
}
```

**Popup UI**

```
┌─────────────────────────────────────┐
│  📊 性能图表                        │
│  ──────────────────────────────     │
│  [对比图] [分布图] [趋势图]          │
│                                     │
│  ┌─────────────────────────────┐   │
│  │  加速效果对比                 │   │
│  │  ████████ 1.2s (加速前)     │   │
│  │  █████ 0.9s (加速后)        │   │
│  │  节省: 25%                   │   │
│  └─────────────────────────────┘   │
│                                     │
│  [导出报告]                         │
└─────────────────────────────────────┘
```

### 文件变更

| 文件 | 变更 |
|------|------|
| `content/modules/resource-accelerator.js` | 新增数据聚合函数 |
| `popup.html` | 新增图表 Canvas 和切换按钮 |
| `popup.js` | 新增图表绘制逻辑 |

### 验收标准

- [ ] 加速前后对比柱状图
- [ ] 替换类型分布饼图
- [ ] 近 7 天趋势折线图
- [ ] 图表响应式适配
- [ ] 支持导出图表为图片

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| Canvas 绘制性能 | 卡顿 | 离屏渲染 + 按需重绘 |
| 数据量大时聚合慢 | 加载慢 | 预聚合 + 缓存 |

---

## 迭代 4: SVG 优化

**目标**：支持 SVG 文件压缩和内联优化

### 问题分析

当前问题：
- SVG 文件未处理，可能体积较大
- 无法内联小 SVG，减少请求
- 无法优化 SVG 内部结构

### 功能设计

**SVG 处理策略**

```javascript
// SVG 优化选项
{
  svgOptimize: {
    enabled: true,
    maxInlineSize: 10240,  // 10KB 以下内联
    removeComments: true,
    removeMetadata: true,
    minify: true,
  }
}
```

**处理流程**

1. 检测 SVG 请求
2. 获取 SVG 内容
3. 应用优化（移除注释、元数据、压缩）
4. 小 SVG 内联为 data URI
5. 大 SVG 替换为优化版本

**实现方案**

```javascript
async function processSVG(url) {
  if (!isSiteEnabled('svgOptimize')) return;
  
  const filterResult = matchAdvancedFilter(url);
  if (filterResult.matched && filterResult.action === 'skipAll') return;
  
  try {
    const response = await fetch(url);
    const text = await response.text();
    
    // 简单优化：移除注释和元数据
    let optimized = text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<metadata[\s\S]*?<\/metadata>/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    const originalSize = new Blob([text]).size;
    const optimizedSize = new Blob([optimized]).size;
    
    // 小 SVG 内联
    if (optimizedSize < state.config.svgOptimize.maxInlineSize) {
      const dataUri = `data:image/svg+xml,${encodeURIComponent(optimized)}`;
      return { type: 'inline', dataUri };
    }
    
    // 大 SVG 返回优化版本
    if (optimizedSize < originalSize * 0.9) {
      const blobUrl = URL.createObjectURL(new Blob([optimized], { type: 'image/svg+xml' }));
      return { type: 'replace', url: blobUrl };
    }
    
    return null;
  } catch {
    return null;
  }
}
```

### 文件变更

| 文件 | 变更 |
|------|------|
| `content/modules/resource-accelerator.js` | 新增 `processSVG()` |
| `popup.html` | 新增 SVG 优化开关 |

### 验收标准

- [ ] 检测并处理 SVG 请求
- [ ] 移除 SVG 注释和元数据
- [ ] 小 SVG 内联为 data URI
- [ ] 大 SVG 替换为优化版本
- [ ] 优化效果可测量

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| SVG 解析失败 | 功能异常 | try-catch + 降级 |
| 内联 SVG 过大 | 页面膨胀 | 大小限制 |

---

## 迭代 5: 资源预加载优先级控制

**目标**：智能控制 Preload 提示的优先级和数量

### 问题分析

当前问题：
- Preload 提示无优先级，可能浪费带宽
- 最大数量固定（10 个），无法适应页面需求
- 不区分关键资源和非关键资源

### 功能设计

**优先级规则**

```javascript
{
  preloadPriority: {
    enabled: true,
    maxHints: 15,  // 最大提示数
    rules: [
      { type: 'font', priority: 0 },      // 字体最高优先级
      { type: 'css', priority: 1 },       // CSS 次之
      { type: 'js', priority: 2 },        // JS 再次
      { type: 'image', priority: 3 },     // 图片最低
    ],
    // 关键资源自动提升优先级
    criticalPatterns: [
      '/fonts/',
      '/styles/',
      'theme',
      'main',
    ]
  }
}
```

**智能控制**

```javascript
function shouldPreload(url, type) {
  const config = state.config.preloadPriority;
  if (!config.enabled) return true;
  
  // 检查是否超过最大数量
  if (state.stats.preloadHints >= config.maxHints) return false;
  
  // 检查是否为关键资源
  const isCritical = config.criticalPatterns.some(p => url.includes(p));
  if (isCritical) return true;
  
  // 检查当前页面负载
  const load = get_page_load();
  if (load > 0.8) return false;  // 高负载时不新增 preload
  
  return true;
}
```

### 文件变更

| 文件 | 变更 |
|------|------|
| `content/modules/resource-accelerator.js` | 修改 `addPreloadHint()` |

### 验收标准

- [ ] Preload 提示支持优先级
- [ ] 关键资源自动提升优先级
- [ ] 根据页面负载动态调整
- [ ] 最大数量可配置
- [ ] 不浪费带宽

### 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 优先级判断错误 | 关键资源未 preload | 默认保守策略 |
| 页面负载检测不准 | 误判 | 多指标综合判断 |

---

## 实施顺序

```
迭代1: 智能调度 → 迭代2: 实时日志 → 迭代3: 性能图表 → 迭代4: SVG优化 → 迭代5: 预加载优先级
```

**优先级**：迭代 1 > 迭代 2 > 迭代 3 > 迭代 4 > 迭代 5

**理由**：
- 迭代 1（智能调度）ROI 最高：直接提升页面加载性能
- 迭代 2（实时日志）提升可调试性，为后续优化提供数据
- 迭代 3（性能图表）提升用户体验，直观展示加速效果
- 迭代 4（SVG 优化）扩展格式支持
- 迭代 5（预加载优先级）锦上添花，精细化控制

---

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 优先级计算增加开销 | 性能下降 | 轻量化计算 + 缓存结果 |
| 日志过多影响性能 | 内存占用增加 | 环形缓冲区 + 按需持久化 |
| Canvas 绘制性能 | 卡顿 | 离屏渲染 + 按需重绘 |
| SVG 解析失败 | 功能异常 | try-catch + 降级 |
| 优先级判断错误 | 关键资源未 preload | 默认保守策略 |

---

## 文件变更汇总

| 文件 | 迭代1 | 迭代2 | 迭代3 | 迭代4 | 迭代5 |
|------|-------|-------|-------|-------|-------|
| `content/modules/resource-accelerator.js` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `popup.html` | - | ✅ | ✅ | ✅ | - |
| `popup.js` | - | ✅ | ✅ | - | - |

---

## 与 v7 的关系

v7 完成了站点配置、精准压缩、配置导入导出、性能基线、高级过滤。v8 在此基础上：

| v7 基础设施 | v8 扩展 |
|-------------|---------|
| FIFO 压缩队列 | 扩展为优先级队列 |
| 固定批量处理 | 扩展为动态批量 |
| 统计数字展示 | 扩展为可视化图表 |
| 仅处理标准格式 | 扩展为支持 SVG |
| 固定 Preload 数量 | 扩展为智能优先级控制 |

---

## 约束条件

1. **向后兼容** — 所有修改在现有功能基础上增量叠加，不删除已有逻辑
2. **降级可用** — 新功能不可用时回退到现有行为
3. **性能安全** — 新增功能不显著影响页面加载性能
4. **配置安全** — 新增配置有合理默认值
5. **测试覆盖** — 每个迭代需配套测试用例
