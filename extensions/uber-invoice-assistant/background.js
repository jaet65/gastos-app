import { parseUberInvoiceText } from './clipboard-data.js';

globalThis.chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'PARSE_UBER_INVOICE_CLIPBOARD') return false;
  if (!sender.tab?.url?.startsWith('https://help.uber.com/')) {
    sendResponse({ ok: false, error: 'El llenado solo está disponible en la página de ayuda de Uber.' });
    return false;
  }

  try {
    sendResponse({ ok: true, ...parseUberInvoiceText(message.text) });
  } catch (error) {
    sendResponse({ ok: false, error: error.message || 'No se pudieron preparar los datos.' });
  }
  return false;
});
