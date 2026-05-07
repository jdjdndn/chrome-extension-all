// YouTube 专用脚本
// 功能: 自定义布局(4/5/6/8/10列)、隐藏 Shorts/广告
// 依赖: content/base/SiteScript.js

'use strict'

/**
 * YouTube 脚本类
 */
class YouTubeScript extends SiteScript {
  constructor() {
    super('YouTube', {
      waitForElement: 'ytd-rich-grid-renderer',
      waitForTimeout: 15000,
      defaultSettings: {
        gridColumns: 6,
        hideShorts: true,
        hideAds: true,
      },
      styleId: 'youtube-custom-style',
    })

    this.drawerId = 'youtube-layout-drawer'
    this.iconId = 'youtube-layout-icon'
  }

  /**
   * 获取样式
   */
  getStyles(settings) {
    const { gridColumns, hideShorts, hideAds } = settings
    let css = ''

    // 网格列数控制 - 设置所有相关 CSS 变量
    css += `
      /* YouTube ${gridColumns} 列网格布局 */
      :root {
        --ytd-rich-grid-items-per-row: ${gridColumns} !important;
        --ytd-rich-grid-posts-per-row: ${gridColumns} !important;
        --ytd-rich-grid-slim-items-per-row: ${gridColumns} !important;
        --ytd-rich-grid-game-cards-per-row: ${gridColumns} !important;
        --ytd-rich-grid-mini-game-cards-per-row: ${gridColumns} !important;
      }

      ytd-rich-grid-renderer {
        --ytd-rich-grid-items-per-row: ${gridColumns} !important;
        --ytd-rich-grid-posts-per-row: ${gridColumns} !important;
        --ytd-rich-grid-slim-items-per-row: ${gridColumns} !important;
        --ytd-rich-grid-game-cards-per-row: ${gridColumns} !important;
        --ytd-rich-grid-mini-game-cards-per-row: ${gridColumns} !important;
      }

      ytd-rich-shelf-renderer {
        --ytd-rich-grid-items-per-row: ${gridColumns} !important;
      }

      /* 强制覆盖 items-per-row 属性 */
      ytd-rich-item-renderer[items-per-row] {
        --ytd-rich-grid-items-per-row: ${gridColumns} !important;
      }
    `

    // 隐藏 Shorts
    if (hideShorts) {
      css += `
        ytd-reel-shelf-renderer,
        ytd-rich-shelf-renderer[is-shorts] {
          display: none !important;
        }
        tp-yt-paper-tab:has([aria-label="Shorts"]) {
          display: none !important;
        }
      `
    }

    // 隐藏广告
    if (hideAds) {
      css += `
        ytd-ad-slot-renderer,
        ytd-display-ad-renderer,
        .ytd-ad-slot-renderer,
        #masthead-ad {
          display: none !important;
        }
      `
    }

    return css
  }

  /**
   * DOM 变化回调 - 更新元素属性
   */
  onDOMChange() {
    this.debounce(() => {
      this.updateItemsPerRow()
    }, 500)()
  }

  /**
   * 更新元素的 items-per-row 属性
   */
  updateItemsPerRow() {
    const cols = this.settings.gridColumns
    const items = document.querySelectorAll('ytd-rich-item-renderer[items-per-row]')
    let updated = 0

    items.forEach((item) => {
      const currentVal = parseInt(item.getAttribute('items-per-row'))
      if (currentVal !== cols) {
        item.setAttribute('items-per-row', cols)
        updated++
      }
    })

    if (updated > 0) {
      console.log(`[YouTube] 已更新 ${updated} 个元素的 items-per-row 为 ${cols}`)
    }
  }

  /**
   * 脚本就绪回调
   */
  onReady() {
    this.createIcon()
    this.createDrawer()
    // 初始更新一次
    setTimeout(() => this.updateItemsPerRow(), 1000)
    console.log('[YouTube] 脚本就绪，当前列数:', this.settings.gridColumns)
  }

