// ========== 批量操作处理器 ==========
// 支持批量执行操作，并发控制、进度追踪、错误处理

(function () {
  'use strict';

  if (window.BatchOps) {
    console.log('[BatchOps] 已存在，跳过初始化');
    return;
  }

  /**
   * BatchOps - 批量操作处理器
   * 功能：
   * 1. 批量执行操作
   * 2. 并发控制
   * 3. 进度追踪
   * 4. 错误处理
   */
  const BatchOps = {
    // 待执行的操作
    pending: new Map(),
    // 正在执行的操作
    running: new Map(),
    // 已完成的操作
    completed: new Map(),
    // 最大并发数
    maxConcurrency: 5,
    // 配置
    config: {
      timeout: 10000,
      retryCount: 2,
      retryDelay: 100
    },

    /**
     * 添加操作
     * @param {string} name - 操作名称
     * @param {function} executor - 执行函数
     * @param {object} options - 选项
     * @returns {string} 操作ID
     */
    add(name, executor, options = {}) {
      const id = `op_${Date.now()}_${Math.random().toString(36)}`;
      const operation = {
        id,
        name,
        executor,
        status: 'pending',
        options: {
          timeout: this.config.timeout,
          retryCount: this.config.retryCount,
          ...options
        }
      };

      this.pending.set(id, operation);
      console.log(`[BatchOps] 添加操作: ${name}`);
      return id;
    },

    /**
     * 执行操作
     * @param {string} id - 操作ID
     */
    async execute(id) {
    const operation = this.pending.get(id) || this.completed.get(id);
    if (!operation) {
      console.warn(`[BatchOps] 操作不存在: ${id}`);
      return { success: false, error: '操作不存在' };
    }

    if (operation.status === 'completed') {
      return { success: true, result: operation.result };
    }

    // 移到运行队列
    operation.status = 'running';
    this.pending.delete(id);
    this.running.set(id, operation);

    try {
      const result = await this._executeWithRetry(operation);
      operation.status = 'completed';
      operation.result = result;
      this.running.delete(id);
      this.completed.set(id, operation);
      console.log(`[BatchOps] 操作完成: ${operation.name}`);
      return { success: true, result };
    } catch (error) {
      operation.status = 'failed';
      operation.error = error.message;
      this.running.delete(id);
      console.error(`[BatchOps] 操作失败: ${operation.name}`, error);
      return { success: false, error: error.message };
    }
  },

    /**
     * 带重试的执行
     */
    async _executeWithRetry(operation) {
    const maxRetries = operation.options.retryCount;
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await Promise.race([
          operation.executor(),
          this._createTimeout(operation.options.timeout)
        ]);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries) {
          await this._delay(this.config.retryDelay * attempt);
          console.log(`[BatchOps] 重试 ${operation.name} (${attempt}/${maxRetries})`);
        }
      }
    }

    throw lastError || new Error('操作执行失败');
  },

    /**
     * 创建超时 Promise
     */
    _createTimeout(ms) {
      return new Promise((_, reject) => {
        setTimeout(() => reject(new Error('操作超时')), ms);
      });
    },

    /**
     * 延迟
     */
    _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
    },

    /**
     * 批量执行多个操作
     * @param {array} operations - 操作配置数组
     * @param {object} options - 选项
     */
    async executeAll(operations, options = {}) {
      const { concurrency = this.maxConcurrency, onProgress, onAllComplete } = options;
      const results = [];
      const errors = [];
      const startTime = Date.now();

      // 添加所有操作
      const ids = operations.map(op => this.add(op.name, op.executor, op.options));

      // 按并发数分组执行
      const chunks = [];
      for (let i = 0; i < ids.length; i += concurrency) {
        chunks.push(ids.slice(i, i + concurrency));
      }

      // 执行每个块
      for (const chunk of chunks) {
        const chunkResults = await Promise.all(
          chunk.map(id => this.execute(id))
        );
        results.push(...chunkResults);

        // 更新进度
        if (onProgress) {
          onProgress({
            completed: results.length,
            total: ids.length,
            percentage: Math.round((results.length / ids.length) * 100)
          });
        }
      }

      // 汇总结果
      const summary = {
        total: ids.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        duration: Date.now() - startTime,
        results
      };

      if (onAllComplete) {
        onAllComplete(summary);
      }

      return summary;
    },

    /**
     * 获取操作状态
     */
    getStatus(id) {
      const op = this.pending.get(id) || this.running.get(id) || this.completed.get(id);
      return op ? { id: op.id, name: op.name, status: op.status } : null;
    },

    /**
     * 取消操作
     */
    cancel(id) {
      const operation = this.pending.get(id);
      if (operation) {
        this.pending.delete(id);
        console.log(`[BatchOps] 取消操作: ${operation.name}`);
        return true;
      }
      return false;
    },

    /**
     * 清除所有已完成的操作
     */
    clearCompleted() {
      this.completed.clear();
      console.log('[BatchOps] 已清除已完成的操作');
    },

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        pending: this.pending.size,
        running: this.running.size,
        completed: this.completed.size
      };
    }
  };

  // 导出
  window.BatchOps = BatchOps;

  console.log('[BatchOps] 批量操作处理器已加载');
})();
