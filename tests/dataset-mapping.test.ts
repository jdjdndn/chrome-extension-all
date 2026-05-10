/**
 * 测试 dataset 属性名到 HTML 属性的映射
 */

import { describe, it, expect } from 'vitest'

describe('dataset 属性映射', () => {
  it('dataset.lazySrc 应映射到 data-lazy-src', () => {
    const el = document.createElement('div')
    el.dataset.lazySrc = 'test-url'

    expect(el.hasAttribute('data-lazy-src')).toBe(true)
    expect(el.getAttribute('data-lazy-src')).toBe('test-url')
    expect(el.hasAttribute('data-lazySrc')).toBe(false)
    expect(el.hasAttribute('data-lazysrc')).toBe(false)
  })

  it('dataset.lazyLoaded 应映射到 data-lazy-loaded', () => {
    const el = document.createElement('div')
    el.dataset.lazyLoaded = 'true'

    expect(el.hasAttribute('data-lazy-loaded')).toBe(true)
    expect(el.getAttribute('data-lazy-loaded')).toBe('true')
  })

  it('dataset._raLazyLoad 应映射到 data-_ra-lazy-load', () => {
    const el = document.createElement('div')
    el.dataset._raLazyLoad = '1'

    // _ 保持，L/l → -l，L → -l
    expect(el.hasAttribute('data-_ra-lazy-load')).toBe(true)
    expect(el.getAttribute('data-_ra-lazy-load')).toBe('1')
  })

  it('选择器应使用正确格式', () => {
    document.body.innerHTML = `
      <img data-lazy-src="url1">
      <img data-lazy-loaded="true">
      <img data-_ra-lazy-load="1">
    `

    // 使用正确的 kebab-case 选择器
    expect(document.querySelectorAll('img[data-lazy-src]').length).toBe(1)
    expect(document.querySelectorAll('img[data-lazy-loaded="true"]').length).toBe(1)
    expect(document.querySelectorAll('img[data-_ra-lazy-load="1"]').length).toBe(1)

    // 错误的驼峰选择器不应匹配
    expect(document.querySelectorAll('img[data-lazySrc]').length).toBe(0)
    expect(document.querySelectorAll('img[data-lazysrc]').length).toBe(0)
  })
})
