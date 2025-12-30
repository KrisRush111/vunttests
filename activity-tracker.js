// activity-tracker.js с поддержкой мгновенных переходов
class ActivityTracker {
    constructor() {
        this.isInitialized = false;
        this.updateInterval = null;
        this.statusPollInterval = null;
        this.lastActivity = Date.now();
        this.userData = null;
        this.isOnline = false;
        this.currentPage = this.detectCurrentPage();
        
        // Добавляем отслеживание платформы
        this.platformPages = ['contacts', 'chats', 'profile'];
        this.isOnPlatform = this.platformPages.includes(this.currentPage);
        
        // Кэш статусов пользователей
        this.activityDataCache = {};
        this.lastCacheUpdate = 0;
        this.cacheTTL = 5000; // Уменьшено до 5 секунд
        
        // Добавляем BroadcastChannel для межвкладочного общения
        this.activityChannel = null;
        
        console.log(`ActivityTracker initialized for page: ${this.currentPage}, on platform: ${this.isOnPlatform}`);
        
        // Инициализация только если на платформе
        if (this.isOnPlatform) {
            setTimeout(() => this.init(), 500);
        }
    }
    
    // Определение текущей страницы - расширенная версия
    detectCurrentPage() {
        const hostname = window.location.hostname;
        const path = window.location.pathname;
        
        // Проверяем, что находимся на домене платформы
        const isPlatformDomain = hostname.includes('vuntgram') || 
                                hostname.includes('localhost') || 
                                hostname.includes('127.0.0.1');
        
        if (!isPlatformDomain) return 'external';

        if (path.includes('contacts.html')) return 'contacts';
        if (path.includes('chats.html')) return 'chats';
        if (path.includes('profile.html')) return 'profile';
        return 'other_platform_page';
    }

    async init() {
        // Инициализируем только если на платформе
        if (!this.isOnPlatform || this.isInitialized) return;
        
        // Подключаемся к глобальному состоянию
        if (!window.GlobalState) {
            console.warn('GlobalState not available, delaying tracker init');
            setTimeout(() => this.init(), 1000);
            return;
        }
        
        try {
            // Получаем данные пользователя из sessionStorage
            const userDataFromStorage = sessionStorage.getItem('userData');
            if (!userDataFromStorage) {
                console.warn('ActivityTracker: No user data found');
                return;
            }

            this.userData = JSON.parse(userDataFromStorage);
            
            // Сразу отмечаем как онлайн при инициализации на платформе
            await this.updateOnlineStatus(true);
            
            // Запускаем отслеживание активности
            this.startActivityTracking();
            this.startStatusPolling();
            
            // Настраиваем межвкладочное общение
            this.setupCrossTabCommunication();
            
            this.isInitialized = true;
            console.log(`ActivityTracker initialized for user: ${this.userData.platform_user_id} on ${this.currentPage}`);
        } catch (error) {
            console.error('ActivityTracker init error:', error);
        }
    }

    // Отслеживание активности пользователя
    startActivityTracking() {
        if (!this.userData) return;

        // Обновляем статус каждые 25 секунд (чаще)
        this.updateInterval = setInterval(() => {
            if (document.visibilityState === 'visible' && this.isOnPlatform) {
                this.updateOnlineStatus(true);
            }
        }, 25000);

        // Отслеживаем действия пользователя
        this.setupActivityListeners();
        
        // Обработка закрытия страницы
        this.setupPageUnload();
    }

