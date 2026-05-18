/**
 * Popup 资源加速器控制模块
 * 负责资源加速器的配置和状态显示
 * 按需加载：仅在 page tab 使用
 */

/**
 * 初始化资源加速器控制
 */
export async function initResourceAccelerator() {
  console.log('[ResourceAccelerator] 初始化')

  const result = await chrome.storage.local.get('resourceAcceleratorConfig')
  const config = result.resourceAcceleratorConfig || {
    enabled: false,
    jsReplace: true,
    fontReplace: true,
    cssReplace: true,
    imageLazyLoad: true,
    imageCompress: true,
    imageQuality: 0.8,
    preloadEnabled: true,
    dedupEnabled: true,
    excludeDomains: [],
  }

  const enabledEl = document.getElementById('ra-enabled')
  const siteEnabledEl = document.getElementById('ra-site-enabled')
  const jsReplaceEl = document.getElementById('ra-js-replace')
  const fontReplaceEl = document.getElementById('ra-font-replace')
  const cssReplaceEl = document.getElementById('ra-css-replace')
  const imageLazyEl = document.getElementById('ra-image-lazy')
  const imageCompressEl = document.getElementById('ra-image-compress')
  const preloadEl = document.getElementById('ra-preload')
  const dedupEl = document.getElementById('ra-dedup')
  const qualityEl = document.getElementById('ra-quality')
  const qualityValueEl = document.getElementById('ra-quality-value')
  const settingsPanel = document.getElementById('ra-settings')

  if (!enabledEl) {return}

  // 检查当前站点是否被排除
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  let currentHost = ''
  if (tab?.url) {
    try {
      currentHost = new URL(tab.url).hostname
    } catch {}
  }
  const isSiteExcluded = config.excludeDomains?.some(
    d => currentHost === d || currentHost.endsWith('.' + d)
  )

  enabledEl.checked = config.enabled
  if (siteEnabledEl) {siteEnabledEl.checked = !isSiteExcluded}
  jsReplaceEl.checked = config.jsReplace
  fontReplaceEl.checked = config.fontReplace
  if (cssReplaceEl) {cssReplaceEl.checked = config.cssReplace !== false}
  imageLazyEl.checked = config.imageLazyLoad
  imageCompressEl.checked = config.imageCompress
  if (preloadEl) {preloadEl.checked = config.preloadEnabled !== false}
  if (dedupEl) {dedupEl.checked = config.dedupEnabled !== false}
  qualityEl.value = config.imageQuality * 100
  qualityValueEl.textContent = Math.round(config.imageQuality * 100)
  settingsPanel.style.display = config.enabled ? 'block' : 'none'

  // 通用配置保存函数
  const saveAndNotify = async () => {
    await chrome.storage.local.set({ resourceAcceleratorConfig: config })
    notifyResourceAccelerator(config)
  }

  enabledEl.addEventListener('change', async (e) => {
    config.enabled = e.target.checked
    settingsPanel.style.display = config.enabled ? 'block' : 'none'
    await saveAndNotify()
  })

  // 站点级开关
  if (siteEnabledEl) {
    siteEnabledEl.addEventListener('change', async (e) => {
      if (!config.excludeDomains) {config.excludeDomains = []}
      if (!e.target.checked) {
        if (!config.excludeDomains.includes(currentHost)) {
          config.excludeDomains.push(currentHost)
        }
      } else {
        config.excludeDomains = config.excludeDomains.filter(d => d !== currentHost)
      }
      await saveAndNotify()
    })
  }

  jsReplaceEl.addEventListener('change', async (e) => {
    config.jsReplace = e.target.checked
    await saveAndNotify()
  })

  fontReplaceEl.addEventListener('change', async (e) => {
    config.fontReplace = e.target.checked
    await saveAndNotify()
  })

  if (cssReplaceEl) {
    cssReplaceEl.addEventListener('change', async (e) => {
      config.cssReplace = e.target.checked
      await saveAndNotify()
    })
  }

  imageLazyEl.addEventListener('change', async (e) => {
    config.imageLazyLoad = e.target.checked
    await saveAndNotify()
  })

  imageCompressEl.addEventListener('change', async (e) => {
    config.imageCompress = e.target.checked
    await saveAndNotify()
  })

  if (preloadEl) {
    preloadEl.addEventListener('change', async (e) => {
      config.preloadEnabled = e.target.checked
      await saveAndNotify()
    })
  }

  if (dedupEl) {
    dedupEl.addEventListener('change', async (e) => {
      config.dedupEnabled = e.target.checked
      await saveAndNotify()
    })
  }

  qualityEl.addEventListener('input', async (e) => {
    const value = parseInt(e.target.value)
    qualityValueEl.textContent = value
    config.imageQuality = value / 100
    await chrome.storage.local.set({ resourceAcceleratorConfig: config })
  })

  // 缓存管理
  const cacheViewEl = document.getElementById('ra-cache-view')
  const cacheClearEl = document.getElementById('ra-cache-clear')
  if (cacheViewEl) {
    cacheViewEl.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs
            .sendMessage(tabs[0].id, { type: 'RESOURCE_ACCELERATOR_GET_STATS' })
            .then(response => {
              showCacheDetails(response)
            })
            .catch(() => {
              alert('无法获取缓存信息，请确认页面已加载')
            })
        }
      })
    })
  }
  if (cacheClearEl) {
    cacheClearEl.addEventListener('click', async () => {
      if (confirm('确认清除所有资源加速缓存？')) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            chrome.tabs
              .sendMessage(tabs[0].id, { type: 'RESOURCE_ACCELERATOR_CLEAR_CACHE' })
              .catch(() => {})
          }
        })
      }
    })
  }

  // 排除域名管理
  const excludeToggle = document.getElementById('ra-exclude-toggle')
  const excludePanel = document.getElementById('ra-exclude-panel')
  const excludeList = document.getElementById('ra-exclude-list')
  const excludeInput = document.getElementById('ra-exclude-input')
  const excludeAdd = document.getElementById('ra-exclude-add')

  if (excludeToggle && excludePanel) {
    excludeToggle.addEventListener('click', () => {
      const isOpen = excludePanel.style.display !== 'none'
      excludePanel.style.display = isOpen ? 'none' : 'block'
      excludeToggle.textContent = isOpen ? '排除域名 ▼' : '排除域名 ▲'
      if (!isOpen) {renderExcludeList()}
    })
  }

  function renderExcludeList() {
    if (!excludeList) {return}
    const domains = config.excludeDomains || []
    if (domains.length === 0) {
      excludeList.innerHTML = '<div style="color: #999;">暂无排除域名</div>'
      return
    }
    excludeList.innerHTML = domains
      .map(d => `
        <div style="display: flex; justify-content: space-between; padding: 2px 0;">
          <span>${d}</span>
          <button class="ra-remove-domain" data-domain="${d}" style="border: none; background: none; color: #dc3545; cursor: pointer; font-size: 11px;">✕</button>
        </div>
      `)
      .join('')

    excludeList.querySelectorAll('.ra-remove-domain').forEach(btn => {
      btn.addEventListener('click', async () => {
        const domain = btn.dataset.domain
        config.excludeDomains = (config.excludeDomains || []).filter(d => d !== domain)
        await saveAndNotify()
        renderExcludeList()
      })
    })
  }

  if (excludeAdd && excludeInput) {
    excludeAdd.addEventListener('click', async () => {
      const domain = excludeInput.value.trim()
      if (!domain) {return}
      if (!config.excludeDomains) {config.excludeDomains = []}
      if (!config.excludeDomains.includes(domain)) {
        config.excludeDomains.push(domain)
        await saveAndNotify()
        excludeInput.value = ''
        renderExcludeList()
      }
    })
  }

  // 替换详情面板
  const detailsToggle = document.getElementById('ra-details-toggle')
  const detailsPanel = document.getElementById('ra-details-panel')
  if (detailsToggle && detailsPanel) {
    detailsToggle.addEventListener('click', () => {
      const isOpen = detailsPanel.style.display !== 'none'
      detailsPanel.style.display = isOpen ? 'none' : 'block'
      detailsToggle.textContent = isOpen ? '替换详情 ▼' : '替换详情 ▲'
    })
  }

  loadResourceAcceleratorStats()
}

