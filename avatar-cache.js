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

    async function saveLocal(userId, version, dataUrl) {
        try {
            const db = await openDB();
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({
                userId: String(userId),
                version,
                dataUrl,
                savedAt: Date.now()
            });
        } catch (e) {
            /* IndexedDB недоступен — просто не кэшируем на диск */
        }
    }

    async function removeLocal(userId) {
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
    async function render(serverUrl, el, userId, initials, bgColor, hasAvatar) {
        if (!el || !userId) return;

        if (!hasAvatar) {
            applyPlaceholder(el, initials, bgColor);
            removeLocal(userId);
            return;
        }

        // 1) Мгновенно показываем локально сохранённую копию (если есть) —
        //    без сети, без мигания плейсхолдером.
        const local = await getLocal(userId);
        if (local && local.dataUrl) {
            applyImage(el, local.dataUrl);
        }
        // Если локальной копии нет, но у пользователя точно есть фото —
        // плейсхолдер-фон НЕ показываем: он всё равно будет тут же
        // перекрыт настоящей фотографией, и получится лишнее мигание.
        // Просто ждём саму фотографию (см. checkAndUpdate ниже — она
        // качается максимально быстро, параллельно с проверкой версии).

        // 2) В фоне — дешёвая проверка версии на сервере
        const key = String(userId);
        if (!pending.has(key)) {
            pending.set(key, checkAndUpdate(serverUrl, userId, local));
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

    async function checkAndUpdate(serverUrl, userId, local) {
        try {
            // Ни /avatar_version, ни /avatar не проверяют сессию на сервере,
            // поэтому credentials здесь не нужны. Это важно для /avatar:
            // он делает redirect на Cloudinary (другой домен), а fetch с
            // credentials:'include' по кросс-доменному редиректу браузер
            // блокирует политикой CORS, если у конечного ответа нет
            // Access-Control-Allow-Credentials — из-за этого скачивание
            // реальной картинки молча падало в catch, и локально
            // сохранялся только фон-плейсхолдер, а не само фото.

            if (!local) {
                // Локальной копии нет вообще (первый заход, новое устройство/
                // браузер) — значит фото придётся скачать в любом случае,
                // независимо от того, что скажет /avatar_version. Поэтому
                // не ждём версию перед тем как начать качать саму картинку,
                // а запускаем оба запроса ОДНОВРЕМЕННО — это почти вдвое
                // быстрее, чем последовательно.
                const [versionRes, imgRes] = await Promise.all([
                    fetch(`${serverUrl}/avatar_version/${userId}`).catch(() => null),
                    fetch(`${serverUrl}/avatar/${userId}`)
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
                    await saveLocal(userId, version, dataUrl);
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
            const imgRes = await fetch(`${serverUrl}/avatar/${userId}`);
            if (!imgRes.ok) return null;
            const blob = await imgRes.blob();
            const dataUrl = await blobToDataURL(blob);

            await saveLocal(userId, remoteVersion, dataUrl);
            return { changed: true, dataUrl };
        } catch (e) {
            // Нет сети/ошибка — оставляем то, что уже показано
            return null;
        }
    }

    return { render, removeLocal, getLocal, saveLocal };
})();
