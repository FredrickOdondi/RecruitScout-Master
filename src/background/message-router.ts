import { ExtensionMessage, MessageType } from '../shared/types';
import { MESSAGE_TIMEOUT } from '../shared/constants';
import { stateManager } from './state-manager';

type MessageHandler = (message: ExtensionMessage, sender: chrome.runtime.MessageSender) => Promise<any>;

/**
 * Message router for handling communication between different parts of the extension
 */
export class MessageRouter {
  private static instance: MessageRouter;
  private handlers: Map<MessageType, MessageHandler> = new Map();
  private pendingMessages: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
  }> = new Map();

  private constructor() {
    this.initializeListeners();
  }

  static getInstance(): MessageRouter {
    if (!MessageRouter.instance) {
      MessageRouter.instance = new MessageRouter();
    }
    return MessageRouter.instance;
  }

  /**
   * Register a message handler
   */
  on(messageType: MessageType, handler: MessageHandler): void {
    this.handlers.set(messageType, handler);
  }

  /**
   * Send message to content script
   */
  async sendToContent(
    tabId: number,
    message: ExtensionMessage
  ): Promise<any> {
    const messageId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingMessages.delete(messageId);
        reject(new Error(`Message timeout: ${message.type}`));
      }, MESSAGE_TIMEOUT);

      this.pendingMessages.set(messageId, { resolve, reject, timeout });

      chrome.tabs.sendMessage(tabId, { ...message, _id: messageId }, (response) => {
        const pending = this.pendingMessages.get(messageId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingMessages.delete(messageId);

          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
            return;
          }

          if (response && response._id === messageId) {
            resolve(response.data);
          } else {
            resolve(response);
          }
        }
      });
    });
  }

  /**
   * Broadcast message to all tabs
   */
  async broadcast(message: ExtensionMessage): Promise<void> {
    const tabs = await chrome.tabs.query({});
    const promises = tabs
      .filter(tab => tab.id && tab.url?.startsWith('http'))
      .map(tab => {
        if (tab.id) {
          return this.sendToContent(tab.id, message).catch(() => {
            // Ignore errors for tabs that don't have content script
          });
        }
      });

    await Promise.allSettled(promises);
  }

  /**
   * Initialize message listeners
   */
  private initializeListeners(): void {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      const { type, payload, _id } = message as ExtensionMessage & { _id?: string };

      const handler = this.handlers.get(type as MessageType);
      if (!handler) {
        if (_id) {
          sendResponse({ _id, error: `Unknown message type: ${type}` });
        }
        return true;
      }

      // Handle async responses
      handler(message, sender)
        .then(data => {
          if (_id) {
            sendResponse({ _id, data });
          } else {
            sendResponse(data);
          }
        })
        .catch(error => {
          if (_id) {
            sendResponse({ _id, error: error.message });
          } else {
            sendResponse({ error: error.message });
          }
        });

      return true;
    });
  }
}

export const messageRouter = MessageRouter.getInstance();
