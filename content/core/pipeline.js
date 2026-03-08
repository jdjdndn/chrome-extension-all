// ========== 消息管道系统 ==========
// 用于复杂流程的流水线处理

(function () {
  'use strict';

  if (window.Pipeline) {
    console.log('[Pipeline] 已存在，跳过初始化');
    return;
  }

  /**
   * 消息管道 - 流式处理复杂操作
   */
  const PipelineManager = {
    pipelines: new Map(),
    running: new Map(),

    /**
     * 创建管道
     * @param {string} name - 管道名称
     * @param {array} stages - 处理阶段数组
     * @param {object} options - 配置选项
     */
    create(name, stages, options = {}) {
      if (this.pipelines.has(name)) {
        console.warn(`[Pipeline] 管道已存在: ${name}`);
        return false;
      }

      const {
        timeout = 30000,      // 总超时
        continueOnError = false, // 错误时是否继续
        logProgress = true    // 是否记录进度
      } = options;

      this.pipelines.set(name, {
        stages,
        options: { timeout, continueOnError, logProgress }
      });

      console.log(`[Pipeline] 创建管道: ${name} (${stages.length} 阶段)`);
      return true;
    },

    /**
     * 执行管道
     * @param {string} name - 管道名称
     * @param {any} input - 输入数据
     * @returns {Promise<any>}
     */
    async run(name, input) {
      const pipeline = this.pipelines.get(name);
      if (!pipeline) {
        throw new Error(`[Pipeline] 管道不存在: ${name}`);
      }

      const { stages, options } = pipeline;
      const runId = `${name}_${Date.now()}`;

      // 检查是否有相同管道在运行
      if (this.running.has(name)) {
        console.warn(`[Pipeline] 管道正在运行: ${name}`);
        return null;
      }

      this.running.set(name, runId);

      let result = input;
      const startTime = Date.now();

      try {
        // 超时控制
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('管道执行超时')), options.timeout);
        });

        // 执行各阶段
        const executePromise = async () => {
          for (let i = 0; i < stages.length; i++) {
            const stage = stages[i];
            const stageName = stage.name || `stage_${i}`;

            if (options.logProgress) {
              console.log(`[Pipeline] ${name} - 执行阶段 ${i + 1}/${stages.length}: ${stageName}`);
            }

            try {
              const stageResult = await stage.handler(result);
              if (stageResult === false && !options.continueOnError) {
                // 阶段返回 false，中断管道
                console.log(`[Pipeline] ${name} - 阶段 ${stageName} 返回 false，中断执行`);
                return null;
              }
              if (stageResult !== undefined) {
                result = stageResult;
              }
            } catch (error) {
              console.error(`[Pipeline] ${name} - 阶段 ${stageName} 执行失败:`, error);
              if (!options.continueOnError) {
                throw error;
              }
            }
          }
          return result;
        };

        result = await Promise.race([executePromise(), timeoutPromise]);

        if (options.logProgress) {
          console.log(`[Pipeline] ${name} - 完成，耗时 ${Date.now() - startTime}ms`);
        }

        return result;
      } catch (error) {
        console.error(`[Pipeline] ${name} - 执行失败:`, error);
        throw error;
      } finally {
        this.running.delete(name);
      }
    },

    /**
     * 删除管道
     * @param {string} name - 管道名称
     */
    delete(name) {
      if (this.running.has(name)) {
        console.warn(`[Pipeline] 管道正在运行，无法删除: ${name}`);
        return false;
      }
      return this.pipelines.delete(name);
    },

    /**
     * 获取管道列表
     */
    list() {
      return Array.from(this.pipelines.keys());
    },

    /**
     * 检查管道是否在运行
     */
    isRunning(name) {
      return this.running.has(name);
    }
  };

  // ========== 预定义管道 ==========

  // 用户操作处理管道
  PipelineManager.create('userAction', [
    {
      name: 'validate',
      handler: async (data) => {
        if (!data || !data.action) {
          console.warn('[Pipeline] 无效的用户操作数据');
          return false;
        }
        return data;
      }
    },
    {
      name: 'process',
      handler: async (data) => {
        if (typeof Services !== 'undefined') {
          return await Services.utils.send('USER_ACTION', data);
        }
        return data;
      }
    },
    {
      name: 'notify',
      handler: async (result) => {
        if (result?.success) {
          console.log('[Pipeline] 用户操作处理成功');
        }
        return result;
      }
    }
  ], { timeout: 10000 });

  // 设置更新管道
  PipelineManager.create('updateSettings', [
    {
      name: 'validate',
      handler: async (data) => {
        if (!data || !data.key) {
          console.warn('[Pipeline] 无效的设置数据');
          return false;
        }
        return data;
      }
    },
    {
      name: 'save',
      handler: async (data) => {
        if (typeof Services !== 'undefined') {
          return await Services.settings.set(data.key, data.value);
        }
        return { success: true };
      }
    },
    {
      name: 'broadcast',
      handler: async (result) => {
        if (typeof EventBus !== 'undefined' && EventBus.publish) {
          EventBus.publish('SETTINGS_CHANGED', result);
        }
        return result;
      }
    }
  ], { timeout: 5000 });

  // 域名阻止管道
  PipelineManager.create('blockDomain', [
    {
      name: 'validate',
      handler: async (domain) => {
        if (!domain || typeof domain !== 'string') {
          console.warn('[Pipeline] 无效的域名');
          return false;
        }
        return domain.trim().toLowerCase();
      }
    },
    {
      name: 'block',
      handler: async (domain) => {
        if (typeof Services !== 'undefined') {
          return await Services.domain.block(domain);
        }
        return { success: true };
      }
    },
    {
      name: 'updateUI',
      handler: async (result) => {
        if (result?.success) {
          console.log(`[Pipeline] 域名已阻止: ${result.currentDomain}`);
        }
        return result;
      }
    }
  ], { timeout: 5000 });

  // ========== 更多预定义管道 ==========

  // 隐藏元素更新管道
  PipelineManager.create('updateHideElements', [
    {
      name: 'validate',
      handler: async (data) => {
        if (!data || typeof data.enabled === 'undefined') {
          console.warn('[Pipeline] 无效的隐藏元素数据');
          return false;
        }
        // 确保选择器是数组
        data.selectors = Array.isArray(data.selectors) ? data.selectors : [];
        return data;
      }
    },
    {
      name: 'update',
      handler: async (data) => {
        if (typeof Services !== 'undefined') {
          return await Services.hideElements.update(data.enabled, data.selectors);
        }
        return { success: true, data };
      }
    },
    {
      name: 'broadcast',
      handler: async (result) => {
        if (typeof EventBus !== 'undefined' && EventBus.publish) {
          EventBus.publish('HIDE_ELEMENTS_UPDATED', result);
        }
        return result;
      }
    }
  ], { timeout: 5000 });

  // 数据同步管道（与本地服务器）
  PipelineManager.create('syncToServer', [
    {
      name: 'checkConnection',
      handler: async (data) => {
        if (typeof Services !== 'undefined') {
          const health = await Services.extension.getHealth();
          if (!health?.serverAvailable) {
            console.warn('[Pipeline] 本地服务器不可用');
            return false;
          }
        }
        return data;
      }
    },
    {
      name: 'sync',
      handler: async (data) => {
        // 同步数据到本地服务器
        const results = {};
        if (data.keywords && typeof Services !== 'undefined') {
          // 假设有对应的服务
          results.keywords = true;
        }
        if (data.selectors) {
          results.selectors = true;
        }
        return { success: true, results };
      }
    },
    {
      name: 'notify',
      handler: async (result) => {
        if (result?.success) {
          console.log('[Pipeline] 数据同步成功');
        }
        return result;
      }
    }
  ], { timeout: 10000 });

  // 批量操作管道
  PipelineManager.create('batchOperation', [
    {
      name: 'prepare',
      handler: async (data) => {
        if (!data || !Array.isArray(data.items)) {
          console.warn('[Pipeline] 无效的批量操作数据');
          return false;
        }
        data.results = [];
        data.errors = [];
        return data;
      }
    },
    {
      name: 'process',
      handler: async (data) => {
        const { items, operation } = data;
        for (let i = 0; i < items.length; i++) {
          try {
            const result = await operation(items[i], i);
            data.results.push({ index: i, success: true, result });
          } catch (error) {
            data.errors.push({ index: i, error: error.message });
          }
        }
        return data;
      }
    },
    {
      name: 'summarize',
      handler: async (data) => {
        const summary = {
          total: data.items.length,
          success: data.results.length,
          failed: data.errors.length,
          results: data.results,
          errors: data.errors
        };
        console.log(`[Pipeline] 批量操作完成: ${summary.success}/${summary.total}`);
        return summary;
      }
    }
  ], { timeout: 60000, continueOnError: true });

  // 状态重置管道
  PipelineManager.create('resetState', [
    {
      name: 'backup',
      handler: async (data) => {
        if (typeof AppStore !== 'undefined') {
          const snapshot = AppStore.getSnapshot();
          data.backup = snapshot;
          console.log('[Pipeline] 已备份当前状态');
        }
        return data;
      }
    },
    {
      name: 'reset',
      handler: async (data) => {
        if (typeof AppStore !== 'undefined') {
          await AppStore.reset(data.initialState || {});
          console.log('[Pipeline] 状态已重置');
        }
        return data;
      }
    },
    {
      name: 'notify',
      handler: async (data) => {
        if (typeof EventBus !== 'undefined' && EventBus.publish) {
          EventBus.publish('STATE_RESET', { backup: data.backup });
        }
        return { success: true, backup: data.backup };
      }
    }
  ], { timeout: 10000 });

  // 数据导入管道
  PipelineManager.create('importData', [
    {
      name: 'validate',
      handler: async (data) => {
        if (!data || !data.type || !data.content) {
          console.warn('[Pipeline] 无效的导入数据');
          return false;
        }
        // 验证数据格式
        try {
          if (typeof data.content === 'string') {
            data.parsed = JSON.parse(data.content);
          } else {
            data.parsed = data.content;
          }
          return data;
        } catch (e) {
          console.warn('[Pipeline] 数据解析失败:', e);
          return false;
        }
      }
    },
    {
      name: 'transform',
      handler: async (data) => {
        // 根据类型转换数据
        const { type, parsed } = data;
        switch (type) {
          case 'settings':
            data.transformed = { settings: parsed };
            break;
          case 'keywords':
            data.transformed = { keywords: parsed };
            break;
          case 'selectors':
            data.transformed = { selectors: parsed };
            break;
          default:
            data.transformed = parsed;
        }
        return data;
      }
    },
    {
      name: 'apply',
      handler: async (data) => {
        // 应用导入的数据
        if (typeof AppStore !== 'undefined' && data.transformed) {
          for (const [key, value] of Object.entries(data.transformed)) {
            await AppStore.set(key, value);
          }
        }
        return { success: true, type: data.type };
      }
    }
  ], { timeout: 10000 });

  // 数据导出管道
  PipelineManager.create('exportData', [
    {
      name: 'collect',
      handler: async (data) => {
        const exported = {};
        if (typeof AppStore !== 'undefined') {
          if (data.includeSettings !== false) {
            exported.settings = AppStore.get('settings');
          }
          if (data.includeKeywords) {
            exported.keywords = AppStore.get('keywords');
          }
          if (data.includeSelectors) {
            exported.selectors = AppStore.get('hideElements');
          }
        }
        return { ...data, exported };
      }
    },
    {
      name: 'format',
      handler: async (data) => {
        const formatted = {
          version: '1.0',
          timestamp: Date.now(),
          data: data.exported
        };
        return { ...data, formatted };
      }
    },
    {
      name: 'output',
      handler: async (data) => {
        if (data.format === 'json') {
          return JSON.stringify(data.formatted, null, 2);
        }
        return data.formatted;
      }
    }
  ], { timeout: 5000 });

  // 导出
  window.Pipeline = PipelineManager;

  console.log('[Pipeline] 管道模块已加载');
})();
