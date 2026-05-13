// ========== 每日一言 ==========
const QUOTES = [
  { text: '生活不是等待暴风雨过去，而是学会在雨中跳舞。', author: '维维安·格林' },
  { text: '成功不是终点，失败也不是终结，重要的是继续前进的勇气。', author: '丘吉尔' },
  { text: '你今天的努力，是幸运的伏笔。当下的付出，是明日的花开。', author: '佚名' },
  { text: '不要因为走得太远，而忘记为什么出发。', author: '纪伯伦' },
  {
    text: '世界上只有一种真正的英雄主义，那就是认清生活的真相后依然热爱生活。',
    author: '罗曼·罗兰',
  },
  { text: '把每一个黎明看作生命的开始，把每一个黄昏看作生命的小结。', author: '罗斯金' },
  { text: '人生没有彩排，每一天都是现场直播。', author: '佚名' },
  { text: '真正的强者，不是没有眼泪的人，而是含着眼泪奔跑的人。', author: '佚名' },
  { text: '时间会证明一切，但你要先给时间一点时间。', author: '佚名' },
  { text: '与其用泪水悔恨昨天，不如用汗水拼搏今天。', author: '佚名' },
  { text: '梦想不会逃跑，逃跑的永远是自己。', author: '佚名' },
  { text: '每一个不曾起舞的日子，都是对生命的辜负。', author: '尼采' },
  { text: '生命中最难的阶段不是没有人懂你，而是你不懂你自己。', author: '尼采' },
  { text: '你若盛开，清风自来。', author: '佚名' },
  { text: '心之所向，素履以往。', author: '佚名' },
]

function loadDailyQuote() {
  const quoteText = document.getElementById('quote-text')
  const quoteAuthor = document.getElementById('quote-author')
  if (!quoteText) {
    return
  }

  // 根据日期选择一言（每天固定）
  const today = new Date()
  const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000)
  const quote = QUOTES[dayOfYear % QUOTES.length]

  quoteText.textContent = `"${quote.text}"`
  quoteAuthor.textContent = `—— ${quote.author}`
}

// 初始化
loadDailyQuote()
loadWeather()

// ========== 天气显示 ==========
async function loadWeather() {
  const tempEl = document.getElementById('weather-temp')
  const descEl = document.getElementById('weather-desc')
  const iconEl = document.getElementById('weather-icon')
  if (!tempEl) {
    return
  }

  try {
    // 使用免费的天气API (wttr.in)
    const response = await fetch('https://wttr.in/?format=j1')
    if (!response.ok) {
      throw new Error('Weather API failed')
    }

    const data = await response.json()
    const current = data.current_condition[0]

    tempEl.textContent = `${current.temp_C}°C`
    descEl.textContent = current.weatherDesc[0].value

    // 根据天气代码设置图标
    const code = parseInt(current.weatherCode)
    iconEl.textContent = getWeatherIcon(code)
  } catch (error) {
    console.error('加载天气失败:', error)
    tempEl.textContent = '--°C'
    descEl.textContent = '获取失败'
  }
}

function getWeatherIcon(code) {
  if (code === 113) {
    return '☀️'
  }
  if (code === 116) {
    return '⛅'
  }
  if (code === 119 || code === 122) {
    return '☁️'
  }
  if (
    [176, 263, 266, 293, 296, 299, 302, 305, 308, 311, 314, 317, 320, 353, 356, 359].includes(code)
  ) {
    return '🌧️'
  }
  if (
    [
      179, 182, 185, 227, 230, 281, 284, 323, 326, 329, 332, 335, 338, 350, 362, 365, 368, 371, 374,
      377,
    ].includes(code)
  ) {
    return '❄️'
  }
  if ([200, 386, 389, 392, 395].includes(code)) {
    return '⛈️'
  }
  if ([143, 248, 260].includes(code)) {
    return '🌫️'
  }
  return '🌤️'
}

// ========== 设置相关 ==========
const SETTINGS_KEY = 'newtabSettings'
const DEFAULT_SETTINGS = {
  columns: 6,
  historyCount: 8,
  searchEngine: 'baidu',
}

// 搜索引擎配置
const SEARCH_ENGINES = {
  baidu: { name: '百度', url: 'https://www.baidu.com/s?wd=' },
  google: { name: 'Google', url: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', url: 'https://www.bing.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=' },
  sogou: { name: '搜狗', url: 'https://www.sogou.com/web?query=' },
}

// 获取设置
function getSettings() {
  const settings = localStorage.getItem(SETTINGS_KEY)
  return settings ? { ...DEFAULT_SETTINGS, ...JSON.parse(settings) } : { ...DEFAULT_SETTINGS }
}

// 保存设置
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
}

// 应用列数设置
function applyColumnsSetting(columns) {
  const quickLinks = document.getElementById('quickLinks')
  quickLinks.style.gridTemplateColumns = `repeat(${columns}, 1fr)`
}

// 设置抽屉逻辑
const settingsBtn = document.getElementById('settingsBtn')
const settingsDrawer = document.getElementById('settingsDrawer')
const settingsCloseBtn = document.getElementById('settingsCloseBtn')
const drawerOverlay = document.getElementById('drawerOverlay')

function openSettings() {
  settingsDrawer.classList.add('open')
  drawerOverlay.classList.add('open')
}

function closeSettings() {
  settingsDrawer.classList.remove('open')
  drawerOverlay.classList.remove('open')
}

settingsBtn.addEventListener('click', openSettings)
settingsCloseBtn.addEventListener('click', closeSettings)
drawerOverlay.addEventListener('click', closeSettings)

// ESC 关闭抽屉
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSettings()
  }
})

// 列数滑块
const columnsRange = document.getElementById('columnsRange')
const columnsValue = document.getElementById('columnsValue')

columnsRange.addEventListener('input', (e) => {
  const value = parseInt(e.target.value)
  columnsValue.textContent = value
  applyColumnsSetting(value)

  const settings = getSettings()
  settings.columns = value
  saveSettings(settings)
})

// 历史记录数量滑块
const historyCountRange = document.getElementById('historyCountRange')
const historyCountValue = document.getElementById('historyCountValue')

historyCountRange.addEventListener('input', (e) => {
  const value = parseInt(e.target.value)
  historyCountValue.textContent = value

  const settings = getSettings()
  settings.historyCount = value
  saveSettings(settings)

  loadHistory()
})

// 初始化设置
function initSettings() {
  const settings = getSettings()

  // 设置滑块值
  columnsRange.value = settings.columns
  columnsValue.textContent = settings.columns
  historyCountRange.value = settings.historyCount
  historyCountValue.textContent = settings.historyCount

  // 设置搜索引擎选择
  const searchEngineSelect = document.getElementById('searchEngineSelect')
  if (searchEngineSelect) {
    searchEngineSelect.value = settings.searchEngine || 'baidu'
    searchEngineSelect.addEventListener('change', (e) => {
      const settings = getSettings()
      settings.searchEngine = e.target.value
      saveSettings(settings)
    })
  }

  // 应用列数
  applyColumnsSetting(settings.columns)

  // 加载历史记录
  loadHistory()
}

// ========== 工具函数 ==========
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

function safeHostname(url) {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

// ========== 历史记录相关 ==========
const historyContainer = document.getElementById('historyContainer')

// 获取域名图标URL
function getDomainIcon(domain) {
  // 使用Google的favicon服务获取真实图标
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
}

// 获取域名图标备用emoji
function getDomainEmoji(domain) {
  const domainEmojis = {
    google: '🔍',
    baidu: '🔎',
    github: '🐙',
    bilibili: '📺',
    youtube: '▶️',
    twitter: '🐦',
    'x.com': '❌',
    facebook: '📘',
    weibo: '🔴',
    zhihu: '🧠',
    juejin: '💎',
    taobao: '🛒',
    jd: '🛍️',
    tmall: '🐱',
    douyin: '🎵',
    xiaohongshu: '📕',
    weixin: '💬',
    qq: '🐧',
    netflix: '🎬',
    spotify: '🎵',
    reddit: '🤖',
    linkedin: '💼',
    stackoverflow: '📚',
    medium: '📝',
    notion: '📓',
    figma: '🎨',
    dribbble: '🏀',
    behance: '🎨',
  }

  for (const [key, emoji] of Object.entries(domainEmojis)) {
    if (domain.includes(key)) {
      return emoji
    }
  }

  // 默认图标
  const defaultIcons = ['🌐', '🔗', '📌', '⭐', '🚀', '💡', '🎯', '📱', '💻', '🎨']
  let hash = 0
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash)
  }
  return defaultIcons[Math.abs(hash) % defaultIcons.length]
}

// 创建图标元素
function createDomainIcon(domain) {
  const iconUrl = getDomainIcon(domain)
  const fallbackEmoji = getDomainEmoji(domain)

  return `<img src="${iconUrl}" alt="${escapeHtml(domain)}" style="width: 20px; height: 20px; border-radius: 4px; vertical-align: middle;" onerror="this.style.display='none';this.nextElementSibling.style.display='inline';"><span style="display: none;">${fallbackEmoji}</span>`
}

