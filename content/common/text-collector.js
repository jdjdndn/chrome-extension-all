// 通用脚本：选择并收集页面文本
// @match *://*/*
// 功能：框选范围内容，收集页面文本，支持多种选择模式
// Ctrl+C 复制时自动收集
// 支持拖拽移动面板位置

'use strict';

if (window.TextCollectorLoaded) {
  console.log('[文本收集器] 已加载，跳过');
} else if (!window.getScriptSwitch || !window.getScriptSwitch('text-collector')) {
  console.log('[文本收集器] 已禁用');
} else {
  window.TextCollectorLoaded = true;

  const CONTAINER_ID = 'yc-text-collector-container';
  const FLOAT_BTN_ID = 'yc-text-collector-btn';
  const PANEL_ID = 'yc-text-collector-panel';
  const SELECTION_BOX_ID = 'yc-selection-box';
  const STORAGE_KEY = 'yc-text-collector-position';

  class TextCollector {
    constructor() {
      this.isVisible = false;
      this.isSelecting = false;
      this.selectionStart = null;
      this.collectedItems = [];
      this.selectionMode = 'text'; // text, element, region
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
      console.log('[文本收集器] 初始化完成');
    }

    // 注册到位置管理器
    registerToPositionManager() {
      if (window.PanelPositionManager) {
        const floatBtn = document.getElementById(FLOAT_BTN_ID);
        const panel = document.getElementById(PANEL_ID);

        window.PanelPositionManager.register({
          id: 'text-collector',
          priority: 2, // 优先级低，排在下面
          iconEl: floatBtn,
          panelEl: panel
        });
      }
    }

    createUI() {
      const container = document.createElement('div');
      container.id = CONTAINER_ID;
      container.innerHTML = `
        <div id="${FLOAT_BTN_ID}" class="yc-float-btn" title="文本收集器 (Ctrl+C自动收集)">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          <span class="yc-float-btn-badge">0</span>
        </div>
        <div id="${PANEL_ID}" class="yc-collector-panel yc-hidden">
          <div class="yc-panel-header yc-drag-handle">
            <div class="yc-panel-header-row">
              <span class="yc-panel-title">文本收集器</span>
              <div class="yc-panel-header-actions">
                <button class="yc-minimize-btn" data-action="minimize" title="最小化">−</button>
              </div>
            </div>
            <div class="yc-mode-switch">
              <button class="yc-mode-btn active" data-mode="text">文本</button>
              <button class="yc-mode-btn" data-mode="element">元素</button>
              <button class="yc-mode-btn" data-mode="region">区域</button>
            </div>
          </div>
          <div class="yc-panel-body">
            <div class="yc-collected-list"></div>
            <div class="yc-empty-hint">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <line x1="9" y1="9" x2="15" y2="9"/>
                <line x1="9" y1="13" x2="15" y2="13"/>
                <line x1="9" y1="17" x2="12" y2="17"/>
              </svg>
              <p>选择文本后 Ctrl+C 复制<br>或使用区域/元素模式选择</p>
            </div>
          </div>
          <div class="yc-panel-footer">
            <button class="yc-action-btn" data-action="copy-all">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              复制
            </button>
            <button class="yc-action-btn" data-action="export">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              导出
            </button>
            <button class="yc-action-btn yc-danger" data-action="clear">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              清空
            </button>
          </div>
        </div>
        <div id="${SELECTION_BOX_ID}" class="yc-selection-box yc-hidden"></div>
      `;

      document.body.appendChild(container);
      this.injectStyles();
    }

    injectStyles() {
      if (document.getElementById('yc-text-collector-styles')) return;

      const style = document.createElement('style');
      style.id = 'yc-text-collector-styles';
      style.textContent = `
        #${CONTAINER_ID} * {
          box-sizing: border-box;
        }

        .yc-float-btn {
          position: fixed;
          right: 20px;
          top: 140px;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          cursor: pointer;
          box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4);
          transition: all 0.3s ease;
          z-index: 2147483640;
          visibility: hidden;
          opacity: 0;
        }

        .yc-float-btn.yc-position-ready {
          visibility: visible;
          opacity: 1;
        }

        .yc-float-btn:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 25px rgba(17, 153, 142, 0.6);
        }

        .yc-float-btn:active {
          transform: scale(0.95);
        }

        .yc-float-btn-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          min-width: 20px;
          height: 20px;
          background: #ff4757;
          color: white;
          font-size: 11px;
          font-weight: bold;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 5px;
        }

        .yc-float-btn-badge:empty,
        .yc-float-btn-badge[data-count="0"] {
          display: none;
        }

        .yc-collector-panel {
          position: fixed;
          right: 70px;
          top: 140px;
          width: 360px;
          max-height: calc(100vh - 180px);
          background: #ffffff;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
          display: flex;
          flex-direction: column;
          transition: opacity 0.3s ease, transform 0.3s ease;
          z-index: 2147483641;
          overflow: hidden;
          resize: both;
          min-width: 280px;
          min-height: 300px;
          visibility: hidden;
          opacity: 0;
        }

        .yc-collector-panel.yc-position-ready {
          visibility: visible;
          opacity: 1;
        }

        .yc-collector-panel.yc-hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateY(20px);
        }

        .yc-collector-panel.yc-dragging {
          transition: none;
          cursor: grabbing;
          user-select: none;
        }

        .yc-panel-header {
          padding: 12px 16px;
          background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
          color: white;
          cursor: grab;
        }

        .yc-panel-header:active {
          cursor: grabbing;
        }

        .yc-panel-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .yc-panel-title {
          font-size: 14px;
          font-weight: 600;
        }

        .yc-panel-header-actions {
          display: flex;
          gap: 8px;
        }

        .yc-minimize-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .yc-minimize-btn:hover {
          background: rgba(255, 255, 255, 0.4);
        }

        .yc-mode-switch {
          display: flex;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 3px;
        }

        .yc-mode-btn {
          flex: 1;
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.2s ease;
        }

        .yc-mode-btn.active {
          background: white;
          color: #11998e;
          font-weight: 600;
        }

        .yc-mode-btn:hover:not(.active) {
          color: white;
        }

        .yc-panel-body {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 12px;
          min-height: 0;
          scrollbar-width: thin;
          scrollbar-color: #c1c1c1 transparent;
        }

        .yc-panel-body::-webkit-scrollbar {
          width: 6px;
        }

        .yc-panel-body::-webkit-scrollbar-track {
          background: transparent;
        }

        .yc-panel-body::-webkit-scrollbar-thumb {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 3px;
        }

        .yc-panel-body::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 0, 0, 0.4);
        }

        .yc-collected-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .yc-collected-item {
          background: #f8f9fa;
          border-radius: 10px;
          padding: 10px 12px;
          position: relative;
          border-left: 3px solid #11998e;
          animation: yc-item-in 0.3s ease;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        @keyframes yc-item-in {
          from { opacity: 0; transform: translateX(-10px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .yc-collected-item:hover {
          background: #f0f0f0;
        }

        .yc-collected-item-content {
          flex: 1;
          min-width: 0;
          font-size: 13px;
          line-height: 1.4;
          color: #333;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          cursor: pointer;
        }

        .yc-collected-item-content:hover {
          white-space: normal;
          word-break: break-word;
        }

        .yc-collected-item-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }

        .yc-item-btn {
          width: 24px;
          height: 24px;
          border: none;
          background: #e9ecef;
          color: #666;
          border-radius: 6px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: all 0.2s ease;
        }

        .yc-collected-item:hover .yc-item-btn {
          opacity: 1;
        }

        .yc-item-btn:hover {
          background: #dee2e6;
          color: #333;
        }

        .yc-item-btn.yc-item-btn-copy:hover {
          background: #11998e;
          color: white;
        }

        .yc-item-btn.yc-item-btn-remove:hover {
          background: #ff4757;
          color: white;
        }

        .yc-item-btn svg {
          width: 14px;
          height: 14px;
        }

        .yc-empty-hint {
          text-align: center;
          padding: 30px;
          color: #999;
        }

        .yc-empty-hint p {
          margin-top: 12px;
          font-size: 13px;
          line-height: 1.6;
        }

        .yc-panel-footer {
          padding: 12px;
          background: #f8f9fa;
          border-top: 1px solid #eee;
          display: flex;
          gap: 8px;
        }

        .yc-action-btn {
          flex: 1;
          padding: 8px 12px;
          border: none;
          background: #e9ecef;
          color: #495057;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transition: all 0.2s ease;
        }

        .yc-action-btn:hover {
          background: #dee2e6;
        }

        .yc-action-btn.yc-danger:hover {
          background: #ff4757;
          color: white;
        }

        /* 选择框样式 */
        .yc-selection-box {
          position: fixed;
          border: 2px dashed #11998e;
          background: rgba(17, 153, 142, 0.1);
          pointer-events: none;
          z-index: 2147483645;
        }

        .yc-selection-box.yc-hidden {
          display: none;
        }

        /* 高亮选中的元素 */
        .yc-highlight-element {
          outline: 2px solid #11998e !important;
          outline-offset: 2px !important;
          background-color: rgba(17, 153, 142, 0.1) !important;
        }

        /* Toast 提示 */
        .yc-toast {
          position: fixed;
          bottom: 20px;
          left: 50%;
          transform: translateX(-50%);
          background: #333;
          color: white;
          padding: 10px 16px;
          border-radius: 8px;
          font-size: 13px;
          z-index: 2147483647;
          animation: yc-toast-in 0.3s ease;
        }

        @keyframes yc-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(10px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        /* 拖拽提示 */
        .yc-drag-hint {
          position: absolute;
          top: -30px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 4px 10px;
          border-radius: 4px;
          font-size: 11px;
          white-space: nowrap;
          opacity: 0;
          transition: opacity 0.2s ease;
          pointer-events: none;
        }

        .yc-panel-header:hover .yc-drag-hint {
          opacity: 1;
        }
      `;
      document.head.appendChild(style);
    }

    bindEvents() {
      const container = document.getElementById(CONTAINER_ID);
      const floatBtn = document.getElementById(FLOAT_BTN_ID);
      const panel = document.getElementById(PANEL_ID);

      // 浮动按钮点击
      floatBtn.addEventListener('click', () => this.togglePanel());

      // 模式切换
      container.querySelectorAll('.yc-mode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          container.querySelectorAll('.yc-mode-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.selectionMode = btn.dataset.mode;
          this.updateModeUI();
        });
      });

      // 操作按钮
      container.querySelectorAll('.yc-action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = btn.dataset.action;
          switch (action) {
            case 'copy-all': this.copyAll(); break;
            case 'export': this.export(); break;
            case 'clear': this.clear(); break;
          }
        });
      });

      // 最小化按钮
      container.querySelector('.yc-minimize-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.minimizePanel();
      });

      // 拖拽功能
      this.bindDragEvents(panel);

      // 监听复制事件 (Ctrl+C)
      document.addEventListener('copy', (e) => this.handleCopy(e));

      // 元素选择模式
      document.addEventListener('mouseover', (e) => this.handleMouseOver(e));
      document.addEventListener('mouseout', (e) => this.handleMouseOut(e));
      document.addEventListener('click', (e) => this.handleClick(e), true);

      // 区域选择模式
      document.addEventListener('mousedown', (e) => this.handleRegionStart(e));
      document.addEventListener('mousemove', (e) => this.handleRegionMove(e));
      document.addEventListener('mouseup', (e) => this.handleRegionEnd(e));

      // 键盘快捷键
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.isSelecting) {
          this.cancelSelection();
        }
      });

      // 窗口大小变化时确保面板在可视范围内
      window.addEventListener('resize', () => {
        this.ensurePanelInViewport();
      });

      // 阻止面板内部滚动事件冒泡到外部
      const panelBody = panel.querySelector('.yc-panel-body');
      if (panelBody) {
        panelBody.addEventListener('wheel', (e) => {
          e.stopPropagation();
        }, { passive: true });
      }
    }

    // 绑定拖拽事件
    bindDragEvents(panel) {
      const header = panel.querySelector('.yc-panel-header');

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
          window.PanelPositionManager.notifyDragStart('text-collector');
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
            'text-collector', newRight, newTop, panelWidth, panelHeight
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
        panel.style.bottom = 'auto';
      });

      document.addEventListener('mouseup', () => {
        if (this.isDragging) {
          this.isDragging = false;
          panel.classList.remove('yc-dragging');
          // 通知位置管理器拖拽结束
          if (window.PanelPositionManager) {
            const floatBtn = document.getElementById(FLOAT_BTN_ID);
            window.PanelPositionManager.notifyDragEnd('text-collector', floatBtn, panel);
          }
        }
      });
    }

    // 确保面板在可视区域内
    ensurePanelInViewport() {
      const panel = document.getElementById(PANEL_ID);
      if (!panel || panel.classList.contains('yc-hidden')) return;

      const rect = panel.getBoundingClientRect();
      const currentRight = parseInt(panel.style.right) || 70;
      const currentTop = parseInt(panel.style.top) || 140;

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
        panel.style.bottom = 'auto';
      }
    }

    // 处理复制事件
    handleCopy(e) {
      // 忽略来自面板内部的复制
      const selection = window.getSelection();
      const container = document.getElementById(CONTAINER_ID);
      if (container && container.contains(selection.anchorNode)) {
        return;
      }

      const text = selection.toString().trim();

      if (text.length >= 2) {
        // 延迟收集，确保复制操作完成
        setTimeout(() => {
          this.collectText(text, 'copy');
        }, 100);
      }
    }

    togglePanel() {
      const panel = document.getElementById(PANEL_ID);
      this.isVisible = !this.isVisible;
      panel.classList.toggle('yc-hidden', !this.isVisible);

      // 通知位置管理器
      if (window.PanelPositionManager) {
        window.PanelPositionManager.handlePanelToggle('text-collector', this.isVisible);
      }
    }

    minimizePanel() {
      const panel = document.getElementById(PANEL_ID);
      panel.classList.add('yc-hidden');
      this.isVisible = false;

      // 通知位置管理器
      if (window.PanelPositionManager) {
        window.PanelPositionManager.handlePanelToggle('text-collector', false);
      }
    }

    updateModeUI() {
      this.showToast(`已切换到${this.getModeLabel()}模式`);
    }

    getModeLabel() {
      const labels = { text: '文本选择', element: '元素选择', region: '区域选择' };
      return labels[this.selectionMode] || '文本选择';
    }

    // 元素选择处理
    handleMouseOver(e) {
      if (this.selectionMode !== 'element') return;
      if (!e.target || typeof e.target.closest !== 'function') return;
      if (e.target.closest(`#${CONTAINER_ID}`)) return;

      e.target.classList.add('yc-highlight-element');
    }

    handleMouseOut(e) {
      if (this.selectionMode !== 'element') return;
      if (!e.target || typeof e.target.classList?.remove !== 'function') return;

      e.target.classList.remove('yc-highlight-element');
    }

    handleClick(e) {
      if (this.selectionMode !== 'element') return;
      if (!e.target || typeof e.target.closest !== 'function') return;
      if (e.target.closest(`#${CONTAINER_ID}`)) return;

      const text = e.target.innerText?.trim();
      if (text) {
        e.preventDefault();
        e.stopPropagation();
        this.collectText(text, e.target.tagName);
        e.target.classList.remove('yc-highlight-element');
      }
    }

    // 区域选择处理
    handleRegionStart(e) {
      if (this.selectionMode !== 'region') return;
      if (e.target.closest(`#${CONTAINER_ID}`)) return;

      this.isSelecting = true;
      this.selectionStart = { x: e.clientX, y: e.clientY };

      const box = document.getElementById(SELECTION_BOX_ID);
      box.classList.remove('yc-hidden');
      box.style.left = `${e.clientX}px`;
      box.style.top = `${e.clientY}px`;
      box.style.width = '0';
      box.style.height = '0';
    }

    handleRegionMove(e) {
      if (!this.isSelecting || this.selectionMode !== 'region') return;

      const box = document.getElementById(SELECTION_BOX_ID);
      const x = Math.min(e.clientX, this.selectionStart.x);
      const y = Math.min(e.clientY, this.selectionStart.y);
      const width = Math.abs(e.clientX - this.selectionStart.x);
      const height = Math.abs(e.clientY - this.selectionStart.y);

      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${width}px`;
      box.style.height = `${height}px`;
    }

    handleRegionEnd(e) {
      if (!this.isSelecting || this.selectionMode !== 'region') return;

      this.isSelecting = false;
      const box = document.getElementById(SELECTION_BOX_ID);
      box.classList.add('yc-hidden');

      // 获取选区内的文本
      const rect = box.getBoundingClientRect();

      // 只有选择区域足够大才收集
      if (rect.width > 10 && rect.height > 10) {
        const text = this.getTextInRegion(rect);
        if (text) {
          this.collectText(text, 'region');
        }
      }

      this.selectionStart = null;
    }

    getTextInRegion(rect) {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      const texts = [];
      let node;
      while (node = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const nodeRect = range.getBoundingClientRect();

        // 检查是否相交
        if (nodeRect.width > 0 && nodeRect.height > 0 &&
            nodeRect.left < rect.right && nodeRect.right > rect.left &&
            nodeRect.top < rect.bottom && nodeRect.bottom > rect.top) {
          const text = node.textContent.trim();
          if (text) texts.push(text);
        }
      }

      return texts.join(' ').trim();
    }

    cancelSelection() {
      this.isSelecting = false;
      const box = document.getElementById(SELECTION_BOX_ID);
      box.classList.add('yc-hidden');

      document.querySelectorAll('.yc-highlight-element').forEach(el => {
        el.classList.remove('yc-highlight-element');
      });
    }

    collectText(text, source = 'text') {
      if (!text || text.length < 2) return;

      // 去重：检查是否已存在相同文本
      const normalizedText = text.trim().substring(0, 1000);
      const exists = this.collectedItems.some(item =>
        item.text.trim() === normalizedText
      );

      if (exists) {
        this.showToast('该内容已收集');
        return;
      }

      const item = {
        id: Date.now(),
        text: normalizedText,
        source: source,
        url: window.location.href,
        timestamp: new Date().toLocaleString('zh-CN')
      };

      this.collectedItems.unshift(item);
      this.updateUI();
      // 不显示toast，只通过badge提示
    }

    removeItem(id) {
      this.collectedItems = this.collectedItems.filter(item => item.id !== id);
      this.updateUI();
    }

    updateUI() {
      // 更新徽章
      const badge = document.querySelector('.yc-float-btn-badge');
      badge.textContent = this.collectedItems.length;
      badge.dataset.count = this.collectedItems.length;

      // 更新列表
      const list = document.querySelector('.yc-collected-list');
      const emptyHint = document.querySelector('.yc-empty-hint');

      if (this.collectedItems.length === 0) {
        list.innerHTML = '';
        emptyHint.style.display = 'block';
      } else {
        emptyHint.style.display = 'none';
        list.innerHTML = this.collectedItems.map(item => `
          <div class="yc-collected-item" data-id="${item.id}">
            <div class="yc-collected-item-content" title="${this.escapeHtml(item.text)}">${this.escapeHtml(item.text)}</div>
            <div class="yc-collected-item-actions">
              <button class="yc-item-btn yc-item-btn-copy" data-copy="${item.id}" title="复制此项">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              </button>
              <button class="yc-item-btn yc-item-btn-remove" data-remove="${item.id}" title="删除此项">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>
        `).join('');

        // 绑定复制事件
        list.querySelectorAll('.yc-item-btn-copy').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const id = parseInt(btn.dataset.copy);
            const item = this.collectedItems.find(i => i.id === id);
            if (item) {
              navigator.clipboard.writeText(item.text)
                .then(() => this.showToast('已复制'))
                .catch(() => this.showToast('复制失败'));
            }
          });
        });

        // 绑定删除事件
        list.querySelectorAll('.yc-item-btn-remove').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeItem(parseInt(btn.dataset.remove));
          });
        });
      }
    }

    copyAll() {
      if (this.collectedItems.length === 0) {
        this.showToast('没有可复制的内容');
        return;
      }

      const text = this.collectedItems.map(item => item.text).join('\n\n---\n\n');
      navigator.clipboard.writeText(text)
        .then(() => this.showToast('已复制全部内容'))
        .catch(() => this.showToast('复制失败'));
    }

    export() {
      if (this.collectedItems.length === 0) {
        this.showToast('没有可导出的内容');
        return;
      }

      const content = this.collectedItems.map((item, i) => {
        return `## ${i + 1}. ${item.source}\n\n${item.text}\n\n> 时间: ${item.timestamp}\n> 来源: ${item.url}`;
      }).join('\n\n---\n\n');

      const title = document.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
      const blob = new Blob([`# 收集的文本\n\n${content}`], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `collected_${title}.md`;
      a.click();
      URL.revokeObjectURL(url);

      this.showToast('已导出文件');
    }

    clear() {
      if (this.collectedItems.length === 0) return;

      this.collectedItems = [];
      this.updateUI();
      this.showToast('已清空');
    }

    showToast(message) {
      const existing = document.querySelector('.yc-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.className = 'yc-toast';
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
      window.textCollector = new TextCollector();
    });
  } else {
    window.textCollector = new TextCollector();
  }
}
