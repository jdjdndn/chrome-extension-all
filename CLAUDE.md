# Chrome Extension - 减少资源使用

## 项目概述

Chrome 扩展，用于减少接口信息使用。包含 DevTools 面板，支持 Mock 功能。

## 前置条件

1. **中文优先**：能用中文的地方用中文（注释、日志、变量名酌情）
2. **深度思考**：确保问题能一次性解决，思考完整流程再动工
3. **减少问题**：每次 coding 尽可能减少新问题出现
4. **不确定就问**：不确定的问题通过选择方式询问用户
5. **代码质量**：以最优美最易懂的方式实现功能
6. **性能优化**：确保性能最优
7. **代码复用**：优先提取公共能力，减少重复代码

## 技术栈

- Manifest V3
- Chrome DevTools API
- Content Script + Inject Script 分离架构

## 关键架构

```
DevTools Panel (console.js)
    ↓ chrome.devtools.inspectedWindow.eval()
Page Context (inject.js) - 拦截 fetch/XHR
    ↓ postMessage
Content Script (content.js) - DOM 操作、消息转发
    ↓ chrome.runtime.sendMessage
Background Service Worker (background.js)
```

## Mock 流程

1. 用户在 DevTools 点击 Mock
2. `mockAndRequest()` 通过 `inspectedWindow.eval()` 在页面上下文设置 `window.__mockData[key]`
3. 同时发送真实 fetch 请求
4. inject.js 拦截 fetch，发现 mock 数据，发送真实网络请求，替换响应体
5. Network API 捕获请求，`handleRequest()` 处理并添加到列表

## 关键文件

- `inject.js` - 页面上下文脚本，拦截 fetch/XHR
- `content.js` - 内容脚本，DOM 操作
- `devtools/console.js` - DevTools 面板逻辑
- `devtools/console.html` - DevTools 面板 UI
- `background.js` - 后台服务
- `manifest.json` - 扩展配置

## 注意事项

- inject.js 在页面上下文运行，能直接拦截 fetch/XHR
- content.js 和 inject.js 隔离，通过 postMessage 通信
- DevTools 面板只能通过 `inspectedWindow.eval()` 执行页面上下文代码
- Network API 只捕获真实网络请求
- 不要在 inject.js 和 content.js 中重复拦截 fetch/XHR

---

# 优秀设计模式参考 (来自 AdBlock 分析)

以下设计模式来自 AdBlock 扩展的逆向分析，可作为后续开发的参考标准。

## 1. 双 World 注入架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Content Scripts 分层                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ISOLATED World (安全隔离层)                                 │
│  ├── vendor/.../content.js    - 广告过滤引擎                 │
│  ├── ext/common.js             - 通用扩展函数                 │
│  ├── globals-front.js          - 前端全局变量                 │
│  ├── adblock-functions.js      - 工具函数库                 │
│  └── 功能: DOM 操作、UI 注入、消息通信                      │
│                                                              │
│  MAIN World (页面上下文层)                                   │
│  └── vendor/.../content-main.js - 拦截 fetch/XMLHttpRequest  │
│      功能: 页面级 API 拦截、原生对象代理                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**设计要点**:

- ISOLATED World 使用扩展 API (chrome.storage, chrome.runtime)
- MAIN World 拦截页面原生 API (fetch, XMLHttpRequest)
- 两个 World 通过 `window.postMessage` 通信

**实现示例**:

```javascript
// ISOLATED World - 可以使用扩展 API
chrome.storage.local.get("settings", (data) => {
  // 处理设置
});

// MAIN World - 可以访问页面变量
window.fetch = new Proxy(window.fetch, {
  apply: (target, thisArg, args) => {
    // 拦截 fetch 请求
  },
});
```

## 2. 元素隐藏机制

### CSS 格式统一

```javascript
// 统一的 CSS 隐藏格式
const HIDE_CSS = `${selector} { display: none !important; }`;

// 使用换行符分隔多条规则
const styleContent = selectors
  .map((s) => `${s} { display: none !important; }`)
  .join("\n");
```

### Style 元素管理