// 获取页面标题
function getPageTitle(url, title) {
  if (title && title.trim()) {
    return title
  }

  try {
    const urlObj = new URL(url)
    const pathParts = urlObj.pathname.split('/').filter((p) => p)
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].replace(/[-_]/g, ' ')
    }
    return urlObj.hostname
  } catch (e) {
    return url
  }
}

// 加载历史记录
async function loadHistory() {
  const settings = getSettings()
  const maxDomains = settings.historyCount

  try {
    // 获取最近的历史记录
    const historyItems = await chrome.history.search({
      text: '',
      maxResults: 500,
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000, // 最近7天
    })

    // 按域名分组
    const domainMap = new Map()

    historyItems.forEach((item) => {
      try {
        const urlObj = new URL(item.url)
        const domain = urlObj.hostname

        // 跳过某些域名
        if (domain === 'localhost' || domain === '127.0.0.1' || domain.endsWith('.local')) {
          return
        }

        if (!domainMap.has(domain)) {
          domainMap.set(domain, {
            domain,
            urls: [],
          })
        }

        // 每个域名最多显示5个URL
        if (domainMap.get(domain).urls.length < 5) {
          domainMap.get(domain).urls.push({
            url: item.url,
            title: getPageTitle(item.url, item.title),
            lastVisitTime: item.lastVisitTime,
          })
        }
      } catch (e) {
        // 忽略无效URL
      }
    })

    // 按最近访问时间排序
    const sortedDomains = Array.from(domainMap.values())
      .sort((a, b) => {
        const aLatest = Math.max(...a.urls.map((u) => u.lastVisitTime || 0))
        const bLatest = Math.max(...b.urls.map((u) => u.lastVisitTime || 0))
        return bLatest - aLatest
      })
      .slice(0, maxDomains)

    // 渲染历史记录
    renderHistory(sortedDomains)
  } catch (error) {
    console.error('加载历史记录失败:', error)
    historyContainer.innerHTML = '<div class="history-empty">加载历史记录失败</div>'
  }

  // 加载书签
  loadBookmarks()
}

// 加载书签
async function loadBookmarks() {
  const bookmarksContainer = document.getElementById('bookmarksContainer')
  if (!bookmarksContainer) {
    return
  }

  try {
    const tree = await chrome.bookmarks.getTree()
    const bookmarks = flattenBookmarks(tree)

    if (bookmarks.length === 0) {
      bookmarksContainer.innerHTML = '<div class="history-empty">暂无书签</div>'
      return
    }

    // 按访问频率排序（使用最近添加的）
    const recentBookmarks = bookmarks
      .filter((b) => b.url)
      .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
      .slice(0, 10)

    // 按域名分组
    const domainMap = new Map()
    recentBookmarks.forEach((b) => {
      try {
        const domain = new URL(b.url).hostname
        if (!domainMap.has(domain)) {
          domainMap.set(domain, { domain, urls: [] })
        }
        domainMap.get(domain).urls.push({
          url: b.url,
          title: b.title || domain,
        })
      } catch (e) {}
    })

    // 渲染书签
    bookmarksContainer.innerHTML = Array.from(domainMap.values())
      .map(
        (domain) => `
      <div class="history-domain">
        <div class="history-domain-header">
          <span class="history-domain-icon">${createDomainIcon(domain.domain)}</span>
          <span class="history-domain-name">${escapeHtml(domain.domain)}</span>
          <span class="history-domain-count">${domain.urls.length}</span>
        </div>
        <div class="history-urls">
          ${domain.urls
            .map(
              (urlItem) => `
            <a href="${escapeHtml(urlItem.url)}" class="history-url-item" title="${escapeHtml(urlItem.title)}">
              <span class="history-url-icon">📄</span>
              <span class="history-url-title">${escapeHtml(urlItem.title)}</span>
            </a>
          `
            )
            .join('')}
        </div>
      </div>
    `
      )
      .join('')
  } catch (error) {
    console.error('加载书签失败:', error)
    bookmarksContainer.innerHTML = '<div class="history-empty">加载书签失败</div>'
  }
}

// 扁平化书签树
function flattenBookmarks(nodes) {
  const result = []
  for (const node of nodes) {
    if (node.url) {
      result.push(node)
    }
    if (node.children) {
      result.push(...flattenBookmarks(node.children))
    }
  }
  return result
}

// 渲染历史记录
function renderHistory(domains) {
  if (domains.length === 0) {
    historyContainer.innerHTML = '<div class="history-empty">暂无历史记录</div>'
    return
  }

  historyContainer.innerHTML = domains
    .map(
      (domain) => `
    <div class="history-domain">
      <div class="history-domain-header">
        <span class="history-domain-icon">${createDomainIcon(domain.domain)}</span>
        <span class="history-domain-name">${escapeHtml(domain.domain)}</span>
        <span class="history-domain-count">${domain.urls.length}</span>
      </div>
      <div class="history-urls">
        ${domain.urls
          .map(
            (urlItem) => `
          <a href="${escapeHtml(urlItem.url)}" class="history-url-item" title="${escapeHtml(urlItem.title)}">
            <span class="history-url-icon">📄</span>
            <span class="history-url-title">${escapeHtml(urlItem.title)}</span>
          </a>
        `
          )
          .join('')}
      </div>
    </div>
  `
    )
    .join('')
}

// ========== 农历计算 ==========
const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, 0x04ae0,
  0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, 0x04970, 0x0a4b0,
  0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, 0x06566, 0x0d4a0, 0x0ea50,
  0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, 0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0,
  0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, 0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0,
  0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0, 0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260,
  0x0f263, 0x0d950, 0x05b57, 0x056a0, 0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558,
  0x0b540, 0x0b5a0, 0x195a6, 0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46,
  0x0ab60, 0x09570, 0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5,
  0x092e0, 0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, 0x07954,
  0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, 0x05aa0, 0x076a3,
  0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, 0x0b5a0, 0x056d0, 0x055b2,
  0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0,
]

const lunarMonthNames = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']
const lunarDayNames = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
]

function getLunarMonthDays(year, month) {
  return lunarInfo[year - 1900] & (0x10000 >> month) ? 30 : 29
}

function getLunarYearDays(year) {
  let sum = 348
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += lunarInfo[year - 1900] & i ? 1 : 0
  }
  return sum + getLeapMonthDays(year)
}

function getLeapMonth(year) {
  return lunarInfo[year - 1900] & 0xf
}

function getLeapMonthDays(year) {
  if (getLeapMonth(year)) {
    return lunarInfo[year - 1900] & 0x10000 ? 30 : 29
  }
  return 0
}

function solarToLunar(year, month, day) {
  const baseDate = new Date(1900, 0, 31)
  const targetDate = new Date(year, month - 1, day)
  let offset = Math.floor((targetDate - baseDate) / 86400000)

  let lunarYear = 1900
  let yearDays
  while (lunarYear < 2100 && offset > 0) {
    yearDays = getLunarYearDays(lunarYear)
    if (offset < yearDays) {
      break
    }
    offset -= yearDays
    lunarYear++
  }

  const leapMonth = getLeapMonth(lunarYear)
  let isLeap = false
  let lunarMonth = 1
  let monthDays

  for (let i = 1; i <= 12; i++) {
    if (leapMonth > 0 && i === leapMonth + 1 && !isLeap) {
      --i
      isLeap = true
      monthDays = getLeapMonthDays(lunarYear)
    } else {
      monthDays = getLunarMonthDays(lunarYear, i)
    }

    if (offset < monthDays) {
      lunarMonth = i
      break
    }
    offset -= monthDays

    if (isLeap && i === leapMonth + 1) {
      isLeap = false
    }
  }

  const lunarDay = offset + 1
  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap: isLeap,
    monthName: lunarMonthNames[lunarMonth - 1],
    dayName: lunarDayNames[lunarDay - 1],
  }
}

// ========== 时间显示 ==========
function updateTime() {
  const now = new Date()
  const timeEl = document.getElementById('time')
  const dateEl = document.getElementById('date')

  // 时间
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  timeEl.textContent = `${hours}:${minutes}`

  // 日期
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const weekday = weekdays[now.getDay()]

  // 农历
  const lunar = solarToLunar(year, month, day)
  const lunarStr = `农历${lunar.monthName}月${lunar.dayName}`

  dateEl.textContent = `${year}年${month}月${day}日 ${weekday} ${lunarStr}`
}

// 初始化时间并每秒更新
updateTime()
setInterval(updateTime, 1000)

// ========== 搜索功能 ==========
const searchInput = document.getElementById('searchInput')
let searchHistoryTimeout = null

searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim()
    if (query) {
      // 记录搜索历史
      if (typeof SearchHistory !== 'undefined') {
        SearchHistory.add(query)
      }
      // 判断是否为URL
      if (query.match(/^https?:\/\//i) || query.match(/^[\w.-]+\.[a-z]{2,}/i)) {
        let url = query
        if (!url.match(/^https?:\/\//i)) {
          url = 'https://' + url
        }
        window.location.href = url
      } else {
        // 使用用户选择的搜索引擎
        const settings = getSettings()
        const engine = SEARCH_ENGINES[settings.searchEngine] || SEARCH_ENGINES.baidu
        window.location.href = `${engine.url}${encodeURIComponent(query)}`
      }
    }
  }
})

// 历史记录搜索功能
searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim().toLowerCase()

  // 防抖处理
  clearTimeout(searchHistoryTimeout)
  searchHistoryTimeout = setTimeout(() => {
    if (query.length >= 2) {
      searchHistory(query)
    } else {
      // 恢复正常历史记录显示
      loadHistory()
    }
  }, 300)
})

// 搜索历史记录
async function searchHistory(query) {
  try {
    const historyItems = await chrome.history.search({
      text: query,
      maxResults: 50,
      startTime: Date.now() - 30 * 24 * 60 * 60 * 1000, // 最近30天
    })

    if (historyItems.length === 0) {
      historyContainer.innerHTML = `<div class="history-empty">未找到包含 "${escapeHtml(query)}" 的记录</div>`
      return
    }

    // 渲染搜索结果
    const results = historyItems.slice(0, 20).map((item) => ({
      url: item.url,
      title: getPageTitle(item.url, item.title),
      lastVisitTime: item.lastVisitTime,
    }))

    // 按域名分组
    const domainMap = new Map()
    results.forEach((item) => {
      try {
        const domain = new URL(item.url).hostname
        if (!domainMap.has(domain)) {
          domainMap.set(domain, { domain, urls: [] })
        }
        domainMap.get(domain).urls.push(item)
      } catch (e) {}
    })

    renderHistory(Array.from(domainMap.values()))
  } catch (error) {
    console.error('搜索历史记录失败:', error)
    historyContainer.innerHTML = '<div class="history-empty">搜索失败</div>'
  }
}

// ========== 快捷方式管理 ==========
const quickLinksContainer = document.getElementById('quickLinks')
const STORAGE_KEY = 'quickLinks'

// 默认快捷方式（始终存在）
const DEFAULT_LINKS = [
  { title: 'Google', url: 'https://www.google.com', icon: '🔍', favicon: '' },
  { title: '百度', url: 'https://www.baidu.com', icon: '🔎', favicon: '' },
  { title: 'GitHub', url: 'https://github.com', icon: '🐱', favicon: '' },
  { title: 'B站', url: 'https://www.bilibili.com', icon: '📺', favicon: '' },
  { title: '知乎', url: 'https://www.zhihu.com', icon: '🧠', favicon: '' },
  { title: '掘金', url: 'https://juejin.cn', icon: '💎', favicon: '' },
]

// 获取保存的快捷方式（优先从 chrome.storage.local 读取）
function getQuickLinks(callback) {
  chrome.storage.local.get(['quickLinks'], (result) => {
    if (result.quickLinks && result.quickLinks.length > 0) {
      callback(result.quickLinks)
    } else {
      // 从 localStorage 读取（兼容旧数据）
      const localLinks = localStorage.getItem(STORAGE_KEY)
      callback(localLinks ? JSON.parse(localLinks) : null)
    }
  })
}

// 保存快捷方式（同时保存到 chrome.storage.local 和 localStorage）
function saveQuickLinks(links) {
  const trimmedLinks = links.slice(0, 20)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLinks))
  chrome.storage.local.set({ quickLinks: trimmedLinks })
}

// 创建快捷方式元素
function createQuickLink(link) {
  const linkEl = document.createElement('a')
  linkEl.className = 'quick-link'
  linkEl.href = link.url

  // 如果有 favicon，优先使用，否则使用 emoji 图标
  if (link.favicon) {
    linkEl.innerHTML = `
      <div class="quick-link-icon" style="background: #fff; overflow: hidden;">
        <img src="${link.favicon}" style="width: 100%; height: 100%; object-fit: contain;">
        <span style="display:none;">${link.icon}</span>
      </div>
      <span class="quick-link-title">${link.title}</span>
    `
    // CSP 要求：不能使用内联 onerror，改为事件监听
    const img = linkEl.querySelector('.quick-link-icon img')
    if (img) {
      img.addEventListener('error', function () {
        this.style.display = 'none'
        this.nextElementSibling.style.display = 'flex'
      })
    }
  } else {
    linkEl.innerHTML = `
      <div class="quick-link-icon">${link.icon}</div>
      <span class="quick-link-title">${link.title}</span>
    `
  }

  // 右键删除
  linkEl.addEventListener('contextmenu', (e) => {
    e.preventDefault()
    if (confirm(`确定要删除 "${link.title}" 吗？`)) {
      linkEl.remove()
      updateQuickLinksFromDOM()
    }
  })

  return linkEl
}

// 从DOM更新快捷方式存储
function updateQuickLinksFromDOM() {
  const links = []
  const defaultUrls = new Set(DEFAULT_LINKS.map((l) => l.url))
  const seenUrls = new Set() // 防止用户添加的重复

  document.querySelectorAll('.quick-link').forEach((el) => {
    const url = el.href
    const title = el.querySelector('.quick-link-title').textContent
    const iconEl = el.querySelector('.quick-link-icon')
    const icon = iconEl.querySelector('span')
      ? iconEl.querySelector('span').textContent
      : iconEl.textContent.trim().substring(0, 2)

    // 只保存非默认的快捷方式，且不重复
    if (!defaultUrls.has(url) && !seenUrls.has(url)) {
      links.push({
        title,
        url,
        icon: icon || '🌐',
      })
      seenUrls.add(url)
    }
  })

  saveQuickLinks(links)
}

// 加载保存的快捷方式
function loadQuickLinks() {
  getQuickLinks((links) => {
    const addBtn = document.getElementById('addLinkBtn')
    quickLinksContainer.innerHTML = ''

    // 用于去重的 Set（记录已渲染的 URL）
    const renderedUrls = new Set()

    // 始终显示默认图标
    DEFAULT_LINKS.forEach((link) => {
      if (!renderedUrls.has(link.url)) {
        const el = createQuickLink(link)
        el.dataset.isDefault = 'true' // 标记为默认
        quickLinksContainer.appendChild(el)
        renderedUrls.add(link.url)
      }
    })

    // 添加用户保存的图标（排除默认链接和重复）
    if (links && links.length > 0) {
      const defaultUrls = new Set(DEFAULT_LINKS.map((l) => l.url))
      links.forEach((link) => {
        // 跳过默认链接和已渲染的 URL
        if (!defaultUrls.has(link.url) && !renderedUrls.has(link.url)) {
          quickLinksContainer.appendChild(createQuickLink(link))
          renderedUrls.add(link.url)
        }
      })
    }

    quickLinksContainer.appendChild(addBtn)
  })
}

// 添加新快捷方式
document.getElementById('addLinkBtn').addEventListener('click', () => {
  const title = prompt('请输入网站名称:')
  if (!title) {
    return
  }

  const url = prompt('请输入网站URL:')
  if (!url) {
    return
  }

  const iconOptions = ['🌐', '🔗', '📌', '⭐', '🚀', '💡', '🎯', '📱', '💻', '🎨']
  const icon = iconOptions[Math.floor(Math.random() * iconOptions.length)]

  // 尝试获取 favicon
  let favicon = ''
  try {
    const urlObj = new URL(url)
    favicon = `${urlObj.origin}/favicon.ico`
  } catch (e) {}

  const newLink = { title, url, icon, favicon }
  const linkEl = createQuickLink(newLink)

  // 插入到添加按钮之前
  const addBtn = document.getElementById('addLinkBtn')
  quickLinksContainer.insertBefore(linkEl, addBtn)

  updateQuickLinksFromDOM()
})

// ========== 初始化 ==========
// 页面加载时加载快捷方式和设置
initQuickLinks()
loadQuickLinks()
initSettings()

// 聚焦搜索框
searchInput.focus()

// 初始化快捷方式（首次时保存默认图标到 storage）
function initQuickLinks() {
  chrome.storage.local.get(['quickLinks'], (result) => {
    if (!result.quickLinks || result.quickLinks.length === 0) {
      // 首次加载，不保存默认图标到 storage
      // 默认图标始终存在，不需要保存
      console.log('[Newtab] 使用默认快捷方式')
    }
  })
}

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K 或 / 聚焦搜索框
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault()
    searchInput.focus()
    searchInput.select()
  }
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault()
    searchInput.focus()
  }
})

