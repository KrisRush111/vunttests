// wallpaper-manager.js
// Глобальный менеджер обоев для всего сайта

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
        this.state = {
            enabled: false,
            selectedWallpaper: 'default'
        };
        
        this.loadSettings();
        this.setupBroadcastListener();
    }
    
    loadSettings() {
        const saved = localStorage.getItem('vuntgram_wallpaper');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                this.state = {
                    enabled: parsed.enabled || false,
                    selectedWallpaper: parsed.selectedWallpaper || 'default'
                };
            } catch (e) {
                console.error('Error loading wallpaper settings:', e);
                this.saveSettings();
            }
        }
    }
    
    saveSettings() {
        localStorage.setItem('vuntgram_wallpaper', JSON.stringify(this.state));
        this.broadcastUpdate();
    }
    
    selectWallpaper(wallpaperId) {
        const wallpaperExists = WALLPAPERS.some(w => w.id === wallpaperId);
        if (!wallpaperExists) {
            console.error('Wallpaper not found:', wallpaperId);
            return;
        }
        
        this.state.selectedWallpaper = wallpaperId;
        this.state.enabled = true;
        this.saveSettings();
        this.applyToCurrentPage();
    }
    
    toggleWallpaper(enabled) {
        this.state.enabled = enabled;
        this.saveSettings();
        this.applyToCurrentPage();
    }
    
    getSelectedWallpaper() {
        return WALLPAPERS.find(w => w.id === this.state.selectedWallpaper);
    }
    
    applyToCurrentPage() {
        const selectedWallpaper = this.getSelectedWallpaper();
        if (!selectedWallpaper) return;
        
        // Определяем тип страницы
        const currentPage = window.location.pathname.split('/').pop();
        
        if (currentPage === 'contacts.html') {
            this.applyToContactsPage();
        } else if (currentPage === 'profile.html') {
            this.applyToProfilePage();
        } else if (currentPage === 'chats.html') {
            this.applyToChatsPage(); // Если у вас есть chats.html
        }
        
        // Также применяем к body если это нужно
        this.applyToBody();
    }
    
    applyToContactsPage() {
        const desktopPlaceholder = document.getElementById('desktopPlaceholder');
        if (!desktopPlaceholder) return;
        
        const selectedWallpaper = this.getSelectedWallpaper();
        
        if (this.state.enabled) {
            desktopPlaceholder.classList.add('wallpaper-enabled');
            desktopPlaceholder.style.backgroundImage = `url('${selectedWallpaper.url}')`;
        } else {
            desktopPlaceholder.classList.remove('wallpaper-enabled');
            desktopPlaceholder.style.backgroundImage = '';
        }
    }
    
    applyToProfilePage() {
        const desktopPlaceholder = document.getElementById('desktopPlaceholder');
        if (!desktopPlaceholder) return;
        
        const selectedWallpaper = this.getSelectedWallpaper();
        
        if (this.state.enabled) {
            desktopPlaceholder.classList.add('wallpaper-enabled');
            desktopPlaceholder.style.backgroundImage = `url('${selectedWallpaper.url}')`;
        } else {
            desktopPlaceholder.classList.remove('wallpaper-enabled');
            desktopPlaceholder.style.backgroundImage = '';
        }
    }
    
    applyToBody() {
        const selectedWallpaper = this.getSelectedWallpaper();
        
        if (this.state.enabled) {
            document.body.classList.add('wallpaper-enabled');
            document.body.style.backgroundImage = `url('${selectedWallpaper.url}')`;
            document.body.style.backgroundSize = 'cover';
            document.body.style.backgroundPosition = 'center';
            document.body.style.backgroundRepeat = 'no-repeat';
            document.body.style.backgroundAttachment = 'fixed';
        } else {
            document.body.classList.remove('wallpaper-enabled');
            document.body.style.backgroundImage = '';
            document.body.style.backgroundColor = 'var(--telegram-secondary-bg)';
        }
    }
    
    broadcastUpdate() {
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('vuntgram_wallpaper');
                channel.postMessage({
                    type: 'wallpaper_update',
                    data: this.state
                });
                channel.close();
            } catch (e) {
                console.error('BroadcastChannel error:', e);
            }
        }
    }
    
    setupBroadcastListener() {
        if (typeof BroadcastChannel !== 'undefined') {
            try {
                const channel = new BroadcastChannel('vuntgram_wallpaper');
                channel.addEventListener('message', (event) => {
                    if (event.data.type === 'wallpaper_update') {
                        this.state = event.data.data;
                        this.applyToCurrentPage();
                    }
                });
            } catch (e) {
                console.error('BroadcastChannel listener error:', e);
            }
        }
    }
    
    // Методы для UI
    createWallpaperGrid(containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        WALLPAPERS.forEach(wallpaper => {
            const wallpaperItem = document.createElement('div');
            wallpaperItem.className = 'wallpaper-item';
            wallpaperItem.dataset.wallpaperId = wallpaper.id;
            
            if (wallpaper.id === this.state.selectedWallpaper) {
                wallpaperItem.classList.add('selected');
            }
            
            wallpaperItem.innerHTML = `
                <div class="wallpaper-preview" style="background-image: url('${wallpaper.url}');"></div>
                <div class="wallpaper-label">${wallpaper.name}</div>
            `;
            
            if (wallpaper.id === this.state.selectedWallpaper) {
                const checkmark = document.createElement('div');
                checkmark.className = 'wallpaper-checkmark';
                checkmark.innerHTML = '<i class="fas fa-check"></i>';
                wallpaperItem.appendChild(checkmark);
            }
            
            // Обработчик клика
            wallpaperItem.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.selectWallpaper(wallpaper.id);
                
                // Обновляем UI
                document.querySelectorAll('.wallpaper-item').forEach(item => {
                    item.classList.remove('selected');
                    const existingCheckmark = item.querySelector('.wallpaper-checkmark');
                    if (existingCheckmark) existingCheckmark.remove();
                });
                
                wallpaperItem.classList.add('selected');
                const checkmark = document.createElement('div');
                checkmark.className = 'wallpaper-checkmark';
                checkmark.innerHTML = '<i class="fas fa-check"></i>';
                wallpaperItem.appendChild(checkmark);
            });
            
            container.appendChild(wallpaperItem);
        });
    }
    
    setupToggle(toggleId) {
        const toggle = document.getElementById(toggleId);
        if (!toggle) return;
        
        toggle.checked = this.state.enabled;
        toggle.addEventListener('change', (e) => {
            this.toggleWallpaper(e.target.checked);
        });
    }
}

// Глобальный экземпляр
window.wallpaperManager = new WallpaperManager();
