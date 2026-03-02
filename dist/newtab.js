// ========== 设置相关 ==========
const SETTINGS_KEY = 'newtabSettings';
const DEFAULT_SETTINGS = {
  columns: 6,
  historyCount: 8
};

// 获取设置
function getSettings() {
  const settings = localStorage.getItem(SETTINGS_KEY);
  return settings ? { ...DEFAULT_SETTINGS, ...JSON.parse(settings) } : { ...DEFAULT_SETTINGS };
}

// 保存设置
function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

// 应用列数设置
function applyColumnsSetting(columns) {
  const quickLinks = document.getElementById('quickLinks');
  quickLinks.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
}

// 设置抽屉逻辑
const settingsBtn = document.getElementById('settingsBtn');
const settingsDrawer = document.getElementById('settingsDrawer');
const settingsCloseBtn = document.getElementById('settingsCloseBtn');
const drawerOverlay = document.getElementById('drawerOverlay');

function openSettings() {
  settingsDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
}

function closeSettings() {
  settingsDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
}

settingsBtn.addEventListener('click', openSettings);
settingsCloseBtn.addEventListener('click', closeSettings);
drawerOverlay.addEventListener('click', closeSettings);

// ESC 关闭抽屉
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeSettings();
  }
});

// 列数滑块
const columnsRange = document.getElementById('columnsRange');
const columnsValue = document.getElementById('columnsValue');

columnsRange.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  columnsValue.textContent = value;
  applyColumnsSetting(value);

  const settings = getSettings();
  settings.columns = value;
  saveSettings(settings);
});

// 历史记录数量滑块
const historyCountRange = document.getElementById('historyCountRange');
const historyCountValue = document.getElementById('historyCountValue');

historyCountRange.addEventListener('input', (e) => {
  const value = parseInt(e.target.value);
  historyCountValue.textContent = value;

  const settings = getSettings();
  settings.historyCount = value;
  saveSettings(settings);

  loadHistory();
});

// 初始化设置
function initSettings() {
  const settings = getSettings();

  // 设置滑块值
  columnsRange.value = settings.columns;
  columnsValue.textContent = settings.columns;
  historyCountRange.value = settings.historyCount;
  historyCountValue.textContent = settings.historyCount;

  // 应用列数
  applyColumnsSetting(settings.columns);

  // 加载历史记录
  loadHistory();
}

// ========== 历史记录相关 ==========
const historyContainer = document.getElementById('historyContainer');

// 获取域名图标
function getDomainIcon(domain) {
  const icons = ['🌐', '🔗', '📌', '⭐', '🚀', '💡', '🎯', '📱', '💻', '🎨'];
  let hash = 0;
  for (let i = 0; i < domain.length; i++) {
    hash = domain.charCodeAt(i) + ((hash << 5) - hash);
  }
  return icons[Math.abs(hash) % icons.length];
}

// 获取页面标题
function getPageTitle(url, title) {
  if (title && title.trim()) return title;

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(p => p);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].replace(/[-_]/g, ' ');
    }
    return urlObj.hostname;
  } catch (e) {
    return url;
  }
}

// 加载历史记录
async function loadHistory() {
  const settings = getSettings();
  const maxDomains = settings.historyCount;

  try {
    // 获取最近的历史记录
    const historyItems = await chrome.history.search({
      text: '',
      maxResults: 500,
      startTime: Date.now() - 7 * 24 * 60 * 60 * 1000 // 最近7天
    });

    // 按域名分组
    const domainMap = new Map();

    historyItems.forEach(item => {
      try {
        const urlObj = new URL(item.url);
        const domain = urlObj.hostname;

        // 跳过某些域名
        if (domain === 'localhost' || domain === '127.0.0.1' || domain.endsWith('.local')) {
          return;
        }

        if (!domainMap.has(domain)) {
          domainMap.set(domain, {
            domain,
            urls: []
          });
        }

        // 每个域名最多显示5个URL
        if (domainMap.get(domain).urls.length < 5) {
          domainMap.get(domain).urls.push({
            url: item.url,
            title: getPageTitle(item.url, item.title),
            lastVisitTime: item.lastVisitTime
          });
        }
      } catch (e) {
        // 忽略无效URL
      }
    });

    // 按最近访问时间排序
    const sortedDomains = Array.from(domainMap.values())
      .sort((a, b) => {
        const aLatest = Math.max(...a.urls.map(u => u.lastVisitTime || 0));
        const bLatest = Math.max(...b.urls.map(u => u.lastVisitTime || 0));
        return bLatest - aLatest;
      })
      .slice(0, maxDomains);

    // 渲染历史记录
    renderHistory(sortedDomains);
  } catch (error) {
    console.error('加载历史记录失败:', error);
    historyContainer.innerHTML = '<div class="history-empty">加载历史记录失败</div>';
  }
}

