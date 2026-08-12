// push-notifications.js
// Подключите этот файл на страницах после того, как известен platform_user_id
// (например, сразу после логина / на chats.html), но ПЕРЕД вызовом initPushNotifications().
//
// <script src="/push-notifications.js"></script>
// <script>
//   document.addEventListener('DOMContentLoaded', () => {
//     initPushNotifications(currentUser.platform_user_id);
//   });
// </script>

const API_BASE = 'https://vuntserverrr.site'; // бэкенд на Render, фронтенд на Vercel — домены разные

// ---------------------------------------------------------
// ЛОКАЛЬНЫЙ МЬЮТ ЧАТА ("Звук" в профиле контакта)
//
// Хранится ТОЛЬКО на этом устройстве, в localStorage — на сервер ничего не
// уходит, на других устройствах пользователя уведомления продолжают
// приходить. Список дублируется в IndexedDB service worker'а (через
// postMessage), потому что именно SW решает, показывать ли пуш, и делает
// это в том числе когда ни одной вкладки не открыто.
//
// Ключуем по platform_user_id собеседника (работает даже если чата ещё нет),
// плюс, если чат известен, по chat_id — как подстраховка для пушей без
// senderId.
// ---------------------------------------------------------
const VG_MUTED_USERS_KEY = 'vg_muted_users_v1';
const VG_MUTED_CHATS_KEY = 'vg_muted_chats_v1';

function vgReadMutedList(key) {
  try {
    const raw = localStorage.getItem(key);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch (e) {
    return [];
  }
}

function vgWriteMutedList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(Array.from(new Set(list.map(String)))));
  } catch (e) {
    console.warn('⚠️ Не удалось сохранить список чатов без звука:', e);
  }
}

// Выключен ли звук у этого собеседника (userId) или чата (chatId)
function vgIsMuted(userId, chatId) {
  const users = vgReadMutedList(VG_MUTED_USERS_KEY);
  const chats = vgReadMutedList(VG_MUTED_CHATS_KEY);
  if (userId != null && users.includes(String(userId))) return true;
  if (chatId != null && chats.includes(String(chatId))) return true;
  return false;
}

// Переключает мьют и возвращает новое состояние (true = без звука)
function vgToggleMuted(userId, chatId) {
  const nowMuted = !vgIsMuted(userId, chatId);
  let users = vgReadMutedList(VG_MUTED_USERS_KEY);
  let chats = vgReadMutedList(VG_MUTED_CHATS_KEY);

  if (nowMuted) {
    if (userId != null) users.push(String(userId));
    if (chatId != null) chats.push(String(chatId));
  } else {
    if (userId != null) users = users.filter(id => id !== String(userId));
    if (chatId != null) chats = chats.filter(id => id !== String(chatId));
  }

  vgWriteMutedList(VG_MUTED_USERS_KEY, users);
  vgWriteMutedList(VG_MUTED_CHATS_KEY, chats);
  vgSyncMutedToSW();
  return nowMuted;
}

// Отдаём актуальный список service worker'у
async function vgSyncMutedToSW() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const target = registration.active || navigator.serviceWorker.controller;
    if (!target) return;
    target.postMessage({
      type: 'SET_MUTED',
      users: vgReadMutedList(VG_MUTED_USERS_KEY),
      chats: vgReadMutedList(VG_MUTED_CHATS_KEY)
    });
  } catch (err) {
    console.warn('⚠️ Не удалось синхронизировать список без звука с service worker:', err);
  }
}

window.vgIsMuted = vgIsMuted;
window.vgToggleMuted = vgToggleMuted;
window.vgSyncMutedToSW = vgSyncMutedToSW;

// ---------------------------------------------------------
// Преобразование VAPID public key (base64url) в Uint8Array
// ---------------------------------------------------------
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ---------------------------------------------------------
// Определяем, запущено ли приложение как установленный PWA
// (на iOS push работает ТОЛЬКО в этом режиме!)
// ---------------------------------------------------------
function isRunningAsInstalledPWA() {
  const isStandaloneDisplay = window.matchMedia('(display-mode: standalone)').matches;
  const isIOSStandalone = window.navigator.standalone === true; // Safari-специфичное свойство
  return isStandaloneDisplay || isIOSStandalone;
}

// Названа isIOSDevice (не isIOS), т.к. на некоторых страницах сайта (например,
// index.html) уже объявлена своя глобальная `const isIOS` — все <script> на
// странице делят один и тот же global scope, и одинаковое имя вызывало
// SyntaxError "Identifier 'isIOS' has already been declared", из-за которого
// весь скрипт логина переставал выполняться (пустой экран вместо формы входа).
function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