// ========== 统一搜索功能 ==========
const unifiedSearchInput = document.getElementById('unifiedSearchInput')
const unifiedResults = document.getElementById('unifiedResults')
const searchSuggestions = document.getElementById('searchSuggestions')
let unifiedSearchTimeout = null

// 统一搜索输入处理
if (unifiedSearchInput) {
  unifiedSearchInput.addEventListener('input', () => {
    const query = unifiedSearchInput.value.trim()
    clearTimeout(unifiedSearchTimeout)

    unifiedSearchTimeout = setTimeout(async () => {
      if (query.length >= 2) {
        // 显示搜索建议
        if (typeof SearchHistory !== 'undefined') {
          const suggestions = await SearchHistory.getSuggestions(query, 5)
          renderSuggestions(suggestions)
        }
        // 执行统一搜索
        performUnifiedSearch(query)
      } else {
        searchSuggestions.classList.remove('show')
        unifiedResults.innerHTML = '<div class="unified-results-empty">输入关键词开始搜索</div>'
      }
    }, 300)
  })

  // Enter键执行搜索
  unifiedSearchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const query = unifiedSearchInput.value.trim()
      if (query.length >= 2) {
        performUnifiedSearch(query)
        searchSuggestions.classList.remove('show')
      }
    }
  })

  // 聚焦时显示历史建议
  unifiedSearchInput.addEventListener('focus', async () => {
    if (unifiedSearchInput.value.trim().length === 0) {
      if (typeof SearchHistory !== 'undefined') {
        const recent = await SearchHistory.getRecent(5)
        renderRecentSearches(recent)
      }
    }
  })

  // 失焦隐藏建议
  unifiedSearchInput.addEventListener('blur', () => {
    setTimeout(() => searchSuggestions.classList.remove('show'), 200)
  })
}

// 渲染搜索建议
function renderSuggestions(suggestions) {
  if (!suggestions || suggestions.length === 0) {
    searchSuggestions.classList.remove('show')
    return
  }

  searchSuggestions.innerHTML = suggestions
    .map(
      (s) => `
    <div class="suggestion-item" data-query="${escapeHtml(s.query)}">
      <span class="suggestion-icon">🔍</span>
      <span>${escapeHtml(s.query)}</span>
      <span class="suggestion-count">${s.count}次</span>
    </div>
  `
    )
    .join('')

  searchSuggestions.classList.add('show')

  // 点击建议
  searchSuggestions.querySelectorAll('.suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      unifiedSearchInput.value = item.dataset.query
      performUnifiedSearch(item.dataset.query)
      searchSuggestions.classList.remove('show')
    })
  })
}

// 渲染最近搜索
function renderRecentSearches(recent) {
  if (!recent || recent.length === 0) {
    searchSuggestions.classList.remove('show')
    return
  }

  searchSuggestions.innerHTML = recent
    .map(
      (s) => `
    <div class="suggestion-item" data-query="${escapeHtml(s.query)}">
      <span class="suggestion-icon">🕐</span>
      <span>${escapeHtml(s.query)}</span>
      <span class="suggestion-count">${s.count}次</span>
    </div>
  `
    )
    .join('')

  searchSuggestions.classList.add('show')

  searchSuggestions.querySelectorAll('.suggestion-item').forEach((item) => {
    item.addEventListener('click', () => {
      unifiedSearchInput.value = item.dataset.query
      performUnifiedSearch(item.dataset.query)
      searchSuggestions.classList.remove('show')
    })
  })
}

// 执行统一搜索
async function performUnifiedSearch(query) {
  if (typeof UnifiedSearch === 'undefined') {
    unifiedResults.innerHTML = '<div class="unified-results-empty">搜索模块未加载</div>'
    return
  }

  unifiedResults.innerHTML = '<div class="unified-results-empty">搜索中...</div>'

  // 获取选中的搜索源
  const sources = []
  document.querySelectorAll('[data-source]').forEach((cb) => {
    if (cb.checked) {
      sources.push(cb.dataset.source)
    }
  })

  const results = await UnifiedSearch.search(query, { sources, limit: 10 })
  renderUnifiedResults(results, query)
}

// 渲染统一搜索结果
function renderUnifiedResults(results, query) {
  const totalCount = UnifiedSearch.getTotalCount(results)

  if (totalCount === 0) {
    unifiedResults.innerHTML = `<div class="unified-results-empty">未找到包含 "${escapeHtml(query)}" 的结果</div>`
    return
  }

  let html = ''

  // 历史记录结果
  if (results.history && results.history.length > 0) {
    html += `
      <div class="unified-result-section">
        <div class="unified-result-header">
          <span>🕐</span>
          <span>历史记录</span>
          <span class="unified-result-count">${results.history.length}</span>
        </div>
        ${results.history
          .map(
            (item) => `
          <a href="${escapeHtml(item.url)}" class="unified-result-item" target="_blank">
            <div class="unified-result-icon">${createDomainIcon(item.domain)}</div>
            <div class="unified-result-info">
              <div class="unified-result-title">${escapeHtml(item.title)}</div>
              <div class="unified-result-meta">${escapeHtml(item.domain)} · ${formatTime(item.lastVisitTime)}</div>
            </div>
            <span class="unified-result-badge">${item.visitCount || 0}次</span>
          </a>
        `
          )
          .join('')}
      </div>
    `
  }

  // 书签结果
  if (results.bookmarks && results.bookmarks.length > 0) {
    html += `
      <div class="unified-result-section">
        <div class="unified-result-header">
          <span>📌</span>
          <span>书签</span>
          <span class="unified-result-count">${results.bookmarks.length}</span>
        </div>
        ${results.bookmarks
          .map(
            (item) => `
          <a href="${escapeHtml(item.url)}" class="unified-result-item" target="_blank">
            <div class="unified-result-icon">${createDomainIcon(item.domain)}</div>
            <div class="unified-result-info">
              <div class="unified-result-title">${escapeHtml(item.title)}</div>
              <div class="unified-result-meta">${escapeHtml(item.domain)}</div>
            </div>
          </a>
        `
          )
          .join('')}
      </div>
    `
  }

  // 下载结果
  if (results.downloads && results.downloads.length > 0) {
    html += `
      <div class="unified-result-section">
        <div class="unified-result-header">
          <span>📥</span>
          <span>下载</span>
          <span class="unified-result-count">${results.downloads.length}</span>
        </div>
        ${results.downloads
          .map(
            (item) => `
          <div class="unified-result-item" data-download-id="${item.id}">
            <div class="unified-result-icon">${item.icon || '📎'}</div>
            <div class="unified-result-info">
              <div class="unified-result-title">${escapeHtml(item.filename.split('/').pop())}</div>
              <div class="unified-result-meta">${DownloadsSearch ? DownloadsSearch.formatSize(item.fileSize) : ''} · ${DownloadsSearch ? DownloadsSearch.formatState(item.state).text : item.state}</div>
            </div>
            <span class="unified-result-badge">${item.state}</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  // 标签页结果
  if (results.tabs && results.tabs.length > 0) {
    html += `
      <div class="unified-result-section">
        <div class="unified-result-header">
          <span>📑</span>
          <span>标签页</span>
          <span class="unified-result-count">${results.tabs.length}</span>
        </div>
        ${results.tabs
          .map(
            (item) => `
          <div class="unified-result-item" data-tab-id="${item.tabId}">
            <div class="unified-result-icon">${item.favIconUrl ? `<img src="${escapeHtml(item.favIconUrl)}" style="width:16px;height:16px;">` : '🌐'}</div>
            <div class="unified-result-info">
              <div class="unified-result-title">${escapeHtml(item.title)}</div>
              <div class="unified-result-meta">${escapeHtml(item.domain)} · ${item.matchCount}处匹配</div>
            </div>
            <span class="unified-result-badge">打开</span>
          </div>
        `
          )
          .join('')}
      </div>
    `
  }

  unifiedResults.innerHTML = html

  // 绑定下载项点击
  unifiedResults.querySelectorAll('[data-download-id]').forEach((item) => {
    item.addEventListener('click', async () => {
      const id = parseInt(item.dataset.downloadId)
      if (DownloadsSearch) {
        await DownloadsSearch.show(id)
      }
    })
  })

  // 绑定标签页点击
  unifiedResults.querySelectorAll('[data-tab-id]').forEach((item) => {
    item.addEventListener('click', async () => {
      const tabId = parseInt(item.dataset.tabId)
      if (TabContentSearch) {
        await TabContentSearch.goToTab(tabId)
        await TabContentSearch.highlight(tabId, query)
      }
    })
  })
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) {
    return ''
  }
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now - date
  const days = Math.floor(diff / (24 * 60 * 60 * 1000))

  if (days === 0) {
    return '今天'
  }
  if (days === 1) {
    return '昨天'
  }
  if (days < 7) {
    return `${days}天前`
  }
  if (days < 30) {
    return `${Math.floor(days / 7)}周前`
  }
  return `${Math.floor(days / 30)}月前`
}

