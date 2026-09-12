/**
 * Popup 关键词管理模块
 * 负责抖音/B站关键词管理
 * 按需加载：仅在对应域名的 page tab 使用
 */

// 默认关键词
const defaultNotInterestedKeywords = [
  '抽象',
  '漫画',
  '国漫',
  '修仙',
  '玄幻',
  '系统',
  '动画',
  '动漫',
  '小说',
  '黑神话',
  '解说',
  '好剧',
  '儿童',
  '孩子',
  '观影',
  '案件',
  '国学',
  '狗',
  '猫',
  '宠物',
  '娃',
  '王者荣耀',
  '射手',
  '对抗路',
  '中单',
  '上单',
  '打野',
  '巅峰赛',
  '游戏日常',
  '综艺',
  '游戏',
  '美食',
  '测评',
  '小品',
  '春晚',
  '相亲',
  '恋爱',
  '情侣日常',
  '国服',
  '驾照',
  '考试',
  '结婚',
  '率土之滨',
  '程序员',
  '前端',
  '动物',
  '电商',
  '追剧',
  '军旅',
  '短剧',
  '小说',
  '恐怖',
  '影视',
  '电影',
  '司机',
  '工地',
  '情侣',
  '原生家庭',
  '影娱',
  '好片',
  '亲子',
  '幼儿园',
  '育儿',
  '育婴',
  '宝宝',
  '母婴',
  '妈妈',
  '父母',
  '爸妈',
  '早教',
  '幼教',
  '学前',
  '儿童',
  '音乐',
  '热歌',
]

const defaultAutoFollowKeywords = ['ootd']

const defaultBiliNotInterestedKeywords = [
  '原神',
  '崩坏',
  '星铁',
  '鸣潮',
  '王者',
  '荣耀',
  'LOL',
  '英雄联盟',
  '绝区零',
  '火影',
  '海贼',
  '柯南',
  '漫威',
  'DC',
  '漫展',
  'cos',
  'COS',
  'Cos',
  '直播',
  '带货',
  '广告',
  '推广',
]

// DOM elements
let notInterestedKeywordsTextarea = null
let autoFollowKeywordsTextarea = null
let saveKeywordsBtn = null
let saveFollowKeywordsBtn = null
let biliNotInterestedKeywordsTextarea = null
let biliSaveKeywordsBtn = null

/**
 * 初始化关键词管理模块
 */
export async function initKeywordManager() {
  console.log('[KeywordManager] 初始化')

  // 获取 DOM 元素
  notInterestedKeywordsTextarea = document.getElementById('not-interested-keywords')
  autoFollowKeywordsTextarea = document.getElementById('auto-follow-keywords')
  saveKeywordsBtn = document.getElementById('save-keywords-btn')
  saveFollowKeywordsBtn = document.getElementById('save-follow-keywords-btn')
  biliNotInterestedKeywordsTextarea = document.getElementById('bili-not-interested-keywords')
  biliSaveKeywordsBtn = document.getElementById('bili-save-keywords-btn')

  // 绑定事件
  bindKeywordEvents()
}

/**
 * 绑定关键词事件
 */
function bindKeywordEvents() {
  if (saveKeywordsBtn) {
    saveKeywordsBtn.addEventListener('click', saveKeywords)
  }
  if (saveFollowKeywordsBtn) {
    saveFollowKeywordsBtn.addEventListener('click', saveAutoFollowKeywords)
  }
  if (biliSaveKeywordsBtn) {
    biliSaveKeywordsBtn.addEventListener('click', saveBiliKeywords)
  }

  // Setup copy/paste listeners
  setupCopyAsArray(notInterestedKeywordsTextarea)
  setupCopyAsArray(autoFollowKeywordsTextarea)
  setupCopyAsArray(biliNotInterestedKeywordsTextarea)
  setupPasteFromArray(notInterestedKeywordsTextarea)
  setupPasteFromArray(autoFollowKeywordsTextarea)
  setupPasteFromArray(biliNotInterestedKeywordsTextarea)
}

/**
 * 解析关键词 - 按换行符分割，自动去重
 */
function parseKeywords(text) {
  if (!text) {
    return []
  }
  const lines = text
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l)
  return [...new Set(lines)]
}

/**
 * 格式化关键词为换行分隔
 */
