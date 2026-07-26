// service-worker.js
const CACHE_NAME = 'vuntgram-v2.2.2';
const API_CACHE_NAME = 'vuntgram-api-v2.2.2';

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
        // ВАЖНО: не используем cache.addAll() — он all-or-nothing: если хотя бы
        // один URL из STATIC_RESOURCES не загрузится (404, не задеплоен,
        // проблема с кодировкой имени и т.п.), install ЦЕЛИКОМ проваливается,
        // service worker никогда не становится "активным", и
        // navigator.serviceWorker.ready на клиенте зависает НАВСЕГДА на
        // устройствах без ранее успешно установленной версии (именно это
        // происходило на свежих iPhone). Кэшируем по одному, чтобы один
        // недоступный ресурс не блокировал всю установку.
        return Promise.allSettled(
          STATIC_RESOURCES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn('⚠️ TheVuntgram: не удалось закэшировать', url, err);
            })
          )
        );
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
    '/get_friends_recommendations',
    '/get_bulk_activity_status',
    '/friends_version',
    '/send_friend_request',
    '/handle_friend_request',
    '/check_friendship',
    '/search_user',
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

    // ВАЖНО: раньше здесь бросался Error на любой не-2xx статус, из-за чего
    // страница НИКОГДА не видела настоящее тело ответа сервера (с реальным
    // текстом ошибки от Flask, например "chat_id, sender_id and image are
    // required"), а получала лишь общий "API response status: 400" —
    // отлаживать реальную причину было невозможно. Теперь просто отдаём
    // ответ как есть и для успешных, и для ошибочных (4xx/5xx) статусов —
    // страница сама разберёт JSON с полем error.
    return networkResponse;
  } catch (error) {
    // Сюда попадаем только при реальном сетевом сбое (нет соединения,
    // DNS и т.п.) — сервер вообще не ответил.
    console.error('❌ TheVuntgram: API request failed (network error):', error);

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


// В функции handleFetch добавьте:
async function handleFetch(request) {
  const url = new URL(request.url);
  
  // Для аватаров - Cache First с сетевой проверкой
  if (isAvatarRequest(request)) {
    return handleAvatarRequest(request);
  }
  
  // Остальная логика...
}

function isAvatarRequest(request) {
  const url = new URL(request.url);
  return url.pathname.includes('/avatar/');
}

async function handleAvatarRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  // Всегда пробуем сеть для аватаров, но возвращаем из кэша мгновенно
  if (cachedResponse) {
    // Фоновая проверка обновления
    updateAvatarInBackground(request, cache);
    return cachedResponse;
  }
  
  // Если нет в кэше - загружаем
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Кэшируем аватар
      cache.put(request, networkResponse.clone());
      return networkResponse;
    }
    
    throw new Error('Avatar network request failed');
  } catch (error) {
    // Можно вернуть дефолтный аватар
    return createDefaultAvatarResponse();
  }
}

async function updateAvatarInBackground(request, cache) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      // Проверяем изменился ли аватар
      const cachedResponse = await cache.match(request);
      
      if (!cachedResponse || hasAvatarChanged(cachedResponse, networkResponse)) {
        // Обновляем кэш если аватар изменился
        cache.put(request, networkResponse);
        console.log('🔄 Service Worker: Avatar updated');
        
        // Уведомляем клиент об обновлении аватара
        notifyClientsAboutAvatarUpdate(request.url);
      }
    }
  } catch (error) {
    // Игнорируем ошибки фонового обновления
  }
}

function hasAvatarChanged(cachedResponse, networkResponse) {
  // Сравниваем ETag или Last-Modified
  const cachedETag = cachedResponse.headers.get('ETag');
  const networkETag = networkResponse.headers.get('ETag');
  
  const cachedLastModified = cachedResponse.headers.get('Last-Modified');
  const networkLastModified = networkResponse.headers.get('Last-Modified');
  
  return cachedETag !== networkETag || cachedLastModified !== networkLastModified;
}

async function notifyClientsAboutAvatarUpdate(avatarUrl) {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'AVATAR_UPDATED',
      url: avatarUrl
    });
  });
}

function createDefaultAvatarResponse() {
  // SVG градиент как fallback
  const svg = `
    <svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#0088cc;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#40a7e3;stop-opacity:1" />
        </linearGradient>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#grad)" stroke="#ffffff" stroke-width="2"/>
    </svg>
  `;
  
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}


// ============================
// PUSH-УВЕДОМЛЕНИЯ
// ============================

// Приходит push-событие от сервера (через Web Push API)
self.addEventListener('push', (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Vuntgram', body: event.data ? event.data.text() : 'Новое сообщение' };
  }

  // "Тихий" служебный пуш от сервера: сообщения чата были помечены
  // прочитанными (пользователь открыл чат — возможно, на ДРУГОМ устройстве,
  // или это устройство было свёрнуто/заблокировано, когда чат прочитали) —
  // нужно САМИМ закрыть уже показанное уведомление этого чата, не показывая
  // пользователю ничего нового.
  if (data.type === 'read_receipt') {
    event.waitUntil(handleReadReceiptPush(data));
    return;
  }

  const title = data.title || 'Vuntgram';
  const options = {
    body: data.body || 'Новое сообщение',
    icon: data.icon || '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: data.tag || 'vuntgram-message',
    data: {
      url: data.url || '/'
    },
    vibrate: [100, 50, 100],
    renotify: true,
    requireInteraction: false
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      updateAppBadge(data.unreadCount)
    ])
  );
});