```javascript
// 统一的 style ID (与 content script 一致)
const STYLE_ID = "extension-hide-elements-style";

function applyHideStyles(selectors) {
  let styleEl = document.getElementById(STYLE_ID);
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = selectors
    .map((s) => `${s} { display: none !important; }`)
    .join("\n");
}
```

### 选择器生成算法

```javascript
// 优先级: ID > 类名 > 属性 > nth-child
function generateSelector(element) {
  if (element.id) {
    return "#" + element.id;
  }

  let selector = element.tagName.toLowerCase();

  // 添加类名 (最多3个)
  if (element.classList.length > 0) {
    const classes = Array.from(element.classList).slice(0, 3);
    selector += "." + classes.join(".");
  }

  // 添加 nth-child 确保唯一性
  if (element.parentNode) {
    const siblings = Array.from(element.parentNode.children).filter(
      (el) => el.tagName === element.tagName,
    );
    const index = siblings.indexOf(element) + 1;
    selector += ":nth-child(" + index + ")";
  }

  return selector;
}
```

## 3. DevTools 通信模式

### Port 持久连接

```javascript
// DevTools 面板中
let port;

function connect() {
  if (port) return port;

  port = chrome.runtime.connect({ name: "devtools" });

  port.onMessage.addListener((message) => {
    if (message.type.endsWith(".respond")) {
      handleMessage(message);
    }
  });

  port.onDisconnect.addListener(() => {
    port = null;
    setTimeout(() => connect(), 100); // 自动重连
  });

  return port;
}

function send(type, payload) {
  if (port) {
    port.postMessage({ type, ...payload });
  }
}
```

### inspectedWindow.eval 正确用法

```javascript
// 执行页面代码并获取结果
chrome.devtools.inspectedWindow.eval(code, (result, isException) => {
  if (isException) {
    console.error("执行异常:", isException);
  } else {
    console.log("执行结果:", result);
  }
});

// 获取页面元素信息
const code = `
  (function() {
    const el = $0; // 当前选中的元素
    if (!el) return null;
    return {
      tagName: el.tagName,
      id: el.id,
      className: el.className,
      textContent: el.textContent.substring(0, 50)
    };
  })()
`;
```

### 获取域名

```javascript
// 在 DevTools 中获取当前检查页面的域名
async function getCurrentDomain() {
  return new Promise((resolve) => {
    chrome.devtools.inspectedWindow.eval("window.location.hostname", (result) =>
      resolve(result),
    );
  });
}
```

## 4. 存储设计模式

### 域名特定设置

```javascript
// 存储结构
{
  "hideElementsSettings": {
    "example.com": {
      "enabled": true,
      "selectors": [".ad-banner", ".popup-overlay"]
    },
    "another-site.com": {
      "enabled": false,
      "selectors": []
    }
  }
}

// 操作函数
async function getDomainSettings(domain) {
  const result = await chrome.storage.local.get('hideElementsSettings');
  const allSettings = result.hideElementsSettings || {};
  return allSettings[domain] || { enabled: false, selectors: [] };
}

async function setDomainSettings(domain, settings) {
  const result = await chrome.storage.local.get('hideElementsSettings');
  const allSettings = result.hideElementsSettings || {};
  allSettings[domain] = settings;
  await chrome.storage.local.set({ hideElementsSettings: allSettings });
}
```

### 通知 Content Script

```javascript
// 更新设置后通知 content script
async function syncSettingsToContent(domain, settings) {
  await chrome.storage.local.set({ hideElementsSettings: allSettings });

  const tabs = await chrome.tabs.query({ active: true });
  if (tabs[0]?.id) {
    chrome.tabs
      .sendMessage(tabs[0].id, {
        type: "UPDATE_HIDE_ELEMENTS",
        enabled: settings.enabled,
        selectors: settings.selectors,
      })
      .catch(() => {
        console.log("Content script 未就绪");
      });
  }
}
```

## 5. 主题系统

### CSS 变量实现

