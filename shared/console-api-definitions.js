/**
 * Console API 定义
 * 可注入到页面上下文的工具函数
 */

export const ConsoleAPIDefinitions = {
  // API 定义列表
  apis: [
    {
      name: '$selector',
      description: '增强版 CSS 选择器，返回元素或元素数组',
      category: 'DOM 查询',
      signature: '$selector(selector, all = false)',
      code: `function $selector(selector, all = false) {
  const elements = all
    ? document.querySelectorAll(selector)
    : document.querySelector(selector);
  return elements;
}`
    },
    {
      name: '$xpath',
      description: 'XPath 选择器',
      category: 'DOM 查询',
      signature: '$xpath(xpath, context = document)',
      code: `function $xpath(xpath, context = document) {
  const result = document.evaluate(
    xpath,
    context,
    null,
    XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
    null
  );
  const elements = [];
  for (let i = 0; i < result.snapshotLength; i++) {
    elements.push(result.snapshotItem(i));
  }
  return elements.length === 1 ? elements[0] : elements;
}`
    },
    {
      name: '$parent',
      description: '查找元素的父元素（支持选择器）',
      category: 'DOM 查询',
      signature: '$parent(element, selector)',
      code: `function $parent(element, selector) {
  let el = element?.parentElement;
  while (el) {
    if (!selector || el.matches(selector)) return el;
    el = el.parentElement;
  }
  return null;
}`
    },
    {
      name: '$children',
      description: '获取元素的所有子元素（支持过滤）',
      category: 'DOM 查询',
      signature: '$children(element, selector = null)',
      code: `function $children(element, selector = null) {
  if (!element) return [];
  const children = Array.from(element.children);
  return selector ? children.filter(c => c.matches(selector)) : children;
}`
    },
    {
      name: '$siblings',
      description: '获取元素的所有兄弟元素',
      category: 'DOM 查询',
      signature: '$siblings(element, selector = null)',
      code: `function $siblings(element, selector = null) {
  if (!element?.parentElement) return [];
  const siblings = Array.from(element.parentElement.children).filter(c => c !== element);
  return selector ? siblings.filter(c => c.matches(selector)) : siblings;
}`
    },
    {
      name: 'extractLinks',
      description: '提取页面所有链接',
      category: '数据提取',
      signature: 'extractLinks(filter = "")',
      code: `function extractLinks(filter = "") {
  return Array.from(document.querySelectorAll('a[href]'))
    .filter(a => !filter || a.href.includes(filter))
    .map(a => ({ text: a.textContent.trim(), href: a.href }));
}`
    },
    {
      name: 'extractImages',
      description: '提取页面所有图片',
      category: '数据提取',
      signature: 'extractImages()',
      code: `function extractImages() {
  return Array.from(document.querySelectorAll('img'))
    .map(img => ({
      src: img.src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight
    }));
}`
    },
    {
      name: 'extractText',
      description: '提取元素文本内容',
      category: '数据提取',
      signature: 'extractText(selector = "body")',
      code: `function extractText(selector = "body") {
  const el = document.querySelector(selector);
  return el ? el.textContent.trim() : '';
}`
    },
    {
      name: 'extractTable',
      description: '提取表格数据为 JSON',
      category: '数据提取',
      signature: 'extractTable(selector = "table")',
      code: `function extractTable(selector = "table") {
  const table = document.querySelector(selector);
  if (!table) return [];

  const headers = Array.from(table.querySelectorAll('th')).map(th => th.textContent.trim());
  const rows = Array.from(table.querySelectorAll('tbody tr'));

  return rows.map(row => {
    const cells = Array.from(row.querySelectorAll('td'));
    const obj = {};
    cells.forEach((cell, i) => {
      obj[headers[i] || \`col\${i}\`] = cell.textContent.trim();
    });
    return obj;
  });
}`
    },
    {
      name: 'highlight',
      description: '高亮显示匹配的元素',
      category: 'DOM 操作',
      signature: 'highlight(selector, color = "red")',
      code: `function highlight(selector, color = "red") {
  const elements = document.querySelectorAll(selector);
  elements.forEach(el => {
    el.style.outline = \`2px solid \${color}\`;
    el.style.outlineOffset = '2px';
  });
  console.log(\`已高亮 \${elements.length} 个元素\`);
  return elements;
}`
    },
    {
      name: 'unhighlight',
      description: '取消高亮',
      category: 'DOM 操作',
      signature: 'unhighlight(selector = "*")',
      code: `function unhighlight(selector = "*") {
  document.querySelectorAll(selector).forEach(el => {
    el.style.outline = '';
    el.style.outlineOffset = '';
  });
  console.log('已取消高亮');
}`
    },
    {
      name: 'hideElements',
      description: '隐藏匹配的元素',
      category: 'DOM 操作',
      signature: 'hideElements(selector)',
      code: `function hideElements(selector) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(el => el.style.display = 'none');
  console.log(\`已隐藏 \${elements.length} 个元素\`);
  return elements.length;
}`
    },
    {
      name: 'showElements',
      description: '显示被隐藏的元素',
      category: 'DOM 操作',
      signature: 'showElements(selector)',
      code: `function showElements(selector) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(el => el.style.display = '');
  console.log(\`已显示 \${elements.length} 个元素\`);
  return elements.length;
}`
    },
    {
      name: 'removeElements',
      description: '删除匹配的元素',
      category: 'DOM 操作',
      signature: 'removeElements(selector)',
      code: `function removeElements(selector) {
  const elements = document.querySelectorAll(selector);
  elements.forEach(el => el.remove());
  console.log(\`已删除 \${elements.length} 个元素\`);
  return elements.length;
}`
    },
    {
      name: 'clickElements',
      description: '点击匹配的所有元素',
      category: 'DOM 操作',
      signature: 'clickElements(selector, delay = 0)',
      code: `async function clickElements(selector, delay = 0) {
  const elements = document.querySelectorAll(selector);
  for (const el of elements) {
    el.click();
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
  }
  console.log(\`已点击 \${elements.length} 个元素\`);
  return elements.length;
}`
    },
    {
      name: 'copyToClipboard',
      description: '复制文本到剪贴板',
      category: '工具函数',
      signature: 'copyToClipboard(text)',
      code: `async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
  console.log('已复制到剪贴板');
}`
    },
    {
      name: 'downloadJSON',
      description: '下载数据为 JSON 文件',
      category: '工具函数',
      signature: 'downloadJSON(data, filename = "data.json")',
      code: `function downloadJSON(data, filename = "data.json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  console.log(\`已下载: \${filename}\`);
}`
    },
    {
      name: 'downloadCSV',
      description: '下载数据为 CSV 文件',
      category: '工具函数',
      signature: 'downloadCSV(data, filename = "data.csv")',
      code: `function downloadCSV(data, filename = "data.csv") {
  if (!Array.isArray(data) || data.length === 0) {
    console.error('数据必须是非空数组');
    return;
  }
  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = String(row[h] ?? '').replace(/"/g, '""');
      return \`"\${val}"\`;
    }).join(','))
  ].join('\\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  console.log(\`已下载: \${filename}\`);
}`
    },
    {
      name: 'logJSON',
      description: '格式化输出 JSON',
      category: '工具函数',
      signature: 'logJSON(obj)',
      code: `function logJSON(obj) {
  console.log(JSON.stringify(obj, null, 2));
}`
    },
    {
      name: 'logTable',
      description: '表格形式输出数据',
      category: '工具函数',
      signature: 'logTable(data, columns = null)',
      code: `function logTable(data, columns = null) {
  if (columns) {
    const filtered = data.map(item => {
      const obj = {};
      columns.forEach(c => obj[c] = item[c]);
      return obj;
    });
    console.table(filtered);
  } else {
    console.table(data);
  }
}`
    },
    {
      name: 'getPageInfo',
      description: '获取页面基本信息',
      category: '信息获取',
      signature: 'getPageInfo()',
      code: `function getPageInfo() {
  return {
    title: document.title,
    url: location.href,
    domain: location.hostname,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    documentSize: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight
    },
    elementCount: document.querySelectorAll('*').length
  };
}`
    },
    {
      name: 'getPerformance',
      description: '获取页面性能数据',
      category: '信息获取',
      signature: 'getPerformance()',
      code: `function getPerformance() {
  const nav = performance.getEntriesByType('navigation')[0];
  const resources = performance.getEntriesByType('resource');

  return {
    navigation: nav ? {
      dns: Math.round(nav.domainLookupEnd - nav.domainLookupStart),
      tcp: Math.round(nav.connectEnd - nav.connectStart),
      request: Math.round(nav.responseEnd - nav.requestStart),
      dom: Math.round(nav.domComplete - nav.domInteractive),
      total: Math.round(nav.loadEventEnd - nav.fetchStart)
    } : null,
    resourceCount: resources.length,
    resourceSize: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024) + 'KB'
  };
}`
    },
    {
      name: 'waitFor',
      description: '等待元素出现',
      category: '异步工具',
      signature: 'waitFor(selector, timeout = 10000)',
      code: `function waitFor(selector, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        observer.disconnect();
        resolve(el);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(\`等待元素超时: \${selector}\`));
    }, timeout);
  });
}`
    },
    {
      name: 'wait',
      description: '等待指定毫秒',
      category: '异步工具',
      signature: 'wait(ms)',
      code: `function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}`
    },
    {
      name: 'scrollTo',
      description: '滚动到指定位置或元素',
      category: 'DOM 操作',
      signature: 'scrollTo(target, behavior = "smooth")',
      code: `function scrollTo(target, behavior = "smooth") {
  if (typeof target === 'string') {
    const el = document.querySelector(target);
    if (el) el.scrollIntoView({ behavior });
  } else if (typeof target === 'number') {
    window.scrollTo({ top: target, behavior });
  } else if (target instanceof Element) {
    target.scrollIntoView({ behavior });
  }
}`
    }
  ],

  // 获取所有分类
  getCategories() {
    const categories = new Set(this.apis.map(a => a.category));
    return [...categories];
  },

  // 按分类获取 API
  getByCategory(category) {
    return this.apis.filter(a => a.category === category);
  },

  // 按名称获取 API
  getByName(name) {
    return this.apis.find(a => a.name === name);
  },

  // 搜索 API
  search(keyword) {
    const kw = keyword.toLowerCase();
    return this.apis.filter(a =>
      a.name.toLowerCase().includes(kw) ||
      a.description.toLowerCase().includes(kw) ||
      a.category.toLowerCase().includes(kw)
    );
  },

  // 生成注入脚本
  generateInjectionScript(selectedApis = null) {
    const apisToInject = selectedApis
      ? this.apis.filter(a => selectedApis.includes(a.name))
      : this.apis;

    return `
(function() {
  'use strict';
  ${apisToInject.map(api => api.code).join('\n\n')}
  console.log('[DevTools Helper] 已注入 ${apisToInject.length} 个工具函数');
})();
`;
  }
};

export default ConsoleAPIDefinitions;
