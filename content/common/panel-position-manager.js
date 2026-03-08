// 面板位置管理器 v26
// 功能：
// 1. icon松散排列在可视区右侧，不重叠
// 2. 展开单个panel时独占90%空白可视区
// 3. 展开多个panel时平分90%空白可视区，不重叠

'use strict';

if (!window.PanelPositionManager) {
  window.PanelPositionManager = {
    STORAGE_KEY: 'yc-panel-position-manager-v26',

    config: {
      iconWidth: 50,
      iconHeight: 50,
      iconGapMin: 200,    // 最小间距
      iconGapMax: 350,   // 最大间距
      panelGap: 10,
      edgeMargin: 20,
      minPanelWidth: 300,
      maxPanelWidth: 400,
      minPanelHeight: 300,
      iconAvoidGap: 10,
      panelAvoidGap: 10,
      docGeneratorRequireHTags: true,
      spaceUsageRatio: 0.9, // 占用空白可视区的比例
      // z-index 统一管理
      zIndexBase: 2147483600,
      zIndexIcon: 10,      // icon 偏移
      zIndexPanel: 20,     // panel 偏移
    },

    components: [],
    customPositions: {},
    collapsedStates: {},
    userPanelPositions: {},  // 存储用户自定义的 panel 位置
    isPositionReady: false,
    isCalculating: false,
    positionsFixed: false,
    pendingCalculate: null,

    // ==================== 初始化 ====================

    init() {
      this.loadFromStorage();

      window.addEventListener('resize', () => {
        if (this._resizeTimer) clearTimeout(this._resizeTimer);
        this._resizeTimer = setTimeout(() => this.scheduleCalculate(), 200);
      });

      console.log('[位置管理器] v26 已加载（松散排列 + 智能空间分配）');
    },

    // ==================== 核心调度 ====================

    scheduleCalculate() {
      if (this.pendingCalculate) {
        clearTimeout(this.pendingCalculate);
      }

      this.pendingCalculate = setTimeout(() => {
        this.pendingCalculate = null;
        this.doCalculate();
      }, 150);
    },

    doCalculate() {
      if (this.isCalculating) return;
      this.isCalculating = true;

      try {
        this.calculatePositions();
      } finally {
        this.isCalculating = false;
      }
    },

    // ==================== 统一计算位置 ====================

    calculatePositions() {
      const { edgeMargin, maxPanelWidth, iconWidth, iconHeight, panelAvoidGap, spaceUsageRatio, zIndexBase, zIndexIcon, zIndexPanel } = this.config;
      const vh = window.innerHeight;
      const hasH = this.hasHTags();

      // 动态计算 icon 间距
      const iconGap = this.calculateIconGap();

      // 按 priority 排序
      const sorted = [...this.components].sort((a, b) => a.priority - b.priority);

      // 第一步：确定可见组件（排除隐藏的文档生成器）
      const visibleComponents = [];
      for (const c of sorted) {
        const isHidden = this.isComponentHidden(c, hasH);
        if (!isHidden) {
          visibleComponents.push(c);
        }
      }

      // 第二步：计算icon位置（松散排列在右侧）
      let iconTop = edgeMargin;
      for (const c of visibleComponents) {
        c._iconTop = iconTop;
        iconTop += iconHeight + iconGap;
      }

      // 第三步：识别展开的面板
      const expandedPanels = visibleComponents.filter(c => {
        return !this.collapsedStates[c.id] && c.panelEl;
      });

      // 第四步：计算面板可用空间
      // 可用高度 = 视口高度 - 上下边距，然后乘以空间利用率
      const availableHeight = (vh - edgeMargin * 2) * spaceUsageRatio;
      const panelRight = edgeMargin + iconWidth + panelAvoidGap;

      // 第五步：计算每个展开面板的高度
      const panelHeights = this.calculatePanelHeights(expandedPanels, availableHeight);

      // 第六步：应用位置
      let panelTop = edgeMargin;
      let heightIndex = 0;

      for (const c of visibleComponents) {
        const isCollapsed = this.collapsedStates[c.id];
        c._fixedPosition = { top: c._iconTop };

        // 应用 icon 位置
        if (c.iconEl) {
          c.iconEl.style.cssText = `
            position: fixed;
            right: ${edgeMargin}px;
            top: ${c._iconTop}px;
            left: auto;
            bottom: auto;
            z-index: ${zIndexBase + zIndexIcon};
            display: flex;
          `;
          // 标记位置已就绪
          c.iconEl.classList.add('yc-position-ready');
        }

        // 应用 panel 位置（保留原有 overflow 和 flex 属性）
        if (c.panelEl) {
          if (isCollapsed) {
            c.panelEl.style.display = 'none';
          } else {
            // 检查是否有用户自定义位置
            if (c.userCustomizedPanel && this.userPanelPositions[c.id]) {
              const userPos = this.userPanelPositions[c.id];
              c.panelEl.style.position = 'fixed';
              c.panelEl.style.right = `${userPos.right}px`;
              c.panelEl.style.top = `${userPos.top}px`;
              c.panelEl.style.left = 'auto';
              c.panelEl.style.bottom = 'auto';
              c.panelEl.style.zIndex = `${zIndexBase + zIndexPanel}`;
              c.panelEl.style.width = `${maxPanelWidth}px`;
              // 仍然更新高度
              const panelHeight = panelHeights[heightIndex] || this.config.minPanelHeight;
              const maxAllowed = vh - userPos.top - edgeMargin;
              const actualHeight = Math.min(panelHeight, maxAllowed);
              c.panelEl.style.maxHeight = `${actualHeight}px`;
              c.panelEl.style.display = 'flex';
            } else {
              // 使用自动计算的位置
              const panelHeight = panelHeights[heightIndex] || this.config.minPanelHeight;
              // 确保不超出屏幕底部
              const maxAllowed = vh - panelTop - edgeMargin;
              const actualHeight = Math.min(panelHeight, maxAllowed);

              // 只设置位置相关属性，不覆盖 overflow 和 display: flex
              c.panelEl.style.position = 'fixed';
              c.panelEl.style.right = `${panelRight}px`;
              c.panelEl.style.top = `${panelTop}px`;
              c.panelEl.style.left = 'auto';
              c.panelEl.style.bottom = 'auto';
              c.panelEl.style.zIndex = `${zIndexBase + zIndexPanel}`;
              c.panelEl.style.width = `${maxPanelWidth}px`;
              c.panelEl.style.maxHeight = `${actualHeight}px`;
              c.panelEl.style.display = 'flex';

              // 下一个面板的 top 位置
              panelTop += actualHeight + this.config.panelGap;
            }
            heightIndex++;
            // 标记位置已就绪
            c.panelEl.classList.add('yc-position-ready');
          }
        }
      }

      // 隐藏不可见的组件
      for (const c of sorted) {
        const isHidden = this.isComponentHidden(c, hasH);
        if (isHidden) {
          if (c.iconEl) c.iconEl.style.display = 'none';
          if (c.panelEl) c.panelEl.style.display = 'none';
          c._fixedPosition = null;
        }
      }

      this.positionsFixed = true;
      this.isPositionReady = true;

      console.log('[位置管理器] 位置已计算:', {
        expandedCount: expandedPanels.length,
        availableHeight,
        panelHeights,
        iconGap
      });
    },

    // 计算 panel 高度分配
    calculatePanelHeights(expandedPanels, availableHeight) {
      const { panelGap, minPanelHeight } = this.config;
      const panelCount = expandedPanels.length;

      if (panelCount === 0) return [];

      // 计算间隙总和
      const gapTotal = panelGap * (panelCount - 1);
      const usableHeight = availableHeight - gapTotal;

      if (panelCount === 1) {
        // 单个面板独占全部可用高度
        return [Math.max(usableHeight, minPanelHeight)];
      }

      // 多个面板：均分可用空间
      const eachHeight = Math.floor(usableHeight / panelCount);

      // 确保最小高度
      const safeHeight = Math.max(eachHeight, minPanelHeight);

      // 按顺序返回高度
      return expandedPanels.map(() => safeHeight);
    },

    // 动态计算 icon 间距
    calculateIconGap() {
      const vh = window.innerHeight;
      const { edgeMargin, iconHeight, iconGapMin, iconGapMax } = this.config;

      // 统计可见组件数量
      const visibleCount = this.components.filter(c => this.isComponentVisible(c)).length;

      if (visibleCount <= 1) return iconGapMin;

      // 可用空间 = 视口高度 - 上下边距 - 所有 icon 高度
      const availableSpace = vh - (edgeMargin * 2) - (visibleCount * iconHeight);
      const gapCount = visibleCount - 1;
      const dynamicGap = Math.floor(availableSpace / gapCount);

      return Math.max(iconGapMin, Math.min(iconGapMax, dynamicGap));
    },

    hasHTags() {
      return document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
    },

    // 判断组件是否应该可见（考虑 requiresHTags 配置）
    isComponentVisible(c) {
      if (c.requiresHTags && !this.hasHTags()) {
        return false;
      }
      return true;
    },

    // 判断组件是否应该隐藏
    isComponentHidden(c, hasH) {
      // 兼容旧的配置方式
      if (c.requiresHTags !== undefined) {
        return c.requiresHTags && !hasH;
      }
      // 兼容旧的全局配置
      if (c.id.includes('doc') && this.config.docGeneratorRequireHTags && !hasH) {
        return true;
      }
      return false;
    },

    // ==================== 组件注册 ====================

    register(options) {
      const { id, priority = 0, iconEl, panelEl, requiresHTags = false } = options;

      if (!id || !panelEl) {
        console.warn('[位置管理器] 注册失败: 缺少 id 或 panelEl');
        return;
      }

      if (this.components.find(c => c.id === id)) {
        console.warn(`[位置管理器] ${id} 已注册`);
        return;
      }

      // 检查是否有保存的用户自定义位置
      const hasUserPosition = this.userPanelPositions[id] !== undefined;

      this.components.push({
        id,
        priority,
        iconEl,
        panelEl,
        requiresHTags,
        isVisible: !this.collapsedStates[id],
        _fixedPosition: null,
        userCustomizedPanel: hasUserPosition
      });

      this.components.sort((a, b) => a.priority - b.priority);
      console.log(`[位置管理器] 注册: ${id}, priority=${priority}, requiresHTags=${requiresHTags}`);
      this.scheduleCalculate();
    },

    unregister(id) {
      const idx = this.components.findIndex(c => c.id === id);
      if (idx === -1) return;
      this.components.splice(idx, 1);

      this.positionsFixed = false;
      this.scheduleCalculate();
    },

    // ==================== 折叠/展开 ====================

    toggleCollapse(id) {
      this.collapsedStates[id] ? this.expandPanel(id) : this.collapsePanel(id);
    },

    expandPanel(id) {
      const c = this.components.find(c => c.id === id);
      if (!c) return;

      this.collapsedStates[id] = false;
      c.isVisible = true;

      // 清除用户自定义位置，让管理器重新计算
      c.userCustomizedPanel = false;
      delete this.userPanelPositions[id];

      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();

      console.log(`[位置管理器] 展开: ${id}`);
    },

    collapsePanel(id) {
      const c = this.components.find(c => c.id === id);
      if (!c) return;

      this.collapsedStates[id] = true;
      c.isVisible = false;

      // 将其他已展开的 panel 标记为保持位置
      this.components.forEach(comp => {
        if (comp.id !== id && !this.collapsedStates[comp.id] && comp.panelEl) {
          comp.userCustomizedPanel = true;
          this.userPanelPositions[comp.id] = {
            right: parseInt(comp.panelEl.style.right) || 70,
            top: parseInt(comp.panelEl.style.top) || 20
          };
        }
      });

      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();

      console.log(`[位置管理器] 折叠: ${id}`);
    },

    expandAll() {
      this.components.forEach(c => {
        this.collapsedStates[c.id] = false;
        c.isVisible = true;
      });
      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();
    },

    collapseAll() {
      this.components.forEach(c => {
        this.collapsedStates[c.id] = true;
        c.isVisible = false;
      });
      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();
    },

    handlePanelToggle(id, visible) {
      const c = this.components.find(c => c.id === id);

      if (visible) {
        this.collapsedStates[id] = false;
        if (c) {
          c.isVisible = true;
          // 清除用户自定义位置
          c.userCustomizedPanel = false;
          delete this.userPanelPositions[id];
        }
      } else {
        this.collapsedStates[id] = true;
        if (c) c.isVisible = false;

        // 将其他已展开的 panel 标记为保持位置
        this.components.forEach(comp => {
          if (comp.id !== id && !this.collapsedStates[comp.id] && comp.panelEl) {
            comp.userCustomizedPanel = true;
            this.userPanelPositions[comp.id] = {
              right: parseInt(comp.panelEl.style.right) || 70,
              top: parseInt(comp.panelEl.style.top) || 20
            };
          }
        });
      }

      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();
    },

    // ==================== 自定义位置（保留但优先级低于自动布局）====================

    saveComponentPosition(id, iconPos, panelPos) {
      this.customPositions[id] = { icon: iconPos, panel: panelPos };
      this.saveToStorage();
    },

    clearComponentPosition(id) {
      delete this.customPositions[id];
      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();
    },

    restoreComponentPosition(id) {
      // 不再支持自定义位置恢复，由管理器统一控制
      return false;
    },

    notifyDragStart() {},

    notifyDragEnd(id, iconEl, panelEl) {
      const c = this.components.find(c => c.id === id);
      if (c && panelEl) {
        // 标记为用户自定义位置
        c.userCustomizedPanel = true;
        // 保存用户拖拽后的位置
        this.userPanelPositions[id] = {
          right: parseInt(panelEl.style.right) || 70,
          top: parseInt(panelEl.style.top) || 20
        };
        this.saveToStorage();
        // 只重新计算 icon 位置，不覆盖 panel 位置
        this.recalculateIconsOnly();
      }
    },

    // 只重新计算 icon 位置，保留用户自定义的 panel 位置
    recalculateIconsOnly() {
      const { edgeMargin, iconHeight, zIndexBase, zIndexIcon } = this.config;
      const iconGap = this.calculateIconGap();
      const hasH = this.hasHTags();

      const sorted = [...this.components].sort((a, b) => a.priority - b.priority);
      let iconTop = edgeMargin;

      for (const c of sorted) {
        if (!this.isComponentHidden(c, hasH)) {
          c._iconTop = iconTop;
          if (c.iconEl) {
            c.iconEl.style.top = `${iconTop}px`;
            c.iconEl.style.zIndex = `${zIndexBase + zIndexIcon}`;
          }
          iconTop += iconHeight + iconGap;
        }
      }
    },

    // 约束面板位置（用于拖拽时的边界检查）
    constrainPanelPosition(id, right, top, width, height) {
      const vh = window.innerHeight;
      const { edgeMargin, iconWidth, panelAvoidGap } = this.config;

      // 计算icon区域宽度
      const iconAreaWidth = iconWidth + edgeMargin * 2;

      // 确保不超出屏幕边界
      const minRight = edgeMargin + iconWidth + panelAvoidGap;
      const maxRight = window.innerWidth - width - edgeMargin;
      const constrainedRight = Math.max(minRight, Math.min(right, maxRight));

      const minTop = edgeMargin;
      const maxTop = vh - height - edgeMargin;
      const constrainedTop = Math.max(minTop, Math.min(top, maxTop));

      return { right: constrainedRight, top: constrainedTop };
    },

    // ==================== 存储 ====================

    saveToStorage() {
      try {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
          customPositions: this.customPositions,
          collapsedStates: this.collapsedStates,
          userPanelPositions: this.userPanelPositions
        }));
      } catch (e) {}
    },

    loadFromStorage() {
      try {
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          this.customPositions = data.customPositions || {};
          this.collapsedStates = data.collapsedStates || {};
          this.userPanelPositions = data.userPanelPositions || {};
        }
      } catch (e) {}
    },

    destroy() {
      if (this._resizeTimer) clearTimeout(this._resizeTimer);
      if (this.pendingCalculate) clearTimeout(this.pendingCalculate);
      this.components = [];
    },

    debug() {
      const vh = window.innerHeight;
      const { edgeMargin, panelGap, spaceUsageRatio } = this.config;

      const expandedPanels = this.components.filter(c => {
        const hasH = this.hasHTags();
        const isHidden = c.id.includes('doc') && this.config.docGeneratorRequireHTags && !hasH;
        const isCollapsed = this.collapsedStates[c.id];
        return !isHidden && !isCollapsed;
      });

      const availableHeight = (vh - edgeMargin * 2) * spaceUsageRatio;
      const heights = this.calculatePanelHeights(expandedPanels, availableHeight);

      return {
        components: this.components.map(c => ({
          id: c.id,
          priority: c.priority,
          position: c._fixedPosition,
          isCollapsed: this.collapsedStates[c.id]
        })),
        viewportHeight: vh,
        availableHeight,
        panelHeights: heights,
        spaceUsageRatio,
        positionsFixed: this.positionsFixed
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.PanelPositionManager.init());
  } else {
    window.PanelPositionManager.init();
  }
}
