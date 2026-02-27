# Chrome Extension Template - 功能规划与优化计划

## 一、现有功能梳理

### 1. 核心模块

| 模块 | 文件 | 功能描述 |
|------|------|----------|
| **Background** | `background.js` | 后台服务、域名阻止、Mock 规则、消息路由 |
| **Popup** | `popup.html/js` | 扩展弹窗、设置管理、域名阻止列表 |
| **New Tab** | `newtab.html/js` | 新标签页覆盖、快捷链接、历史记录、天气 |
| **DevTools** | `devtools/*.js` | 开发者工具面板、Mock 功能、样式调试 |

### 2. Content Scripts (网站专用脚本)

| 网站 | 文件 | 主要功能 |
|------|------|----------|
| YouTube | `youtube.js` | 网格列数控制、隐藏 Shorts/广告 |
| B站 | `bili.js` | 关键词过滤、视频卡片隐藏 |
| 抖音 | `douyin.js` | 关键词过滤、自动关注 |
| 小红书 | `xiaohongshu.js` | 内容过滤 |
| 夸克 | `quark.js` | - |
| 阿里云盘 | `aliyun.js` | - |
| 百度网盘 | `baiduPan.js` | - |
| BOSS直聘 | `boss.js` | - |
| 微信读书 | `weread.js` | - |
| 其他 | `4hu.js`, `comic18.js`, `dianGong.js`, `gongkong.js` | - |

### 3. 公共模块

| 模块 | 文件 | 功能 |
|------|------|------|
| Logger | `content/utils/logger.js` | 日志工具 |
| Storage | `content/utils/storage.js` | 存储封装 |
| DOM | `content/utils/dom.js` | DOM 操作工具 |
| Messaging | `content/utils/messaging.js` | 消息通信 |

### 4. 通用功能 (content/common/)

| 功能 | 文件 | 描述 |
|------|------|------|
| 链接重定向 | `redirect-links.js` | 处理重定向链接 |
| 文本转链接 | `text-to-link.js` | 自动识别文本中的链接 |
| 语言转中文 | `lang-to-zh.js` | 翻译功能 |
| 链接新窗口 | `link-blank.js` | 链接在新窗口打开 |
| 添加标题 | `add-title.js` | 为元素添加 title 属性 |

---

## 二、架构问题分析

### 1. 代码复用问题

```
问题：各网站脚本存在大量重复代码
- 设置管理逻辑重复
- 样式注入逻辑重复
- 存储操作重复
- DOM 等待逻辑重复
```

### 2. 初始化时序问题

```
问题：document_start 与 DOM 就绪的矛盾
- YouTube 脚本使用 document_start，但需要等待 DOM 元素
- 各脚本初始化时机不一致
```

### 3. 配置管理问题

```
问题：配置分散，缺乏统一管理
- Popup 配置
- Storage 配置
- 各脚本内部配置
```

### 4. 日志混乱

```
问题：各脚本日志格式不统一
- 缺乏统一的日志级别控制
- 生产环境日志过多
```

---

## 三、架构优化方案

### 1. 提取公共基类

```javascript
// content/base/SiteScript.js
class SiteScript {
  constructor(siteName, options = {}) {
    this.siteName = siteName;
    this.options = {
      waitForElement: null,  // 等待的元素选择器
      defaultSettings: {},   // 默认设置
      ...options
    };
  }

  // 通用的初始化流程
  async init() {
    await this.waitForDOM();
    if (this.options.waitForElement) {
      await this.waitForElement(this.options.waitForElement);
    }
    await this.loadSettings();
    this.applyStyles();
    this.setupObservers();
    this.exposeAPI();
  }

  // 子类实现
  getStyles() { return ''; }
  onReady() {}
}
```

### 2. 统一配置管理

```javascript
// content/utils/config-manager.js
class ConfigManager {
  constructor(namespace) {
    this.namespace = namespace;
  }

  async get(key, defaultValue) {
    const result = await chrome.storage.local.get(this.namespace);
    const config = result[this.namespace] || {};
    return config[key] ?? defaultValue;
  }

  async set(key, value) {
    const result = await chrome.storage.local.get(this.namespace);
    const config = result[this.namespace] || {};
    config[key] = value;
    await chrome.storage.local.set({ [this.namespace]: config });
  }

  async getAll() {
    const result = await chrome.storage.local.get(this.namespace);
    return result[this.namespace] || {};
  }
}
```

### 3. 统一样式管理器

```javascript
// content/utils/style-manager.js
class StyleManager {
  constructor(id) {
    this.id = id;
    this.styleEl = null;
  }

  apply(css) {
    if (!this.styleEl) {
      this.styleEl = document.createElement('style');
      this.styleEl.id = this.id;
      document.head.appendChild(this.styleEl);
    }
    this.styleEl.textContent = css;
  }

  remove() {
    this.styleEl?.remove();
    this.styleEl = null;
  }
}
```

### 4. 元素等待工具

```javascript
// content/utils/element-watcher.js
class ElementWatcher {
  static waitFor(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) return resolve(element);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  static waitForMultiple(selectors, timeout = 10000) {
    return Promise.all(selectors.map(s => this.waitFor(s, timeout)));
  }
}
```