  /**
   * 创建浮动图标
   */
  createIcon() {
    if (document.getElementById(this.iconId)) return

    const icon = document.createElement('div')
    icon.id = this.iconId

    // 使用 DOM 方法创建 SVG 避免 TrustedHTML 错误
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('viewBox', '0 0 24 24')
    svg.setAttribute('width', '24')
    svg.setAttribute('height', '24')
    svg.setAttribute('fill', 'currentColor')

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', 'M3 3h8v8H3V3zm0 10h8v8H3v-8zM13 3h8v8h-8V3zm0 10h8v8h-8v-8z')
    svg.appendChild(path)
    icon.appendChild(svg)

    icon.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 80px;
      width: 48px;
      height: 48px;
      background: rgba(255, 255, 255, 0.95);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 9999;
      transition: all 0.2s ease;
      color: #333;
    `

    icon.addEventListener('mouseenter', () => {
      icon.style.transform = 'scale(1.1)'
      icon.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)'
    })
    icon.addEventListener('mouseleave', () => {
      icon.style.transform = 'scale(1)'
      icon.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)'
    })
    icon.addEventListener('click', () => this.toggleDrawer())

    document.body.appendChild(icon)
    console.log('[YouTube] 图标已创建')
  }

  /**
   * 创建抽屉 - 使用 DOM 方法避免 TrustedHTML 错误
   */
  createDrawer() {
    if (document.getElementById(this.drawerId)) return

    const drawer = document.createElement('div')
    drawer.id = this.drawerId
    drawer.style.cssText = `
      position: fixed;
      right: -320px;
      top: 0;
      width: 320px;
      height: 100vh;
      background: #fff;
      box-shadow: -2px 0 12px rgba(0,0,0,0.15);
      z-index: 10000;
      transition: right 0.3s ease;
      padding: 20px;
      box-sizing: border-box;
      overflow-y: auto;
    `

    // 创建头部
    const header = document.createElement('div')
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;'

    const title = document.createElement('h3')
    title.style.cssText = 'margin: 0; font-size: 18px; color: #333;'
    title.textContent = 'YouTube 布局设置'

    const closeBtn = document.createElement('button')
    closeBtn.id = 'yt-drawer-close'
    closeBtn.style.cssText =
      'background: none; border: none; font-size: 24px; cursor: pointer; color: #666;'
    closeBtn.textContent = '×'

    header.appendChild(title)
    header.appendChild(closeBtn)
    drawer.appendChild(header)

    // 创建列数设置区域
    const columnsSection = document.createElement('div')
    columnsSection.style.cssText = 'margin-bottom: 24px;'

    const columnsLabel = document.createElement('label')
    columnsLabel.style.cssText =
      'display: block; margin-bottom: 8px; font-size: 14px; color: #333; font-weight: 500;'
    columnsLabel.textContent = '网格列数: '

    const columnsValue = document.createElement('span')
    columnsValue.id = 'yt-columns-value'
    columnsValue.textContent = this.settings.gridColumns
    columnsLabel.appendChild(columnsValue)

    const columnsBtnsContainer = document.createElement('div')
    columnsBtnsContainer.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap;'
    ;[4, 5, 6, 7, 8, 10].forEach((cols) => {
      const btn = document.createElement('button')
      btn.className = 'yt-col-btn'
      btn.dataset.cols = cols
      btn.textContent = `${cols} 列`
      btn.style.cssText = `
        padding: 8px 16px;
        border: 2px solid ${this.settings.gridColumns === cols ? '#1a73e8' : '#ddd'};
        border-radius: 8px;
        background: ${this.settings.gridColumns === cols ? '#1a73e8' : '#fff'};
        color: ${this.settings.gridColumns === cols ? '#fff' : '#333'};
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      `
      columnsBtnsContainer.appendChild(btn)
    })

    columnsSection.appendChild(columnsLabel)
    columnsSection.appendChild(columnsBtnsContainer)
    drawer.appendChild(columnsSection)

    // 创建隐藏 Shorts 复选框
    const shortsSection = document.createElement('div')
    shortsSection.style.cssText = 'margin-bottom: 16px;'

    const shortsLabel = document.createElement('label')
    shortsLabel.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer;'

    const shortsCheckbox = document.createElement('input')
    shortsCheckbox.type = 'checkbox'
    shortsCheckbox.id = 'yt-hide-shorts'
    shortsCheckbox.checked = this.settings.hideShorts
    shortsCheckbox.style.cssText = 'width: 18px; height: 18px;'

    const shortsText = document.createElement('span')
    shortsText.style.cssText = 'font-size: 14px; color: #333;'
    shortsText.textContent = '隐藏 Shorts'

    shortsLabel.appendChild(shortsCheckbox)
    shortsLabel.appendChild(shortsText)
    shortsSection.appendChild(shortsLabel)
    drawer.appendChild(shortsSection)

    // 创建隐藏广告复选框
    const adsSection = document.createElement('div')
    adsSection.style.cssText = 'margin-bottom: 24px;'

    const adsLabel = document.createElement('label')
    adsLabel.style.cssText = 'display: flex; align-items: center; gap: 10px; cursor: pointer;'

    const adsCheckbox = document.createElement('input')
    adsCheckbox.type = 'checkbox'
    adsCheckbox.id = 'yt-hide-ads'
    adsCheckbox.checked = this.settings.hideAds
    adsCheckbox.style.cssText = 'width: 18px; height: 18px;'

    const adsText = document.createElement('span')
    adsText.style.cssText = 'font-size: 14px; color: #333;'
    adsText.textContent = '隐藏广告'

    adsLabel.appendChild(adsCheckbox)
    adsLabel.appendChild(adsText)
    adsSection.appendChild(adsLabel)
    drawer.appendChild(adsSection)

    // 创建重置按钮
    const resetBtn = document.createElement('button')
    resetBtn.id = 'yt-reset-btn'
    resetBtn.textContent = '重置为默认设置'
    resetBtn.style.cssText = `
      width: 100%;
      padding: 12px;
      background: #f1f1f1;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 14px;
      color: #666;
      transition: background 0.2s ease;
    `
    drawer.appendChild(resetBtn)

    document.body.appendChild(drawer)

    // 绑定事件
    closeBtn.addEventListener('click', () => this.closeDrawer())

    drawer.querySelectorAll('.yt-col-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cols = parseInt(btn.dataset.cols)
        this.updateSetting('gridColumns', cols)
        this.updateColumnButtons(cols)
        document.getElementById('yt-columns-value').textContent = cols
      })
    })

    shortsCheckbox.addEventListener('change', (e) => {
      this.updateSetting('hideShorts', e.target.checked)
    })

    adsCheckbox.addEventListener('change', (e) => {
      this.updateSetting('hideAds', e.target.checked)
    })

    resetBtn.addEventListener('click', () => {
      this.settings = { ...this.options.defaultSettings }
      this.saveSettings(this.settings)
      this.applyStyles()
      this.updateUI()
      this.showNotification('已重置为默认设置')
    })

    // 点击外部关闭
    drawer.addEventListener('click', (e) => e.stopPropagation())
    document.addEventListener('click', (e) => {
      const icon = document.getElementById(this.iconId)
      if (
        drawer.style.right === '0px' &&
        !drawer.contains(e.target) &&
        e.target !== icon &&
        !icon.contains(e.target)
      ) {
        this.closeDrawer()
      }
    })

    console.log('[YouTube] 抽屉已创建')
  }

  /**
   * 更新列数按钮状态
   */
  updateColumnButtons(cols) {
    const drawer = document.getElementById(this.drawerId)
    if (!drawer) return

    drawer.querySelectorAll('.yt-col-btn').forEach((btn) => {
      const btnCols = parseInt(btn.dataset.cols)
      if (btnCols === cols) {
        btn.style.borderColor = '#1a73e8'
        btn.style.background = '#1a73e8'
        btn.style.color = '#fff'
      } else {
        btn.style.borderColor = '#ddd'
        btn.style.background = '#fff'
        btn.style.color = '#333'
      }
    })
  }

  /**
   * 更新 UI
   */
  updateUI() {
    const drawer = document.getElementById(this.drawerId)
    if (!drawer) return

    const columnsValue = document.getElementById('yt-columns-value')
    const hideShortsCheckbox = document.getElementById('yt-hide-shorts')
    const hideAdsCheckbox = document.getElementById('yt-hide-ads')

    if (columnsValue) columnsValue.textContent = this.settings.gridColumns
    this.updateColumnButtons(this.settings.gridColumns)
    if (hideShortsCheckbox) hideShortsCheckbox.checked = this.settings.hideShorts
    if (hideAdsCheckbox) hideAdsCheckbox.checked = this.settings.hideAds
  }

  /**
   * 切换抽屉
   */
  toggleDrawer() {
    const drawer = document.getElementById(this.drawerId)
    if (!drawer) return

    if (drawer.style.right === '0px') {
      this.closeDrawer()
    } else {
      this.openDrawer()
    }
  }

  /**
   * 打开抽屉
   */
  openDrawer() {
    const drawer = document.getElementById(this.drawerId)
    if (drawer) {
      drawer.style.right = '0px'
    }
  }

  /**
   * 关闭抽屉
   */
  closeDrawer() {
    const drawer = document.getElementById(this.drawerId)
    if (drawer) {
      drawer.style.right = '-320px'
    }
  }
}

// 启动脚本
new YouTubeScript().init()
