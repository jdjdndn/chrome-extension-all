// 时间显示
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
  dateEl.textContent = `${year}年${month}月${day}日 ${weekday}`;
}

// 初始化时间并每秒更新
updateTime();
setInterval(updateTime, 1000);

// 搜索功能
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

// 快捷方式管理
const quickLinksContainer = document.getElementById('quickLinks');
const STORAGE_KEY = 'quickLinks';

// 获取保存的快捷方式
function getQuickLinks() {
  const links = localStorage.getItem(STORAGE_KEY);
  return links ? JSON.parse(links) : null;
}

// 保存快捷方式
function saveQuickLinks(links) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(links));
}

// 创建快捷方式元素
function createQuickLink(link) {
  const linkEl = document.createElement('a');
  linkEl.className = 'quick-link';
  linkEl.href = link.url;
  linkEl.innerHTML = `
    <div class="quick-link-icon">${link.icon}</div>
    <span class="quick-link-title">${link.title}</span>
  `;

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
  document.querySelectorAll('.quick-link').forEach(el => {
    links.push({
      title: el.querySelector('.quick-link-title').textContent,
      url: el.href,
      icon: el.querySelector('.quick-link-icon').textContent
    });
  });
  saveQuickLinks(links);
}

// 加载保存的快捷方式
function loadQuickLinks() {
  const links = getQuickLinks();
  if (links) {
    // 清空默认链接，保留添加按钮
    const addBtn = document.getElementById('addLinkBtn');
    quickLinksContainer.innerHTML = '';
    links.forEach(link => {
      quickLinksContainer.appendChild(createQuickLink(link));
    });
    quickLinksContainer.appendChild(addBtn);
  }
}

// 添加新快捷方式
document.getElementById('addLinkBtn').addEventListener('click', () => {
  const title = prompt('请输入网站名称:');
  if (!title) return;

  const url = prompt('请输入网站URL:');
  if (!url) return;

  const iconOptions = ['🌐', '🔗', '📌', '⭐', '🚀', '💡', '🎯', '📱', '💻', '🎨'];
  const icon = iconOptions[Math.floor(Math.random() * iconOptions.length)];

  const newLink = { title, url, icon };
  const linkEl = createQuickLink(newLink);

  // 插入到添加按钮之前
  const addBtn = document.getElementById('addLinkBtn');
  quickLinksContainer.insertBefore(linkEl, addBtn);

  updateQuickLinksFromDOM();
});

// 页面加载时加载快捷方式
loadQuickLinks();

// 聚焦搜索框
searchInput.focus();

// 键盘快捷键
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
