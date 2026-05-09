# Tree Shaking优化配置指南

## 概述

Tree Shaking用于移除JavaScript中未使用的代码，减少打包体积。

## 配置方法

### 1. Vite配置优化

`vite.config.js`中已包含基本的Tree Shaking配置：

```javascript
export default defineConfig({
  build: {
    minify: 'esbuild', // 使用esbuild压缩
    rollupOptions: {
      output: {
        manualChunks: {
          // 代码分割
          'vendor': ['esbuild'],
          'core': ['./content/modules/core'],
          'plugins': ['./content/modules/plugins']
        }
      }
    }
  }
})
```

### 2. 代码分割策略

#### 插件独立打包

```javascript
manualChunks(id) {
  if (id.includes('plugins/')) {
    return 'plugins'
  }
  if (id.includes('core/')) {
    return 'core'
  }
}
```

#### 按需加载

```javascript
// 动态导入插件
const loadPlugin = async (name) => {
  const module = await import(`./plugins/${name}.js`)
  return module.default
}
```

### 3. 副作用标记

`package.json`中标记无副作用文件：

```json
{
  "sideEffects": [
    "*.css",
    "*.scss"
  ]
}
```

### 4. ES模块要求

确保使用ES模块语法：

```javascript
// ✅ 推荐：ES模块
export class Plugin { }
import { Plugin } from './Plugin.js'

// ❌ 避免：CommonJS
module.exports = {}
require('./module')
```

### 5. 包体积分析

安装分析工具：

```bash
npm install --save-dev rollup-plugin-visualizer
```

配置：

```javascript
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true
    })
  ]
})
```

## 最佳实践

### 1. 避免副作用代码

```javascript
// ❌ 副作用代码（不会被Tree Shake）
window.myGlobal = {}

// ✅ 纯函数（可以被Tree Shake）
export function createGlobal() {
  return {}
}
```

### 2. 使用纯ES模块

```javascript
// ✅ 推荐
export const util = { }

// ❌ 避免
export default { }
```

### 3. 明确导入

```javascript
// ✅ 推荐：明确导入
import { Plugin } from './Plugin.js'

// ❌ 避免：导入全部
import * as Plugin from './Plugin.js'
```

## 效果验证

### 1. 分析打包结果

```bash
npm run build -- --mode analyze
```

### 2. 对比包体积

```bash
# 构建前
du -sh dist/

# 构建后
npm run build
du -sh dist/
```

### 3. 检查未使用代码

```bash
npx agadoo dist/content-bundle.js
```

## 预期收益

- **减少包体积**：10-30%
- **提升加载速度**：15-25%
- **减少内存占用**：10-20%

## 注意事项

1. 确保所有依赖都支持Tree Shaking
2. 避免使用`require()`动态导入
3. 注意`package.json`的`sideEffects`配置
4. 生产构建时启用压缩

## 插件架构Tree Shaking

插件架构天然支持Tree Shaking：

```javascript
// 只加载需要的插件
const plugins = ['WorkerPlugin', 'ImagePlugin']

plugins.forEach(async name => {
  const Plugin = await import(`./plugins/${name}.js`)
  core.registerPlugin(Plugin)
})
```

未使用的插件不会被包含在打包结果中。
