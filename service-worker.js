// service-worker.js
const CACHE_NAME = 'vuntgram-v1.2.0';
const API_CACHE_NAME = 'vuntgram-api-v1.2.0';

// Ресурсы для кэширования при установке
const STATIC_RESOURCES = [
  '/',
  '/chats.html',
  '/contacts.html', 
  '/profile.html',
  '/icon-192x192.png',
  '/icon-512x512.png',
  '/фон.webp',
  '/tailwind.js',
  '/fontawesome-free-6.7.2-web/css/all.min.css',
  '/activity-tracker.js',
  'https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap'
];

// API endpoints для кэширования
const API_ENDPOINTS = [
  '/get_chats',
  '/get_chat_info',
  '/get_messages',
  '/get_friends',
  '/get_user_data',
  '/get_activity_status',
  '/avatar/'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('Service Worker: Installed');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем старые кэши
          if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Пропускаем неподдерживаемые схемы
  if (!url.protocol.startsWith('http')) {
    return;
  }

  event.respondWith(
    handleFetch(event.request).catch((error) => {
      console.error('Service Worker: Fetch failed:', error);
      // Можно показать fallback страницу
      return caches.match('/offline.html');
    })
  );
});

async function handleFetch(request) {
  const url = new URL(request.url);
  
  // Для API запросов - стратегия "Network First" с fallback на кэш
  if (isApiRequest(request)) {
    return handleApiRequest(request);
  }
  
  // Для статических ресурсов - стратегия "Cache First" 
  if (isStaticResource(request)) {
    return handleStaticRequest(request);
  }
  
  // Для аватаров - стратегия "Cache First" с обновлением
  if (isAvatarRequest(request)) {
    return handleAvatarRequest(request);
  }
  
  // По умолчанию - "Network First"
  return fetch(request)
    .then((response) => {
      // Кэшируем успешные ответы
      if (response.ok) {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(request, responseClone);
        });
      }
      return response;
    })
    .catch(() => {
      // Fallback на кэш
      return caches.match(request);
    });
}

function isApiRequest(request) {
  const url = new URL(request.url);
  return API_ENDPOINTS.some(endpoint => 
    url.pathname.includes(endpoint) && request.method === 'POST'
  );
}

function isStaticResource(request) {
  const url = new URL(request.url);
  return STATIC_RESOURCES.some(resource => 
    url.href.includes(resource) || 
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font'
  );
}

function isAvatarRequest(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/avatar/');
}

async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE_NAME);
  
  try {
    // Пробуем сеть сначала
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Кэшируем успешный ответ
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
  } catch (error) {
    // Fallback на кэш
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
      console.log('Service Worker: Serving API from cache', request.url);
      return cachedResponse;
    }
    
    throw error;
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Фоновая проверка обновления
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.ok) {
          cache.put(request, networkResponse);
        }
      })
      .catch(() => {
        // Игнорируем ошибки фонового обновления
      });
    
    return cachedResponse;
  }
  
  // Если нет в кэше - загружаем из сети
  return fetch(request);
}

async function handleAvatarRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Всегда пробуем сеть для аватаров
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Обновляем кэш
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Avatar network request failed');
  } catch (error) {
    // Fallback на кэш если есть
    if (cachedResponse) {
      console.log('Service Worker: Serving avatar from cache');
      return cachedResponse;
    }
    
    // Можно вернуть дефолтный аватар
    return new Response('', { 
      status: 200,
      headers: { 'Content-Type': 'image/svg+xml' }
    });
  }
}

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Здесь можно реализовать фоновую синхронизацию данных
  console.log('Service Worker: Performing background sync');
}