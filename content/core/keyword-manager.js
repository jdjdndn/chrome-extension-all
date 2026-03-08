// ========== 关键词分组管理模块 ==========
// 支持关键词按站点/类型分类管理

(function () {
  'use strict';

  if (window.KeywordManager) {
    console.log('[KeywordManager] 已存在，跳过初始化');
    return;
  }

  /**
   * KeywordManager - 关键词分组管理
   * 功能：
   * 1. 按站点和类型分组管理关键词
   * 2. 关键词匹配和搜索
   * 3. 导入导出和同步
   */
  const KeywordManager = {
    // 关键词存储
    keywords: {
      bySite: {},
      byType: {
        notInterested: [],
        blocked: [],
        highlighted: [],
        filtered: []
      },
      global: []
    },

    // 配置
    config: {
      storageKey: 'keywordManager',
      maxKeywords: 1000,
      caseSensitive: false
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
      this.initialized = true;
      console.log('[KeywordManager] 初始化完成');
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
            this.keywords = { ...this.keywords, ...result[this.config.storageKey] };
          }
        }
      } catch (error) {
        console.error('[KeywordManager] 加载失败:', error);
      }
    },

    /**
     * 保存到存储
     */
    async _saveToStorage() {
      try {
        if (typeof StorageUtils !== 'undefined') {
          await StorageUtils.setLocal({ [this.config.storageKey]: this.keywords });
        }
      } catch (error) {
        console.error('[KeywordManager] 保存失败:', error);
      }
    },

    /**
     * 标准化关键词
     */
    _normalize(keyword) {
      if (!keyword || typeof keyword !== 'string') return '';
      const normalized = keyword.trim();
      return this.config.caseSensitive ? normalized : normalized.toLowerCase();
    },

    // ========== 站点分组操作 ==========

    /**
     * 为站点添加关键词
     */
    async addForSite(site, keywords, type = 'default') {
      if (!this.keywords.bySite[site]) {
        this.keywords.bySite[site] = {};
      }
      if (!this.keywords.bySite[site][type]) {
        this.keywords.bySite[site][type] = [];
      }

      const words = Array.isArray(keywords) ? keywords : [keywords];
      const normalized = words.map(w => this._normalize(w)).filter(w => w);

      this.keywords.bySite[site][type] = [
        ...new Set([...this.keywords.bySite[site][type], ...normalized])
      ];

      await this._saveToStorage();
      return this.keywords.bySite[site][type];
    },

    /**
     * 从站点移除关键词
     */
    async removeFromSite(site, keywords, type = 'default') {
      if (!this.keywords.bySite[site]?.[type]) return [];

      const words = Array.isArray(keywords) ? keywords : [keywords];
      const normalized = words.map(w => this._normalize(w));

      this.keywords.bySite[site][type] = this.keywords.bySite[site][type]
        .filter(k => !normalized.includes(k));

      await this._saveToStorage();
      return this.keywords.bySite[site][type];
    },

    /**
     * 获取站点关键词
     */
    getSiteKeywords(site, type = null) {
      if (!this.keywords.bySite[site]) return [];
      if (type) {
        return this.keywords.bySite[site][type] || [];
      }
      // 返回所有类型
      const allKeywords = [];
      for (const keywords of Object.values(this.keywords.bySite[site])) {
        allKeywords.push(...keywords);
      }
      return [...new Set(allKeywords)];
    },

    // ========== 类型分组操作 ==========

    /**
     * 添加到类型分组
     */
    async addForType(type, keywords) {
      if (!this.keywords.byType[type]) {
        this.keywords.byType[type] = [];
      }

      const words = Array.isArray(keywords) ? keywords : [keywords];
      const normalized = words.map(w => this._normalize(w)).filter(w => w);

      this.keywords.byType[type] = [
        ...new Set([...this.keywords.byType[type], ...normalized])
      ];

      await this._saveToStorage();
      return this.keywords.byType[type];
    },

    /**
     * 从类型分组移除
     */
    async removeFromType(type, keywords) {
      if (!this.keywords.byType[type]) return [];

      const words = Array.isArray(keywords) ? keywords : [keywords];
      const normalized = words.map(w => this._normalize(w));

      this.keywords.byType[type] = this.keywords.byType[type]
        .filter(k => !normalized.includes(k));

      await this._saveToStorage();
      return this.keywords.byType[type];
    },

    /**
     * 获取类型关键词
     */
    getTypeKeywords(type) {
      return this.keywords.byType[type] || [];
    },

    // ========== 全局关键词操作 ==========

    /**
     * 添加全局关键词
     */
    async addGlobal(keywords) {
      const words = Array.isArray(keywords) ? keywords : [keywords];
      const normalized = words.map(w => this._normalize(w)).filter(w => w);

      this.keywords.global = [
        ...new Set([...this.keywords.global, ...normalized])
      ];

      await this._saveToStorage();
      return this.keywords.global;
    },

    /**
     * 移除全局关键词
     */
    async removeGlobal(keywords) {
      const words = Array.isArray(keywords) ? keywords : [keywords];
      const normalized = words.map(w => this._normalize(w));

      this.keywords.global = this.keywords.global
        .filter(k => !normalized.includes(k));

      await this._saveToStorage();
      return this.keywords.global;
    },

    // ========== 搜索和匹配 ==========

    /**
     * 搜索关键词
     */
    search(query, options = {}) {
      const { site, type, includeGlobal = true } = options;
      const results = [];
      const normalizedQuery = this._normalize(query);

      // 搜索站点关键词
      if (site && this.keywords.bySite[site]) {
        for (const [kwType, keywords] of Object.entries(this.keywords.bySite[site])) {
          if (type && kwType !== type) continue;
          for (const keyword of keywords) {
            if (keyword.includes(normalizedQuery)) {
              results.push({ keyword, source: `site:${site}:${kwType}` });
            }
          }
        }
      }

      // 搜索类型关键词
      for (const [kwType, keywords] of Object.entries(this.keywords.byType)) {
        if (type && kwType !== type) continue;
        for (const keyword of keywords) {
          if (keyword.includes(normalizedQuery)) {
            results.push({ keyword, source: `type:${kwType}` });
          }
        }
      }

      // 搜索全局关键词
      if (includeGlobal) {
        for (const keyword of this.keywords.global) {
          if (keyword.includes(normalizedQuery)) {
            results.push({ keyword, source: 'global' });
          }
        }
      }

      return results;
    },

    /**
     * 检查文本是否匹配关键词
     */
    match(text, options = {}) {
      const { site, types, includeGlobal = true } = options;
      const normalizedText = this._normalize(text);
      const matchedKeywords = [];

      // 检查站点关键词
      if (site && this.keywords.bySite[site]) {
        for (const [type, keywords] of Object.entries(this.keywords.bySite[site])) {
          if (types && !types.includes(type)) continue;
          for (const keyword of keywords) {
            if (normalizedText.includes(keyword)) {
              matchedKeywords.push({ keyword, type, source: 'site' });
            }
          }
        }
      }

      // 检查类型关键词
      for (const [type, keywords] of Object.entries(this.keywords.byType)) {
        if (types && !types.includes(type)) continue;
        for (const keyword of keywords) {
          if (normalizedText.includes(keyword)) {
            matchedKeywords.push({ keyword, type, source: 'type' });
          }
        }
      }

      // 检查全局关键词
      if (includeGlobal) {
        for (const keyword of this.keywords.global) {
          if (normalizedText.includes(keyword)) {
            matchedKeywords.push({ keyword, type: 'global', source: 'global' });
          }
        }
      }

      return matchedKeywords;
    },

    // ========== 导入导出 ==========

    /**
     * 导出关键词
     */
    exportKeywords() {
      return {
        version: '1.0',
        timestamp: Date.now(),
        keywords: JSON.parse(JSON.stringify(this.keywords))
      };
    },

    /**
     * 导入关键词
     */
    async importKeywords(data, merge = true) {
      try {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;

        if (!parsed.keywords) {
          throw new Error('无效的关键词数据格式');
        }

        if (merge) {
          for (const [site, types] of Object.entries(parsed.keywords.bySite || {})) {
            for (const [type, keywords] of Object.entries(types)) {
              await this.addForSite(site, keywords, type);
            }
          }
          for (const [type, keywords] of Object.entries(parsed.keywords.byType || {})) {
            await this.addForType(type, keywords);
          }
          await this.addGlobal(parsed.keywords.global || []);
        } else {
          this.keywords = parsed.keywords;
          await this._saveToStorage();
        }

        console.log('[KeywordManager] 导入成功');
        return true;
      } catch (error) {
        console.error('[KeywordManager] 导入失败:', error);
        return false;
      }
    },

    // ========== 统计 ==========

    /**
     * 获取统计信息
     */
    getStats() {
      let totalKeywords = 0;
      const siteStats = {};
      const typeStats = {};

      for (const [site, types] of Object.entries(this.keywords.bySite)) {
        siteStats[site] = 0;
        for (const keywords of Object.values(types)) {
          siteStats[site] += keywords.length;
          totalKeywords += keywords.length;
        }
      }

      for (const [type, keywords] of Object.entries(this.keywords.byType)) {
        typeStats[type] = keywords.length;
        totalKeywords += keywords.length;
      }

      totalKeywords += this.keywords.global.length;

      return {
        total: totalKeywords,
        sites: Object.keys(this.keywords.bySite).length,
        types: Object.keys(this.keywords.byType).length,
        global: this.keywords.global.length,
        siteStats,
        typeStats
      };
    },

    /**
     * 清空所有数据
     */
    async clear() {
      this.keywords = {
        bySite: {},
        byType: {
          notInterested: [],
          blocked: [],
          highlighted: [],
          filtered: []
        },
        global: []
      };
      await this._saveToStorage();
      console.log('[KeywordManager] 已清空所有数据');
    }
  };

  // 导出
  window.KeywordManager = KeywordManager;

  console.log('[KeywordManager] 关键词管理模块已加载');
})();
