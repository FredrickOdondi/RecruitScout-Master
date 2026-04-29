import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { messageRouter } from '../../src/background/message-router';
import { stateManager } from '../../src/background/state-manager';
import { MessageType, ExtensionMessage } from '../../src/shared/types';

describe('Message Passing Integration', () => {
  beforeEach(async () => {
    await stateManager.initialize();
  });

  afterEach(() => {
    stateManager.resetState();
  });

  describe('State Updates', () => {
    it('should update state through message router', async () => {
      const message: ExtensionMessage = {
        type: MessageType.UPDATE_STATE,
        payload: { status: 'running', extractedJobs: 5 },
      };

      let capturedMessage: any;
      chrome.runtime.sendMessage = jest.fn((msg) => {
        capturedMessage = msg;
      });

      await messageRouter.sendToContent(1, message);
      expect(capturedMessage).toBeDefined();
    });

    it('should get current state', async () => {
      const state = await stateManager.getState();
      expect(state).toBeDefined();
      expect(state.status).toBe('idle');
    });
  });

  describe('Message Types', () => {
    it('should handle GET_STATE message', async () => {
      const result = await new Promise<any>((resolve) => {
        const handler = (message: ExtensionMessage) => {
          if (message.type === MessageType.GET_STATE) {
            resolve(stateManager.getState());
          }
        };
        messageRouter.on(MessageType.GET_STATE, handler as any);
        handler({ type: MessageType.GET_STATE } as ExtensionMessage, {} as any);
      });

      expect(result).toBeDefined();
      expect(result.status).toBe('idle');
    });
  });
});