/**
 * 显示缓存详情
 */
function showCacheDetails(stats) {
  const listEl = document.getElementById('ra-details-list')
  if (!listEl || !stats) {return}

  document.getElementById('ra-details-panel').style.display = 'block'

  const lines = []
  if (stats.js?.details?.length) {
    stats.js.details.forEach(d => {
      lines.push(`<div style="color: #28a745;">JS: ${d.name} → ${d.cdn}</div>`)
    })
  }
  if (stats.fonts?.details?.length) {
    stats.fonts.details.forEach(d => {
      lines.push(`<div style="color: #17a2b8;">字体: ${d.name} → ${d.cdn}</div>`)
    })
  }
  if (stats.css?.details?.length) {
    stats.css.details.forEach(d => {
      lines.push(`<div style="color: #ffc107;">CSS: ${d.name} → ${d.cdn}</div>`)
    })
  }

  listEl.innerHTML = lines.length > 0 ? lines.join('') : '<div style="color: #999;">本次无替换</div>'
}

/**
 * 加载资源加速器统计
 */
async function loadResourceAcceleratorStats() {
  const result = await chrome.storage.local.get('resourceAcceleratorStats')
  const stats = result.resourceAcceleratorStats || {
    totalJsReplaced: 0,
    totalFontsReplaced: 0,
    totalCssReplaced: 0,
    totalImagesOptimized: 0,
    totalDedupRemoved: 0,
    totalBytesSaved: 0,
  }

  const jsCountEl = document.getElementById('ra-js-count')
  const fontCountEl = document.getElementById('ra-font-count')
  const cssCountEl = document.getElementById('ra-css-count')
  const lazyCountEl = document.getElementById('ra-lazy-count')
  const compressCountEl = document.getElementById('ra-compress-count')
  const totalReplacedEl = document.getElementById('ra-total-replaced')
  const dedupRemovedEl = document.getElementById('ra-dedup-removed')

  if (jsCountEl) {jsCountEl.textContent = `(${stats.totalJsReplaced})`}
  if (fontCountEl) {fontCountEl.textContent = `(${stats.totalFontsReplaced})`}
  if (cssCountEl) {cssCountEl.textContent = `(${stats.totalCssReplaced || 0})`}
  if (lazyCountEl) {lazyCountEl.textContent = `(${stats.totalImagesOptimized})`}
  if (compressCountEl) {compressCountEl.textContent = `(${stats.totalImagesOptimized})`}
  if (totalReplacedEl)
    {totalReplacedEl.textContent =
      (stats.totalJsReplaced || 0) +
      (stats.totalFontsReplaced || 0) +
      (stats.totalCssReplaced || 0) +
      (stats.totalImagesOptimized || 0)}
  if (dedupRemovedEl) {dedupRemovedEl.textContent = stats.totalDedupRemoved || 0}
}

/**
 * 通知资源加速器配置更新
 */
function notifyResourceAccelerator(config) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs
        .sendMessage(tabs[0].id, { type: 'RESOURCE_ACCELERATOR_CONFIG', data: config })
        .catch(() => {})
    }
  })
}
