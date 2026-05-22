// Tab 切换功能 - 独立模块，不依赖其他脚本
(function () {
  'use strict'

  console.log('[TabSwitch] 开始初始化...')

  // 侧边栏 Tab 切换
  function switchSidebarTab(tabId) {
    console.log('[TabSwitch] 切换到 Tab:', tabId)

    // 更新侧边栏激活状态
    var allTabs = document.querySelectorAll('.sidebar-tab')
    for (var i = 0; i < allTabs.length; i++) {
      allTabs[i].classList.remove('active')
    }

    var activeTab = document.querySelector('.sidebar-tab[data-tab="' + tabId + '"]')
    if (activeTab) {
      activeTab.classList.add('active')
    }

    // 更新内容显示
    var allContents = document.querySelectorAll('.tab-content')
    for (var j = 0; j < allContents.length; j++) {
      allContents[j].classList.remove('active')
    }

    var targetContent = document.getElementById('tab-' + tabId)
    if (targetContent) {
      targetContent.classList.add('active')
      console.log('[TabSwitch] 已激活内容:', 'tab-' + tabId)
    } else {
      console.warn('[TabSwitch] 未找到内容:', 'tab-' + tabId)
    }

    window.dispatchEvent(new CustomEvent('devtools:tab:switched', { detail: { tabId } }))
  }

  // Info 子 Tab 切换
  function switchInfoSubTab(subtabId) {
    console.log('[TabSwitch] 切换到子 Tab:', subtabId)

    // 更新子 Tab 激活状态
    var allSubTabs = document.querySelectorAll('.info-sub-tab')
    for (var k = 0; k < allSubTabs.length; k++) {
      allSubTabs[k].classList.remove('active')
    }

    var activeSubTab = document.querySelector('.info-sub-tab[data-subtab="' + subtabId + '"]')
    if (activeSubTab) {
      activeSubTab.classList.add('active')
    }

    // 更新子内容显示
    var allSubContents = document.querySelectorAll('.info-sub-content')
    for (var l = 0; l < allSubContents.length; l++) {
      allSubContents[l].classList.remove('active')
    }

    var targetSubContent = document.getElementById('info-' + subtabId)
    if (targetSubContent) {
      targetSubContent.classList.add('active')
    }

    // 特殊处理：storage tab
    if (subtabId === 'storage') {
      window.dispatchEvent(new CustomEvent('devtools:subtab:switched', { detail: { subtabId } }))
    }
  }

  // 使用事件委托绑定点击事件
  document.addEventListener(
    'click',
    (e) => {
      // 检查点击的是否是侧边栏 Tab
      var sidebarTab = e.target.closest('.sidebar-tab')
      if (sidebarTab && sidebarTab.dataset.tab) {
        e.preventDefault()
        e.stopPropagation()
        switchSidebarTab(sidebarTab.dataset.tab)
        return
      }

      // 检查点击的是否是 Info 子 Tab
      var infoSubTab = e.target.closest('.info-sub-tab')
      if (infoSubTab && infoSubTab.dataset.subtab) {
        e.preventDefault()
        e.stopPropagation()
        switchInfoSubTab(infoSubTab.dataset.subtab)
        return
      }
    },
    true
  ) // 使用捕获阶段确保事件优先处理

  // 暴露全局函数供其他脚本调用
  window.switchSidebarTab = switchSidebarTab
  window.switchInfoSubTab = switchInfoSubTab

  console.log('[TabSwitch] 初始化完成')
  console.log('[TabSwitch] sidebar-tab 数量:', document.querySelectorAll('.sidebar-tab').length)
  console.log('[TabSwitch] tab-content 数量:', document.querySelectorAll('.tab-content').length)
})()
