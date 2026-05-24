# 资源加速器功能完善计划 v2

> Status: **planning**
> Created: 2026-05-24
> Last Updated: 2026-05-24
> Review: 已通过代码审查，修复v1版本问题

## Objective

完善资源加速器功能，解决火焰图分析发现的性能瓶颈，提升用户体验和系统稳定性。

---

## 背景

### 已完成功能（v1-v21）

| 功能                               | 状态       | 位置                                    | 验证              |
| ---------------------------------- | ---------- | --------------------------------------- | ----------------- |
| ✅ 位置感知加载                    | 已实现     | resource-accelerator.js:1627-1673       | 代码审查确认      |
| ✅ Worker预热机制                  | 已实现     | resource-accelerator.js:3486-3493       | 代码审查确认      |
| ✅ Worker任务优先级队列            | 已实现     | resource-accelerator.js:3410, 3535-3572 | 代码审查确认      |
| ✅ 内存压力监控                    | 已实现     | resource-accelerator.js:3051-3294       | 代码审查确认      |
| ✅ 缓存淘汰策略改进                | 已实现     | resource-accelerator.js:527-575         | 代码审查确认      |
| ✅ 插件化架构框架                  | 已实现     | content/core/ResourceAcceleratorCore.js | 代码审查确认      |
| ✅ 页面优化检测��                  | 已实现     | content/core/page-optimizer-detector.js | 代码审查确认      |
| ✅ Worker健康检查                  | 已实现     | image-optimizer.js:22-62                | 代码审查确认      |
| ✅ **缓存淘汰requestIdleCallback** | **已实现** | resource-accelerator.js:1371-1378       | ⚠️ v1计划遗漏     |
| ✅ **主线程压缩回退移除**          | **已实现** | image-optimizer.js:1072-1074            | ⚠️ 需验证调用路径 |

### 火焰图分析发现的问题（已更新）

| 优先级 | 问题                         | 影响     | 位置                                  | 状态        |
| ------ | ---------------------------- | -------- | ------------------------------------- | ----------- |
| P0     | ~~主线程压缩回退~~           | ~~极高~~ | ~~image-optimizer.js:1077-1128~~      | ✅ 已实现   |
| P0     | ~~缓存淘汰同步计算~~         | ~~高~~   | ~~resource-accelerator.js:1296-1378~~ | ✅ 已实现   |
| P0     | MutationObserver无节流(降级) | 高       | image-optimizer.js:834-887            | 🔴 待实现   |
| P1     | 图片HEAD请求串行             | 中       | image-optimizer.js:1027-1038          | 🔴 待实现   |
| P1     | 缓存应用setTimeout(0)        | 中       | resource-accelerator.js:1682          | 🔴 待实现   |
| P1     | 缓存存储双key写入            | 中       | resource-accelerator.js:1571-1573     | 🔴 待实现   |
| P1     | URL解析无缓存                | 中       | resource-accelerator.js:1383-1394     | 🔴 待实现   |
| P2     | IntersectionObserver无优先级 | 低       | image-optimizer.js:743-788            | 🟡 低优先级 |
| P2     | 性能指标同步记录             | 低       | resource-accelerator.js:700-726       | 🟡 低优先级 |
| P2     | 视频懒加载重复扫描           | 低       | image-optimizer.js:1366-1372          | 🟡 低优先级 |

---

## Tasks

### Phase 0: 基准测试（新增）⭐

**目标**：建立性能基准，确保优化效果可验证

- [ ] Task 0.1 — 性能基准采集
  - 测试网站：Pinterest、Unsplash、GitHub搜索页
  - 指标：LCP、INP、CLS、FCP、TTI、主线程阻塞时间
  - 工具：Chrome DevTools Performance、Lighthouse
  - 输出：baseline-metrics.json
  - Depends on: nothing
  - Risk: 低

- [ ] Task 0.2 — 验证标准定义
  - LCP改善 > 50ms 视为有效
  - INP改善 > 50ms 视为有效
  - 主线程阻塞减少 > 50% 视为有效
  - 输出：validation-criteria.md
  - Depends on: Task 0.1
  - Risk: 低

### Phase 1: P0 性能瓶颈修复

- [x] Task 1.1 — 移除主线程压缩回退 ✅
  - 状态: **已实现**
  - 位置: image-optimizer.js:1072-1074
  - 验证: `grep "Worker不可用，使用原图" image-optimizer.js`
  - Completed: 2026-05-24（代码审查确认）

