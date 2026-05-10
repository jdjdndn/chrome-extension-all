/**
 * 库加载器配置
 * 包含知名库定义、CDN 模板、函数提取规则
 */

(function () {
  'use strict'

  // ========== CDN 模板 ==========
  const CDN_TEMPLATES = {
    unpkg: {
      name: 'unpkg',
      template: 'https://unpkg.com/{name}@{version}/{path}',
      defaultPath: 'dist/{name}.min.js',
    },
    jsdelivr: {
      name: 'jsDelivr',
      template: 'https://cdn.jsdelivr.net/npm/{name}@{version}/{path}',
      defaultPath: 'dist/{name}.min.js',
    },
    cdnjs: {
      name: 'cdnjs',
      template: 'https://cdnjs.cloudflare.com/ajax/libs/{name}/{version}/{path}',
      defaultPath: '{name}.min.js',
    },
    esm: {
      name: 'esm.run',
      template: 'https://esm.run/{name}@{version}',
      isModule: true,
    },
  }

  // ========== 知名库预设 ==========
  const POPULAR_LIBRARIES = [
    {
      id: 'axios',
      name: 'Axios',
      description: 'HTTP 请求库',
      icon: '🌐',
      cdn: 'jsdelivr',
      version: '1.6.0',
      path: 'dist/axios.min.js',
      global: 'axios',
    },
    {
      id: 'jquery',
      name: 'jQuery',
      description: 'DOM 操作库',
      icon: '⚡',
      cdn: 'jsdelivr',
      version: '3.7.1',
      path: 'dist/jquery.min.js',
      global: '$',
    },
    {
      id: 'lodash',
      name: 'Lodash',
      description: '工具函数库',
      icon: '🔧',
      cdn: 'jsdelivr',
      version: '4.17.21',
      path: 'lodash.min.js',
      global: '_',
    },
    {
      id: 'dayjs',
      name: 'Day.js',
      description: '日期处理库',
      icon: '📅',
      cdn: 'jsdelivr',
      version: '1.11.10',
      path: 'dayjs.min.js',
      global: 'dayjs',
    },
    {
      id: 'vue',
      name: 'Vue 3',
      description: '渐进式框架',
      icon: '💚',
      cdn: 'unpkg',
      version: '3.4.0',
      path: 'dist/vue.global.prod.js',
      global: 'Vue',
    },
    {
      id: 'react',
      name: 'React',
      description: 'UI 库',
      icon: '⚛️',
      cdn: 'jsdelivr',
      version: '18.2.0',
      path: 'umd/react.production.min.js',
      global: 'React',
    },
    {
      id: 'immutable',
      name: 'Immutable',
      description: '不可变数据',
      icon: '🔒',
      cdn: 'jsdelivr',
      version: '4.3.0',
      path: 'immutable.min.js',
      global: 'Immutable',
    },
    {
      id: 'moment',
      name: 'Moment.js',
      description: '日期库（大）',
      icon: '🕐',
      cdn: 'jsdelivr',
      version: '2.29.4',
      path: 'moment.min.js',
      global: 'moment',
    },
    {
      id: 'uuid',
      name: 'UUID',
      description: 'UUID 生成',
      icon: '🔑',
      cdn: 'jsdelivr',
      version: '9.0.0',
      path: 'dist/umd/uuid.min.js',
      global: 'uuid',
    },
    {
      id: 'qs',
      name: 'QS',
      description: '查询字符串解析',
      icon: '📝',
      cdn: 'jsdelivr',
      version: '6.11.2',
      path: 'dist/qs.js',
      global: 'qs',
    },
    {
      id: 'chart',
      name: 'Chart.js',
      description: '图表库',
      icon: '📊',
      cdn: 'jsdelivr',
      version: '4.4.0',
      path: 'dist/chart.umd.min.js',
      global: 'Chart',
    },
    {
      id: 'marked',
      name: 'Marked',
      description: 'Markdown 解析',
      icon: '📄',
      cdn: 'jsdelivr',
      version: '11.1.0',
      path: 'marked.min.js',
      global: 'marked',
    },
  ]

  // ========== 函数提取规则 ==========
  const FUNCTION_PATTERNS = {
    // 普通函数: function name() {}
    namedFunction: /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g,
    // 箭头函数: const name = () => {}
    arrowFunction:
      /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[^=])\s*=>/g,
    // 方法简写: const obj = { name() {} }
    methodShorthand: /([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\([^)]*\)\s*\{/g,
    // async 函数
    asyncFunction: /async\s+function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,
    // export function
    exportFunction: /export\s+(?:async\s+)?function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g,
    // export const
    exportConst: /export\s+(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=/g,
  }

  // ========== 工具函数 ==========

  /**
   * 生成 CDN URL
   */
  function generateCDNUrl(lib) {
    const cdn = CDN_TEMPLATES[lib.cdn] || CDN_TEMPLATES.jsdelivr
    const url = cdn.template
      .replace('{name}', lib.id)
      .replace('{version}', lib.version)
      .replace('{path}', lib.path || cdn.defaultPath)

    return url
  }

  /**
   * 从代码中提取函数
   */
  function extractFunctions(code) {
    const functions = new Map()

    // 提取普通命名函数
    let match
    const namedFuncRegex = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(([^)]*)\)/g
    while ((match = namedFuncRegex.exec(code)) !== null) {
      const name = match[1]
      const params = match[2]
      const funcCode = extractFunctionBody(code, match.index, '{')
      if (funcCode) {
        functions.set(name, {
          name,
          params: params
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
          code: funcCode,
          type: 'function',
        })
      }
    }

    // 提取箭头函数
    const arrowFuncRegex =
      /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?(?:\(([^)]*)\)|([a-zA-Z_$][a-zA-Z0-9_$]*))\s*=>\s*/g
    while ((match = arrowFuncRegex.exec(code)) !== null) {
      const name = match[1]
      const params = match[2] || match[3] || ''
      const funcCode = extractArrowFunctionBody(code, match.index + match[0].length)
      if (funcCode && !functions.has(name)) {
        functions.set(name, {
          name,
          params: params
            .split(',')
            .map((p) => p.trim())
            .filter(Boolean),
          code: `const ${name} = ${match[0].trim()}${funcCode}`,
          type: 'arrow',
        })
      }
    }

    return Array.from(functions.values())
  }

  /**
   * 提取函数体（处理嵌套括号）
   */
  function extractFunctionBody(code, startIndex, openChar) {
    const closeChar = openChar === '{' ? '}' : openChar === '(' ? ')' : ']'
    let depth = 0
    let inString = false
    let stringChar = ''
    let bodyStart = -1

    for (let i = startIndex; i < code.length; i++) {
      const char = code[i]
      const prevChar = i > 0 ? code[i - 1] : ''

      // 处理字符串
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
        }
        continue
      }

      if (inString) {continue}

      if (char === openChar) {
        if (depth === 0) {bodyStart = i}
        depth++
      } else if (char === closeChar) {
        depth--
        if (depth === 0 && bodyStart >= 0) {
          return code.substring(bodyStart, i + 1)
        }
      }
    }

    return null
  }

  /**
   * 提取箭头函数体
   */
  function extractArrowFunctionBody(code, startIndex) {
    const firstChar = code[startIndex]

    // 块体: { ... }
    if (firstChar === '{') {
      return extractFunctionBody(code, startIndex, '{')
    }

    // 表达式体: 找到分号或换行
    const end = startIndex
    let inString = false
    let stringChar = ''
    let parenDepth = 0

    for (let i = startIndex; i < code.length; i++) {
      const char = code[i]
      const prevChar = i > 0 ? code[i - 1] : ''

      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inString) {
          inString = true
          stringChar = char
        } else if (char === stringChar) {
          inString = false
        }
        continue
      }

      if (inString) {continue}

      if (char === '(') {parenDepth++}
      if (char === ')') {parenDepth--}

      if (char === ';' && parenDepth === 0) {
        return code.substring(startIndex, i)
      }

      if (char === '\n' && parenDepth === 0) {
        return code.substring(startIndex, i)
      }
    }

    return code.substring(startIndex)
  }

  /**
   * 生成注入脚本
   */
  function generateInjectionScript(functions) {
    const script = functions.map((fn) => fn.code).join('\n\n')
    return `
(function() {
  'use strict';
  ${script}
  console.log('[DevTools Tools] 已注入 ${functions.length} 个函数:', ${JSON.stringify(functions.map((f) => f.name))});
})();
`
  }

  // ========== 缓存管理 ==========
  const CACHE_KEY = 'devtools-loaded-libs'
  const CUSTOM_LIBS_KEY = 'devtools-custom-libs'

  function getCache() {
    try {
      const data = localStorage.getItem(CACHE_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  function saveCache(cache) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  }

  function addToCache(lib) {
    const cache = getCache()
    const existing = cache.findIndex((l) => l.id === lib.id && l.type === lib.type)
    if (existing >= 0) {
      cache[existing] = { ...lib, timestamp: Date.now() }
    } else {
      cache.push({ ...lib, timestamp: Date.now() })
    }
    saveCache(cache)
  }

  function removeFromCache(id, type) {
    const cache = getCache()
    const filtered = cache.filter((l) => !(l.id === id && l.type === type))
    saveCache(filtered)
    return filtered
  }

  function clearCache() {
    localStorage.removeItem(CACHE_KEY)
  }

  // ========== 自定义库管理 ==========

  /**
   * 获取自定义收藏的库
   */
  function getCustomLibs() {
    try {
      const data = localStorage.getItem(CUSTOM_LIBS_KEY)
      return data ? JSON.parse(data) : []
    } catch {
      return []
    }
  }

  /**
   * 保存自定义库列表
   */
  function saveCustomLibs(libs) {
    localStorage.setItem(CUSTOM_LIBS_KEY, JSON.stringify(libs))
  }

  /**
   * 添加到自定义库
   */
  function addToCustomLibs(lib) {
    const customLibs = getCustomLibs()
    // 检查是否已存在
    if (!customLibs.some((l) => l.id === lib.id)) {
      customLibs.push({
        id: lib.id,
        name: lib.name,
        description: lib.description || '自定义库',
        icon: lib.icon || '📦',
        cdn: lib.cdn || 'custom',
        version: lib.version || '',
        path: lib.path || '',
        global: lib.global || lib.name,
        url: lib.url || '',
        type: lib.type || 'cdn',
        isCustom: true,
      })
      saveCustomLibs(customLibs)
    }
    return customLibs
  }

  /**
   * 从自定义库中移除
   */
  function removeFromCustomLibs(id) {
    const customLibs = getCustomLibs()
    const filtered = customLibs.filter((l) => l.id !== id)
    saveCustomLibs(filtered)
    return filtered
  }

  /**
   * 获取所有库（预设 + 自定义）
   */
  function getAllLibraries() {
    const customLibs = getCustomLibs()
    return [...POPULAR_LIBRARIES, ...customLibs]
  }

  // ========== 导出 ==========
  window.LibraryConfig = {
    CDN_TEMPLATES,
    POPULAR_LIBRARIES,
    FUNCTION_PATTERNS,
    generateCDNUrl,
    extractFunctions,
    generateInjectionScript,
    getCache,
    addToCache,
    removeFromCache,
    clearCache,
    // 自定义库管理
    getCustomLibs,
    saveCustomLibs,
    addToCustomLibs,
    removeFromCustomLibs,
    getAllLibraries,
  }

  console.log('[LibraryConfig] 库配置已加载')
})()
