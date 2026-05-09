/**
 * 禁用 CDN 重定向功能
 * 在浏览器控制台运行此脚本
 */

// 禁用 CDN 重定向
chrome.storage.local.set({ disableCDNRedirect: true }, () => {
  console.log('✅ CDN 重定向已禁用')
  console.log('重新加载扩展生效...')
})

// 查询当前状态
chrome.storage.local.get('disableCDNRedirect', (result) => {
  console.log('当前状态:', result.disableCDNRedirect ? '已禁用' : '已启用')
})