- [ ] Task 1.1.1 — 验证所有调用路径（新增）
  - 检查 `_compressOnMainThread` 是否被其他路径调用
  - 确认无遗漏的主线程压缩调用
  - 验证方法: Grep搜索 `_compressOnMainThread`
  - Depends on: nothing
  - Risk: 低

- [x] Task 1.2 — 缓存淘汰移至空闲时 ✅
  - 状态: **已实现**
  - 位置: resource-accelerator.js:1371-1378
  - 验证: `grep "requestIdleCallback(performEviction" resource-accelerator.js`
  - Completed: 2026-05-24（代码审查确认）

- [ ] Task 1.3 — MutationObserver节流优化
  - 位置: image-optimizer.js:834-887
  - 方案: 限制单批处理节点数上限(100)
  - 预期收益: INP改善-30ms
  - 验证方法: 添加节点计数日志，确认限制生效
  - Depends on: nothing
  - Risk: 中（可能影响降级模式功能）

### Phase 1.5: 风险缓解（新增）⭐

**目标**：降低迁移风险，确保可回滚

- [ ] Task 1.5.1 — 缓存迁移回滚机制
  - 实现双格式兼容读取
  - 迁移失败时回退旧格式
  - 监控迁移成功率
  - Depends on: nothing
  - Risk: 高（数据丢失风险）

- [ ] Task 1.5.2 — Worker大小检测保留
  - 移除HEAD请求后保留Worker内部大小检测
  - 添加"压缩收益"监控
  - 设置动态阈值（根据网络速度调整）
  - Depends on: Phase 1
  - Risk: 中（可能增加Worker负载）

### Phase 2: P1 性能优化

- [ ] Task 2.1 — 图片HEAD请求优化
  - 位置: image-optimizer.js:1027-1038
  - 方案: 移除HEAD请求，改用响应头判断或批量并行检测
  - 预期收益: LCP改善-100ms
  - 风险: 高（二阶效应：无法预判图片大小，可能压缩不需要压缩的小图片）
  - 缓解: Task 1.5.2
  - Depends on: Task 1.5.2
  - Risk: 高

- [ ] Task 2.2 — 缓存应用改用requestIdleCallback
  - 位置: resource-accelerator.js:1682
  - 方案: setTimeout(0)改为requestIdleCallback
  - 预期收益: INP改善-10ms
  - 验证方法: 检查调用栈确认使用requestIdleCallback
  - Depends on: nothing
  - Risk: 低

- [ ] Task 2.3 — 缓存存储优化（含迁移）
  - 位置: resource-accelerator.js:1571-1573
  - 方案: 单key + Map映射替代双key写入
  - 预期收益: 减少存储IO
  - 迁移策略: 双格式兼容读取（Task 1.5.1）
  - Depends on: Task 1.5.1
  - Risk: 高（数据迁移风险）

- [ ] Task 2.4 — URL解析缓存
  - 位置: resource-accelerator.js:1383-1394
  - 方案: LRU缓存URL解析结果
  - 预期收益: 减少重复解析
  - 验证方法: 添加缓存命中率统计
  - Depends on: nothing
  - Risk: 低

### Phase 3: P2 功能完善

- [ ] Task 3.1 — IntersectionObserver优先级分离
  - 位置: image-optimizer.js:743-788
  - 方案: 分离首屏/非首屏Observer
  - 预期收益: 首屏加载优化
  - Depends on: Phase 1, Phase 2
  - Risk: 中

- [ ] Task 3.2 — 性能指标采样模式
  - 位置: resource-accelerator.js:700-726
  - 方案: 采样模式或开发环境启用
  - 预期收益: 减少生产环境开销
  - Depends on: nothing
  - Risk: 低

- [ ] Task 3.3 — 视频懒加载增量观察
  - 位置: image-optimizer.js:1366-1372
  - 方案: 增量观察替代重复扫描
  - 预期收益: 减少DOM遍历
  - Depends on: nothing
  - Risk: 低

### Phase 4: 功能增强

- [ ] Task 4.1 — CDN健康度检测完善
  - 当前状态: 已有markUnhealthy机制
  - 需完善: 错误统计、自动降级策略
  - Depends on: Phase 1
  - Risk: 中

- [ ] Task 4.2 — 资源预加载策略优化
  - 当前状态: 已有基础预加载
  - 需完善: 基于用户行为的智能预加载
  - Depends on: Phase 1, Phase 2
  - Risk: 高

- [ ] Task 4.3 — 缓存预热机制完善
  - 当前状态: 已有配置，未完全实现
  - 需完善: 高频CDN资源预热逻辑
  - Depends on: Phase 1
  - Risk: 中

### Phase 4.5: 监控完善（新增）⭐

**目标**：建立监控指标体系，确保优化效果可观测

