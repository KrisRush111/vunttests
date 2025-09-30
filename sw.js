// sw.js - Service Worker для Vuntgram с автоматическим обновлением
const APP_VERSION = '1.0.3';
const CACHE_NAME = `vuntgram-${APP_VERSION}`;

// Стратегия кэширования: Network First для HTML, Cache First для статики
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing version', APP_VERSION);
  self.skipWaiting(); // Немедленная активация
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating version', APP_VERSION);
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем все старые кэши
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated version', APP_VERSION);
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

  const url = new URL(event.request.url);
  
  // Для HTML страниц - Network First стратегия (всегда свежие)
  if (url.pathname.endsWith('.html') || 
      event.request.destination === 'document' ||
      url.pathname === '/') {
    event.respondWith(networkFirstStrategy(event.request));
  } 
  // Для статических ресурсов - Cache First стратегия
  else {
    event.respondWith(cacheFirstStrategy(event.request));
  }
});

// Network First стратегия для HTML
async function networkFirstStrategy(request) {
  try {
    console.log('Service Worker: Network First for', request.url);
    
    // Пытаемся получить свежую версию из сети
    const networkResponse = await fetch(request);
    
    // Если успешно - обновляем кэш и возвращаем свежий ответ
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      console.log('Service Worker: Updated cache for', request.url);
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    console.log('Service Worker: Network failed, fallback to cache for', request.url);
    
    // Если сеть недоступна - используем кэш
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Если нет в кэше - возвращаем ошибку
    return new Response('Network error', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

// Cache First стратегия для статики
async function cacheFirstStrategy(request) {
  console.log('Service Worker: Cache First for', request.url);
  
  // Сначала проверяем кэш
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    // В фоне обновляем кэш
    updateCacheInBackground(request);
    return cachedResponse;
  }
  
  // Если нет в кэше - загружаем из сети
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('Service Worker: Fetch failed for', request.url, error);
    return new Response('Resource not available', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

// Фоновая синхронизация кэша
async function updateCacheInBackground(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, networkResponse.clone());
      console.log('Service Worker: Background cache updated for', request.url);
      
      // Уведомляем клиентов об обновлении
      notifyClientsAboutUpdate(request.url);
    }
  } catch (error) {
    // Тихий fail - не прерываем основной поток
    console.log('Service Worker: Background update failed for', request.url);
  }
}

// Уведомление клиентов об обновлениях
async function notifyClientsAboutUpdate(updatedUrl) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'CONTENT_UPDATED',
      url: updatedUrl,
      timestamp: Date.now()
    });
  });
}

// Обработка сообщений от клиентов
self.addEventListener('message', (event) => {
  console.log('Service Worker: Received message', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CHECK_UPDATES') {
    checkForUpdates();
  }
});

// Периодическая проверка обновлений
async function checkForUpdates() {
  console.log('Service Worker: Checking for updates...');
  
  try {
    // Проверяем главную страницу на изменения
    const response = await fetch('/', {
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (response.status === 200) {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match('/');
      
      if (!cachedResponse) {
        await cache.put('/', response.clone());
        console.log('Service Worker: Initial cache for /');
        return;
      }
      
      // Сравниваем ETag или Last-Modified заголовки
      const cachedETag = cachedResponse.headers.get('etag');
      const networkETag = response.headers.get('etag');
      
      const cachedLastModified = cachedResponse.headers.get('last-modified');
      const networkLastModified = response.headers.get('last-modified');
      
      // Если обнаружены изменения - обновляем все HTML страницы
      if (cachedETag !== networkETag || cachedLastModified !== networkLastModified) {
        console.log('Service Worker: Content changed, updating cache...');
        await updateAllHTMLPages();
      }
    }
  } catch (error) {
    console.error('Service Worker: Update check failed', error);
  }
}

// Принудительное обновление всех HTML страниц
async function updateAllHTMLPages() {
  const pagesToUpdate = [
    '/',
    '/index.html',
    '/profile.html',
    '/contacts.html',
    '/chats.html'
  ];
  
  const cache = await caches.open(CACHE_NAME);
  
  for (const pageUrl of pagesToUpdate) {
    try {
      const response = await fetch(pageUrl, {
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      
      if (response.status === 200) {
        await cache.put(pageUrl, response.clone());
        console.log('Service Worker: Updated', pageUrl);
      }
    } catch (error) {
      console.error('Service Worker: Failed to update', pageUrl, error);
    }
  }
  
  // Уведомляем клиентов о масштабном обновлении
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'MAJOR_UPDATE_AVAILABLE',
      version: APP_VERSION,
      timestamp: Date.now()
    });
  });
}

// Периодическая проверка обновлений (каждые 5 минут)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-update-check') {
    event.waitUntil(checkForUpdates());
  }
});

// При активации запускаем проверку обновлений
self.addEventListener('activate', (event) => {
  event.waitUntil(
    checkForUpdates().catch(error => {
      console.error('Service Worker: Initial update check failed', error);
    })
  );
});

console.log('Service Worker: Loaded successfully. Version:', APP_VERSION);
