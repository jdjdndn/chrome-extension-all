// ========== 持久化 Mixin ==========
// 为 Manager 提供统一的存储加载/保存方法

(function () {
  'use strict'

  if (window.PersistableMixin) {
    console.log('[PersistableMixin] 已存在，跳过初始化')
    return
  }

  /**
   * 创建持久化方法
   * @param {string} storageKey - 存储键名
   * @param {string} storageArea - 存储区域 ('local' 或 'sync')
   * @returns {object} { _loadFromStorage, _saveToStorage }
   */
  function createPersistable(storageKey) {
    return {
      /**
       * 从存储加载数据
       * @returns {any|null} 加载的数据，失败返回 null
       */
      async _loadFromStorage() {
        try {
          if (typeof StorageUtils !== 'undefined') {
            const result = await StorageUtils.getLocal(storageKey)
            if (result?.[storageKey]) {
              return result[storageKey]
            }
          }
        } catch (error) {
          console.error(`[Persistable] 加载失败 (${storageKey}):`, error)
        }
        return null
      },

      /**
       * 保存数据到存储
       * @param {any} data - 要保存的数据
       */
      async _saveToStorage(data) {
        try {
          if (typeof StorageUtils !== 'undefined') {
            await StorageUtils.setLocal({ [storageKey]: data })
          }
        } catch (error) {
          console.error(`[Persistable] 保存失败 (${storageKey}):`, error)
        }
      },
    }
  }

  // 导出
  window.PersistableMixin = { create: createPersistable }

  console.log('[PersistableMixin] 已加载')
})()