```css
/* 定义主题变量 */
:root {
  --popup-background-color: #ffffff;
  --main-text-color: #333333;
  --accent-color: #e40d0d;
  --border-color: #e6e6e6;
}

/* 暗色主题 */
[data-theme="dark"] {
  --popup-background-color: #1a1a1a;
  --main-text-color: #e6e6e6;
  --accent-color: #ff363b;
  --border-color: #333333;
}

/* 使用变量 */
.button {
  background-color: var(--accent-color);
  color: var(--popup-background-color);
  border: 1px solid var(--border-color);
}
```

### 主题切换

```javascript
function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  chrome.storage.local.set({ theme });
}

function loadTheme() {
  chrome.storage.local.get("theme", (result) => {
    if (result.theme) {
      setTheme(result.theme);
    }
  });
}
```

## 6. 消息路由设计

### Content Script 消息处理

```javascript
// 统一的消息处理接口
const messageHandlers = {
  GET_SETTINGS: () => ({ success: true, settings: getCurrentSettings() }),
  UPDATE_SETTINGS: (message) => {
    updateSettings(message.settings);
    return { success: true };
  },
  GET_SELECTORS: () => ({ success: true, selectors: getSelectors() }),
  HIDE_ELEMENT: (message) => {
    hideElement(message.selector);
    return { success: true };
  },
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const handler = messageHandlers[message.type];
  if (handler) {
    const response = handler(message);
    sendResponse(response);
    return true; // 保持消息通道开放
  }
});
```

### DevTools 与 Background 通信

```javascript
// DevTools 发送消息到 Background
chrome.runtime.sendMessage(
  {
    type: "GET_DATA",
    tabId: chrome.devtools.inspectedWindow.tabId,
  },
  (response) => {
    if (response && response.success) {
      console.log("数据:", response.data);
    }
  },
);

// Background 处理来自 DevTools 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_DATA") {
    const data = getDataForTab(message.tabId);
    sendResponse({ success: true, data });
    return true;
  }
});
```

## 7. 增量更新策略

### 防抖更新

```javascript
class DebouncedUpdate {
  constructor(updateFn, delay = 300) {
    this.updateFn = updateFn;
    this.delay = delay;
    this.timer = null;
  }

  schedule(...args) {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.updateFn(...args);
      this.timer = null;
    }, this.delay);
  }

  flush() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.updateFn();
      this.timer = null;
    }
  }
}

// 使用
const updateUI = new DebouncedUpdate((data) => {
  renderUI(data);
}, 300);
```

### 规则集更新

```javascript
// 只更新变更的规则
async function updateRulesIncremental() {
  const currentVersion = await getCurrentRulesVersion();
  const latestVersion = await fetchLatestRulesVersion();

  if (currentVersion < latestVersion) {
    const diffRules = await fetchDiffRules(currentVersion, latestVersion);
    await applyRules(diffRules);
    await saveVersion(latestVersion);
  }
}
```

## 8. 错误处理模式

### 统一错误处理

```javascript
const ErrorHandler = {
  handle(error, context) {
    console.error(`[${context}]`, error);

    // 可选: 发送错误报告
    if (shouldReportErrors()) {
      this.report(error, context);
    }
  },

  report(error, context) {
    chrome.runtime.sendMessage({
      type: "REPORT_ERROR",
      error: {
        message: error.message,
        stack: error.stack,
        context,
        url: window.location.href,
      },
    });
  },
};

// 使用
try {
  riskyOperation();
} catch (error) {
  ErrorHandler.handle(error, "updateFilters");
}
```

### Promise 错误处理

```javascript
async function safeExecute(operation, fallback) {
  try {
    return await operation();
  } catch (error) {
    ErrorHandler.handle(error, operation.name);
    return fallback !== undefined ? fallback : null;
  }
}
```

## 9. 性能优化模式

### 规则集分层策略

```javascript
// 核心规则 (始终启用)
const CORE_RULESETS = ["main-ads", "privacy"];

// 补充规则 (按需启用)
const SUPPLEMENTARY_RULESETS = ["popups", "social"];

// 可选规则 (用户选择)
const OPTIONAL_RULESETS = ["language-specific", "regional"];

// 默认只启用核心规则
chrome.declarativeNetRequest.getEnabledRulesets((enabled) => {
  if (enabled.length === 0) {
    chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: CORE_RULESETS,
    });
  }
});
```

