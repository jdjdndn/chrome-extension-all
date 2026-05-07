/**
 * DevTools Tools Panel 逻辑
 */

;(function () {
  'use strict'

  // ========== 状态管理 ==========
  const state = {
    currentTab: 'console-api',
    port: null,
    tabId: null,
    // 库加载器状态
    localFile: null,
    extractedFunctions: [],
    loadedLibs: [],
    // 控制台 API 代码段
    consoleSnippets: [],
  }

  // ========== 初始化 ==========
  async function init() {
    // 初始化 EventBus
    if (typeof EventBus !== 'undefined') {
      await EventBus.init()
    }

    // 获取当前 tabId
    state.tabId = chrome.devtools.inspectedWindow.tabId

    // 建立 Port 连接
    connectToBackground()

    // 加载保存的代码段
    loadConsoleSnippets()

    // 加载已缓存的库
    loadCachedLibs()

    // 初始化 UI
    initTabs()
    renderConsoleSnippets()
    renderPopularLibraries()
    renderLoadedLibs()

    // 绑定事件
    bindEvents()
    bindLibraryEvents()

    updateStatus('就绪')
  }

  // ========== Port 连接 ==========
  function connectToBackground() {
    try {
      state.port = chrome.runtime.connect({ name: 'devtools-tools-panel' })

      state.port.postMessage({
        type: 'REGISTER_TOOLS_PANEL',
        tabId: state.tabId,
      })

      state.port.onMessage.addListener(handleBackgroundMessage)

      state.port.onDisconnect.addListener(() => {
        state.port = null
        setTimeout(connectToBackground, 1000)
      })
    } catch (e) {
      console.error('[ToolsPanel] Port 连接失败:', e)
    }
  }

  function handleBackgroundMessage(message) {
    console.log('[ToolsPanel] 收到消息:', message)
  }

  // ========== 控制台 API 代码段管理 ==========

  /**
   * 加载保存的代码段
   */
  function loadConsoleSnippets() {
    const saved = localStorage.getItem('devtools-console-snippets')
    if (saved) {
      try {
        state.consoleSnippets = JSON.parse(saved)
      } catch (e) {
        state.consoleSnippets = []
      }
    }
  }

  /**
   * 保存代码段
   */
  function saveConsoleSnippets() {
    localStorage.setItem('devtools-console-snippets', JSON.stringify(state.consoleSnippets))
  }

  /**
   * 解析代码中的函数名和 JSDoc 注释
   * @param {string} code 代码字符串
   * @returns {Array<{name: string, description: string}>} 函数列表
   */
  function parseFunctions(code) {
    const functions = []

    // 匹配 JSDoc 注释 + 函数声明的模式
    // 模式1: /** JSDoc */ function name() {}
    const funcWithJsdoc = /\/\*\*([\s\S]*?)\*\/\s*(?:async\s+)?function\s+(\w+)\s*\(/g

    // 模式2: function name() {} (无注释)
    const funcNoJsdoc = /(?<!\/\*\*[\s\S]*?\*\/\s*)(?:async\s+)?function\s+(\w+)\s*\(/g

    // 模式3: /** JSDoc */ const name = () => {} 或 const name = function() {}
    const arrowWithJsdoc =
      /\/\*\*([\s\S]*?)\*\/\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/g

    // 模式4: const name = () => {} (无注释)
    const arrowNoJsdoc =
      /(?<!\/\*\*[\s\S]*?\*\/\s*)(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)|[^=])\s*=>/g

    let match

    // 解析带 JSDoc 的函数声明
    while ((match = funcWithJsdoc.exec(code)) !== null) {
      const jsdocContent = match[1].trim()
      const description = parseJsdocDescription(jsdocContent)
      functions.push({
        name: match[2],
        description: description,
      })
    }

    // 解析不带 JSDoc 的函数声明（避免重复）
    const processedNames = new Set(functions.map((f) => f.name))
    while ((match = funcNoJsdoc.exec(code)) !== null) {
      if (!processedNames.has(match[1])) {
        functions.push({
          name: match[1],
          description: '',
        })
        processedNames.add(match[1])
      }
    }

    // 解析带 JSDoc 的箭头函数
    while ((match = arrowWithJsdoc.exec(code)) !== null) {
      const jsdocContent = match[1].trim()
      const description = parseJsdocDescription(jsdocContent)
      if (!processedNames.has(match[2])) {
        functions.push({
          name: match[2],
          description: description,
        })
        processedNames.add(match[2])
      }
    }

    // 解析不带 JSDoc 的箭头函数
    while ((match = arrowNoJsdoc.exec(code)) !== null) {
      if (!processedNames.has(match[1])) {
        functions.push({
          name: match[1],
          description: '',
        })
        processedNames.add(match[1])
      }
    }

    return functions
  }

  /**
   * 解析 JSDoc 注释内容
   * @param {string} jsdocContent JSDoc 内容（不含注释标记）
   * @returns {string} 提取的描述文本
   */
  function parseJsdocDescription(jsdocContent) {
    // 移除每行开头的 * 和空格
    const lines = jsdocContent
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, '').trim())
      .filter((line) => line && !line.startsWith('@'))

    // 返回完整的描述（多行）
    return lines.join('\n')
  }

  /**
   * 添加代码到控制台
   */
  async function addToConsole() {
    const code = document.getElementById('code-editor').value.trim()

    if (!code) {
      updateStatus('请输入代码')
      return
    }

    updateStatus('正在添加...')

    try {
      // 解析函数
      const functions = parseFunctions(code)

      // 注入代码到页面全局
      await executeCode(code)

      // 保存到列表
      const snippet = {
        id: 'snippet-' + Date.now(),
        code: code,
        functions: functions,
        createdAt: Date.now(),
      }

      state.consoleSnippets.push(snippet)
      saveConsoleSnippets()
      renderConsoleSnippets()

      // 清空编辑区
      document.getElementById('code-editor').value = ''

      const funcNames = functions.map((f) => f.name).join(', ')
      updateStatus(`已添加 ${functions.length} 个函数: ${funcNames || '(无函数)'}`)
    } catch (e) {
      updateStatus('添加失败: ' + e.message)
    }
  }

  /**
   * 重新注入代码到控制台
   */
  async function reinjectSnippet(id) {
    const snippet = state.consoleSnippets.find((s) => s.id === id)
    if (!snippet) return

    updateStatus('正在重新注入...')

    try {
      await executeCode(snippet.code)
      const funcNames = snippet.functions.map((f) => f.name).join(', ')
      updateStatus(`已重新注入: ${funcNames}`)
    } catch (e) {
      updateStatus('注入失败: ' + e.message)
    }
  }

  /**
   * 编辑代码段
   */
  function editConsoleSnippet(id) {
    const snippet = state.consoleSnippets.find((s) => s.id === id)
    if (!snippet) return

    // 加载到编辑区
    document.getElementById('code-editor').value = snippet.code

    // 从列表中移除
    state.consoleSnippets = state.consoleSnippets.filter((s) => s.id !== id)
    saveConsoleSnippets()
    renderConsoleSnippets()

    updateStatus('已加载到编辑区，修改后请重新添加')
  }

  /**
   * 删除代码段
   */
  function deleteConsoleSnippet(id) {
    if (!confirm('确定要删除这个代码段吗？\n注意：已注入到页面的函数不会被移除。')) {
      return
    }

    state.consoleSnippets = state.consoleSnippets.filter((s) => s.id !== id)
    saveConsoleSnippets()
    renderConsoleSnippets()
    updateStatus('已删除')
  }

  /**
   * 渲染代码段列表
   */
  function renderConsoleSnippets() {
    const container = document.getElementById('console-snippets-list')

    if (state.consoleSnippets.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="icon">📝</div>
          <div>暂无已添加的代码段</div>
          <div style="font-size: 11px; color: #999; margin-top: 4px;">在上方编辑器输入代码后点击"添加到控制台"</div>
        </div>
      `
      return
    }

    container.innerHTML = state.consoleSnippets
      .map((snippet) => {
        const funcHtml = snippet.functions
          .map(
            (f) => `
        <div class="console-snippet-func">
          📄 ${escapeHtml(f.name)}
          ${f.description ? `<span style="color: #666; margin-left: 4px;">- ${escapeHtml(f.description).replace(/\n/g, '<br>')}</span>` : ''}
        </div>
      `
          )
          .join('')

        const noFuncHtml =
          snippet.functions.length === 0
            ? '<div class="console-snippet-func" style="color: #999;">(无可识别的函数)</div>'
            : ''

        return `
        <div class="console-snippet-item" data-id="${snippet.id}">
          <div class="console-snippet-header">
            <div class="console-snippet-info">
              <div class="console-snippet-functions">
                ${funcHtml || noFuncHtml}
              </div>
            </div>
            <div class="console-snippet-actions">
              <button onclick="reinjectSnippet('${snippet.id}')" title="重新注入到控制台">注入</button>
              <button onclick="editConsoleSnippet('${snippet.id}')">编辑</button>
              <button class="delete" onclick="deleteConsoleSnippet('${snippet.id}')">删除</button>
            </div>
          </div>
          <div class="console-snippet-code">${escapeHtml(snippet.code)}</div>
        </div>
      `
      })
      .join('')

    // 绑定展开/收起
    container.querySelectorAll('.console-snippet-header').forEach((header) => {
      header.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') return
        header.parentElement.classList.toggle('expanded')
      })
    })
  }

  // ========== 标签页切换 ==========

  function initTabs() {
    document.querySelectorAll('.sidebar-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab

        // 更新标签状态
        document.querySelectorAll('.sidebar-tab').forEach((t) => t.classList.remove('active'))
        tab.classList.add('active')

        // 更新内容
        document.querySelectorAll('.tab-content').forEach((c) => c.classList.remove('active'))
        document.getElementById(tabId).classList.add('active')

        state.currentTab = tabId
        document.getElementById('current-tab-name').textContent =
          tab.querySelector('.label').textContent
      })
    })
  }

  // ========== 事件绑定 ==========

  function bindEvents() {
    // 添加到控制台
    document.getElementById('add-to-console').addEventListener('click', () => {
      addToConsole()
    })

    // 清空编辑区
    document.getElementById('clear-editor').addEventListener('click', () => {
      document.getElementById('code-editor').value = ''
      updateStatus('已清空')
    })
  }

  // ========== 执行代码 ==========

  async function executeCode(code) {
    return new Promise((resolve, reject) => {
      chrome.devtools.inspectedWindow.eval(code, (result, error) => {
        if (error) {
          reject(new Error(error.value || error.description || '执行失败'))
        } else {
          resolve(result)
        }
      })
    })
  }

  // ========== 全局函数 ==========

  window.reinjectSnippet = reinjectSnippet
  window.editConsoleSnippet = editConsoleSnippet
  window.deleteConsoleSnippet = deleteConsoleSnippet

  // ========== 库加载器功能 ==========

  /**
   * 加载缓存的库
   */
  function loadCachedLibs() {
    if (typeof LibraryConfig !== 'undefined') {
      state.loadedLibs = LibraryConfig.getCache()
    }
  }

  /**
   * 渲染知名库列表
   */
  function renderPopularLibraries() {
    const container = document.getElementById('popular-libs')
    if (!container || typeof LibraryConfig === 'undefined') return

    const libs = LibraryConfig.getAllLibraries()
    container.innerHTML = libs
      .map((lib) => {
        const isLoaded = state.loadedLibs.some((l) => l.id === lib.id && l.type === 'cdn')
        const isCustom = lib.isCustom
        return `
        <div class="library-item ${isLoaded ? 'loaded' : ''} ${isCustom ? 'custom' : ''}" data-lib-id="${lib.id}" data-is-custom="${isCustom}">
          <div class="lib-icon">${lib.icon}</div>
          <div class="lib-name">${lib.name}${isCustom ? ' ⭐' : ''}</div>
          <div class="lib-desc">${lib.description}</div>
        </div>
      `
      })
      .join('')

    // 绑定点击事件
    container.querySelectorAll('.library-item').forEach((item) => {
      item.addEventListener('click', () => {
        const libId = item.dataset.libId
        loadPopularLibrary(libId)
      })
    })
  }

  /**
   * 渲染已加载库列表
   */
  function renderLoadedLibs() {
    const container = document.getElementById('loaded-libs-list')
    if (!container) return

    if (state.loadedLibs.length === 0) {
      container.innerHTML = '<div style="color:#666; font-size:11px;">暂无已加载的库</div>'
      return
    }

    container.innerHTML = state.loadedLibs
      .map(
        (lib) => `
      <div class="loaded-lib-item">
        <div class="lib-info">
          <span class="lib-type ${lib.type}">${lib.type === 'cdn' ? 'CDN' : '本地'}</span>
          <span>${lib.name}${lib.version ? '@' + lib.version : ''}</span>
          ${lib.functions ? `<span style="color:#666;">(${lib.functions.length}个函数)</span>` : ''}
        </div>
        <div class="lib-actions">
          <button class="save-btn" data-id="${lib.id}" data-name="${lib.name}" data-version="${lib.version || ''}" data-cdn="${lib.cdn || ''}" data-url="${lib.url || ''}" data-global="${lib.global || ''}" title="保存到快捷访问">⭐</button>
          <button class="unload-btn" data-id="${lib.id}" data-type="${lib.type}">卸载</button>
        </div>
      </div>
    `
      )
      .join('')

    // 绑定收藏事件
    container.querySelectorAll('.save-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const libInfo = {
          id: btn.dataset.id,
          name: btn.dataset.name,
          version: btn.dataset.version,
          cdn: btn.dataset.cdn,
          url: btn.dataset.url,
          global: btn.dataset.global,
        }
        saveToQuickAccess(libInfo)
      })
    })

    // 绑定卸载事件
    container.querySelectorAll('.unload-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id
        const type = btn.dataset.type
        unloadLibrary(id, type)
      })
    })
  }

  /**
   * 保存到快捷访问
   */
  function saveToQuickAccess(libInfo) {
    if (typeof LibraryConfig === 'undefined') {
      updateLibResult('LibraryConfig 未加载', 'error')
      return
    }

    // 检查是否已存在
    const allLibs = LibraryConfig.getAllLibraries()
    if (allLibs.some((l) => l.id === libInfo.id)) {
      updateLibResult(`${libInfo.name} 已在快捷访问列表中`, 'error')
      return
    }

    // 添加到自定义库
    LibraryConfig.addToCustomLibs({
      id: libInfo.id,
      name: libInfo.name,
      description: '自定义收藏',
      icon: '📦',
      cdn: libInfo.cdn || 'custom',
      version: libInfo.version || '',
      path: '',
      global: libInfo.global || libInfo.name,
      url: libInfo.url || '',
    })

    renderPopularLibraries()
    updateLibResult(`${libInfo.name} 已添加到快捷访问`, 'success')
  }

  /**
   * 绑定库加载器事件
   */
  function bindLibraryEvents() {
    // 选择本地文件
    document.getElementById('select-file-btn').addEventListener('click', () => {
      document.getElementById('local-file-input').click()
    })

    // 文件选择变化
    document.getElementById('local-file-input').addEventListener('change', (e) => {
      const file = e.target.files[0]
      if (file) {
        state.localFile = file
        document.getElementById('selected-file-name').textContent = file.name
        document.getElementById('extract-functions-btn').disabled = false
        document.getElementById('inject-local-btn').disabled = false
        // 重置提取结果
        state.extractedFunctions = []
        document.getElementById('extracted-functions').style.display = 'none'
      }
    })

    // 提取函数
    document.getElementById('extract-functions-btn').addEventListener('click', () => {
      extractLocalFunctions()
    })

    // 注入本地函数
    document.getElementById('inject-local-btn').addEventListener('click', () => {
      injectLocalFunctions()
    })

    // 加载远程库
    document.getElementById('load-remote-btn').addEventListener('click', () => {
      loadRemoteLibrary()
    })

    // 加载 URL
    document.getElementById('load-url-btn').addEventListener('click', () => {
      loadFromUrl()
    })

    // 清空缓存
    document.getElementById('clear-cache-btn').addEventListener('click', () => {
      if (confirm('确定要清空所有已加载库的缓存吗？')) {
        if (typeof LibraryConfig !== 'undefined') {
          LibraryConfig.clearCache()
        }
        state.loadedLibs = []
        renderLoadedLibs()
        renderPopularLibraries()
        updateLibResult('已清空缓存', 'success')
      }
    })
  }

  /**
   * 加载知名库
   */
  async function loadPopularLibrary(libId) {
    if (typeof LibraryConfig === 'undefined') {
      updateLibResult('LibraryConfig 未加载', 'error')
      return
    }

    const lib = LibraryConfig.getAllLibraries().find((l) => l.id === libId)
    if (!lib) {
      updateLibResult('未找到库配置', 'error')
      return
    }

    // 检查是否已加载
    if (state.loadedLibs.some((l) => l.id === libId && l.type === 'cdn')) {
      updateLibResult(`${lib.name} 已加载`, 'error')
      return
    }

    updateStatus(`正在加载 ${lib.name}...`)

    // 生成 URL：优先使用自定义 URL，否则使用 CDN 模板
    let url
    if (lib.url) {
      url = lib.url
    } else {
      url = LibraryConfig.generateCDNUrl(lib)
    }

    try {
      await injectScript(url, lib.global)
      // 添加到缓存
      const libInfo = {
        id: lib.id,
        name: lib.name,
        type: 'cdn',
        version: lib.version,
        cdn: lib.cdn,
        global: lib.global,
      }
      state.loadedLibs.push(libInfo)
      if (typeof LibraryConfig !== 'undefined') {
        LibraryConfig.addToCache(libInfo)
      }
      renderLoadedLibs()
      renderPopularLibraries()
      updateLibResult(
        `${lib.name} 加载成功!\nCDN: ${lib.cdn}\n版本: ${lib.version}\n全局变量: ${lib.global}\n\n在控制台输入 ${lib.global} 或 window.${lib.global} 使用`,
        'success'
      )
      updateStatus('加载成功')
    } catch (e) {
      updateLibResult(`加载失败: ${e.message}`, 'error')
      updateStatus('加载失败')
    }
  }

  /**
   * 提取本地文件函数
   */
  async function extractLocalFunctions() {
    if (!state.localFile || typeof LibraryConfig === 'undefined') {
      updateLibResult('请先选择文件', 'error')
      return
    }

    updateStatus('正在提取函数...')

    try {
      const code = await readFileContent(state.localFile)
      state.extractedFunctions = LibraryConfig.extractFunctions(code)

      if (state.extractedFunctions.length === 0) {
        document.getElementById('extracted-functions').style.display = 'none'
        updateLibResult('未找到可提取的函数', 'error')
        return
      }

      // 显示提取结果
      document.getElementById('extracted-functions').style.display = 'block'
      document.getElementById('func-count').textContent = state.extractedFunctions.length
      document.getElementById('func-list').textContent = state.extractedFunctions
        .map((f) => f.name)
        .join(', ')

      updateLibResult(`提取到 ${state.extractedFunctions.length} 个函数`, 'success')
      updateStatus('提取完成')
    } catch (e) {
      updateLibResult(`提取失败: ${e.message}`, 'error')
      updateStatus('提取失败')
    }
  }

  /**
   * 注入本地函数到全局
   */
  async function injectLocalFunctions() {
    if (!state.localFile) {
      updateLibResult('请先选择文件', 'error')
      return
    }

    // 如果还没有提取函数，先提取
    if (state.extractedFunctions.length === 0) {
      await extractLocalFunctions()
      if (state.extractedFunctions.length === 0) return
    }

    updateStatus('正在注入函数...')

    try {
      const script = LibraryConfig.generateInjectionScript(state.extractedFunctions)
      await executeCode(script)

      // 添加到缓存
      const libInfo = {
        id: 'local-' + Date.now(),
        name: state.localFile.name,
        type: 'local',
        functions: state.extractedFunctions.map((f) => f.name),
      }
      state.loadedLibs.push(libInfo)
      if (typeof LibraryConfig !== 'undefined') {
        LibraryConfig.addToCache(libInfo)
      }
      renderLoadedLibs()

      updateLibResult(
        `成功注入 ${state.extractedFunctions.length} 个函数到全局\n${state.extractedFunctions.map((f) => f.name).join(', ')}`,
        'success'
      )
      updateStatus('注入成功')
    } catch (e) {
      updateLibResult(`注入失败: ${e.message}`, 'error')
      updateStatus('注入失败')
    }
  }

  /**
   * 加载远程库
   */
  async function loadRemoteLibrary() {
    const name = document.getElementById('remote-lib-name').value.trim()
    const cdn = document.getElementById('cdn-select').value
    const version = document.getElementById('lib-version').value.trim() || 'latest'

    if (!name) {
      updateLibResult('请输入库名', 'error')
      return
    }

    updateStatus(`正在加载 ${name}...`)

    // 构建 URL
    let url
    if (name.startsWith('http://') || name.startsWith('https://')) {
      url = name
    } else {
      const lib = { id: name, cdn, version, path: '' }
      const cdnConfig = LibraryConfig.CDN_TEMPLATES[cdn]

      if (cdn === 'esm') {
        url = `https://esm.run/${name}@${version}`
      } else {
        // 尝试常见路径
        url = cdnConfig.template
          .replace('{name}', name)
          .replace('{version}', version)
          .replace('{path}', `dist/${name}.min.js`)
      }
    }

    try {
      await injectScript(url, name)
      const libInfo = {
        id: name,
        name: name,
        type: 'cdn',
        version: version,
        cdn: cdn,
      }
      state.loadedLibs.push(libInfo)
      if (typeof LibraryConfig !== 'undefined') {
        LibraryConfig.addToCache(libInfo)
      }
      renderLoadedLibs()
      updateLibResult(`${name} 加载成功!\nURL: ${url}`, 'success')
      updateStatus('加载成功')
    } catch (e) {
      updateLibResult(`加载失败: ${e.message}`, 'error')
      updateStatus('加载失败')
    }
  }

  /**
   * 从 URL 加载
   */
  async function loadFromUrl() {
    const input = document.getElementById('remote-lib-name').value.trim()

    if (!input || (!input.startsWith('http://') && !input.startsWith('https://'))) {
      updateLibResult('请输入有效的 URL', 'error')
      return
    }

    updateStatus('正在加载 URL...')

    try {
      await injectScript(input, 'custom')
      const libInfo = {
        id: 'url-' + Date.now(),
        name: input.split('/').pop() || 'custom',
        type: 'cdn',
        url: input,
      }
      state.loadedLibs.push(libInfo)
      if (typeof LibraryConfig !== 'undefined') {
        LibraryConfig.addToCache(libInfo)
      }
      renderLoadedLibs()
      updateLibResult(`URL 加载成功!\n${input}`, 'success')
      updateStatus('加载成功')
    } catch (e) {
      updateLibResult(`加载失败: ${e.message}`, 'error')
      updateStatus('加载失败')
    }
  }

  /**
   * 卸载库
   */
  function unloadLibrary(id, type) {
    state.loadedLibs = state.loadedLibs.filter((l) => !(l.id === id && l.type === type))
    if (typeof LibraryConfig !== 'undefined') {
      LibraryConfig.removeFromCache(id, type)
    }
    renderLoadedLibs()
    renderPopularLibraries()
    updateLibResult(`已卸载: ${id}`, 'success')
  }

  /**
   * 注入脚本到页面
   */
  function injectScript(url, globalName) {
    return new Promise((resolve, reject) => {
      const script = `
        (function() {
          if (window.${globalName}) {
            console.log('[DevTools Tools] ${globalName} 已存在');
            return;
          }
          var script = document.createElement('script');
          script.src = '${url}';
          script.onload = function() {
            console.log('[DevTools Tools] ${globalName} 加载完成, window.${globalName} =', typeof window.${globalName});
          };
          script.onerror = function() {
            console.error('[DevTools Tools] ${globalName} 加载失败');
          };
          document.head.appendChild(script);
        })();
      `

      chrome.devtools.inspectedWindow.eval(script, (result, error) => {
        if (error) {
          reject(new Error(error.value || error))
        } else {
          // 等待脚本加载并验证
          verifyGlobalVar(globalName, 10, 200).then(resolve).catch(reject)
        }
      })
    })
  }

  /**
   * 验证全局变量是否已加载
   */
  function verifyGlobalVar(globalName, maxRetries, interval) {
    return new Promise((resolve, reject) => {
      let retries = 0

      function check() {
        chrome.devtools.inspectedWindow.eval(`typeof window.${globalName}`, (result, error) => {
          if (error) {
            reject(new Error('检查失败'))
            return
          }

          if (result !== 'undefined') {
            resolve(true)
          } else {
            retries++
            if (retries < maxRetries) {
              setTimeout(check, interval)
            } else {
              reject(new Error('加载超时，请检查网络或 CDN 地址'))
            }
          }
        })
      }

      setTimeout(check, interval)
    })
  }

  /**
   * 读取文件内容
   */
  function readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = (e) => reject(new Error('读取文件失败'))
      reader.readAsText(file)
    })
  }

  /**
   * 更新库加载器结果
   */
  function updateLibResult(text, type = '') {
    updateResult('lib-result', text, type)
  }

  // ========== 工具函数 ==========

  function updateResult(elementId, text, type = '') {
    const el = document.getElementById(elementId)
    if (el) {
      el.textContent = text
      el.className = 'result-area ' + type
    }
  }

  function updateStatus(text) {
    document.getElementById('status-text').textContent = text
  }

  function escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  // ========== 启动 ==========
  init()
})()
