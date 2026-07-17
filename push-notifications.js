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

// ---------------------------------------------------------
// ВРЕМЕННАЯ отладочная панель — показывает на самом экране, на каком шаге
// останавливается процесс подписки. Полезно для устройств без доступа к
// консоли (iPhone без Mac рядом). Уберите этот блок и все debugLog(...)
// вызовы ниже, когда всё заработает.
// ---------------------------------------------------------
function debugLog(msg) {
  console.log('[push-debug] ' + msg);
  let panel = document.getElementById('vuntgram-push-debug');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'vuntgram-push-debug';
    panel.style.cssText = `
      position: fixed; top: 8px; left: 8px; right: 8px; z-index: 999999;
      background: rgba(0,0,0,0.85); color: #0f0; font-family: monospace;
      font-size: 11px; line-height: 1.5; padding: 10px; border-radius: 8px;
      max-height: 40vh; overflow-y: auto; white-space: pre-wrap;
    `;
    document.body.appendChild(panel);
  }
  const line = document.createElement('div');
  line.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
  panel.appendChild(line);
}

const API_BASE = 'https://vuntserver-479v.onrender.com'; // бэкенд на Render, фронтенд на Vercel — домены разные

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
  debugLog('initPushNotifications вызвана, userId=' + userId);

  if (!userId) {
    debugLog('❌ СТОП: userId не передан');
    console.warn('⚠️ initPushNotifications: не передан userId');
    return;
  }

  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    debugLog('❌ СТОП: serviceWorker или PushManager не поддерживаются этим браузером');
    console.warn('⚠️ Push-уведомления не поддерживаются этим браузером');
    return;
  }
  debugLog('serviceWorker и PushManager поддерживаются ✓');

  debugLog('isIOSDevice=' + isIOSDevice() + ', isRunningAsInstalledPWA=' + isRunningAsInstalledPWA() +
    ', standalone(matchMedia)=' + window.matchMedia('(display-mode: standalone)').matches +
    ', navigator.standalone=' + window.navigator.standalone);

  // На iOS уведомления работают только после установки PWA на экран "Домой"
  if (isIOSDevice() && !isRunningAsInstalledPWA()) {
    debugLog('СТОП: iOS + не установлено как PWA — показываю install-подсказку');
    console.log('ℹ️ iOS: сайт открыт в Safari, а не как установленное приложение — пропускаем подписку');
    showInstallPromptForIOS();
    return;
  }

  // register() безопасно вызывать повторно — если SW уже зарегистрирован
  // на этой странице (например, в отдельном скрипте), браузер просто
  // вернёт существующую регистрацию и ничего не переустановит
  let registration;
  try {
    debugLog('Регистрирую service worker...');
    registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
    debugLog('service worker зарегистрирован ✓');
  } catch (err) {
    debugLog('❌ СТОП: ошибка регистрации SW: ' + err.message);
    console.error('❌ Не удалось зарегистрировать service worker:', err);
    return;
  }
  registration = await navigator.serviceWorker.ready;
  debugLog('service worker готов (ready) ✓');

  // Сообщаем service worker'у, кто сейчас авторизован (нужно для
  // автоматического пересоздания подписки, если она протухнет)
  if (registration.active) {
    registration.active.postMessage({ type: 'SET_USER_ID', userId });
  }

  // Если уже есть активная подписка — просто убеждаемся, что сервер её знает
  const existingSubscription = await registration.pushManager.getSubscription();
  debugLog('existingSubscription=' + (existingSubscription ? 'ЕСТЬ (уже подписан)' : 'нет'));
  if (existingSubscription) {
    debugLog('Отправляю уже существующую подписку на сервер...');
    await sendSubscriptionToServer(userId, existingSubscription);
    debugLog('Готово (existingSubscription отправлена)');
    return;
  }

  debugLog('Notification.permission = "' + Notification.permission + '"');

  // Разрешение стоит запрашивать по явному действию пользователя
  // (клик на кнопку "Включить уведомления"), иначе многие браузеры
  // просто отклонят автоматический запрос. Показываем кнопку, если
  // разрешение ещё не выдано.
  if (Notification.permission === 'default') {
    debugLog('Показываю баннер "Включить уведомления"...');
    showEnableNotificationsButton(userId, registration);
    return;
  }

  if (Notification.permission === 'granted') {
    debugLog('Разрешение уже granted — тихо оформляю подписку...');
    await subscribeAndSend(userId, registration);
  }
  // Если 'denied' — молча ничего не делаем, пользователь сам отключил уведомления в настройках
}

async function subscribeAndSend(userId, registration) {
  try {
    debugLog('Запрашиваю VAPID-ключ с сервера...');
    const vapidRes = await fetch(`${API_BASE}/vapid_public_key`);
    const vapidData = await vapidRes.json();
    debugLog('VAPID-ключ получен, status=' + vapidData.status);

    if (vapidData.status !== 'success') {
      debugLog('❌ СТОП: сервер не вернул success для VAPID-ключа');
      console.error('❌ Не удалось получить VAPID ключ');
      return;
    }

    debugLog('Вызываю pushManager.subscribe() (тут должно появиться системное окно)...');
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidData.publicKey)
    });
    debugLog('Подписка браузера оформлена ✓, отправляю на сервер...');

    await sendSubscriptionToServer(userId, subscription);
    debugLog('✅ ГОТОВО: подписка сохранена на сервере');
    console.log('✅ Подписка на push оформлена');
  } catch (err) {
    debugLog('❌ ОШИБКА в subscribeAndSend: ' + err.name + ': ' + err.message);
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
// UI: кнопка "Включить уведомления" — permission можно запрашивать
// только по прямому клику пользователя
// ---------------------------------------------------------
function showEnableNotificationsButton(userId, registration) {
  // Не показываем повторно, если пользователь уже закрывал баннер в этой сессии
  if (sessionStorage.getItem('push_prompt_dismissed') === '1') {
    debugLog('❌ СТОП: баннер уже был закрыт в этой сессии (sessionStorage push_prompt_dismissed=1)');
    return;
  }
  if (document.getElementById('vuntgram-push-banner')) {
    debugLog('Баннер уже есть на странице, повторно не создаю');
    return;
  }
  debugLog('Создаю баннер "Включить уведомления" и добавляю в DOM...');

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
    debugLog('Нажали "Включить", вызываю Notification.requestPermission()...');
    const permission = await Notification.requestPermission();
    debugLog('Notification.requestPermission() вернул: ' + permission);
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
