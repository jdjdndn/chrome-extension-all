# 全链路用户体验优化 - 开发计划

**复杂度等级**：Level 3（复杂）
**创建时间**：2026-05-16
**状态**：进行中

---

## 任务概览

| 批次 | 任务 | 复杂度 | 状态 | Agent ID | 验证者 |
|------|------|--------|------|----------|--------|
| Batch 1 | 1.1 预解析域名匹配 + 并行注入 | L2 | ✅ 完成 | ab8d2598a835171e3 | PASS |
| Batch 1 | 1.2 隐藏元素 CSS 内联注入 | L2 | ✅ 完成 | a33acf43213e06aa2 | PASS |
| Batch 2 | 1.3 ResourceAccelerator 延迟初始化 | L2 | ✅ 完成 | ae22f59bb39548d15 | PASS |
| Batch 3 | 2.1 Content Script 分级注入 | L3 | ✅ 完成 | a313e3e70ca3b5ba3 | PASS |
| Batch 4 | 2.2 Popup 预加载和代码分割 | L2 | ✅ 完成 | a04c8e950f9601f12 | PASS |
| Batch 5 | 3.1 页面优化状态检测器 | L2 | ✅ 完成 | a976e0c4e8811e987 | PASS |
| Batch 6 | 3.2 集成页面优化检测到各模块 | L2 | ✅ 完成 | a39e3b413b1180234 | PASS |

---

## 第一阶段：消除关键路径阻塞

### 任务 1.1：预解析域名匹配 + 并行注入基础脚本

**目标**：在 background.js 中实现预解析域名匹配，减少脚本注入延迟

**验收标准**：
- [ ] 在 `chrome.tabs.onUpdated` 的 `loading` 阶段执行域名匹配
- [ ] 域名匹配结果缓存到内存 Map（key: tabId）
- [ ] `injectAllScriptsForTab` 支持并行注入 core-bundle.js 和 common-bundle.js
- [ ] 添加性能埋点记录注入耗时

**关键文件**：
- `background.js`：重构脚本注入逻辑

**执行模式**：并行启动 Executor v2

---

### 任务 1.2：隐藏元素 CSS 内联注入

**目标**：在 document_start 阶段直接注入隐藏元素样式，消除闪烁

**验收标准**：
- [ ] 在 `content.js` 或 `core-bundle.js` 的立即执行部分注入隐藏元素 CSS
- [ ] 隐藏选择器硬编码到关键路径（不依赖 DOMUtils）
- [ ] 应用时间 <100ms

**关键文件**：
- `content.js`：增加隐藏元素 CSS 内联注入

---

## 第二阶段：页面加载阶段优化

### 任务 1.3：ResourceAccelerator 延迟初始化

**目标**：将 ResourceAccelerator 从关键模块改为空闲模块

**验收标准**：
- [ ] `ResourceAccelerator.init()` 中的配置加载和缓存加载延迟到 `requestIdleCallback`
- [ ] CDN 映射表仍保持立即加载
- [ ] 初始化阻塞时间 <50ms

**关键文件**：
- `content/modules/resource-accelerator.js`：重构初始化流程

---

### 任务 2.1：Content Script 分级注入

**目标**：将 core-bundle.js 拆分为 critical-bundle.js 和懒加载部分

**验收标准**：
- [ ] 创建 `content/entries/critical.js` 入口
- [ ] 修改 `vite.config.js` 增加 critical bundle 配置
- [ ] 修改 `manifest.json` 仅注入 critical bundle
- [ ] LoadScheduler 增加自动触发机制

**关键文件**：
- `content/entries/core.js`：拆分为 critical 入口
- `content/entries/critical.js`：新增 critical 入口
- `vite.config.js`：修改 bundle 配置
- `manifest.json`：修改 content_scripts 配置
- `content/core/load-scheduler.js`：增加自动触发

---

### 任务 2.2：Popup 预加载和代码分割

**目标**：优化 Popup 打开延迟

**验收标准**：
- [ ] 在 `background.js` 中增加 popup 预热逻辑
- [ ] 将 `popup.js` 中的非关键功能拆分为按需加载子模块
- [ ] Popup 打开时间减少 >30%

**关键文件**：
- `background.js`：增加 popup 预热
- `popup.js`：代码分割

---

## 第三阶段：页面优化状态检测

### 任务 3.1：页面优化状态检测器

**目标**：创建 PageOptimizationDetector 模块

**验收标准**：
- [ ] 创建 `content/core/page-optimizer-detector.js`
- [ ] 实现 CDN 检测、懒加载检测、预加载检测、字体优化检测
- [ ] 支持降级策略（检测失败时执行全部优化）
- [ ] 检测准确率 >85%

**关键文件**：
- `content/core/page-optimizer-detector.js`：新增模块

---

### 任务 3.2：集成页面优化检测到各模块

**目标**：在 ResourceAccelerator 中集成页面优化状态检测

**验收标准**：
- [ ] ResourceAccelerator.init() 中集成检测逻辑
- [ ] 各子模块（FontReplacer、CSSAccelerator、JSReplacer、ImageOptimizer）支持 skip 参数
- [ ] 使用空对象模式避免空指针错误
- [ ] 记录跳过的优化统计

**关键文件**：
- `content/modules/resource-accelerator.js`：集成检测逻辑
- `content/modules/font-replacer.js`：支持 skip
- `content/modules/css-accelerator.js`：支持 skip
- `content/modules/js-replacer.js`：支持 skip
- `content/modules/image-optimizer.js`：支持 skip

---

## 验收标准汇总

| 阶段 | 验收标准 | 状态 |
|------|----------|------|
| 第一阶段 | Content Script 首次执行时间减少 >50% | ✅ |
| 第一阶段 | 隐藏元素应用时间 <100ms（无闪烁） | ✅ |
| 第一阶段 | ResourceAccelerator 初始化阻塞时间 <50ms | ✅ |
| 第二阶段 | Popup 打开时间减少 >30% | ✅ |
| 第二阶段 | 消息通信延迟减少 >40% | ⏳ 待测 |
| 第三阶段 | 页面优化检测准确率 >85% | ✅ |

---

## 依赖关系

```
Batch 1 (1.1, 1.2) 可并行执行
    │
    ▼
Batch 2 (1.3) 依赖 Batch 1
    │
    ▼
Batch 3 (2.1) 依赖 Batch 2
    │
    ▼
Batch 4 (2.2) 依赖 Batch 3
    │
    ▼
Batch 5 (3.1) 可独立执行
    │
    ▼
Batch 6 (3.2) 依赖 Batch 5
```

---

## 风险评估

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 拆分 bundle 导致依赖问题 | 高 | 低 | 完善的集成测试 |
| 并行注入导致时序问题 | 中 | 中 | 严格测试+时序验证 |
| 检测逻辑误判 | 高 | 中 | 降级策略+用户手动开关 |
