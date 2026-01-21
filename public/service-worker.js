const CACHE_NAME = 'gastos-maf-cache-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/MAF.png', // Asegúrate de que tu logo esté en public
  // Agrega aquí cualquier otro recurso estático que quieras cachear
  // por ejemplo, CSS, JS compilado (si no lo gestiona Vite/CRA automáticamente)
];

// Evento de instalación: cachea los recursos estáticos
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Evento de activación: limpia cachés antiguos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Evento de fetch: sirve recursos desde la caché o la red
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});