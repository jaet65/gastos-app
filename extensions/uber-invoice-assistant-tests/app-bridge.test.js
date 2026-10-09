// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://comprobacionmaf.web.app/"}
import { describe, expect, it, vi } from 'vitest';

describe('app bridge content script', () => {
  it('responde al ping de Gastos App con el mismo nonce', async () => {
    const postMessage = vi.spyOn(window, 'postMessage').mockImplementation((data, targetOrigin) => {
      window.dispatchEvent(new MessageEvent('message', {
        source: window,
        origin: targetOrigin,
        data,
      }));
    });
    await import('../uber-invoice-assistant/app-bridge.js');
    const response = new Promise(resolve => {
      window.addEventListener('message', (event) => {
        if (event.data?.source === 'uber-assistant-extension') resolve(event.data);
      }, { once: true });
    });

    window.postMessage({ source: 'gastos-app', type: 'UBER_ASSISTANT_PING', nonce: 'test-nonce' }, window.location.origin);

    await expect(response).resolves.toEqual({
      source: 'uber-assistant-extension',
      type: 'UBER_ASSISTANT_READY',
      nonce: 'test-nonce',
    });
    postMessage.mockRestore();
  });
});