function formatKeywords(keywords) {
  return keywords.join('\n')
}

/**
 * 获取当前域名
 */
async function getCurrentDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.url) {
      return new URL(tabs[0].url).hostname
    }
  } catch (error) {
    console.error('Failed to get current domain:', error)
  }
  return null
}

/**
 * 检查是否是抖音域名
 */
function isDouyinDomain(domain) {
  if (!domain) {
    return false
  }
  const douyinDomains = ['douyin.com', 'www.douyin.com', 'iesdouyin.com']
  return douyinDomains.some((d) => domain === d || domain.endsWith('.' + d))
}

/**
 * 检查是否是B站域名
 */
function isBilibiliDomain(domain) {
  if (!domain) {
    return false
  }
  const biliDomains = ['bilibili.com', 'www.bilibili.com']
  return biliDomains.some((d) => domain === d || domain.endsWith('.' + d))
}

/**
 * 加载关键词
 */
export async function loadKeywords() {
  const domain = await getCurrentDomain()
  if (!isDouyinDomain(domain)) {
    return
  }

  const result = await chrome.storage.local.get(['douyinKeywords'])
  const keywords = result.douyinKeywords || {
    notInterested: defaultNotInterestedKeywords,
    autoFollow: defaultAutoFollowKeywords,
  }

  if (notInterestedKeywordsTextarea) {
    notInterestedKeywordsTextarea.value = formatKeywords(keywords.notInterested)
  }
  if (autoFollowKeywordsTextarea) {
    autoFollowKeywordsTextarea.value = formatKeywords(keywords.autoFollow)
  }

  updateKeywordsCount()
}

/**
 * 加载B站关键词
 */
export async function loadBiliKeywords() {
  const domain = await getCurrentDomain()
  if (!isBilibiliDomain(domain)) {
    return
  }

  const result = await chrome.storage.local.get(['biliKeywords'])
  const keywords = result.biliKeywords || {
    notInterested: defaultBiliNotInterestedKeywords,
  }

  if (biliNotInterestedKeywordsTextarea) {
    biliNotInterestedKeywordsTextarea.value = formatKeywords(keywords.notInterested)
  }

  updateKeywordsCount()
}

/**
 * 保存关键词
 */
async function saveKeywords() {
  if (!notInterestedKeywordsTextarea) {
    return
  }

  const domain = await getCurrentDomain()
  if (!isDouyinDomain(domain)) {
    console.log('非抖音域名，跳过保存关键词')
    return
  }

  const keywords = parseKeywords(notInterestedKeywordsTextarea.value)
  const autoFollowKeywords = autoFollowKeywordsTextarea
    ? parseKeywords(autoFollowKeywordsTextarea.value)
    : defaultAutoFollowKeywords

  await chrome.storage.local.set({
    douyinKeywords: {
      notInterested: keywords,
      autoFollow: autoFollowKeywords,
    },
  })

  console.log('不感兴趣关键词已保存:', keywords)
  notInterestedKeywordsTextarea.value = formatKeywords(keywords)
  updateKeywordsCount()

  // 通知 content script
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: 'UPDATE_KEYWORDS',
          keywords: {
            NOT_INTERESTED_KEYWORDS: keywords,
            AUTO_FOLLOW_KEYWORDS: autoFollowKeywords,
          },
        })
        .catch(() => {})
    }
  } catch (error) {
    console.error('Failed to notify content script:', error)
  }
}

/**
 * 保存自动关注关键词
 */
async function saveAutoFollowKeywords() {
  if (!autoFollowKeywordsTextarea) {
    return
  }

  const domain = await getCurrentDomain()
  if (!isDouyinDomain(domain)) {
    console.log('非抖音域名，跳过保存关键词')
    return
  }

  const keywords = parseKeywords(autoFollowKeywordsTextarea.value)
  const result = await chrome.storage.local.get(['douyinKeywords'])
  const currentKeywords = result.douyinKeywords || {
    notInterested: defaultNotInterestedKeywords,
    autoFollow: defaultAutoFollowKeywords,
  }

  await chrome.storage.local.set({
    douyinKeywords: {
      ...currentKeywords,
      autoFollow: keywords,
    },
  })

  console.log('自动关注关键词已保存:', keywords)
  autoFollowKeywordsTextarea.value = formatKeywords(keywords)

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: 'UPDATE_KEYWORDS',
          keywords: { AUTO_FOLLOW_KEYWORDS: keywords },
        })
        .catch(() => {})
    }
  } catch (error) {
    console.error('Failed to notify content script:', error)
  }
}

