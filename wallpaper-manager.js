// wallpaper-manager.js

const WALLPAPERS = [
    {
        id: 'default',
        name: 'Системные',
        url: 'фон.webp',
        isDefault: true
    },
    {
        id: 'wall1',
        name: 'Фиолетовые',
        url: 'фон3.webp'
    },
    {
        id: 'wall2',
        name: 'Светлые',
        url: 'фон4.webp'
    },
    {
        id: 'wall3',
        name: 'зелёно-розовые',
        url: 'фон5.webp'
    },
    {
        id: 'wall4',
        name: 'Темные',
        url: 'фон6.webp'
    }
];

class WallpaperManager {
    constructor() {
        this.wallpaperState = {
            enabled: false,
            selectedWallpaper: 'default',
        };
        this.loadWallpaperSettings();
    }

    // Загрузка настроек из localStorage
    loadWallpaperSettings() {
        const saved = localStorage.getItem('vuntgram_wallpaper');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.wallpaperState = {
                    enabled: parsed.enabled || false,
                    selectedWallpaper: parsed.selectedWallpaper || 'default',
                };
            } catch (e) {
                console.error('Error loading wallpaper settings:', e);
                this.saveWallpaperSettings();
            }
        }
    }

    // Сохранение настроек
    saveWallpaperSettings() {
        localStorage.setItem('vuntgram_wallpaper', JSON.stringify(this.wallpaperState));
        
        // Отправляем уведомление другим вкладкам
        this.broadcastUpdate();
    }

    // Применение обоев к странице
    applyWallpaper() {
        const selectedWallpaper = WALLPAPERS.find(w => w.id === this.wallpaperState.selectedWallpaper);
        
        if (!selectedWallpaper) return;

        if (this.wallpaperState.enabled) {
            // Применяем обои к body
            document.body.style.backgroundImage = `url('${selectedWallpaper.url}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundAttachment = 'fixed';
            document.body.style.backgroundRepeat = 'no-repeat';
            
            // Устанавливаем CSS переменную для других элементов
            document.documentElement.style.setProperty('--wallpaper-url', `url('${selectedWallpaper.url}')`);
        } else {
            // Убираем обои
            document.body.style.backgroundImage = '';
            document.documentElement.style.setProperty('--wallpaper-url', 'none');
        }
    }

    // Обновление состояния
    updateState(newState) {
        this.wallpaperState = { ...this.wallpaperState, ...newState };
        this.saveWallpaperSettings();
        this.applyWallpaper();
    }

    // Вещание обновлений другим вкладкам
    broadcastUpdate() {
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('vuntgram_wallpaper');
                channel.postMessage({
                    type: 'wallpaper_update',
                    data: this.wallpaperState
                });
                setTimeout(() => channel.close(), 100);
            } catch (e) {
                console.error('BroadcastChannel error:', e);
            }
        }
    }

    // Настройка слушателя обновлений
    setupBroadcastListener() {
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('vuntgram_wallpaper');
                channel.addEventListener('message', (event) => {
                    if (event.data.type === 'wallpaper_update') {
                        this.wallpaperState = event.data.data;
                        this.applyWallpaper();
                    }
                });
            } catch (e) {
                console.error('BroadcastChannel listener error:', e);
            }
        }
    }
}

// Создаем глобальный экземпляр
window.wallpaperManager = new WallpaperManager();