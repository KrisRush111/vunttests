// mic-permission.js
// Управление доступом к микрофону для голосовых сообщений — по той же логике,
// что и уведомления: системную рамку браузер показывает только по явному
// действию пользователя, а дальше человек сам включает/выключает микрофон
// переключателем в настройках приложения.
//
// Подключение (на каждой странице, где нужен микрофон или настройки):
//   <script src="/mic-permission.js"></script>
//
// Раздел в настройках (например, в profile.html):
//   <div id="vgMicSettings"></div>
//   <script>vgMic.mountSettings(document.getElementById('vgMicSettings'));</script>
//
// ВАЖНО: весь код в IIFE — без верхнеуровневых const/let (см. комментарий
// в push-notifications.js про общий глобальный scope классических <script>).
(function () {
  if (window.vgMic) return;

  // Ответ системы, запомненный на устройстве: 'granted' | 'denied'
  var ANSWER_KEY = 'vg_mic_permission';
  // Пользователь сам выключил микрофон в настройках Vuntgram: '1'
  var OFF_KEY = 'vg_mic_disabled';

  var permState = null;       // что сообщает Permissions API: granted / denied / prompt / null
  var listeners = [];

  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {}
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }
  function isAndroid() { return /Android/i.test(navigator.userAgent || ''); }
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
           window.navigator.standalone === true;
  }

  function supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia &&
              typeof MediaRecorder !== 'undefined' && window.isSecureContext !== false);
  }

  // Итоговое состояние (синхронно — нужно прямо в обработчике нажатия):
  //   'unsupported' — браузер не умеет записывать звук
  //   'disabled'    — выключено переключателем в Vuntgram
  //   'denied'      — запрещено системой/браузером (менять в настройках устройства)
  //   'granted'     — разрешено
  //   'prompt'      — ещё не спрашивали
  function state() {
    if (!supported()) return 'unsupported';
    if (lsGet(OFF_KEY) === '1') return 'disabled';
    if (permState === 'granted') return 'granted';
    if (permState === 'denied') return 'denied';
    var saved = lsGet(ANSWER_KEY);
    if (saved === 'denied') return 'denied';
    if (saved === 'granted') return 'granted';
    return 'prompt';
  }

  function emit() {
    var s = state();
    listeners.slice().forEach(function (fn) { try { fn(s); } catch (e) {} });
    try { window.dispatchEvent(new CustomEvent('vg-mic-changed', { detail: { state: s } })); } catch (e) {}
  }

  function applyPermState(s) {
    permState = s;
    // Включили доступ в настройках устройства — снимаем запомненный запрет
    if (s === 'granted') lsSet(ANSWER_KEY, 'granted');
    else if (s === 'denied') lsSet(ANSWER_KEY, 'denied');
    emit();
  }

  // Permissions API есть не везде (старый Safari/Firefox) — тогда опираемся
  // только на запомненный ответ.
  var permStatusObj = null;
  function refresh() {
    try {
      if (!navigator.permissions || !navigator.permissions.query) return Promise.resolve(state());
      return navigator.permissions.query({ name: 'microphone' }).then(function (st) {
        if (!permStatusObj) {
          permStatusObj = st;
          st.onchange = function () { applyPermState(st.state); };
        }
        applyPermState(st.state);
        return state();
      }).catch(function () { return state(); });
    } catch (e) { return Promise.resolve(state()); }
  }

  function markGranted() { lsSet(ANSWER_KEY, 'granted'); emit(); }
  function markDenied() { lsSet(ANSWER_KEY, 'denied'); emit(); }

  // Запросить доступ. Вызывать ТОЛЬКО по нажатию пользователя (переключатель
  // в настройках), иначе браузер может отклонить запрос без рамки.
  // Микрофон включается на долю секунды и сразу выключается.
  function request() {
    if (!supported()) return Promise.resolve('unsupported');
    lsSet(OFF_KEY, null);
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      lsSet(ANSWER_KEY, 'granted');
      emit();
      return 'granted';
    }).catch(function (e) {
      if (e && (e.name === 'NotAllowedError' || e.name === 'SecurityError')) {
        lsSet(ANSWER_KEY, 'denied');
        emit();
        return 'denied';
      }
      emit();
      return 'error';
    });
  }

  // Выключить микрофон в Vuntgram. Системное разрешение сайт отозвать не может —
  // приложение просто перестаёт им пользоваться.
  function disable() { lsSet(OFF_KEY, '1'); emit(); }
  function enable() { lsSet(OFF_KEY, null); emit(); }

  function deviceHint() {
    if (isIOS()) {
      return isStandalone()
        ? 'Настройки iPhone → Приложения → Safari → Микрофон → «Разрешить». Затем закройте и снова откройте Vuntgram.'
        : 'Нажмите «аА» в адресной строке Safari → Настройки веб-сайта → Микрофон → «Разрешить».';
    }
    if (isAndroid()) {
      return isStandalone()
        ? 'Удерживайте значок Vuntgram → «О приложении» → Разрешения → Микрофон → «Разрешить только во время использования».'
        : 'Нажмите значок слева от адреса сайта → Разрешения → Микрофон → «Разрешить».';
    }
    return 'Нажмите значок замка слева от адреса сайта → Микрофон → «Разрешить» и обновите страницу.';
  }

  // Сообщение для экрана чата, когда записать нельзя (или null, если можно)
  function blockedMessage() {
    var s = state();
    if (s === 'unsupported') return 'Этот браузер не умеет записывать голосовые';
    if (s === 'disabled') return 'Микрофон выключен в настройках Vuntgram (Профиль → Микрофон)';
    if (s === 'denied') return 'Доступ к микрофону запрещён. ' + deviceHint();
    return null;
  }

  function onChange(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (f) { return f !== fn; }); };
  }

  // Изменения из другой вкладки / страницы
  window.addEventListener('storage', function (e) {
    if (!e.key || e.key === ANSWER_KEY || e.key === OFF_KEY) emit();
  });
  // Вернулись из настроек устройства — перепроверяем
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') refresh();
  });
  window.addEventListener('pageshow', function () { refresh(); });

  // ======================================================================
  //  РАЗДЕЛ НАСТРОЕК: «Микрофон» с переключателем
  // ======================================================================
  var CSS = '' +
    '.vg-mic-card{background:var(--telegram-bg,#fff);border-radius:24px;overflow:hidden;' +
      'box-shadow:0 1px 2px rgba(0,0,0,.05),0 8px 26px rgba(0,0,0,.06);font-family:inherit}' +
    '.vg-mic-row{display:flex;align-items:center;gap:12px;padding:12px 16px;cursor:pointer;' +
      '-webkit-tap-highlight-color:transparent;transition:background-color .18s ease}' +
    '.vg-mic-row:active{background:rgba(120,120,128,.10)}' +
    '.vg-mic-ico{flex:0 0 32px;width:32px;height:32px;border-radius:10px;display:flex;align-items:center;' +
      'justify-content:center;color:#fff;background:linear-gradient(135deg,#ff5f6d,#ff2d55);' +
      'box-shadow:0 4px 12px rgba(255,45,85,.35)}' +
    '.vg-mic-ico svg{width:18px;height:18px}' +
    '.vg-mic-text{flex:1;min-width:0}' +
    '.vg-mic-title{font-size:16px;font-weight:500;color:var(--telegram-text,#000)}' +
    '.vg-mic-sub{margin-top:2px;font-size:13px;line-height:1.3;color:var(--telegram-hint,#8e8e93)}' +
    '.vg-mic-sub.is-bad{color:#ff3b30}' +
    '.vg-mic-switch{position:relative;flex:0 0 51px;width:51px;height:31px;border-radius:999px;' +
      'background:rgba(120,120,128,.32);transition:background .25s ease}' +
    '.vg-mic-switch::after{content:"";position:absolute;top:2px;left:2px;width:27px;height:27px;border-radius:50%;' +
      'background:#fff;box-shadow:0 2px 6px rgba(0,0,0,.2);transition:transform .25s cubic-bezier(.3,1.3,.5,1)}' +
    '.vg-mic-row.is-on .vg-mic-switch{background:#34c759}' +
    '.vg-mic-row.is-on .vg-mic-switch::after{transform:translateX(20px)}' +
    '.vg-mic-row.is-busy .vg-mic-switch{opacity:.6}' +
    '.vg-mic-row.is-off-limits{cursor:default}' +
    '.vg-mic-row.is-off-limits .vg-mic-switch{opacity:.4}' +
    '.vg-mic-help{display:none;padding:0 16px 14px 60px;font-size:13px;line-height:1.4;color:var(--telegram-hint,#8e8e93)}' +
    '.vg-mic-card.show-help .vg-mic-help{display:block}' +
    '.vg-mic-help b{color:var(--telegram-text,#000);font-weight:600}' +
    '.vg-mic-retry{margin-top:10px;border:none;border-radius:999px;padding:8px 16px;font:inherit;font-size:14px;' +
      'font-weight:600;color:#fff;background:#0a84ff;cursor:pointer}' +
    '.vg-mic-retry:active{transform:scale(.96)}' +
    '@media (prefers-color-scheme: dark){.vg-mic-card{background:#1c1c1e;box-shadow:none}' +
      '.vg-mic-title,.vg-mic-help b{color:#fff}.vg-mic-switch{background:rgba(120,120,128,.4)}}';

  function injectCss() {
    if (document.getElementById('vg-mic-style')) return;
    var st = document.createElement('style');
    st.id = 'vg-mic-style';
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  var MIC_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2.5" width="6" height="12" rx="3"/>' +
    '<path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/></svg>';

  function mountSettings(container) {
    if (!container || container.__vgMic) return;
    container.__vgMic = true;
    injectCss();

    container.innerHTML =
      '<div class="vg-mic-card">' +
        '<div class="vg-mic-row" role="switch" tabindex="0">' +
          '<div class="vg-mic-ico">' + MIC_SVG + '</div>' +
          '<div class="vg-mic-text"><div class="vg-mic-title">Микрофон</div><div class="vg-mic-sub"></div></div>' +
          '<div class="vg-mic-switch"></div>' +
        '</div>' +
        '<div class="vg-mic-help"></div>' +
      '</div>';

    var card = container.querySelector('.vg-mic-card');
    var row = container.querySelector('.vg-mic-row');
    var sub = container.querySelector('.vg-mic-sub');
    var help = container.querySelector('.vg-mic-help');
    var busy = false;

    function paint() {
      var s = state();
      var on = s === 'granted';
      row.classList.toggle('is-on', on);
      row.classList.toggle('is-busy', busy);
      row.classList.toggle('is-off-limits', s === 'unsupported');
      row.setAttribute('aria-checked', on ? 'true' : 'false');
      sub.classList.toggle('is-bad', s === 'denied');
      card.classList.toggle('show-help', s === 'denied' || (on && isIOS() && isStandalone()));

      if (s === 'unsupported') sub.textContent = 'Этот браузер не умеет записывать голосовые';
      else if (s === 'granted') sub.textContent = 'Разрешён — голосовые записываются сразу';
      else if (s === 'disabled') sub.textContent = 'Выключен в Vuntgram';
      else if (s === 'denied') sub.textContent = 'Запрещён в настройках устройства';
      else sub.textContent = 'Включите, чтобы записывать голосовые';

      if (s === 'denied') {
        help.innerHTML = 'Сайт не может показать запрос повторно — разрешите доступ вручную:<br>' +
          '<b>' + deviceHint() + '</b><br><button type="button" class="vg-mic-retry">Проверить снова</button>';
      } else if (on && isIOS() && isStandalone()) {
        help.innerHTML = 'Если iPhone снова спрашивает разрешение после перезапуска, выберите ' +
          '<b>Настройки → Приложения → Safari → Микрофон → «Разрешить»</b>.';
      } else {
        help.innerHTML = '';
      }
      var retry = help.querySelector('.vg-mic-retry');
      if (retry) retry.addEventListener('click', function (e) { e.stopPropagation(); toggleOn(); });
    }

    function toggleOn() {
      if (busy) return;
      busy = true; paint();
      request().then(function (res) {
        busy = false; paint();
        if (res === 'error') alert('Не удалось включить микрофон. Проверьте, что он подключён и не занят другим приложением.');
      });
    }

    function onTap() {
      if (busy) return;
      var s = state();
      if (s === 'unsupported') return;
      if (s === 'granted') { disable(); return; }
      if (s === 'disabled' && lsGet(ANSWER_KEY) === 'granted' && permState !== 'denied') {
        enable();                    // система уже разрешила — рамка не нужна
        return;
      }
      toggleOn();                    // prompt / denied / disabled без разрешения
    }

    row.addEventListener('click', onTap);
    row.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(); }
    });

    onChange(paint);
    paint();
    refresh();
  }

  window.vgMic = {
    state: state,
    refresh: refresh,
    request: request,
    enable: enable,
    disable: disable,
    markGranted: markGranted,
    markDenied: markDenied,
    blockedMessage: blockedMessage,
    deviceHint: deviceHint,
    onChange: onChange,
    mountSettings: mountSettings
  };

  refresh();
})();
