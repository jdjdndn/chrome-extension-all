# YouTube 专用脚本说明

## 功能概述

为 YouTube.com 提供以下功能：

1. 隐藏 `#dismissible` 元素
2. 设置网格布局（6列或8列显示）
3. 隐藏 Shorts
4. 隐藏广告

## 快捷键

| 快捷键    | 功能                       |
| --------- | -------------------------- |
| `Alt + 6` | 切换到 6 列布局            |
| `Alt + 8` | 切换到 8 列布局            |
| `Alt + D` | 切换隐藏 #dismissible 元素 |

## CSS 选择器

| 元素         | 选择器                    |
| ------------ | ------------------------- |
| 视频卡片容器 | `ytd-rich-grid-renderer`  |
| 单个视频项   | `ytd-rich-item-renderer`  |
| 可关闭元素   | `#dismissible`            |
| Shorts       | `ytd-reel-shelf-renderer` |
| 广告         | `ytd-ad-slot-renderer`    |

## 设置说明

默认设置：

```javascript
{
  hideDismissible: false,   // 隐藏 #dismissible
  gridColumns: 8,           // 每行8列
  hideShorts: true,         // 隐藏 Shorts
  hideAds: true,            // 隐藏广告
  compactMode: false        // 紧凑模式
}
```

## API 使用

在控制台中调用：

```javascript
// 设置为 6 列
YouTubeAPI.setGridColumns(6)

// 设置为 8 列
YouTubeAPI.setGridColumns(8)

// 切换隐藏 #dismissible
YouTubeAPI.toggleHideDismissible()

// 获取当前设置
const settings = YouTubeAPI.getSettings()

// 更新多个设置
YouTubeAPI.updateSettings({
  hideShorts: true,
  hideAds: true,
  compactMode: true,
})
```

## 响应式布局

- **< 1280px**: 自动使用 6 列
- **1280px - 1920px**: 自动使用 8 列
- **> 1920px**: 自动使用 10 列

用户手动设置后会覆盖自动响应。
