# 智能资源加速器设计文档

## 概述

为慢速网站提供资源加速能力，通过公共CDN替换、图片优化等手段减少页面加载时间。

## 功能模块

### 1. JS库替换

**目标**：用国内公共CDN替换常见JS库

**实现方式**：
- 拦截`<script>`标签和XHR请求
- 匹配库名+版本，替换为CDN URL
- 支持的CDN源：bootcdn、cdnjs.bytedance.com、unpkg

**映射表示例**：
```javascript
const JS_CDN_MAP = {
  'jquery': {
    match: /jquery[-.]([\d.]+)(\.min)?\.js/i,
    cdn: 'https://cdn.bootcdn.net/ajax/libs/jquery/$1/jquery$2.min.js'
  },
  'react': {
    match: /react(?:\.production)?\.min\.js/i,
    cdn: 'https://cdn.bootcdn.net/ajax/libs/react/18.2.0/react.production.min.js'
  },
  'vue': {
    match: /vue(?:\.runtime)?(?:\.production)?\.min\.js/i,
    cdn: 'https://cdn.bootcdn.net/ajax/libs/vue/3.4.21/vue.global.prod.min.js'
  },
  'lodash': {
    match: /lodash(?:[-.]([\d.]+))?(\.min)?\.js/i,
    cdn: 'https://cdn.bootcdn.net/ajax/libs/lodash.js/4.17.21/lodash.min.js'
  }
};
```

**处理流程**：
1. 监听`document.createElement('script')`和动态插入
2. 解析src URL，匹配库名和版本
3. 若匹配成功，替换src为CDN URL
4. 记录替换日志和节省时间

### 2. 字体替换

**目标**：用国内镜像替换Google Fonts等外部字体

**支持的字体源**：
- Google Fonts → fonts.font.im / fonts.googleapis.cn
- FontAwesome → cdn.bytedance.com

**实现方式**：
- 拦截`<link rel="stylesheet">`请求
- 替换字体CSS URL
- 重写CSS中的`@font-face` URL

**处理流程**：
1. 监听`link[rel="stylesheet"]`插入
2. 检测是否为Google Fonts URL
3. 替换为镜像URL
4. 处理跨域CORS头

### 3. 图片优化

**3.1 懒加载**

**实现方式**：
- 使用IntersectionObserver API
- 替换`src`为`data-src`
- 进入视口时恢复`src`

**配置项**：
```javascript
{
  lazyLoad: true,
  lazyLoadThreshold: '200px', // 提前加载距离
  excludeSelectors: ['img[data-no-lazy]', '.no-lazy img']
}
```

**3.2 本地压缩**

**实现方式**：
- 拦截图片请求
- Canvas重绘压缩（质量0.7-0.8）
- 返回Blob URL

**处理流程**：
1. 监听`img`标签加载
2. 检测图片大小（>50KB才压缩）
3. Canvas绘制并导出为JPEG/WebP
4. 替换src为Blob URL

**配置项**：
```javascript
{
  compress: true,
  quality: 0.8,
  minSize: 51200, // 最小50KB才压缩
  excludeDomains: ['example.com'],
  format: 'auto' // auto/jpeg/webp
}
```

## 架构设计

### 文件结构

```
content/
  modules/
    resource-accelerator.js    # 主模块
    js-replacer.js             # JS替换
    font-replacer.js           # 字体替换
    image-optimizer.js         # 图片优化
shared/
  cdn-mappings.js              # CDN映射表
  resource-config.js           # 配置管理
```

### 模块职责

| 模块 | 职责 |
|------|------|
| resource-accelerator.js | 统一入口、配置管理、统计收集 |
| js-replacer.js | JS库检测、URL替换、版本匹配 |
| font-replacer.js | 字体URL替换、CSS重写 |
| image-optimizer.js | 懒加载、压缩处理 |

### 数据流

```
页面加载
    ↓
ResourceAccelerator.init()
    ↓
┌───────────────────────────────────────┐
│  检测页面资源                           │
│  - script标签                          │
│  - link[stylesheet]                    │
│  - img标签                             │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  匹配映射表                             │
│  - JS: cdnMappings.js                  │
│  - 字体: cdnMappings.fonts             │
└───────────────────────────────────────┘
    ↓
┌───────────────────────────────────────┐
│  执行替换/优化                          │
│  - JS: 修改src属性                      │
│  - 字体: 修改href属性                   │
│  - 图片: 懒加载+压缩                    │
└───────────────────────────────────────┘
    ↓
统计上报 → storage
```

## 用户界面

### Popup面板

```
┌─────────────────────────────────┐
│  ⚡ 资源加速器                    │
│  ─────────────────────────────  │
│  [✓] 总开关                      │
│                                 │
│  [✓] JS库替换      已替换: 12个  │
│  [✓] 字体替换      已替换: 3个   │
│  [✓] 图片懒加载    已处理: 45张  │
│  [✓] 图片压缩      已压缩: 23张  │
│                                 │
│  ─────────────────────────────  │
│  📊 本次加速效果                  │
│  节省流量: 2.3MB                 │
│  加速时间: 1.8s                  │
│                                 │
│  [⚙️ 设置] [📊 详细统计]         │
└─────────────────────────────────┘
```

### 设置面板

```
┌─────────────────────────────────┐
│  ⚙️ 资源加速器设置               │
│  ─────────────────────────────  │
│  图片压缩质量: [====●====] 80%   │
│  最小压缩大小: [=====●===] 50KB  │
│                                 │
│  排除域名:                       │
│  [example.com        ] [+]      │
│  [test.com           ] [×]      │
│                                 │
│  排除资源URL:                    │
│  [*/special.js       ] [+]      │
│                                 │
│  [保存] [重置]                   │
└─────────────────────────────────┘
```

## 配置存储

```javascript
// 存储键: resourceAcceleratorConfig
{
  enabled: true,
  jsReplace: true,
  fontReplace: true,
  imageLazyLoad: true,
  imageCompress: true,
  imageQuality: 0.8,
  imageMinSize: 51200,
  lazyLoadThreshold: 200,
  excludeDomains: [],
  excludeUrls: [],
  stats: {
    totalJsReplaced: 0,
    totalFontsReplaced: 0,
    totalImagesOptimized: 0,
    totalBytesSaved: 0,
    totalTimeSaved: 0
  }
}
```

## 兼容性考虑

### 风险点

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| CDN版本不匹配 | 功能异常 | 优先匹配精确版本，无匹配则跳过 |
| 跨域CORS问题 | 字体加载失败 | 使用支持CORS的CDN源 |
| 图片压缩失真 | 用户体验下降 | 可配置质量，提供排除规则 |
| 动态加载资源 | 替换失败 | MutationObserver监听DOM变化 |

### 降级策略

1. 替换失败时保留原始URL
2. 压缩失败时返回原图
3. CDN不可达时回退源站

## 实现优先级

1. **P0 - 核心功能**
   - JS库替换（常见库：jQuery、React、Vue、Lodash）
   - 图片懒加载

2. **P1 - 增强功能**
   - 字体替换（Google Fonts）
   - 图片压缩

3. **P2 - 完善功能**
   - 统计面板
   - 排除规则配置
   - 更多CDN源支持

## 测试计划

### 单元测试

- JS库URL匹配逻辑
- 字体URL替换逻辑
- 图片压缩质量验证

### 集成测试

- 真实页面加载测试
- 多站点兼容性测试
- 性能对比测试

### 测试站点

- 包含jQuery的旧站点
- 使用Google Fonts的站点
- 图片密集型页面
