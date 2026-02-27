# "Extension context invalidated" 错误排查与修复

## 错误原因

这个错误通常发生在以下情况：

```
┌─────────────────────────────────────────────────────────┐
│              扩展生命周期与错误触发点                      │
├─────────────────────────────────────────────────────────┤
│                                                             │
│  扩展加载 → Content Script 初始化 → 发送消息给 Background │
│      ↓                                                   │
│  用户重新加载扩展 ←────────────── Background 已被销毁    │
│      ↓                                                   │
│  Content Script 仍尝试访问 → ❌ Extension context        │
│                             ❌ invalidated               │
│                                                             │
└─────────────────────────────────────────────────────────┘
```

## 常见触发场景

| 场景 | 原因 | 解决方案 |
|------|------|----------|
| 扩展重新加载 | Context 被销毁 | 添加重载检测 |
| Service Worker 终止 | Chrome 休眠策略 | 监听连接状态 |
| 异步操作完成时扩展已重载 | 竞态条件 | 添加错误处理 |
| 跨上下文消息 | 接收端不存在 | 检查连接有效性 |

## 修复方案

### 1. 添加重载检测

```javascript
// 在 content script 中
let extensionReloaded = false;

// 监听扩展重载
chrome.runtime.onConnect.addListener((port) => {
  extensionReloaded = false;
});

// 或者在异步操作中检查
async function safeStorageGet(key) {
  try {
    const result = await chrome.storage.local.get(key);
    return result;
  } catch (error) {
    if (error.message.includes('Extension context invalidated')) {
      console.warn('[Storage] 扩展已重载，忽略操作');
      return null;
    }
    throw error;
  }
}
```

### 2. 安全的消息发送

```javascript
// 安全的消息发送函数
async function safeSendMessage(message, retries = 2) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await chrome.runtime.sendMessage(message);
      return response;
    } catch (error) {
      if (error.message.includes('Extension context invalidated') ||
          error.message.includes('message port closed')) {
        console.warn('[Message] 扩展上下文已失效，等待重试...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        continue;
      }
      throw error;
    }
  }
}
```

### 3. Storage 操作包装

```javascript
// 创建安全的存储 API
const SafeStorage = {
  async get(keys, defaultValue = null) {
    try {
      const result = await chrome.storage.local.get(keys);
      return result[keys] ?? defaultValue;
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        console.warn('[Storage] 获取失败，返回默认值:', defaultValue);
        return defaultValue;
      }
      throw error;
    }
  },

  async set(data) {
    try {
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      if (error.message.includes('Extension context invalidated')) {
        console.warn('[Storage] 保存失败，扩展可能已重载');
        return false;
      }
      throw error;
    }
  }
};
```

### 4. 连接状态检查

```javascript
// 检查 Background 连接状态
function isBackgroundAvailable() {
  return chrome.runtime && chrome.runtime.id;
}

// 安全的 Background 通信
async function communicateWithBackground(message) {
  if (!isBackgroundAvailable()) {
    throw new Error('Background 不可用');
  }

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(response);
      }
    });
  });
}
```

### 5. youtube.js 中的修复

更新 `youtube.js` 中的 `loadSettings` 函数：

```javascript
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('youtubeSettings');
    const settings = { ...DEFAULT_SETTINGS, ...result.youtubeSettings };

    // 缓存到 window
    window.YouTubeSettings = settings;

    // 应用样式
    applyStyles(settings);

    console.log('[YouTube] 设置已加载:', settings);
  } catch (error) {
    // 扩展重载时使用缓存的设置
    if (error.message.includes('Extension context invalidated') ||
        error.message.includes('Extension context')) {
      console.warn('[YouTube] 扩展上下文已失效，使用缓存设置');
      const cachedSettings = window.YouTubeSettings || DEFAULT_SETTINGS;
      applyStyles(cachedSettings);
      return;
    }
    console.error('[YouTube] 加载设置失败:', error);
    applyStyles(DEFAULT_SETTINGS);
  }
}
```

## 调试方法

### 1. 检查 Console 日志

```
在目标网页按 F12 打开 DevTools Console:
- 查找 "[YouTube]" 开头的日志
- 查找 "[Storage]" 开头的警告
- 查找 "[Message]" 开头的错误
```

### 2. 检查 Background Service Worker

```
1. 打开 chrome://extensions/
2. 找到扩展，点击 "Service Worker"
3. 查看是否有错误日志
```

### 3. 强制重新加载

```
1. 在 chrome://extensions/ 中点击扩展的 "刷新" 图标
2. 刷新目标网页 (F5)
3. 观察是否仍有错误
```

## youtube.js 修复版本

关键修改点：

```javascript
// 存储操作添加错误处理
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get('youtubeSettings');
    // ... 处理逻辑
  } catch (error) {
    // 处理扩展重载的情况
    if (error.message.includes('Extension context')) {
      const cached = window.YouTubeSettings || DEFAULT_SETTINGS;
      applyStyles(cached);
      return;
    }
    throw error;
  }
}

// 监听 storage 变化添加错误处理
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local' && changes.youtubeSettings) {
    try {
      const newSettings = changes.youtubeSettings.newValue;
      window.YouTubeSettings = newSettings;
      applyStyles(newSettings);
    } catch (error) {
      console.warn('[YouTube] Storage 监听器错误:', error);
    }
  }
});
```

## 完整的修复代码

更新 `content/youtube.js` 中的相关函数：

```javascript
// 安全的存储获取
async function safeGetSetting(key, defaultValue) {
  try {
    const result = await chrome.storage.local.get('youtubeSettings');
    const settings = result.youtubeSettings || {};
    return settings[key] !== undefined ? settings[key] : defaultValue;
  } catch (error) {
    if (error.message.includes('Extension context')) {
      console.warn('[YouTube] 获取设置失败，使用缓存或默认值');
      return window.YouTubeSettings?.[key] ?? defaultValue;
    }
    return defaultValue;
  }
}

// 使用安全的方法获取设置
async function loadSettings() {
  console.log('[YouTube] 脚本初始化...');

  // 等待 DOM 加载
  if (document.readyState === 'loading') {
    await new Promise(resolve => {
      document.addEventListener('DOMContentLoaded', resolve);
    });
  }

  // 安全地加载设置
  const settings = {
    hideDismissible: await safeGetSetting('hideDismissible', DEFAULT_SETTINGS.hideDismissible),
    gridColumns: await safeGetSetting('gridColumns', DEFAULT_SETTINGS.gridColumns),
    hideShorts: await safeGetSetting('hideShorts', DEFAULT_SETTINGS.hideShorts),
    hideAds: await safeGetSetting('hideAds', DEFAULT_SETTINGS.hideAds),
    compactMode: await safeGetSetting('compactMode', DEFAULT_SETTINGS.compactMode)
  };

  // 缓存到 window
  window.YouTubeSettings = settings;

  // 应用样式
  applyStyles(settings);

  // 设置快捷键
  setupKeyboardShortcuts();

  // 响应式网格
  setupResponsiveGrid();

  // 监控 DOM 变化
  observeDOMChanges();

  console.log('[YouTube] 脚本初始化完成');
}
```