// 渲染历史记录
function renderHistory(domains) {
  if (domains.length === 0) {
    historyContainer.innerHTML = '<div class="history-empty">暂无历史记录</div>';
    return;
  }

  historyContainer.innerHTML = domains.map(domain => `
    <div class="history-domain">
      <div class="history-domain-header">
        <span class="history-domain-icon">${getDomainIcon(domain.domain)}</span>
        <span class="history-domain-name">${domain.domain}</span>
        <span class="history-domain-count">${domain.urls.length}</span>
      </div>
      <div class="history-urls">
        ${domain.urls.map(urlItem => `
          <a href="${urlItem.url}" class="history-url-item" title="${urlItem.title}">
            <span class="history-url-icon">📄</span>
            <span class="history-url-title">${urlItem.title}</span>
          </a>
        `).join('')}
      </div>
    </div>
  `).join('');
}

// ========== 农历计算 ==========
const lunarInfo = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2,
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977,
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970,
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950,
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557,
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5d0, 0x14573, 0x052d0, 0x0a9a8, 0x0e950, 0x06aa0,
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0,
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b5a0, 0x195a6,
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570,
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x055c0, 0x0ab60, 0x096d5, 0x092e0,
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5,
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930,
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530,
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45,
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0
];

const lunarMonthNames = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const lunarDayNames = ['初一', '初二', '初三', '初四', '初五', '初六', '初七', '初八', '初九', '初十',
  '十一', '十二', '十三', '十四', '十五', '十六', '十七', '十八', '十九', '二十',
  '廿一', '廿二', '廿三', '廿四', '廿五', '廿六', '廿七', '廿八', '廿九', '三十'];

function getLunarMonthDays(year, month) {
  return (lunarInfo[year - 1900] & (0x10000 >> month)) ? 30 : 29;
}

function getLunarYearDays(year) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) {
    sum += (lunarInfo[year - 1900] & i) ? 1 : 0;
  }
  return sum + getLeapMonthDays(year);
}

function getLeapMonth(year) {
  return lunarInfo[year - 1900] & 0xf;
}

function getLeapMonthDays(year) {
  if (getLeapMonth(year)) {
    return (lunarInfo[year - 1900] & 0x10000) ? 30 : 29;
  }
  return 0;
}

function solarToLunar(year, month, day) {
  const baseDate = new Date(1900, 0, 31);
  const targetDate = new Date(year, month - 1, day);
  let offset = Math.floor((targetDate - baseDate) / 86400000);

  let lunarYear = 1900;
  let yearDays;
  while (lunarYear < 2100 && offset > 0) {
    yearDays = getLunarYearDays(lunarYear);
    if (offset < yearDays) break;
    offset -= yearDays;
    lunarYear++;
  }

  const leapMonth = getLeapMonth(lunarYear);
  let isLeap = false;
  let lunarMonth = 1;
  let monthDays;

  for (let i = 1; i <= 12; i++) {
    if (leapMonth > 0 && i === leapMonth + 1 && !isLeap) {
      --i;
      isLeap = true;
      monthDays = getLeapMonthDays(lunarYear);
    } else {
      monthDays = getLunarMonthDays(lunarYear, i);
    }

    if (offset < monthDays) {
      lunarMonth = i;
      break;
    }
    offset -= monthDays;

    if (isLeap && i === leapMonth + 1) {
      isLeap = false;
    }
  }

  const lunarDay = offset + 1;
  return {
    year: lunarYear,
    month: lunarMonth,
    day: lunarDay,
    isLeap: isLeap,
    monthName: lunarMonthNames[lunarMonth - 1],
    dayName: lunarDayNames[lunarDay - 1]
  };
}

