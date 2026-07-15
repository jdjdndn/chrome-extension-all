/**
 * Background service worker (background.js) tests
 *
 * Tests cover:
 *  - Port connection management (onConnect)
 *  - Message handling (onMessage)
 *  - Tab lifecycle events (onRemoved, onUpdated)
 *  - Extension lifecycle (onInstalled, onStartup)
 *  - Listener registration
 *  - Edge cases
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flush the microtask / promise queue so async handleMessage can complete. */
async function flushPromises(rounds = 5) {
  for (let i = 0; i < rounds; i++) {
    await new Promise((r) => setTimeout(r, 0))
  }
}

function createMockPort(name: string) {
  const messageListeners: Function[] = []
  const disconnectListeners: Function[] = []
  return {
    name,
    postMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn((fn: Function) => messageListeners.push(fn)),
    },
    onDisconnect: {
      addListener: vi.fn((fn: Function) => disconnectListeners.push(fn)),
    },
    _fireMessage(msg: any) {
      messageListeners.forEach((fn) => fn(msg))
    },
    _fireDisconnect() {
      disconnectListeners.forEach((fn) => fn())
    },
  }
}

// ---------------------------------------------------------------------------
// Chrome API mock
// ---------------------------------------------------------------------------
function createChromeMock() {
  const onConnectListeners: Function[] = []
  const onMessageListeners: Function[] = []
  const onInstalledListeners: Function[] = []
  const onStartupListeners: Function[] = []
  const onTabRemovedListeners: Function[] = []
  const onTabUpdatedListeners: Function[] = []
  const onTabActivatedListeners: Function[] = []
  const onStorageChangedListeners: Function[] = []
  const onFocusChangedListeners: Function[] = []
  const onContextMenuClickedListeners: Function[] = []

  return {
    runtime: {
      id: 'test-extension-id',
      onConnect: { addListener: vi.fn((fn: Function) => onConnectListeners.push(fn)) },
      onMessage: { addListener: vi.fn((fn: Function) => onMessageListeners.push(fn)) },
      onInstalled: { addListener: vi.fn((fn: Function) => onInstalledListeners.push(fn)) },
      onStartup: { addListener: vi.fn((fn: Function) => onStartupListeners.push(fn)) },
      sendMessage: vi.fn(),
      getManifest: vi.fn(() => ({ name: 'Test Extension', version: '1.0.0' })),
      lastError: null as any,
    },
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      create: vi.fn(),
      onRemoved: { addListener: vi.fn((fn: Function) => onTabRemovedListeners.push(fn)) },
      onUpdated: { addListener: vi.fn((fn: Function) => onTabUpdatedListeners.push(fn)) },
      onActivated: { addListener: vi.fn((fn: Function) => onTabActivatedListeners.push(fn)) },
    },
    storage: {
      sync: { get: vi.fn().mockResolvedValue({}), set: vi.fn().mockResolvedValue(undefined) },
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
        remove: vi.fn().mockResolvedValue(undefined),
        clear: vi.fn().mockResolvedValue(undefined),
      },
      onChanged: { addListener: vi.fn((fn: Function) => onStorageChangedListeners.push(fn)) },
    },
    windows: {
      getCurrent: vi.fn().mockResolvedValue({ width: 1920, height: 1080, left: 0, top: 0 }),
      create: vi.fn().mockResolvedValue({}),
      onFocusChanged: { addListener: vi.fn((fn: Function) => onFocusChangedListeners.push(fn)) },
      WINDOW_ID_NONE: -1,
    },
    scripting: {
      executeScript: vi.fn().mockResolvedValue([{ result: false }]),
    },
    declarativeNetRequest: {
      getDynamicRules: vi.fn().mockResolvedValue([]),
      updateDynamicRules: vi.fn().mockResolvedValue(undefined),
      onRuleMatchedDebug: { addListener: vi.fn() },
    },
    downloads: {
      download: vi.fn((_opts: any, cb: Function) => cb(42)),
    },
    contextMenus: {
      create: vi.fn(),
      onClicked: { addListener: vi.fn((fn: Function) => onContextMenuClickedListeners.push(fn)) },
    },
    notifications: { create: vi.fn() },
    cookies: {
      getAll: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
    },
    browsingData: { remove: vi.fn().mockResolvedValue(undefined) },
    // Test-only listener accessors
    _listeners: {
      onConnect: onConnectListeners,
      onMessage: onMessageListeners,
      onInstalled: onInstalledListeners,
      onStartup: onStartupListeners,
      onTabRemoved: onTabRemovedListeners,
      onTabUpdated: onTabUpdatedListeners,
      onTabActivated: onTabActivatedListeners,
      onStorageChanged: onStorageChangedListeners,
      onFocusChanged: onFocusChangedListeners,
      onContextMenuClicked: onContextMenuClickedListeners,
    },
  }
}

// ---------------------------------------------------------------------------
// Module loading
// ---------------------------------------------------------------------------
let chromeMock: ReturnType<typeof createChromeMock>
const selfListeners: Record<string, Function[]> = { install: [], activate: [] }

