/**
 * DOM 监听模块
 * 监听 DOM 变化并更新相关状态
 */
(function() {
  'use strict';

  class DOMWatcher {
    constructor(callbacks = {}) {
    this.observer = null;
    this.callbacks = callbacks;
    this.debounceTimer = null;
    this.debounceDelay = 100;
    this.isActive = false;
  }

    /**
     * 启动监听
     */
    start() {
      if (this.isActive || !document.body) return;

      this.isActive = true;
      this.observer = new MutationObserver((mutations) => {
        this._handleMutations(mutations);
      });

      this.observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'id', 'hidden', 'disabled']
      });
    }

    /**
     * 停止监听
     */
    stop() {
      if (this.observer) {
        this.observer.disconnect();
        this.observer = null;
      }
      this.isActive = false;
    }

    /**
     * 处理 DOM 变化
     */
  _handleMutations(mutations) {
    // 防抖处理
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this._processMutations(mutations);
    }, this.debounceDelay);
  }

    /**
     * 处理变化详情
     */
  _processMutations(mutations) {
    const changes = {
      added: [],
      removed: [],
      modified: [],
      moved: []
    };

    for (const mutation of mutations) {
      switch (mutation.type) {
        case 'childList':
          // 添加的节点
          for (const node of mutation.addedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              changes.added.push(node);

              // 检查是否包含选中元素
              if (this.callbacks.onElementAdded) {
                this.callbacks.onElementAdded(node);
              }
            }
          }

          // 移除的节点
          for (const node of mutation.removedNodes) {
            if (node.nodeType === Node.ELEMENT_NODE) {
              changes.removed.push(node);

              if (this.callbacks.onElementRemoved) {
                this.callbacks.onElementRemoved(node);
              }
            }
          }
          break;

        case 'attributes':
          if (mutation.target.nodeType === Node.ELEMENT_NODE) {
            changes.modified.push({
              element: mutation.target,
              attribute: mutation.attributeName,
              oldValue: mutation.oldValue,
              newValue: mutation.target.getAttribute(mutation.attributeName)
            });

            if (this.callbacks.onAttributeChanged) {
              this.callbacks.onAttributeChanged(
                mutation.target,
                mutation.attributeName,
                mutation.oldValue,
                mutation.target.getAttribute(mutation.attributeName)
              );
            }
          }
          break;
      }
    }

    // 触发总回调
    if (this.callbacks.onChanges && (changes.added.length > 0 || changes.removed.length > 0 || changes.modified.length > 0)) {
      this.callbacks.onChanges(changes);
    }
  }

    /**
     * 检查元素是否影响选中的元素
     */
  checkAffectedElements(selectedElements) {
    const affected = [];

    for (const item of selectedElements) {
      try {
        const element = document.querySelector(item.selector);
        if (!element) {
          affected.push({ ...item, reason: 'removed' });
        } else {
          // 检查元素是否被移动或修改
          const rect = element.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) {
            affected.push({ ...item, reason: 'hidden' });
          }
        }
      } catch {
        affected.push({ ...item, reason: 'invalid' });
      }
    }

    return affected;
  }

    /**
     * 监听特定元素
     */
  watchElement(element, callback) {
    const observer = new MutationObserver((mutations) => {
      callback(mutations);
    });

    observer.observe(element, {
      attributes: true,
      attributeOldValue: true,
      characterData: true,
      childList: true,
      subtree: true
    });

    return () => observer.disconnect();
  }

    /**
     * 销毁
     */
  destroy() {
    this.stop();
    this.callbacks = {};
  }
  }

  // 导出
  window.DOMWatcher = DOMWatcher;
})();