- [ ] Task 4.5.1 — 监控指标体系
  - 性能指标：LCP、INP、CLS、FCP、TTI
  - 功能指标：缓存命中率、Worker成功率、压缩成功率
  - 错误指标：Worker崩溃率、压缩失败率、CDN失败率
  - 输出：metrics-dashboard-config.json
  - Depends on: nothing
  - Risk: 低

- [ ] Task 4.5.2 — 监控告警
  - Worker崩溃率 > 5% 告警
  - 缓存命中率 < 50% 告警
  - 性能退化 > 20% 告警
  - 输出：alert-rules.json
  - Depends on: Task 4.5.1
  - Risk: 低

### Phase 5: 验证与文档

- [ ] Task 5.1 — 性能验证
  - 在图片密集型网站采集火焰图
  - 对比优化前后的Core Web Vitals
  - 验证预期收益达成（基于Task 0.2标准）
  - Depends on: Phase 1-4, Task 0.2
  - Risk: 中

- [ ] Task 5.2 — 单元测试补充
  - P0/P1优化的单元测试
  - 边界条件覆盖
  - Depends on: Phase 1-4
  - Risk: 中

- [ ] Task 5.3 — 文档更新
  - 更新实施完成报告
  - 更新架构图
  - 更新性能优化指南
  - Depends on: Task 5.1
  - Risk: 低

### Phase 5.5: 测试完善（新增）⭐

**目标**：确保质量和稳定性

- [ ] Task 5.5.1 — 性能基准测试
  - 建立自动化性能对比脚本
  - 定义测试场景（图片密集型网站）
  - 输出：performance-baseline.json
  - Depends on: Phase 1-4
  - Risk: 中

- [ ] Task 5.5.2 — 回归测试
  - 覆盖P0/P1修改的回归测试
  - 边界条件测试
  - 错误路径测试
  - 输出：regression-test-suite.md
  - Depends on: Phase 1-4
  - Risk: 中

- [ ] Task 5.5.3 — 兼容性测试
  - Chrome/Edge/Firefox测试
  - 不同网络条件测试（3G/4G/WiFi）
  - 不同设备测试（桌面/移动）
  - 输出：compatibility-matrix.md
  - Depends on: Phase 1-4
  - Risk: 高

---

## Architecture Decisions

| Decision       | Options Considered                            | Chosen                  | Rationale                      | Risk |
| -------------- | --------------------------------------------- | ----------------------- | ------------------------------ | ---- |
| 主线程压缩回退 | 1.保留回退 2.直接用原图 3.降级提示            | 直接用原图              | 避免UI阻塞，用户体验优先       | 低   |
| 缓存淘汰时机   | 1.同步执行 2.setTimeout 3.requestIdleCallback | requestIdleCallback     | 不阻塞用户交互                 | 低   |
| HEAD请求策略   | 1.保留串行 2.批量并行 3.移除HEAD              | 移除HEAD + Worker内检测 | 消除网络延迟阻塞，保留大小判断 | 中   |
| 缓存策略       | 1.双key 2.单key+Map 3.仅内存                  | 单key+Map（含迁移）     | 减少IO，保持持久化             | 高   |
| 性能监控       | 1.全量记录 2.采样模式 3.开发环境              | 采样模式                | 减少生产环境开销               | 低   |
| Worker池大小   | 1.固定2个 2.动态调整 3.用户配置               | 固定2个（暂不调整）     | 降低复杂度，后续迭代优化       | 中   |

---

## Risk Assessment（新增）⭐

### 高风险任务

| Task                    | 风险                           | 缓解措施                | 回滚方案                   |
| ----------------------- | ------------------------------ | ----------------------- | -------------------------- |
| Task 2.1 (HEAD请求优化) | 无法预判图片大小，可能浪费带宽 | Task 1.5.2 Worker内检测 | 保留HEAD请求代码，配置开关 |
| Task 2.3 (缓存迁移)     | 数据丢失，用户需重新预热       | Task 1.5.1 双格式兼容   | 迁移失败自动回退旧格式     |
| Task 4.2 (智能预加载)   | 可能预加载错误资源             | A/B测试，监控指标       | 配置开关，快速关闭         |
| Task 5.5.3 (兼容性测试) | 测试覆盖不全                   | 优先主流浏览器+网络环境 | 灰度发布，监控错误率       |

### 中风险任务

| Task                            | 风险             | 缓解措施                     |
| ------------------------------- | ---------------- | ---------------------------- |
| Task 1.3 (MutationObserver节流) | 可能影响降级模式 | 添加日志监控，确认不影响功能 |
| Task 3.1 (Observer优先级分离)   | 增加代码复杂度   | 单元测试覆盖，文档说明       |
| Task 4.1 (CDN健康度)            | 可能误判CDN状态  | 多指标综合判断，人工确认     |