function setupGlobals() {
  chromeMock = createChromeMock()
  // @ts-ignore
  globalThis.chrome = chromeMock
  // @ts-ignore
  globalThis.self = {
    importScripts: vi.fn(),
    addEventListener: vi.fn((event: string, fn: Function) => {
      if (!selfListeners[event]) selfListeners[event] = []
      selfListeners[event].push(fn)
    }),
    skipWaiting: vi.fn(),
    registerJSRedirectRules: undefined,
  }
  // @ts-ignore
  globalThis.clients = { claim: vi.fn() }
  // @ts-ignore
  globalThis.EventBus = undefined
}

async function loadBackground() {
  vi.resetModules()
  setupGlobals()
  await import('../background.js')
  // Allow the top-level initialize() promise to resolve
  await flushPromises(10)
  return chromeMock
}

/**
 * Fire an onMessage listener and wait for the returned promise (handleMessage is async).
 * The onMessage listener returns `true` and calls handleMessage() which returns a Promise.
 * We capture that Promise so tests can properly await async message handling.
 */
async function fireMessage(mock: ReturnType<typeof createChromeMock>, msg: any, sender: any = {}) {
  const sendResponse = vi.fn()
  for (const fn of mock._listeners.onMessage) {
    const result = fn(msg, sender, sendResponse)
    // If the handler returns a promise, wait for it
    if (result && typeof result.then === 'function') {
      await result
    }
  }
  // Also flush remaining microtasks
  await flushPromises(3)
  return sendResponse
}