### 按需加载脚本

```javascript
// 只在特定网站注入特定脚本
const SITE_SPECIFIC_SCRIPTS = {
  "youtube.com": "yt-scripts.js",
  "facebook.com": "fb-scripts.js",
};

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "PAGE_LOADED") {
    const url = new URL(message.url);
    const script = SITE_SPECIFIC_SCRIPTS[url.hostname];
    if (script) {
      chrome.scripting.executeScript({
        files: [script],
        target: { tabId: message.tabId },
      });
    }
  }
});
```

## 10. 统计数据收集

```javascript
// 统计数据结构
const stats = {
  adsBlocked: 0,
  trackersBlocked: 0,
  domains: {},
  today: new Date().toDateString(),
};

// 更新统计
function incrementStat(type, domain) {
  stats[type + "Blocked"]++;

  if (domain) {
    stats.domains[domain] = (stats.domains[domain] || 0) + 1;
  }

  // 定期保存到 storage
  saveStatsDebounced();
}

// 获取统计报告
function getStatsReport() {
  return {
    ads: stats.adsBlocked,
    trackers: stats.trackersBlocked,
    topDomains: Object.entries(stats.domains)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10),
  };
}
```

## 11. Popup 与 Storage 同步

```javascript
// Popup 加载时从 storage 读取
async function loadPopupData() {
  const domain = await getCurrentDomain();
  const result = await chrome.storage.local.get("settings");

  const allSettings = result.settings || {};
  const domainSettings = allSettings[domain] || getDefaultSettings();

  updateUI(domainSettings);
}

// Popup 中修改后保存并通知
async function saveAndSync(settings) {
  const domain = await getCurrentDomain();

  // 保存到 storage
  const result = await chrome.storage.local.get("settings");
  const allSettings = result.settings || {};
  allSettings[domain] = settings;
  await chrome.storage.local.set({ settings: allSettings });

  // 通知 content script
  const tabs = await chrome.tabs.query({ active: true });
  if (tabs[0]?.id) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: "UPDATE_SETTINGS",
      settings,
    });
  }
}
```

## 12. 右键菜单集成

```javascript
// 创建右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "hideElement",
    title: "隐藏元素",
    contexts: ["all"],
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "hideElement") {
    // 通知 content script 显示元素选择器
    chrome.tabs.sendMessage(tab.id, {
      type: "SHOW_ELEMENT_SELECTOR",
    });
  }
});
```

---

## 设计原则总结

1. **分层架构**: Background → Content → Page 层层分明
2. **双 World 注入**: ISOLATED 负责安全，MAIN 负责功能
3. **统一 CSS 格式**: 所有隐藏使用相同的 CSS 格式
4. **域名特定设置**: 按域名存储和管理配置
5. **持久连接通信**: DevTools 使用 Port 保持连接
6. **防抖更新**: 避免频繁更新 UI 或 storage
7. **主题系统**: 使用 CSS 变量实现可切换主题
8. **错误处理**: 统一的错误处理和上报机制
9. **性能优先**: 分层启用规则集，按需加载脚本
10. **用户控制**: 所有关键功能都可以由用户自定义

---

# YouTube 专用设计

## 页面结构分析 (2025)

```
YouTube Homepage DOM Structure:
┌─────────────────────────────────────────────────────────┐
│ ytd-app                                                   │
│ └── ytd-page-manager                                   │
│     └── ytd-browse                                       │
│        └── ytd-two-column-browse-results-renderer       │
│           └── ytd-rich-grid-renderer (主网格容器)         │
│               └── ytd-rich-grid-media (网格项)            │
│                   └── ytd-rich-item-renderer              │
│                       └── #dismissible (视频卡片)           │
│                           ├── ytd-thumbnail              │
│                           └── #details (视频信息)       │
└─────────────────────────────────────────────────────────┘
```

## 关键 CSS 选择器

