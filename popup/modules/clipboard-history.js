/**
 * Popup 剪贴板历史模块
 * 负责剪贴板历史的加载、搜索和过滤
 * 按需加载：仅在 home tab 使用
 */

/**
 * 初始化剪贴板历史
 */
export async function initClipboardHistory() {
  console.log('[ClipboardHistory] 初始化')

  const list = document.getElementById('clipboard-list')
  const clearBtn = document.getElementById('clear-clipboard')

  // 添加搜索框
  if (list && !document.getElementById('clipboard-search')) {
    const searchContainer = document.createElement('div')
    searchContainer.innerHTML = `
      <input type="text" id="clipboard-search" placeholder="搜索剪贴板历史..."
        style="width: 100%; padding: 6px 8px; margin-bottom: 8px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 12px;">
      <div id="clipboard-filters" style="display: flex; gap: 4px; margin-bottom: 8px;">
      </div>
    `
    list.parentNode.insertBefore(searchContainer, list)

    const searchInput = document.getElementById('clipboard-search')
    searchInput?.addEventListener('input', (e) => {
      filterClipboardHistory(e.target.value)
    })
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('确定要清空剪贴板历史吗？')) {
        await chrome.storage.local.remove('clipboardHistory')
        loadClipboardHistory()
      }
    })
  }

  loadClipboardHistory()
}

/**
 * 加载剪贴板历史
 */
export async function loadClipboardHistory(searchQuery = '', filter = 'all') {
  const list = document.getElementById('clipboard-list')
  if (!list) {return}

  const result = await chrome.storage.local.get('clipboardHistory')
  let history = result.clipboardHistory || []

  // 分类检测
  const categorize = (text) => {
    if (/^https?:\/\//i.test(text)) {return 'url'}
    if (/[\{\}\[\]\(\);=>]/.test(text) && text.includes('\n')) {return 'code'}
    return 'text'
  }

  // 筛选
  if (filter !== 'all') {
    history = history.filter(item => categorize(item.text) === filter)
  }

  // 搜索
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    history = history.filter(item => item.text.toLowerCase().includes(query))
  }

  if (history.length === 0) {
    list.innerHTML = '<div style="color: #999; text-align: center; padding: 20px;">暂无记录</div>'
    return
  }

  list.innerHTML = history
    .map((item, i) => {
      const category = categorize(item.text)
      const categoryColor = category === 'url' ? '#17a2b8' : category === 'code' ? '#28a745' : '#6c757d'
      const categoryLabel = category === 'url' ? 'URL' : category === 'code' ? '代码' : '文本'

      let displayText = escapeHtml(item.text.slice(0, 100))
      if (searchQuery) {
        const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi')
        displayText = displayText.replace(
          regex,
          '<mark style="background: #fff3cd; padding: 0 2px;">$1</mark>'
        )
      }

      return `
        <div class="clipboard-item" style="padding: 8px; margin-bottom: 4px; background: #f8f9fa; border-radius: 4px; cursor: pointer; overflow: hidden; position: relative;" data-index="${i}">
          <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${displayText}</div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px;">
            <span style="font-size: 10px; color: #999;">${new Date(item.time).toLocaleString('zh-CN')}</span>
            <span style="font-size: 10px; padding: 2px 6px; background: ${categoryColor}; color: white; border-radius: 3px;">${categoryLabel}</span>
          </div>
        </div>
      `
    })
    .join('')

  // 点击复制
  list.querySelectorAll('.clipboard-item').forEach(el => {
    el.addEventListener('click', async () => {
      const index = parseInt(el.dataset.index)
      const text = history[index]?.text
      if (text) {
        await navigator.clipboard.writeText(text)
        el.style.background = '#d4edda'
        setTimeout(() => (el.style.background = ''), 500)
      }
    })
  })
}

/**
 * 过滤剪贴板历史
 */
function filterClipboardHistory(query) {
  loadClipboardHistory(query)
}

/**
 * 转义正则表达式
 */
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * HTML 转义
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}
