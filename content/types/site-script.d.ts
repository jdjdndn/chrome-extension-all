/**
 * 站点脚本基类类型定义
 */

export interface SiteScriptOptions {
  waitForElement?: string | null
  waitForTimeout?: number
  defaultSettings?: Record<string, any>
  styleId?: string
}

export interface SiteScriptAPI {
  getSettings(): Record<string, any>
  updateSettings(newSettings: Record<string, any>): void
  applyStyles(): void
  resetSettings(): void
}

export declare class SiteScript {
  siteName: string
  options: Required<SiteScriptOptions>
  settings: Record<string, any>
  initialized: boolean

  constructor(siteName: string, options?: SiteScriptOptions)

  init(): Promise<void>
  waitForDOM(): Promise<void>
  waitForElement(selector: string, timeout?: number): Promise<Element>
  loadSettings(): Promise<void>
  saveSettings(newSettings: Record<string, any>): Promise<void>
  getSetting(key: string, defaultValue?: any): any
  updateSetting(key: string, value: any): Promise<void>
  applyStyles(): void
  getStyles(settings: Record<string, any>): string
  setupObservers(): void
  onDOMChange(): void
  exposeAPI(): void
  setupStorageListener(): void
  onReady(): void
  showNotification(message: string, duration?: number): void
  debounce<T extends (...args: any[]) => any>(func: T, delay?: number): T
}

declare global {
  interface Window {
    [key: string]: any
  }
}
