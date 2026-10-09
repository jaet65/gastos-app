// @vitest-environment jsdom
// @vitest-environment-options {"url":"https://help.uber.com/es/riders/article/no-se-generaron-mis-facturas-de-viaje-"}
import { describe, expect, it, vi } from 'vitest';

describe('Uber help page prompt', () => {
  it('detects the invoice article and asks before reading and filling data', async () => {
    const fillUberForm = vi.fn(() => ({ ok: true, message: 'RFC, fecha y monto completados.' }));
    const clipboardText = 'RFC: CCI190920376\n\nFactura 1:\nFecha: 2026-04-01\nMonto: 100.00';
    const readText = vi.fn().mockResolvedValue(clipboardText);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { readText } });
    const sendMessage = vi.fn((_message, callback) => callback({
      ok: true,
      rfc: 'CCI190920376',
      invoices: [{ invoiceNumber: 1, date: '2026-04-01', amount: '100.00' }],
    }));
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: vi.fn() },
        sendMessage,
      },
    });
    vi.stubGlobal('UberInvoiceFormFiller', { fillUberForm });
    vi.stubGlobal('MutationObserver', class {
      constructor(callback) {
        this.callback = callback;
      }

      observe() {
        this.callback();
      }
    });

    await import('../uber-invoice-assistant/content.js');

    const panel = document.getElementById('uber-invoice-assistant-prompt');
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('¿Deseas pegar');

    panel.querySelector('[data-fill]').click();

    await vi.waitFor(() => expect(readText).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledWith({
      type: 'PARSE_UBER_INVOICE_CLIPBOARD',
      text: clipboardText,
    }, expect.any(Function)));
    expect(sendMessage).toHaveBeenCalledTimes(2);
    await vi.waitFor(() => expect(fillUberForm).toHaveBeenCalledWith('CCI190920376', [
      { invoiceNumber: 1, date: '2026-04-01', amount: '100.00' },
    ]));
    expect(panel.textContent).toContain('RFC, fecha y monto completados.');
  });

  it('no muestra el popup si el portapapeles no contiene información de factura válida', async () => {
    vi.resetModules();
    document.body.replaceChildren();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { readText: vi.fn().mockResolvedValue('texto sin datos de factura') },
    });
    const sendMessage = vi.fn((_message, callback) => callback({ ok: false, error: 'Formato inválido.' }));
    vi.stubGlobal('chrome', {
      runtime: {
        onMessage: { addListener: vi.fn() },
        sendMessage,
      },
    });
    vi.stubGlobal('UberInvoiceFormFiller', { fillUberForm: vi.fn() });
    vi.stubGlobal('MutationObserver', class {
      constructor(callback) {
        this.callback = callback;
      }

      observe() {
        this.callback();
      }
    });

    await import('../uber-invoice-assistant/content.js');
    await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledOnce());

    expect(document.getElementById('uber-invoice-assistant-prompt')).toBeNull();
  });
});