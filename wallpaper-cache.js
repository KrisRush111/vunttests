/**
 * WallpaperCache — локальное (постоянное, между открытиями страницы) хранение
 * обоев чата в IndexedDB + localStorage. Сделано по той же схеме, что и
 * AvatarCache для аватарок.
 *
 * Зачем: раньше обои каждый раз ставились как `url('фон.jpg')`, то есть
 * браузер при каждом открытии страницы (а иногда и при каждом открытии чата)
 * заново шёл в сеть, ждал ответа и декодировал картинку. Пока это
 * происходило, чат показывался без фона или с наполовину прорисованным
 * фоном — это и есть "обои нормально не прогружаются".
 *
 * Логика:
 *  1) Обои сохраняются локально один раз как data:URL.
 *  2) При следующем заходе data:URL достаётся из localStorage СИНХРОННО,
 *     до первого await и до первой отрисовки — фон уже на месте в том же
 *     тике, сеть не участвует вообще.
 *  3) IndexedDB — источник истины и резерв (localStorage может не вместить
 *     все обои: квота ~5 МБ).
 *  4) В фоне картинка догружается/обновляется и перекладывается в кэш.
 *
 * Файлы обоев называются кириллицей ('фон.jpg'), поэтому любой сетевой
 * путь прогоняется через encodeURI — иначе часть серверов отдаёт 404.
 */
const WallpaperCache = (function () {
    const DB_NAME = 'vuntgram_wallpapers_db';
    const DB_VERSION = 1;
    const STORE = 'wallpapers';
    const LS_PREFIX = 'vg_wall_';

    // Ограничение на запись в localStorage: большие обои туда просто не
    // влезут (квота ~5 МБ на весь домен, а base64 раздувает файл на ~33%).
    // Такие обои живут только в IndexedDB.
    const LS_MAX_CHARS = 1_800_000;

    let dbPromise = null;

    function openDB() {
        if (dbPromise) return dbPromise;
        dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'url' });
                }
            };
            req.onsuccess = (e) => resolve(e.target.result);
            req.onerror = () => reject(req.error);
        });
        return dbPromise;
    }

    function netUrl(url) {
        return encodeURI(url);
    }

    // ------------------------------------------------------------------
    // Синхронный L1-кэш (localStorage)
    // ------------------------------------------------------------------
    function getLocalSync(url) {
        try {
            const raw = localStorage.getItem(LS_PREFIX + url);
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function saveLocalSync(url, dataUrl) {
        if (!dataUrl || dataUrl.length > LS_MAX_CHARS) return;
        try {
            localStorage.setItem(LS_PREFIX + url, JSON.stringify({ dataUrl, savedAt: Date.now() }));
        } catch (e) {
            // Квота превышена — не критично, IndexedDB продолжит работать
        }
    }

    // ------------------------------------------------------------------
    // L2-кэш (IndexedDB)
    // ------------------------------------------------------------------
    async function getLocal(url) {
        try {
            const db = await openDB();
            return await new Promise((resolve) => {
                const tx = db.transaction(STORE, 'readonly');
                const req = tx.objectStore(STORE).get(url);
                req.onsuccess = () => resolve(req.result || null);
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            return null;
        }
    }

    async function saveLocal(url, dataUrl) {
        saveLocalSync(url, dataUrl);
        try {
            const db = await openDB();
            const tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put({ url, dataUrl, savedAt: Date.now() });
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

    // Готовые к применению data:URL в памяти — чтобы не парсить localStorage
    // и не ходить в IndexedDB на каждый вызов applyWallpaper().
    const memory = new Map();
    const pending = new Map();

    /**
     * Синхронно вернуть готовый CSS-url для обоев, если они уже закэшированы.
     * Возвращает null, если локальной копии нет — тогда вызывающий код
     * ставит обычный сетевой путь и ждёт ensure().
     */
    function cssUrlSync(url) {
        if (!url) return null;
        if (memory.has(url)) return `url("${memory.get(url)}")`;
        const local = getLocalSync(url);
        if (local && local.dataUrl) {
            memory.set(url, local.dataUrl);
            return `url("${local.dataUrl}")`;
        }
        return null;
    }

    /** Сетевой CSS-url (фолбэк, пока кэш не прогрет). */
    function cssUrlNetwork(url) {
        return `url("${netUrl(url)}")`;
    }

    /**
     * Убедиться, что обои есть в кэше. Качает файл, декодирует и сохраняет.
     * @returns {Promise<string|null>} data:URL или null, если не удалось
     */
    function ensure(url) {
        if (!url) return Promise.resolve(null);
        if (memory.has(url)) return Promise.resolve(memory.get(url));
        if (pending.has(url)) return pending.get(url);

        const task = (async () => {
            // 1) IndexedDB — возможно, localStorage не вместил эти обои
            const local = await getLocal(url);
            if (local && local.dataUrl) {
                memory.set(url, local.dataUrl);
                saveLocalSync(url, local.dataUrl);
                return local.dataUrl;
            }

            // 2) Качаем из сети один раз и кладём в кэш навсегда
            try {
                const res = await fetch(netUrl(url), { cache: 'force-cache' });
                if (!res.ok) return null;
                const blob = await res.blob();
                const dataUrl = await blobToDataURL(blob);
                memory.set(url, dataUrl);
                await saveLocal(url, dataUrl);
                return dataUrl;
            } catch (e) {
                return null;
            }
        })();

        pending.set(url, task);
        task.finally(() => pending.delete(url));
        return task;
    }

    /**
     * Полностью подготовить обои: дождаться данных И декодирования картинки.
     * Только после этого фон рисуется мгновенно и целиком, без "проявления".
     */
    async function prepare(url) {
        const dataUrl = await ensure(url);
        if (!dataUrl) return null;
        try {
            const img = new Image();
            img.src = dataUrl;
            if (img.decode) await img.decode();
            // Держим ссылку, чтобы браузер не выбросил декодированный битмап
            decoded.set(url, img);
        } catch (e) {}
        return dataUrl;
    }

    const decoded = new Map();

    /** Прогреть кэш для списка обоев: сначала выбранные, потом остальные. */
    async function warmup(urls, primaryUrl) {
        if (primaryUrl) await prepare(primaryUrl);
        for (const u of urls || []) {
            if (u !== primaryUrl) await prepare(u);
        }
    }

    return { cssUrlSync, cssUrlNetwork, ensure, prepare, warmup, getLocal, saveLocal, getLocalSync };
})();

if (typeof window !== 'undefined') window.WallpaperCache = WallpaperCache;
