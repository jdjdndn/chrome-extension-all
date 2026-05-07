/**
 * 资源加速器 Service Worker (v13)
 * 支持资源离线缓存，提升弱网和离线场景体验
 */

const CACHE_NAME = 'resource-accelerator-v1'
const OFFLINE_CACHE_KEY = 'offlineCacheConfig'

// 默认离线缓存配置
const DEFAULT_OFFLINE_CONFIG = {
  enabled: true,
  strategy: 'stale-while-revalidate', // cache-first | network-first | stale-while-revalidate
  maxCacheSize: 50 * 1024 * 1024, // 50MB
  cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7天
  precacheTypes: ['css', 'js', 'fonts'],
  excludeDomains: ['localhost'],
  excludePatterns: [/\/api\//i, /\/admin\//i],
}

let offlineConfig = DEFAULT_OFFLINE_CONFIG

// ========== 安装事件 ==========
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] 安装中...')
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] 缓存已打开')
      // 预缓存核心资源（由 content script 注入）
      return cache.addAll([])
    })
  )
  // 跳过等待，立即激活
  self.skipWaiting()
})

// ========== 激活事件 ==========
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] 激活中...')
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] 删除旧缓存:', cacheName)
            return caches.delete(cacheName)
          }
        })
      )
    })
  )
  // 立即控制所有客户端
  self.clients.claim()
})

// ========== 获取事件 ==========
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // 检查是否在排除列表
  if (shouldExclude(url)) {
    return
  }

  // 仅处理 GET 请求
  if (event.request.method !== 'GET') {
    return
  }

  event.respondWith(handleFetch(event.request))
})

// ========== 消息事件 ==========
self.addEventListener('message', (event) => {
  const { type, config } = event.data

  if (type === 'UPDATE_CONFIG') {
    offlineConfig = { ...DEFAULT_OFFLINE_CONFIG, ...config }
    console.log('[ServiceWorker] 配置已更新')
  }

  if (type === 'GET_CACHE_STATS') {
    getCacheStats().then((stats) => {
      event.ports[0].postMessage(stats)
    })
  }

  if (type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true })
    })
  }
})

// ========== 核心处理函数 ==========
async function handleFetch(request) {
  const cached = await caches.match(request)

  switch (offlineConfig.strategy) {
    case 'cache-first':
      return cached || fetchAndCache(request)

    case 'network-first':
      try {
        const response = await fetchAndCache(request)
        return response
      } catch (error) {
        return cached || new Response('离线状态', { status: 503 })
      }

    case 'stale-while-revalidate':
    default:
      // 立即返回缓存，同时更新缓存
      const fetchPromise = fetchAndCache(request).catch(() => cached)
      return cached || fetchPromise
  }
}

async function fetchAndCache(request) {
  const response = await fetch(request)

  // 仅缓存成功的响应
  if (response.ok) {
    const clone = response.clone()
    caches.open(CACHE_NAME).then((cache) => {
      cache.put(request, clone)
      // 检查缓存大小
      checkCacheSize()
    })
  }

  return response
}

function shouldExclude(url) {
  // 排除域名
  if (offlineConfig.excludeDomains.includes(url.hostname)) {
    return true
  }

  // 排除URL模式
  return offlineConfig.excludePatterns.some((pattern) => pattern.test(url.href))
}

async function checkCacheSize() {
  if ('caches' in self) {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()

    // 估算缓存大小（简化版）
    if (keys.length > 1000) {
      // 清理旧缓存
      await cleanupOldCache()
    }
  }
}

async function cleanupOldCache() {
  const cache = await caches.open(CACHE_NAME)
  const keys = await cache.keys()

  // 按时间排序，删除最旧的缓存
  const entries = []
  for (const request of keys) {
    const response = await cache.match(request)
    const dateHeader = response?.headers?.get('date')
    if (dateHeader) {
      entries.push({ request, date: new Date(dateHeader).getTime() })
    }
  }

  entries.sort((a, b) => a.date - b.date)

  // 删除一半的旧缓存
  const toDelete = Math.floor(entries.length / 2)
  for (let i = 0; i < toDelete; i++) {
    await cache.delete(entries[i].request)
  }
}

async function getCacheStats() {
  if ('caches' in self) {
    const cache = await caches.open(CACHE_NAME)
    const keys = await cache.keys()
    return {
      size: keys.length,
      name: CACHE_NAME,
    }
  }
  return { size: 0, name: CACHE_NAME }
}
