// service-worker.js
const CACHE_NAME = 'vuntgram-v2.1.0';
const API_CACHE_NAME = 'vuntgram-api-v2.1.0';

// Только СТАТИЧЕСКИЕ ресурсы для предварительного кэширования
const STATIC_RESOURCES = [
  '/',
  '/chats.html',
  '/contacts.html', 
  '/profile.html',
  '/offline.html',
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

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('🔄 TheVuntgram Service Worker: Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 TheVuntgram: Caching static resources');
        return cache.addAll(STATIC_RESOURCES);
      })
      .then(() => {
        console.log('✅ TheVuntgram Service Worker: Installed');
        return self.skipWaiting();
      })
  );
});

// Активация
self.addEventListener('activate', (event) => {
  console.log('🔄 TheVuntgram Service Worker: Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) { // УДАЛЯЕМ API_CACHE_NAME
            console.log('🗑️ TheVuntgram: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ TheVuntgram Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// Обработка запросов - УПРОЩЕННАЯ ВЕРСИЯ
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Пропускаем неподдерживаемые схемы
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // НЕ кэшируем API запросы - всегда идем в сеть
  if (isApiRequest(event.request)) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // Для статических ресурсов - Cache First
  if (isStaticResource(event.request)) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // Для HTML страниц - Network First
  if (event.request.destination === 'document') {
    event.respondWith(handleHtmlRequest(event.request));
    return;
  }

  // По умолчанию - Network Only (не кэшируем)
  event.respondWith(fetch(event.request));
});

function isApiRequest(request) {
  const url = new URL(request.url);
  const apiEndpoints = [
    '/get_chats', 
    '/get_chat_info', 
    '/get_messages', 
    '/get_friends', 
    '/get_user_data', 
    '/get_activity_status',
    '/send_message',
    '/send_image_message',
    '/create_chat',
    '/get_or_create_chat',
    '/mark_as_read',
    '/mark_all_as_read',
    '/update_activity',
    '/refresh_activity'
  ];
  
  return apiEndpoints.some(endpoint => url.pathname.includes(endpoint));
}

function isStaticResource(request) {
  const url = new URL(request.url);
  
  // Только действительно статические ресурсы
  return request.destination === 'style' || 
         request.destination === 'script' || 
         request.destination === 'font' ||
         (request.destination === 'image' && !url.pathname.includes('/avatar/'));
}

async function handleApiRequest(request) {
  // ВСЕГДА идем в сеть для API, не кэшируем
  try {
    const networkResponse = await fetch(request);
    
    if (!networkResponse.ok) {
      throw new Error(`API response status: ${networkResponse.status}`);
    }
    
    return networkResponse;
  } catch (error) {
    console.error('❌ TheVuntgram: API request failed:', error);
    
    // Для GET запросов можно попробовать вернуть старые данные из localStorage
    if (request.method === 'GET') {
      return tryFallbackFromLocalStorage(request);
    }
    
    throw error;
  }
}

async function tryFallbackFromLocalStorage(request) {
  // Эта функция будет вызвана из основного кода, не здесь
  return new Response(
    JSON.stringify({ 
      status: 'error', 
      error: 'No connection and no cached data' 
    }),
    { 
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Фоновая проверка обновления (только для статики)
    updateStaticCacheInBackground(request, cache);
    return cachedResponse;
  }
  
  // Загружаем и кэшируем статический ресурс
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    throw error;
  }
}

async function handleHtmlRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Обновляем кэш HTML страниц
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('HTML response not ok');
  } catch (error) {
    // Fallback на кэшированную версию
    const cachedResponse = await cache.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

async function updateStaticCacheInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      cache.put(request, networkResponse);
    }
  } catch (error) {
    // Игнорируем ошибки фонового обновления
  }
}

// Офлайн страница
async function showOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  const offlinePage = await cache.match('/offline.html');
  
  if (offlinePage) {
    return offlinePage;
  }
  
  return new Response('Offline', { status: 503 });
}
