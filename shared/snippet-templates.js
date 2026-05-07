/**
 * 代码片段预设模板
 * 包含常用的调试和提取工具
 */

export const SnippetTemplates = {
  presets: [
    {
      id: 'extract-links',
      name: '提取页面所有链接',
      description: '提取页面中所有链接的文本和 URL',
      category: '数据提取',
      code: `const links = Array.from(document.querySelectorAll('a[href]'))
  .map(a => ({
    text: a.textContent.trim().slice(0, 50),
    href: a.href
  }))
  .filter(l => l.href && !l.href.startsWith('javascript:'));
console.table(links);
return links;`,
    },
    {
      id: 'extract-images',
      name: '提取页面所有图片',
      description: '提取页面中所有图片的 URL 和尺寸',
      category: '数据提取',
      code: `const images = Array.from(document.querySelectorAll('img'))
  .map(img => ({
    src: img.src,
    alt: img.alt,
    width: img.naturalWidth,
    height: img.naturalHeight
  }))
  .filter(img => img.src);
console.table(images);
return images;`,
    },
    {
      id: 'extract-forms',
      name: '提取表单数据',
      description: '提取页面中所有表单的字段信息',
      category: '数据提取',
      code: `const forms = Array.from(document.forms).map((form, i) => ({
  index: i,
  action: form.action,
  method: form.method,
  fields: Array.from(form.elements).map(el => ({
    name: el.name,
    type: el.type,
    value: el.value?.slice(0, 50)
  }))
}));
console.log('找到', forms.length, '个表单');
forms.forEach((f, i) => {
  console.log(\`表单 \${i + 1}: \${f.action}\`);
  console.table(f.fields);
});
return forms;`,
    },
    {
      id: 'extract-scripts',
      name: '提取页面脚本',
      description: '提取页面中所有 script 标签的 src',
      category: '数据提取',
      code: `const scripts = Array.from(document.querySelectorAll('script[src]'))
  .map(s => s.src);
console.log('外部脚本:', scripts.length);
scripts.forEach((s, i) => console.log(\`\${i + 1}. \${s}\`));
return scripts;`,
    },
    {
      id: 'extract-stylesheets',
      name: '提取样式表',
      description: '提取页面中所有样式表链接',
      category: '数据提取',
      code: `const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
  .map(l => l.href);
console.log('样式表:', styles.length);
styles.forEach((s, i) => console.log(\`\${i + 1}. \${s}\`));
return styles;`,
    },
    {
      id: 'extract-meta',
      name: '提取 Meta 信息',
      description: '提取页面的 meta 标签信息',
      category: '数据提取',
      code: `const metas = Array.from(document.querySelectorAll('meta'))
  .map(m => ({
    name: m.name || m.property || m.getAttribute('itemprop'),
    content: m.content?.slice(0, 100)
  }))
  .filter(m => m.name);
console.table(metas);
return metas;`,
    },
    {
      id: 'extract-localStorage',
      name: '提取 LocalStorage',
      description: '提取当前域名的 localStorage 数据',
      category: '数据提取',
      code: `const data = Object.entries(localStorage)
  .map(([key, value]) => ({
    key,
    value: value?.slice(0, 200),
    size: new Blob([value]).size
  }));
console.table(data);
console.log('总大小:', data.reduce((a, b) => a + b.size, 0), 'bytes');
return data;`,
    },
    {
      id: 'extract-cookies',
      name: '提取 Cookies',
      description: '解析当前页面的 cookies',
      category: '数据提取',
      code: `const cookies = document.cookie.split('; ')
  .filter(c => c)
  .map(c => {
    const [name, ...values] = c.split('=');
    return { name, value: values.join('=')?.slice(0, 100) };
  });
console.table(cookies);
return cookies;`,
    },
    {
      id: 'highlight-links',
      name: '高亮所有链接',
      description: '高亮显示页面中所有链接',
      category: 'DOM 操作',
      code: `document.querySelectorAll('a[href]').forEach(a => {
  a.style.outline = '2px solid red';
  a.style.background = 'rgba(255,0,0,0.1)';
});
console.log('已高亮', document.querySelectorAll('a[href]').length, '个链接');`,
    },
    {
      id: 'highlight-images',
      name: '高亮所有图片',
      description: '高亮显示页面中所有图片',
      category: 'DOM 操作',
      code: `document.querySelectorAll('img').forEach(img => {
  img.style.outline = '3px solid blue';
  img.style.background = 'rgba(0,0,255,0.1)';
});
console.log('已高亮', document.querySelectorAll('img').length, '张图片');`,
    },
    {
      id: 'remove-hidden',
      name: '移除隐藏元素',
      description: '移除页面上 display:none 的元素',
      category: 'DOM 操作',
      code: `const hidden = Array.from(document.querySelectorAll('*'))
  .filter(el => getComputedStyle(el).display === 'none');
hidden.forEach(el => el.remove());
console.log('已移除', hidden.length, '个隐藏元素');`,
    },
    {
      id: 'show-invisible',
      name: '显示隐藏内容',
      description: '显示被隐藏的元素（opacity:0, visibility:hidden）',
      category: 'DOM 操作',
      code: `document.querySelectorAll('*').forEach(el => {
  const style = getComputedStyle(el);
  if (style.opacity === '0') {
    el.style.opacity = '1';
    el.style.outline = '2px dashed orange';
  }
  if (style.visibility === 'hidden') {
    el.style.visibility = 'visible';
    el.style.outline = '2px dashed purple';
  }
});
console.log('已显示隐藏内容');`,
    },
    {
      id: 'click-all-buttons',
      name: '点击所有按钮',
      description: '点击页面上所有可见按钮（谨慎使用）',
      category: 'DOM 操作',
      code: `const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'))
  .filter(btn => btn.offsetParent !== null);
console.log('找到', buttons.length, '个可见按钮');
buttons.forEach((btn, i) => {
  console.log(\`点击按钮 \${i + 1}:\`, btn.textContent?.trim().slice(0, 30) || btn.value);
  btn.click();
});`,
    },
    {
      id: 'scroll-to-bottom',
      name: '滚动到底部',
      description: '平滑滚动到页面底部',
      category: 'DOM 操作',
      code: `window.scrollTo({
  top: document.body.scrollHeight,
  behavior: 'smooth'
});
console.log('正在滚动到底部...');`,
    },
    {
      id: 'get-page-info',
      name: '获取页面信息',
      description: '获取页面基本信息（标题、URL、大小等）',
      category: '调试工具',
      code: `const info = {
  title: document.title,
  url: location.href,
  domain: location.hostname,
  protocol: location.protocol,
  viewport: {
    width: window.innerWidth,
    height: window.innerHeight
  },
  document: {
    width: document.documentElement.scrollWidth,
    height: document.documentElement.scrollHeight
  },
  elements: document.querySelectorAll('*').length,
  scripts: document.querySelectorAll('script').length,
  styles: document.querySelectorAll('link[rel="stylesheet"]').length,
  images: document.querySelectorAll('img').length,
  links: document.querySelectorAll('a').length
};
console.table(info);
return info;`,
    },
    {
      id: 'find-event-listeners',
      name: '查找事件监听器',
      description: '尝试查找元素上的事件监听器（需要 DevTools）',
      category: '调试工具',
      code: `// 注意：此功能需要 getEventListeners API，仅在 DevTools Console 中可用
const elements = document.querySelectorAll('button, a, input');
console.log('常见交互元素:', elements.length);
console.log('请在 DevTools 中使用 getEventListeners(element) 查看具体监听器');
console.log('示例: getEventListeners(document.querySelector("button"))');`,
    },
    {
      id: 'measure-performance',
      name: '测量页面性能',
      description: '获取页面加载性能数据',
      category: '调试工具',
      code: `const perf = performance.getEntriesByType('navigation')[0];
if (perf) {
  console.table({
    'DNS 查询': Math.round(perf.domainLookupEnd - perf.domainLookupStart) + 'ms',
    'TCP 连接': Math.round(perf.connectEnd - perf.connectStart) + 'ms',
    '请求响应': Math.round(perf.responseEnd - perf.requestStart) + 'ms',
    'DOM 解析': Math.round(perf.domComplete - perf.domInteractive) + 'ms',
    '总加载时间': Math.round(perf.loadEventEnd - perf.fetchStart) + 'ms'
  });
}
// 资源加载时间
const resources = performance.getEntriesByType('resource')
  .slice(0, 10)
  .map(r => ({
    name: r.name.split('/').pop().slice(0, 40),
    duration: Math.round(r.duration) + 'ms',
    size: r.transferSize ? (r.transferSize / 1024).toFixed(1) + 'KB' : '未知'
  }));
console.log('加载时间最长的资源:');
console.table(resources);`,
    },
    {
      id: 'json-stringify',
      name: 'JSON 格式化',
      description: '将剪贴板中的 JSON 格式化输出',
      category: '调试工具',
      code: `// 读取剪贴板并格式化 JSON
navigator.clipboard.readText().then(text => {
  try {
    const obj = JSON.parse(text);
    const formatted = JSON.stringify(obj, null, 2);
    console.log(formatted);
    navigator.clipboard.writeText(formatted);
    console.log('已格式化并复制到剪贴板');
  } catch (e) {
    console.error('解析 JSON 失败:', e.message);
  }
});`,
    },
    {
      id: 'copy-selector',
      name: '生成元素选择器',
      description: '为当前悬停的元素生成 CSS 选择器',
      category: '调试工具',
      code: `document.addEventListener('mouseover', function handler(e) {
  const el = e.target;
  el.style.outline = '2px solid red';
  setTimeout(() => el.style.outline = '', 500);

  // 生成选择器
  let selector = el.tagName.toLowerCase();
  if (el.id) selector += '#' + el.id;
  if (el.className && typeof el.className === 'string') {
    selector += '.' + el.className.trim().split(/\\s+/).join('.');
  }

  console.log('选择器:', selector);
  console.log('元素:', el);
  console.log('按 Ctrl+C 复制选择器');
}, { once: false });`,
    },
    {
      id: 'monitor-console',
      name: '监控 Console 调用',
      description: '拦截并记录 console 方法调用',
      category: '调试工具',
      code: `(function() {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };
  const logs = [];

  ['log', 'warn', 'error', 'info'].forEach(method => {
    console[method] = function(...args) {
      logs.push({
        type: method,
        time: new Date().toISOString(),
        args: args.map(a => typeof a === 'object' ? JSON.stringify(a).slice(0, 100) : String(a).slice(0, 100))
      });
      originalConsole[method].apply(console, args);
    };
  });

  window.getConsoleLogs = () => logs;
  window.clearConsoleLogs = () => { logs.length = 0; };
  window.restoreConsole = () => {
    Object.assign(console, originalConsole);
  };
  console.log('Console 监控已启动，使用 getConsoleLogs() 获取日志');
})();`,
    },
  ],

  // 获取所有分类
  getCategories() {
    const categories = new Set(this.presets.map((p) => p.category))
    return [...categories]
  },

  // 按分类获取模板
  getByCategory(category) {
    return this.presets.filter((p) => p.category === category)
  },

  // 按 ID 获取模板
  getById(id) {
    return this.presets.find((p) => p.id === id)
  },

  // 搜索模板
  search(keyword) {
    const kw = keyword.toLowerCase()
    return this.presets.filter(
      (p) =>
        p.name.toLowerCase().includes(kw) ||
        p.description.toLowerCase().includes(kw) ||
        p.category.toLowerCase().includes(kw)
    )
  },
}

// 默认导出
export default SnippetTemplates
