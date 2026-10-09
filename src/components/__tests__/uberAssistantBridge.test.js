import { describe, expect, it, vi } from 'vitest';
import { createUberAssistantBridge } from '../uberAssistantBridge';

describe('createUberAssistantBridge', () => {
  it('reconoce una respuesta de la extensión con el nonce actual', async () => {
    const onReady = vi.fn();
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation((message) => {
      if (message?.type !== 'UBER_ASSISTANT_PING') return;
      window.dispatchEvent(new MessageEvent('message', {
        source: window,
        origin: window.location.origin,
        data: {
          source: 'uber-assistant-extension',
          type: 'UBER_ASSISTANT_READY',
          nonce: message.nonce,
        },
      }));
    });
    const bridge = createUberAssistantBridge(onReady);

    await expect(bridge.checkInstalled()).resolves.toBe(true);
    expect(onReady).toHaveBeenCalled();
    bridge.disconnect();
    postMessage.mockRestore();
  });

  it('no reconoce una respuesta con nonce diferente', async () => {
    const bridge = createUberAssistantBridge(vi.fn());

    await expect(bridge.checkInstalled(5)).resolves.toBe(false);
    bridge.disconnect();
  });
});