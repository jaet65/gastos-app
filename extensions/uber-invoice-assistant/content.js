globalThis.chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'FILL_UBER_INVOICES') return false;

  sendResponse(globalThis.UberInvoiceFormFiller.fillUberForm(message.rfc, message.records));
  return false;
});

const promptId = 'uber-invoice-assistant-prompt';
let dismissedUrl = '';

const isUberInvoicePage = () => {
  if (window.location.hostname !== 'help.uber.com') return false;
  if (window.location.pathname.includes('no-se-generaron-mis-facturas-de-viaje')) return true;
  return [...document.querySelectorAll('h1, h2')]
    .some(heading => /no se generaron mis facturas de viaje/i.test(heading.textContent));
};

const makeButton = (label, className, onClick) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const parseClipboardText = (text) => new Promise((resolve, reject) => {
  globalThis.chrome.runtime.sendMessage({ type: 'PARSE_UBER_INVOICE_CLIPBOARD', text }, response => {
    const runtimeError = globalThis.chrome.runtime.lastError;
    if (runtimeError) {
      reject(new Error(runtimeError.message));
      return;
    }
    resolve(response);
  });
});

function showPrompt() {
  if (document.getElementById(promptId) || dismissedUrl === window.location.href) return;

  const panel = document.createElement('section');
  panel.id = promptId;
  panel.className = 'uber-invoice-assistant-panel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Uber Invoice Assistant');

  const heading = document.createElement('h2');
  heading.textContent = '¿Completar el reclamo?';
  const description = document.createElement('p');
  description.textContent = 'Detectamos la página de facturas Uber. ¿Deseas pegar el RFC, las fechas y los montos copiados desde Gastos App?';
  const status = document.createElement('p');
  status.className = 'uber-invoice-assistant-status';
  const actions = document.createElement('div');
  actions.className = 'uber-invoice-assistant-actions';

  const closePanel = () => {
    dismissedUrl = window.location.href;
    panel.remove();
  };

  const fillFromClipboard = () => {
    const fillButton = actions.querySelector('[data-fill]');
    fillButton.disabled = true;
    status.textContent = 'Leyendo los datos copiados y buscando los campos...';

    const applyResponse = (response, runtimeError) => {
      if (runtimeError || !response?.ok) {
        status.textContent = runtimeError?.message || response?.error || 'No se pudieron preparar los datos.';
        fillButton.disabled = false;
        fillButton.textContent = 'Reintentar';
        return;
      }
      const result = globalThis.UberInvoiceFormFiller.fillUberForm(response.rfc, response.invoices);
      status.textContent = result.message;
      fillButton.disabled = result.ok;
      fillButton.textContent = result.ok ? 'Datos completados' : 'Reintentar';
      if (result.ok) {
        actions.querySelector('[data-dismiss]').textContent = 'Cerrar';
      }
    };

    if (!navigator.clipboard?.readText) {
      status.textContent = 'Este navegador bloqueó el acceso al portapapeles en la página. Prueba desde el popup de la extensión.';
      fillButton.disabled = false;
      fillButton.textContent = 'Reintentar';
      return;
    }

    navigator.clipboard.readText()
      .then(parseClipboardText)
      .then(response => applyResponse(response, null))
      .catch(() => {
        status.textContent = 'Chrome bloqueó la lectura del portapapeles. Prueba desde el popup de la extensión.';
        fillButton.disabled = false;
        fillButton.textContent = 'Reintentar';
      });
  };

  actions.append(
    makeButton('Sí, completar', 'uber-invoice-assistant-primary', fillFromClipboard),
    makeButton('Ahora no', 'uber-invoice-assistant-secondary', closePanel)
  );
  actions.querySelector('.uber-invoice-assistant-primary').dataset.fill = 'true';
  actions.querySelector('.uber-invoice-assistant-secondary').dataset.dismiss = 'true';
  panel.append(heading, description, status, actions);
  document.body.append(panel);
}

let observedUrl = window.location.href;
let checkedUrl = '';
let checkingUrl = '';
const detectInvoicePage = () => {
  if (window.location.href !== observedUrl) {
    observedUrl = window.location.href;
    dismissedUrl = '';
    checkedUrl = '';
  }
  if (!isUberInvoicePage() || checkedUrl === window.location.href || checkingUrl === window.location.href) return;

  const pageUrl = window.location.href;
  checkedUrl = pageUrl;
  checkingUrl = pageUrl;
  if (!navigator.clipboard?.readText) {
    checkingUrl = '';
    return;
  }

  navigator.clipboard.readText()
    .then(parseClipboardText)
    .then(response => {
      if (pageUrl === window.location.href && response?.ok) showPrompt();
    })
    .catch(() => {})
    .finally(() => {
      if (checkingUrl === pageUrl) checkingUrl = '';
    });
};

new MutationObserver(detectInvoicePage).observe(document.documentElement, { childList: true, subtree: true });
window.addEventListener('popstate', detectInvoicePage);
window.addEventListener('hashchange', detectInvoicePage);
window.addEventListener('blur', () => {
  checkedUrl = '';
});
window.addEventListener('focus', detectInvoicePage);
detectInvoicePage();