// ========== 时间显示 ==========
function updateTime() {
  const now = new Date();
  const timeEl = document.getElementById('time');
  const dateEl = document.getElementById('date');

  // 时间
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  timeEl.textContent = `${hours}:${minutes}`;

  // 日期
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const weekday = weekdays[now.getDay()];

  // 农历
  const lunar = solarToLunar(year, month, day);
  const lunarStr = `农历${lunar.monthName}月${lunar.dayName}`;

  dateEl.textContent = `${year}年${month}月${day}日 ${weekday} ${lunarStr}`;
}

// 初始化时间并每秒更新
updateTime();
setInterval(updateTime, 1000);

// ========== 搜索功能 ==========
const searchInput = document.getElementById('searchInput');
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    const query = searchInput.value.trim();
    if (query) {
      // 判断是否为URL
      if (query.match(/^https?:\/\//i) || query.match(/^[\w.-]+\.[a-z]{2,}/i)) {
        let url = query;
        if (!url.match(/^https?:\/\//i)) {
          url = 'https://' + url;
        }
        window.location.href = url;
      } else {
        // 使用搜索引擎
        window.location.href = `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`;
      }
    }
  }
});

// ========== 快捷方式管理 ==========
const quickLinksContainer = document.getElementById('quickLinks');
const STORAGE_KEY = 'quickLinks';

// 默认快捷方式（始终存在）
const DEFAULT_LINKS = [
  { title: 'Google', url: 'https://www.google.com', icon: '🔍', favicon: '' },
  { title: '百度', url: 'https://www.baidu.com', icon: '🔎', favicon: '' },
  { title: 'GitHub', url: 'https://github.com', icon: '🐱', favicon: '' },
  { title: 'B站', url: 'https://www.bilibili.com', icon: '📺', favicon: '' },
  { title: '知乎', url: 'https://www.zhihu.com', icon: '🧠', favicon: '' },
  { title: '掘金', url: 'https://juejin.cn', icon: '💎', favicon: '' }
];

// 获取保存的快捷方式（优先从 chrome.storage.local 读取）
function getQuickLinks(callback) {
  chrome.storage.local.get(['quickLinks'], (result) => {
    if (result.quickLinks && result.quickLinks.length > 0) {
      callback(result.quickLinks);
    } else {
      // 从 localStorage 读取（兼容旧数据）
      const localLinks = localStorage.getItem(STORAGE_KEY);
      callback(localLinks ? JSON.parse(localLinks) : null);
    }
  });
}

// 保存快捷方式（同时保存到 chrome.storage.local 和 localStorage）
function saveQuickLinks(links) {
  const trimmedLinks = links.slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedLinks));
  chrome.storage.local.set({ quickLinks: trimmedLinks });
}

// 创建快捷方式元素
function createQuickLink(link) {
  const linkEl = document.createElement('a');
  linkEl.className = 'quick-link';
  linkEl.href = link.url;

  // 如果有 favicon，优先使用，否则使用 emoji 图标
  if (link.favicon) {
    linkEl.innerHTML = `
      <div class="quick-link-icon" style="background: #fff; overflow: hidden;">
        <img src="${link.favicon}" style="width: 100%; height: 100%; object-fit: contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">
        <span style="display:none;">${link.icon}</span>
      </div>
      <span class="quick-link-title">${link.title}</span>
    `;
  } else {
    linkEl.innerHTML = `
      <div class="quick-link-icon">${link.icon}</div>
      <span class="quick-link-title">${link.title}</span>
    `;
  }

  // 右键删除
  linkEl.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (confirm(`确定要删除 "${link.title}" 吗？`)) {
      linkEl.remove();
      updateQuickLinksFromDOM();
    }
  });

  return linkEl;
}

