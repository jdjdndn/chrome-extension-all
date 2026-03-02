# 自动打包工具使用说明

## 快速开始

### 1. 单次同步
将所有源文件同步到 dist 目录（执行一次后退出）：

```bash
npm run sync
# 或
node scripts/watch-and-sync.js --once
```

### 2. 持续监控模式
自动监控文件变化并同步到 dist 目录：

```bash
npm run watch
# 或
node scripts/watch-and-sync.js
```

## 使用场景

1. **开发时**：在终端运行 `npm run watch`，保持监控开启
2. **修改代码后**：文件会自动同步到 dist 目录
3. **在 Chrome 中**：点击扩展的刷新按钮 🔄 即可看到更新

## 文件监控范围

### 单个文件
- manifest.json
- background.js
- content.js
- inject.js
- popup.html / popup.js
- newtab.html / newtab.js
- styles.css
- rules.json

### 目录
- devtools/
- content/
- icons/
- shared/
- src/

## 忽略的文件/目录
- `.git/`
- `node_modules/`
- `dist/`
- `.md` 文件
- `.claude/`

## 配合 Chrome 扩展开发

1. 打开终端，运行 `npm run watch`
2. 打开 Chrome，加载 `dist` 目录的扩展
3. 修改源代码
4. 在 `chrome://extensions/` 点击刷新按钮
5. 刷新测试页面查看效果
