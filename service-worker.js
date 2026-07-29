// service-worker.js - исправленная версия
const CACHE_NAME = 'vuntgram-v2.2.3';

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
  console.log('🔄 Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static resources');
        return Promise.allSettled(
          STATIC_RESOURCES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('⚠️ Не удалось закэшировать', url, err);
            })
          )
        );
      })
      .then(() => {
        console.log('✅ Service Worker: Installed');
        return self.skipWaiting();
      })
  );
});

// Активация
self.addEventListener('activate', (event) => {
  console.log('🔄 Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Service Worker: Activated');
      return self.clients.claim();
    })
  );
});

// ============================================================
// ГЛАВНОЕ: Обработка запросов
// ============================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // Пропускаем неподдерживаемые схемы
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // ✅ API-запросы: ВСЕГДА идём в сеть, НЕ кэшируем
  if (isApiRequest(event.request)) {
    event.respondWith(handleApiRequest(event.request));
    return;
  }

  // ✅ Статические ресурсы: Cache First
  if (isStaticResource(event.request)) {
    event.respondWith(handleStaticRequest(event.request));
    return;
  }

  // ✅ HTML страницы: Network First
  if (event.request.destination === 'document') {
    event.respondWith(handleHtmlRequest(event.request));
    return;
  }

  // ✅ Всё остальное: Network Only
  event.respondWith(fetch(event.request));
});

// ============================================================
// ФУНКЦИИ-ФИЛЬТРЫ
// ============================================================

function isApiRequest(request) {
  const url = new URL(request.url);
  const apiEndpoints = [
    '/get_chats', '/get_chat_info', '/get_messages', 
    '/get_friends', '/get_friends_recommendations',
    '/get_bulk_activity_status', '/friends_version',
    '/send_friend_request', '/handle_friend_request', '/check_friendship',
    '/search_user', '/get_user_data', '/get_activity_status',
    '/send_message', '/send_image_message', '/create_chat',
    '/get_or_create_chat', '/mark_as_read', '/mark_all_as_read',
    '/update_activity', '/refresh_activity', '/get_unread_count',
    '/save_push_subscription', '/remove_push_subscription',
    '/vapid_public_key', '/delete_message', '/delete_chat',
    '/edit_message', '/toggle_reaction', '/chat_version',
    '/avatar_version', '/avatar/', '/pool_stats', '/health'
  ];
  
  return apiEndpoints.some(endpoint => url.pathname.includes(endpoint));
}

function isStaticResource(request) {
  const url = new URL(request.url);
  return request.destination === 'style' || 
         request.destination === 'script' || 
         request.destination === 'font' ||
         (request.destination === 'image' && !url.pathname.includes('/avatar/'));
}

// ============================================================
// ОБРАБОТЧИКИ ЗАПРОСОВ
// ============================================================

async function handleApiRequest(request) {
  try {
    // ВСЕГДА идём в сеть для API, НЕ кэшируем
    const response = await fetch(request);
    
    // Просто возвращаем ответ (даже если 4xx/5xx — клиент сам разберёт)
    return response;
  } catch (error) {
    console.error('❌ API request failed (network):', request.url, error);
    
    // Возвращаем JSON-ошибку вместо выбрасывания исключения
    return new Response(
      JSON.stringify({ 
        status: 'error', 
        error: 'Network error: ' + error.message 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function handleStaticRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  if (cachedResponse) {
    // Фоновая проверка обновления
    updateStaticCacheInBackground(request, cache);
    return cachedResponse;
  }
  
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
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    throw new Error('HTML response not ok');
  } catch (error) {
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

// ============================================================
// PUSH-УВЕДОМЛЕНИЯ
// ============================================================

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Vuntgram', body: event.data ? event.data.text() : 'Новое сообщение' };
  }

  if (data.type === 'read_receipt') {
    event.waitUntil(handleReadReceiptPush(data));
    return;
  }

  const options = {
    body: data.body || 'Новое сообщение',
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'vuntgram-message',
    data: { url: data.url || '/' },
    vibrate: [100, 50, 100],
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title || 'Vuntgram', options),
      updateAppBadge(data.unreadCount)
    ])
  );
});

async function handleReadReceiptPush(data) {
  const tag = data.tag;
  if (tag) {
    try {
      const notifications = await self.registration.getNotifications({ tag });
      notifications.forEach((n) => n.close());
    } catch (err) {
      console.warn('⚠️ Не удалось закрыть уведомления по tag', tag, err);
    }
  }
  await updateAppBadge(data.unreadCount);
}

async function updateAppBadge(unreadCount) {
  if (!('setAppBadge' in self.navigator)) return;
  try {
    if (typeof unreadCount === 'number' && unreadCount > 0) {
      await self.navigator.setAppBadge(unreadCount);
    } else if (unreadCount === 0) {
      await self.navigator.clearAppBadge();
    } else {
      await self.navigator.setAppBadge();
    }
  } catch (err) {
    console.warn('⚠️ setAppBadge failed', err);
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  updateAppBadge(0);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_USER_ID') {
    self.__vuntgramUserId = event.data.userId;
  }
  if (event.data && event.data.type === 'SET_BADGE') {
    updateAppBadge(event.data.unreadCount);
  }
  if (event.data && event.data.type === 'CLEAR_BADGE') {
    updateAppBadge(0);
  }
  if (event.data && event.data.type === 'GET_SW_VERSION') {
    const reply = { type: 'SW_VERSION', version: CACHE_NAME, supportsPush: true };
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(reply);
    } else if (event.source) {
      event.source.postMessage(reply);
    }
  }
});

const PUSH_API_BASE = 'https://vuntserverrr.site';

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription ? event.oldSubscription.options : undefined)
      .then((subscription) => {
        return fetch(`${PUSH_API_BASE}/save_push_subscription`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            user_id: self.__vuntgramUserId || null,
            subscription: subscription.toJSON()
          })
        });
      })
      .catch((err) => console.error('❌ pushsubscriptionchange failed', err))
  );
});