// 从DOM更新快捷方式存储
function updateQuickLinksFromDOM() {
  const links = [];
  const defaultUrls = new Set(DEFAULT_LINKS.map(l => l.url));
  const seenUrls = new Set(); // 防止用户添加的重复

  document.querySelectorAll('.quick-link').forEach(el => {
    const url = el.href;
    const title = el.querySelector('.quick-link-title').textContent;
    const iconEl = el.querySelector('.quick-link-icon');
    const icon = iconEl.querySelector('span') ? iconEl.querySelector('span').textContent : iconEl.textContent.trim().substring(0, 2);

    // 只保存非默认的快捷方式，且不重复
    if (!defaultUrls.has(url) && !seenUrls.has(url)) {
      links.push({
        title,
        url,
        icon: icon || '🌐'
      });
      seenUrls.add(url);
    }
  });

  saveQuickLinks(links);
}

// 加载保存的快捷方式
function loadQuickLinks() {
  getQuickLinks((links) => {
    const addBtn = document.getElementById('addLinkBtn');
    quickLinksContainer.innerHTML = '';

    // 默认链接的 URL 集合
    const defaultUrls = new Set(DEFAULT_LINKS.map(l => l.url));

    // 用于去重的 Set（记录已渲染的 URL）
    const renderedUrls = new Set();

    // 始终显示默认图标
    DEFAULT_LINKS.forEach(link => {
      if (!renderedUrls.has(link.url)) {
        quickLinksContainer.appendChild(createQuickLink(link));
        renderedUrls.add(link.url);
      }
    });

    // 添加用户保存的图标（排除默认链接和重复）
    if (links && links.length > 0) {
      links.forEach(link => {
        // 跳过默认链接和已渲染的 URL
        if (!defaultUrls.has(link.url) && !renderedUrls.has(link.url)) {
          quickLinksContainer.appendChild(createQuickLink(link));
          renderedUrls.add(link.url);
        }
      });
    }

    quickLinksContainer.appendChild(addBtn);
  });
}

// 添加新快捷方式
document.getElementById('addLinkBtn').addEventListener('click', () => {
  const title = prompt('请输入网站名称:');
  if (!title) return;

  const url = prompt('请输入网站URL:');
  if (!url) return;

  const iconOptions = ['🌐', '🔗', '📌', '⭐', '🚀', '💡', '🎯', '📱', '💻', '🎨'];
  const icon = iconOptions[Math.floor(Math.random() * iconOptions.length)];

  // 尝试获取 favicon
  let favicon = '';
  try {
    const urlObj = new URL(url);
    favicon = `${urlObj.origin}/favicon.ico`;
  } catch (e) {}

  const newLink = { title, url, icon, favicon };
  const linkEl = createQuickLink(newLink);

  // 插入到添加按钮之前
  const addBtn = document.getElementById('addLinkBtn');
  quickLinksContainer.insertBefore(linkEl, addBtn);

  updateQuickLinksFromDOM();
});

// ========== 初始化 ==========
// 页面加载时加载快捷方式和设置
initQuickLinks();
loadQuickLinks();
initSettings();

// 聚焦搜索框
searchInput.focus();

// 初始化快捷方式（首次时保存默认图标到 storage）
function initQuickLinks() {
  chrome.storage.local.get(['quickLinks'], (result) => {
    if (!result.quickLinks || result.quickLinks.length === 0) {
      // 首次加载，不保存默认图标到 storage
      // 默认图标始终存在，不需要保存
      console.log('[Newtab] 使用默认快捷方式');
    }
  });
}

// ========== 键盘快捷键 ==========
document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd + K 或 / 聚焦搜索框
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchInput.focus();
    searchInput.select();
  }
  if (e.key === '/' && document.activeElement !== searchInput) {
    e.preventDefault();
    searchInput.focus();
  }
});
