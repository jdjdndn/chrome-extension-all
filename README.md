# Chrome 扩展 - 减少资源使用

一个功能丰富的 Chrome 扩展 (Manifest V3)，提供多网站功能增强、广告拦截、元素隐藏等功能。

## 主要功能

### 核心功能
- **EventBus 消息系统** - 高性能跨组件通信 (v4.6)
- **懒初始化架构** - 分层加载，按需初始化
- **元素选择器** - DevTools 面板可视化选择页面元素
- **隐藏元素** - 自定义 CSS 选择器隐藏页面元素
- **域名阻止** - 阻止特定域名的请求和响应
- **脚本开关** - 独立控制各功能模块的启用/禁用

### 支持的网站
| 网站 | 功能 |
|------|------|
| 抖音 (douyin.com) | 关键词过滤、自动关注、视频控制 |
| B站 (bilibili.com) | 关键词过滤、视频推荐过滤 |
| YouTube | 视频控制、广告跳过 |
| GitHub | 仓库增强 |
| 小红书 | 内容过滤 |
| 夸克网盘 | 下载增强 |
| 阿里云盘 | 下载增强 |
| 百度网盘 | 下载增强 |
| Boss直聘 | 求职辅助 |
| 4hu、18comic 等 | 内容增强 |

### 通用功能
- 重定向链接替换
- 文本转链接
- 非同源链接新窗口打开
- 添加 title 属性
- 文档生成器
- 文本收集器
- 键盘翻页
- 面板位置管理

### 新标签页
- 快捷链接管理
- 历史记录展示
- 学习资源分类
- 实用工具导航
- 右键菜单添加链接

## 文件结构

```
chrome-extension-template/
├── manifest.json              # 扩展配置 (Manifest V3)
├── background.js              # Service Worker
├── content.js                 # 内容脚本入口
├── popup.html/js              # 扩展弹窗
├── newtab.html/js             # 新标签页
├── inject.js                  # 页面上下文脚本
├── event-bus-v4.6.js          # EventBus 消息系统
│
├── content/
│   ├── core/                  # 核心模块
│   │   ├── store.js           # 状态管理
│   │   ├── services.js        # 服务层
│   │   ├── pipeline.js        # 处理管道
│   │   ├── site-base.js       # 站点基类
│   │   ├── site-factory.js    # 站点工厂
│   │   ├── plugin-system.js   # 插件系统
│   │   ├── config-manager.js  # 配置管理
│   │   ├── selector-merger.js # 选择器合并
│   │   ├── keyword-manager.js # 关键词管理
│   │   ├── rule-manager.js    # 规则管理
│   │   ├── lazy-loader.js     # 懒加载
│   │   ├── cache-manager.js   # 缓存管理
│   │   ├── batch.js           # 批处理
│   │   ├── history-manager.js # 历史管理
│   │   ├── rule-conflict.js   # 规则冲突检测
│   │   ├── debug-panel.js     # 调试面板
│   │   ├── input-validator.js # 输入验证
│   │   ├── security-manager.js# 安全管理
│   │   ├── config-migrator.js # 配置迁移
│   │   ├── extension-api.js   # 扩展 API
│   │   ├── module-manager.js  # 模块管理
│   │   └── lazy-init-manager.js # 懒初始化管理
│   │
│   ├── utils/                 # 工具模块
│   │   ├── logger.js          # 日志工具
│   │   ├── storage.js         # 存储工具
│   │   ├── storage-bridge.js  # 存储桥接
│   │   ├── dom.js             # DOM 工具
│   │   ├── messaging.js       # 消息工具
│   │   ├── content-bridge.js  # 内容桥接
│   │   └── localServer.js     # 本地服务
│   │
│   ├── common/                # 通用功能
│   │   ├── script-switch.js   # 脚本开关
│   │   ├── redirect-links.js  # 重定向链接
│   │   ├── text-to-link.js    # 文本转链接
│   │   ├── link-blank.js      # 链接新窗口
│   │   ├── add-title.js       # 添加标题
│   │   ├── doc-generator.js   # 文档生成
│   │   ├── text-collector.js  # 文本收集
│   │   ├── keyboard-pagination.js # 键盘翻页
│   │   └── panel-position-manager.js # 面板位置
│   │
│   ├── modules/               # 功能模块
│   │   ├── SelectorEngine.js  # 选择器引擎
│   │   ├── Highlighter.js     # 高亮器
│   │   ├── VirtualList.js     # 虚拟列表
│   │   ├── StorageManager.js  # 存储管理
│   │   ├── SmartRecommender.js# 智能推荐
│   │   ├── DOMWatcher.js      # DOM 监控
│   │   ├── SelectorWorker.js  # 选择器 Worker
│   │   ├── IncrementalUpdater.js # 增量更新
│   │   ├── SelectorPathVisualizer.js # 路径可视化
│   │   ├── OptimizationAdvisor.js # 优化建议
│   │   └── index.js           # 模块入口
│   │
│   ├── devtools/              # DevTools 模块
│   │   ├── console-api.js     # 控制台 API
│   │   └── page-helper.js     # 页面辅助
│   │
│   ├── base/                  # 基础类
│   │   └── SiteScript.js      # 站点脚本基类
│   │
│   └── [domain].js            # 各站点脚本
│       ├── bili.js            # B站
│       ├── douyin.js          # 抖音
│       ├── youtube.js         # YouTube
│       ├── github.js          # GitHub
│       ├── xiaohongshu.js     # 小红书
│       └── ...
│
├── devtools/                  # DevTools 面板
│   ├── devtools.html          # DevTools 入口
│   └── eventbus-devtools.js   # EventBus 调试
│
├── shared/                    # 共享模块
│   └── localServerClient.js   # 本地服务客户端
│
├── scripts/                   # 构建脚本
│   └── watch-and-sync.js      # 监听同步
│
└── tests/                     # 测试文件
    ├── eventbus-v4.6-test.js
    ├── eventbus-v4.6-final.test.js
    └── eventbus-integration-test.js
```

