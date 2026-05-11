// Content script for weread.qq.com (微信阅读)
// 使用公共模块重构

'use strict'

import { createScriptGuard } from './utils/script-guard.js'
import { createStyleInjector } from './utils/style-injector.js'

// 防重复加载
const guard = createScriptGuard('Weread')
if (guard.check()) {
  throw new Error('脚本已加载')
}

const STYLE_TAG_ID = 'weread-script-style'
const styleInjector = createStyleInjector(STYLE_TAG_ID)
const STORAGE_KEY = 'yc-weixin-read'

let intervalId = null

const settings = {
  open: true,
  interval: 5000,
  step: 30,
}

const lastScrollYArr = []

const styles = `
#floatBtn {
  position: fixed;
  right: 20px;
  top: 50%;
  transform: translateY(-50%);
  padding: 10px 15px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  z-index: 9999;
  font-size: 14px;
}
#floatBtn:hover {
  background: #45a049;
}
#floatBtn.stopped {
  background: #f44336;
}
`

function injectStyles() {
  styleInjector.inject(styles)
}

function autoScroll() {
  if (!settings.open) {
    return
  }

  const scrollStep = settings.step
  const currentScrollY = window.scrollY
  lastScrollYArr.push(currentScrollY)

  if (lastScrollYArr.length > 5) {
    lastScrollYArr.shift()
  }

  const isAtBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 100

  if (isAtBottom) {
    console.log('[微信阅读] 已到达页面底部')
    stopAutoScroll()
    return
  }

  window.scrollBy(0, scrollStep)
}

function startAutoScroll() {
  if (intervalId) {
    return
  }
  settings.open = true
  intervalId = setInterval(autoScroll, settings.interval)
  updateButtonState()
  console.log('[微信阅读] 开始自动滚动')
}

function stopAutoScroll() {
  if (intervalId) {
    clearInterval(intervalId)
    intervalId = null
  }
  settings.open = false
  updateButtonState()
  console.log('[微信阅读] 停止自动滚动')
}

function toggleAutoScroll() {
  if (settings.open) {
    stopAutoScroll()
  } else {
    startAutoScroll()
  }
  saveSettings()
}

function updateButtonState() {
  const btn = document.getElementById('floatBtn')
  if (btn) {
    btn.textContent = settings.open ? '停止滚动' : '开始滚动'
    btn.classList.toggle('stopped', !settings.open)
  }
}

function createFloatButton() {
  const btn = document.createElement('button')
  btn.id = 'floatBtn'
  btn.textContent = settings.open ? '停止滚动' : '开始滚动'
  btn.onclick = toggleAutoScroll
  document.body.appendChild(btn)
}

async function loadSettings() {
  try {
    const result = await chrome.storage.local.get([STORAGE_KEY])
    if (result[STORAGE_KEY]) {
      Object.assign(settings, result[STORAGE_KEY])
    }
  } catch (error) {
    console.warn('[微信阅读] 加载设置失败:', error)
  }
}

async function saveSettings() {
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: settings })
  } catch (error) {
    console.warn('[微信阅读] 保存设置失败:', error)
  }
}

async function init() {
  injectStyles()
  await loadSettings()
  createFloatButton()

  if (settings.open) {
    startAutoScroll()
  }

  guard.markInitialized()
  console.log('[微信阅读] 脚本已加载')
}

// 启动
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
