// 通用脚本：根据页面标题生成文档
// @match *://*/*
// 功能：提取页面标题和内容，生成格式化文档，浮动工具栏展示
// 支持拖拽移动面板位置

'use strict';

if (window.DocGeneratorLoaded) {
  console.log('[文档生成器] 已加载，跳过');
} else {
  window.DocGeneratorLoaded = true;

  const CONTAINER_ID = 'yc-doc-generator-container';
  const TOOLBAR_ID = 'yc-doc-toolbar';
  const PANEL_ID = 'yc-doc-panel';
  const STORAGE_KEY = 'yc-doc-generator-position';

  class DocGenerator {
    constructor() {
      this.isVisible = true;
      this.isMinimized = true;
      this.collectedContent = [];
      this.outlineCount = 0;
      this.isDragging = false;
      this.dragStart = null;
      this.panelStart = null;
      this.init();
    }

    init() {
      if (document.getElementById(CONTAINER_ID)) return;
      this.createUI();
      this.bindEvents();
      this.registerToPositionManager();
      console.log('[文档生成器] 初始化完成');
    }

    // 注册到位置管理器
    registerToPositionManager() {
      if (window.PanelPositionManager) {
        const toolbar = document.getElementById(TOOLBAR_ID);
        const panel = document.getElementById(PANEL_ID);

        window.PanelPositionManager.register({
          id: 'doc-generator',
          priority: 1, // 优先级高，排在上面
          iconEl: toolbar,
          panelEl: panel,
          requiresHTags: true  // 显式声明需要 H 标签
        });
      }
    }

    createUI() {
      // 创建容器
      const container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.innerHTML = `
        <div id="${TOOLBAR_ID}" class="yc-doc-toolbar">
          <button class="yc-doc-btn" data-action="generate" title="生成文档">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
          </button>
          <button class="yc-doc-btn" data-action="collect" title="收集选中内容">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </button>
          <button class="yc-doc-btn" data-action="toggle" title="展开/收起面板">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
          <button class="yc-doc-btn yc-doc-btn-close" data-action="close" title="关闭">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div id="${PANEL_ID}" class="yc-doc-panel yc-doc-hidden">
          <div class="yc-doc-panel-header yc-drag-handle">
            <span class="yc-doc-title">📄 文档生成器</span>
            <div class="yc-doc-panel-actions">
              <button class="yc-doc-btn-sm" data-action="copy" title="复制">复制</button>
              <button class="yc-doc-btn-sm" data-action="download" title="下载">下载</button>
              <button class="yc-doc-btn-sm" data-action="clear" title="清空">清空</button>
            </div>
          </div>
          <div class="yc-doc-panel-body">
            <div class="yc-doc-content"></div>
          </div>
          <div class="yc-doc-status">
            <span class="yc-doc-count">0 项内容</span>
          </div>
        </div>
      `;

      document.body.appendChild(container);
      this.injectStyles();
    }

    injectStyles() {
      if (document.getElementById('yc-doc-generator-styles')) return;

      const style = document.createElement('style');
      style.id = 'yc-doc-generator-styles';
      style.textContent = `
        #${CONTAINER_ID} {
          position: fixed;
          z-index: 2147483630;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }

        .yc-doc-toolbar {
          position: fixed;
          right: 20px;
          top: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border-radius: 12px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 4px 20px rgba(102, 126, 234, 0.4);
          transition: all 0.3s ease;
          z-index: 2147483631;
          visibility: hidden;
          opacity: 0;
        }

        .yc-doc-toolbar.yc-position-ready {
          visibility: visible;
          opacity: 1;
        }

        .yc-doc-toolbar:hover {
          box-shadow: 0 6px 30px rgba(102, 126, 234, 0.6);
          transform: scale(1.05);
        }

        .yc-doc-btn {
          width: 36px;
          height: 36px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 8px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .yc-doc-btn:hover {
          background: rgba(255, 255, 255, 0.4);
          transform: scale(1.1);
        }

        .yc-doc-btn:active {
          transform: scale(0.95);
        }

        .yc-doc-btn-close:hover {
          background: rgba(220, 53, 69, 0.8);
        }

        .yc-doc-panel {
          position: fixed;
          right: 70px;
          top: 80px;
          width: 380px;
          max-height: calc(100vh - 100px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          transition: opacity 0.3s ease, transform 0.3s ease;
          overflow: hidden;
          resize: both;
          min-width: 300px;
          min-height: 250px;
          z-index: 2147483632;
          visibility: hidden;
          opacity: 0;
        }

        .yc-doc-panel.yc-position-ready {
          visibility: visible;
          opacity: 1;
        }

        .yc-doc-panel.yc-doc-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateX(20px);
        }

        .yc-doc-panel.yc-dragging {
          transition: none;
          cursor: grabbing;
          user-select: none;
        }

        .yc-doc-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          cursor: grab;
        }

        .yc-doc-panel-header:active {
          cursor: grabbing;
        }

        .yc-doc-title {
          font-size: 14px;
          font-weight: 600;
        }

        .yc-doc-panel-actions {
          display: flex;
          gap: 8px;
        }

        .yc-doc-btn-sm {
          padding: 4px 10px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 6px;
          font-size: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .yc-doc-btn-sm:hover {
          background: rgba(255, 255, 255, 0.4);
        }

        .yc-doc-panel-body {
          flex: 1;
          overflow-y: overlay;
          padding: 16px;
          scrollbar-width: thin;
          scrollbar-color: #c1c1c1 transparent;
        }

        .yc-doc-panel-body::-webkit-scrollbar {
          width: 6px;
        }

        .yc-doc-panel-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .yc-doc-panel-body::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .yc-doc-panel-body::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.4);
        }

        .yc-doc-content {
          min-height: 150px;
          outline: none;
          font-size: 14px;
          line-height: 1.6;
          color: #333;
        }

        .yc-doc-content:focus {
          outline: none;
        }

        .yc-doc-content h1 { font-size: 20px; margin: 0 0 12px 0; color: #1a1a1a; }
        .yc-doc-content h2 { font-size: 18px; margin: 16px 0 8px 0; color: #333; }
        .yc-doc-content h3 { font-size: 16px; margin: 12px 0 6px 0; color: #444; }
        .yc-doc-content p { margin: 8px 0; }
        .yc-doc-content ul, .yc-doc-content ol { padding-left: 20px; margin: 8px 0; }
        .yc-doc-content li { margin: 4px 0; }
        .yc-doc-content .yc-doc-outline {
          list-style: none;
          padding-left: 0;
        }
        .yc-doc-content .yc-doc-outline-item {
          list-style: none;
          padding: 6px 10px;
          margin: 2px 0;
          cursor: pointer;
          border-radius: 6px;
          transition: background-color 0.2s ease;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          --indent-base: 14px;
          --indent-1: var(--indent-base);
          --indent-2: calc(var(--indent-base) * 2);
          --indent-3: calc(var(--indent-base) * 3);
          --indent-4: calc(var(--indent-base) * 4);
          --indent-5: calc(var(--indent-base) * 5);
          --indent-6: calc(var(--indent-base) * 6);
        }
        .yc-doc-content .yc-doc-outline-item.yc-doc-level-1 { padding-left: var(--indent-1); font-weight: 600; }
        .yc-doc-content .yc-doc-outline-item.yc-doc-level-2 { padding-left: var(--indent-2); font-weight: 500; }
        .yc-doc-content .yc-doc-outline-item.yc-doc-level-3 { padding-left: var(--indent-3); }
        .yc-doc-content .yc-doc-outline-item.yc-doc-level-4 { padding-left: var(--indent-4); font-size: 13px; }
        .yc-doc-content .yc-doc-outline-item.yc-doc-level-5 { padding-left: var(--indent-5); font-size: 13px; color: #666; }
        .yc-doc-content .yc-doc-outline-item.yc-doc-level-6 { padding-left: var(--indent-6); font-size: 12px; color: #888; }
        .yc-doc-content .yc-doc-outline-item:hover {
          background-color: #f0f4ff;
          color: #667eea;
        }
        .yc-doc-content .yc-doc-outline-item.yc-doc-has-link {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
        }
        .yc-doc-content .yc-doc-outline-text {
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .yc-doc-content .yc-doc-link-btn {
          flex-shrink: 0;
          font-size: 11px;
          color: #667eea;
          text-decoration: none;
          background: #f0f4ff;
          padding: 3px 8px;
          border-radius: 4px;
          border: none;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 3px;
        }
        .yc-doc-content .yc-doc-link-btn:hover {
          background: #667eea;
          color: white;
        }
        .yc-doc-content .yc-doc-link-btn svg {
          width: 12px;
          height: 12px;
        }
        .yc-doc-content .yc-doc-source a {
          color: #667eea;
          text-decoration: none;
        }
        .yc-doc-content .yc-doc-source a:hover {
          text-decoration: underline;
        }
        .yc-doc-content blockquote {
          border-left: 3px solid #667eea;
          padding-left: 12px;
          margin: 8px 0;
          color: #666;
          background: #f8f9fa;
          padding: 8px 12px;
          border-radius: 0 8px 8px 0;
        }
        .yc-doc-content code {
          background: #f1f3f4;
          padding: 2px 6px;
          border-radius: 4px;
          font-family: "Consolas", monospace;
          font-size: 13px;
        }
        .yc-doc-content pre {
          background: #1e1e1e;
          color: #d4d4d4;
          padding: 12px;
          border-radius: 8px;
          overflow-x: auto;
          font-size: 13px;
        }

        .yc-doc-status {
          padding: 8px 16px;
          background: #f8f9fa;
          border-top: 1px solid #eee;
          font-size: 12px;
          color: #666;
        }

        .yc-doc-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 14px;
          z-index: 2147483647;
          animation: yc-doc-toast-in 0.3s ease;
        }

        @keyframes yc-doc-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `;
      document.head.appendChild(style);
    }

    bindEvents() {
      const container = document.getElementById(CONTAINER_ID);
      const panel = document.getElementById(PANEL_ID);

      container.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action]');
        if (btn) {
          const action = btn.dataset.action;
          switch (action) {
            case 'generate':
              this.generateDocument();
              break;
            case 'collect':
              this.collectSelection();
              break;
            case 'toggle':
              this.togglePanel();
              break;
            case 'close':
              this.hide();
              break;
            case 'copy':
              this.copyContent();
              break;
            case 'download':
              this.downloadContent();
              break;
            case 'clear':
              this.clearContent();
              break;
          }
          return;
        }

        // 处理大纲项点击跳转
        const outlineItem = e.target.closest('.yc-doc-outline-item');
        if (outlineItem) {
          // 如果点击的是链接按钮，打开新标签页
          const linkBtn = e.target.closest('.yc-doc-link-btn');
          if (linkBtn) {
            e.stopPropagation();
            const link = linkBtn.dataset.link;
            if (link) {
              window.open(link, '_blank');
            }
            return;
          }

          const headingText = outlineItem.dataset.headingText;
          if (headingText) {
            this.scrollToHeading(headingText);
          }
        }
      });

      // 监听选择变化
      document.addEventListener('selectionchange', () => {
        const selection = window.getSelection();
        const collectBtn = container.querySelector('[data-action="collect"]');
        if (collectBtn) {
          collectBtn.style.background = selection.toString().trim()
            ? 'rgba(40, 167, 69, 0.6)'
            : 'rgba(255, 255, 255, 0.2)';
        }
      });

      // 拖拽功能
      this.bindDragEvents(panel);

      // 窗口大小变化时确保面板在可视范围内
      window.addEventListener('resize', () => {
        this.ensurePanelInViewport();
      });

      // 阻止面板内部滚动事件冒泡到外部
      const panelBody = panel.querySelector('.yc-doc-panel-body');
      if (panelBody) {
        panelBody.addEventListener('wheel', (e) => {
          e.stopPropagation();
        }, { passive: true });
      }
    }

    // 绑定拖拽事件
    bindDragEvents(panel) {
      const header = panel.querySelector('.yc-doc-panel-header');

      header.addEventListener('mousedown', (e) => {
        // 忽略按钮点击
        if (e.target.closest('button')) return;

        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };

        const rect = panel.getBoundingClientRect();
        this.panelStart = {
          right: window.innerWidth - rect.right,
          top: rect.top
        };

        panel.classList.add('yc-dragging');

        // 通知位置管理器拖拽开始
        if (window.PanelPositionManager) {
          window.PanelPositionManager.notifyDragStart('doc-generator');
        }

        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!this.isDragging) return;

        const dx = this.dragStart.x - e.clientX;
        const dy = e.clientY - this.dragStart.y;

        let newRight = this.panelStart.right + dx;
        let newTop = this.panelStart.top + dy;

        // 获取面板尺寸
        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;

        // 使用位置管理器限制位置（屏幕边界 + 不遮挡 icon）
        if (window.PanelPositionManager) {
          const constrained = window.PanelPositionManager.constrainPanelPosition(
            'doc-generator', newRight, newTop, panelWidth, panelHeight
          );
          newRight = constrained.right;
          newTop = constrained.top;
        } else {
          // 回退到简单边界限制
          newRight = Math.max(20, Math.min(newRight, window.innerWidth - panelWidth - 20));
          newTop = Math.max(20, Math.min(newTop, window.innerHeight - panelHeight - 20));
        }

        panel.style.right = `${newRight}px`;
        panel.style.top = `${newTop}px`;
      });

      document.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
          panel.classList.remove('yc-dragging');
          // 通知位置管理器拖拽结束
          if (window.PanelPositionManager) {
            const toolbar = document.getElementById(TOOLBAR_ID);
            window.PanelPositionManager.notifyDragEnd('doc-generator', toolbar, panel);
          }
        }
      });
    }

    // 确保面板在可视区域内
    ensurePanelInViewport() {
      const panel = document.getElementById(PANEL_ID);
      if (!panel || panel.classList.contains('yc-doc-hidden')) return;

      const rect = panel.getBoundingClientRect();
      const currentRight = parseInt(panel.style.right) || 70;
      const currentTop = parseInt(panel.style.top) || 80;

      let newRight = currentRight;
      let newTop = currentTop;

      // 检查是否超出右边界
      if (rect.right > window.innerWidth) {
        newRight = Math.max(0, window.innerWidth - rect.width - 10);
      }

      // 检查是否超出下边界
      if (rect.bottom > window.innerHeight) {
        newTop = Math.max(0, window.innerHeight - rect.height - 10);
      }

      // 检查是否超出上边界
      if (rect.top < 0) {
        newTop = 10;
      }

      if (newRight !== currentRight || newTop !== currentTop) {
        panel.style.right = `${newRight}px`;
        panel.style.top = `${newTop}px`;
      }
    }

    scrollToHeading(text) {
      // 查找页面上匹配的标题元素
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const h of headings) {
        if (h.textContent.trim() === text) {
          h.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // 高亮效果
          h.style.transition = 'background-color 0.3s';
          h.style.backgroundColor = '#fff3cd';
          setTimeout(() => {
            h.style.backgroundColor = '';
          }, 2000);
          this.showToast(`已跳转到: ${text}`);
          return;
        }
      }
      this.showToast('未找到对应标题');
    }

    show() {
      const container = document.getElementById(CONTAINER_ID);
      if (container) {
        container.style.display = 'block';
        this.isVisible = true;
      }
    }

    hide() {
      // 只隐藏面板，保留工具栏可见
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        panel.classList.add('yc-doc-hidden');
        this.isMinimized = true;
      }
    }

    togglePanel() {
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        panel.classList.toggle('yc-doc-hidden');
        this.isMinimized = panel.classList.contains('yc-doc-hidden');

        // 通知位置管理器
        if (window.PanelPositionManager) {
          window.PanelPositionManager.handlePanelToggle('doc-generator', !this.isMinimized);
        }
      }
    }

    generateDocument() {
      const title = this.getPageTitle();
      const content = this.extractMainContent();

      const docContent = this.formatDocument(title, content);
      this.updatePanel(docContent);
      this.showToast('文档生成完成');
    }

    getPageTitle() {
      // 尝试多种方式获取标题
      const selectors = [
        'h1',
        '[class*="title"]',
        '[class*="Title"]',
        'article h1',
        '.post-title',
        '.article-title',
        '.entry-title'
      ];

      for (const selector of selectors) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
          return el.textContent.trim();
        }
      }

      return document.title;
    }

    extractMainContent() {
      const sections = [];

      // 提取标题结构
      const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
      headings.forEach(h => {
        const text = h.textContent.trim();

        // 检查元素是否隐藏
        if (this.isHiddenElement(h)) {
          return;
        }

        if (text && text.length < 100) {
          // 检查h标签自身或父元素是否有链接
          const link = this.findLink(h);

          sections.push({
            type: h.tagName.toLowerCase(),
            text: text,
            link: link
          });
        }
      });

      return sections;
    }

    // 检查元素是否隐藏
    isHiddenElement(el) {
      if (!el) return true;

      const style = window.getComputedStyle(el);

      if (style.display === 'none') return true;
      if (style.visibility === 'hidden') return true;
      if (style.visibility === 'collapse') return true;
      if (parseFloat(style.opacity) === 0) return true;

      if (style.display === 'contents') return false;

      if (this.isClippedHidden(style)) return true;

      if (el.offsetWidth <= 2 || el.offsetHeight <= 2) {
        return true;
      }

      const rect = el.getBoundingClientRect();
      if (rect.width <= 2 || rect.height <= 2) {
        return true;
      }

      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        const parentStyle = window.getComputedStyle(parent);

        if (parentStyle.display === 'contents') {
          parent = parent.parentElement;
          continue;
        }

        if (parentStyle.display === 'none' ||
            parentStyle.visibility === 'hidden' ||
            parseFloat(parentStyle.opacity) === 0) {
          return true;
        }

        if (parent.offsetWidth <= 2 || parent.offsetHeight <= 2) {
          return true;
        }

        if (this.isClippedHidden(parentStyle)) {
          return true;
        }

        parent = parent.parentElement;
      }

      return false;
    }

    // 检测元素是否使用 clip 技术隐藏
    isClippedHidden(style) {
      const clip = style.clip;
      if (clip && clip !== 'auto') {
        const clipMatch = clip.match(/rect\s*\(\s*(\d+)/i);
        if (clipMatch) {
          const values = clip.match(/-?\d+/g);
          if (values && values.every(v => parseInt(v) === 0)) {
            return true;
          }
        }
      }

      const clipPath = style.clipPath;
      if (clipPath && clipPath !== 'none') {
        if (clipPath.includes('inset(100%') ||
            clipPath.includes('circle(0') ||
            clipPath.includes('polygon(0')) {
          return true;
        }
      }

      return false;
    }

    // 查找h标签自身或父元素的链接
    findLink(el) {
      if (el.tagName === 'A') {
        return el.href;
      }

      let parent = el.parentElement;
      while (parent && parent !== document.body) {
        if (parent.tagName === 'A' && parent.href) {
          return parent.href;
        }
        parent = parent.parentElement;
      }

      const innerLink = el.querySelector('a[href]');
      if (innerLink && innerLink.href) {
        return innerLink.href;
      }

      return null;
    }

    formatDocument(title, sections) {
      let html = `<h1 title="${this.escapeHtml(title)}">${this.escapeHtml(title)}</h1>`;

      // 页面展示时不显示来源，下载时再添加

      if (this.collectedContent.length > 0) {
        html += '<h2>收集的内容</h2>';
        this.collectedContent.forEach((item, index) => {
          html += `<blockquote>${this.escapeHtml(item)}</blockquote>`;
        });
      }

      if (sections.length > 0) {
        const filteredSections = sections.filter(s => {
          if (s.text === title) return false;
          const normalizedTitle = title.replace(/\s+/g, ' ').trim();
          const normalizedText = s.text.replace(/\s+/g, ' ').trim();
          if (normalizedTitle === normalizedText) return false;
          return true;
        });

        const seenTexts = new Set();
        const uniqueSections = filteredSections.filter(s => {
          if (seenTexts.has(s.text)) return false;
          seenTexts.add(s.text);
          return true;
        });

        if (uniqueSections.length > 0) {
          html += '<h2>页面大纲</h2>';
          html += '<ul class="yc-doc-outline">';
          uniqueSections.forEach((s, index) => {
            const escapedText = this.escapeHtml(s.text);
            // 获取标题级别 (h1=1, h2=2, ...)
            const level = parseInt(s.type.replace('h', '')) || 1;
            const levelClass = `yc-doc-level-${level}`;
            if (s.link) {
              html += `<li class="yc-doc-outline-item yc-doc-has-link ${levelClass}" data-index="${index}" data-level="${level}" title="${escapedText}" data-heading-text="${escapedText}">
                <span class="yc-doc-outline-text">${escapedText}</span>
                <button class="yc-doc-link-btn" data-link="${this.escapeHtml(s.link)}" title="在新标签页打开链接">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  打开
                </button>
              </li>`;
            } else {
              html += `<li class="yc-doc-outline-item ${levelClass}" data-index="${index}" data-level="${level}" title="${escapedText}" data-heading-text="${escapedText}">${escapedText}</li>`;
            }
          });
          html += '</ul>';
          this.outlineSections = uniqueSections;
          this.outlineCount = uniqueSections.length;
        }
      }

      return html;
    }

    truncateUrl(url, maxLength = 50) {
      if (url.length <= maxLength) return url;

      try {
        const urlObj = new URL(url);
        const base = urlObj.protocol + '//' + urlObj.host;
        if (base.length >= maxLength - 3) {
          return base.substring(0, maxLength - 3) + '...';
        }

        const remaining = maxLength - base.length - 3;
        if (remaining > 0 && urlObj.pathname) {
          return base + urlObj.pathname.substring(0, remaining) + '...';
        }
        return base + '...';
      } catch (e) {
        return url.substring(0, maxLength - 3) + '...';
      }
    }

    collectSelection() {
      const selection = window.getSelection();
      const text = selection.toString().trim();

      if (!text) {
        this.showToast('请先选择要收集的文本');
        return;
      }

      this.collectedContent.push(text);
      this.updateStatus();
      this.showToast(`已收集 ${text.length} 字`);

      selection.removeAllRanges();

      if (!this.isMinimized) {
        const title = this.getPageTitle();
        const sections = this.extractMainContent();
        const docContent = this.formatDocument(title, sections);
        this.updatePanel(docContent);
      }
    }

    updatePanel(html) {
      const panel = document.getElementById(PANEL_ID);
      if (panel) {
        panel.classList.remove('yc-doc-hidden');
        this.isMinimized = false;
        // 通知位置管理器
        if (window.PanelPositionManager) {
          window.PanelPositionManager.handlePanelToggle('doc-generator', true);
        }
      }

      const content = document.querySelector('.yc-doc-content');
      if (content) {
        content.innerHTML = html;
      }

      this.updateStatus();
    }

    updateStatus() {
      const count = document.querySelector('.yc-doc-count');
      if (count) {
        const outlineNum = this.outlineCount || 0;
        const collectedNum = this.collectedContent.length;
        count.textContent = `大纲 ${outlineNum} 项 | 收集 ${collectedNum} 项`;
      }
    }

    copyContent() {
      const content = document.querySelector('.yc-doc-content');
      if (content) {
        navigator.clipboard.writeText(content.innerText)
          .then(() => this.showToast('已复制到剪贴板'))
          .catch(() => this.showToast('复制失败'));
      }
    }

    downloadContent() {
      const content = document.querySelector('.yc-doc-content');
      if (content) {
        const clone = content.cloneNode(true);

        const outlineItems = clone.querySelectorAll('.yc-doc-outline-item');
        outlineItems.forEach(item => {
          const linkBtn = item.querySelector('.yc-doc-link-btn');
          const textSpan = item.querySelector('.yc-doc-outline-text');

          if (linkBtn && textSpan) {
            const link = linkBtn.dataset.link;
            const text = textSpan.textContent;
            if (link) {
              textSpan.textContent = `[${text}](${link})`;
            }
            linkBtn.remove();
          }
        });

        const title = this.getPageTitle();
        const filename = `${title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_')}.md`;

        let markdown = this.htmlToMarkdown(clone.innerHTML);

        // 下载时添加来源和生成时间
        const sourceUrl = window.location.href;
        const timestamp = new Date().toLocaleString('zh-CN');
        const header = `> 来源: ${sourceUrl}\n> 生成时间: ${timestamp}\n\n`;

        markdown = header + markdown;

        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        this.showToast('文件已下载');
      }
    }

    htmlToMarkdown(html) {
      let md = html;

      md = md.replace(/<li[^>]*class="[^"]*yc-doc-outline-item[^"]*"[^>]*>(.*?)<\/li>/gi, '- $1\n');
      md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
      md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
      md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
      md = md.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');

      md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (match, content) => {
        const cleanContent = content.replace(/<[^>]+>/g, '').trim();
        return `> ${cleanContent}\n\n`;
      });

      md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n');
      md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n');
      md = md.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, '$1\n');
      md = md.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, '$1\n');
      md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '`$1`');
      md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, '```\n$1\n```\n\n');
      md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)');
      md = md.replace(/<small[^>]*>([\s\S]*?)<\/small>/gi, '$1');
      md = md.replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1');
      md = md.replace(/<[^>]+>/g, '');
      md = md.replace(/&nbsp;/g, ' ');
      md = md.replace(/&lt;/g, '<');
      md = md.replace(/&gt;/g, '>');
      md = md.replace(/&amp;/g, '&');
      md = md.replace(/&quot;/g, '"');
      md = md.replace(/\n{3,}/g, '\n\n');
      md = md.split('\n').map(line => line.trim()).join('\n');

      return md.trim();
    }

    clearContent() {
      this.collectedContent = [];
      const content = document.querySelector('.yc-doc-content');
      if (content) {
        content.innerHTML = '<p style="color: #999;">点击"生成文档"或选择文本后点击"收集"</p>';
      }
      this.updateStatus();
      this.showToast('已清空');
    }

    showToast(message) {
      const existing = document.querySelector('.yc-doc-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'yc-doc-toast';
      toast.textContent = message;
      document.body.appendChild(toast);

      setTimeout(() => toast.remove(), 2000);
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  // 初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.docGenerator = new DocGenerator();
    });
  } else {
    window.docGenerator = new DocGenerator();
  }
}