## 安装

1. 克隆或下载项目
2. 打开 Chrome 扩展管理页面 (`chrome://extensions/`)
3. 开启"开发者模式"
4. 点击"加载已解压的扩展程序"，选择项目目录

## 使用

### Popup 面板
- 启用/禁用扩展
- 管理阻止域名
- 配置隐藏元素选择器
- 切换脚本开关
- 配置站点关键词（抖音、B站）

### DevTools 面板
- EventBus 事件监控
- 元素选择器
- 隐藏元素管理

### 新标签页
- 快捷链接：点击 "+" 添加
- 右键菜单：页面任意位置 "添加到新标签页"
- 学习资源：分类管理常用学习链接

## 配置

### 脚本开关
通过 Popup 或代码控制：
```javascript
// 获取开关状态
getScriptSwitch('redirect-links'); // 同步，使用缓存
await getScriptSwitchAsync('redirect-links'); // 异步

// 设置开关
await setScriptSwitch('redirect-links', false);
```

### 隐藏元素
```javascript
// 通过消息更新
chrome.runtime.sendMessage({
  type: 'UPDATE_HIDE_ELEMENTS',
  enabled: true,
  selectors: ['.ad-banner', '#popup']
});
```

### 域名阻止
```javascript
// 添加阻止域名
chrome.runtime.sendMessage({
  type: 'ADD_BLOCKED_DOMAIN',
  domain: 'tracking.example.com'
});
```

## EventBus API

```javascript
// 发送事件
EventBus.emit('EVENT_NAME', { data: 'value' });

// 监听事件
EventBus.on('EVENT_NAME', (data) => {
  console.log('Received:', data);
});

// 请求-响应模式
const response = await EventBus.request('GET_STATE');

// 跨环境通信
EventBus.requestToBackground('GET_BLOCKED_DOMAINS');
EventBus.emitToContent('UPDATE_HIDE_ELEMENTS', data);
```

## 开发

### 构建命令
```bash
# 清理 dist
npm run clean

# 同步一次
npm run sync

# 监听模式
npm run watch
```

### 调试
- Popup: 右键扩展图标 → 检查弹出内容
- Content Script: 页面 DevTools → Console
- Service Worker: chrome://extensions/ → 检查视图

## 权限说明

| 权限 | 用途 |
|------|------|
| tabs | 标签页管理 |
| storage | 配置存储 |
| activeTab | 当前标签页访问 |
| scripting | 脚本注入 |
| declarativeNetRequest | 网络请求拦截 |
| cookies | Cookie 管理 |
| browsingData | 浏览数据清理 |
| bookmarks | 书签导入 |
| history | 历史记录展示 |
| notifications | 通知推送 |
| contextMenus | 右键菜单 |
| downloads | 文件下载 |

## 注意事项

1. 部分网站可能有内容安全策略限制
2. 扩展重新加载后需要刷新页面
3. 本地服务功能需要启动本地服务器 (localhost:3000)

## 许可证

MIT License
