import { parseUberInvoiceText } from './clipboard-data.js';

const fillButton = document.getElementById('fill-button');
const status = document.getElementById('status');

const showStatus = (message, state = '') => {
  status.textContent = message;
  status.dataset.state = state;
};

fillButton.addEventListener('click', async () => {
  fillButton.disabled = true;
  showStatus('Leyendo los datos copiados...');

  try {
    const activeTab = (await globalThis.chrome.tabs.query({ active: true, currentWindow: true }))[0];
    if (!activeTab?.url?.startsWith('https://help.uber.com/')) {
      throw new Error('Abre la página de ayuda de Uber en esta pestaña e inicia sesión primero.');
    }

    const clipboardText = await navigator.clipboard.readText();
    const { rfc, invoices } = parseUberInvoiceText(clipboardText);
    const result = await globalThis.chrome.tabs.sendMessage(activeTab.id, {
      type: 'FILL_UBER_INVOICES',
      rfc,
      records: invoices,
    });

    showStatus(result.message, result.ok ? 'success' : 'error');
  } catch (error) {
    showStatus(error.message || 'No se pudieron completar los campos.', 'error');
  } finally {
    fillButton.disabled = false;
  }
});