    // Опрос статусов других пользователей
    startStatusPolling() {
        // Более агрессивный polling для мгновенных обновлений
        const pollInterval = this.currentPage === 'chats' ? 2000 : 3000;
        
        this.statusPollInterval = setInterval(() => {
            if (document.visibilityState === 'visible' && this.isOnPlatform) {
                this.refreshOnlineStatuses();
            }
        }, pollInterval);

        // Первое обновление сразу
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

        const activityHandler = () => {
            this.lastActivity = Date.now();
            // Обновляем статус только если на платформе
            if (!this.isOnline && document.visibilityState === 'visible' && this.isOnPlatform) {
                this.updateOnlineStatus(true);
            }
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, activityHandler, { passive: true });
        });

        // Отслеживание видимости страницы - УЛУЧШЕННАЯ ЛОГИКА
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.isOnPlatform) {
                // При возвращении на вкладку платформы сразу обновляем статус
                this.updateOnlineStatus(true);
                // Принудительно обновляем статусы других пользователей
                setTimeout(() => this.refreshOnlineStatuses(), 500);
            } else {
                // При скрытии вкладки платформы ставим офлайн через 30 секунд
                setTimeout(() => {
                    if (document.visibilityState === 'hidden' && this.isOnPlatform) {
                        this.updateOnlineStatus(false);
                    }
                }, 30000);
            }
        });

        // Отслеживание фокуса окна
        window.addEventListener('focus', () => {
            if (this.isOnPlatform) {
                this.updateOnlineStatus(true);
                setTimeout(() => this.refreshOnlineStatuses(), 500);
            }
        });

        // Отслеживание перехода между страницами платформы
        window.addEventListener('popstate', () => {
            this.handlePageChange();
        });

        // Отслеживание кликов по ссылкам
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a');
            if (link && link.href) {
                setTimeout(() => this.handlePageChange(), 100);
            }
        });
    }

    // Обработчик смены страницы
    handlePageChange() {
        const previousPage = this.currentPage;
        const previousPlatformStatus = this.isOnPlatform;
        
        this.currentPage = this.detectCurrentPage();
        this.isOnPlatform = this.platformPages.includes(this.currentPage);
        
        // Если ушли с платформы - ставим офлайн
        if (previousPlatformStatus && !this.isOnPlatform) {
            console.log('ActivityTracker: Left platform, setting offline');
            this.updateOnlineStatus(false);
            this.stopTracking();
        }
        // Если вернулись на платформу - ставим онлайн
        else if (!previousPlatformStatus && this.isOnPlatform) {
            console.log('ActivityTracker: Returned to platform, setting online');
            this.updateOnlineStatus(true);
            this.startActivityTracking();
            this.startStatusPolling();
        }
        // Если перешли между страницами платформы - обновляем статус
        else if (this.isOnPlatform && previousPage !== this.currentPage) {
            console.log(`ActivityTracker: Switched platform page from ${previousPage} to ${this.currentPage}`);
            this.updateOnlineStatus(true);
        }
    }

    // Остановка отслеживания при уходе с платформы
    stopTracking() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.statusPollInterval) {
            clearInterval(this.statusPollInterval);
            this.statusPollInterval = null;
        }
    }

    // Настройка обработчиков закрытия страницы
    setupPageUnload() {
        const sendOffline = () => {
            // Отправляем офлайн статус только если были на платформе
            if (this.isOnPlatform && this.userData && navigator.sendBeacon) {
                const data = new Blob([JSON.stringify({
                    platform_user_id: this.userData.platform_user_id,
                    is_online: false,
                    reason: 'page_unload'
                })], {type: 'application/json'});
                
                navigator.sendBeacon(`${SERVER_URL}/update_activity`, data);
            } else if (this.isOnPlatform) {
                this.updateOnlineStatus(false);
            }
        };

        window.addEventListener('beforeunload', sendOffline);
        window.addEventListener('pagehide', sendOffline);
        window.addEventListener('unload', sendOffline);
    }

    // Обновление статуса онлайн - УЛУЧШЕННАЯ ВЕРСИЯ
    async updateOnlineStatus(isOnline) {
        // Если пытаемся установить онлайн, но не на платформе - игнорируем
        if (isOnline && !this.isOnPlatform) {
            console.log('ActivityTracker: Cannot set online when not on platform');
            return;
        }
        
        if (!this.userData) return;

        try {
            const response = await fetch(`${SERVER_URL}/update_activity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    platform_user_id: this.userData.platform_user_id,
                    is_online: isOnline,
                    force_update: true, // Добавляем флаг принудительного обновления
                    current_page: this.currentPage // Добавляем информацию о текущей странице
                }),
                credentials: 'include'
            });

            if (response.ok) {
                this.isOnline = isOnline;
                console.log(`ActivityTracker: User is ${isOnline ? 'online' : 'offline'} on page: ${this.currentPage}`);
                
                // Сохраняем статус в глобальное состояние
                window.GlobalState.updatePartial('activityData', {
                    [this.userData.platform_user_id]: {
                        is_online: isOnline,
                        last_update: Date.now()
                    }
                });
                
                // Уведомляем другие вкладки
                this.broadcastStatusUpdate(this.userData.platform_user_id, isOnline);
                
                // Обновляем свой статус на текущей странице если нужно
                if (this.currentPage === 'profile') {
                    this.updateOwnStatusUI(isOnline);
                }
                
                // При смене статуса очищаем кэш для мгновенного обновления
                this.lastCacheUpdate = 0;
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

    // Обновление статусов других пользователей - УЛУЧШЕННАЯ ВЕРСИЯ
    async refreshOnlineStatuses() {
        if (!this.userData || !this.isOnPlatform) return;

        try {
            const userIds = this.getUsersToUpdate();
            if (userIds.length === 0) return;

            // Более агрессивное обновление кэша - каждые 5 секунд
            const now = Date.now();
            const shouldUpdateCache = now - this.lastCacheUpdate > this.cacheTTL;

            if (!shouldUpdateCache && Object.keys(this.activityDataCache).length > 0) {
                this.updateUIStatuses(this.activityDataCache);
                return;
            }

            const response = await fetch(`${SERVER_URL}/get_activity_status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    user_ids: userIds,
                    force_refresh: true // Флаг для сервера
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.status === 'success') {
                    // Обновляем кэш
                    this.activityDataCache = { ...data.activity_data };
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
        
        // Собираем ID только если на платформе
        if (!this.isOnPlatform) return Array.from(userIds);
        
        switch (this.currentPage) {
            case 'contacts':
                this.collectContactUserIds(userIds);
                break;
            case 'chats':
                this.collectChatUserIds(userIds);
                break;
            case 'profile':
                // На странице профиля можем отслеживать статусы друзей если нужно
                this.collectFriendsUserIds(userIds);
                break;
        }

        return Array.from(userIds);
    }

    // Сбор ID пользователей со страницы контактов
    collectContactUserIds(userIds) {
        // Из списка контактов
        const contactItems = document.querySelectorAll('.user-result, .contact-item, .settings-item');
        contactItems.forEach(item => {
            const userId = item.getAttribute('data-user-id') || 
                          item.getAttribute('data-participant-id');
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
            const chatId = item.getAttribute('data-chat-id');
            // Находим участников чата из глобальной переменной или данных
            if (window.currentChatsList) {
                const chat = window.currentChatsList.find(c => c.id === chatId);
                if (chat && chat.participants) {
                    chat.participants.forEach(participant => {
                        if (participant.platform_user_id !== this.userData.platform_user_id) {
                            userIds.add(participant.platform_user_id);
                        }
                    });
                }
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

    // Сбор ID друзей для страницы профиля
    collectFriendsUserIds(userIds) {
        // Можно добавить логику для сбора ID друзей на странице профиля
        // если в будущем понадобится отображать их статусы
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
        // Обновляем UI только если на платформе
        if (!this.isOnPlatform) return;
        
        switch (this.currentPage) {
            case 'contacts':
                this.updateContactsUI(activityData);
                break;
            case 'chats':
                this.updateChatsUI(activityData);
                break;
            case 'profile':
                this.updateProfileUI(activityData);
                break;
        }
    }

    // Обновление UI контактов
    updateContactsUI(activityData) {
        // Обновление списка контактов
        const contactItems = document.querySelectorAll('.user-result, .contact-item');
        contactItems.forEach(item => {
            const userId = item.getAttribute('data-user-id');
            const statusElement = item.querySelector('.user-status, .contact-status, .chat-status');
            
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
            const chatId = item.getAttribute('data-chat-id');
            const statusElement = item.querySelector('.chat-status, .user-status');
            
            // Находим участника чата
            if (chatId && statusElement && window.currentChatsList) {
                const chat = window.currentChatsList.find(c => c.id === chatId);
                if (chat && chat.participants) {
                    const otherParticipant = chat.participants.find(
                        p => p.platform_user_id !== this.userData.platform_user_id
                    );
                    if (otherParticipant && activityData[otherParticipant.platform_user_id]) {
                        this.updateStatusElement(statusElement, activityData[otherParticipant.platform_user_id]);
                    }
                }
            }
        });

        // Обновление текущего чата
        this.updateCurrentChatStatus(activityData);
    }

    // Обновление UI профиля
    updateProfileUI(activityData) {
        // Можно добавить обновление статусов друзей на странице профиля
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
    if (window.activityTracker && window.activityTracker.isOnPlatform && !window.activityTracker.isInitialized) {
        setTimeout(() => window.activityTracker.init(), 1000);
    }
});

// Слушатель для обновления при возвращении на вкладку
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && 
        window.activityTracker && 
        window.activityTracker.isInitialized &&
        window.activityTracker.isOnPlatform) {
        // При возвращении на вкладку платформы принудительно обновляем статусы
        setTimeout(() => {
            window.activityTracker.updateOnlineStatus(true);
            window.activityTracker.forceRefresh();
        }, 500);
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
        if (window.activityTracker && window.activityTracker.isOnPlatform) {
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
    },
    
    // Ручное обновление статуса онлайн (только если на платформе)
    setOnline: () => {
        if (window.activityTracker && window.activityTracker.isOnPlatform) {
            window.activityTracker.updateOnlineStatus(true);
        }
    },
    
    // Принудительная установка офлайн статуса
    setOffline: () => {
        if (window.activityTracker) {
            window.activityTracker.updateOnlineStatus(false);
        }
    },
    
    // Проверка, находится ли пользователь на платформе
    isOnPlatform: () => {
        return window.activityTracker ? window.activityTracker.isOnPlatform : false;
    }
};

// Экспорт для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActivityTracker;
}

