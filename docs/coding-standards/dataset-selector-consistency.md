# Dataset 选择器一致性检查

## 问题
`dataset.camelCase` → HTML `data-camel-case`（全小写带连字符）
选择器字符串必须用小写连字符形式。

## 规则
```javascript
// ❌ 错误
document.querySelectorAll('img[data-lazySrc]')

// ✅ 正确
document.querySelectorAll('img[data-lazysrc]')
// 或用 JS 检测
img.dataset.lazySrc !== undefined
```

## 常见映射
| JS dataset | HTML 属性 | 选择器 |
|------------|-----------|--------|
| lazySrc | data-lazysrc | `[data-lazysrc]` |
| lazyLoaded | data-lazyloaded | `[data-lazyloaded="true"]` |
| _raProcessed | data-_raprocessed | `[data-_raprocessed]` |
| _raLazyLoad | data-_ralazyload | `[data-_ralazyload="1"]` |

## 检测脚本
`scripts/check-dataset-selectors.js` - CI 集成
