const SHARE_DATABASE_NAME = 'gastos-maf-shares';
const SHARE_STORE_NAME = 'invoices';

export const takeSharedInvoice = (id) => new Promise((resolve, reject) => {
  const request = indexedDB.open(SHARE_DATABASE_NAME, 1);

  request.onupgradeneeded = () => {
    request.result.createObjectStore(SHARE_STORE_NAME, { keyPath: 'id' });
  };

  request.onerror = () => {
    reject(request.error || new Error('No se pudo abrir el almacenamiento de facturas compartidas.'));
  };

  request.onsuccess = () => {
    const database = request.result;
    const transaction = database.transaction(SHARE_STORE_NAME, 'readwrite');
    const store = transaction.objectStore(SHARE_STORE_NAME);
    let sharedInvoice = null;
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      sharedInvoice = getRequest.result || null;
      if (sharedInvoice) store.delete(id);
    };

    getRequest.onerror = () => transaction.abort();

    transaction.oncomplete = () => {
      database.close();
      if (!sharedInvoice) {
        resolve(null);
        return;
      }

      resolve(new File([sharedInvoice.blob], sharedInvoice.name, {
        type: sharedInvoice.type || 'application/pdf',
        lastModified: sharedInvoice.lastModified || Date.now()
      }));
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('No se pudo recuperar la factura compartida.'));
    };

    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Se canceló la recuperación de la factura compartida.'));
    };
  };
});
