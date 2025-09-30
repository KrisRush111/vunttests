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
  
  // Основные иконки (уменьшил список для оптимизации)
  '/AppImages/android/android-launchericon-192-192.png',
  '/AppImages/android/android-launchericon-512-512.png',
  '/AppImages/ios/180.png',
  '/AppImages/ios/512.png',
  '/AppImages/windows/largetile.scale-100.png'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
  console.log('🛠️ Service Worker: Установка...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Service Worker: Кэширование статических ресурсов');
        // Используем addAll но не блокируем установку при ошибках
        return cache.addAll(APP_STATIC_RESOURCES).catch(error => {
          console.warn('⚠️ Не все ресурсы закэшированы:', error);
        });
      })
      .then(() => {
        console.log('✅ Service Worker: Установка завершена');
        return self.skipWaiting();
      })
  );
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Активация...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Удаляем все старые кэши
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Service Worker: Удаление старого кэша:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Активация завершена');
      return self.clients.claim();
    })
  );
});

// Перехват сетевых запросов
self.addEventListener('fetch', (event) => {
  // Пропускаем запросы к API серверу и внешние ресурсы
  if (event.request.url.includes('vuntserver') || 
      event.request.url.includes('cdnjs') ||
      event.request.url.includes('fonts.googleapis') ||
      !event.request.url.startsWith(self.location.origin)) {
    return fetch(event.request);
  }
  
  // Для всех локальных запросов используем стратегию "Cache First"
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // Если есть в кэше - возвращаем из кэша
        if (cachedResponse) {
          console.log('💾 Serving from cache:', event.request.url);
          return cachedResponse;
        }
        
        // Если нет в кэше - делаем сетевой запрос
        console.log('🌐 Fetching from network:', event.request.url);
        return fetch(event.request)
          .then((response) => {
            // Проверяем валидность ответа
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }
            
            // Клонируем ответ для кэширования
            const responseToCache = response.clone();
            
            // Кэшируем новый ресурс
            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
                console.log('✅ New resource cached:', event.request.url);
              })
              .catch(error => {
                console.warn('⚠️ Cache put failed:', error);
              });
              
            return response;
          })
          .catch((error) => {
            console.log('❌ Network error, serving fallback:', error);
            
            // Fallback для разных типов запросов
            if (event.request.destination === 'document') {
              return caches.match('/index.html');
            }
            
            // Fallback для изображений
            if (event.request.destination === 'image') {
              return caches.match('/AppImages/android/android-launchericon-192-192.png');
            }
            
            // Возвращаем пустой ответ для других типов
            return new Response('Network error', {
              status: 408,
              statusText: 'Offline'
            });
          });
      })
  );
});

// Обработка сообщений от основного потока
self.addEventListener('message', (event) => {
  console.log('📨 Service Worker received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_CACHE_STATUS') {
    caches.has(CACHE_NAME).then((hasCache) => {
      event.ports[0].postMessage({
        type: 'CACHE_STATUS',
        hasCache: hasCache,
        cacheName: CACHE_NAME
      });
    });
  }
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  console.log('🔄 Service Worker: Фоновая синхронизация -', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(
      doBackgroundSync().catch(error => {
        console.error('❌ Background sync failed:', error);
      })
    );
  }
});

// Периодическая синхронизация (для фонового обновления)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'content-update') {
    console.log('🔄 Periodic background sync');
    event.waitUntil(updateContent());
  }
});

// Функция для фоновой синхронизации
async function doBackgroundSync() {
  console.log('🔄 Performing background sync...');
  // Здесь можно добавить логику синхронизации данных
  return Promise.resolve();
}

// Функция для обновления контента
async function updateContent() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const requests = APP_STATIC_RESOURCES.filter(url => 
      !url.includes('manifest.json') && !url.includes('sw.js')
    );
    
    for (const request of requests) {
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(request, response);
          console.log('✅ Updated:', request);
        }
      } catch (error) {
        console.warn('⚠️ Failed to update:', request, error);
      }
    }
  } catch (error) {
    console.error('❌ Content update failed:', error);
  }
}

// Обработка push-уведомлений (если добавите в будущем)
self.addEventListener('push', (event) => {
  console.log('📲 Push notification received');
  
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || 'Новое сообщение в Vuntgram',
      icon: '/AppImages/android/android-launchericon-192-192.png',
      badge: '/AppImages/android/android-launchericon-72-72.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Vuntgram', options)
    );
  }
});

// Обработка кликов по уведомлениям
self.addEventListener('notificationclick', (event) => {
  console.log('👆 Notification click');
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data.url);
      }
    })
  );
});

console.log('🚀 Service Worker loaded successfully');