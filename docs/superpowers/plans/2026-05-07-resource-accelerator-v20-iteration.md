# 资源加速器 v20 迭代计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-step. Steps use checkbox (`- [ ]`) syntax for tracking.

> 基线版本：v19（自适应资源质量 + WebWorker后台压缩）
> 创建时间：2026-05-07

**Goal:** 优化Worker压缩性能，增强统计能力，改进跨域图片处理。

---

## 迭代 1: detectDeviceTier结果缓存

**目标：** 缓存设备检测结果，避免重复计算

### 实现

```javascript
// 在 detectDeviceTier 附近添加缓存变量
let _cachedDeviceTier = null

function detectDeviceTier() {
  if (_cachedDeviceTier) return _cachedDeviceTier

  let tier = 'medium'
  if (navigator.deviceMemory) {
    if (navigator.deviceMemory >= 8) tier = 'high'
    else if (navigator.deviceMemory >= 4) tier = 'medium'
    else tier = 'low'
  } else if (navigator.hardwareConcurrency) {
    if (navigator.hardwareConcurrency >= 8) tier = 'high'
    else if (navigator.hardwareConcurrency >= 4) tier = 'medium'
    else tier = 'low'
  }

  _cachedDeviceTier = tier
  return tier
}
```

---

## 迭代 2: Worker负载均衡

**目标：** 多Worker任务分配优化，避免单Worker过载

### 实现

```javascript
// 替换 _getAvailableWorker
let _workerLoadIndex = 0

function _getAvailableWorker() {
  if (_compressorWorkers.length === 0) return null
  // 轮询分配
  const worker = _compressorWorkers[_workerLoadIndex % _compressorWorkers.length]
  _workerLoadIndex++
  return worker
}
```

---

## 迭代 3: 压缩统计增强

**目标：** 添加Worker压缩成功率/耗时统计

### 实现

1. 在state.stats中添加：

```javascript
workerCompressSuccess: 0,
workerCompressFallback: 0,
workerCompressTotalMs: 0,
```

2. 在\_compressViaWorker中记录耗时
3. 在compressImage中更新统计

---

## 迭代 4: 跨域图片处理优化

**目标：** Worker fetch失败时，主线程使用canvas绕过CORS

### 实现

在compressImage的Worker catch块中，不直接回退主线程，而是检查是否跨域失败，如果是则使用现有canvas逻辑（带crossOrigin）。

---

## 迭代 5: 动态Worker数量

**目标：** 根据设备性能动态调整Worker数量

### 实现

```javascript
function _getOptimalWorkerCount() {
  const tier = detectDeviceTier()
  if (tier === 'high') return 4
  if (tier === 'medium') return 2
  return 1
}
```

---

## 实施顺序

```
迭代1(缓存) → 迭代2(负载均衡) → 迭代3(统计) → 迭代4(跨域) → 迭代5(动态Worker)
```

---

## 约束条件

1. 向后兼容
2. 配置有默认值
3. 不影响现有功能