// ========== Tab 切换 ==========
const tabBtns = document.querySelectorAll('.tab-btn')
const tabContents = document.querySelectorAll('.tab-content')

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const tabId = btn.dataset.tab

    // 切换按钮状态
    tabBtns.forEach((b) => b.classList.remove('active'))
    btn.classList.add('active')

    // 切换内容
    tabContents.forEach((content) => {
      content.classList.remove('active')
      if (content.id === `tab-${tabId}`) {
        content.classList.add('active')
      }
    })
  })
})

// ========== 学习资源管理 ==========
const LEARN_RESOURCES_KEY = 'learnResources'
const DEFAULT_LEARN_CATEGORIES = [
  {
    id: 'plc',
    name: 'PLC/工控',
    icon: '🏭',
    links: [
      { name: '西门子工业支持', url: 'https://support.industry.siemens.com/', favicon: '' },
      { name: '三菱电机自动化', url: 'https://www.mitsubishielectric.com.cn/afa/', favicon: '' },
      { name: '欧姆龙自动化', url: 'https://www.omron.com.cn/', favicon: '' },
      { name: '工控论坛', url: 'https://www.gkong.com/', favicon: '' },
      { name: '中华工控网', url: 'https://www.gongkong.com/', favicon: '' },
      { name: 'PLC之家', url: 'https://www.plc100.com/', favicon: '' },
      { name: '台达电子', url: 'https://www.deltaww.com/', favicon: '' },
      { name: 'ABB机器人', url: 'https://new.abb.com/products/robotics', favicon: '' },
    ],
  },
  {
    id: 'programming',
    name: '编程学习',
    icon: '💻',
    links: [
      { name: 'MDN Web Docs', url: 'https://developer.mozilla.org/', favicon: '' },
      { name: 'LeetCode', url: 'https://leetcode.cn/', favicon: '' },
      { name: '掘金', url: 'https://juejin.cn/', favicon: '' },
      { name: 'Stack Overflow', url: 'https://stackoverflow.com/', favicon: '' },
      { name: 'GitHub', url: 'https://github.com/', favicon: '' },
      { name: 'Gitee', url: 'https://gitee.com/', favicon: '' },
      { name: '菜鸟教程', url: 'https://www.runoob.com/', favicon: '' },
      { name: 'W3Schools', url: 'https://www.w3schools.com/', favicon: '' },
      { name: '力扣中国', url: 'https://leetcode.cn/', favicon: '' },
      { name: '牛客网', url: 'https://www.nowcoder.com/', favicon: '' },
    ],
  },
  {
    id: 'ai',
    name: 'AI/机器学习',
    icon: '🤖',
    links: [
      { name: 'OpenAI', url: 'https://openai.com/', favicon: '' },
      { name: 'Hugging Face', url: 'https://huggingface.co/', favicon: '' },
      { name: 'Kaggle', url: 'https://www.kaggle.com/', favicon: '' },
      { name: 'Papers With Code', url: 'https://paperswithcode.com/', favicon: '' },
      { name: 'TensorFlow', url: 'https://www.tensorflow.org/', favicon: '' },
      { name: 'PyTorch', url: 'https://pytorch.org/', favicon: '' },
      { name: '飞桨PaddlePaddle', url: 'https://www.paddlepaddle.org.cn/', favicon: '' },
      { name: 'ModelScope魔搭', url: 'https://modelscope.cn/', favicon: '' },
    ],
  },
  {
    id: 'design',
    name: '设计/创意',
    icon: '🎨',
    links: [
      { name: 'Figma', url: 'https://www.figma.com/', favicon: '' },
      { name: 'Dribbble', url: 'https://dribbble.com/', favicon: '' },
      { name: 'Behance', url: 'https://www.behance.net/', favicon: '' },
      { name: '站酷', url: 'https://www.zcool.com.cn/', favicon: '' },
      { name: '花瓣网', url: 'https://huaban.com/', favicon: '' },
      { name: 'Pinterest', url: 'https://www.pinterest.com/', favicon: '' },
      { name: 'Unsplash', url: 'https://unsplash.com/', favicon: '' },
      { name: 'iconfont', url: 'https://www.iconfont.cn/', favicon: '' },
    ],
  },
  {
    id: 'language',
    name: '语言学习',
    icon: '🌍',
    links: [
      { name: '多邻国', url: 'https://www.duolingo.com/', favicon: '' },
      { name: '百词斩', url: 'https://www.baicizhan.com/', favicon: '' },
      { name: '扇贝单词', url: 'https://www.shanbay.com/', favicon: '' },
      { name: '流利说', url: 'https://www.liulishuo.com/', favicon: '' },
      { name: 'TED', url: 'https://www.ted.com/', favicon: '' },
      { name: 'BBC Learning', url: 'https://www.bbc.co.uk/learningenglish/', favicon: '' },
      { name: '沪江英语', url: 'https://www.hjenglish.com/', favicon: '' },
      { name: '每日英语听力', url: 'https://dict.eudic.net/', favicon: '' },
    ],
  },
  {
    id: 'exam',
    name: '考试认证',
    icon: '📜',
    links: [
      { name: '中国教育考试网', url: 'https://www.neea.edu.cn/', favicon: '' },
      { name: '学信网', url: 'https://www.chsi.com.cn/', favicon: '' },
      { name: '研招网', url: 'https://yz.chsi.com.cn/', favicon: '' },
      { name: '软考网', url: 'https://www.ruankao.org.cn/', favicon: '' },
      { name: 'PMP中国', url: 'https://www.pmi.org/', favicon: '' },
      { name: '中国大学MOOC', url: 'https://www.icourse163.org/', favicon: '' },
      { name: '公务员考试网', url: 'http://www.chinagwy.org/', favicon: '' },
      { name: '注协网', url: 'https://www.cicpa.org.cn/', favicon: '' },
    ],
  },
  {
    id: 'video',
    name: '视频教程',
    icon: '📺',
    links: [
      { name: 'B站', url: 'https://www.bilibili.com/', favicon: '' },
      { name: 'YouTube', url: 'https://www.youtube.com/', favicon: '' },
      { name: '慕课网', url: 'https://www.imooc.com/', favicon: '' },
      { name: '网易云课堂', url: 'https://study.163.com/', favicon: '' },
      { name: '腾讯课堂', url: 'https://ke.qq.com/', favicon: '' },
      { name: '学堂在线', url: 'https://www.xuetangx.com/', favicon: '' },
      { name: 'Coursera', url: 'https://www.coursera.org/', favicon: '' },
      { name: 'Udemy', url: 'https://www.udemy.com/', favicon: '' },
    ],
  },
  {
    id: 'electronics',
    name: '电子/硬件',
    icon: '🔧',
    links: [
      { name: '立创EDA', url: 'https://lceda.cn/', favicon: '' },
      { name: '嘉立创', url: 'https://www.jlc.com/', favicon: '' },
      { name: '得捷电子', url: 'https://www.digikey.com/', favicon: '' },
      { name: '贸泽电子', url: 'https://www.mouser.com/', favicon: '' },
      { name: 'EEWorld', url: 'https://www.eeworld.com.cn/', favicon: '' },
      { name: '电子发烧友', url: 'https://www.elecfans.com/', favicon: '' },
      { name: '21ic电子网', url: 'https://www.21ic.com/', favicon: '' },
      { name: 'Arduino', url: 'https://www.arduino.cc/', favicon: '' },
    ],
  },
  {
    id: 'data',
    name: '数据分析',
    icon: '📊',
    links: [
      { name: 'Kaggle', url: 'https://www.kaggle.com/', favicon: '' },
      { name: '天池', url: 'https://tianchi.aliyun.com/', favicon: '' },
      { name: '和鲸社区', url: 'https://www.heywhale.com/', favicon: '' },
      { name: 'DataCamp', url: 'https://www.datacamp.com/', favicon: '' },
      { name: 'Tableau', url: 'https://www.tableau.com/', favicon: '' },
      { name: 'Power BI', url: 'https://powerbi.microsoft.com/', favicon: '' },
      { name: '国家统计局', url: 'http://www.stats.gov.cn/', favicon: '' },
      { name: '世界银行数据', url: 'https://data.worldbank.org/', favicon: '' },
    ],
  },
  {
    id: 'devops',
    name: '运维/DevOps',
    icon: '⚙️',
    links: [
      { name: 'Docker Hub', url: 'https://hub.docker.com/', favicon: '' },
      { name: 'Kubernetes', url: 'https://kubernetes.io/', favicon: '' },
      { name: 'Jenkins', url: 'https://www.jenkins.io/', favicon: '' },
      { name: '阿里云', url: 'https://www.aliyun.com/', favicon: '' },
      { name: '腾讯云', url: 'https://cloud.tencent.com/', favicon: '' },
      { name: '华为云', url: 'https://www.huaweicloud.com/', favicon: '' },
      { name: 'AWS', url: 'https://aws.amazon.com/', favicon: '' },
      { name: 'Linux命令大全', url: 'https://www.linuxcool.com/', favicon: '' },
    ],
  },
  {
    id: 'product',
    name: '产品/运营',
    icon: '📱',
    links: [
      { name: '人人都是产品经理', url: 'https://www.woshipm.com/', favicon: '' },
      { name: '产品壹佰', url: 'https://www.chanpin100.com/', favicon: '' },
      { name: '鸟哥笔记', url: 'https://www.niaogebiji.com/', favicon: '' },
      { name: '运营派', url: 'https://www.yunyingpai.com/', favicon: '' },
      { name: '增长黑客', url: 'https://growthbox.net/', favicon: '' },
      { name: 'PMCAFF', url: 'https://www.pmcaff.com/', favicon: '' },
      { name: '36氪', url: 'https://36kr.com/', favicon: '' },
      { name: '虎嗅', url: 'https://www.huxiu.com/', favicon: '' },
    ],
  },
  {
    id: 'self-improvement',
    name: '个人提升',
    icon: '📈',
    links: [
      { name: '知乎', url: 'https://www.zhihu.com/', favicon: '' },
      { name: '少数派', url: 'https://sspai.com/', favicon: '' },
      { name: '即刻', url: 'https://okjike.com/', favicon: '' },
      { name: '豆瓣', url: 'https://www.douban.com/', favicon: '' },
      { name: '微信读书', url: 'https://weread.qq.com/', favicon: '' },
      { name: '得到', url: 'https://www.dedao.cn/', favicon: '' },
      { name: 'Notion', url: 'https://www.notion.so/', favicon: '' },
      { name: 'flomo浮墨', url: 'https://flomoapp.com/', favicon: '' },
    ],
  },
]

