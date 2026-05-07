// GitHub 脚本：Ctrl+C 复制文件内容到剪贴板，可直接粘贴到VSCode
// 依赖: content/utils/logger.js, storage.js, dom.js
// @match *://github.com/*

'use strict'

if (window.GithubCopyFileLoaded) {
  console.log('[GitHub脚本] 文件复制已加载，跳过')
} else {
  window.GithubCopyFileLoaded = true

  // 当前悬停的链接元素
  let hoveredLink = null

  const SELECTORS = {
    // 文件树项目选择器
    treeItem: [
      'div[role="treeitem"]',
      'a.js-navigation-open',
      'li.js-navigation-item',
      '[data-path]',
      'tr.js-navigation-item', // 文件列表行
      'a.Link--primary', // 文件名链接
    ].join(', '),
    // 包含路径属性的元素
    pathElement: '[data-path]',
    // 文件夹图标（用于判断是否是文件夹）
    folderIcon: '.octicon-file-directory, .octicon-file-submodule',
  }

  /**
   * 从当前页面URL提取仓库信息
   */
  function getRepoInfo() {
    const match = window.location.pathname.match(/^\/([^/]+)\/([^/]+)/)
    if (match) {
      return {
        owner: match[1],
        repo: match[2],
      }
    }
    return null
  }

  /**
   * 获取当前分支名
   */
  function getCurrentBranch() {
    // 从URL提取: /owner/repo/tree/branch/...
    const match = window.location.pathname.match(/\/tree\/([^/]+)/)
    if (match) return match[1]

    // 从页面元素提取
    const branchButton = document.querySelector('[data-hotkey="w"] span')
    if (branchButton) return branchButton.textContent.trim()

    // 默认分支
    return 'main'
  }

  /**
   * 从元素中提取文件路径和类型
   */
  function extractFileInfo(element) {
    let path = null
    let isDirectory = false

    // 检查是否是文件夹图标
    const folderIcon = element.querySelector(SELECTORS.folderIcon)
    if (folderIcon) {
      isDirectory = true
    }

    // 尝试从当前元素获取 data-path
    if (element.dataset?.path) {
      path = element.dataset.path
    }

    // 向上查找包含 data-path 的父元素
    if (!path) {
      const pathContainer = element.closest(SELECTORS.pathElement)
      if (pathContainer?.dataset?.path) {
        path = pathContainer.dataset.path
      }
    }

    // 从链接中提取路径
    if (!path) {
      const link = element.matches('a') ? element : element.querySelector('a[href]')
      if (link) {
        const href = link.getAttribute('href')
        // GitHub 文件链接格式: /用户名/仓库名/blob/分支/路径
        const blobMatch = href?.match(/\/blob\/[^/]+\/(.+)$/)
        if (blobMatch) {
          path = blobMatch[1]
          isDirectory = false
        }
        // GitHub 文件夹链接格式: /用户名/仓库名/tree/分支/路径
        const treeMatch = href?.match(/\/tree\/[^/]+\/(.+)$/)
        if (treeMatch) {
          path = treeMatch[1]
          isDirectory = true
        }
      }
    }

    // 检查tr元素中是否有文件夹图标
    if (!isDirectory && element.matches('tr')) {
      const dirIcon = element.querySelector('.octicon-file-directory')
      if (dirIcon) {
        isDirectory = true
      }
    }

    // 从文本内容获取文件名（最后手段）
    if (!path) {
      const textContent = element.textContent?.trim()
      if (textContent && !textContent.includes('\n')) {
        path = textContent
      }
    }

    return { path, isDirectory }
  }

  /**
   * 获取当前焦点/悬停的文件树项目
   */
  function getTargetTreeItem() {
    // 1. 优先检查通过 mouseenter 追踪的悬停链接
    if (hoveredLink) {
      const treeItem = hoveredLink.closest(SELECTORS.treeItem)
      if (treeItem) return treeItem
      // 如果链接本身不在 treeItem 中，直接返回链接
      if (hoveredLink.matches('a[href]')) {
        return hoveredLink
      }
    }

    // 2. 检查 :hover 伪类
    const hovered = document.querySelector(':hover')
    if (hovered) {
      const treeItem = hovered.closest(SELECTORS.treeItem)
      if (treeItem) return treeItem
    }

    // 3. 检查当前焦点元素
    const activeElement = document.activeElement
    if (activeElement?.matches(SELECTORS.treeItem)) {
      return activeElement
    }

    // 4. 向上查找文件树项目
    const treeItem = activeElement?.closest(SELECTORS.treeItem)
    if (treeItem) return treeItem

    // 5. 检查是否有选中状态的元素
    const selected = document.querySelector('[aria-selected="true"]')
    if (selected) return selected

    return null
  }

  /**
   * 获取文件原始内容的URL
   */
  function getRawUrl(owner, repo, branch, path) {
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`
  }

  /**
   * 获取GitHub API URL
   */
  function getApiUrl(owner, repo, branch, path) {
    return `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`
  }

  /**
   * 复制文件到剪贴板（支持粘贴到VSCode）
   */
  async function copyFileToClipboard(owner, repo, branch, path, fileName) {
    const rawUrl = getRawUrl(owner, repo, branch, path)
    const apiUrl = getApiUrl(owner, repo, branch, path)

    // 调试信息
    console.log('[GitHub脚本] 调试信息:', { owner, repo, branch, path, rawUrl, apiUrl })

    showToast(`正在获取文件: ${fileName}...`, 'loading')

    // 方法1: 尝试从页面上的Raw按钮获取URL
    const rawButton = document.querySelector('a[data-testid="raw-button"], a[href*="raw"]')
    if (rawButton) {
      const rawHref = rawButton.getAttribute('href')
      console.log('[GitHub脚本] 从页面获取Raw URL:', rawHref)
      try {
        const response = await fetch(rawHref)
        if (response.ok) {
          const blob = await response.blob()
          await copyBlobToClipboard(blob, fileName)
          return true
        }
      } catch (e) {
        console.log('[GitHub脚本] Raw按钮URL获取失败:', e)
      }
    }

    // 方法2: 尝试直接fetch raw URL
    try {
      const response = await fetch(rawUrl)
      if (response.ok) {
        const blob = await response.blob()
        await copyBlobToClipboard(blob, fileName)
        return true
      }
    } catch (err) {
      console.log('[GitHub脚本] Raw URL获取失败:', err)
    }

    // 方法3: 使用GitHub API
    try {
      const response = await fetch(apiUrl, {
        headers: {
          Accept: 'application/vnd.github.v3.raw',
        },
      })
      if (response.ok) {
        const blob = await response.blob()
        await copyBlobToClipboard(blob, fileName)
        return true
      }
    } catch (err) {
      console.log('[GitHub脚本] API获取失败:', err)
    }

    // 方法4: 从当前页面提取已显示的文件内容
    const codeContent = document.querySelector('.blob-code-content, pre, article')
    if (codeContent) {
      const text = codeContent.textContent
      try {
        await navigator.clipboard.writeText(text)
      } catch (e) {
        fallbackCopyToClipboard(text)
      }
      showToast(`已复制页面显示内容: ${fileName}`, 'success')
      return true
    }

    showToast(`获取文件失败`, 'error')
    return false
  }

  /**
   * 降级复制方法（使用 textarea + execCommand）
   * 当 Clipboard API 不可用或文档失去焦点时使用
   */
  function fallbackCopyToClipboard(text) {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      opacity: 0;
    `
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()

    let success = false
    try {
      success = document.execCommand('copy')
    } catch (e) {
      console.error('[GitHub脚本] execCommand 复制失败:', e)
    }

    document.body.removeChild(textarea)
    return success
  }

  /**
   * 复制Blob到剪贴板（支持粘贴为文件）
   */
  async function copyBlobToClipboard(blob, fileName) {
    const text = await blob.text()

    try {
      // 尝试使用多种格式复制，以便VSCode识别
      const htmlContent = `<pre style="font-family: monospace;">${escapeHtml(text)}</pre>`

      // 使用 ClipboardItem 同时写入多种格式
      const clipboardItem = new ClipboardItem({
        'text/plain': new Blob([text], { type: 'text/plain' }),
        'text/html': new Blob([htmlContent], { type: 'text/html' }),
      })

      await navigator.clipboard.write([clipboardItem])
      showToast(`已复制: ${fileName} (可粘贴到VSCode)`, 'success')
      console.log('[GitHub脚本] 已复制文件内容，长度:', text.length)
    } catch (e) {
      console.error('[GitHub脚本] Clipboard API 复制失败:', e)

      // 降级方案1: 尝试 writeText
      try {
        await navigator.clipboard.writeText(text)
        showToast(`已复制文件内容: ${fileName}`, 'success')
      } catch (e2) {
        console.error('[GitHub脚本] writeText 也失败:', e2)

        // 降级方案2: 使用 execCommand
        if (fallbackCopyToClipboard(text)) {
          showToast(`已复制文件内容: ${fileName}`, 'success')
        } else {
          showToast(`复制失败，请重试`, 'error')
        }
      }
    }
  }

  /**
   * HTML转义
   */
  function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  /**
   * 显示提示消息
   */
  function showToast(message, type = 'success') {
    // 移除现有 toast
    const existingToast = document.getElementById('github-copy-toast')
    if (existingToast) {
      existingToast.remove()
    }

    const toast = document.createElement('div')
    toast.id = 'github-copy-toast'
    toast.textContent = message

    const colors = {
      success: '#1f883d',
      error: '#cf222e',
      loading: '#0969da',
    }

    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 16px;
      background: ${colors[type] || colors.success};
      color: white;
      border-radius: 6px;
      font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: githubToastFadeIn 0.2s ease;
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `

    // 添加动画样式
    if (!document.getElementById('github-toast-style')) {
      const style = document.createElement('style')
      style.id = 'github-toast-style'
      style.textContent = `
        @keyframes githubToastFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `
      document.head.appendChild(style)
    }

    document.body.appendChild(toast)

    // 自动移除
    setTimeout(() => {
      toast.style.animation = 'githubToastFadeIn 0.2s ease reverse'
      setTimeout(() => toast.remove(), 200)
    }, 2000)
  }

  /**
   * 处理键盘事件
   */
  async function handleKeyDown(event) {
    // 检查是否是 Ctrl+C 或 Cmd+C
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      // 检查是否在输入框中
      const activeElement = document.activeElement
      if (activeElement?.matches('input, textarea, [contenteditable="true"]')) {
        return // 让默认行为处理
      }

      // 检查是否有选中的文本内容
      const selection = window.getSelection()
      if (selection && selection.toString().trim().length > 0) {
        return // 有选中内容，让浏览器默认复制选中内容
      }

      const treeItem = getTargetTreeItem()
      if (!treeItem) return

      const { path, isDirectory } = extractFileInfo(treeItem)
      if (!path) return

      event.preventDefault()

      const repoInfo = getRepoInfo()
      if (!repoInfo) {
        showToast('无法获取仓库信息', 'error')
        return
      }

      const branch = getCurrentBranch()
      const fileName = path.split('/').pop()

      if (isDirectory) {
        // 文件夹：复制路径
        try {
          await navigator.clipboard.writeText(path)
        } catch (e) {
          // 降级方案
          fallbackCopyToClipboard(path)
        }
        showToast(`已复制文件夹路径: ${fileName}`, 'success')
      } else {
        // Ctrl+Shift+C: 下载文件
        if (event.shiftKey) {
          await downloadFile(repoInfo.owner, repoInfo.repo, branch, path, fileName)
        } else {
          // Ctrl+C: 复制文件内容
          await copyFileToClipboard(repoInfo.owner, repoInfo.repo, branch, path, fileName)
        }
      }
    }
  }

  /**
   * 下载文件
   */
  async function downloadFile(owner, repo, branch, path, fileName) {
    const rawUrl = getRawUrl(owner, repo, branch, path)
    showToast(`正在下载: ${fileName}...`, 'loading')

    try {
      const response = await fetch(rawUrl)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.style.display = 'none'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      showToast(`已下载: ${fileName}`, 'success')
      return true
    } catch (err) {
      console.error('[GitHub脚本] 下载失败:', err)
      showToast(`下载失败: ${err.message}`, 'error')
      return false
    }
  }

  /**
   * 初始化
   */
  function init() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init)
      } else {
        setTimeout(init, 50)
      }
      return
    }

    // 监听键盘事件
    document.addEventListener('keydown', handleKeyDown)

    // 监听鼠标移入/移出链接事件（使用事件委托）
    document.addEventListener(
      'mouseenter',
      (e) => {
        // 确保 e.target 是 Element 类型
        if (!e.target || typeof e.target.closest !== 'function') return
        const link = e.target.closest('a[href]')
        if (link) {
          // 检查是否是文件/文件夹链接
          const href = link.getAttribute('href') || ''
          if (href.includes('/blob/') || href.includes('/tree/') || link.closest('[data-path]')) {
            hoveredLink = link
          }
        }
      },
      true
    )

    document.addEventListener(
      'mouseleave',
      (e) => {
        // 确保 e.target 是 Element 类型
        if (!e.target || typeof e.target.closest !== 'function') return
        const link = e.target.closest('a[href]')
        if (link && link === hoveredLink) {
          hoveredLink = null
        }
      },
      true
    )

    console.log('[GitHub脚本] 文件复制已加载 - Ctrl+C 复制文件内容')
  }

  // 立即初始化
  init()
}