// ===========================================================================
// TESTS
// ===========================================================================
describe('background.js service worker', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.resetModules()
    // @ts-ignore
    delete globalThis.chrome
    // @ts-ignore
    delete globalThis.EventBus
    // @ts-ignore
    delete globalThis._pickerMessages
    // @ts-ignore
    delete globalThis._aiAggregatorTabId
  })

  // =========================================================================
  // 1. Port connection management
  // =========================================================================
  describe('Port connection management', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    // -- DevTools panel --
    describe('DevTools panel port (devtools-panel)', () => {
      it('should register a devtools port on REGISTER_DEVTOOLS message', () => {
        const port = createMockPort('devtools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))

        expect(port.onMessage.addListener).toHaveBeenCalled()
        expect(port.onDisconnect.addListener).toHaveBeenCalled()

        // Register + disconnect should not throw
        port._fireMessage({ type: 'REGISTER_DEVTOOLS', tabId: 42 })
        port._fireDisconnect()
      })

      it('should forward EventBus messages when __eventbus__ flag and EventBus exist', () => {
        const handleMsg = vi.fn()
        // @ts-ignore
        globalThis.EventBus = { _handleMessage: handleMsg }

        const port = createMockPort('devtools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))

        port._fireMessage({ __eventbus__: true, type: 'SOME_EVENT', tabId: 10 })
        expect(handleMsg).toHaveBeenCalledWith(
          { __eventbus__: true, type: 'SOME_EVENT', tabId: 10 },
          { tabId: 10 }
        )
      })

      it('should NOT crash forwarding EventBus messages when EventBus is undefined', () => {
        const port = createMockPort('devtools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))
        expect(() =>
          port._fireMessage({ __eventbus__: true, type: 'X', tabId: 1 })
        ).not.toThrow()
      })

      it('should register port to EventBus.Transport when available', () => {
        const registerPort = vi.fn()
        // @ts-ignore
        globalThis.EventBus = { Transport: { registerPort } }

        const port = createMockPort('devtools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))
        port._fireMessage({ type: 'REGISTER_DEVTOOLS', tabId: 55 })

        expect(registerPort).toHaveBeenCalledWith(55, port)
      })
    })

    // -- Tools panel --
    describe('Tools panel port (devtools-tools-panel)', () => {
      it('should register a tools panel port on REGISTER_TOOLS_PANEL', () => {
        const port = createMockPort('devtools-tools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))

        expect(port.onMessage.addListener).toHaveBeenCalled()
        expect(port.onDisconnect.addListener).toHaveBeenCalled()

        port._fireMessage({ type: 'REGISTER_TOOLS_PANEL', tabId: 99 })
        port._fireDisconnect()
      })

      it('should register tools port to EventBus.Transport', () => {
        const registerPort = vi.fn()
        // @ts-ignore
        globalThis.EventBus = { Transport: { registerPort } }

        const port = createMockPort('devtools-tools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))
        port._fireMessage({ type: 'REGISTER_TOOLS_PANEL', tabId: 55 })

        expect(registerPort).toHaveBeenCalledWith(55, port)
      })

      it('should forward EventBus messages from tools panel', () => {
        const handleMsg = vi.fn()
        // @ts-ignore
        globalThis.EventBus = { _handleMessage: handleMsg }

        const port = createMockPort('devtools-tools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))

        port._fireMessage({ __eventbus__: true, type: 'BUS_EVENT', tabId: 77 })
        expect(handleMsg).toHaveBeenCalled()
      })
    })

    // -- Popup port --
    describe('Popup port (popup-port)', () => {
      it('should attach listeners when popup connects', () => {
        const port = createMockPort('popup-port')
        mock._listeners.onConnect.forEach((fn) => fn(port))

        expect(port.onMessage.addListener).toHaveBeenCalled()
        expect(port.onDisconnect.addListener).toHaveBeenCalled()
      })

      it('should handle REQUEST_PREHEAT_DATA message from popup', async () => {
        const port = createMockPort('popup-port')
        mock.storage.sync.get.mockResolvedValue({ cy_settings: { enabled: true } })
        mock.storage.local.get.mockResolvedValue({ extensionStats: {} })
        mock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com' }])

        mock._listeners.onConnect.forEach((fn) => fn(port))
        port._fireMessage({ type: 'REQUEST_PREHEAT_DATA' })

        await flushPromises()

        const calls = port.postMessage.mock.calls
        const preheatCall = calls.find((c: any) => c[0]?.type === 'POPUP_PREHEAT_DATA')
        expect(preheatCall).toBeDefined()
      })
    })

    // -- Disconnection cleanup --
    describe('Port disconnection cleanup', () => {
      it('should remove devtools port on disconnect', () => {
        const port = createMockPort('devtools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))
        port._fireMessage({ type: 'REGISTER_DEVTOOLS', tabId: 100 })
        expect(() => port._fireDisconnect()).not.toThrow()
      })

      it('should remove tools panel port on disconnect', () => {
        const port = createMockPort('devtools-tools-panel')
        mock._listeners.onConnect.forEach((fn) => fn(port))
        port._fireMessage({ type: 'REGISTER_TOOLS_PANEL', tabId: 200 })
        expect(() => port._fireDisconnect()).not.toThrow()
      })

      it('should handle popup disconnect gracefully', () => {
        const port = createMockPort('popup-port')
        mock._listeners.onConnect.forEach((fn) => fn(port))
        expect(() => port._fireDisconnect()).not.toThrow()
      })
    })

    // -- Unknown port --
    it('should ignore ports with unknown names', () => {
      const port = createMockPort('unknown-port')
      expect(() => mock._listeners.onConnect.forEach((fn) => fn(port))).not.toThrow()
      expect(port.onMessage.addListener).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 2. Message handling (onMessage → handleMessage)
  // =========================================================================
  describe('Message handling (onMessage)', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    // -- EventBus passthrough --
    it('should skip EventBus-flagged messages', async () => {
      const sr = await fireMessage(mock, { __eventbus__: true, type: 'TEST' })
      expect(sr).not.toHaveBeenCalled()
    })

    // -- AI Aggregator --
    it('should register AI aggregator tab', async () => {
      const sr = await fireMessage(mock, { type: 'AIA_REGISTER_AGGREGATOR', tabId: 777 })
      expect(sr).toHaveBeenCalledWith({ success: true })
    })

    it('should forward _aiAggregator messages to registered tab', async () => {
      // @ts-ignore
      globalThis._aiAggregatorTabId = 777
      await fireMessage(mock, { _aiAggregator: true, type: 'AI_QUERY' })
      expect(mock.tabs.sendMessage).toHaveBeenCalledWith(
        777,
        expect.objectContaining({ _aiAggregator: true })
      )
    })

    // -- GET_DEBUG_MODE --
    it('should respond with debug mode state', async () => {
      const sr = await fireMessage(mock, { type: 'GET_DEBUG_MODE' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ enabled: expect.any(Boolean) })
      )
    })

    // -- SET_DEBUG_MODE --
    it('should update debug mode and reload settings', async () => {
      const sr = await fireMessage(mock, { type: 'SET_DEBUG_MODE', enabled: false })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    // -- GET_EXTENSION_INFO --
    it('should return extension info', async () => {
      mock.tabs.query.mockResolvedValue([{ url: 'https://example.com/page' }])
      const sr = await fireMessage(mock, { type: 'GET_EXTENSION_INFO' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Test Extension', version: '1.0.0', enabled: true })
      )
    })

    // -- GET_BLOCKED_DOMAINS --
    it('should return blocked domains', async () => {
      mock.tabs.query.mockResolvedValue([{ url: 'https://bilibili.com/video' }])
      const sr = await fireMessage(mock, { type: 'GET_BLOCKED_DOMAINS' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({
          currentDomain: 'bilibili.com',
          blockedDomains: expect.any(Array),
          blockedResponseDomains: expect.any(Array),
        })
      )
    })

    // -- REGISTER_BLOCKED_DOMAINS --
    it('should register blocked domains from content script', async () => {
      const sr = await fireMessage(mock, {
        type: 'REGISTER_BLOCKED_DOMAINS',
        domain: 'example.com',
        blockedDomains: ['ads.example.com'],
      })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should reject REGISTER_BLOCKED_DOMAINS with missing fields', async () => {
      const sr = await fireMessage(mock, { type: 'REGISTER_BLOCKED_DOMAINS' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.any(String) })
      )
    })

    // -- CHECK_DOMAIN_BLOCKED --
    it('should check if a domain is blocked (not blocked)', async () => {
      const sr = await fireMessage(mock, {
        type: 'CHECK_DOMAIN_BLOCKED',
        currentDomain: 'example.com',
        requestDomain: 'ads.net',
      })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ blocked: false }))
    })

    it('should return blocked=false when CHECK_DOMAIN_BLOCKED has missing fields', async () => {
      const sr = await fireMessage(mock, { type: 'CHECK_DOMAIN_BLOCKED' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ blocked: false, error: 'Missing domains' })
      )
    })

    // -- ADD / REMOVE_BLOCKED_DOMAIN --
    it('should add a blocked domain', async () => {
      mock.tabs.query.mockResolvedValue([{ url: 'https://example.com/page' }])
      const sr = await fireMessage(mock, { type: 'ADD_BLOCKED_DOMAIN', domain: 'ads.net' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, currentDomain: 'example.com' })
      )
    })

    it('should remove a previously added blocked domain', async () => {
      mock.tabs.query.mockResolvedValue([{ url: 'https://example.com/page' }])

      await fireMessage(mock, { type: 'ADD_BLOCKED_DOMAIN', domain: 'ads.net' })
      await flushPromises()

      const sr = await fireMessage(mock, { type: 'REMOVE_BLOCKED_DOMAIN', domain: 'ads.net' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    // -- ADD / REMOVE_BLOCKED_RESPONSE_DOMAIN --
    it('should add a blocked response domain', async () => {
      mock.tabs.query.mockResolvedValue([{ url: 'https://example.com/page' }])
      const sr = await fireMessage(mock, {
        type: 'ADD_BLOCKED_RESPONSE_DOMAIN',
        domain: 'tracker.net',
      })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should remove a blocked response domain', async () => {
      mock.tabs.query.mockResolvedValue([{ url: 'https://example.com/page' }])

      await fireMessage(mock, { type: 'ADD_BLOCKED_RESPONSE_DOMAIN', domain: 'tracker.net' })
      await flushPromises()

      const sr = await fireMessage(mock, {
        type: 'REMOVE_BLOCKED_RESPONSE_DOMAIN',
        domain: 'tracker.net',
      })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    // -- Mock rules --
    it('should register and retrieve mock rules', async () => {
      const sr1 = await fireMessage(mock, {
        type: 'REGISTER_MOCK',
        url: 'https://api.test.com/data',
        response: { ok: true },
      })
      await flushPromises()
      expect(sr1).toHaveBeenCalledWith(expect.objectContaining({ success: true }))

      const sr2 = await fireMessage(mock, { type: 'GET_MOCK_RULES' })
      await flushPromises()
      expect(sr2).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          rules: expect.objectContaining({ 'https://api.test.com/data': { ok: true } }),
        })
      )
    })

    it('should unregister a mock rule', async () => {
      await fireMessage(mock, { type: 'REGISTER_MOCK', url: 'https://api.test.com/x', response: 'yes' })
      await flushPromises()

      const sr = await fireMessage(mock, { type: 'UNREGISTER_MOCK', url: 'https://api.test.com/x' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should clear all mock rules', async () => {
      await fireMessage(mock, { type: 'REGISTER_MOCK', url: 'https://api.test.com/y', response: 1 })
      await flushPromises()

      const sr = await fireMessage(mock, { type: 'CLEAR_MOCK_RULES' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))

      const sr2 = await fireMessage(mock, { type: 'GET_MOCK_RULES' })
      await flushPromises()
      expect(sr2).toHaveBeenCalledWith(expect.objectContaining({ success: true, rules: {} }))
    })

    it('should reject REGISTER_MOCK with missing url', async () => {
      const sr = await fireMessage(mock, { type: 'REGISTER_MOCK', response: 'test' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.any(String) })
      )
    })

    it('should reject UNREGISTER_MOCK with missing url', async () => {
      const sr = await fireMessage(mock, { type: 'UNREGISTER_MOCK' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.any(String) })
      )
    })

    // -- GET_DOMAIN_SCRIPT_MAP --
    it('should return domain script map', async () => {
      const sr = await fireMessage(mock, { type: 'GET_DOMAIN_SCRIPT_MAP' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ domainScriptMap: expect.any(Object) })
      )
    })

    // -- Picker messages --
    it('should return filtered picker messages for a tab', async () => {
      // @ts-ignore
      globalThis._pickerMessages = {
        42: [
          { type: 'PICK', selector: '.foo', timestamp: 1000 },
          { type: 'PICK', selector: '.bar', timestamp: 2000 },
        ],
      }
      const sr = await fireMessage(mock, { type: 'GET_PICKER_MESSAGES', tabId: 42, since: 1500 })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          messages: [{ type: 'PICK', selector: '.bar', timestamp: 2000 }],
        })
      )
    })

    it('should clear picker messages', async () => {
      // @ts-ignore
      globalThis._pickerMessages = { 1: [{ type: 'x' }] }
      const sr = await fireMessage(mock, { type: 'CLEAR_PICKER_MESSAGES' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    // -- PICKER_MESSAGE_RELAY --
    it('should relay picker messages to DevTools port', async () => {
      const port = createMockPort('devtools-panel')
      mock._listeners.onConnect.forEach((fn) => fn(port))
      port._fireMessage({ type: 'REGISTER_DEVTOOLS', tabId: 10 })

      const sr = await fireMessage(
        mock,
        { type: 'PICKER_MESSAGE_RELAY', data: { type: 'PICK', selector: '.x' } },
        { tab: { id: 10 } }
      )
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should store picker messages when no DevTools port is available', async () => {
      const sr = await fireMessage(
        mock,
        { type: 'PICKER_MESSAGE_RELAY', data: { type: 'PICK', selector: '.y' } },
        { tab: { id: 999 } }
      )
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
      // @ts-ignore
      expect(globalThis._pickerMessages?.[999]).toBeDefined()
    })

    // -- ELEMENT_SELECTION_CHANGED --
    it('should forward element selection to DevTools port', async () => {
      const port = createMockPort('devtools-panel')
      mock._listeners.onConnect.forEach((fn) => fn(port))
      port._fireMessage({ type: 'REGISTER_DEVTOOLS', tabId: 5 })

      const sr = await fireMessage(
        mock,
        {
          type: 'ELEMENT_SELECTION_CHANGED',
          elements: [{ selector: '.btn', tagName: 'BUTTON' }],
        },
        { tab: { id: 5 } }
      )
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
      expect(port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'batch-selection-update',
          selectors: [{ selector: '.btn', tag: 'BUTTON' }],
        })
      )
    })

    // -- ELEMENT_PICKED --
    it('should respond success for ELEMENT_PICKED', async () => {
      const sr = await fireMessage(mock, { type: 'ELEMENT_PICKED', data: { selector: '.foo' } })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    // -- Stats --
    it('should return stats for GET_STATS', async () => {
      const sr = await fireMessage(mock, { type: 'GET_STATS' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          stats: expect.objectContaining({ totalBlocked: expect.any(Number) }),
        })
      )
    })

    it('should reset stats for RESET_STATS', async () => {
      const sr = await fireMessage(mock, { type: 'RESET_STATS' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should record hidden element stats', async () => {
      const sr = await fireMessage(mock, {
        type: 'RECORD_HIDDEN_ELEMENT',
        domain: 'example.com',
        count: 3,
      })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should reject RECORD_HIDDEN_ELEMENT with missing fields', async () => {
      const sr = await fireMessage(mock, { type: 'RECORD_HIDDEN_ELEMENT' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.any(String) })
      )
    })

    // -- Clipboard history --
    it('should record clipboard text', async () => {
      mock.storage.local.get.mockResolvedValue({ clipboardHistory: [] })
      const sr = await fireMessage(mock, { type: 'RECORD_CLIPBOARD', text: 'hello world' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
      expect(mock.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({ clipboardHistory: expect.any(Array) })
      )
    })

    it('should detect duplicate clipboard entries', async () => {
      mock.storage.local.get.mockResolvedValue({
        clipboardHistory: [{ text: 'hello world', timestamp: 1, url: '' }],
      })
      const sr = await fireMessage(mock, { type: 'RECORD_CLIPBOARD', text: 'hello world' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true, duplicate: true }))
    })

    it('should return clipboard history', async () => {
      const history = [{ text: 'abc', timestamp: 1, url: '' }]
      mock.storage.local.get.mockResolvedValue({ clipboardHistory: history })
      const sr = await fireMessage(mock, { type: 'GET_CLIPBOARD_HISTORY' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true, history }))
    })

    it('should clear clipboard history', async () => {
      const sr = await fireMessage(mock, { type: 'CLEAR_CLIPBOARD_HISTORY' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
      expect(mock.storage.local.set).toHaveBeenCalledWith({ clipboardHistory: [] })
    })

    it('should reject RECORD_CLIPBOARD without text', async () => {
      const sr = await fireMessage(mock, { type: 'RECORD_CLIPBOARD' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Missing text' })
      )
    })

    // -- Notifications --
    it('should add a notification', async () => {
      mock.storage.local.get.mockResolvedValue({ notifications: [] })
      const sr = await fireMessage(mock, { type: 'ADD_NOTIFICATION', message: 'Test notification' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should reject ADD_NOTIFICATION with missing message', async () => {
      const sr = await fireMessage(mock, { type: 'ADD_NOTIFICATION' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: expect.any(String) })
      )
    })

    it('should return notifications', async () => {
      const notifications = [{ message: 'hello', type: 'info', time: 1, read: false }]
      mock.storage.local.get.mockResolvedValue({ notifications })
      const sr = await fireMessage(mock, { type: 'GET_NOTIFICATIONS' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true, notifications }))
    })

    it('should mark notification as read', async () => {
      const notifications = [{ message: 'hello', type: 'info', time: 1, read: false }]
      mock.storage.local.get.mockResolvedValue({ notifications })
      const sr = await fireMessage(mock, { type: 'MARK_NOTIFICATION_READ', index: 0 })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
      expect(mock.storage.local.set).toHaveBeenCalled()
    })

    it('should clear notifications', async () => {
      const sr = await fireMessage(mock, { type: 'CLEAR_NOTIFICATIONS' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
      expect(mock.storage.local.set).toHaveBeenCalledWith({ notifications: [] })
    })

    // -- DOWNLOAD_FILE --
    it('should initiate a file download', async () => {
      mock.runtime.lastError = null
      mock.downloads.download.mockImplementation((_opts: any, cb: Function) => cb(42))
      const sr = await fireMessage(mock, {
        type: 'DOWNLOAD_FILE',
        url: 'https://example.com/file.zip',
        fileName: 'file.zip',
      })
      await flushPromises()
      expect(mock.downloads.download).toHaveBeenCalled()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true, downloadId: 42 }))
    })

    it('should handle download failure', async () => {
      mock.runtime.lastError = { message: 'Download failed' }
      mock.downloads.download.mockImplementation((_opts: any, cb: Function) => cb(null))
      const sr = await fireMessage(mock, {
        type: 'DOWNLOAD_FILE',
        url: 'https://example.com/bad',
        fileName: 'bad',
      })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: false }))
    })

    // -- EXTENSION_ACTIVATE --
    it('should forward EXTENSION_ACTIVATE to the active tab', async () => {
      mock.tabs.query.mockResolvedValue([{ id: 55, url: 'https://example.com/page' }])
      mock.tabs.sendMessage.mockResolvedValue(undefined)
      const sr = await fireMessage(mock, { type: 'EXTENSION_ACTIVATE', source: 'popup' })
      await flushPromises()
      expect(mock.tabs.sendMessage).toHaveBeenCalledWith(
        55,
        expect.objectContaining({ type: 'EXTENSION_ACTIVATE' })
      )
    })

    it('should reject EXTENSION_ACTIVATE on special pages', async () => {
      mock.tabs.query.mockResolvedValue([{ id: 55, url: 'chrome://settings' }])
      const sr = await fireMessage(mock, { type: 'EXTENSION_ACTIVATE', source: 'popup' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: false }))
    })

    it('should reject EXTENSION_ACTIVATE when no active tab', async () => {
      mock.tabs.query.mockResolvedValue([])
      const sr = await fireMessage(mock, { type: 'EXTENSION_ACTIVATE', source: 'popup' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'No active tab' })
      )
    })

    // -- DEVTOOLS_ACTIVATE --
    it('should inject page-helper and activate for DEVTOOLS_ACTIVATE', async () => {
      mock.tabs.get.mockResolvedValue({ url: 'https://example.com/page' })
      mock.scripting.executeScript.mockResolvedValue([])
      mock.tabs.sendMessage.mockResolvedValue(undefined)
      const sr = await fireMessage(mock, { type: 'DEVTOOLS_ACTIVATE', tabId: 30 })
      await flushPromises()
      expect(mock.scripting.executeScript).toHaveBeenCalledWith(
        expect.objectContaining({ target: { tabId: 30 }, files: ['content/devtools/page-helper.js'] })
      )
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    it('should skip chrome-extension:// pages for DEVTOOLS_ACTIVATE', async () => {
      mock.tabs.get.mockResolvedValue({ url: 'chrome-extension://abc/popup.html' })
      const sr = await fireMessage(mock, { type: 'DEVTOOLS_ACTIVATE', tabId: 31 })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true, skipped: true }))
    })

    it('should reject DEVTOOLS_ACTIVATE without tabId', async () => {
      const sr = await fireMessage(mock, { type: 'DEVTOOLS_ACTIVATE' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, error: 'Missing tabId' })
      )
    })

    // -- Hide elements --
    it('should get hide elements settings', async () => {
      mock.tabs.query.mockResolvedValue([{ url: 'https://example.com' }])
      mock.storage.local.get.mockResolvedValue({
        hideElementsSettings: { 'example.com': { enabled: true, selectors: ['.ad'] } },
      })
      const sr = await fireMessage(mock, { type: 'GET_HIDE_ELEMENTS_SETTINGS' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          domain: 'example.com',
          settings: { enabled: true, selectors: ['.ad'] },
        })
      )
    })

    it('should update hide elements settings', async () => {
      mock.tabs.query.mockResolvedValue([{ id: 1, url: 'https://example.com' }])
      mock.storage.local.get.mockResolvedValue({ hideElementsSettings: {} })
      const sr = await fireMessage(mock, {
        type: 'UPDATE_HIDE_ELEMENTS_SETTINGS',
        enabled: true,
        selectors: ['.banner'],
      })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    // -- EVENTBUS_DEVTOOLS_LOG --
    it('should forward EventBus devtools log events to DevTools port', async () => {
      const port = createMockPort('devtools-panel')
      mock._listeners.onConnect.forEach((fn) => fn(port))
      port._fireMessage({ type: 'REGISTER_DEVTOOLS', tabId: 20 })

      const sr = await fireMessage(
        mock,
        {
          type: 'EVENTBUS_DEVTOOLS_LOG',
          events: [{ type: 'REQ', direction: 'out', data: {}, timestamp: 1, id: '1' }],
        },
        { tab: { id: 20 } }
      )
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })

    // -- Unknown message type --
    it('should return error for unknown message types', async () => {
      const sr = await fireMessage(mock, { type: 'NONEXISTENT_TYPE' })
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ error: 'Unknown message type' }))
    })

    // -- Messages without sender.tab --
    it('should handle PICKER_MESSAGE_RELAY from sender without tab', async () => {
      const sr = await fireMessage(mock, { type: 'PICKER_MESSAGE_RELAY', data: { type: 'X' } }, {})
      await flushPromises()
      expect(sr).toHaveBeenCalledWith(expect.objectContaining({ success: true }))
    })
  })

  // =========================================================================
  // 3. Tab lifecycle events
  // =========================================================================
  describe('Tab lifecycle events', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    describe('Tab removal (onRemoved)', () => {
      it('should clean up caches when a tab is removed', async () => {
        mock.storage.local.get.mockResolvedValue({ injectedTabs: { '42': Date.now() } })
        mock._listeners.onTabRemoved.forEach((fn) => fn(42))
        await flushPromises()
        expect(mock.storage.local.get).toHaveBeenCalledWith('injectedTabs')
      })

      it('should handle tab removal when no injected record exists', async () => {
        mock.storage.local.get.mockResolvedValue({ injectedTabs: {} })
        expect(() => mock._listeners.onTabRemoved.forEach((fn) => fn(999))).not.toThrow()
        await flushPromises()
      })
    })

    describe('Tab update (onUpdated)', () => {
      it('should pre-resolve domain scripts during loading phase for http URLs', () => {
        const tab = { url: 'https://bilibili.com/video/BV123', status: 'loading', active: true }
        expect(() =>
          mock._listeners.onTabUpdated.forEach((fn) =>
            fn(10, { status: 'loading', url: tab.url }, tab)
          )
        ).not.toThrow()
      })

      it('should skip chrome:// and about: URLs during loading phase', () => {
        expect(() => {
          mock._listeners.onTabUpdated.forEach((fn) =>
            fn(11, { status: 'loading', url: 'chrome://settings' }, { url: 'chrome://settings' })
          )
          mock._listeners.onTabUpdated.forEach((fn) =>
            fn(12, { status: 'loading', url: 'about:blank' }, { url: 'about:blank' })
          )
        }).not.toThrow()
      })

      it('should skip non-http URLs during loading phase', () => {
        expect(() =>
          mock._listeners.onTabUpdated.forEach((fn) =>
            fn(13, { status: 'loading', url: 'file:///local/file.html' }, { url: 'file:///local/file.html' })
          )
        ).not.toThrow()
      })

      it('should call handleTabUpdate on complete status', async () => {
        const tab = { url: 'https://example.com', status: 'complete', active: true }
        mock.tabs.get.mockResolvedValue(tab)
        mock.scripting.executeScript.mockResolvedValue([{ result: true }])

        mock._listeners.onTabUpdated.forEach((fn) => fn(15, { status: 'complete' }, tab))
        await flushPromises()
      })

      it('should match subdomain URLs for known domains', () => {
        expect(() =>
          mock._listeners.onTabUpdated.forEach((fn) =>
            fn(3, { status: 'loading', url: 'https://www.bilibili.com/video' }, { url: 'https://www.bilibili.com/video', status: 'loading', active: true })
          )
        ).not.toThrow()
      })
    })
  })

  // =========================================================================
  // 4. Extension lifecycle
  // =========================================================================
  describe('Extension lifecycle', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    describe('onInstalled', () => {
      it('should register onInstalled listeners', () => {
        expect(mock.runtime.onInstalled.addListener).toHaveBeenCalled()
        expect(mock._listeners.onInstalled.length).toBeGreaterThanOrEqual(1)
      })

      it('should create welcome tab on fresh install', async () => {
        mock.tabs.query.mockResolvedValue([])
        mock.storage.local.get.mockResolvedValue({})

        mock._listeners.onInstalled.forEach((fn) => fn({ reason: 'install' }))
        await flushPromises()

        expect(mock.tabs.create).toHaveBeenCalledWith({ url: 'welcome.html' })
      })

      it('should NOT create welcome tab on update', async () => {
        mock.tabs.query.mockResolvedValue([])
        mock.storage.local.get.mockResolvedValue({})

        mock._listeners.onInstalled.forEach((fn) => fn({ reason: 'update' }))
        await flushPromises()

        const welcomeCalls = mock.tabs.create.mock.calls.filter(
          (c: any) => c[0]?.url === 'welcome.html'
        )
        expect(welcomeCalls.length).toBe(0)
      })

      it('should create context menu on install', async () => {
        mock._listeners.onInstalled.forEach((fn) => fn({ reason: 'install' }))
        await flushPromises()
        expect(mock.contextMenus.create).toHaveBeenCalledWith(
          expect.objectContaining({ id: 'addToNewtab' })
        )
      })
    })

    describe('onStartup', () => {
      it('should register onStartup listener', () => {
        expect(mock.runtime.onStartup.addListener).toHaveBeenCalled()
      })
    })

    describe('Service worker lifecycle', () => {
      it('should register install and activate events on self', () => {
        expect(self.addEventListener).toHaveBeenCalledWith('install', expect.any(Function))
        expect(self.addEventListener).toHaveBeenCalledWith('activate', expect.any(Function))
      })
    })

    describe('Context menu handler', () => {
      it('should handle addToNewtab context menu click without error', async () => {
        mock.storage.local.get.mockImplementation((keys: any, cb?: Function) => {
          if (typeof cb === 'function') {
            cb({ quickLinks: [] })
            return undefined
          }
          return Promise.resolve({ quickLinks: [] })
        })

        const info = { menuItemId: 'addToNewtab', linkUrl: 'https://example.com' }
        const tab = { url: 'https://current.com', title: 'Current Page', favIconUrl: 'icon.png' }

        expect(() =>
          mock._listeners.onContextMenuClicked.forEach((fn) => fn(info, tab))
        ).not.toThrow()
        await flushPromises()
      })
    })
  })

  // =========================================================================
  // 5. Storage change handling
  // =========================================================================
  describe('Storage change handling', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    it('should register storage change listener', () => {
      expect(mock._listeners.onStorageChanged.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle settings changes without error', async () => {
      const changes = {
        settings: {
          newValue: {
            debugMode: true,
            domainBlockedData: { blockedDomains: {}, blockedResponseDomains: {} },
          },
        },
      }
      expect(() =>
        mock._listeners.onStorageChanged.forEach((fn) => fn(changes))
      ).not.toThrow()
      await flushPromises()
    })
  })

  // =========================================================================
  // 6. Listener registration verification
  // =========================================================================
  describe('Listener registration', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    it('should register onConnect listener (twice: main ports + popup)', () => {
      expect(mock.runtime.onConnect.addListener).toHaveBeenCalledTimes(2)
    })

    it('should register onMessage listener', () => {
      expect(mock.runtime.onMessage.addListener).toHaveBeenCalled()
    })

    it('should register tab lifecycle listeners', () => {
      expect(mock.tabs.onRemoved.addListener).toHaveBeenCalled()
      expect(mock.tabs.onUpdated.addListener).toHaveBeenCalled()
      expect(mock.tabs.onActivated.addListener).toHaveBeenCalled()
    })

    it('should register storage change listener', () => {
      expect(mock.storage.onChanged.addListener).toHaveBeenCalled()
    })

    it('should register window focus change listener', () => {
      expect(mock.windows.onFocusChanged.addListener).toHaveBeenCalled()
    })

    it('should register declarativeNetRequest rule matched listener', () => {
      expect(mock.declarativeNetRequest.onRuleMatchedDebug.addListener).toHaveBeenCalled()
    })
  })

  // =========================================================================
  // 7. Window focus change
  // =========================================================================
  describe('Window focus change', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    it('should ignore WINDOW_ID_NONE', async () => {
      expect(() =>
        mock._listeners.onFocusChanged.forEach((fn) => fn(-1))
      ).not.toThrow()
      await flushPromises()
    })

    it('should query tabs for focused window', async () => {
      mock.tabs.query.mockResolvedValue([{ id: 5, url: 'https://example.com' }])
      mock.tabs.get.mockResolvedValue({ id: 5, url: 'https://example.com', status: 'complete', active: true })
      mock.scripting.executeScript.mockResolvedValue([{ result: true }])

      mock._listeners.onFocusChanged.forEach((fn) => fn(1))
      await flushPromises()
      expect(mock.tabs.query).toHaveBeenCalledWith({ active: true, windowId: 1 })
    })
  })

  // =========================================================================
  // 8. Edge cases
  // =========================================================================
  describe('Edge cases', () => {
    let mock: ReturnType<typeof createChromeMock>

    beforeEach(async () => {
      mock = await loadBackground()
    })

    it('should handle messages with no type gracefully', async () => {
      const sr = await fireMessage(mock, {}, {})
      await flushPromises()
      expect(sr).toHaveBeenCalled()
    })

    it('should handle concurrent port connections and disconnections', () => {
      const ports = Array.from({ length: 10 }, () => createMockPort('devtools-panel'))
      ports.forEach((port) => mock._listeners.onConnect.forEach((fn) => fn(port)))
      ports.forEach((port, i) => port._fireMessage({ type: 'REGISTER_DEVTOOLS', tabId: i + 1 }))
      expect(() => ports.forEach((port) => port._fireDisconnect())).not.toThrow()
    })

    it('should handle hot-reload importScripts without error', () => {
      expect(self.importScripts).toHaveBeenCalled()
    })

    it('should handle tab update for various known domains without error', () => {
      const knownUrls = [
        'https://bilibili.com/video/BV123',
        'https://www.douyin.com/video',
        'https://github.com/repo',
        'https://youtube.com/watch',
        'https://xiaohongshu.com/post',
      ]
      for (const url of knownUrls) {
        expect(() =>
          mock._listeners.onTabUpdated.forEach((fn) =>
            fn(1, { status: 'loading', url }, { url, status: 'loading', active: true })
          )
        ).not.toThrow()
      }
    })

    it('should handle tab update for unknown domains without error', () => {
      expect(() =>
        mock._listeners.onTabUpdated.forEach((fn) =>
          fn(
            2,
            { status: 'loading', url: 'https://unknown-domain-xyz.com/page' },
            { url: 'https://unknown-domain-xyz.com/page', status: 'loading', active: true }
          )
        )
      ).not.toThrow()
    })
  })
})