// 获取学习资源
function getLearnResources(callback) {
  chrome.storage.local.get([LEARN_RESOURCES_KEY], (result) => {
    if (result[LEARN_RESOURCES_KEY] && result[LEARN_RESOURCES_KEY].length > 0) {
      callback(result[LEARN_RESOURCES_KEY])
    } else {
      callback(DEFAULT_LEARN_CATEGORIES)
    }
  })
}

// 保存学习资源
function saveLearnResources(categories) {
  chrome.storage.local.set({ [LEARN_RESOURCES_KEY]: categories })
}

// 获取 favicon URL
function getFaviconUrl(url) {
  try {
    const urlObj = new URL(url)
    return `${urlObj.origin}/favicon.ico`
  } catch (e) {
    return ''
  }
}

// 渲染学习资源
function renderLearnResources(categories) {
  const learnSection = document.getElementById('learnSection')

  if (!categories || categories.length === 0) {
    learnSection.innerHTML = `
      <div class="learn-empty">
        <div class="learn-empty-icon">📚</div>
        <div class="learn-empty-text">暂无学习资源，点击下方添加分类</div>
      </div>
    `
    return
  }

  learnSection.innerHTML = categories
    .map(
      (category) => `
    <div class="learn-category" data-id="${escapeHtml(category.id)}">
      <div class="learn-category-header">
        <div class="learn-category-title">
          <span class="learn-category-icon">${category.icon}</span>
          <span>${escapeHtml(category.name)}</span>
        </div>
        <div class="learn-category-actions">
          <button class="learn-category-btn" data-action="add-link" data-category="${escapeHtml(category.id)}">添加链接</button>
          <button class="learn-category-btn delete" data-action="delete-category" data-category="${escapeHtml(category.id)}">删除分类</button>
        </div>
      </div>
      <div class="learn-links-grid">
        ${category.links
          .map(
            (link, index) => `
          <a href="${escapeHtml(link.url)}" target="_blank" class="learn-link-item" data-category="${escapeHtml(category.id)}" data-index="${index}">
            <img src="${escapeHtml(link.favicon || getFaviconUrl(link.url))}" class="learn-link-favicon" alt="">
            <div class="learn-link-info">
              <div class="learn-link-name">${escapeHtml(link.name)}</div>
              <div class="learn-link-url">${escapeHtml(safeHostname(link.url))}</div>
            </div>
            <button class="learn-link-delete" data-action="delete-link" data-category="${escapeHtml(category.id)}" data-index="${index}">✕</button>
          </a>
        `
          )
          .join('')}
      </div>
    </div>
  `
    )
    .join('')

  // 绑定事件
  bindLearnEvents()
}

// 绑定学习资源事件
function bindLearnEvents() {
  // 删除链接
  document.querySelectorAll('[data-action="delete-link"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      e.stopPropagation()
      const categoryId = btn.dataset.category
      const index = parseInt(btn.dataset.index)

      getLearnResources((categories) => {
        const category = categories.find((c) => c.id === categoryId)
        if (category) {
          category.links.splice(index, 1)
          saveLearnResources(categories)
          renderLearnResources(categories)
        }
      })
    })
  })

  // 添加链接
  document.querySelectorAll('[data-action="add-link"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const categoryId = btn.dataset.category
      showAddLinkModal(categoryId)
    })
  })

  // 删除分类
  document.querySelectorAll('[data-action="delete-category"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const categoryId = btn.dataset.category
      if (confirm('确定要删除该分类吗？')) {
        getLearnResources((categories) => {
          categories = categories.filter((c) => c.id !== categoryId)
          saveLearnResources(categories)
          renderLearnResources(categories)
        })
      }
    })
  })

  // CSP 要求：图片加载失败时显示默认图标
  document.querySelectorAll('.learn-link-favicon').forEach((img) => {
    img.addEventListener('error', function () {
      this.src =
        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='80'>🔗</text></svg>"
    })
  })
}

// 模态框操作
const modalOverlay = document.getElementById('modalOverlay')
const modalTitle = document.getElementById('modalTitle')
const modalInput1 = document.getElementById('modalInput1')
const modalInput2 = document.getElementById('modalInput2')
const modalInput3 = document.getElementById('modalInput3')
const modalCancel = document.getElementById('modalCancel')
const modalConfirm = document.getElementById('modalConfirm')

let currentModalAction = null
let currentModalData = null

function showModal(
  title,
  input1Placeholder,
  input2Placeholder,
  input3Placeholder = '',
  action,
  data = null
) {
  modalTitle.textContent = title
  modalInput1.placeholder = input1Placeholder
  modalInput2.placeholder = input2Placeholder
  modalInput3.placeholder = input3Placeholder
  modalInput3.style.display = input3Placeholder ? 'block' : 'none'

  modalInput1.value = ''
  modalInput2.value = ''
  modalInput3.value = ''

  currentModalAction = action
  currentModalData = data

  modalOverlay.classList.add('open')
  modalInput1.focus()
}

function hideModal() {
  modalOverlay.classList.remove('open')
  currentModalAction = null
  currentModalData = null
}

modalCancel.addEventListener('click', hideModal)
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) {
    hideModal()
  }
})

// 添加分类
document.getElementById('addCategoryBtn').addEventListener('click', () => {
  showModal('添加分类', '分类名称', '分类图标（emoji）', '', 'add-category')
})

// 添加链接
function showAddLinkModal(categoryId) {
  showModal('添加链接', '链接名称', '链接URL', '', 'add-link', { categoryId })
}

// 确认操作
modalConfirm.addEventListener('click', () => {
  const value1 = modalInput1.value.trim()
  const value2 = modalInput2.value.trim()

  if (!value1 || !value2) {
    alert('请填写必要信息')
    return
  }

  if (currentModalAction === 'add-category') {
    getLearnResources((categories) => {
      const newCategory = {
        id: Date.now().toString(),
        name: value1,
        icon: value2 || '📁',
        links: [],
      }
      categories.push(newCategory)
      saveLearnResources(categories)
      renderLearnResources(categories)
      hideModal()
    })
  } else if (currentModalAction === 'add-link') {
    let url = value2
    if (!url.match(/^https?:\/\//i)) {
      url = 'https://' + url
    }

    getLearnResources((categories) => {
      const category = categories.find((c) => c.id === currentModalData.categoryId)
      if (category) {
        category.links.push({
          name: value1,
          url: url,
          favicon: getFaviconUrl(url),
        })
        saveLearnResources(categories)
        renderLearnResources(categories)
      }
      hideModal()
    })
  }
})

// Enter 键确认
modalInput1.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    modalInput2.focus()
  }
})
modalInput2.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    if (modalInput3.style.display !== 'none') {
      modalInput3.focus()
    } else {
      modalConfirm.click()
    }
  }
})
modalInput3.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    modalConfirm.click()
  }
})

// 加载学习资源
function loadLearnResources() {
  getLearnResources((categories) => {
    renderLearnResources(categories)
  })
}

// 初始化学习资源
loadLearnResources()

