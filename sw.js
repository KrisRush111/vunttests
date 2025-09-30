// sw.js - Service Worker для Vuntgram
const CACHE_NAME = 'vuntgram-v1.0.1';
const APP_STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/profile.html', 
  '/contacts.html',
  '/chats.html',
  '/manifest.json',
  '/sw.js',
  '/tailwind.js',
  '/fontawesome-free-6.7.2-web/css/all.min.css',
  '/AppImages/android/android-launchericon-192-192.png',
  '/AppImages/ios/180.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(APP_STATIC_RESOURCES).catch(error => {
          console.warn('Не все ресурсы закэшированы:', error);
        });
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.url.includes('vuntserver') || 
      !event.request.url.startsWith(self.location.origin)) {
    return fetch(event.request);
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request);
      })
  );
});
