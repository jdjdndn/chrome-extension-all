// 通用脚本：页面宽度扩展为视口80%
// 使用 CSS 注入方式，通过常见选择器匹配网页主体容器
// 依赖: content/utils/logger.js, storage.js, dom.js, messaging.js
// @match *://*/*

'use strict';

if (window.ScriptLoader) {
  ScriptLoader.declare({
    name: 'widen-page',
    dependencies: ['DOMUtils'],
    onReady: () => initWidenPage()
  });
} else {
  initWidenPage();
}

function initWidenPage() {
  if (window.WidenPageLoaded) {
    console.log('[通用脚本] 页面宽度扩展已加载，跳过');
    return;
  }

  if (!window.getScriptSwitch || !window.getScriptSwitch('widen-page')) {
    console.log('[通用脚本] 页面宽度扩展已禁用');
    return;
  }

  window.WidenPageLoaded = true;

  // 常见网页主体容器选择器，按优先级排列
  const RULES = [
    // 语义化标签
    { selector: 'main', style: 'max-width:80vw!important;margin:0 auto!important;width:80vw!important;' },
    // ID 选择器
    { selector: '#app', style: 'max-width:80vw!important;margin:0 auto!important;width:80vw!important;' },
    { selector: '#main', style: 'max-width:80vw!important;margin:0 auto!important;width:80vw!important;' },
    { selector: '#content', style: 'max-width:80vw!important;margin:0 auto!important;width:80vw!important;' },
    // Class 选择器 - 通用容器
    { selector: '.container', style: 'max-width:80vw!important;margin:0 auto!important;' },
    { selector: '.wrapper', style: 'max-width:80vw!important;margin:0 auto!important;' },
    { selector: '.page-wrapper', style: 'max-width:80vw!important;margin:0 auto!important;' },
    { selector: '.content-wrapper', style: 'max-width:80vw!important;margin:0 auto!important;' },
    { selector: '.site-content', style: 'max-width:80vw!important;margin:0 auto!important;' },
    // Class 选择器 - 内容区域
    { selector: '.main-content', style: 'max-width:80vw!important;margin:0 auto!important;' },
    { selector: '.page-content', style: 'max-width:80vw!important;margin:0 auto!important;' },
    { selector: '.post-content', style: 'max-width:80vw!important;margin:0 auto!important;' },
    { selector: '.article-content', style: 'max-width:80vw!important;margin:0 auto!important;' },
  ];

  const STYLE_ID = 'yc-widen-page-style';

  function buildCSS() {
    return RULES.map(r => `${r.selector} { ${r.style} }`).join('\n');
  }

  function inject() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = buildCSS();
    (document.head || document.documentElement).appendChild(style);

    console.log('[通用脚本] 页面宽度扩展已生效 (80vw)');
  }

  function remove() {
    const el = document.getElementById(STYLE_ID);
    if (el) el.remove();
  }

  // 清理
  window.addEventListener('beforeunload', remove);

  // 等待 head 存在后注入
  if (document.head) {
    inject();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', inject);
  } else {
    setTimeout(inject, 50);
  }
}
