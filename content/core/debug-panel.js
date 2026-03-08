// ========== 调试工具面板 ==========
// 开发调试工具，方便调试和诊断

(function () {
  'use strict';

  if (window.DebugPanel) {
    console.log('[DebugPanel] 已存在，事件跳过初始化');
    return;
  }

  /**
   * DebugPanel - 调试工具面板
   * 功能：
   * 1. 查看系统状态
   * 2. 执行诊断
   * 3. 性能分析
   * 4. 错误追踪
   */
  const DebugPanel = {
    // 调试模式
    enabled: false,
    // 日志
    logs: [],
    maxLogs: 200,
    // 计时器
    timers: {},
    // 标记
    markers: {},

    /**
     * 启用调试
     */
    enable() {
      this.enabled = true;
      console.log('[DebugPanel] 调试模式已启用');
      this.log('调试模式已启用', 'info');
    },

    /**
     * 灯用调试
     */
    disable() {
      this.enabled = false;
      console.log('[DebugPanel] 调试模式已禁用');
    },

    /**
     * 记录日志
     * @param {string} message - 消息
     * @param {string} level - 级别 (info, warn, error, debug)
     * @param {object} data - 附加数据
     */
    log(message, level = 'info', data = null) {
      if (!this.enabled && level !== 'error') return;

      const entry = {
        timestamp: Date.now(),
        level,
        message,
        data
      };

      this.logs.push(entry);

      // 限制日志数量
      while (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }

      // 控制台输出
      const prefix = `[DebugPanel] [${level}]`;
      switch (level) {
        case 'error':
          console.error(prefix, message, data || '');
          break;
        case 'warn':
          console.warn(prefix, message, data || '');
          break;
        case 'debug':
          console.debug(prefix, message, data || '');
          break;
        default:
          console.log(prefix, message, data || '');
      }
    },

    /**
     * 开始计时
     * @param {string} label - 标签
     */
    time(label) {
      this.timers[label] = performance.now();
      this.log(`计时开始: ${label}`, 'debug');
    },

    /**
     * 结束计时
     * @param {string} label - 标签
     * @returns {number} 耗时(ms)
     */
    timeEnd(label) {
      if (!this.timers[label]) {
        this.log(`计时器不存在: ${label}`, 'warn');
        return 0;
      }

      const elapsed = performance.now() - this.timers[label];
      delete this.timers[label];
      this.log(`计时结束: ${label} - ${elapsed.toFixed(2)}ms`, 'debug');
      return elapsed;
    },

    /**
     * 添加标记
     * @param {string} name - 标记名称
     * @param {any} value - 标记值
     */
    mark(name, value) {
      this.markers[name] = { value, timestamp: Date.now() };
      this.log(`标记: ${name} = ${JSON.stringify(value)}`, 'debug');
    },

    /**
     * 获取标记
     * @param {string} name - 标记名称
     */
    getMark(name) {
      return this.markers[name]?.value;
    },

    /**
     * 执行诊断
     */
    runDiagnostics() {
      const results = {
        timestamp: Date.now(),
        system: {},
        performance: {},
        errors: []
      };

      // 系统状态
      results.system = {
        isInitialized: this._checkGlobal('AppStore')?.initialized || false,
        eventBusReady: this._checkGlobal('EventBus')?.getState?.()?.isReady || false,
        siteFactoryReady: this._checkGlobal('SiteFactory')?.listSites?.().length > 0 || false,
        pluginSystemReady: this._checkGlobal('PluginSystem')?.listPlugins?.().length > 0 || false,
        configManagerReady: this._checkGlobal('ConfigManager')?.initialized || false,
        storageBridgeReady: this._checkGlobal('StorageBridge')?.isReady?.() || false
      };

      // 性能指标
      results.performance = {
        memoryUsage: this._getMemoryUsage(),
        logCount: this.logs.length,
        activeTimers: Object.keys(this.timers).length,
        markerCount: Object.keys(this.markers).length
      };

      // 错误统计
      results.errors = this.logs.filter(l => l.level === 'error').map(l => ({
        timestamp: l.timestamp,
        message: l.message,
        data: l.data
      }));

      return results;
    },

    /**
     * 检查全局对象
     */
    _checkGlobal(name) {
      return typeof window[name] !== 'undefined' ? window[name] : null;
    },

    /**
     * 获取内存使用情况（估算）
     */
    _getMemoryUsage() {
      const used = process.memoryUsage?.().heapUsed || 0;
      return {
        usedMB: Math.round(used / 1024 / 1024),
        available: true
      };
    },

    /**
     * 导出调试报告
     */
    exportReport() {
      const report = {
        timestamp: Date.now(),
        diagnostics: this.runDiagnostics(),
        logs: this.logs.slice(-50),
        markers: { ...this.markers }
      };

      console.log('=== 调试报告 ===');
      console.log(JSON.stringify(report, null, 2));
      console.log('=================');

      return report;
    },

    /**
     * 清除日志
     */
    clearLogs() {
      this.logs = [];
      this.log('日志已清除', 'info');
    },

    /**
     * 获取日志
     */
    getLogs(count = 20) {
      return this.logs.slice(-count);
    },

    /**
     * 打印系统状态
     */
    printStatus() {
      const diag = this.runDiagnostics();

      console.log('\n=== 系统状态 ===');
      console.log('初始化状态:');
      for (const [key, value] of Object.entries(diag.system)) {
        console.log(`  ${key}: ${value ? '✓' : '✗'}`);
      }

      console.log('\n性能指标:');
      for (const [key, value] of Object.entries(diag.performance)) {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      }

      if (diag.errors.length > 0) {
        console.log(`\n最近 ${diag.errors.length} 个错误:`);
        diag.errors.forEach(e => console.log(`  - ${e.message}`));
      }

      console.log('==============\n');
    }
  };

  // 导出
  window.DebugPanel = DebugPanel;

  // 自动初始化（开发模式下）
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    const manifest = chrome.runtime.getManifest();
    if (manifest?.name?.includes('dev') || localStorage.getItem('debugMode')) {
      DebugPanel.enable();
    }
  }

  console.log('[DebugPanel] 调试工具面板已加载');
})();
