// 通用脚本：文本链接生成可点击链接
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*
// @exclude https://greasyfork.org/*

'use strict';

// 使用 ScriptLoader 管理依赖
if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'text-to-link',
    dependencies: ['DOMUtils'],
    onReady: () => initTextToLink()
  });
} else {
  // 降级处理：ScriptLoader 未加载时直接初始化
  initTextToLink();
}

function initTextToLink() {
  if (window.TextToLinkLoaded) {
    console.log('[通用脚本] 文本链接转换已加载，跳过');
    return;
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('text-to-link')) {
    console.log('[通用脚本] 文本链接转换已禁用');
    return;
  }

  window.TextToLinkLoaded = true;

  const YC_ATTR = 'yc-text-link-processed';

  // 匹配链接（支持无协议，支持中文等 Unicode 字符路径）
  const linkRegex = /((https?:\/\/)?|(\/\/))?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]*)/g;

  // 常用顶级域名列表
  const TOP_LEVEL_DOMAINS = ['com', 'net', 'org', 'edu', 'gov', 'mil', 'info', 'biz', 'app', 'shop', 'store', 'xyz', 'top', 'live', 'cn', 'us', 'uk', 'jp', 'de', 'fr', 'ca', 'hk', 'tw', 'mo', 'eu', 'in', 'tv', 'cc', 'cloud', 'site', 'io'];

  // 排除的标签
  const EXCLUDED_TAGS = ['A', 'SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CODE', 'PRE', 'SELECT', 'BUTTON'];

  // 移除重复项
  function removeDuplicates(arr) {
    return arr.filter((item, index, self) => self.indexOf(item) === index);
  }

  // 从后往前遍历数组
  function traverseArrayBackward(arr, callback) {
    for (let i = arr.length - 1; i >= 0; i--) {
      callback(arr[i], i, i === 0);
    }
  }

  // 清理链接末尾的非 URL 字符（如中文、日文、韩文等）
  function cleanLinkEnd(linkStr) {
    // 匹配 TLD 后直接跟随的非 URL 字符（Unicode 字符但不是有效的 URL 路径字符）
    // 有效 URL 字符包括：字母、数字、-._~:/?#[]@!$&'()*+,;=
    // 问题场景：tiez.name666.top下载 -> 应该只保留 tiez.name666.top
    const tldPattern = new RegExp(`\\.(${TOP_LEVEL_DOMAINS.join('|')})`);
    const match = linkStr.match(tldPattern);
    if (match) {
      const tldEndIndex = match.index + match[0].length;
      const afterTld = linkStr.slice(tldEndIndex);
      // 如果 TLD 后面紧跟非 URL 字符（如中文），则截断
      if (afterTld && /^[^\w\/\?#\[\]@!$&'()*+,;=%._~-]/.test(afterTld)) {
        return linkStr.slice(0, tldEndIndex);
      }
    }
    return linkStr;
  }

  // 过滤链接，必须包含顶级域名或为合法IPv4
  function filterLinks(links) {
    if (!links) return [];
    return links.filter(link => {
      if (!link) return false;
      // 支持字符串数组或匹配对象数组
      let linkStr = Array.isArray(link) ? link[0] : link;
      if (typeof linkStr !== 'string') return false;
      // 清理链接末尾的非 URL 字符
      linkStr = cleanLinkEnd(linkStr);
      // 更新原数组中的值
      if (Array.isArray(link)) {
        link[0] = linkStr;
      }
      // 检查是否为 IPv4
      const ipv4Parts = linkStr.split('.');
      const isIpv4 = ipv4Parts.length >= 4 && ipv4Parts.every(part => {
        const num = Number(part);
        return num === num && num >= 0 && num <= 255;
      });
      if (isIpv4) return true;
      // 检查是否包含顶级域名
      return TOP_LEVEL_DOMAINS.some(tld => linkStr.includes(`.${tld}`));
    });
  }

  // 获取文本中的链接
  function getTextLinks(text) {
    const links = text.match(linkRegex);
    return filterLinks(links || []);
  }

  // 获取文本中的链接列表（带位置信息）
  function getTextLinksList(text) {
    const hostRegex = /\b(?!\/\/)((?:www\.)?[a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9_.-]+)*\.[a-zA-Z]{2,})\b/g;
    let newText = text;

    function matchFunc(reg, type) {
      const matches = newText.matchAll(reg);
      const matchArr = [];
      for (const match of matches) {
        const matchStr = match[0];
        const len = matchStr.length;
        newText = newText.replace(matchStr, ' '.repeat(len));
        match.type = type;
        matchArr.push(match);
      }
      return matchArr;
    }

    return filterLinks([...matchFunc(linkRegex, 'url'), ...matchFunc(hostRegex, 'host')]);
  }

  // 分割文本为文本和链接段
  function splitText(text, arr) {
    if (!arr.length) return [{ text, type: 'text' }];
    let lastIndex = 0;
    let returnArr = [];
    arr.forEach((item, i) => {
      const link = item[0];
      const textObj = { text: text.slice(lastIndex, item.index), type: 'text' };
      const linkObj = { text: link, type: 'link' };
      returnArr.push(textObj, linkObj);
      lastIndex = item.index + link.length;
      if (i === arr.length - 1 && lastIndex < text.length) {
        returnArr.push({ text: text.slice(lastIndex), type: 'text' });
      }
    });
    return returnArr;
  }

  // 创建链接标签
  function createLink(link) {
    const a = document.createElement('a');
    a.href = link.indexOf('//') > -1 ? link : '//' + link;
    a.textContent = link;
    a.target = '_blank';
    a.rel = 'noopener noreferrer nofollow';
    a.style.color = '#0066cc';
    a.setAttribute(YC_ATTR, 'true');
    return a;
  }

  // 根据类型创建节点
  function createNode(type, text) {
    switch (type) {
      case 'link':
        return createLink(text);
      case 'text':
        return document.createTextNode(text);
      default:
        return document.createTextNode(text);
    }
  }

  // 检查是否有父辈元素是 a 链接
  function hasAnchorAncestor(node) {
    if (!node || !node.parentNode) return false;
    let current = node.parentNode;
    while (current && current !== document.body) {
      if (current.tagName === 'A') return true;
      current = current.parentNode;
    }
    return false;
  }

  // 遍历 DOM 树收集包含链接的文本节点
  function createTextNodeTree(matchObj = {}, node, parent) {
    if (!node) return matchObj;
    if (parent && EXCLUDED_TAGS.includes(parent.nodeName)) return matchObj;
    if (hasAnchorAncestor(node)) return matchObj;

    if (node.nodeType === Node.TEXT_NODE) {
      const textContent = node.textContent;
      // 空文本或纯空白不处理
      if (!textContent || textContent.trim().length === 0) return matchObj;
      const matches = getTextLinks(textContent);
      matches.forEach(match => {
        if (matchObj[match] && matchObj[match].length > 0) {
          matchObj[match].push(node);
        } else {
          matchObj[match] = [node];
        }
      });
    }

    // 处理 shadowRoot
    if (node.shadowRoot) {
      for (const shadowChild of node.shadowRoot.childNodes) {
        createTextNodeTree(matchObj, shadowChild, node.shadowRoot);
      }
    }

    // 遍历子节点
    if (node.childNodes) {
      for (const child of node.childNodes) {
        createTextNodeTree(matchObj, child, node);
      }
    }

    return matchObj;
  }

  // 处理链接转换
  function processLinks() {
    const matchObj = createTextNodeTree({}, document.body, null);
    for (const match in matchObj) {
      if (Object.hasOwnProperty.call(matchObj, match)) {
        const nodeList = removeDuplicates(matchObj[match]);
        nodeList.forEach(node => {
          // 检查节点是否仍在 DOM 中
          if (!node.parentNode) return;
          const generateNodeList = splitText(node.textContent, getTextLinksList(node.textContent));
          traverseArrayBackward(generateNodeList, ({ type, text }, _i, isLast) => {
            try {
              // 再次检查节点是否仍在 DOM 中
              if (!node.parentNode) return;
              if (isLast) {
                node.parentNode.replaceChild(createNode(type, text), node);
              } else if (node.nextSibling) {
                node.parentNode.insertBefore(createNode(type, text), node.nextSibling);
              } else {
                node.parentNode.appendChild(createNode(type, text));
              }
            } catch (error) {
              // 忽略错误
            }
          });
        });
      }
    }
  }

  // 初始化函数：确保 document.body 存在后执行
  function init() {
    if (!document.body) {
      // DOM 未准备好，等待 DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
      } else {
        // 极端情况：readyState 不是 loading 但 body 也不存在
        setTimeout(init, 50);
      }
      return;
    }

    // 防抖处理 - 使用 DOMUtils.debounce（在 init 内部调用确保 DOMUtils 已加载）
    const debouncedProcessLinks = DOMUtils.debounce(processLinks, 500);

    // 使用 MutationObserver 监听 DOM 变化
    const observer = new MutationObserver((mutations) => {
      debouncedProcessLinks();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // 存储 observer 以便清理
    window._ycTextToLinkObserver = observer;

    // 延迟执行初始处理
    setTimeout(processLinks, 1000);

    console.log('[通用脚本] 文本链接转换已加载');
  }

  // 清理函数
  function cleanup() {
    if (window._ycTextToLinkObserver) {
      window._ycTextToLinkObserver.disconnect();
      window._ycTextToLinkObserver = null;
    }
  }

  // 页面卸载时清理
  window.addEventListener('beforeunload', cleanup);

  // 立即尝试初始化
  init();
}
