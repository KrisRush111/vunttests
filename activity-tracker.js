// activity-tracker.js
// Универсальный трекер активности для Vuntgram (Contacts, Chats, Profile)

const SERVER_URL = 'https://vuntserver.onrender.com';

class ActivityTracker {
    constructor() {
        this.userData = null;
        this.isOnline = false;
        this.activityInterval = null;
        this.statusPollInterval = null;
        this.lastActivityTime = Date.now();
        this.isInitialized = false;
        this.currentPage = this.detectCurrentPage();
        
        // Кэш статусов пользователей
        this.activityDataCache = {};
        this.lastCacheUpdate = 0;
        this.cacheTTL = 10000; // 10 секунд
        
        console.log(`ActivityTracker initialized for page: ${this.currentPage}`);
        
        // Инициализация при создании
        this.init();
    }

    // Определение текущей страницы
    detectCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('contacts.html')) return 'contacts';
        if (path.includes('chats.html')) return 'chats';
        if (path.includes('profile.html')) return 'profile';
        return 'unknown';
    }

    async init() {
        if (this.isInitialized) return;
        
        try {
            // Получаем данные пользователя из sessionStorage
            const userDataFromStorage = sessionStorage.getItem('userData');
            if (!userDataFromStorage) {
                console.warn('ActivityTracker: No user data found');
                return;
            }

            this.userData = JSON.parse(userDataFromStorage);
            
            // Запускаем отслеживание активности
            this.startActivityTracking();
            this.startStatusPolling();
            
            this.isInitialized = true;
            console.log(`ActivityTracker initialized for user: ${this.userData.platform_user_id} on ${this.currentPage}`);
        } catch (error) {
            console.error('ActivityTracker init error:', error);
        }
    }

    // Отслеживание активности пользователя
    startActivityTracking() {
        if (!this.userData) return;

        // Сразу отмечаем как онлайн
        this.updateOnlineStatus(true);

        // Обновляем статус каждые 30 секунд
        this.activityInterval = setInterval(() => {
            this.updateOnlineStatus(true);
        }, 30000);

        // Отслеживаем действия пользователя
        this.setupActivityListeners();
        
        // Обработка закрытия страницы
        this.setupPageUnload();
    }

    // Опрос статусов других пользователей
    startStatusPolling() {
        // Обновляем статусы в зависимости от страницы
        const pollInterval = this.currentPage === 'chats' ? 3000 : 5000;
        
        this.statusPollInterval = setInterval(() => {
            this.refreshOnlineStatuses();
        }, pollInterval);

        // Первое обновление через 1 секунду
        setTimeout(() => {
            this.refreshOnlineStatuses();
        }, 1000);
    }

    // Настройка слушателей активности
    setupActivityListeners() {
        const activityEvents = [
            'mousedown', 'mousemove', 'keypress', 'scroll', 
            'touchstart', 'click', 'input', 'touchmove'
        ];

        activityEvents.forEach(event => {
            document.addEventListener(event, () => {
                this.lastActivityTime = Date.now();
                if (!this.isOnline) {
                    this.updateOnlineStatus(true);
                }
            }, { passive: true });
        });

        // Отслеживание видимости страницы
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.updateOnlineStatus(true);
                this.refreshOnlineStatuses(); // Сразу обновляем статусы при возвращении
            } else {
                this.updateOnlineStatus(false);
            }
        });

        // Отслеживание фокуса окна
        window.addEventListener('focus', () => {
            this.updateOnlineStatus(true);
            this.refreshOnlineStatuses();
        });
    }

    // Настройка обработчиков закрытия страницы
    setupPageUnload() {
        const sendOffline = () => {
            this.updateOnlineStatus(false);
        };

        window.addEventListener('beforeunload', sendOffline);
        window.addEventListener('pagehide', sendOffline);
        window.addEventListener('unload', sendOffline);
    }

    // Обновление статуса онлайн
    async updateOnlineStatus(isOnline) {
        if (!this.userData || this.isOnline === isOnline) return;

        try {
            const response = await fetch(`${SERVER_URL}/update_activity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    platform_user_id: this.userData.platform_user_id,
                    is_online: isOnline
                }),
                credentials: 'include'
            });

            if (response.ok) {
                this.isOnline = isOnline;
                console.log(`ActivityTracker: User is ${isOnline ? 'online' : 'offline'}`);
                
                // Обновляем свой статус на текущей странице если нужно
                if (this.currentPage === 'profile') {
                    this.updateOwnStatusUI(isOnline);
                }
            }
        } catch (error) {
            console.error('ActivityTracker: Error updating online status:', error);
        }
    }

    // Обновление собственного статуса в UI (для profile.html)
    updateOwnStatusUI(isOnline) {
        const statusElement = document.querySelector('.profile-status');
        if (statusElement) {
            if (isOnline) {
                statusElement.innerHTML = '<span class="status-indicator"></span>В сети';
                statusElement.style.color = 'var(--online-green)';
            } else {
                statusElement.textContent = 'не в сети';
                statusElement.style.color = 'var(--telegram-hint)';
            }
        }
    }

    // Обновление статусов других пользователей
    async refreshOnlineStatuses() {
        if (!this.userData) return;

        try {
            const userIds = this.getUsersToUpdate();
            if (userIds.length === 0) return;

            // Проверяем кэш
            const now = Date.now();
            if (now - this.lastCacheUpdate < this.cacheTTL && 
                Object.keys(this.activityDataCache).length > 0) {
                this.updateUIStatuses(this.activityDataCache);
                return;
            }

            const response = await fetch(`${SERVER_URL}/get_activity_status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_ids: userIds
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    // Обновляем кэш
                    this.activityDataCache = { ...this.activityDataCache, ...data.activity_data };
                    this.lastCacheUpdate = now;
                    
                    this.updateUIStatuses(data.activity_data);
                }
            }
        } catch (error) {
            console.error('ActivityTracker: Error refreshing statuses:', error);
        }
    }

    // Получение списка пользователей для обновления статусов
    getUsersToUpdate() {
        const userIds = new Set();
        
        switch (this.currentPage) {
            case 'contacts':
                this.collectContactUserIds(userIds);
                break;
            case 'chats':
                this.collectChatUserIds(userIds);
                break;
            case 'profile':
                // На странице профиля обычно не нужно обновлять статусы других пользователей
                break;
        }

        return Array.from(userIds);
    }

    // Сбор ID пользователей со страницы контактов
    collectContactUserIds(userIds) {
        // Из списка контактов
        const contactItems = document.querySelectorAll('.user-result, .contact-item');
        contactItems.forEach(item => {
            const userId = item.getAttribute('data-user-id');
            if (userId && userId !== this.userData.platform_user_id) {
                userIds.add(userId);
            }
        });

        // Из модального окна профиля
        const modalUserId = this.getCurrentModalUserId();
        if (modalUserId && modalUserId !== this.userData.platform_user_id) {
            userIds.add(modalUserId);
        }
    }

    // Сбор ID пользователей со страницы чатов
    collectChatUserIds(userIds) {
        // Из списка чатов
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const participantId = item.getAttribute('data-participant-id');
            if (participantId && participantId !== this.userData.platform_user_id) {
                userIds.add(participantId);
            }
        });

        // Из текущего открытого чата
        const currentChat = this.getCurrentChat();
        if (currentChat && currentChat.participants) {
            currentChat.participants.forEach(participant => {
                if (participant.platform_user_id !== this.userData.platform_user_id) {
                    userIds.add(participant.platform_user_id);
                }
            });
        }
    }

    // Получение ID пользователя из модального окна
    getCurrentModalUserId() {
        const modal = document.querySelector('.profile-modal.active, .profile-modal.visible');
        if (modal) {
            const idElement = modal.querySelector('.profile-id, .modal-profile-id');
            if (idElement) {
                const idText = idElement.textContent;
                const match = idText.match(/ID:\s*(\S+)/);
                return match ? match[1] : null;
            }
        }
        return null;
    }

    // Получение текущего чата (для chats.html)
    getCurrentChat() {
        return window.currentChat || null;
    }

    // Обновление статусов в UI
    updateUIStatuses(activityData) {
        switch (this.currentPage) {
            case 'contacts':
                this.updateContactsUI(activityData);
                break;
            case 'chats':
                this.updateChatsUI(activityData);
                break;
            case 'profile':
                // На странице профиля обычно не нужно обновлять статусы других пользователей
                break;
        }
    }

    // Обновление UI контактов
    updateContactsUI(activityData) {
        // Обновление списка контактов
        const contactItems = document.querySelectorAll('.user-result, .contact-item');
        contactItems.forEach(item => {
            const userId = item.getAttribute('data-user-id');
            const statusElement = item.querySelector('.user-status, .contact-status');
            
            if (userId && statusElement && activityData[userId]) {
                this.updateStatusElement(statusElement, activityData[userId]);
            }
        });

        // Обновление модального окна профиля
        this.updateContactModalStatus(activityData);
    }

    // Обновление UI чатов
    updateChatsUI(activityData) {
        // Обновление списка чатов
        const chatItems = document.querySelectorAll('.chat-item');
        chatItems.forEach(item => {
            const participantId = item.getAttribute('data-participant-id');
            const statusElement = item.querySelector('.chat-status, .user-status');
            
            if (participantId && statusElement && activityData[participantId]) {
                this.updateStatusElement(statusElement, activityData[participantId]);
            }
        });

        // Обновление текущего чата
        this.updateCurrentChatStatus(activityData);
    }

    // Обновление статуса в модальном окне контакта
    updateContactModalStatus(activityData) {
        const modalUserId = this.getCurrentModalUserId();
        const statusElement = document.querySelector('.profile-modal.active .user-status, .profile-modal.visible .user-status');
        
        if (modalUserId && statusElement && activityData[modalUserId]) {
            this.updateStatusElement(statusElement, activityData[modalUserId]);
        }
    }

    // Обновление статуса в текущем чате
    updateCurrentChatStatus(activityData) {
        const currentChat = this.getCurrentChat();
        if (!currentChat) return;

        const otherParticipant = currentChat.participants?.find(
            p => p.platform_user_id !== this.userData.platform_user_id
        );

        if (otherParticipant && activityData[otherParticipant.platform_user_id]) {
            const statusElement = document.querySelector('.chat-header .chat-status, .chat-header .user-status');
            if (statusElement) {
                this.updateStatusElement(statusElement, activityData[otherParticipant.platform_user_id]);
            }
        }
    }

    // Обновление элемента статуса
    updateStatusElement(element, activity) {
        if (activity.is_online) {
            element.innerHTML = '<span class="status-indicator"></span><span class="status-text">В сети</span>';
            element.classList.add('online');
            element.classList.remove('offline');
        } else {
            const lastSeenText = this.formatLastSeen(activity.last_online);
            element.innerHTML = `<span class="status-text">${lastSeenText}</span>`;
            element.classList.remove('online');
            element.classList.add('offline');
        }
    }

    // Форматирование времени последнего посещения
    formatLastSeen(lastOnline) {
        if (!lastOnline) return 'был(а) недавно';
        
        const now = new Date();
        const lastSeen = new Date(lastOnline);
        const diffMs = now - lastSeen;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) {
            return 'только что';
        } else if (diffMins < 60) {
            return `был(а) ${diffMins} ${this.getRussianNoun(diffMins, ['минуту', 'минуты', 'минут'])} назад`;
        } else if (diffHours < 10) {
            return `был(а) ${diffHours} ${this.getRussianNoun(diffHours, ['час', 'часа', 'часов'])} назад`;
        } else if (diffHours < 24) {
            // Приводим время к московскому времени
            const moscowTime = new Date(lastSeen);
            moscowTime.setHours(moscowTime.getHours() + 3);
            return `был(а) в ${moscowTime.getHours().toString().padStart(2, '0')}:${moscowTime.getMinutes().toString().padStart(2, '0')}`;
        } else if (diffDays < 2) {
            const moscowTime = new Date(lastSeen);
            moscowTime.setHours(moscowTime.getHours() + 3);
            return `был(а) вчера в ${moscowTime.getHours().toString().padStart(2, '0')}:${moscowTime.getMinutes().toString().padStart(2, '0')}`;
        } else {
            return `был(а) ${lastSeen.getDate().toString().padStart(2, '0')}.${(lastSeen.getMonth() + 1).toString().padStart(2, '0')}.${lastSeen.getFullYear()}`;
        }
    }

    // Получение правильной формы русского существительного
    getRussianNoun(number, forms) {
        number = Math.abs(number) % 100;
        const n1 = number % 10;
        
        if (number > 10 && number < 20) return forms[2];
        if (n1 > 1 && n1 < 5) return forms[1];
        if (n1 === 1) return forms[0];
        return forms[2];
    }

    // Принудительное обновление статусов (можно вызывать извне)
    forceRefresh() {
        this.lastCacheUpdate = 0; // Сбрасываем кэш
        this.refreshOnlineStatuses();
    }

    // Обновление данных пользователя (при изменении в sessionStorage)
    updateUserData() {
        try {
            const userDataFromStorage = sessionStorage.getItem('userData');
            if (userDataFromStorage) {
                this.userData = JSON.parse(userDataFromStorage);
            }
        } catch (error) {
            console.error('ActivityTracker: Error updating user data:', error);
        }
    }

    // Остановка трекера
    destroy() {
        if (this.activityInterval) {
            clearInterval(this.activityInterval);
            this.activityInterval = null;
        }
        if (this.statusPollInterval) {
            clearInterval(this.statusPollInterval);
            this.statusPollInterval = null;
        }
        
        this.updateOnlineStatus(false);
        this.isInitialized = false;
        
        console.log('ActivityTracker destroyed');
    }
}

// Глобальный экземпляр трекера
window.activityTracker = new ActivityTracker();

// Автоматическая инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    if (window.activityTracker && !window.activityTracker.isInitialized) {
        window.activityTracker.init();
    }
});

// Обработчик изменений в sessionStorage (для обновления данных пользователя)
window.addEventListener('storage', (e) => {
    if (e.key === 'userData' && window.activityTracker) {
        window.activityTracker.updateUserData();
    }
});

// Глобальные функции для использования в других скриптах
window.ActivityTrackerUtils = {
    // Принудительное обновление статусов
    refreshStatuses: () => {
        if (window.activityTracker) {
            window.activityTracker.forceRefresh();
        }
    },
    
    // Получение статуса пользователя
    getUserStatus: (userId) => {
        if (window.activityTracker && window.activityTracker.activityDataCache[userId]) {
            return window.activityTracker.activityDataCache[userId];
        }
        return null;
    },
    
    // Обновление данных пользователя
    updateTrackerUserData: () => {
        if (window.activityTracker) {
            window.activityTracker.updateUserData();
        }
    }
};

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActivityTracker;
}