// ========== 从书签导入 ==========
// 递归查找"学习"相关的书签文件夹
function findLearnBookmarkFolders(bookmarks, results = []) {
  for (const bookmark of bookmarks) {
    if (bookmark.children) {
      // 检查文件夹名称是否包含学习相关关键词
      const learnKeywords = [
        '学习',
        '教程',
        '资源',
        '教程',
        '知识',
        'learn',
        'tutorial',
        'study',
        'course',
      ]
      const isLearnFolder = learnKeywords.some((keyword) =>
        bookmark.title.toLowerCase().includes(keyword.toLowerCase())
      )
      if (isLearnFolder) {
        results.push(bookmark)
      }
      // 递归查找子文件夹
      findLearnBookmarkFolders(bookmark.children, results)
    }
  }
  return results
}

// 从书签节点提取链接
function extractLinksFromBookmarkNode(node) {
  const links = []
  if (node.url) {
    links.push({
      name: node.title || new URL(node.url).hostname,
      url: node.url,
      favicon: getFaviconUrl(node.url),
    })
  }
  if (node.children) {
    for (const child of node.children) {
      links.push(...extractLinksFromBookmarkNode(child))
    }
  }
  return links
}

// 从书签导入学习资源
function importFromBookmarks() {
  chrome.bookmarks.getTree((bookmarks) => {
    const learnFolders = findLearnBookmarkFolders(bookmarks)

    if (learnFolders.length === 0) {
      alert(
        '未找到"学习"相关的书签文件夹\n\n请在书签中创建名为"学习"的文件夹，或将已有文件夹重命名包含"学习"、"教程"、"资源"等关键词'
      )
      return
    }

    // 获取所有学习文件夹中的链接
    const folderData = learnFolders
      .map((folder) => ({
        id: folder.id,
        title: folder.title,
        links: extractLinksFromBookmarkNode(folder),
      }))
      .filter((f) => f.links.length > 0)

    if (folderData.length === 0) {
      alert('学习文件夹中没有找到链接')
      return
    }

    // 显示导入确认
    const totalLinks = folderData.reduce((sum, f) => sum + f.links.length, 0)
    const folderNames = folderData.map((f) => `"${f.title}" (${f.links.length}个)`).join('\n')

    if (!confirm(`找到以下学习文件夹：\n${folderNames}\n\n共 ${totalLinks} 个链接，是否导入？`)) {
      return
    }

    // 导入到学习资源
    getLearnResources((categories) => {
      const existingUrls = new Set()
      categories.forEach((cat) => cat.links.forEach((link) => existingUrls.add(link.url)))

      let importedCount = 0

      folderData.forEach((folder) => {
        // 查找或创建对应分类
        let category = categories.find((c) => c.name === folder.title)
        if (!category) {
          category = {
            id: `bookmark-${folder.id}`,
            name: folder.title,
            icon: '📚',
            links: [],
          }
          categories.push(category)
        }

        // 添加新链接（去重）
        folder.links.forEach((link) => {
          if (!existingUrls.has(link.url)) {
            category.links.push(link)
            existingUrls.add(link.url)
            importedCount++
          }
        })
      })

      saveLearnResources(categories)
      renderLearnResources(categories)
      alert(`成功导入 ${importedCount} 个新链接`)
    })
  })
}

// 绑定导入按钮事件
document.getElementById('importBookmarkBtn').addEventListener('click', importFromBookmarks)

// ========== 空格点击 ==========
// Space短按: 点击鼠标位置元素
// Space长按: 从鼠标位置开始选文本，移动鼠标扩展，松开确认复制
;(function () {
  let mouseX = 0,
    mouseY = 0
  let spaceHeld = false
  let spaceTimer = null
  let spaceDownTime = 0
  let selectAnchor = null
  let selectTooltip = null
  const LONG_PRESS_THRESHOLD = 300

  // 追踪鼠标坐标
  document.addEventListener(
    'mousemove',
    (e) => {
      mouseX = e.clientX
      mouseY = e.clientY
      if (spaceHeld) {
        extendSelectionTo(e.clientX, e.clientY)
      }
    },
    true
  )

  // 判断是否为输入框聚焦
  function isInputFocused() {
    const el = document.activeElement
    if (!el) {
      return false
    }
    const tag = el.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      return true
    }
    if (el.isContentEditable) {
      return true
    }
    if (tag === 'INPUT') {
      const type = (el.type || '').toLowerCase()
      const nonText = [
        'checkbox',
        'radio',
        'submit',
        'button',
        'reset',
        'image',
        'color',
        'range',
        'file',
      ]
      if (nonText.includes(type)) {
        return false
      }
    }
    return false
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key !== ' ') {
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      if (isInputFocused()) {
        return
      }

      e.preventDefault()
      e.stopImmediatePropagation()

      if (!spaceHeld && !spaceTimer) {
        spaceDownTime = Date.now()
        spaceTimer = setTimeout(() => {
          startTextSelection()
          spaceTimer = null
        }, LONG_PRESS_THRESHOLD)
      }
    },
    true
  )

  document.addEventListener(
    'keyup',
    (e) => {
      if (e.key !== ' ') {
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      if (isInputFocused()) {
        return
      }

      e.preventDefault()
      e.stopImmediatePropagation()
      onSpaceUp()
    },
    true
  )

  function onSpaceUp() {
    if (spaceTimer) {
      clearTimeout(spaceTimer)
      spaceTimer = null
      window.getSelection().removeAllRanges()
      doClick()
      return
    }
    if (spaceHeld) {
      spaceHeld = false
      const sel = window.getSelection()
      const text = sel.toString().trim()
      if (text) {
        navigator.clipboard
          .writeText(text)
          .then(() => {
            showHint('已复制 ' + text.length + ' 字')
            setTimeout(hideHint, 1200)
          })
          .catch(() => hideHint())
      } else {
        sel.removeAllRanges()
        hideHint()
      }
      selectAnchor = null
    }
  }

  function doClick() {
    const el = document.elementFromPoint(mouseX, mouseY)
    if (!el) {
      return
    }
    el.dispatchEvent(
      new MouseEvent('mousedown', {
        bubbles: true,
        cancelable: true,
        clientX: mouseX,
        clientY: mouseY,
        button: 0,
        buttons: 1,
      })
    )
    el.dispatchEvent(
      new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        clientX: mouseX,
        clientY: mouseY,
        button: 0,
        buttons: 0,
      })
    )
    el.dispatchEvent(
      new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: mouseX,
        clientY: mouseY,
        button: 0,
        buttons: 0,
      })
    )
  }

  function startTextSelection() {
    const anchor = document.caretRangeFromPoint
      ? document.caretRangeFromPoint(mouseX, mouseY)
      : null
    if (!anchor) {
      return
    }
    spaceHeld = true
    selectAnchor = anchor
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(anchor.cloneRange())
    showHint('Space:按住移动选文本')
  }

  function extendSelectionTo(cx, cy) {
    if (!selectAnchor) {
      return
    }
    const focus = document.caretRangeFromPoint ? document.caretRangeFromPoint(cx, cy) : null
    if (!focus) {
      return
    }
    try {
      const range = document.createRange()
      const cmp = selectAnchor.startContainer.compareDocumentPosition(focus.startContainer)
      if (
        cmp & Node.DOCUMENT_POSITION_FOLLOWING ||
        (!cmp && selectAnchor.startOffset < focus.startOffset)
      ) {
        range.setStart(selectAnchor.startContainer, selectAnchor.startOffset)
        range.setEnd(focus.startContainer, focus.startOffset)
      } else {
        range.setStart(focus.startContainer, focus.startOffset)
        range.setEnd(selectAnchor.startContainer, selectAnchor.startOffset)
      }
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    } catch (_) {}
  }

  function showHint(text) {
    hideHint()
    const tip = document.createElement('div')
    tip.textContent = text
    tip.style.cssText =
      'position:fixed;bottom:12px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.8);color:#fff;padding:4px 12px;border-radius:4px;' +
      'font:12px monospace;z-index:2147483647;pointer-events:none;'
    document.body.appendChild(tip)
    selectTooltip = tip
  }

  function hideHint() {
    if (selectTooltip) {
      selectTooltip.remove()
      selectTooltip = null
    }
  }

  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && spaceHeld) {
        window.getSelection().removeAllRanges()
        spaceHeld = false
        selectAnchor = null
        hideHint()
      }
    },
    true
  )
})()

// ========== AI 聚合问答逻辑 ==========
const aiAggregator = {
  selectedSites: new Set(),
  responses: new Map(), // siteId -> { status, content }
  isRunning: false,
  startTime: null,
}

// 初始化 AI 聚合
function initAIAggregator() {
  const siteSelector = document.getElementById('aiSiteSelector')
  const sendBtn = document.getElementById('aiSendBtn')
  const questionInput = document.getElementById('aiQuestionInput')

  // 加载 AI 网站列表
  loadAISites()

  // 发送按钮点击
  sendBtn.addEventListener('click', () => {
    const question = questionInput.value.trim()
    if (!question) {
      alert('请输入问题')
      return
    }
    if (aiAggregator.selectedSites.size === 0) {
      alert('请选择至少一个 AI')
      return
    }
    sendQuestionToAIs(question)
  })

  // 快捷键: Ctrl+Enter 发送
  questionInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      sendBtn.click()
    }
  })
}

