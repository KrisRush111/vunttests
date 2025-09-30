// sw.js - Service Worker для Vuntgram
const CACHE_NAME = 'vuntgram-v1.0.2';
const APP_STATIC_RESOURCES = [
  '/',
  '/index.html',
  '/profile.html', 
  '/contacts.html',
  '/chats.html',
  '/manifest.json',
  '/tailwind.js',
  '/fontawesome-free-6.7.2-web/css/all.min.css',
  '/AppImages/android/android-launchericon-192-192.png',
  '/AppImages/ios/180.png'
];

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching app shell');
        return cache.addAll(APP_STATIC_RESOURCES).catch(error => {
          console.warn('Service Worker: Не все ресурсы закэшированы:', error);
        });
      })
      .then(() => {
        console.log('Service Worker: Install completed');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activate completed');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Пропускаем не-GET запросы и запросы к API
  if (event.request.method !== 'GET' || 
      event.request.url.includes('vuntserver') || 
      !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log('Service Worker: Serving from cache', event.request.url);
          return cachedResponse;
        }
        
        console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Кэшируем только успешные ответы
            if (response.status === 200) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return response;
          })
          .catch(error => {
            console.error('Service Worker: Fetch failed', error);
            // Можно вернуть fallback страницу
            return caches.match('/index.html');
          });
      })
  );
});

console.log('Service Worker: Loaded successfully');
