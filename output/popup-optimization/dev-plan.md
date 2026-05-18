# Popup 打开延迟优化 - 开发计划

## 任务信息
- **任务名称**: 优化 Popup 打开延迟
- **复杂度等级**: Level 2（多文件修改、有明确验收标准）
- **创建时间**: 2026-05-16

## 验收标准
- [ ] 在 `background.js` 中增加 popup 预热逻辑
- [ ] 将 `popup.js` 中的非关键功能拆分为按需加载子模块
- [ ] Popup 打开时间减少 >30%

## 任务拆解

### 任务 1: background.js 增加 popup 预热逻辑 ✅
**描述**: 在 background.js 中添加 popup 预热机制
**执行方式**: Executor v2
**文件**: `background.js`
**具体修改**:
1. 监听 chrome.runtime.onConnect 事件，检测 popup 连接
2. 预加载 storage 数据到内存缓存
3. 预热当前活动 tab 的域名信息
4. 预加载阻断域名列表
**状态**: 已完成

### 任务 2: popup.js 代码分割 - 创建子模块 ✅
**描述**: 将非关键功能拆分为独立模块文件
**执行方式**: Executor v2
**文件**: `popup/modules/*.js`
**具体修改**:
1. 创建 `popup/modules/` 目录
2. 拆分以下非关键功能为独立模块:
   - `domain-manager.js` - 域名管理（加载/添加/删除阻断域名）
   - `keyword-manager.js` - 抖音/B站关键词管理
   - `hide-elements-manager.js` - 隐藏元素管理
   - `stats-panel.js` - 统计面板
   - `clipboard-history.js` - 剪贴板历史
   - `resource-accelerator.js` - 资源加速器控制
3. 创建 `popup-core.js` 导出核心功能
**状态**: 已完成

### 任务 3: popup.js 修改加载逻辑 ✅
**描述**: 修改 popup.js 的初始化逻辑，实现按需加载
**执行方式**: Executor v2
**文件**: `popup.js`
**具体修改**:
1. 保持核心功能在 popup.js 中（消息通信、基础设置、toggle）
2. 使用动态 import() 按需加载子模块
3. 根据当前 tab 的域名决定加载哪些模块
4. Tab 切换时按需加载对应功能
**状态**: 已完成

### 任务 4: 验证 ✅
**描述**: 验证所有修改是否正确
**执行方式**: Validator v2
**验证内容**:
1. background.js 预热逻辑是否正确实现
2. popup.js 代码分割后功能是否完整
3. 按需加载是否正常工作
4. 向后兼容性是否保持
**状态**: 已完成

## 依赖关系
```
任务 1 (background.js 预热) ──┐
                              ├──> 任务 3 (popup.js 加载逻辑)
任务 2 (popup.js 模块拆分) ──┘
                              └──> 任务 4 (验证)
```

## 预期收益
- Popup 首次打开时间减少 >30%
- 减少不必要的 JS 解析和执行时间
- 提升用户体验