---

## Open Questions

- [ ] 是否需要支持用户自定义CDN映射？
  - 当前: 仅支持预设CDN列表
  - 考虑: 用户场景多样性 vs 维护成本
  - 决策: **暂不支持**，保持简单，v3版本再考虑

- [ ] Worker池大小是否需要动态调整？
  - 当前: 固定2个Worker
  - 考虑: 设备性能差异、内存限制
  - 决策: **暂不调整**，降低复杂度，监控数据后再优化

- [ ] 缓存预热是否需要在后台标签页运行？
  - 当前: 未实现
  - 考虑: 资源消耗 vs 首次加载优化
  - 决策: **暂不实现**，Task 4.3仅完善基础预热

- [ ] 是否需要支持Service Worker缓存加速？
  - 当前: 仅检测是否已有SW
  - 考虑: 与页面现有SW冲突风险
  - 决策: **暂不支持**，风险过高

---

## Progress Log

| Date       | Update                                                              |
| ---------- | ------------------------------------------------------------------- |
| 2026-05-24 | ��建v1计划，基于火焰图分析结果                                      |
| 2026-05-24 | 确认v1-v21已完成功能列表                                            |
| 2026-05-24 | 代码审查：发现Task 1.1、1.2已实现                                   |
| 2026-05-24 | 升级v2：修复v1问题，添加基准测试、风险缓解、监控完善、测试完善Phase |

---

## 预期收益汇总（基于基准测试）

| 指标         | 基准值（待测） | 目标改善 | 验证方法           |
| ------------ | -------------- | -------- | ------------------ |
| LCP          | Task 0.1采集   | -100ms   | Task 5.1火焰图对比 |
| INP          | Task 0.1采集   | -110ms   | Task 5.1火焰图对比 |
| 主线程阻塞   | Task 0.1采集   | -70%     | Task 5.1火焰图对比 |
| 缓存命中率   | Task 4.5.1监控 | > 50%    | Task 4.5.2告警验证 |
| Worker成功率 | Task 4.5.1监控 | > 95%    | Task 4.5.2告警验证 |

---

## 实施时间表（优化后）

| 阶段             | 预计时间 | 依赖                 | 并行机会                |
| ---------------- | -------- | -------------------- | ----------------------- |
| Phase 0 (基准)   | 0.5天    | 无                   | 无                      |
| Phase 1 (P0)     | 1天      | Phase 0              | Task 1.1.1, 1.3可并行   |
| Phase 1.5 (风险) | 1天      | Phase 1              | Task 1.5.1, 1.5.2可并行 |
| Phase 2 (P1)     | 2天      | Phase 1.5            | Task 2.2, 2.4可并行     |
| Phase 3 (P2)     | 1天      | Phase 2              | Task 3.2, 3.3可并行     |
| Phase 4 (增强)   | 2天      | Phase 1              | Task 4.1, 4.3可并行     |
| Phase 4.5 (监控) | 1天      | 无                   | 可与Phase 1-4并行       |
| Phase 5 (验证)   | 1天      | Phase 1-4, Phase 4.5 | 无                      |
| Phase 5.5 (测试) | 2天      | Phase 5              | Task 5.5.2, 5.5.3可并行 |

**总计: 10.5天（含20%缓冲：12.5天）**

**关键路径优化**：

```
Phase 0 (0.5天) → Phase 1 (1天) → Phase 1.5 (1天) → Phase 2 (2天) → Phase 5 (1天)
                                                            ↓
                                                    Phase 4.5 (并行)
```

---

## 决策检查点

| 检查点        | 时间  | 决策                                          |
| ------------- | ----- | --------------------------------------------- |
| Phase 1完成后 | Day 2 | 根据Task 0.2基准验证效果，决定是否继续Phase 2 |
| Phase 2完成后 | Day 5 | 根据监控指标（Task 4.5.1）调整Phase 3-4优先级 |
| Phase 5完成后 | Day 9 | 根据性能验证结果决定是否发布                  |

---

## 下一步行动

**立即执行**（无依赖）：

1. ✅ Task 0.1 — 性能基准采集
2. ✅ Task 0.2 — 验证标准定义
3. ✅ Task 1.1.1 — 验证所有调用路径
4. ✅ Task 4.5.1 — 监控指标体系（可与Phase 1并行）

**等待决策**：

- 用户确认Open Questions的决策
- 用户确认时间表和检查点
