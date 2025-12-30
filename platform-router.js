// platform-router.js
class PlatformRouter {
    constructor() {
        this.pages = ['chats.html', 'profile.html', 'contacts.html'];
        this.isTransitioning = false;
        this.init();
    }
    
    init() {
        // Перехват кликов по ссылкам
        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href]');
            if (!link) return;
            
            const href = link.getAttribute('href');
            if (this.isInternalPage(href)) {
                e.preventDefault();
                this.navigateTo(href);
            }
        });
        
        // Обработка кнопок "Назад"
        window.addEventListener('popstate', () => {
            this.handleNavigation(window.location.pathname.split('/').pop(), true);
        });
    }
    
    isInternalPage(href) {
        return this.pages.some(page => href.includes(page));
    }
    
    async navigateTo(page) {
        if (this.isTransitioning) return;
        this.isTransitioning = true;
        
        try {
            // Сохраняем текущее состояние страницы
            this.savePageState();
            
            // Загружаем новую страницу без перезагрузки
            await this.loadPage(page);
            
            // Обновляем URL без перезагрузки
            window.history.pushState({}, '', page);
            
            // Восстанавливаем состояние навигации
            this.restoreNavigationState();
            
        } catch (error) {
            console.error('Navigation error:', error);
            // Fallback: обычная навигация
            window.location.href = page;
        } finally {
            this.isTransitioning = false;
        }
    }
    
    savePageState() {
        const state = {
            scrollPosition: window.scrollY,
            formData: this.collectFormData(),
            activeElements: this.getActiveElements(),
            timestamp: Date.now()
        };
        
        const currentPage = window.location.pathname.split('/').pop();
        localStorage.setItem(`page_state_${currentPage}`, JSON.stringify(state));
    }
    
    collectFormData() {
        const forms = document.querySelectorAll('form');
        const data = {};
        
        forms.forEach(form => {
            const formData = new FormData(form);
            const entries = Array.from(formData.entries());
            if (entries.length > 0) {
                data[form.id || form.className] = Object.fromEntries(entries);
            }
        });
        
        return data;
    }
    
    getActiveElements() {
        return {
            activeTab: document.querySelector('.nav-item.active')?.getAttribute('href'),
            openModals: Array.from(document.querySelectorAll('.modal.active')).map(m => m.id),
            currentChat: window.currentChat || null
        };
    }
    
    async loadPage(page) {
        return new Promise((resolve, reject) => {
            // Используем fetch для получения страницы
            fetch(page)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to load ${page}`);
                    return response.text();
                })
                .then(html => {
                    // Парсим HTML
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(html, 'text/html');
                    
                    // Извлекаем только нужный контент
                    const newContent = doc.querySelector('.desktop-content') || 
                                      doc.querySelector('.mobile-settings-view') ||
                                      doc.querySelector('.mobile-chats-container') ||
                                      doc.body;
                    
                    // Заменяем контент
                    this.replaceContent(newContent);
                    
                    // Загружаем скрипты
                    this.loadScripts(doc);
                    
                    // Инициализируем новую страницу
                    this.initializePage(page);
                    
                    resolve();
                })
                .catch(reject);
        });
    }
    
    replaceContent(newContent) {
        const container = document.querySelector('.desktop-content') || 
                         document.querySelector('.mobile-settings-view') ||
                         document.querySelector('.mobile-chats-container') ||
                         document.body;
        
        if (container) {
            container.innerHTML = newContent.innerHTML;
        }
    }
    
    loadScripts(doc) {
        // Извлекаем скрипты из новой страницы
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => {
            if (script.src) {
                // Внешние скрипты
                const newScript = document.createElement('script');
                newScript.src = script.src;
                document.head.appendChild(newScript);
            } else if (script.textContent.trim()) {
                // Встроенные скрипты
                try {
                    // Выполняем код в изолированном контексте
                    const func = new Function(script.textContent);
                    func();
                } catch (error) {
                    console.error('Error executing script:', error);
                }
            }
        });
    }
    
    initializePage(page) {
        // Вызываем инициализацию страницы
        switch(page) {
            case 'chats.html':
                if (typeof initializePage === 'function') {
                    initializePage();
                }
                break;
            case 'profile.html':
                if (typeof initializeProfile === 'function') {
                    initializeProfile();
                }
                break;
            case 'contacts.html':
                if (typeof initializeContacts === 'function') {
                    initializeContacts();
                }
                break;
        }
        
        // Обновляем активную вкладку в навигации
        this.updateActiveNav(page);
        
        // Восстанавливаем состояние
        this.restorePageState(page);
        
        // Уведомляем о смене страницы
        window.GlobalState.emit('page_changed', { page });
    }
    
    updateActiveNav(page) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.getAttribute('href') === page) {
                item.classList.add('active');
            }
        });
    }
    
    restorePageState(page) {
        const savedState = localStorage.getItem(`page_state_${page}`);
        if (savedState) {
            const state = JSON.parse(savedState);
            
            // Восстанавливаем позицию прокрутки
            setTimeout(() => {
                window.scrollTo(0, state.scrollPosition || 0);
            }, 100);
            
            // Восстанавливаем активные элементы
            if (state.activeElements?.currentChat && typeof window.openChat === 'function') {
                setTimeout(() => {
                    window.openChat(state.activeElements.currentChat);
                }, 200);
            }
        }
    }
    
    restoreNavigationState() {
        // Обновляем навигационные элементы
        const currentPage = window.location.pathname.split('/').pop();
        this.updateActiveNav(currentPage);
    }
}

// Инициализируем роутер
window.platformRouter = new PlatformRouter();