// ---------------------------------------------------------
// Обработка "тихого" read_receipt пуша.
//
// Браузеры (особенно Chrome) требуют показывать notification на КАЖДЫЙ
// push, который приходит на "userVisibleOnly: true" подписку — иначе после
// нескольких "молчаливых" пушей подряд они либо сами покажут дженерик-
// уведомление вида "Сайт обновился в фоне", либо в перспективе отзовут
// разрешение на push у сайта. Поэтому мы не можем просто взять и НЕ
// показать notification.
//
// Стандартный обходной путь: показать notification с тем же tag, что и у
// уже показанного (браузер заменит/схлопнет его в тот же объект), и сразу
// же его закрыть в этом же push-событии — с точки зрения пользователя
// никакого нового уведомления не появляется, а старое реально исчезает,
// в т.ч. когда страница/приложение сейчас вообще не открыты.
// ---------------------------------------------------------
async function handleReadReceiptPush(data) {
  const tag = data.tag;

  if (tag) {
    try {
      await self.registration.showNotification('', {
        tag,
        silent: true,
        requireInteraction: false,
        renotify: false
      });
    } catch (err) {
      console.warn('⚠️ TheVuntgram: showNotification (read_receipt) failed', err);
    }

    try {
      const notifications = await self.registration.getNotifications({ tag });
      notifications.forEach((n) => n.close());
    } catch (err) {
      console.warn('⚠️ TheVuntgram: не удалось закрыть уведомления по tag', tag, err);
    }
  }

  await updateAppBadge(data.unreadCount);
}

// ---------------------------------------------------------
// Badging API — красный значок с числом на иконке приложения.
// Работает только для установленного PWA (как и сами push-уведомления
// на iOS), и только в браузерах, где есть navigator.setAppBadge —
// поэтому всегда проверяем наличие метода перед вызовом.
// ---------------------------------------------------------
async function updateAppBadge(unreadCount) {
  if (!('setAppBadge' in self.navigator)) return;

  try {
    if (typeof unreadCount === 'number' && unreadCount > 0) {
      await self.navigator.setAppBadge(unreadCount);
    } else if (unreadCount === 0) {
      // Явный ноль — все сообщения прочитаны, снимаем значок
      await self.navigator.clearAppBadge();
    } else {
      // unreadCount не пришёл с сервера (null/undefined) — ставим
      // значок без числа, просто как индикатор "есть новое"
      await self.navigator.setAppBadge();
    }
  } catch (err) {
    console.warn('⚠️ TheVuntgram: setAppBadge failed', err);
  }
}

// Клик по уведомлению — открываем нужный чат (или фокусируем уже открытую вкладку)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  // Клик по уведомлению = пользователь открывает чат, значок больше не нужен.
  // Если непрочитанных сообщений из ДРУГИХ чатов ещё остаётся, следующий
  // push всё равно пришлёт актуальный unreadCount и выставит бейдж заново.
  updateAppBadge(0);

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      // Если вкладка с сайтом уже открыта — фокусируем её и переходим по нужному пути
      for (const client of clientsArr) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Иначе открываем новое окно/PWA
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

// Клиентская страница сообщает service worker'у, какой пользователь сейчас
// авторизован — нужно, чтобы пересоздать подписку после её истечения
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_USER_ID') {
    self.__vuntgramUserId = event.data.userId;
  }

  // Клиент сам знает актуальное число непрочитанных (например, после
  // открытия чата или фонового опроса /get_chats) и может попросить
  // service worker пересчитать бейдж, не дожидаясь следующего push
  if (event.data && event.data.type === 'SET_BADGE') {
    updateAppBadge(event.data.unreadCount);
  }

  if (event.data && event.data.type === 'CLEAR_BADGE') {
    updateAppBadge(0);
  }

  // Раздел "Уведомления" в profile.html спрашивает активный service worker,
  // поддерживает ли он push-уведомления, чтобы отличить пользователей со
  // старой версией PWA (установлена ДО того, как появился push-код) от
  // тех, у кого уже актуальная версия. Старый service worker, закэшированный
  // на устройстве пользователя, ничего не знает об этом сообщении и просто
  // не ответит — именно по отсутствию ответа клиент и определяет "старую версию".
  if (event.data && event.data.type === 'GET_SW_VERSION') {
    const reply = { type: 'SW_VERSION', version: CACHE_NAME, supportsPush: true };
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage(reply);
    } else if (event.source) {
      event.source.postMessage(reply);
    }
  }
});

// Бэкенд на другом домене (Render), а service worker обслуживает домен
// фронтенда (Vercel) — относительный путь fetch('/save_push_subscription')
// уходил бы на сам Vercel, где такого маршрута нет.
const PUSH_API_BASE = 'https://vuntserver-479v.onrender.com';

// Подписка была отозвана браузером (например, истёк срок) — уведомляем сервер
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
      .catch((err) => console.error('❌ TheVuntgram: pushsubscriptionchange resubscribe failed', err))
  );
});


// Офлайн страница
async function showOfflinePage() {
  const cache = await caches.open(CACHE_NAME);
  const offlinePage = await cache.match('/offline.html');
  
  if (offlinePage) {
    return offlinePage;
  }
  
  return new Response('Offline', { status: 503 });
}
