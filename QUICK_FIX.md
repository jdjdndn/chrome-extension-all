# 快速修复：Extension context invalidated 错误

## 🔍 快速诊断

### 步骤 1: 检查 Console 日志

在出现错误的页面按 `F12` 打开控制台，查看：
```
查找这些关键日志：
- [YouTube] 开始加载设置...
- [YouTube] 设置已加载: {...}
- [YouTube] 扩展上下文已失效
- Extension context invalidated
```

### 步骤 2: 强制重新加载

```
1. chrome://extensions/
2. 找到 "减少资源使用" 扩展
3. 点击 🔄 刷新图标
4. 刷新 YouTube 页面
```

## ✅ 已修复的内容

### 1. 安全的存储操作
```javascript
// 替换前：直接访问可能失败
const result = await chrome.storage.local.get('youtubeSettings');

// 替换后：添加错误处理
async function safeGetSetting(key, defaultValue) {
  try {
    const result = await chrome.storage.local.get('youtubeSettings');
    return result.youtubeSettings?.[key] ?? defaultValue;
  } catch (error) {
    if (error.message?.includes('Extension context')) {
      return window.YouTubeSettings?.[key] ?? defaultValue;
    }
    return defaultValue;
  }
}
```

### 2. 扩展重载检测
```javascript
// 缓存设置到 window，即使扩展重载也能使用
window.YouTubeSettings = settings;
```

### 3. Storage 监听器错误处理
```javascript
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.youtubeSettings) {
    try {
      // 处理变更
    } catch (error) {
      console.warn('[YouTube] 更新设置时出错:', error);
    }
  }
});
```

## 🎯 验证修复

### 测试步骤

1. **加载扩展**
   ```
   chrome://extensions/ → 开启开发者模式 → 加载扩展
   ```

2. **打开 YouTube**
   ```
   https://www.youtube.com
   ```

3. **打开控制台**
   ```
   按 F12 → 查看 Console 标签
   ```

4. **测试功能**
   ```javascript
   // 在控制台测试 API
   YouTubeAPI.setGridColumns(6)
   YouTubeAPI.setGridColumns(8)
   YouTubeAPI.toggleHideDismissible()
   ```

5. **重新加载扩展**
   ```
   在扩展页点击刷新图标
   刷新 YouTube 页面
   确认没有错误
   ```

## 🛠️ 调试命令

在 YouTube 页面控制台中运行：

```javascript
// 1. 检查扩展是否加载
console.log('Extension ID:', chrome?.runtime?.id);

// 2. 检查 API 是否可用
console.log('YouTube API:', typeof window.YouTubeAPI);

// 3. 查看当前设置
console.log('当前设置:', window.YouTubeAPI?.getSettings());

// 4. 测试存储操作
chrome.storage.local.get('youtubeSettings').then(r => console.log('Storage:', r));

// 5. 手动应用样式
YouTubeAPI.applyStyles({ gridColumns: 6 });
```

## 📋 检查清单

- [x] `youtube.js` 文件已创建
- [x] `manifest.json` 已包含 YouTube 配置
- [x] 添加了 `safeGetSetting` 错误处理
- [x] 添加了 `safeSetSetting` 错误处理
- [x] 添加了 window 缓存机制
- [x] 存储监听器添加了 try-catch

## 🔧 如果仍然出错

### 方案 1: 清除缓存并重装
```
1. chrome://extensions/
2. 移除扩展
3. 重启 Chrome
4. 重新加载扩展
```

### 方案 2: 检查冲突
```
1. 禁用其他 YouTube 相关扩展
2. 逐个启用找出冲突源
3. 禁用冲突扩展
```

### 方案 3: 检查 Chrome 版本
```
chrome://version/
确保版本 >= 124 (Manifest V3 要求)
```