// ---------------------------------------------------------
// Основная функция — вызывайте её при логине / открытии приложения
// ---------------------------------------------------------
async function initPushNotifications(userId) {

  if (!userId) {
    console.warn('⚠️ initPushNotifications: не передан userId');
    return;
  }

  // Нужен для visibilitychange-хендлера, который синхронизирует бейдж
  // при возврате в приложение
  window.__vuntgramCurrentUserId = userId;

  // Актуализируем бейдж сразу при инициализации — на случай, если пуш
  // пришёл, пока приложение было полностью закрыто, и его никто не открывал
  // кликом по самому уведомлению
  syncAppBadge(userId);

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('⚠️ Push-уведомления не поддерживаются этим браузером');
    return;
  }

  // На iOS уведомления работают только после установки PWA на экран "Домой"
  if (isIOSDevice() && !isRunningAsInstalledPWA()) {
    console.log('ℹ️ iOS: сайт открыт в Safari, а не как установленное приложение — пропускаем подписку');
    showInstallPromptForIOS();
    return;
  }

  // register() безопасно вызывать повторно — если SW уже зарегистрирован
  // на этой странице (например, в отдельном скрипте), браузер просто
  // вернёт существующую регистрацию и ничего не переустановит
  let registration;
  try {
    registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  } catch (err) {
    console.error('❌ Не удалось зарегистрировать service worker:', err);
    return;
  }
  registration = await navigator.serviceWorker.ready;

  // Сообщаем service worker'у, кто сейчас авторизован (нужно для
  // автоматического пересоздания подписки, если она протухнет)
  if (registration.active) {
    registration.active.postMessage({ type: 'SET_USER_ID', userId });
  }

  // Отдаём SW локальный список "без звука" — он мог измениться на другой
  // странице или в другой сессии, а SW-хранилище живёт отдельно
  vgSyncMutedToSW();

  // Если уже есть активная подписка — просто убеждаемся, что сервер её знает
  const existingSubscription = await registration.pushManager.getSubscription();
  if (existingSubscription) {
    await sendSubscriptionToServer(userId, existingSubscription);
    return;
  }

  // Разрешение стоит запрашивать по явному действию пользователя
  // (клик на кнопку "Включить уведомления"), иначе многие браузеры
  // просто отклонят автоматический запрос. Показываем кнопку, если
  // разрешение ещё не выдано.
  if (Notification.permission === 'default') {
    showEnableNotificationsButton(userId, registration);
    return;
  }

  if (Notification.permission === 'granted') {
    await subscribeAndSend(userId, registration);
  }
  // Если 'denied' — молча ничего не делаем, пользователь сам отключил уведомления в настройках
}

async function subscribeAndSend(userId, registration) {
  try {
    const vapidRes = await fetch(`${API_BASE}/vapid_public_key`);
    const vapidData = await vapidRes.json();

    if (vapidData.status !== 'success') {
      console.error('❌ Не удалось получить VAPID ключ');
      return;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
    });

    await sendSubscriptionToServer(userId, subscription);
    console.log('✅ Подписка на push оформлена');
  } catch (err) {
    console.error('❌ Ошибка подписки на push:', err);
  }
}

async function sendSubscriptionToServer(userId, subscription) {
  try {
    await fetch(`${API_BASE}/save_push_subscription`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        user_id: userId,
        subscription: subscription.toJSON()
      })
    });
  } catch (err) {
    console.error('❌ Не удалось отправить подписку на сервер:', err);
  }
}

// ---------------------------------------------------------
// Синхронизация бейджа (значка на иконке) и системных уведомлений.
//
// Push обновляет бейдж только в момент ПРИХОДА нового сообщения — но когда
// пользователь читает сообщения внутри уже открытого приложения (а не через
// клик по самому пуш-уведомлению), ни бейдж, ни уведомление на экране
// блокировки сами не пропадают. Эти функции нужно вызывать вручную:
//
// 1) syncAppBadge(userId)          — при загрузке страницы, при возврате
//    фокуса на вкладку/PWA (visibilitychange), и сразу после успешного
//    /mark_as_read или /mark_all_as_read
// 2) closeNotificationsForChat(id) — сразу после того, как пользователь
//    открыл конкретный чат и его сообщения помечены прочитанными
// ---------------------------------------------------------

async function syncAppBadge(userId) {
  if (!userId || !('serviceWorker' in navigator)) return;

  try {
    const res = await fetch(`${API_BASE}/get_unread_count`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ platform_user_id: userId })
    });
    const data = await res.json();
    if (data.status !== 'success') return;

    const registration = await navigator.serviceWorker.ready;
    if (registration.active) {
      registration.active.postMessage({ type: 'SET_BADGE', unreadCount: data.unread_count });
    }
  } catch (err) {
    console.warn('⚠️ Не удалось синхронизировать бейдж:', err);
  }
}

