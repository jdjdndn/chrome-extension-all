/**
 * 下载记录搜索模块
 * 使用 chrome.downloads API 搜索下载历史
 */

const DownloadsSearch = {
  /**
   * 搜索下载记录
   * @param {string} query - 搜索关键词
   * @param {object} options - 搜索选项
   * @returns {Promise<Array>} 下载记录列表
   */
  async search(query, options = {}) {
    const {
      limit = 20,
      startTime = Date.now() - 30 * 24 * 60 * 60 * 1000, // 默认最近30天
      state = 'all', // 'all', 'in_progress', 'interrupted', 'complete'
    } = options

    try {
      const searchParams = {
        query: query ? [query] : [],
        limit,
        startTime,
      }

      // 按状态过滤
      if (state !== 'all') {
        searchParams.state = state
      }

      const downloads = await chrome.downloads.search(searchParams)

      return downloads.map((item) => ({
        id: item.id,
        filename: item.filename,
        url: item.url,
        finalUrl: item.finalUrl,
        state: item.state,
        paused: item.paused,
        startTime: item.startTime,
        endTime: item.endTime,
        totalBytes: item.totalBytes,
        fileSize: item.fileSize,
        danger: item.danger,
        mime: item.mime,
        exists: item.exists,
      }))
    } catch (error) {
      console.error('[DownloadsSearch] 搜索失败:', error)
      return []
    }
  },

  /**
   * 获取最近下载
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>}
   */
  async getRecent(limit = 10) {
    try {
      const downloads = await chrome.downloads.search({
        limit,
        orderBy: ['-startTime'],
      })
      return downloads
    } catch (error) {
      console.error('[DownloadsSearch] 获取最近下载失败:', error)
      return []
    }
  },

  /**
   * 打开下载文件
   * @param {number} downloadId - 下载ID
   */
  async open(downloadId) {
    try {
      await chrome.downloads.open(downloadId)
    } catch (error) {
      console.error('[DownloadsSearch] 打开文件失败:', error)
    }
  },

  /**
   * 在文件夹中显示
   * @param {number} downloadId - 下载ID
   */
  async show(downloadId) {
    try {
      await chrome.downloads.show(downloadId)
    } catch (error) {
      console.error('[DownloadsSearch] 显示文件失败:', error)
    }
  },

  /**
   * 格式化文件大小
   * @param {number} bytes - 字节数
   * @returns {string}
   */
  formatSize(bytes) {
    if (!bytes || bytes === -1) {return '未知'}
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024
      i++
    }
    return `${bytes.toFixed(i > 0 ? 1 : 0)} ${units[i]}`
  },

  /**
   * 格式化状态
   * @param {string} state - 状态
   * @returns {object} { text, icon, color }
   */
  formatState(state) {
    const stateMap = {
      in_progress: { text: '下载中', icon: '⏳', color: '#1890ff' },
      interrupted: { text: '已中断', icon: '⚠️', color: '#ff4d4f' },
      complete: { text: '已完成', icon: '✅', color: '#52c41a' },
    }
    return stateMap[state] || { text: state, icon: '📄', color: '#999' }
  },

  /**
   * 获取文件图标
   * @param {string} filename - 文件名
   * @returns {string}
   */
  getFileIcon(filename) {
    const ext = filename.split('.').pop().toLowerCase()
    const iconMap = {
      // 图片
      jpg: '🖼️',
      jpeg: '🖼️',
      png: '🖼️',
      gif: '🖼️',
      webp: '🖼️',
      svg: '🖼️',
      bmp: '🖼️',
      // 视频
      mp4: '🎬',
      avi: '🎬',
      mkv: '🎬',
      mov: '🎬',
      wmv: '🎬',
      flv: '🎬',
      webm: '🎬',
      // 音频
      mp3: '🎵',
      wav: '🎵',
      flac: '🎵',
      aac: '🎵',
      ogg: '🎵',
      wma: '🎵',
      // 文档
      pdf: '📕',
      doc: '📘',
      docx: '📘',
      xls: '📗',
      xlsx: '📗',
      ppt: '📙',
      pptx: '📙',
      txt: '📄',
      md: '📄',
      rtf: '📄',
      // 压缩
      zip: '📦',
      rar: '📦',
      '7z': '📦',
      tar: '📦',
      gz: '📦',
      // 代码
      js: '📜',
      ts: '📜',
      py: '📜',
      java: '📜',
      cpp: '📜',
      c: '📜',
      go: '📜',
      html: '🌐',
      css: '🎨',
      json: '📋',
      xml: '📋',
      // 可执行
      exe: '⚙️',
      msi: '⚙️',
      dmg: '⚙️',
      app: '⚙️',
      deb: '⚙️',
      rpm: '⚙️',
      // 其他
      apk: '📱',
      ipa: '📱',
    }
    return iconMap[ext] || '📎'
  },
}

// 导出
if (typeof window !== 'undefined') {
  window.DownloadsSearch = DownloadsSearch
}
