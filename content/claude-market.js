// ClaudeMarket 脚本：移入 GitHub 链接时 Ctrl+C 直接下载文件
// @match *://claudemarketplaces.com/*
// @match *://*.claudemarketplaces.com/*

'use strict';

if (window.ClaudeMarketCopyLoaded) {
  console.log('[ClaudeMarket] 已加载，跳过');
} else {
  window.ClaudeMarketCopyLoaded = true;

  // 保存原始 fetch
  const _originalFetch = window._originalFetch || window.fetch.bind(window);

  // 状态
  let hoveredGithubLink = null;
  let isDownloading = false;
  let lastTriggerTime = 0;
  const DEBOUNCE_DELAY = 1000;

  /**
   * 解析 GitHub URL
   */
  function parseGithubUrl(url) {
    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;

      // blob 格式
      const blobMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
      if (blobMatch) {
        return {
          owner: blobMatch[1],
          repo: blobMatch[2],
          branch: blobMatch[3],
          path: blobMatch[4],
          isDirectory: false,
          fileName: blobMatch[4].split('/').pop(),
          isRepoRoot: false
        };
      }

      // tree 格式
      const treeMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/);
      if (treeMatch) {
        return {
          owner: treeMatch[1],
          repo: treeMatch[2],
          branch: treeMatch[3],
          path: treeMatch[4],
          isDirectory: true,
          fileName: treeMatch[4].split('/').pop(),
          isRepoRoot: false
        };
      }

      // 仓库根目录
      const repoMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/?$/);
      if (repoMatch) {
        return {
          owner: repoMatch[1],
          repo: repoMatch[2],
          branch: 'main',
          path: '',
          isDirectory: true,
          fileName: `${repoMatch[2]}.zip`,
          isRepoRoot: true
        };
      }

      // raw.githubusercontent.com
      if (urlObj.hostname === 'raw.githubusercontent.com') {
        const rawMatch = pathname.match(/^\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/);
        if (rawMatch) {
          return {
            owner: rawMatch[1],
            repo: rawMatch[2],
            branch: rawMatch[3],
            path: rawMatch[4],
            isDirectory: false,
            fileName: rawMatch[4].split('/').pop(),
            isRepoRoot: false
          };
        }
      }

      return null;
    } catch (e) {
      return null;
    }
  }

  /**
   * 显示 Toast
   */
  function showToast(message, type = 'success') {
    const existingToast = document.getElementById('claude-market-toast');
    if (existingToast) existingToast.remove();

    const toast = document.createElement('div');
    toast.id = 'claude-market-toast';
    toast.textContent = message;

    const colors = { success: '#1f883d', error: '#cf222e', loading: '#0969da' };

    toast.style.cssText = `
      position: fixed; bottom: 20px; right: 20px;
      padding: 10px 16px; background: ${colors[type] || colors.success};
      color: white; border-radius: 6px; font-size: 14px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      z-index: 2147483647; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: claudeToastFadeIn 0.2s ease;
    `;

    if (!document.getElementById('claude-market-toast-style')) {
      const style = document.createElement('style');
      style.id = 'claude-market-toast-style';
      style.textContent = `
        @keyframes claudeToastFadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'claudeToastFadeIn 0.2s ease reverse';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  }

  /**
   * 获取仓库默认分支
   */
  async function getDefaultBranch(owner, repo) {
    try {
      const response = await _originalFetch(`https://api.github.com/repos/${owner}/${repo}`);
      if (response.ok) {
        const data = await response.json();
        return data.default_branch || 'main';
      }
    } catch (e) {}
    return 'main';
  }

  /**
   * 下载文件
   */
  async function downloadGithubFile(githubInfo) {
    const { owner, repo, fileName, isDirectory, isRepoRoot } = githubInfo;

    if (isRepoRoot) {
      const actualBranch = await getDefaultBranch(owner, repo);
      const zipUrl = `https://github.com/${owner}/${repo}/archive/refs/heads/${actualBranch}.zip`;
      showToast(`正在下载: ${repo}.zip...`, 'loading');

      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_FILE',
        url: zipUrl,
        fileName: `${repo}.zip`
      }, (response) => {
        isDownloading = false;
        if (response?.success) {
          showToast(`已开始下载: ${repo}.zip`, 'success');
        } else {
          showToast(`下载失败`, 'error');
        }
      });
      return;
    }

    if (isDirectory) {
      isDownloading = false;
      showToast('不支持下载文件夹', 'error');
      return;
    }

    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${githubInfo.branch}/${githubInfo.path}`;
    showToast(`正在下载: ${fileName}...`, 'loading');

    chrome.runtime.sendMessage({
      type: 'DOWNLOAD_FILE',
      url: rawUrl,
      fileName: fileName
    }, (response) => {
      isDownloading = false;
      if (response?.success) {
        showToast(`已开始下载: ${fileName}`, 'success');
      } else {
        showToast(`下载失败`, 'error');
      }
    });
  }

  /**
   * 键盘事件处理
   */
  async function handleKeyDown(event) {
    if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
      // 防抖
      if (isDownloading) return;
      const now = Date.now();
      if (now - lastTriggerTime < DEBOUNCE_DELAY) return;
      lastTriggerTime = now;

      // 跳过输入框
      if (document.activeElement?.matches('input, textarea, [contenteditable="true"]')) return;

      // 检查悬停链接
      if (!hoveredGithubLink) return;

      const href = hoveredGithubLink.getAttribute('href');
      if (!href) return;

      const githubInfo = parseGithubUrl(href);
      if (!githubInfo) {
        showToast('无法解析 GitHub 链接', 'error');
        return;
      }

      event.preventDefault();
      isDownloading = true;
      await downloadGithubFile(githubInfo);
    }
  }

  /**
   * 检查是否是 GitHub 链接
   */
  function isGithubLink(url) {
    try {
      const urlObj = new URL(url);
      return ['github.com', 'www.github.com', 'raw.githubusercontent.com'].includes(urlObj.hostname);
    } catch (e) {
      return false;
    }
  }

  /**
   * 从事件路径查找 GitHub 链接
   */
  function findGithubLinkInPath(event) {
    const path = event.composedPath ? event.composedPath() : [event.target];
    for (const el of path) {
      if (el?.nodeType === Node.ELEMENT_NODE && el.matches?.('a[href]')) {
        const href = el.getAttribute('href');
        if (href && isGithubLink(href)) return el;
      }
    }
    return null;
  }

  /**
   * 初始化
   */
  function init() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        setTimeout(init, 50);
      }
      return;
    }

    // 键盘事件
    window.addEventListener('keydown', handleKeyDown, true);

    // 鼠标悬停
    document.addEventListener('mouseover', (e) => {
      const link = findGithubLinkInPath(e);
      if (link) {
        hoveredGithubLink = link;
        link.style.outline = '2px dashed #0969da';
        link.style.outlineOffset = '2px';
      }
    });

    document.addEventListener('mouseout', (e) => {
      const link = findGithubLinkInPath(e);
      if (link === hoveredGithubLink) {
        hoveredGithubLink = null;
        link.style.outline = '';
        link.style.outlineOffset = '';
      }
    });

    console.log('[ClaudeMarket] 已加载');
  }

  init();
}