// Закрывает уведомления в системном трее/на экране блокировки для
// конкретного чата — вызывайте это сразу после того, как пользователь
// открыл чат (например, там же, где вы вызываете mark_as_read)
async function closeNotificationsForChat(chatId) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const targetTag = `chat-${chatId}`;

    // ВАЖНО: фильтр { tag } в getNotifications() поддерживается не везде
    // одинаково — на iOS Safari/PWA и части старых Android WebView он может
    // молча вернуть пустой массив, даже когда уведомление реально показано
    // в шторке/на экране блокировки. Раньше именно из-за этого уведомление
    // "простого прочтения" чата не закрывалось — closeNotificationsForChat
    // ничего не находил и не вызывал close(). Поэтому теперь всегда берём
    // ВСЕ показанные уведомления без фильтра и сравниваем tag сами (плюс
    // подстраховка по data.url — там сервер кладёт /chats.html?chat_id=...).
    const notifications = await registration.getNotifications();
    let closedCount = 0;
    notifications.forEach((n) => {
      const matchesTag = n.tag === targetTag;
      const matchesUrl = n.data && typeof n.data.url === 'string' && n.data.url.includes(`chat_id=${chatId}`);
      if (matchesTag || matchesUrl) {
        n.close();
        closedCount++;
      }
    });
    if (closedCount === 0) {
      console.warn(`⚠️ closeNotificationsForChat: не нашли уведомлений с tag=${targetTag} (chatId=${chatId})`);
    }
  } catch (err) {
    console.warn('⚠️ Не удалось закрыть уведомления чата:', err);
  }
}

// Закрывает вообще все показанные уведомления приложения (например, при
// разлогине или на странице со списком всех чатов после mark_all_as_read)
async function closeAllNotifications() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const notifications = await registration.getNotifications();
    notifications.forEach((n) => n.close());
  } catch (err) {
    console.warn('⚠️ Не удалось закрыть уведомления:', err);
  }
}

// Держим бейдж свежим, когда пользователь возвращается в приложение —
// покрывает случай "пришло уведомление, пока телефон был заблокирован,
// пользователь потом сам открыл приложение (не через тап по уведомлению)"
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && window.__vuntgramCurrentUserId) {
    syncAppBadge(window.__vuntgramCurrentUserId);
  }
});

// ---------------------------------------------------------
// UI: кнопка "Включить уведомления" — permission можно запрашивать
// только по прямому клику пользователя
// ---------------------------------------------------------
function showEnableNotificationsButton(userId, registration) {
  // Не показываем повторно, если пользователь уже закрывал баннер в этой сессии
  if (sessionStorage.getItem('push_prompt_dismissed') === '1') {
    return;
  }
  if (document.getElementById('vuntgram-push-banner')) {
    return;
  }

  const banner = document.createElement('div');
  banner.id = 'vuntgram-push-banner';
  banner.style.cssText = `
    position: fixed; bottom: 16px; left: 16px; right: 16px; z-index: 9999;
    background: #2d5e4f; color: #fff; padding: 14px 16px; border-radius: 12px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25); font-family: sans-serif; font-size: 14px;
  `;
  banner.innerHTML = `
    <span>Включить уведомления о новых сообщениях?</span>
    <div style="display:flex; gap:8px; flex-shrink:0;">
      <button id="vuntgram-push-allow" style="background:#fff;color:#2d5e4f;border:none;padding:8px 14px;border-radius:8px;font-weight:600;">Включить</button>
      <button id="vuntgram-push-dismiss" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.5);padding:8px 14px;border-radius:8px;">Позже</button>
    </div>
  `;
  document.body.appendChild(banner);

  document.getElementById('vuntgram-push-allow').addEventListener('click', async () => {
    banner.remove();
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      await subscribeAndSend(userId, registration);
    }
  });

  document.getElementById('vuntgram-push-dismiss').addEventListener('click', () => {
    sessionStorage.setItem('push_prompt_dismissed', '1');
    banner.remove();
  });
}

// ---------------------------------------------------------
// UI: подсказка для iOS-пользователей, у которых сайт открыт в Safari,
// а не установлен на экран "Домой"
// ---------------------------------------------------------
function showInstallPromptForIOS() {
  if (localStorage.getItem('ios_install_hint_dismissed') === '1') return;
  if (document.getElementById('vuntgram-ios-banner')) return;

  const banner = document.createElement('div');
  banner.id = 'vuntgram-ios-banner';
  banner.style.cssText = `
    position: fixed; bottom: 16px; left: 16px; right: 16px; z-index: 9999;
    background: #1a3a30; color: #fff; padding: 14px 16px; border-radius: 12px;
    font-family: sans-serif; font-size: 13px; line-height: 1.4;
    box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  `;
  banner.innerHTML = `
    <div style="margin-bottom:8px;">
      Чтобы получать уведомления на iPhone, добавьте сайт на экран «Домой»:
      нажмите <b>Поделиться</b> ⬆️ внизу экрана, затем «На экран Домой».
    </div>
    <button id="vuntgram-ios-dismiss" style="background:transparent;color:#fff;border:1px solid rgba(255,255,255,0.5);padding:6px 12px;border-radius:8px;">Понятно</button>
  `;
  document.body.appendChild(banner);

  document.getElementById('vuntgram-ios-dismiss').addEventListener('click', () => {
    localStorage.setItem('ios_install_hint_dismissed', '1');
    banner.remove();
  });
}
