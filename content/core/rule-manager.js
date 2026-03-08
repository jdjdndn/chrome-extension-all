// ========== 规则导入导出管理模块 ==========
// 支持规则批量导入导出和云同步

(function () {
  'use strict';

  if (window.RuleManager) {
    console.log('[RuleManager] 已存在，跳过初始化');
    return;
  }

  /**
   * RuleManager - 规则管理器
   * 功能：
   * 1. 规则分组管理
   * 2. 规则导入导出
   * 3. 规则模板
   * 4. 云同步支持
   */
  const RuleManager = {
    // 规则存储
    rules: new Map(),

    // 分组存储
    groups: {},

    // 规则模板
    templates: {},

    // 配置
    config: {
      storageKey: 'ruleManager',
      cloudServer: null,
      cloudToken: null
    },

    // 初始化状态
    initialized: false,

    /**
     * 初始化
     */
    async init(options = {}) {
      if (this.initialized) return true;

      this.config = { ...this.config, ...options };
      await this._loadFromStorage();
      this._ensureDefaultGroups();
      this._registerDefaultTemplates();

      this.initialized = true;
      console.log('[RuleManager] 初始化完成');
      return true;
    },

    /**
     * 从存储加载
     */
    async _loadFromStorage() {
      try {
        if (typeof StorageUtils !== 'undefined') {
          const result = await StorageUtils.getLocal(this.config.storageKey);
          if (result?.[this.config.storageKey]) {
            const data = result[this.config.storageKey];
            if (data.rules) {
              for (const rule of data.rules) {
                this.rules.set(rule.id, rule);
              }
            }
            if (data.groups) {
              this.groups = data.groups;
            }
          }
        }
      } catch (error) {
        console.error('[RuleManager] 加载失败:', error);
      }
    },

    /**
     * 保存到存储
     */
    async _saveToStorage() {
      try {
        if (typeof StorageUtils !== 'undefined') {
          await StorageUtils.setLocal({
            [this.config.storageKey]: {
              rules: Array.from(this.rules.values()),
              groups: this.groups
            }
          });
        }
      } catch (error) {
        console.error('[RuleManager] 保存失败:', error);
      }
    },

    /**
     * 确保默认分组存在
     */
    _ensureDefaultGroups() {
      const defaults = ['default', 'ads', 'privacy', 'content', 'custom'];
      for (const name of defaults) {
        if (!this.groups[name]) {
          this.groups[name] = [];
        }
      }
    },

    /**
     * 注册默认模板
     */
    _registerDefaultTemplates() {
      this.templates = {
        'block-ads': {
          type: 'selector',
          category: 'ads',
          description: '广告屏蔽规则',
          enabled: true
        },
        'block-tracker': {
          type: 'selector',
          category: 'privacy',
          description: '跟踪器屏蔽规则',
          enabled: true
        },
        'keyword-filter': {
          type: 'keyword',
          category: 'content',
          description: '关键词过滤规则',
          enabled: true
        }
      };
    },

    // ========== 规则操作 ==========

    /**
     * 添加规则
     */
    async addRule(rule) {
      if (!this._validateRule(rule)) {
        console.warn('[RuleManager] 无效的规则');
        return null;
      }

      const id = rule.id || `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const newRule = {
        ...rule,
        id,
        createdAt: rule.createdAt || Date.now(),
        updatedAt: Date.now()
      };

      this.rules.set(id, newRule);
      await this._saveToStorage();

      console.log(`[RuleManager] 添加规则: ${id}`);
      return newRule;
    },

    /**
     * 更新规则
     */
    async updateRule(id, updates) {
      const rule = this.rules.get(id);
      if (!rule) {
        console.warn(`[RuleManager] 规则不存在: ${id}`);
        return null;
      }

      const updated = {
        ...rule,
        ...updates,
        id,
        updatedAt: Date.now()
      };

      this.rules.set(id, updated);
      await this._saveToStorage();

      return updated;
    },

    /**
     * 删除规则
     */
    async deleteRule(id) {
      if (!this.rules.has(id)) return false;

      this.rules.delete(id);
      await this._saveToStorage();

      console.log(`[RuleManager] 删除规则: ${id}`);
      return true;
    },

    /**
     * 获取规则
     */
    getRule(id) {
      return this.rules.get(id) || null;
    },

    /**
     * 获取所有规则
     */
    getAllRules(filter = null) {
      let rules = Array.from(this.rules.values());

      if (filter) {
        if (filter.type) {
          rules = rules.filter(r => r.type === filter.type);
        }
        if (filter.category) {
          rules = rules.filter(r => r.category === filter.category);
        }
        if (filter.enabled !== undefined) {
          rules = rules.filter(r => r.enabled === filter.enabled);
        }
        if (filter.group) {
          const groupIds = this.groups[filter.group] || [];
          rules = rules.filter(r => groupIds.includes(r.id));
        }
      }

      return rules;
    },

    /**
     * 验证规则
     */
    _validateRule(rule) {
      if (!rule || typeof rule !== 'object') return false;
      if (rule.type && !['selector', 'keyword', 'domain'].includes(rule.type)) return false;
      return true;
    },

    // ========== 分组操作 ==========

    /**
     * 获取分组
     */
    getGroup(name) {
      return this.groups[name] || [];
    },

    /**
     * 添加到分组
     */
    async addToGroup(groupName, ruleIds) {
      if (!this.groups[groupName]) {
        this.groups[groupName] = [];
      }

      const ids = Array.isArray(ruleIds) ? ruleIds : [ruleIds];
      this.groups[groupName] = [
        ...new Set([...this.groups[groupName], ...ids])
      ];

      await this._saveToStorage();
      return this.groups[groupName];
    },

    /**
     * 从分组移除
     */
    async removeFromGroup(groupName, ruleIds) {
      if (!this.groups[groupName]) return [];

      const ids = Array.isArray(ruleIds) ? ruleIds : [ruleIds];
      this.groups[groupName] = this.groups[groupName]
        .filter(id => !ids.includes(id));

      await this._saveToStorage();
      return this.groups[groupName];
    },

    /**
     * 获取分组信息
     */
    getGroupInfo(groupName) {
      const ruleIds = this.getGroup(groupName);
      const rules = ruleIds.map(id => this.rules.get(id)).filter(Boolean);

      return {
        name: groupName,
        count: rules.length,
        rules
      };
    },

    // ========== 导入导出 ==========

    /**
     * 导出规则
     */
    exportRules(options = {}) {
      const { format = 'json', groups = null } = options;

      let rules = this.getAllRules();
      if (groups) {
        const groupIds = new Set();
        for (const groupName of groups) {
          (this.groups[groupName] || []).forEach(id => groupIds.add(id));
        }
        rules = rules.filter(r => groupIds.has(r.id));
      }

      const data = {
        version: '1.0',
        timestamp: Date.now(),
        rules,
        groups: groups ? groups.reduce((acc, name) => {
          acc[name] = this.groups[name] || [];
          return acc;
        }, {}) : this.groups
      };

      switch (format) {
        case 'json':
          return JSON.stringify(data, null, 2);
        case 'base64':
          return btoa(JSON.stringify(data));
        case 'object':
        default:
          return data;
      }
    },

    /**
     * 导入规则
     */
    async importRules(data, options = {}) {
      const { merge = true, validateRules = true } = options;

      try {
        let parsed;
        if (typeof data === 'string') {
          if (data.startsWith('{') || data.startsWith('[')) {
            parsed = JSON.parse(data);
          } else {
            parsed = JSON.parse(atob(data));
          }
        } else {
          parsed = data;
        }

        if (!parsed.rules || !Array.isArray(parsed.rules)) {
          throw new Error('无效的规则数据格式');
        }

        let imported = 0;
        let skipped = 0;
        const errors = [];

        for (const rule of parsed.rules) {
          try {
            if (validateRules && !this._validateRule(rule)) {
              skipped++;
              continue;
            }

            if (merge && this.rules.has(rule.id)) {
              await this.updateRule(rule.id, rule);
            } else {
              await this.addRule(rule);
            }
            imported++;
          } catch (error) {
            errors.push({ rule: rule.id, error: error.message });
          }
        }

        // 导入分组
        if (parsed.groups) {
          for (const [name, ids] of Object.entries(parsed.groups)) {
            if (merge) {
              await this.addToGroup(name, ids);
            } else {
              this.groups[name] = ids;
            }
          }
          await this._saveToStorage();
        }

        console.log(`[RuleManager] 导入完成: ${imported} 成功, ${skipped} 跳过, ${errors.length} 错误`);
        return { success: true, imported, skipped, errors };
      } catch (error) {
        console.error('[RuleManager] 导入失败:', error);
        return { success: false, error: error.message };
      }
    },

    // ========== 云同步 ==========

    /**
     * 同步到云端
     */
    async syncToCloud(options = {}) {
      const serverUrl = options.serverUrl || this.config.cloudServer;
      const token = options.token || this.config.cloudToken;

      if (!serverUrl) {
        return { success: false, error: '未配置云端服务器' };
      }

      try {
        const data = this.exportRules({ format: 'object' });

        const response = await fetch(`${serverUrl}/api/rules/sync`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error(`同步失败: ${response.status}`);
        }

        const result = await response.json();
        console.log('[RuleManager] 同步到云端成功');
        return { success: true, data: result };
      } catch (error) {
        console.error('[RuleManager] 同步到云端失败:', error);
        return { success: false, error: error.message };
      }
    },

    /**
     * 从云端同步
     */
    async syncFromCloud(options = {}) {
      const serverUrl = options.serverUrl || this.config.cloudServer;
      const token = options.token || this.config.cloudToken;
      const merge = options.merge !== false;

      if (!serverUrl) {
        return { success: false, error: '未配置云端服务器' };
      }

      try {
        const response = await fetch(`${serverUrl}/api/rules/sync`, {
          headers: {
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
          }
        });

        if (!response.ok) {
          throw new Error(`获取失败: ${response.status}`);
        }

        const data = await response.json();
        const result = await this.importRules(data, { merge });

        console.log('[RuleManager] 从云端同步成功');
        return result;
      } catch (error) {
        console.error('[RuleManager] 从云端同步失败:', error);
        return { success: false, error: error.message };
      }
    },

    // ========== 模板操作 ==========

    /**
     * 从模板创建规则
     */
    async createFromTemplate(templateName, params = {}) {
      const template = this.templates[templateName];
      if (!template) {
        console.warn(`[RuleManager] 模板不存在: ${templateName}`);
        return null;
      }

      const rule = {
        ...template,
        ...params,
        source: `template:${templateName}`
      };

      return await this.addRule(rule);
    },

    /**
     * 注册模板
     */
    registerTemplate(name, template) {
      this.templates[name] = template;
      console.log(`[RuleManager] 注册模板: ${name}`);
    },

    /**
     * 获取模板列表
     */
    getTemplates() {
      return Object.entries(this.templates).map(([name, template]) => ({
        name,
        ...template
      }));
    },

    // ========== 统计和清理 ==========

    /**
     * 获取统计信息
     */
    getStats() {
      const groupStats = {};
      for (const [name, ids] of Object.entries(this.groups)) {
        groupStats[name] = ids.length;
      }

      return {
        totalRules: this.rules.size,
        totalGroups: Object.keys(this.groups).length,
        groupStats,
        templates: Object.keys(this.templates)
      };
    },

    /**
     * 清理无效规则
     */
    async cleanup() {
      let removed = 0;

      for (const [id, rule] of this.rules) {
        if (!this._validateRule(rule)) {
          this.rules.delete(id);
          removed++;
        }
      }

      // 清理分组中的无效引用
      for (const [name, ids] of Object.entries(this.groups)) {
        this.groups[name] = ids.filter(id => this.rules.has(id));
      }

      await this._saveToStorage();
      console.log(`[RuleManager] 清理完成，移除 ${removed} 个无效规则`);
      return removed;
    },

    /**
     * 清空所有数据
     */
    async clear() {
      this.rules.clear();
      this.groups = {};
      this._ensureDefaultGroups();
      await this._saveToStorage();
      console.log('[RuleManager] 已清空所有数据');
    }
  };

  // 导出
  window.RuleManager = RuleManager;

  console.log('[RuleManager] 规则管理器已加载');
})();
