/**
 * 消息通信工具类型定义
 */

export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface MessagingUtils {
  sendMessage<T = any>(type: string, data?: any): Promise<MessageResponse<T>>;
  sendToContentScript<T = any>(tabId: number, message: any): Promise<MessageResponse<T>>;
  broadcast(message: any): Promise<void>;
  createMessageHandler(id: string, handlers: Record<string, MessageHandler>): void;
  registerBlockedDomains(domain: string, domains: string[]): Promise<void>;
}

export type MessageHandler = (message: any, sender?: chrome.runtime.MessageSender) => any;

export interface DomainSettings {
  enabled: boolean;
  selectors?: string[];
  keywords?: string[];
}

declare global {
  interface Window {
    MessagingUtils?: MessagingUtils;
    StorageUtils?: {
      getDomainSettings: (key: string, domain: string) => Promise<DomainSettings>;
      setDomainSettings: (key: string, domain: string, settings: DomainSettings): Promise<void>;
    };
  }
}
