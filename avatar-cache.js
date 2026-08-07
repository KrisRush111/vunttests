/**
 * AvatarCache — локальное (постоянное, между открытиями страницы) хранение
 * аватарок пользователей в IndexedDB.
 *
 * Логика:  
 *  1) При рендере аватарки СРАЗУ показываем то, что уже сохранено локально —
 *     без единого сетевого запроса (мгновенное отображение "как обои чатов").
 *  2) В фоне спрашиваем у сервера лёгкий эндпоинт /avatar_version/<id>,
 *     который возвращает только короткий хэш текущей аватарки, а не саму
 *     картинку. Если хэш совпадает с тем, что хранится локально — ничего
 *     не перезагружаем и не перерисовываем.
 *  3) Если хэш отличается (или локальной копии не было вовсе) — качаем
 *     реальное фото с /avatar/<id>, обновляем изображение на экране "в
 *     реальном времени" и сохраняем его локально вместе с новым хэшем.
 *  4) Если у пользователя аватарки больше нет (has_avatar = false) —
 *     локальная копия удаляется и показывается плейсхолдер с инициалами.
 */
const AvatarCache = (function () {
    const DB_NAME = 'vuntgram_avatars_db';
    const DB_VERSION = 1;
    const STORE = 'avatars';

    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'userId' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    const LS_PREFIX = 'vg_avatar_';

    // ------------------------------------------------------------------
    // Размер запрашиваемой картинки (борьба с размытыми аватарками)
    // ------------------------------------------------------------------
    // Раньше клиент всегда качал /avatar/<id> без параметров, а сервер
    // жёстко отдавал 300x300. Один и тот же файл использовался и для
    // кружка 50x50 в списке чатов, и для аватара 100x100 в профиле, и
    // для раскрытого фото на всю ширину экрана. На телефоне с
    // devicePixelRatio 3 даже 100 CSS-px требуют 300 РЕАЛЬНЫХ пикселей,
    // то есть 300px-файл уже работал на пределе, а в раскрытом виде
    // растягивался в 4+ раза — отсюда мыло.
    //
    // Теперь размер считается по реальному размеру элемента и плотности
    // экрана, округляется до "ступеньки" (чтобы не плодить сотни
    // вариантов в кэше Cloudinary) и передаётся серверу как ?size&dpr.
    const SIZE_BUCKETS = [64, 128, 192, 256, 384, 512, 768, 1000];

    function screenDpr() {
        const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
        return Math.min(Math.max(dpr, 1), 3);
    }

    function bucketFor(cssSize) {
        const needed = Math.ceil((cssSize || 100) * screenDpr());
        for (const b of SIZE_BUCKETS) {
            if (b >= needed) return b;
        }
        return SIZE_BUCKETS[SIZE_BUCKETS.length - 1];
    }

    // Размер элемента может быть ещё неизвестен (элемент скрыт в модалке и
    // offsetWidth === 0) — тогда берём разумный дефолт, а не 0.
    function cssSizeOf(el) {
        if (!el) return 100;
        const w = el.offsetWidth || el.getBoundingClientRect().width || 0;
        return w > 0 ? w : 100;
    }

    function avatarUrl(serverUrl, userId, bucket) {
        return `${serverUrl}/avatar/${userId}?size=${bucket}&dpr=${screenDpr().toFixed(1)}`;
    }

    // URL аватара в ПОЛНОМ разрешении — для полноэкранного просмотрщика и
    // для раскрытия шапки профиля в фото. Кэшированную миниатюру там
    // использовать нельзя: её растянет на весь экран (а с зумом до 5x — в
    // 20 раз), и выглядит это отвратительно.
    function fullUrl(serverUrl, userId) {
        return `${serverUrl}/avatar_full/${userId}`;
    }

    // Синхронный "быстрый" кэш поверх IndexedDB — localStorage читается
    // мгновенно (без Promise), поэтому фото можно применить ДО первого
    // await и до первой отрисовки элемента браузером — так фон вообще
    // не успевает мелькнуть. IndexedDB остаётся источником истины и
    // резервным хранилищем (на случай переполнения localStorage).
    function getLocalSync(userId) {
        try {
            const raw = localStorage.getItem(LS_PREFIX + String(userId));
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveLocalSync(userId, version, dataUrl, bucket) {
        try {
            localStorage.setItem(
                LS_PREFIX + String(userId),
                JSON.stringify({ version, dataUrl, bucket: bucket || null })
            );
        } catch (e) {
            // Квота localStorage превышена или недоступен — не критично,
            // IndexedDB всё равно продолжит работать как обычно
        }
    }

    function removeLocalSync(userId) {
        try {
            localStorage.removeItem(LS_PREFIX + String(userId));
        } catch (e) {}
    }

    async function getLocal(userId) {
        try {
            const db = await openDB();
            return await new Promise((resolve) => {
                const tx = db.transaction(STORE, 'readonly');
                const req = tx.objectStore(STORE).get(String(userId));
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    async function saveLocal(userId, version, dataUrl, bucket) {
        // Синхронный L1-кэш — обновляем сразу, не дожидаясь IndexedDB
        saveLocalSync(userId, version, dataUrl, bucket);
        try {
            const db = await openDB();
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({
                userId: String(userId),
                version,
                dataUrl,
                // bucket — в каком разрешении лежит эта копия. Без него нельзя
                // понять, годится ли кэш для более крупного места отрисовки:
                // старый кэш (300px), снятый для списка чатов, молча
                // растягивался в профиле.
                bucket: bucket || null,
                savedAt: Date.now()
            });
        } catch (e) {
            /* IndexedDB недоступен — но localStorage уже обновлён, так что
               мгновенное отображение при следующем заходе всё равно сработает */
        }
    }

    async function removeLocal(userId) {
        removeLocalSync(userId);
        try {
            const db = await openDB();
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).delete(String(userId));
        } catch (e) {}
    }

    function blobToDataURL(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    function fallbackAdjustColor(color, amount) {
        try {
            if (typeof window !== 'undefined' && typeof window.adjustColor === 'function') {
                return window.adjustColor(color, amount);
            }
        } catch (e) {}
        return color;
    }

    function applyImage(el, dataUrl) {
        if (!el) return;
        el.style.backgroundImage = `url(${dataUrl})`;
        el.style.backgroundSize = 'cover';
        el.style.backgroundPosition = 'center';
        el.style.backgroundRepeat = 'no-repeat';
        el.style.backgroundColor = '';
        el.textContent = '';
    }

    function applyPlaceholder(el, initials, bgColor) {
        if (!el) return;
        el.style.backgroundImage = 'none';
        el.style.background = bgColor
            ? `linear-gradient(135deg, ${bgColor}, ${fallbackAdjustColor(bgColor, 20)})`
            : 'linear-gradient(135deg, #0088cc, #40a7e3)';
        el.textContent = initials || '';
    }

    // Активные "in-flight" проверки версии, чтобы не дублировать запросы,
    // если один и тот же аватар рендерится в нескольких местах одновременно.
    const pending = new Map();

    /**
     * Отрисовать аватар в элемент el.
     * @param {string} serverUrl  - базовый URL сервера (SERVER_URL)
     * @param {HTMLElement} el    - элемент, в который рисуем фон
     * @param {string|number} userId
     * @param {string} initials   - инициалы для плейсхолдера
     * @param {string} bgColor    - цвет фона плейсхолдера
     * @param {boolean} hasAvatar - есть ли у пользователя аватар вообще
     * @returns {Promise<void>}
     */
    async function render(serverUrl, el, userId, initials, bgColor, hasAvatar, sizeHint) {
        if (!el || !userId) return;

        // Сколько РЕАЛЬНЫХ пикселей нужно этому месту отрисовки
        const bucket = bucketFor(sizeHint || cssSizeOf(el));

        if (!hasAvatar) {
            applyPlaceholder(el, initials, bgColor);
            removeLocal(userId);
            return;
        }

        // 0) Синхронно, ДО первого await — если в localStorage уже есть
        //    закэшированное фото, рисуем его немедленно, в том же тике,
        //    что и вызов render(). Браузер просто не успевает нарисовать
        //    элемент без фото — фон вообще не мелькает.
        const syncLocal = getLocalSync(userId);
        if (syncLocal && syncLocal.dataUrl) {
            applyImage(el, syncLocal.dataUrl);
        }

        // 1) Сверяемся с IndexedDB (источник истины). Обычно совпадает с
        //    тем, что уже показано синхронно, но так надёжнее переживает
        //    случаи, когда localStorage был очищен или переполнен.
        const local = syncLocal || await getLocal(userId);
        if (!syncLocal && local && local.dataUrl) {
            applyImage(el, local.dataUrl);
        }
        // Если локальной копии нет вовсе, но у пользователя точно есть
        // фото — плейсхолдер-фон НЕ показываем: он всё равно будет тут же
        // перекрыт настоящей фотографией, и получится лишнее мигание.
        // Просто ждём саму фотографию (см. checkAndUpdate ниже — она
        // качается максимально быстро, параллельно с проверкой версии).

        // 2) В фоне — дешёвая проверка версии на сервере.
        //    Ключ включает bucket: если этот же аватар уже качался в мелком
        //    размере для списка чатов, для профиля его надо перекачать
        //    крупнее, а не переиспользовать in-flight мелкий запрос.
        const key = String(userId) + '@' + bucket;
        if (!pending.has(key)) {
            pending.set(key, checkAndUpdate(serverUrl, userId, local, bucket));
            pending.get(key).finally(() => pending.delete(key));
        }

        const result = await pending.get(key);
        if (result && result.changed) {
            applyImage(el, result.dataUrl);
        } else if (!local) {
            // Сети нет / запрос не удался, а показать вообще нечего —
            // на крайний случай не оставляем пустой круг
            applyPlaceholder(el, initials, bgColor);
        }
    }

    async function checkAndUpdate(serverUrl, userId, local, bucket) {
        try {
            // Ни /avatar_version, ни /avatar не проверяют сессию на сервере,
            // поэтому credentials здесь не нужны. Это важно для /avatar:
            // он делает redirect на Cloudinary (другой домен), а fetch с
            // credentials:'include' по кросс-доменному редиректу браузер
            // блокирует политикой CORS, если у конечного ответа нет
            // Access-Control-Allow-Credentials — из-за этого скачивание
            // реальной картинки молча падало в catch, и локально
            // сохранялся только фон-плейсхолдер, а не само фото.

            // Кэш годится только если он снят в разрешении НЕ МЕНЬШЕ нужного.
            // Иначе (например, в кэше 128px из списка чатов, а рисуем аватар
            // в профиле, которому нужно 384px) относимся к нему как к
            // отсутствующему и перекачиваем в правильном размере — именно
            // из-за отсутствия этой проверки аватар в профиле и в раскрытом
            // виде оставался размытым даже после исправлений на сервере.
            const needsBiggerCopy = !!local && (!local.bucket || local.bucket < bucket);

            if (!local || needsBiggerCopy) {
                // Локальной копии нет вообще (первый заход, новое устройство/
                // браузер) — значит фото придётся скачать в любом случае,
                // независимо от того, что скажет /avatar_version. Поэтому
                // не ждём версию перед тем как начать качать саму картинку,
                // а запускаем оба запроса ОДНОВРЕМЕННО — это почти вдвое
                // быстрее, чем последовательно.
                const [versionRes, imgRes] = await Promise.all([
                    fetch(`${serverUrl}/avatar_version/${userId}`).catch(() => null),
                    fetch(avatarUrl(serverUrl, userId, bucket))
                ]);

                if (!imgRes.ok) return null;
                const blob = await imgRes.blob();
                const dataUrl = await blobToDataURL(blob);

                let version = null;
                if (versionRes && versionRes.ok) {
                    const versionData = await versionRes.json();
                    version = versionData.version;
                }
                // version может быть null, если проверка версии не удалась —
                // тогда просто не кэшируем хэш, следующий заход перепроверит
                if (version && version !== 'none') {
                    await saveLocal(userId, version, dataUrl, bucket);
                }
                return { changed: true, dataUrl };
            }

            // Локальная копия уже есть — сначала дешёвая проверка хэша,
            // и только если он отличается, качаем саму картинку
            const versionRes = await fetch(`${serverUrl}/avatar_version/${userId}`);
            if (!versionRes.ok) return null;
            const versionData = await versionRes.json();
            const remoteVersion = versionData.version;

            if (remoteVersion === 'none') {
                await removeLocal(userId);
                return null;
            }

            if (local.version === remoteVersion) {
                // Аватар не менялся — ничего не перезагружаем и не перерисовываем
                return null;
            }

            // Версия изменилась — скачиваем фото
            const imgRes = await fetch(avatarUrl(serverUrl, userId, bucket));
            if (!imgRes.ok) return null;
            const blob = await imgRes.blob();
            const dataUrl = await blobToDataURL(blob);

            await saveLocal(userId, remoteVersion, dataUrl, bucket);
            return { changed: true, dataUrl };
        } catch (e) {
            // Нет сети/ошибка — оставляем то, что уже показано
            return null;
        }
    }

    return {
        render, removeLocal, getLocal, saveLocal,
        getLocalSync, saveLocalSync, removeLocalSync,
        // Служебные хелперы для страниц: fullUrl нужен везде, где аватар
        // показывается крупно (полноэкранный просмотрщик, раскрытая шапка).
        fullUrl, avatarUrl, bucketFor, screenDpr
    };
})();