---

## 四、功能优化计划

### Phase 1: 基础设施优化 (优先级: 高)

| 任务 | 描述 | 预计工作量 |
|------|------|-----------|
| 1.1 提取 SiteScript 基类 | 统一各网站脚本的初始化流程 | 2h |
| 1.2 实现 ConfigManager | 统一配置管理 | 1h |
| 1.3 实现 StyleManager | 统一样式注入 | 1h |
| 1.4 实现 ElementWatcher | 统一元素等待逻辑 | 1h |
| 1.5 重构 youtube.js | 使用新的基础设施 | 2h |

### Phase 2: 现有功能完善 (优先级: 中)

| 任务 | 描述 | 预计工作量 |
|------|------|-----------|
| 2.1 YouTube 网格列数 | 完善 CSS 变量覆盖方案 | 1h |
| 2.2 B站关键词过滤 | 优化过滤性能 | 1h |
| 2.3 抖音自动操作 | 增加更多自动化功能 | 2h |
| 2.4 New Tab 页面 | 优化快捷链接管理 | 1h |
| 2.5 隐藏元素功能 | 增加可视化选择器 | 2h |

### Phase 3: 新功能开发 (优先级: 低)

| 任务 | 描述 | 预计工作量 |
|------|------|-----------|
| 3.1 数据同步 | 支持 Chrome Sync 同步配置 | 2h |
| 3.2 导入导出 | 配置导入导出功能 | 1h |
| 3.3 统计面板 | 显示过滤统计数据 | 2h |
| 3.4 快捷键管理 | 自定义快捷键配置 | 1h |
| 3.5 主题系统 | 支持亮色/暗色主题 | 2h |

---

## 五、具体实施步骤

### Step 1: 创建基础设施目录结构

```
content/
├── base/
│   └── SiteScript.js      # 网站脚本基类
├── utils/
│   ├── config-manager.js  # 配置管理
│   ├── style-manager.js   # 样式管理
│   ├── element-watcher.js # 元素等待
│   ├── logger.js          # 日志工具 (已有)
│   ├── storage.js         # 存储工具 (已有)
│   ├── dom.js             # DOM 工具 (已有)
│   └── messaging.js       # 消息工具 (已有)
├── common/                 # 通用功能 (已有)
└── [site].js              # 各网站脚本
```

### Step 2: 重构 youtube.js 示例

```javascript
// content/youtube.js
class YouTubeScript extends SiteScript {
  constructor() {
    super('youtube', {
      waitForElement: 'ytd-rich-grid-renderer',
      defaultSettings: {
        gridColumns: 6,
        hideShorts: true,
        hideAds: true
      }
    });
  }

  getStyles(settings) {
    const { gridColumns, hideShorts, hideAds } = settings;
    let css = '';

    // 网格列数
    css += `
      :root, ytd-rich-grid-renderer {
        --ytd-rich-grid-items-per-row: ${gridColumns} !important;
      }
    `;

    // 隐藏 Shorts
    if (hideShorts) {
      css += `ytd-reel-shelf-renderer { display: none !important; }`;
    }

    return css;
  }

  onReady() {
    console.log('[YouTube] 脚本已就绪');
  }
}

// 自动初始化
new YouTubeScript().init();
```

---

## 六、测试计划

### 单元测试

- [ ] ConfigManager 测试
- [ ] StyleManager 测试
- [ ] ElementWatcher 测试

### 集成测试

- [ ] YouTube 脚本测试
- [ ] B站脚本测试
- [ ] 抖音脚本测试

### E2E 测试

- [ ] Popup 功能测试
- [ ] New Tab 功能测试
- [ ] DevTools 功能测试

---

## 七、文档计划

### 需要更新的文档

1. **CLAUDE.md** - 项目指南 (已有，需更新)
2. **README.md** - 用户文档 (待创建)
3. **API.md** - API 文档 (待创建)
4. **CHANGELOG.md** - 变更日志 (待创建)

---

## 八、版本规划

### v1.1.0 - 基础设施优化
- 提取公共基类和工具
- 重构 youtube.js
- 修复已知问题

### v1.2.0 - 功能完善
- 完善所有网站脚本
- 优化 Popup 和 New Tab
- 增加配置导入导出

### v1.3.0 - 用户体验
- 添加主题系统
- 添加统计面板
- 添加快捷键管理

### v2.0.0 - 重大更新
- 数据同步功能
- 可视化配置界面
- 插件系统

---

## 九、当前优先任务

### 立即处理

1. **YouTube 网格列数问题** - 当前样式未生效，需要调试
2. **New Tab 图标重复** - 已修复，需要验证
3. **统一日志格式** - 便于调试

### 本周完成

1. 提取 SiteScript 基类
2. 实现 ConfigManager
3. 实现 StyleManager
4. 重构 youtube.js

### 本月完成

1. 重构所有网站脚本使用新基类
2. 完善隐藏元素功能
3. 添加配置导入导出

---

*最后更新: 2026-02-27*
