# redirect-links.js 迭代计划

> 基线版本：已完成配置提取（REDIRECT_LINKS_CONFIG）、函数拆分（decodeUrlValue / extractUrlFromString / extractTargetUrl）、日志统一、属性标记标准化

---

## 一、当前状态

### 已完成（v1 基线）

- 配置常量提取到模块顶层 `REDIRECT_LINKS_CONFIG`，支持解构使用
- 核心逻辑拆分为 3 个独立函数：`decodeUrlValue` / `extractUrlFromString` / `extractTargetUrl`
- 日志前缀统一为 `[redirect-links]`
- `PROCESSED_ATTR` 属性标记标准化
- ScriptLoader 依赖管理 + 降级处理
- MutationObserver + 节流监听动态内容
- 页面卸载清理 observer

---

## 二、迭代计划

### Phase 1: 测试体系搭建 ✅ 已完成

**1.1 提取纯函数为可测试模块** ✅

通过 `window.RedirectLinksUtils` 导出 `decodeUrlValue`、`extractUrlFromString`、`extractTargetUrl`，测试直接调用而非复制逻辑。

**1.2 补充 edge case 测试** ✅

- 多层编码：单层 / 双层 / 混合编码
- `//` 处理：`https%3A//example.com`、`//example.com`
- 纯域名：带端口号 `example.com:8080`
- 空参数：`?target=`（值为空串）
- 无需解码的正常 URL
- 特殊字符：参数值含 `&`、`=`

**1.3 测试直接调用导出函数** ✅

tests/redirect-links.test.js 已更新为使用 `window.RedirectLinksUtils`，移除全部重复辅助方法。

---

### Phase 2: 链接模式扩展 ✅ 已完成

**2.1 扩展 LINK_PATTERNS** ✅

| 站点     | 模式                    | 类型   |
| -------- | ----------------------- | ------ |
| B 站     | `bilibili.com/video/BV` | 正则   |
| 微博     | `weibo.com/n/`          | 字符串 |
| 百度贴吧 | `tieba.baidu.com/p/`    | 字符串 |
| 小红书   | `xhslink.com/`          | 正则   |

**2.2 扩展 TARGET_PARAMS** ✅

新增：`dest`、`out`、`return`、`back`

**2.3 白名单机制** ✅

`SKIP_DOMAINS` 配置，支持精确匹配和子域名匹配（`endsWith('.' + domain)`）。

初始白名单：`github.com`、`google.com`、`google.com.hk`、`accounts.google.com`

---

### Phase 3: 可观测性增强 ✅ 已完成

**3.1 Logger 接入** ✅

通过 `window.LoggerUtils.createLogger('redirect-links')` 接入，降级到 console。级别划分：

- `info`：加载成功、替换统计
- `debug`：单个链接替换详情

**3.2 替换计数持久化** ✅

每次页面替换后写入 `chrome.storage.local`，key 为 `redirectLinksStats`，存储 `{ total, sessions }`。

**3.3 修复日志 bug** ✅

原代码在 `link.href = realUrl` 后再读 `link.href` 记日志，会显示两次新 URL。改为先保存 `originalHref`。

---

### Phase 4: 性能优化（待评估 ROI）

**4.1 按域名预过滤**

在 `processLinks` 中，先按 `LINK_PATTERNS` 涉及的域名做粗筛，跳过明显无关的链接。

**4.2 Observer 配置优化**

评估 `subtree: true` 是否必要。对于大部分静态页面，可考虑仅监听 `childList`。

---

## 三、优先级排序

| 序号 | 任务              | Phase   | 状态   |
| ---- | ----------------- | ------- | ------ |
| 1    | 提取纯函数 + 测试 | Phase 1 | ✅     |
| 2    | 扩展链接模式      | Phase 2 | ✅     |
| 3    | Logger 接入       | Phase 3 | ✅     |
| 4    | 白名单机制        | Phase 2 | ✅     |
| 5    | 替换计数持久化    | Phase 3 | ✅     |
| 6    | 日志 bug 修复     | Phase 3 | ✅     |
| 7    | 域名预过滤        | Phase 4 | 待评估 |
| 8    | Observer 配置优化 | Phase 4 | 待评估 |

---

## 四、约束条件

1. **向后兼容** — 所有修改在现有功能基础上增量叠加，不删除已有逻辑
2. **降级可用** — ScriptLoader / LoggerUtils 未加载时仍正常工作
3. **内存安全** — observer 必须在 beforeunload 时 disconnect
4. **测试先行** — Phase 1 完成前不进入 Phase 2
