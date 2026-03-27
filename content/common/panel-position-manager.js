// 面板位置管理器 v32
// 功能：
// 1. icon 松散排列在可视区右侧，不重叠
// 2. 展开单个 panel 时独占 90% 空白可视区
// 3. 展开多个 panel 时按 7:3 比例垂直分配空间
// 4. 用户拖拽面板后，自动检测并调整其他面板避免重叠
// 5. 空白区域检测：作为备选方案，当固定位置不可用时启用
// 6. 位置信息记录到元素 data 属性，支持碰撞检测
// 7. 内容遮挡检测：检测 icon/panel 是否遮挡页面内容
// 8. 页面元素遮挡检测：检测页面上其他绝对定位元素的遮挡问题

'use strict';

if (!window.PanelPositionManager) {
  // 检查开关
  if (window.getScriptSwitch && !window.getScriptSwitch('panel-position-manager')) {
    console.log('[面板位置管理器] 已禁用');
  } else {
    window.PanelPositionManager = {
    STORAGE_KEY: 'yc-panel-position-manager-v32',

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

      console.log('[位置管理器] v32 已加载（垂直布局 + 全方位遮挡检测）');
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
      const { edgeMargin, minPanelWidth, maxPanelWidth, iconWidth, iconHeight, panelAvoidGap, spaceUsageRatio, zIndexBase, zIndexIcon, zIndexPanel } = this.config;
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

      // 检测页面顶部固定 header 高度，避免遮挡
      const headerHeight = this.detectFixedHeaderHeight();
      const startTop = Math.max(edgeMargin, headerHeight + edgeMargin);

      // 第二步：计算 icon 位置（松散排列在右侧，避开 header）
      let iconTop = startTop;
      for (const c of visibleComponents) {
        c._iconTop = iconTop;
        iconTop += iconHeight + iconGap;
      }

      // 第三步：识别展开的面板
      const expandedPanels = visibleComponents.filter(c => {
        return !this.collapsedStates[c.id] && c.panelEl;
      });

      // 第四步：检测页面布局，计算面板可用空间
      const availableHeight = (vh - edgeMargin * 2) * spaceUsageRatio;
      const pageLayout = this.detectPageLayout();

      // 根据页面布局计算 icon 和 panel 位置
      // icon 始终在右边缘，panel 在 icon 左侧
      // 这样确保 panel 不会遮挡 icon
      let iconRight = edgeMargin;
      let panelRight = edgeMargin + iconWidth + panelAvoidGap;
      let panelWidth = maxPanelWidth;

      if (pageLayout.mainElement && pageLayout.rightSpace > edgeMargin) {
        // 检测到主体区域，尝试优化 panel 位置
        const minRequiredSpace = iconWidth + panelAvoidGap + minPanelWidth;
        const rightSpace = pageLayout.rightSpace;

        if (rightSpace >= minRequiredSpace) {
          // 右侧空间足够放置 icon + panel
          panelWidth = Math.min(maxPanelWidth, rightSpace - iconWidth - panelAvoidGap - edgeMargin);
          panelRight = edgeMargin + iconWidth + panelAvoidGap;
          console.log(`[位置管理器] 右侧空间足够: panelRight=${Math.round(panelRight)}, width=${Math.round(panelWidth)}`);
        } else if (rightSpace >= iconWidth + panelAvoidGap + edgeMargin) {
          // 右侧空间只能放 icon，panel 需要调整宽度或放左侧
          if (pageLayout.leftSpace >= minPanelWidth + edgeMargin) {
            // 左侧空间够，panel 放左侧
            panelRight = window.innerWidth - pageLayout.leftSpace + edgeMargin;
            panelWidth = Math.min(maxPanelWidth, pageLayout.leftSpace - edgeMargin * 2);
            console.log(`[位置管理器] panel放左侧: panelRight=${Math.round(panelRight)}, width=${Math.round(panelWidth)}`);
          } else {
            // 左侧也不够，panel 调整宽度紧贴 icon
            panelWidth = Math.max(minPanelWidth, rightSpace - iconWidth - panelAvoidGap - edgeMargin);
            panelRight = edgeMargin + iconWidth + panelAvoidGap;
            console.log(`[位置管理器] panel调整宽度: panelRight=${Math.round(panelRight)}, width=${Math.round(panelWidth)}`);
          }
        }
        // 如果右侧空间连 icon 都放不下，保持默认位置
      }

      // 第五步：计算每个展开面板的高度
      const panelHeights = this.calculatePanelHeights(expandedPanels, availableHeight);

      // 第六步：计算并应用位置（区分自动布局和用户自定义）
      // 先收集所有面板的目标位置信息
      const panelPositions = new Map();

      // 计算自动布局的位置（垂直排列，避开 header）
      let autoLayoutTop = startTop;
      for (let i = 0; i < expandedPanels.length; i++) {
        const c = expandedPanels[i];
        const panelHeight = panelHeights[i] || this.config.minPanelHeight;
        const maxAllowed = vh - autoLayoutTop - edgeMargin;
        const actualHeight = Math.min(panelHeight, maxAllowed);

        panelPositions.set(c.id, {
          right: panelRight,
          top: autoLayoutTop,
          height: actualHeight,
          width: panelWidth,
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

        // 应用 icon 位置（使用布局检测结果）
        if (c.iconEl) {
          c.iconEl.style.cssText = `
            position: fixed;
            right: ${iconRight}px;
            top: ${c._iconTop}px;
            left: auto;
            bottom: auto;
            z-index: ${zIndexBase + zIndexIcon};
            display: flex;
          `;
          c.iconEl.classList.add('yc-position-ready');

          // 记录 icon 位置信息到元素上，用于碰撞检测
          this.recordElementBounds(c.iconEl, 'icon', c.id, {
            right: iconRight,
            top: c._iconTop,
            width: iconWidth,
            height: iconHeight
          });
        }

        // 应用 panel 位置
        if (c.panelEl) {
          if (isCollapsed) {
            c.panelEl.style.display = 'none';
            // 清除隐藏面板的位置信息
            this.clearElementBounds(c.panelEl);
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

              // 记录 panel 位置信息到元素上，用于碰撞检测
              this.recordElementBounds(c.panelEl, 'panel', c.id, {
                right: pos.right,
                top: pos.top,
                width: pos.width,
                height: pos.height
              });
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

    // ==================== 内容遮挡检测 ====================

    // 重要内容标签（按重要性排序）
    importantContentTags: {
      critical: ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'FORM'],  // 交互元素
      high: ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'IMG', 'VIDEO', 'IFRAME'], // 媒体和标题
      medium: ['P', 'SPAN', 'DIV', 'LI', 'TD', 'TH', 'LABEL'],  // 文本容器
      low: ['SECTION', 'ARTICLE', 'ASIDE', 'NAV', 'FOOTER', 'HEADER'] // 布局元素
    },

    // 检测单个组件是否遮挡页面内容
    checkComponentOcclusion(componentId) {
      const c = this.components.find(c => c.id === componentId);
      if (!c) return { hasOcclusion: false, reason: 'component not found' };

      const results = {
        id: componentId,
        icon: null,
        panel: null,
        hasOcclusion: false,
        occludedElements: [],
        severity: 'none' // none | low | medium | high | critical
      };

      // 获取排除元素列表（组件自身）
      const excludeElements = [c.iconEl, c.panelEl].filter(Boolean);

      // 检测 icon 遮挡
      if (c.iconEl && c.iconEl.dataset.ycType) {
        const iconBounds = this.getElementBounds(c.iconEl);
        if (iconBounds) {
          const iconOcclusion = this.detectOcclusionInArea(
            iconBounds, excludeElements, 'icon'
          );
          results.icon = iconOcclusion;
          if (iconOcclusion.hasOcclusion) {
            results.hasOcclusion = true;
            results.occludedElements.push(...iconOcclusion.elements);
          }
        }
      }

      // 检测 panel 遮挡（仅当展开时）
      if (c.panelEl && c.panelEl.dataset.ycType && !this.collapsedStates[c.id]) {
        const panelBounds = this.getElementBounds(c.panelEl);
        if (panelBounds) {
          const panelOcclusion = this.detectOcclusionInArea(
            panelBounds, excludeElements, 'panel'
          );
          results.panel = panelOcclusion;
          if (panelOcclusion.hasOcclusion) {
            results.hasOcclusion = true;
            results.occludedElements.push(...panelOcclusion.elements);
          }
        }
      }

      // 计算严重程度
      if (results.occludedElements.length > 0) {
        const hasCritical = results.occludedElements.some(el => el.importance === 'critical');
        const hasHigh = results.occludedElements.some(el => el.importance === 'high');
        results.severity = hasCritical ? 'critical' : hasHigh ? 'high' : 'medium';
      }

      return results;
    },

    // 检测指定区域内的遮挡情况
    detectOcclusionInArea(bounds, excludeElements, sourceType) {
      const { right, top, width, height } = bounds;
      const vw = window.innerWidth;

      // 转换为 x/y 坐标
      const x = vw - right - width;
      const y = top;

      const result = {
        sourceType,
        bounds: { x, y, width, height, right, top },
        hasOcclusion: false,
        elements: [],
        overlapRatio: 0
      };

      // 采样检测
      const sampleResult = this.sampleOccludedElements(x, y, width, height, excludeElements);
      result.elements = sampleResult.elements;
      result.overlapRatio = sampleResult.ratio;
      result.hasOcclusion = sampleResult.elements.length > 0;

      return result;
    },

    // 采样检测被遮挡的元素
    sampleOccludedElements(x, y, width, height, excludeElements) {
      const elements = [];
      const seenElements = new Set();

      // 根据区域大小确定采样密度
      const area = width * height;
      let cols, rows;
      if (area < 2500) { // < 50x50
        cols = 3; rows = 3;
      } else if (area < 10000) { // < 100x100
        cols = 5; rows = 5;
      } else if (area < 40000) { // < 200x200
        cols = 7; rows = 7;
      } else {
        cols = 9; rows = 9;
      }

      let overlappedCount = 0;
      const totalPoints = cols * rows;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const pointX = x + (width * (col + 0.5) / cols);
          const pointY = y + (height * (row + 0.5) / rows);

          // 边界检查
          if (pointX < 0 || pointX > window.innerWidth ||
              pointY < 0 || pointY > window.innerHeight) {
            continue;
          }

          const el = document.elementFromPoint(pointX, pointY);

          // 检查是否为可忽略元素
          if (this.isIgnorableElement(el, excludeElements)) {
            continue;
          }

          overlappedCount++;

          // 找到最重要的父元素（非布局容器）
          const importantEl = this.findImportantAncestor(el, excludeElements);
          if (importantEl && !seenElements.has(importantEl)) {
            seenElements.add(importantEl);
            const importance = this.getElementImportance(importantEl);
            elements.push({
              element: importantEl,
              tagName: importantEl.tagName,
              importance,
              text: this.getElementPreview(importantEl),
              rect: importantEl.getBoundingClientRect()
            });
          }
        }
      }

      // 按重要性排序
      const importanceOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      elements.sort((a, b) => importanceOrder[a.importance] - importanceOrder[b.importance]);

      return {
        elements,
        ratio: overlappedCount / totalPoints
      };
    },

    // 找到重要的祖先元素（跳过纯布局容器）
    findImportantAncestor(el, excludeElements) {
      let current = el;
      const maxDepth = 10;
      let depth = 0;

      while (current && depth < maxDepth) {
        // 排除自身
        if (excludeElements.some(ex => ex && (current === ex || ex.contains(current)))) {
          return null;
        }

        // 检查是否为重要元素
        if (this.isImportantElement(current)) {
          return current;
        }

        current = current.parentElement;
        depth++;
      }

      return el; // 找不到重要的，返回原始元素
    },

    // 判断元素是否为重要元素
    isImportantElement(el) {
      if (!el || !el.tagName) return false;

      const tag = el.tagName;

      // 交互元素
      if (this.importantContentTags.critical.includes(tag)) return true;

      // 媒体和标题
      if (this.importantContentTags.high.includes(tag)) return true;

      // 带有文本内容的元素
      if (el.innerText && el.innerText.trim().length > 0) {
        const textLength = el.innerText.trim().length;
        // 如果是 DIV/SPAN 但包含较多文本，认为重要
        if (this.importantContentTags.medium.includes(tag) && textLength > 20) {
          return true;
        }
      }

      return false;
    },

    // 获取元素重要性等级
    getElementImportance(el) {
      if (!el || !el.tagName) return 'low';

      const tag = el.tagName;

      if (this.importantContentTags.critical.includes(tag)) return 'critical';
      if (this.importantContentTags.high.includes(tag)) return 'high';
      if (this.importantContentTags.medium.includes(tag)) return 'medium';
      return 'low';
    },

    // 获取元素预览文本
    getElementPreview(el, maxLength = 50) {
      if (!el) return '';

      // 对于图片，返回 alt 或 src
      if (el.tagName === 'IMG') {
        return el.alt || el.src?.substring(0, maxLength) || '[图片]';
      }

      // 对于输入框，返回 placeholder 或 name
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
        return el.placeholder || el.name || el.type || '[输入框]';
      }

      // 对于链接，返回链接文本或 href
      if (el.tagName === 'A') {
        const text = el.innerText?.trim();
        if (text) return text.substring(0, maxLength);
        return el.href?.substring(0, maxLength) || '[链接]';
      }

      // 其他元素，返回文本内容
      const text = el.innerText?.trim();
      if (text) {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
      }

      return `[${tag}]`;
    },

    // 检测所有组件的遮挡情况
    checkAllOcclusions() {
      const results = {
        timestamp: Date.now(),
        components: [],
        totalOcclusions: 0,
        criticalCount: 0,
        highCount: 0
      };

      for (const c of this.components) {
        const occlusion = this.checkComponentOcclusion(c.id);
        results.components.push(occlusion);

        if (occlusion.hasOcclusion) {
          results.totalOcclusions++;
          if (occlusion.severity === 'critical') results.criticalCount++;
          if (occlusion.severity === 'high') results.highCount++;
        }
      }

      return results;
    },

    // 智能避让建议（找到遮挡最少的备选位置）
    suggestAvoidancePosition(componentId, maxAttempts = 10) {
      const c = this.components.find(c => c.id === componentId);
      if (!c || !c.panelEl) return null;

      const currentBounds = this.getElementBounds(c.panelEl);
      if (!currentBounds) return null;

      const { width, height, right, top } = currentBounds;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { edgeMargin, iconWidth, panelAvoidGap } = this.config;
      const minRight = edgeMargin + iconWidth + panelAvoidGap;

      // 排除自身
      const excludeElements = [c.iconEl, c.panelEl].filter(Boolean);

      // 计算当前位置的遮挡情况
      const currentScore = this.evaluatePosition(
        vw - right - width, top, width, height, excludeElements
      );

      // 候选位置
      const candidates = [];

      // 1. 尝试向左移动
      for (let newRight = right + 50; newRight <= vw - width - edgeMargin; newRight += 100) {
        const score = this.evaluatePosition(vw - newRight - width, top, width, height, excludeElements);
        if (score.overlapRatio < currentScore.overlapRatio) {
          candidates.push({ right: newRight, top, ...score });
        }
      }

      // 2. 尝试上下移动
      for (let newTop = edgeMargin; newTop <= vh - height - edgeMargin; newTop += 100) {
        const score = this.evaluatePosition(vw - right - width, newTop, width, height, excludeElements);
        if (score.overlapRatio < currentScore.overlapRatio) {
          candidates.push({ right, top: newTop, ...score });
        }
      }

      // 3. 尝试四个角落
      const corners = [
        { right: minRight, top: edgeMargin },
        { right: minRight, top: vh - height - edgeMargin },
        { right: vw - width - edgeMargin, top: edgeMargin },
        { right: vw - width - edgeMargin, top: vh - height - edgeMargin }
      ];

      for (const corner of corners) {
        const score = this.evaluatePosition(
          vw - corner.right - width, corner.top, width, height, excludeElements
        );
        candidates.push({ ...corner, ...score });
      }

      // 排序：优先选择遮挡最少的
      candidates.sort((a, b) => {
        // 先按严重程度排序
        const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
        const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
        if (severityDiff !== 0) return severityDiff;
        // 再按重叠比例排序
        return a.overlapRatio - b.overlapRatio;
      });

      // 返回最佳候选（必须比当前位置好）
      if (candidates.length > 0 && candidates[0].overlapRatio < currentScore.overlapRatio) {
        return {
          current: { ...currentBounds, ...currentScore },
          suggested: candidates[0],
          improvement: currentScore.overlapRatio - candidates[0].overlapRatio
        };
      }

      return null;
    },

    // 评估位置质量
    evaluatePosition(x, y, width, height, excludeElements) {
      const result = this.sampleOccludedElements(x, y, width, height, excludeElements);

      let severity = 'none';
      if (result.elements.length > 0) {
        const hasCritical = result.elements.some(el => el.importance === 'critical');
        const hasHigh = result.elements.some(el => el.importance === 'high');
        severity = hasCritical ? 'critical' : hasHigh ? 'high' : 'medium';
      }

      return {
        overlapRatio: result.ratio,
        elementCount: result.elements.length,
        severity,
        elements: result.elements
      };
    },

    // ==================== 页面绝对定位元素遮挡检测 ====================

    // 检测页面上所有绝对定位元素是否遮挡页面内容
    detectPageFixedElementOcclusions(options = {}) {
      const {
        includeOurComponents = false,  // 是否包含我们自己的组件
        minZIndex = 1000,              // 最小 z-index 阈值
        minArea = 1000,                // 最小面积阈值（过滤小元素）
        checkContentOnly = true        // 仅检测遮挡内容的情况
      } = options;

      const results = {
        timestamp: Date.now(),
        elements: [],
        summary: {
          total: 0,
          occluding: 0,
          critical: 0,
          high: 0
        }
      };

      // 获取我们自己的组件元素
      const ourElements = new Set();
      if (!includeOurComponents) {
        for (const c of this.components) {
          if (c.iconEl) ourElements.add(c.iconEl);
          if (c.panelEl) ourElements.add(c.panelEl);
        }
      }

      // 查找所有 fixed/absolute 定位的元素
      const allElements = document.querySelectorAll('*');

      for (const el of allElements) {
        // 跳过我们自己管理的组件
        if (!includeOurComponents && ourElements.has(el)) continue;

        const style = window.getComputedStyle(el);
        const position = style.position;

        // 只检测 fixed 和 absolute 定位的元素
        if (position !== 'fixed' && position !== 'absolute') continue;

        // 检查 z-index
        const zIndex = parseInt(style.zIndex) || 0;
        if (zIndex < minZIndex && zIndex !== 0) continue;

        // 获取元素尺寸
        const rect = el.getBoundingClientRect();
        if (rect.width * rect.height < minArea) continue;

        // 跳过隐藏元素
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;

        // 检测该元素是否遮挡了页面内容
        const occlusion = this.checkElementOcclusion(el, ourElements);

        results.elements.push({
          element: el,
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          position,
          zIndex,
          rect: {
            width: rect.width,
            height: rect.height,
            left: rect.left,
            top: rect.top
          },
          occlusion
        });

        results.summary.total++;
        if (occlusion.hasOcclusion) {
          results.summary.occluding++;
          if (occlusion.severity === 'critical') results.summary.critical++;
          if (occlusion.severity === 'high') results.summary.high++;
        }
      }

      // 按严重程度排序
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
      results.elements.sort((a, b) => severityOrder[a.occlusion.severity] - severityOrder[b.occlusion.severity]);

      return results;
    },

    // 检测单个元素是否遮挡页面内容
    checkElementOcclusion(el, excludeElements = new Set()) {
      const rect = el.getBoundingClientRect();
      const result = {
        hasOcclusion: false,
        overlapRatio: 0,
        severity: 'none',
        occludedElements: []
      };

      // 添加自身到排除列表
      const exclude = [...excludeElements, el];

      // 采样检测遮挡内容
      const sampleResult = this.sampleOccludedElements(rect.left, rect.top, rect.width, rect.height, exclude);

      result.overlapRatio = sampleResult.ratio;
      result.occludedElements = sampleResult.elements;
      result.hasOcclusion = sampleResult.elements.length > 0;

      // 计算严重程度
      if (result.hasOcclusion) {
        const hasCritical = sampleResult.elements.some(e => e.importance === 'critical');
        const hasHigh = sampleResult.elements.some(e => e.importance === 'high');
        result.severity = hasCritical ? 'critical' : hasHigh ? 'high' : 'medium';
      }

      return result;
    },

    // 检测指定区域是否被其他绝对定位元素遮挡
    checkAreaOccludedByFixedElements(x, y, width, height, excludeElements = []) {
      const rect = { left: x, top: y, right: x + width, bottom: y + height };
      const occludingElements = [];

      // 获取所有 fixed 定位的元素
      const allElements = document.querySelectorAll('*');

      for (const el of allElements) {
        // 跳过排除元素
        if (excludeElements.some(ex => ex && (el === ex || el.contains(ex) || ex.contains(el)))) continue;

        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed' && style.position !== 'absolute') continue;

        // 跳过隐藏元素
        if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) continue;

        const elRect = el.getBoundingClientRect();

        // 检测是否重叠
        if (elRect.left < rect.right && elRect.right > rect.left &&
            elRect.top < rect.bottom && elRect.bottom > rect.top) {

          const zIndex = parseInt(style.zIndex) || 0;
          occludingElements.push({
            element: el,
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            zIndex,
            rect: elRect
          });
        }
      }

      // 按 z-index 排序
      occludingElements.sort((a, b) => b.zIndex - a.zIndex);

      return {
        hasOcclusion: occludingElements.length > 0,
        elements: occludingElements
      };
    },

    // 检测我们组件是否被页面上其他元素遮挡
    checkComponentsOccludedByPage() {
      const results = {
        timestamp: Date.now(),
        components: [],
        summary: { total: 0, occluded: 0 }
      };

      for (const c of this.components) {
        const componentResult = {
          id: c.id,
          icon: null,
          panel: null,
          isOccluded: false
        };

        // 检测 icon 是否被遮挡
        if (c.iconEl && c.iconEl.dataset.ycType) {
          const iconBounds = this.getElementBounds(c.iconEl);
          if (iconBounds) {
            const vw = window.innerWidth;
            const x = vw - iconBounds.right - iconBounds.width;
            const occlusion = this.checkAreaOccludedByFixedElements(
              x, iconBounds.top, iconBounds.width, iconBounds.height,
              [c.iconEl, c.panelEl]
            );
            componentResult.icon = occlusion;
            if (occlusion.hasOcclusion) componentResult.isOccluded = true;
          }
        }

        // 检测 panel 是否被遮挡（仅展开时）
        if (c.panelEl && c.panelEl.dataset.ycType && !this.collapsedStates[c.id]) {
          const panelBounds = this.getElementBounds(c.panelEl);
          if (panelBounds) {
            const vw = window.innerWidth;
            const x = vw - panelBounds.right - panelBounds.width;
            const occlusion = this.checkAreaOccludedByFixedElements(
              x, panelBounds.top, panelBounds.width, panelBounds.height,
              [c.iconEl, c.panelEl]
            );
            componentResult.panel = occlusion;
            if (occlusion.hasOcclusion) componentResult.isOccluded = true;
          }
        }

        results.components.push(componentResult);
        results.summary.total++;
        if (componentResult.isOccluded) results.summary.occluded++;
      }

      return results;
    },

    // 寻找不被其他元素遮挡的位置
    findUnoccludedPosition(componentId, preferredRight, preferredTop) {
      const c = this.components.find(c => c.id === componentId);
      if (!c || !c.panelEl) return null;

      const currentBounds = this.getElementBounds(c.panelEl);
      if (!currentBounds) return null;

      const { width, height } = currentBounds;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const { edgeMargin, iconWidth, panelAvoidGap } = this.config;
      const minRight = edgeMargin + iconWidth + panelAvoidGap;

      const excludeElements = [c.iconEl, c.panelEl].filter(Boolean);

      // 检查首选位置
      const preferredX = vw - preferredRight - width;
      const preferredOcclusion = this.checkAreaOccludedByFixedElements(
        preferredX, preferredTop, width, height, excludeElements
      );

      if (!preferredOcclusion.hasOcclusion) {
        return { right: preferredRight, top: preferredTop, occludedBy: [] };
      }

      // 搜索其他位置
      const candidates = [];
      const step = 100;

      // 向左搜索
      for (let right = preferredRight + step; right <= vw - width - edgeMargin; right += step) {
        const x = vw - right - width;
        const occlusion = this.checkAreaOccludedByFixedElements(x, preferredTop, width, height, excludeElements);
        if (!occlusion.hasOcclusion) {
          candidates.push({ right, top: preferredTop, occludedBy: [] });
        }
      }

      // 向下搜索
      for (let top = preferredTop + step; top <= vh - height - edgeMargin; top += step) {
        const x = vw - preferredRight - width;
        const occlusion = this.checkAreaOccludedByFixedElements(x, top, width, height, excludeElements);
        if (!occlusion.hasOcclusion) {
          candidates.push({ right: preferredRight, top, occludedBy: [] });
        }
      }

      // 返回第一个找到的不被遮挡的位置
      if (candidates.length > 0) {
        return candidates[0];
      }

      return null;
    },

    // 全局遮挡检测报告
    generateOcclusionReport() {
      const report = {
        timestamp: Date.now(),
        ourComponents: this.checkAllOcclusions(),
        ourComponentsOccludedByPage: this.checkComponentsOccludedByPage(),
        pageFixedElements: this.detectPageFixedElementOcclusions()
      };

      console.log('[位置管理器] 遮挡检测报告:', report);
      return report;
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

    // ==================== 页面布局检测 ====================

    // 检测页面主体区域和两侧空白
    // 返回: { mainElement, leftSpace, rightSpace, mainWidth, viewportWidth }
    detectPageLayout() {
      const vw = window.innerWidth;

      // 常见的主内容选择器（按优先级排序）
      const mainSelectors = [
        // 知乎
        '.Question-main',
        '.QuestionAnswers-main',
        '.ContentItem',
        '.List-item',
        // 掘金
        '.main-area',
        '.article-content',
        // 微信公众号
        '#js_content',
        '.rich_media_content',
        // 通用选择器
        'main',
        '[role="main"]',
        '#main',
        '#content',
        '.content',
        '.main-content',
        '.post-content',
        '.article-content',
      ];

      let mainElement = null;
      let maxScore = 0;

      // 遍历选择器，找到最可能的主内容元素
      for (const selector of mainSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const score = this.scoreMainElement(el, vw);
            if (score > maxScore) {
              maxScore = score;
              mainElement = el;
            }
          }
        } catch (e) {
          // 忽略无效选择器
        }
      }

      // 如果通过选择器没找到，尝试通过 DOM 分析找到主体元素
      if (!mainElement || maxScore < 50) {
        mainElement = this.findMainElementByAnalysis(vw);
      }

      if (!mainElement) {
        // 没找到主体元素，使用默认布局
        return {
          mainElement: null,
          leftSpace: 0,
          rightSpace: vw,
          mainWidth: vw,
          viewportWidth: vw
        };
      }

      // 计算主体元素的位置和两侧空白
      const rect = mainElement.getBoundingClientRect();
      const leftSpace = rect.left;  // 左侧空白
      const rightSpace = vw - rect.right;  // 右侧空白

      console.log(`[位置管理器] 页面布局检测:`, {
        element: mainElement.tagName + (mainElement.className ? '.' + mainElement.className.split(' ')[0] : ''),
        leftSpace: Math.round(leftSpace),
        rightSpace: Math.round(rightSpace),
        mainWidth: Math.round(rect.width),
        viewportWidth: vw
      });

      return {
        mainElement,
        leftSpace,
        rightSpace,
        mainWidth: rect.width,
        viewportWidth: vw
      };
    },

    // 检测页面顶部固定定位的 header 高度
    // 返回: header 底部的 Y 坐标（如果没有固定 header，返回 0）
    detectFixedHeaderHeight() {
      const vh = window.innerHeight;
      let maxHeaderBottom = 0;

      // 常见的 header 选择器
      const headerSelectors = [
        'header',
        '.header',
        '#header',
        '.nav',
        '.navbar',
        '.navigation',
        '.top-nav',
        '.topbar',
        '.top-bar',
        '[role="banner"]',
        // 知乎
        '.AppHeader',
        '.Sticky.AppHeader',
        // 掘金
        '.main-header',
        // 通用
        '.fixed-header',
        '.sticky-header',
      ];

      for (const selector of headerSelectors) {
        try {
          const elements = document.querySelectorAll(selector);
          for (const el of elements) {
            const style = window.getComputedStyle(el);
            const position = style.position;
            const rect = el.getBoundingClientRect();

            // 检查是否是固定定位或粘性定位
            // 且元素在视口顶部（top < 100px）
            // 且元素有一定宽度（是横向的 header）
            if ((position === 'fixed' || position === 'sticky') &&
                rect.top < 100 &&
                rect.width > 200) {
              const bottom = rect.bottom;
              if (bottom > maxHeaderBottom) {
                maxHeaderBottom = bottom;
              }
            }
          }
        } catch (e) {
          // 忽略无效选择器
        }
      }

      // 额外检查：遍历顶部区域的所有固定元素
      const topElements = document.elementsFromPoint(100, 20);
      for (const el of topElements) {
        if (el === document.documentElement || el === document.body) continue;

        const style = window.getComputedStyle(el);
        if (style.position === 'fixed' || style.position === 'sticky') {
          const rect = el.getBoundingClientRect();
          if (rect.top < 50 && rect.width > 200) {
            const bottom = rect.bottom;
            if (bottom > maxHeaderBottom) {
              maxHeaderBottom = bottom;
            }
          }
        }
      }

      if (maxHeaderBottom > 0) {
        console.log(`[位置管理器] 检测到固定 header，高度: ${Math.round(maxHeaderBottom)}px`);
      }

      return maxHeaderBottom;
    },

    // 评估元素作为主内容元素的可能性
    scoreMainElement(el, vw) {
      const rect = el.getBoundingClientRect();
      const width = rect.width;

      // 分数因素
      let score = 0;

      // 1. 宽度在合理范围内（主体内容通常占 50%-90% 的视口宽度）
      const widthRatio = width / vw;
      if (widthRatio >= 0.4 && widthRatio <= 0.95) {
        score += 30;
      }

      // 2. 元素在视口内
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        score += 20;
      }

      // 3. 元素有一定高度（主体内容通常较长）
      if (rect.height > 300) {
        score += 20;
      }

      // 4. 元素居中（主体内容通常居中）
      const centerX = rect.left + width / 2;
      const viewportCenterX = vw / 2;
      const centerOffset = Math.abs(centerX - viewportCenterX) / vw;
      if (centerOffset < 0.1) {
        score += 30;
      }

      return score;
    },

    // 通过 DOM 分析找到主体元素
    findMainElementByAnalysis(vw) {
      // 获取 body 下直接子元素中，宽度适中且居中的元素
      const body = document.body;
      const candidates = [];

      // 递归查找可能的主体元素
      const findCandidates = (el, depth) => {
        if (depth > 3) return;  // 限制递归深度

        const children = el.children;
        for (const child of children) {
          const style = window.getComputedStyle(child);
          // 跳过隐藏元素
          if (style.display === 'none' || style.visibility === 'hidden') continue;

          const rect = child.getBoundingClientRect();
          const width = rect.width;

          // 检查是否可能是主体元素
          // 1. 宽度在 40%-95% 视口宽度之间
          // 2. 高度大于 300px
          // 3. 居中或接近居中
          const widthRatio = width / vw;
          if (widthRatio >= 0.4 && widthRatio <= 0.95 && rect.height > 300) {
            const centerX = rect.left + width / 2;
            const viewportCenterX = vw / 2;
            const centerOffset = Math.abs(centerX - viewportCenterX) / vw;

            if (centerOffset < 0.15) {
              candidates.push({
                element: child,
                score: this.scoreMainElement(child, vw),
                depth
              });
            }
          }

          // 继续递归查找
          findCandidates(child, depth + 1);
        }
      };

      findCandidates(body, 0);

      // 选择得分最高的元素
      if (candidates.length > 0) {
        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].element;
      }

      return null;
    },

    // 根据页面布局计算最佳 panel 位置
    calculatePanelPositionFromLayout(layout, panelWidth, panelHeight, iconRight) {
      const { leftSpace, rightSpace, viewportWidth: vw } = layout;
      const { edgeMargin, minPanelWidth, iconWidth, panelAvoidGap } = this.config;

      // 最小 right 值（不能遮挡 icon）
      const minRight = iconRight + iconWidth + panelAvoidGap;

      // 尝试放在右侧空白
      if (rightSpace >= panelWidth + edgeMargin) {
        // 右侧空白足够，放在右侧
        return {
          right: edgeMargin,
          width: panelWidth,
          position: 'right'
        };
      }

      // 右侧空白不够，尝试调整宽度
      if (rightSpace >= minPanelWidth + edgeMargin) {
        // 可以调整宽度放下
        const adjustedWidth = Math.min(panelWidth, rightSpace - edgeMargin - 10);
        return {
          right: edgeMargin,
          width: Math.max(minPanelWidth, adjustedWidth),
          position: 'right-adjusted'
        };
      }

      // 尝试放在左侧空白
      if (leftSpace >= panelWidth + edgeMargin) {
        // 左侧空白足够
        const right = vw - leftSpace + edgeMargin;
        if (right >= minRight) {
          return {
            right,
            width: panelWidth,
            position: 'left'
          };
        }
      }

      // 左侧空白不够，尝试调整宽度
      if (leftSpace >= minPanelWidth + edgeMargin) {
        const adjustedWidth = Math.min(panelWidth, leftSpace - edgeMargin - 10);
        const right = vw - leftSpace + edgeMargin;
        if (right >= minRight) {
          return {
            right,
            width: Math.max(minPanelWidth, adjustedWidth),
            position: 'left-adjusted'
          };
        }
      }

      // 两侧都不够，使用默认位置（紧贴 icon 左侧）
      return {
        right: minRight,
        width: Math.min(panelWidth, vw - minRight - edgeMargin),
        position: 'default'
      };
    },

    // ==================== 辅助方法 ====================

    // 记录元素的位置和尺寸信息到 data 属性，用于碰撞检测
    recordElementBounds(el, type, id, bounds) {
      if (!el) return;
      el.dataset.ycType = type;          // 'icon' | 'panel'
      el.dataset.ycId = id;               // 组件 ID
      el.dataset.ycRight = bounds.right;  // right 位置
      el.dataset.ycTop = bounds.top;      // top 位置
      el.dataset.ycWidth = bounds.width;  // 宽度
      el.dataset.ycHeight = bounds.height; // 高度
      el.dataset.ycUpdated = Date.now();  // 更新时间戳
    },

    // 清除元素的位置信息
    clearElementBounds(el) {
      if (!el) return;
      delete el.dataset.ycType;
      delete el.dataset.ycId;
      delete el.dataset.ycRight;
      delete el.dataset.ycTop;
      delete el.dataset.ycWidth;
      delete el.dataset.ycHeight;
      delete el.dataset.ycUpdated;
    },

    // 从元素获取位置信息（供碰撞检测使用）
    getElementBounds(el) {
      if (!el || !el.dataset.ycType) return null;
      return {
        type: el.dataset.ycType,
        id: el.dataset.ycId,
        right: parseFloat(el.dataset.ycRight) || 0,
        top: parseFloat(el.dataset.ycTop) || 0,
        width: parseFloat(el.dataset.ycWidth) || 0,
        height: parseFloat(el.dataset.ycHeight) || 0,
        updated: parseInt(el.dataset.ycUpdated) || 0
      };
    },

    // 检测两个元素是否碰撞
    checkElementsCollision(el1, el2) {
      const bounds1 = this.getElementBounds(el1);
      const bounds2 = this.getElementBounds(el2);
      if (!bounds1 || !bounds2) return { hasCollision: false };

      return this.checkRectOverlap(
        { right: bounds1.right, top: bounds1.top, width: bounds1.width, height: bounds1.height },
        { right: bounds2.right, top: bounds2.top, width: bounds2.width, height: bounds2.height }
      );
    },

    // 获取所有组件的碰撞信息
    getAllCollisions() {
      const collisions = [];
      const elements = [];

      // 收集所有有位置信息的元素
      for (const c of this.components) {
        if (c.iconEl && c.iconEl.dataset.ycType) {
          elements.push({ el: c.iconEl, component: c });
        }
        if (c.panelEl && c.panelEl.dataset.ycType) {
          elements.push({ el: c.panelEl, component: c });
        }
      }

      // 检测每对元素之间的碰撞
      for (let i = 0; i < elements.length; i++) {
        for (let j = i + 1; j < elements.length; j++) {
          const collision = this.checkElementsCollision(elements[i].el, elements[j].el);
          if (collision.hasCollision) {
            collisions.push({
              element1: {
                id: elements[i].component.id,
                type: elements[i].el.dataset.ycType
              },
              element2: {
                id: elements[j].component.id,
                type: elements[j].el.dataset.ycType
              },
              overlap: collision
            });
          }
        }
      }

      return collisions;
    },

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

        const right = parseInt(panelEl.style.right) || 70;
        const top = parseInt(panelEl.style.top) || 20;
        const width = panelEl.offsetWidth;
        const height = panelEl.offsetHeight;

        // 保存用户拖拽后的位置
        this.userPanelPositions[id] = { right, top };

        // 更新元素上的位置信息
        this.recordElementBounds(panelEl, 'panel', id, { right, top, width, height });

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
        // 检查 localStorage 是否可用（沙盒 iframe 中不可用）
        if (typeof localStorage === 'undefined' || localStorage === null) {
          console.warn('[位置管理器] localStorage 不可用，跳过保存');
          return;
        }
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
          customPositions: this.customPositions,
          collapsedStates: this.collapsedStates,
          userPanelPositions: this.userPanelPositions
        }));
      } catch (e) {
        // SecurityError: 沙盒环境或跨域限制
        if (e.name === 'SecurityError' || e.code === 18) {
          console.warn('[位置管理器] 沙盒环境，无法使用 localStorage');
        } else {
          console.warn('[位置管理器] 保存失败:', e.message || e);
        }
      }
    },

    loadFromStorage() {
      try {
        // 检查 localStorage 是否可用
        if (typeof localStorage === 'undefined' || localStorage === null) {
          console.warn('[位置管理器] localStorage 不可用，使用默认值');
          return;
        }
        const saved = localStorage.getItem(this.STORAGE_KEY);
        if (saved) {
          const data = JSON.parse(saved);
          this.customPositions = data.customPositions || {};
          this.collapsedStates = data.collapsedStates || {};
          this.userPanelPositions = data.userPanelPositions || {};
        }
      } catch (e) {
        // SecurityError: 沙盒环境或跨域限制
        if (e.name === 'SecurityError' || e.code === 18) {
          console.warn('[位置管理器] 沙盒环境，无法使用 localStorage');
        } else {
          console.warn('[位置管理器] 加载失败:', e.message || e);
        }
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
        version: 'v32',
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
  } // end of else (script enabled)
}