| 元素           | 选择器                    | 用途          |
| -------------- | ------------------------- | ------------- |
| 网格容器       | `ytd-rich-grid-renderer`  | 控制整体布局  |
| 网格项         | `ytd-rich-grid-media`     | 单个视频卡片  |
| 视频项         | `ytd-rich-item-renderer`  | 视频项容器    |
| **可关闭元素** | `**#dismissible**`        | 视频卡片内容  |
| 缩略图         | `ytd-thumbnail`           | 视频缩略图    |
| Shorts         | `ytd-reel-shelf-renderer` | Shorts 短视频 |
| 广告           | `ytd-ad-slot-renderer`    | 广告元素      |

## 网格布局控制

### CSS 变量控制

```css
ytd-rich-grid-renderer {
  --ytd-rich-grid-items-per-row: 6; /* 每行列数 */
  --ytd-rich-grid-posts-per-row: 6; /* 每行帖子数 */
}
```

### 响应式断点

| 屏幕宽度    | 默认列数 | 优化列数 |
| ----------- | -------- | -------- |
| < 1280px    | 4 列     | 6 列     |
| 1280-1920px | 5 列     | 8 列     |
| > 1920px    | 6 列     | 10 列    |

## 隐藏 #dismissible 元素

```javascript
// 方式1: 直接隐藏
#dismissible {
  display: none !important;
}

// 方式2: 条件隐藏 (只隐藏特定类型)
ytd-rich-item-renderer:has([aria-label="Shorts"]) > #dismissible {
  display: none !important;
}

// 方式3: 精确隐藏广告
ytd-ad-slot-renderer #dismissible {
  display: none !important;
}
```

## 设置 6/8 列布局

```javascript
// 通过 CSS 变量设置
function setGridColumns(columns) {
  const styleId = "youtube-grid-style";
  let styleEl = document.getElementById(styleId);

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `
    ytd-rich-grid-renderer {
      --ytd-rich-grid-items-per-row: ${columns} !important;
      --ytd-rich-grid-posts-per-row: ${columns} !important;
    }

    ytd-rich-item-renderer {
      width: calc(100% / ${columns}) !important;
    }

    /* 缩小内边距以适应更多列 */
    ytd-rich-grid-renderer > * {
      padding: 4px !important;
    }
  `;
}
```

## MutationObserver 监控

YouTube 是单页应用，内容动态加载：

```javascript
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      // 新增的视频卡片
      if (node.nodeType === 1 && node.querySelector) {
        const dismissible = node.querySelector("#dismissible");
        if (dismissible) {
          // 应用自定义样式
          applyCustomStyles(dismissible);
        }
      }
    });
  });
});

observer.observe(document.body, {
  childList: true,
  subtree: true,
});
```

## API 暴露模式

```javascript
// 在 content script 中暴露 API
window.YouTubeAPI = {
  setGridColumns: (cols) => setGridColumns(cols),
  toggleHideDismissible: () => toggleHideDismissible(),
  getSettings: () => getAllSettings(),
  updateSettings: (newSettings) => updateSettings(newSettings),
};
```

## 快捷键设计

```javascript
document.addEventListener("keydown", (e) => {
  // Alt + 数字键快速切换列数
  if (e.altKey && e.key >= "4" && e.key <= "9") {
    const columns = parseInt(e.key);
    setGridColumns(columns);
  }
});
```

## 存储同步

```javascript
// 监听 storage 变化
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes.youtubeSettings) {
    const newSettings = changes.youtubeSettings.newValue;
    applyStyles(newSettings);
  }
});
```

## YouTube 特殊注意事项

1. **动态加载**: YouTube 使用无限滚动，新内容需要监听
2. **单页应用**: 页面导航不触发重载，需要监听 URL 变化
3. **Shadow DOM**: 部分元素在 Shadow DOM 中，需要特殊处理
4. **性能考虑**: YouTube DOM 庞大，避免频繁查询
5. **CSS 变量优先级**: YouTube 使用大量 CSS 变量，需要 `!important`

## 完整功能实现

参考 `content/youtube.js` 文件，包含：

- ✅ 隐藏 #dismissible 元素（可切换）
- ✅ 6/8 列网格布局（可切换）
- ✅ 隐藏 Shorts（可切换）
- ✅ 隐藏广告（默认开启）
- ✅ 快捷键支持
- ✅ 响应式自动调整
- ✅ 设置持久化
- ✅ DOM 变化监控
