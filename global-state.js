// global-state.js
const GlobalState = (function() {
    // Singleton для глобального состояния
    let instance;
    
    function GlobalState() {
        if (instance) {
            return instance;
        }
        
        this.cache = {
            userData: null,
            chatsList: [],
            contacts: [],
            activityData: {},
            wallpaperState: null,
            lastUpdate: {},
            sessionId: Date.now().toString(36) + Math.random().toString(36).substr(2)
        };
        
        this.isPlatformActive = false;
        this.listeners = {};
        
        instance = this;
        return this;
    }
    
    // Методы для управления состоянием
    GlobalState.prototype = {
        // Инициализация платформы
        initPlatform: function() {
            this.isPlatformActive = true;
            localStorage.setItem('platform_session', this.cache.sessionId);
            localStorage.setItem('platform_active', 'true');
            this.emit('platform_init');
        },
        
        // Завершение сессии платформы
        endPlatformSession: function() {
            this.isPlatformActive = false;
            localStorage.removeItem('platform_active');
            this.clearCache();
            this.emit('platform_end');
        },
        
        // Проверка активной сессии
        isPlatformSessionActive: function() {
            return this.isPlatformActive || localStorage.getItem('platform_active') === 'true';
        },
        
        // Кэширование данных
        setCache: function(key, data, page = 'global') {
            if (!this.cache.lastUpdate[page]) {
                this.cache.lastUpdate[page] = {};
            }
            this.cache.lastUpdate[page][key] = Date.now();
            
            if (key.includes('.')) {
                const keys = key.split('.');
                let obj = this.cache;
                for (let i = 0; i < keys.length - 1; i++) {
                    if (!obj[keys[i]]) obj[keys[i]] = {};
                    obj = obj[keys[i]];
                }
                obj[keys[keys.length - 1]] = data;
            } else {
                this.cache[key] = data;
            }
            
            this.emit(`cache_update_${key}`, data);
        },
        
        // Получение кэшированных данных
        getCache: function(key) {
            if (key.includes('.')) {
                const keys = key.split('.');
                let obj = this.cache;
                for (let i = 0; i < keys.length; i++) {
                    if (!obj || typeof obj !== 'object') return null;
                    obj = obj[keys[i]];
                }
                return obj;
            }
            return this.cache[key];
        },
        
        // Проверка свежести данных
        isDataFresh: function(key, maxAgeMs = 30000, page = 'global') {
            if (!this.cache.lastUpdate[page] || !this.cache.lastUpdate[page][key]) {
                return false;
            }
            return (Date.now() - this.cache.lastUpdate[page][key]) < maxAgeMs;
        },
        
        // Подписка на события
        on: function(event, callback) {
            if (!this.listeners[event]) this.listeners[event] = [];
            this.listeners[event].push(callback);
        },
        
        // Отписка от событий
        off: function(event, callback) {
            if (!this.listeners[event]) return;
            const index = this.listeners[event].indexOf(callback);
            if (index > -1) this.listeners[event].splice(index, 1);
        },
        
        // Эмит событий
        emit: function(event, data) {
            if (!this.listeners[event]) return;
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in event listener for ${event}:`, error);
                }
            });
        },
        
        // Очистка кэша
        clearCache: function() {
            this.cache = {
                userData: this.cache.userData, // Сохраняем данные пользователя
                chatsList: [],
                contacts: [],
                activityData: {},
                wallpaperState: this.cache.wallpaperState,
                lastUpdate: {},
                sessionId: this.cache.sessionId
            };
            this.emit('cache_cleared');
        },
        
        // Обновление части данных
        updatePartial: function(key, updates) {
            const current = this.getCache(key);
            if (current && typeof current === 'object') {
                const updated = {...current, ...updates};
                this.setCache(key, updated);
            } else {
                this.setCache(key, updates);
            }
        }
    };
    
    return GlobalState;
})();

// Создаем глобальный экземпляр
window.GlobalState = new GlobalState();

// Безопасная проверка состояния платформы при загрузке
if (localStorage.getItem('platform_active') === 'true') {
    window.GlobalState.isPlatformActive = true;
}

// Экспортируем для использования в модулях
export { GlobalState };