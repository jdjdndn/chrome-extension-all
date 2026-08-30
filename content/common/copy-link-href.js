// 通用脚本：复制链接时用 href 替代链接文字
// 选区包含 <a> 标签时，链接文字替换为 href，其余文字保留
// @match *://*/*

'use strict'
;(function () {
  if (window.CopyLinkHrefLoaded) {
    return
  }
  window.CopyLinkHrefLoaded = true

  function handleCopy(e) {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      return
    }

    const range = sel.getRangeAt(0)

    // commonAncestor 可能是文本节点，取其 parentElement
    const ancestor = range.commonAncestorContainer
    const root = ancestor.nodeType === Node.ELEMENT_NODE ? ancestor : ancestor.parentElement
    if (!root) {
      return
    }

    // 收集选区内与选区有交集的 <a href>
    // root 本身可能是 <a>（单链接选中时），需先检查自身
    const links = []
    if (root.tagName === 'A' && root.href && range.intersectsNode(root)) {
      links.push(root)
    }
    for (const link of root.querySelectorAll('a[href]')) {
      if (range.intersectsNode(link) && link.href) {
        links.push(link)
      }
    }
    if (links.length === 0) {
      return
    }

    // 通过 TreeWalker 遍历选区内容，直接在 DOM 层面定位链接节点
    // 避免 indexOf 子串误匹配问题
    // 当 root 是 <a>（单链接选中）时，从 <a> 自身开始遍历，否则会漏掉链接节点
    const linkSet = new Set(links)
    const nodes = []
    const walkerRoot = root.tagName === 'A' ? root : range.commonAncestorContainer
    const walker = document.createTreeWalker(
      walkerRoot,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT
    )
    let node
    while ((node = walker.nextNode())) {
      if (node.nodeType === Node.TEXT_NODE && range.intersectsNode(node)) {
        // 跳过链接内部的文本节点（链接整体处理，避免重复）
        if (
          node.parentElement &&
          node.parentElement.tagName === 'A' &&
          linkSet.has(node.parentElement)
        ) {
          continue
        }
        nodes.push({ type: 'text', text: node.textContent })
      } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A' && linkSet.has(node)) {
        nodes.push({ type: 'link', link: node })
      }
    }

    console.log(
      '[copy-link-href] walkerRoot:',
      walkerRoot.tagName,
      'nodes:',
      nodes.length,
      'links:',
      links.length
    )

    // TreeWalker 从 <a> 自身开始时 nextNode() 可能跳过根节点，兜底直接补入
    if (
      walkerRoot.tagName === 'A' &&
      linkSet.has(walkerRoot) &&
      !nodes.some((n) => n.type === 'link')
    ) {
      nodes.unshift({ type: 'link', link: walkerRoot })
    }

    // TreeWalker 从 <a> 自身开始时可能遍历异常，兜底：用 links 直接构建
    if (nodes.length === 0) {
      let fallback = ''
      for (const link of links) {
        fallback += `${link.textContent}：${link.href}`
      }
      e.preventDefault()
      e.clipboardData.setData('text/plain', fallback)
      return
    }

    // 按 DOM 顺序拼接输出
    let text = ''
    let hasContent = false
    for (const item of nodes) {
      if (item.type === 'text') {
        text += item.text
        if (item.text.trim().length > 0) {hasContent = true}
      } else {
        const linkText = item.link.textContent
        text += hasContent ? item.link.href : `${linkText}：${item.link.href}`
        hasContent = true
      }
    }

    // 同步写入剪贴板（clipboardData 在 copy 事件回调中可用且无需权限）
    e.preventDefault()
    e.clipboardData.setData('text/plain', text)
  }

  function enable() {
    if (!document.body) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', enable, { once: true })
      } else {
        setTimeout(enable, 50)
      }
      return
    }
    document.addEventListener('copy', handleCopy)
    console.log('[通用脚本] 复制链接href已加载')
  }

  function disable() {
    document.removeEventListener('copy', handleCopy)
    console.log('[通用脚本] 复制链接href已禁用')
  }

  window.addEventListener('beforeunload', disable)

  if (!window.getScriptSwitch || !window.getScriptSwitch('copy-link-href')) {
    console.log('[通用脚本] 复制链接href已禁用')
  } else {
    enable()
  }

  // 监听开关变化
  const onStorageChange = (changes, area) => {
    if (area !== 'local' || !changes.scriptSwitches) {
      return
    }
    const next = changes.scriptSwitches.newValue || {}
    if (next['copy-link-href'] === false) {
      disable()
    } else {
      enable()
    }
  }
  try {
    chrome.storage.onChanged.addListener(onStorageChange)
  } catch {
    // content script 环境外静默失败
  }

  window.CopyLinkHrefDestroy = () => {
    disable()
    window.removeEventListener('beforeunload', disable)
    try {
      chrome.storage.onChanged.removeListener(onStorageChange)
    } catch {
      // content script 环境外静默失败
    }
    window.CopyLinkHrefLoaded = false
  }
})()
