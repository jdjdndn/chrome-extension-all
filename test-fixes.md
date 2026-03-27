# 修复验证清单

## 修复内容

### 1. DOMUtils 就绪通知 ✅
- **文件**: `content/utils/dom.js`
- **修改**: 在文件末尾添加 `ScriptLoader.markReady('DOMUtils')`
- **验证**: 打开抖音或 B 站页面，检查控制台是否有 "DOMUtils is not defined" 错误

### 2. Popup 通信机制重构 ✅
- **文件**: `popup.js`, `popup.html`
- **修改**:
  - 移除 EventBus 依赖
  - 直接使用 Chrome Extension API (`chrome.runtime.sendMessage`, `chrome.tabs.sendMessage`)
- **验证**: 打开 popup，检查是否有 "EventBus 发送失败" 错误

### 3. Background 激活增强 ✅
- **文件**: `background.js`
- **修改**:
  - 添加重试机制（3次重试，每次等待500ms）
  - 跳过特殊页面（chrome://, about: 等）
  - 更详细的错误日志
- **验证**: 检查 background 控制台的 "[Background] 激活失败" 错误是否减少

## 测试步骤

### 步骤 1: 重新加载扩展
1. 打开 `chrome://extensions/`
2. 找到本扩展
3. 点击"重新加载"按钮 🔄

### 步骤 2: 测试 DOMUtils 修复
1. 打开 https://www.douyin.com/
2. 打开开发者工具 (F12)
3. 检查控制台，应该看到：
   ```
   [ScriptLoader] 模块就绪: DOMUtils
   [抖音脚本] 依赖已就绪，开始初始化
   ```
4. **不应该**看到 "Uncaught ReferenceError: DOMUtils is not defined"

### 步骤 3: 测试 Popup 通信
1. 点击扩展图标打开 popup
2. 打开 popup 控制台（右键 popup -> 检查）
3. 检查控制台，**不应该**看到：
   ```
   [Popup] EventBus 发送失败，降级原生: ...
   ```
4. 切换 "Enable Extension" 开关，应该正常工作

### 步骤 4: 测试 Background 激活
1. 打开扩展的 Service Worker 控制台（chrome://extensions/ -> 查看视图"Service Worker"）
2. 打开 popup
3. 检查 background 控制台，应该看到：
   ```
   [Background] 收到激活请求，来源: popup
   [Background] 激活成功, tabId: xxx
   ```
4. **不应该**看到 "激活失败" 错误

### 步骤 5: 测试特殊页面处理
1. 打开 `chrome://extensions/`
2. 打开 popup
3. 切换开关，应该看到：
   ```
   [Background] 跳过特殊页面: chrome://extensions/
   ```
4. 这是正常行为，特殊页面无法注入 content script

## 预期结果

### 成功标志
- ✅ 没有 "DOMUtils is not defined" 错误
- ✅ 没有 "EventBus 发送失败" 错误
- ✅ 没有 "Could not establish connection" 错误（或显著减少）
- ✅ 抖音/B站脚本正常初始化
- ✅ Popup 功能正常工作

### 如果仍有问题
1. 检查浏览器控制台的完整错误日志
2. 检查是否有其他脚本加载错误
3. 确认 manifest.json 的 content_scripts 加载顺序正确
4. 尝试硬刷新页面 (Ctrl+Shift+R)

## 技术说明

### 为什么 Popup 不能使用 EventBus？
Popup 和 content script 运行在**隔离的 JavaScript 上下文**中：
- Popup 有自己的 `window` 对象
- Content script 有自己的 `window` 对象
- 它们的 EventBus 实例无法直接通信

解决方案：使用 Chrome Extension API（`chrome.runtime.sendMessage`）进行跨上下文通信。

### 为什么需要重试机制？
当扩展刚重新加载或页面刚加载时：
1. Content script 可能还未完全初始化
2. 消息监听器可能还未注册
3. 立即发送消息会导致 "Receiving end does not exist" 错误

重试机制给 content script 足够的初始化时间（最多1.5秒）。

### DOMUtils 就绪通知的重要性
ScriptLoader 依赖模块显式调用 `markReady()` 来通知依赖已就绪：
- 如果不调用，依赖此模块的脚本会永远等待
- Douyin.js 等待 DOMUtils，但 DOMUtils 从未通知就绪
- 结果：抖音脚本永远无法初始化

修复后，DOMUtils 加载完成立即通知 ScriptLoader，抖音脚本可以正常初始化。
