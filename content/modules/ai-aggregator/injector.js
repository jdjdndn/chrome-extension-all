// content/modules/ai-aggregator/injector.js
/**
 * AI 聚合问答 - 注入脚本
 * 注入到各 AI 网站页面，负责：填入问题、发送、应用配置
 */

(function () {
  'use strict'

  // 防止重复注入
  if (window.__aiAggregatorInjected) {
    return
  }
  window.__aiAggregatorInjected = true

  console.log('[AI Aggregator Injector] 注入脚本已加载')

  /**
   * 等待元素出现
   */
  function waitForElement(selectors, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const selectorList = selectors.split(',').map((s) => s.trim())

      // 先尝试立即查找
      for (const selector of selectorList) {
        const element = document.querySelector(selector)
        if (element) {
          resolve(element)
          return
        }
      }

      // 设置观察器
      const observer = new MutationObserver(() => {
        for (const selector of selectorList) {
          const element = document.querySelector(selector)
          if (element) {
            observer.disconnect()
            resolve(element)
            return
          }
        }
      })

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      })

      // 超时
      setTimeout(() => {
        observer.disconnect()
        reject(new Error(`元素未找到: ${selectors}`))
      }, timeout)
    })
  }

  /**
   * 应用 AI 特有配置
   */
  async function applyOptions(options) {
    if (!options) {return}

    for (const [key, option] of Object.entries(options)) {
      try {
        const element = await waitForElement(option.selector, 3000)

        if (option.type === 'boolean' && option.default) {
          // 如果默认启用且当前未启用，则点击
          if (element.type === 'checkbox' && !element.checked) {
            element.click()
            console.log(`[AI Aggregator Injector] 已启用: ${option.label}`)
          }
        } else if (option.type === 'select' && option.default) {
          element.value = option.default
          element.dispatchEvent(new Event('change', { bubbles: true }))
          console.log(`[AI Aggregator Injector] 已设置: ${option.label} = ${option.default}`)
        }
      } catch (e) {
        console.log(`[AI Aggregator Injector] 配置项不可用: ${option.label}`)
      }
    }
  }

  /**
   * 填入问题
   */
  async function fillQuestion(inputSelector, question) {
    const inputElement = await waitForElement(inputSelector, 15000)

    if (inputElement.tagName === 'TEXTAREA' || inputElement.tagName === 'INPUT') {
      // 聚焦并设置值
      inputElement.focus()
      inputElement.value = question

      // 触发各种事件确保生效
      inputElement.dispatchEvent(new Event('input', { bubbles: true }))
      inputElement.dispatchEvent(new Event('change', { bubbles: true }))

      // React/Vue 等框架可能需要触发 keydown/keyup
      inputElement.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }))
      inputElement.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }))
    } else if (inputElement.isContentEditable) {
      // contenteditable 元素
      inputElement.focus()
      inputElement.textContent = question

      // 触发 input 事件
      inputElement.dispatchEvent(
        new InputEvent('input', {
          bubbles: true,
          inputType: 'insertText',
          data: question,
        })
      )
    }

    console.log('[AI Aggregator Injector] 问题已填入')
    return true
  }

  /**
   * 点击发送按钮
   */
  async function clickSend(buttonSelector) {
    const sendButton = await waitForElement(buttonSelector, 5000)

    // 等待按钮可点击（某些网站按钮初始是禁用的）
    await new Promise((resolve) => setTimeout(resolve, 500))

    sendButton.click()
    console.log('[AI Aggregator Injector] 已点击发送按钮')
    return true
  }

  /**
   * 检测登录状态
   */
  async function checkLoginStatus(loginIndicator) {
    try {
      const element = await waitForElement(loginIndicator, 5000)
      return !!element
    } catch {
      return false
    }
  }

  /**
   * 执行完整的发送流程
   */
  async function executeSend(config, question) {
    try {
      // 1. 检测登录状态
      const isLoggedIn = await checkLoginStatus(config.selectors.loginIndicator)
      if (!isLoggedIn) {
        chrome.runtime.sendMessage({
          type: 'AIA_INJECT_ERROR',
          siteId: config.id,
          error: 'LOGIN_REQUIRED',
          message: '请先登录',
        })
        return false
      }

      // 2. 应用配置
      if (config.options) {
        await applyOptions(config.options)
      }

      // 3. 填入问题
      await fillQuestion(config.selectors.input, question)

      // 4. 点击发送
      await clickSend(config.selectors.sendButton)

      // 5. 通知成功
      chrome.runtime.sendMessage({
        type: 'AIA_INJECT_READY',
        siteId: config.id,
        success: true,
      })

      return true
    } catch (error) {
      chrome.runtime.sendMessage({
        type: 'AIA_INJECT_ERROR',
        siteId: config.id,
        error: error.message,
      })
      return false
    }
  }

  // 监听来自 Background 的消息
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'AIA_EXECUTE_SEND') {
      executeSend(message.config, message.question)
        .then((success) => sendResponse({ success }))
        .catch((error) => sendResponse({ success: false, error: error.message }))
      return true
    }
    return false
  })

  // 通知脚本已加载
  chrome.runtime.sendMessage({
    type: 'AIA_INJECT_LOADED',
  })
})()
