// ========== 操作历史记录 ==========
// 讒持用户操作历史，支持撤销和重做

(function () {
  'use strict'

  if (window.HistoryManager) {
    console.log('[HistoryManager] 已存在，跳过初始化')
    return
  }

  /**
   * HistoryManager - 操作历史管理器
   * 功能：
   * 1. 记录用户操作历史
   * 2. 支持撤销操作
   * 3. 操作重做
   */
  const HistoryManager = {
    // 历史记录
    history: [],

    // 最大记录数
    maxSize: 50,

    // 当前状态快照
    snapshots: [],

    // 配置
    config: {
      enabled: true,
      autoSave: true,
      storageKey: 'operationHistory',
    },

    /**
     * 初始化
     */
    async init(options = {}) {
      this.config = { ...this.config, ...options }

      if (this.config.autoSave) {
        await this._loadFromStorage()
      }

      console.log('[HistoryManager] 初始化完成')
    },

    /**
     * 从存储加载
     */
    async _loadFromStorage() {
      try {
        if (typeof StorageUtils !== 'undefined') {
          const result = await StorageUtils.getLocal(this.config.storageKey)
          if (result?.[this.config.storageKey]) {
            this.history = result[this.config.storageKey]
          }
        }
      } catch (error) {
        console.error('[HistoryManager] 加载失败:', error)
      }
    },

    /**
     * 保存到存储
     */
    async _saveToStorage() {
      try {
        if (typeof StorageUtils !== 'undefined') {
          await StorageUtils.setLocal({ [this.config.storageKey]: this.history })
        }
      } catch (error) {
        console.error('[HistoryManager] 保存失败:', error)
      }
    },

    /**
     * 记录操作
     * @param {string} action - 操作类型
     * @param {object} data - 操作数据
     * @param {object} options - 选项
     */
    async record(action, data, options = {}) {
      if (!this.config.enabled) {return}

      const record = {
        id: `hist_${Date.now()}_${Math.random().toString(36)}`,
        action,
        data: this._cloneData(data),
        timestamp: Date.now(),
        reversed: options.reversible !== false,
      }

      this.history.push(record)

      // 超出限制时移除最旧的
      while (this.history.length > this.maxSize) {
        this.history.shift()
      }

      // 保存快照（用于撤销）
      if (options.saveSnapshot !== false) {
        this._saveSnapshot(record.id, data)
      }

      // 自动保存
      if (this.config.autoSave) {
        await this._saveToStorage()
      }

      console.log(`[HistoryManager] 记录操作: ${action}`)
      return record
    },

    /**
     * 深度克隆数据
     */
    _cloneData(data) {
      try {
        return JSON.parse(JSON.stringify(data))
      } catch {
        return data
      }
    },

    /**
     * 保存快照
     */
    _saveSnapshot(recordId, data) {
      this.snapshots.push({
        recordId,
        snapshot: this._cloneData(data),
        timestamp: Date.now(),
      })

      // 限制快照数量
      while (this.snapshots.length > this.maxSize) {
        this.snapshots.shift()
      }
    },

    /**
     * 撤销操作
     * @param {string} recordId - 记录ID
     */
    async undo(recordId) {
      const record = this.history.find((r) => r.id === recordId)
      const snapshot = this.snapshots.find((s) => s.recordId === recordId)

      if (!record || !record.reversible) {
        console.warn('[HistoryManager] 无法撤销:', recordId)
        return { success: false, reason: '记录不存在或不可撤销' }
      }

      try {
        // 恢复快照
        if (snapshot && typeof Services !== 'undefined') {
          // 根据操作类型恢复
          switch (record.action) {
            case 'SET_SETTINGS':
              await Services.settings.set(
                Object.keys(snapshot.snapshot)[0],
                Object.values(snapshot.snapshot)[0]
              )
              break
            case 'UPDATE_HIDE_ELEMENTS':
              await Services.hideElements.update(
                snapshot.snapshot.enabled,
                snapshot.snapshot.selectors
              )
              break
            case 'ADD_KEYWORD':
              // 移除关键词
              break
            case 'BLOCK_DOMAIN':
              await Services.domain.unblock(snapshot.snapshot)
              break
            default:
              console.warn(`[HistoryManager] 未知操作类型: ${record.action}`)
          }
        }

        // 标记为已撤销
        record.undone = true
        record.undoneAt = Date.now()

        if (this.config.autoSave) {
          await this._saveToStorage()
        }

        console.log(`[HistoryManager] 撤销成功: ${record.action}`)
        return { success: true }
      } catch (error) {
        console.error('[HistoryManager] 撤销失败:', error)
        return { success: false, error: error.message }
      }
    },

    /**
     * 重做操作
     * @param {string} recordId - 记录ID
     */
    async redo(recordId) {
      const record = this.history.find((r) => r.id === recordId)

      if (!record || !record.undone) {
        console.warn('[HistoryManager] 无法重做:', recordId)
        return { success: false, reason: '记录不存在或未撤销' }
      }

      try {
        // 重新执行操作
        await this._executeAction(record.action, record.data)

        // 标记为已恢复
        record.undone = false
        delete record.undoneAt

        if (this.config.autoSave) {
          await this._saveToStorage()
        }

        console.log(`[HistoryManager] 重做成功: ${record.action}`)
        return { success: true }
      } catch (error) {
        console.error('[HistoryManager] 重做失败:', error)
        return { success: false, error: error.message }
      }
    },

    /**
     * 执行操作
     */
    async _executeAction(action, data) {
      if (typeof Services !== 'undefined') {
        switch (action) {
          case 'SET_SETTINGS':
            await Services.settings.set(data.key, data.value)
            break
          case 'UPDATE_HIDE_ELEMENTS':
            await Services.hideElements.update(data.enabled, data.selectors)
            break
          case 'BLOCK_DOMAIN':
            await Services.domain.block(data.domain)
            break
          default:
            console.warn(`[HistoryManager] 未知操作类型: ${action}`)
        }
      }
    },

    /**
     * 获取历史记录
     * @param {number} limit - 限制数量
     */
    getHistory(limit = 20) {
      return this.history.slice(-limit)
    },

    /**
     * 获取可撤销的操作
     */
    getUndoable() {
      return this.history.filter((r) => r.reversible && !r.undone)
    },

    /**
     * 获取可重做的操作
     */
    getRedoable() {
      return this.history.filter((r) => r.undone)
    },

    /**
     * 清除历史
     */
    async clear() {
      this.history = []
      this.snapshots = []

      if (this.config.autoSave) {
        await this._saveToStorage()
      }

      console.log('[HistoryManager] 历史已清除')
    },

    /**
     * 获取统计信息
     */
    getStats() {
      return {
        totalRecords: this.history.length,
        undoableCount: this.getUndoable().length,
        redoableCount: this.getRedoable().length,
        snapshotCount: this.snapshots.length,
      }
    },
  }

  // 导出
  window.HistoryManager = HistoryManager

  console.log('[HistoryManager] 操作历史管理器已加载')
})()
