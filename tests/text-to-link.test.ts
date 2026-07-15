import { describe, it, expect } from 'vitest'

// 提取核心逻辑进行测试
function createTextToLink() {
  const linkRegex =
    /((https?:\/\/)?|(\/\/))?(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&\/\/=一-鿿぀-ヿ가-힯]*)/g

  const TOP_LEVEL_DOMAINS = [
    'com', 'net', 'org', 'edu', 'gov', 'mil', 'info', 'biz', 'app', 'shop',
    'store', 'xyz', 'top', 'live', 'cn', 'us', 'uk', 'jp', 'de', 'fr', 'ca',
    'hk', 'tw', 'mo', 'eu', 'in', 'tv', 'cc', 'cloud', 'site', 'io',
  ]

  function cleanLinkEnd(linkStr: string): string {
    const openCount = (linkStr.match(/\(/g) || []).length
    const closeCount = (linkStr.match(/\)/g) || []).length
    if (closeCount > openCount) {
      const excess = closeCount - openCount
      for (let i = 0; i < excess; i++) {
        const lastClose = linkStr.lastIndexOf(')')
        if (lastClose !== -1) {
          linkStr = linkStr.slice(0, lastClose) + linkStr.slice(lastClose + 1)
        }
      }
    }
    const allTlds = [...linkStr.matchAll(new RegExp(`\\.(${TOP_LEVEL_DOMAINS.join('|')})(?![a-zA-Z0-9])`, 'g'))]
    if (allTlds.length > 0) {
      for (const tldMatch of allTlds) {
        const tldEndIndex = tldMatch.index! + tldMatch[0].length
        const afterTld = linkStr.slice(tldEndIndex)
        if (afterTld && /^[^\w\/\?#\[\]@!$&'*+,;=%._~-]/.test(afterTld)) {
          linkStr = linkStr.slice(0, tldEndIndex)
          break
        }
      }
    }
    return linkStr
  }

  function filterLinks(links: any[]): any[] {
    if (!links) return []
    return links.filter((link) => {
      if (!link) return false
      let linkStr = Array.isArray(link) ? link[0] : link
      if (typeof linkStr !== 'string') return false
      linkStr = cleanLinkEnd(linkStr)
      if (Array.isArray(link)) link[0] = linkStr
      const ipv4Parts = linkStr.split('.')
      const isIpv4 = ipv4Parts.length >= 4 && ipv4Parts.every((part) => {
        const num = Number(part)
        return num === num && num >= 0 && num <= 255
      })
      if (isIpv4) return true
      return TOP_LEVEL_DOMAINS.some((tld) => linkStr.includes(`.${tld}`))
    })
  }

  function getTextLinksList(text: string) {
    const hostRegex = /\b(?!\/\/)((?:www\.)?[a-zA-Z0-9_.-]+(?:\.[a-zA-Z0-9_.-]+)*\.[a-zA-Z]{2,})\b/g

    // 获取所有 linkRegex 匹配（基于原始 text）
    const urlMatches = []
    for (const match of text.matchAll(linkRegex)) {
      match.type = 'url'
      match.rawLength = match[0].length
      urlMatches.push(match)
    }

    // 获取所有 hostRegex 匹配（基于原始 text）
    const hostMatches = []
    for (const match of text.matchAll(hostRegex)) {
      match.type = 'host'
      match.rawLength = match[0].length
      hostMatches.push(match)
    }

    // 过滤掉与 urlMatches 重叠的 hostMatches
    const filteredHostMatches = hostMatches.filter((hostMatch) => {
      const hostStart = hostMatch.index
      const hostEnd = hostStart + hostMatch[0].length
      return !urlMatches.some((urlMatch) => {
        const urlStart = urlMatch.index
        const urlEnd = urlStart + urlMatch[0].length
        return hostStart < urlEnd && hostEnd > urlStart
      })
    })

    const allMatches = [...urlMatches, ...filteredHostMatches]
    const filtered = filterLinks(allMatches)

    // 更新 rawLength 为 cleanLinkEnd 截断后的实际长度
    for (const match of filtered) {
      if (Array.isArray(match)) {
        match.rawLength = match[0].length
      }
    }

    return filtered
  }

  function splitText(text: string, arr: any[]) {
    if (!arr.length) return [{ text, type: 'text' }]
    let lastIndex = 0
    const returnArr: any[] = []
    arr.forEach((item, i) => {
      const link = item[0]
      const textObj = { text: text.slice(lastIndex, item.index), type: 'text' }
      const linkObj = { text: link, type: 'link' }
      returnArr.push(textObj, linkObj)
      const span = item.rawLength || link.length
      lastIndex = item.index + span
      if (i === arr.length - 1 && lastIndex < text.length) {
        returnArr.push({ text: text.slice(lastIndex), type: 'text' })
      }
    })
    return returnArr
  }

  return { getTextLinksList, splitText }
}

describe('文本转链接 - 大段文字截断问题', () => {
  it('包含多个链接的大段文字不应截断', () => {
    const { getTextLinksList, splitText } = createTextToLink()

    // 大段文字，包含多个链接
    const text = '请访问 https://example.com/path 获取更多信息，也可以查看 https://test.org/page 了解详情，最后参考 https://demo.cn/guide 完成配置。'
    const links = getTextLinksList(text)
    const result = splitText(text, links)

    // 验证：所有文本片段拼接后应等于原始文本
    const reconstructed = result.map(r => r.text).join('')
    expect(reconstructed).toBe(text)
  })

  it('链接后紧跟中文不应截断中文', () => {
    const { getTextLinksList, splitText } = createTextToLink()

    const text = '下载地址 https://example.com下载'
    const links = getTextLinksList(text)
    const result = splitText(text, links)

    const reconstructed = result.map(r => r.text).join('')
    expect(reconstructed).toBe(text)
  })

  it('链接之间有大量文本不应截断', () => {
    const { getTextLinksList, splitText } = createTextToLink()

    const text = '第一个链接是 https://site-a.com 然后是一大段文字说明这个功能如何使用包括各种细节和注意事项以及常见问题解答最后第二个链接是 https://site-b.com'
    const links = getTextLinksList(text)
    const result = splitText(text, links)

    const reconstructed = result.map(r => r.text).join('')
    expect(reconstructed).toBe(text)
  })

  it('纯域名（无协议）不应截断后续文本', () => {
    const { getTextLinksList, splitText } = createTextToLink()

    const text = '请访问 example.com 获取帮助'
    const links = getTextLinksList(text)
    const result = splitText(text, links)

    const reconstructed = result.map(r => r.text).join('')
    expect(reconstructed).toBe(text)
  })
})
