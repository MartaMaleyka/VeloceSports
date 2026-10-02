/**
 * Service Worker para soporte offline en el tablero de captura.
 * Cachea assets estáticos y maneja requests offline.
 */

const CACHE_NAME = 'velocesports-v1';
const RUNTIME_CACHE = 'velocesports-runtime';

// Assets estáticos a cachear en la instalación
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

/**
 * Instalación: cachear assets estáticos
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Failed to cache some static assets:', err);
        // No fallar la instalación si no puede cachear assets
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

/**
 * Activación: limpiar caches viejos
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch: Network first para API, cache first para assets
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Solo manejar GETs
  if (request.method !== 'GET') {
    return;
  }

  // No cachear cross-origin ni chrome extensions
  if (url.origin !== location.origin) {
    return;
  }

  // API calls: Network first
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Assets (CSS, JS, etc): Cache first, fallback network
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)$/i) ||
    url.pathname.includes('/brand/')
  ) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // HTML: Network first (para versionado), fallback cache
  if (url.pathname.endsWith('.html') || url.pathname === '/' || !url.pathname.includes('.')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }
});

/**
 * Network first: intenta red, fallback cache
 */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request);

    // Cachear respuestas exitosas de GET
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }

    // Fallback offline
    return new Response('Offline - No se puede cargar este recurso', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Cache first: intenta cache, fallback red
 */
async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[SW] No cache and network failed:', request.url);
    return new Response('Offline - Asset no disponible', {
      status: 503,
      statusText: 'Service Unavailable',
    });
  }
}

/**
 * Message: comunicación con clientes
 */
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(RUNTIME_CACHE);
  }
});
