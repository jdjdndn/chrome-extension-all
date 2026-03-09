// 面板位置管理器 v29
// 功能：
// 1. icon 松散排列在可视区右侧，不重叠
// 2. 展开单个 panel 时独占 90% 空白可视区
// 3. 展开多个 panel 时按 7:3 比例垂直分配空间
// 4. 用户拖拽面板后，自动检测并调整其他面板避免重叠
// 5. 空白区域检测：作为备选方案，当固定位置不可用时启用

'use strict';

if (!window.PanelPositionManager) {
  window.PanelPositionManager = {
    STORAGE_KEY: 'yc-panel-position-manager-v29',

    config: {
      iconWidth: 50,
      iconHeight: 50,
      iconGapMin: 200,    // 最小间距
      iconGapMax: 350,    // 最大间距
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
      // 多面板高度比例（按 priority 排序，priority 越小占比越大）
      // doc-generator (priority=1) : text-collector (priority=2) = 7:3
      panelHeightRatios: [0.7, 0.3],
      // 空白区域检测配置
      emptyAreaSampleDensity: 9,
      overlapThreshold: 0,
      searchStepX: 50,
      searchStepY: 100,
      maxSearchAttempts: 20,
      ignoredTags: ['HTML', 'BODY', 'HEAD'],
      // panel 最小重叠阈值（像素）
      minOverlapThreshold: 50,
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

      console.log('[位置管理器] v29 已加载（垂直布局 + 拖拽重叠检测 + 自动调整）');
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
      const vw = window.innerWidth;
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

      // 第二步：计算 icon 位置（松散排列在右侧）
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
      const availableHeight = (vh - edgeMargin * 2) * spaceUsageRatio;
      const panelRight = edgeMargin + iconWidth + panelAvoidGap;

      // 第五步：计算每个展开面板的高度
      const panelHeights = this.calculatePanelHeights(expandedPanels, availableHeight);

      // 第六步：计算并应用位置（区分自动布局和用户自定义）
      // 先收集所有面板的目标位置信息
      const panelPositions = new Map();

      // 计算自动布局的位置（垂直排列）
      let autoLayoutTop = edgeMargin;
      for (let i = 0; i < expandedPanels.length; i++) {
        const c = expandedPanels[i];
        const panelHeight = panelHeights[i] || this.config.minPanelHeight;
        const maxAllowed = vh - autoLayoutTop - edgeMargin;
        const actualHeight = Math.min(panelHeight, maxAllowed);

        panelPositions.set(c.id, {
          right: panelRight,
          top: autoLayoutTop,
          height: actualHeight,
          width: maxPanelWidth,
          isUserCustomized: false
        });

        autoLayoutTop = autoLayoutTop + actualHeight + this.config.panelGap;
      }

      // 应用用户自定义位置（如果有）
      for (const c of expandedPanels) {
        if (c.userCustomizedPanel && this.userPanelPositions[c.id]) {
          const userPos = this.userPanelPositions[c.id];
          const pos = panelPositions.get(c.id);
          if (pos) {
            pos.right = userPos.right;
            pos.top = userPos.top;
            pos.isUserCustomized = true;
          }
        }
      }

      // 第七步：检测并解决重叠（只调整非用户自定义的面板）
      this.resolveAllOverlaps(expandedPanels, panelPositions, vh, vw);

      // 第八步：应用位置到 DOM
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
          c.iconEl.classList.add('yc-position-ready');
        }

        // 应用 panel 位置
        if (c.panelEl) {
          if (isCollapsed) {
            c.panelEl.style.display = 'none';
          } else {
            const pos = panelPositions.get(c.id);
            if (pos) {
              c.panelEl.style.position = 'fixed';
              c.panelEl.style.right = `${pos.right}px`;
              c.panelEl.style.top = `${pos.top}px`;
              c.panelEl.style.left = 'auto';
              c.panelEl.style.bottom = 'auto';
              c.panelEl.style.zIndex = `${zIndexBase + zIndexPanel}`;
              c.panelEl.style.width = `${pos.width}px`;
              c.panelEl.style.maxHeight = `${pos.height}px`;
              c.panelEl.style.display = 'flex';
              c.panelEl.classList.add('yc-position-ready');
            }
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
        iconGap,
        positions: Array.from(panelPositions.entries()).map(([id, pos]) => ({
          id,
          top: pos.top,
          right: pos.right,
          userCustomized: pos.isUserCustomized
        }))
      });
    },

    // ==================== 重叠检测与解决 ====================

    // 检测两个矩形是否重叠
    checkRectOverlap(rect1, rect2, threshold = this.config.minOverlapThreshold) {
      // rect 格式: { x, y, width, height } 或 { right, top, width, height } (需要转换)
      const r1 = rect1.x !== undefined ? rect1 : this.convertToXY(rect1);
      const r2 = rect2.x !== undefined ? rect2 : this.convertToXY(rect2);

      // 计算重叠区域
      const overlapLeft = Math.max(r1.x, r2.x);
      const overlapRight = Math.min(r1.x + r1.width, r2.x + r2.width);
      const overlapTop = Math.max(r1.y, r2.y);
      const overlapBottom = Math.min(r1.y + r1.height, r2.y + r2.height);

      // 如果有重叠
      if (overlapLeft < overlapRight && overlapTop < overlapBottom) {
        const overlapWidth = overlapRight - overlapLeft;
        const overlapHeight = overlapBottom - overlapTop;
        const overlapArea = overlapWidth * overlapHeight;

        // 如果重叠面积大于阈值，认为有重叠
        if (overlapWidth > threshold || overlapHeight > threshold) {
          return {
            hasOverlap: true,
            overlapWidth,
            overlapHeight,
            overlapArea
          };
        }
      }

      return { hasOverlap: false };
    },

    // 将 right/top 格式转换为 x/y 格式
    convertToXY(rect) {
      const vw = window.innerWidth;
      return {
        x: vw - rect.right - rect.width,
        y: rect.top,
        width: rect.width,
        height: rect.height
      };
    },

    // 解决所有面板之间的重叠
    resolveAllOverlaps(expandedPanels, panelPositions, vh, vw) {
      const { edgeMargin, minPanelHeight, panelGap } = this.config;

      // 检查每对面板是否有重叠
      for (let i = 0; i < expandedPanels.length; i++) {
        for (let j = i + 1; j < expandedPanels.length; j++) {
          const panel1 = expandedPanels[i];
          const panel2 = expandedPanels[j];
          const pos1 = panelPositions.get(panel1.id);
          const pos2 = panelPositions.get(panel2.id);

          if (!pos1 || !pos2) continue;

          const overlap = this.checkRectOverlap(
            { right: pos1.right, top: pos1.top, width: pos1.width, height: pos1.height },
            { right: pos2.right, top: pos2.top, width: pos2.width, height: pos2.height }
          );

          if (overlap.hasOverlap) {
            console.log(`[位置管理器] 检测到重叠: ${panel1.id} 和 ${panel2.id}`);

            // 决定调整哪个面板：
            // 1. 用户自定义位置的面板优先级更高，不调整
            // 2. 都不是用户自定义时，调整 priority 较低的面板（排在后面的）
            let panelToAdjust, posToAdjust, otherPos;

            if (pos1.isUserCustomized && !pos2.isUserCustomized) {
              // 调整 panel2
              panelToAdjust = panel2;
              posToAdjust = pos2;
              otherPos = pos1;
            } else if (!pos1.isUserCustomized && pos2.isUserCustomized) {
              // 调整 panel1
              panelToAdjust = panel1;
              posToAdjust = pos1;
              otherPos = pos2;
            } else {
              // 都不是用户自定义，或者都是用户自定义时，调整 priority 较低的
              if (panel1.priority <= panel2.priority) {
                panelToAdjust = panel2;
                posToAdjust = pos2;
                otherPos = pos1;
              } else {
                panelToAdjust = panel1;
                posToAdjust = pos1;
                otherPos = pos2;
              }
            }

            // 计算新位置：将面板移动到另一个面板的下方或上方
            const newTopBelow = otherPos.top + otherPos.height + panelGap;
            const newTopAbove = otherPos.top - posToAdjust.height - panelGap;

            // 优先放在下方
            if (newTopBelow + posToAdjust.height <= vh - edgeMargin) {
              posToAdjust.top = newTopBelow;
              console.log(`[位置管理器] 调整 ${panelToAdjust.id} 到下方: top=${newTopBelow}`);
            } else if (newTopAbove >= edgeMargin) {
              // 如果下方放不下，尝试放在上方
              posToAdjust.top = newTopAbove;
              console.log(`[位置管理器] 调整 ${panelToAdjust.id} 到上方: top=${newTopAbove}`);
            } else {
              // 都放不下，尝试向左移动
              const newRight = otherPos.right + posToAdjust.width + panelGap;
              const maxRight = vw - posToAdjust.width - edgeMargin;
              if (newRight <= maxRight) {
                posToAdjust.right = newRight;
                console.log(`[位置管理器] 调整 ${panelToAdjust.id} 到左侧: right=${newRight}`);
              }
            }
          }
        }
      }
    },

    // 计算 panel 高度分配
    calculatePanelHeights(expandedPanels, availableHeight) {
      const { panelGap, minPanelHeight, panelHeightRatios } = this.config;
      const panelCount = expandedPanels.length;

      if (panelCount === 0) return [];

      // 计算间隙总和
      const gapTotal = panelGap * (panelCount - 1);
      const usableHeight = availableHeight - gapTotal;

      if (panelCount === 1) {
        // 单个面板独占全部可用高度
        return [Math.max(usableHeight, minPanelHeight)];
      }

      // 多个面板：按配置的比例分配（已按 priority 排序）
      const heights = [];
      for (let i = 0; i < panelCount; i++) {
        // 使用配置的比例，如果没有配置则均分
        const ratio = panelHeightRatios[i] || (1 / panelCount);
        const height = Math.floor(usableHeight * ratio);
        heights.push(Math.max(height, minPanelHeight));
      }

      return heights;
    },

    // ==================== 空白区域检测（作为备选方案）====================

    // 检测元素是否可忽略
    isIgnorableElement(el, excludeElements = []) {
      if (!el) return true;

      // 忽略指定标签
      if (this.config.ignoredTags.includes(el.tagName)) {
        return true;
      }

      // 忽略隐藏元素
      const style = window.getComputedStyle(el);
      if (style.display === 'none' ||
          style.visibility === 'hidden' ||
          parseFloat(style.opacity) === 0) {
        return true;
      }

      // 忽略排除列表中的元素（如 panel 自身）
      if (excludeElements.some(ex => ex && (el === ex || el.contains(ex) || ex.contains(el)))) {
        return true;
      }

      return false;
    },

    // 检测区域是否空白
    isAreaEmpty(x, y, width, height, excludeElements = []) {
      // 根据区域大小确定采样密度
      let samplePoints;
      const area = width * height;

      if (area < 40000) { // < 200x200
        samplePoints = [
          { x: x + 5, y: y + 5 },
          { x: x + width - 5, y: y + 5 },
          { x: x + width / 2, y: y + height / 2 },
          { x: x + 5, y: y + height - 5 },
          { x: x + width - 5, y: y + height - 5 }
        ];
      } else if (area < 160000) { // < 400x400
        samplePoints = [];
        for (let row = 0; row < 3; row++) {
          for (let col = 0; col < 3; col++) {
            samplePoints.push({
              x: x + (width * (col + 0.5) / 3),
              y: y + (height * (row + 0.5) / 3)
            });
          }
        }
      } else {
        samplePoints = [];
        for (let row = 0; row < 4; row++) {
          for (let col = 0; col < 4; col++) {
            samplePoints.push({
              x: x + (width * (col + 0.5) / 4),
              y: y + (height * (row + 0.5) / 4)
            });
          }
        }
      }

      // 检测每个采样点
      for (const point of samplePoints) {
        if (point.x < 0 || point.x > window.innerWidth ||
            point.y < 0 || point.y > window.innerHeight) {
          continue;
        }

        const el = document.elementFromPoint(point.x, point.y);
        if (!this.isIgnorableElement(el, excludeElements)) {
          return false;
        }
      }

      return true;
    },

    // 计算重叠比例
    calculateOverlapRatio(rect, excludeElements = []) {
      const { x, y, width, height } = rect;
      const area = width * height;

      let samplePoints;
      if (area < 40000) {
        samplePoints = 5;
      } else if (area < 160000) {
        samplePoints = 9;
      } else {
        samplePoints = 16;
      }

      let overlappedPoints = 0;
      const cols = Math.ceil(Math.sqrt(samplePoints));
      const rows = Math.ceil(samplePoints / cols);

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const pointX = x + (width * (col + 0.5) / cols);
          const pointY = y + (height * (row + 0.5) / rows);

          if (pointX < 0 || pointX > window.innerWidth ||
              pointY < 0 || pointY > window.innerHeight) {
            continue;
          }

          const el = document.elementFromPoint(pointX, pointY);
          if (!this.isIgnorableElement(el, excludeElements)) {
            overlappedPoints++;
          }
        }
      }

      return overlappedPoints / samplePoints;
    },

    // 寻找最佳空白位置（备选方案）
    findBestPosition(panelWidth, panelHeight, preferredRight, preferredTop) {
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { edgeMargin, searchStepX, searchStepY, maxSearchAttempts, overlapThreshold, iconWidth, panelAvoidGap } = this.config;

      // 获取所有 panel 元素作为排除列表
      const excludeElements = this.components
        .map(c => c.panelEl)
        .filter(el => el && el.style.display !== 'none');

      // 计算最小 right 值（不能遮挡 icon）
      const minRight = edgeMargin + iconWidth + panelAvoidGap;

      // 先检查首选位置
      const preferredRect = {
        x: vw - preferredRight - panelWidth,
        y: preferredTop,
        width: panelWidth,
        height: panelHeight
      };

      if (this.isAreaEmpty(preferredRect.x, preferredRect.y, preferredRect.width, preferredRect.height, excludeElements)) {
        return { right: preferredRight, top: preferredTop };
      }

      // 搜索策略：从首选位置向左搜索（right 值增大 = 向左移动）
      let bestPosition = { right: preferredRight, top: preferredTop, overlapRatio: 1 };
      let attempts = 0;

      // 修正：向左搜索时，right 值应该增大
      for (let right = preferredRight; right <= vw - panelWidth - edgeMargin && attempts < maxSearchAttempts; right += searchStepX) {
        for (let top = edgeMargin; top <= vh - panelHeight - edgeMargin; top += searchStepY) {
          attempts++;

          const rect = {
            x: vw - right - panelWidth,
            y: top,
            width: panelWidth,
            height: panelHeight
          };

          // 确保不超出左边界（不遮挡 icon）
          if (rect.x < minRight) {
            break;
          }

          const overlapRatio = this.calculateOverlapRatio(rect, excludeElements);

          // 找到完全空白的位置
          if (overlapRatio <= overlapThreshold) {
            console.log(`[位置管理器] 找到空白位置: right=${right}, top=${top}, overlap=${overlapRatio}`);
            return { right, top };
          }

          // 记录最佳位置（重叠最少的）
          if (overlapRatio < bestPosition.overlapRatio) {
            bestPosition = { right, top, overlapRatio };
          }

          if (attempts >= maxSearchAttempts) break;
        }
      }

      console.log(`[位置管理器] 使用最佳位置: right=${bestPosition.right}, top=${bestPosition.top}, overlap=${bestPosition.overlapRatio}`);
      return { right: bestPosition.right, top: bestPosition.top };
    },

    // ==================== 辅助方法 ====================

    // 动态计算 icon 间距
    calculateIconGap() {
      const vh = window.innerHeight;
      const { edgeMargin, iconHeight, iconGapMin, iconGapMax } = this.config;

      const visibleCount = this.components.filter(c => this.isComponentVisible(c)).length;

      if (visibleCount <= 1) return iconGapMin;

      const availableSpace = vh - (edgeMargin * 2) - (visibleCount * iconHeight);
      const gapCount = visibleCount - 1;
      const dynamicGap = Math.floor(availableSpace / gapCount);

      return Math.max(iconGapMin, Math.min(iconGapMax, dynamicGap));
    },

    hasHTags() {
      return document.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
    },

    isComponentVisible(c) {
      if (c.requiresHTags && !this.hasHTags()) {
        return false;
      }
      return true;
    },

    isComponentHidden(c, hasH) {
      if (c.requiresHTags !== undefined) {
        return c.requiresHTags && !hasH;
      }
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

      // 展开时清除该面板的用户自定义位置，让管理器重新计算
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

      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();

      console.log(`[位置管理器] 折叠: ${id}`);
    },

    expandAll() {
      this.components.forEach(c => {
        this.collapsedStates[c.id] = false;
        c.isVisible = true;
        // 清除用户自定义位置
        c.userCustomizedPanel = false;
        delete this.userPanelPositions[c.id];
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
      }

      this.saveToStorage();
      this.positionsFixed = false;
      this.scheduleCalculate();
    },

    // ==================== 拖拽处理 ====================

    notifyDragStart() {
      // 拖拽开始时不需要特殊处理
    },

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

        // 触发重新计算，让其他面板自动调整位置避免重叠
        this.positionsFixed = false;
        this.scheduleCalculate();

        console.log(`[位置管理器] 拖拽结束: ${id}, 位置已保存，将自动调整其他面板`);
      }
    },

    // 约束面板位置（用于拖拽时的边界检查）
    constrainPanelPosition(id, right, top, width, height) {
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const { edgeMargin, iconWidth, panelAvoidGap } = this.config;

      // 计算最小 right 值（不能遮挡 icon）
      const minRight = edgeMargin + iconWidth + panelAvoidGap;
      const maxRight = vw - width - edgeMargin;
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
      } catch (e) {
        console.warn('[位置管理器] 保存失败:', e);
      }
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
      } catch (e) {
        console.warn('[位置管理器] 加载失败:', e);
      }
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
        version: 'v29',
        components: this.components.map(c => ({
          id: c.id,
          priority: c.priority,
          position: c._fixedPosition,
          isCollapsed: this.collapsedStates[c.id],
          userCustomized: c.userCustomizedPanel
        })),
        viewportHeight: vh,
        availableHeight,
        panelHeights: heights,
        spaceUsageRatio,
        positionsFixed: this.positionsFixed,
        userPanelPositions: this.userPanelPositions
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.PanelPositionManager.init());
  } else {
    window.PanelPositionManager.init();
  }
}