/**
 * 保存B站关键词
 */
async function saveBiliKeywords() {
  if (!biliNotInterestedKeywordsTextarea) {
    return
  }

  const domain = await getCurrentDomain()
  if (!isBilibiliDomain(domain)) {
    console.log('非B站域名，跳过保存关键词')
    return
  }

  const keywords = parseKeywords(biliNotInterestedKeywordsTextarea.value)
  await chrome.storage.local.set({
    biliKeywords: { notInterested: keywords },
  })

  console.log('B站不感兴趣关键词已保存:', keywords.length, '个')
  biliNotInterestedKeywordsTextarea.value = formatKeywords(keywords)
  updateKeywordsCount()

  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      chrome.tabs
        .sendMessage(tabs[0].id, {
          type: 'UPDATE_KEYWORDS',
          keywords: { NOT_INTERESTED_KEYWORDS: keywords },
        })
        .catch(() => {})
    }
  } catch (error) {
    console.error('Failed to notify content script:', error)
  }
}

/**
 * 更新关键词数量显示
 */
function updateKeywordsCount() {
  const douyinCountEl = document.getElementById('douyin-keywords-count')
  const biliCountEl = document.getElementById('bili-keywords-count')

  if (douyinCountEl && notInterestedKeywordsTextarea) {
    const keywords = parseKeywords(notInterestedKeywordsTextarea.value)
    douyinCountEl.textContent = `(${keywords.length}个)`
  }

  if (biliCountEl && biliNotInterestedKeywordsTextarea) {
    const keywords = parseKeywords(biliNotInterestedKeywordsTextarea.value)
    biliCountEl.textContent = `(${keywords.length}个)`
  }
}

/**
 * 更新抖音关键词可见性
 */
export async function updateDouyinKeywordsVisibility() {
  const domain = await getCurrentDomain()
  const douyinSection = document.getElementById('douyin-keywords-section')
  if (douyinSection) {
    douyinSection.style.display = isDouyinDomain(domain) ? 'block' : 'none'
  }
}

/**
 * 更新B站关键词可见性
 */
export async function updateBilibiliKeywordsVisibility() {
  const domain = await getCurrentDomain()
  const biliSection = document.getElementById('bili-keywords-section')
  if (biliSection) {
    biliSection.style.display = isBilibiliDomain(domain) ? 'block' : 'none'
  }
}

/**
 * 设置复制为数组格式
 */
function setupCopyAsArray(textarea) {
  if (!textarea) {
    return
  }

  textarea.addEventListener('copy', (e) => {
    const selection = window.getSelection()
    if (!selection.rangeCount) {
      return
    }

    let selectedText = selection.toString()
    if (!selectedText) {
      selectedText = textarea.value
    }

    const keywords = parseKeywords(selectedText)
    const arrayFormat = keywords.map((k) => `"${k}"`).join(',')

    e.preventDefault()
    e.clipboardData.setData('text/plain', arrayFormat)
    console.log('[复制] 已转换为数组格式:', arrayFormat)
  })
}

/**
 * 设置从数组粘贴
 */
function setupPasteFromArray(textarea) {
  if (!textarea) {
    return
  }

  textarea.addEventListener('paste', (e) => {
    const pastedText = e.clipboardData.getData('text')

    try {
      const parsed = JSON.parse(pastedText)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const formatted = parsed
          .filter((item) => typeof item === 'string' && item.trim())
          .map((item) => item.replace(/\s+/g, ''))
          .join(' ')
        if (formatted) {
          e.preventDefault()

          const start = textarea.selectionStart
          const end = textarea.selectionEnd
          const before = textarea.value.substring(0, start)
          const after = textarea.value.substring(end)

          textarea.value = before + formatted + after
          const newPos = start + formatted.length
          textarea.selectionStart = newPos
          textarea.selectionEnd = newPos

          console.log('[粘贴] 已从数组格式转换:', formatted)
        }
      }
    } catch (e) {
      // Not a JSON array, use default paste behavior
    }
  })
}
