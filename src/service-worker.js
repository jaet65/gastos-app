import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';
/* global clients */

const SHARE_DATABASE_NAME = 'gastos-maf-shares';
const SHARE_STORE_NAME = 'invoices';
const LEGACY_CACHE_NAME = 'gastos-maf-cache-v2';

const storeSharedInvoice = (invoice) => new Promise((resolve, reject) => {
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
    transaction.objectStore(SHARE_STORE_NAME).put(invoice);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error || new Error('No se pudo guardar la factura compartida.'));
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error('Se canceló el guardado de la factura compartida.'));
    };
  };
});

const redirectToApp = (query) => Response.redirect(
  new URL(`/?${query}`, self.location.origin),
  303
);

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'POST' || url.pathname !== '/share-target') return;

  event.respondWith((async () => {
    try {
      const formData = await event.request.formData();
      const invoice = formData.getAll('file').find((value) => (
        value instanceof File
        && (value.type === 'application/pdf' || /\.pdf$/i.test(value.name))
      ));

      if (!invoice) return redirectToApp('shareError=invalid');

      const id = self.crypto.randomUUID
        ? self.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const name = invoice.name && /\.pdf$/i.test(invoice.name) ? invoice.name : 'factura.pdf';

      await storeSharedInvoice({
        id,
        blob: invoice,
        name,
        type: invoice.type || 'application/pdf',
        lastModified: invoice.lastModified
      });

      return redirectToApp(`sharedInvoice=${encodeURIComponent(id)}`);
    } catch (error) {
      console.error('Error recibiendo la factura compartida:', error);
      return redirectToApp('shareError=receive');
    }
  })());
});

self.skipWaiting();
clientsClaim();

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete(LEGACY_CACHE_NAME));
});

precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
  denylist: [/^\/share-target$/]
}));

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/?tab=solicitudes';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
