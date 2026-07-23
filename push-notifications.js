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
    const notifications = await registration.getNotifications({ tag: `chat-${chatId}` });
    notifications.forEach((n) => n.close());
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