// 加载 AI 网站列表
async function loadAISites() {
  const siteSelector = document.getElementById('aiSiteSelector')

  try {
    console.log('[AI Aggregator] 请求 AI 网站列表...')
    const response = await chrome.runtime.sendMessage({
      type: 'AIAGGREGATOR_GET_SITES',
    })
    console.log('[AI Aggregator] 收到响应:', response)

    if (response && response.success && response.sites) {
      console.log('[AI Aggregator] 网站列表:', response.sites)
      siteSelector.innerHTML = response.sites
        .map(
          (site) => `
        <label class="ai-site-item" data-site-id="${site.id}">
          <input type="checkbox" checked>
          <span>${site.name}</span>
          ${site.options && Object.keys(site.options).length > 0 ? '<button class="ai-site-config-btn" title="配置">⚙️</button>' : ''}
        </label>
      `
        )
        .join('')

      // 默认全选
      response.sites.forEach((site) => aiAggregator.selectedSites.add(site.id))

      // 绑定选择事件
      siteSelector.querySelectorAll('.ai-site-item').forEach((item) => {
        item.addEventListener('click', (e) => {
          if (e.target.classList.contains('ai-site-config-btn')) {
            e.stopPropagation()
            showSiteConfig(item.dataset.siteId)
            return
          }

          const checkbox = item.querySelector('input')
          const siteId = item.dataset.siteId

          if (checkbox.checked) {
            aiAggregator.selectedSites.add(siteId)
            item.classList.add('selected')
          } else {
            aiAggregator.selectedSites.delete(siteId)
            item.classList.remove('selected')
          }
        })

        // 初始状态
        item.classList.add('selected')
      })
    } else {
      console.error('[AI Aggregator] 响应格式错误:', response)
      siteSelector.innerHTML = '<span style="color:red">加载失败，请刷新页面重试</span>'
    }
  } catch (error) {
    console.error('[AI Aggregator] 加载网站列表失败:', error)
    siteSelector.innerHTML = `<span style="color:red">加载失败: ${error.message}</span>`
  }
}

// 发送问题到多个 AI
async function sendQuestionToAIs(question) {
  const sendBtn = document.getElementById('aiSendBtn')
  const questionInput = document.getElementById('aiQuestionInput')
  const statusEl = document.getElementById('aiAggregatorStatus')

  // 禁用输入
  sendBtn.disabled = true
  questionInput.disabled = true
  aiAggregator.isRunning = true
  aiAggregator.startTime = Date.now()

  // 初始化响应卡片
  initResponseCards()

  // 发送到 background
  try {
    await chrome.runtime.sendMessage({
      type: 'AIAGGREGATOR_START',
      question: question,
      selectedSites: Array.from(aiAggregator.selectedSites),
      aggregatorTabId: (await chrome.tabs.getCurrent()).id,
    })

    statusEl.textContent = '正在发送问题...'
  } catch (error) {
    console.error('[AI Aggregator] 发送失败:', error)
    statusEl.textContent = '发送失败: ' + error.message
    resetAggregator()
  }
}

// 初始化响应卡片
function initResponseCards() {
  const grid = document.getElementById('aiResponseGrid')

  grid.innerHTML = Array.from(aiAggregator.selectedSites)
    .map(
      (siteId) => `
    <div class="ai-response-card" data-site-id="${siteId}">
      <div class="ai-response-header">
        <div class="ai-response-title">
          <span class="ai-status-indicator loading"></span>
          <span class="ai-site-name">${getSiteName(siteId)}</span>
        </div>
        <span class="ai-status-text">等待中...</span>
      </div>
      <div class="ai-response-body waiting">
        <span>等待回复...</span>
      </div>
      <div class="ai-response-actions" style="display: none;">
        <button class="ai-action-btn" data-action="copy">📋 复制</button>
        <button class="ai-action-btn" data-action="open">🔗 打开原页</button>
      </div>
    </div>
  `
    )
    .join('')

  // 初始化响应状态
  aiAggregator.responses.clear()
  aiAggregator.selectedSites.forEach((siteId) => {
    aiAggregator.responses.set(siteId, { status: 'pending', content: '' })
  })
}

// 获取网站名称
function getSiteName(siteId) {
  const names = {
    doubao: '豆包',
    tongyi: '通义千问',
    kimi: 'Kimi',
    yiyan: '文心一言',
    chatglm: '智谱清言',
  }
  return names[siteId] || siteId
}

// 更新响应卡片
function updateResponseCard(siteId, data) {
  const card = document.querySelector(`.ai-response-card[data-site-id="${siteId}"]`)
  if (!card) {
    return
  }

  const indicator = card.querySelector('.ai-status-indicator')
  const statusText = card.querySelector('.ai-status-text')
  const body = card.querySelector('.ai-response-body')
  const actions = card.querySelector('.ai-response-actions')

  // 更新状态
  if (data.status) {
    indicator.className = 'ai-status-indicator ' + data.status
    const statusLabels = {
      loading: '加载中...',
      sending: '发送中...',
      responding: '回答中...',
      completed: '已完成',
      error: '失败',
    }
    statusText.textContent = statusLabels[data.status] || data.status
  }

  // 更新内容
  if (data.content) {
    body.classList.remove('waiting', 'error')
    body.innerHTML = formatAIResponse(data.content)
    body.scrollTop = body.scrollHeight

    // 保存内容
    const response = aiAggregator.responses.get(siteId)
    if (response) {
      response.content = data.content
    }
  }

  // 显示操作按钮
  if (data.isComplete) {
    actions.style.display = 'flex'
    indicator.className = 'ai-status-indicator completed'
    statusText.textContent = '已完成'

    // 更新统计
    updateAggregatorStats()
  }

  // 错误处理
  if (data.error) {
    body.classList.remove('waiting')
    body.classList.add('error')
    body.innerHTML = `<span>❌ ${data.message || data.error}</span>`
    indicator.className = 'ai-status-indicator error'
    statusText.textContent = '失败'
  }
}

// 格式化 AI 回复（简单的 Markdown 支持）
function formatAIResponse(content) {
  return content
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /`(.+?)`/g,
      '<code style="background:#f0f0f0;padding:2px 4px;border-radius:3px;">$1</code>'
    )
}

// 更新统计信息
function updateAggregatorStats() {
  const statsEl = document.getElementById('aiAggregatorStats')
  const statusEl = document.getElementById('aiAggregatorStatus')

  let completed = 0
  const total = aiAggregator.responses.size

  aiAggregator.responses.forEach((response) => {
    if (response.status === 'completed' || response.content) {
      completed++
    }
  })

  statsEl.textContent = `${completed}/${total} 已完成`

  if (completed === total) {
    const elapsed = Math.round((Date.now() - aiAggregator.startTime) / 1000)
    statusEl.textContent = `全部完成，用时 ${elapsed} 秒`
    resetAggregator()
  }
}

// 重置聚合器状态
function resetAggregator() {
  aiAggregator.isRunning = false

  const sendBtn = document.getElementById('aiSendBtn')
  const questionInput = document.getElementById('aiQuestionInput')

  sendBtn.disabled = false
  questionInput.disabled = false
}

// 显示网站配置
function showSiteConfig(siteId) {
  // TODO: 实现配置面板
  alert(`配置功能开发中: ${siteId}`)
}

// 监听来自 Background 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AIAGGREGATOR_RESPONSE') {
    updateResponseCard(message.siteId, {
      content: message.content,
      isComplete: message.isComplete,
    })
    sendResponse({ success: true })
    return true
  }

  if (message.type === 'AIAGGREGATOR_STATUS_CHANGE') {
    updateResponseCard(message.siteId, { status: message.status })
    sendResponse({ success: true })
    return true
  }

  if (message.type === 'AIAGGREGATOR_ERROR') {
    updateResponseCard(message.siteId, {
      status: 'error',
      error: message.error,
      message: message.message,
    })
    sendResponse({ success: true })
    return true
  }

  return false
})

// 绑定操作按钮事件
document.addEventListener('click', (e) => {
  if (e.target.dataset.action === 'copy') {
    const card = e.target.closest('.ai-response-card')
    const siteId = card.dataset.siteId
    const response = aiAggregator.responses.get(siteId)
    if (response && response.content) {
      navigator.clipboard.writeText(response.content)
      e.target.textContent = '✅ 已复制'
      setTimeout(() => (e.target.textContent = '📋 复制'), 1500)
    }
  }

  if (e.target.dataset.action === 'open') {
    // TODO: 打开原始 AI 对话页面
  }
})

// 初始化
initAIAggregator()
