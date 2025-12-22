// core-protection.js - Общая защита для всех страниц
class VuntgramProtection {
    constructor() {
        this.init();
    }
    
    init() {
        this.antiDebug();
        this.blockDevTools();
        this.blockKeys();
        this.blockContextMenu();
        this.detectTampering();
        this.obfuscateDOM();
        this.validateEnvironment();
    }
    
    antiDebug() {
        // Расширенная защита от отладки
        const debuggerLoop = () => {
            setInterval(() => {
                const diff = performance.now();
                if (diff > 100) {
                    (function(){})['constructor']('debugger')();
                }
            }, 1000);
            
            // Случайные изменения интервалов
            setTimeout(debuggerLoop, Math.random() * 5000 + 1000);
        };
        debuggerLoop();
    }
    
    blockDevTools() {
        // Обнаружение открытия DevTools
        const element = new Image();
        Object.defineProperties(element, {
            id: {
                get: () => {
                    window.location.href = 'https://t.me/VuntgramBot?start=protection';
                    throw new Error('Security violation');
                }
            }
        });
        
        console.log('%c ', element);
        
        // Проверка размера окна
        const checkDevTools = () => {
            const threshold = 160;
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            
            if (widthThreshold || heightThreshold) {
                document.body.innerHTML = '<div style="padding: 20px; text-align: center;">Запрещенный доступ обнаружен</div>';
                throw new Error('DevTools detected');
            }
        };
        
        setInterval(checkDevTools, 1000);
    }
    
    blockKeys() {
        // Расширенная блокировка клавиш
        const blockedCombos = [
            { ctrl: true, shift: true, key: 'I', code: 73 },
            { ctrl: true, shift: true, key: 'J', code: 74 },
            { ctrl: true, shift: true, key: 'C', code: 67 },
            { ctrl: true, key: 'U', code: 85 },
            { ctrl: true, key: 'S', code: 83 },
            { key: 'F12', code: 123 },
            { key: 'F11', code: 122 },
            { key: 'F8', code: 119 }
        ];
        
        document.addEventListener('keydown', (e) => {
            for (const combo of blockedCombos) {
                if ((!combo.ctrl || e.ctrlKey) &&
                    (!combo.shift || e.shiftKey) &&
                    (e.key === combo.key || e.keyCode === combo.code)) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // Рандомная задержка и редирект
                    setTimeout(() => {
                        window.location.href = 'https://t.me/VuntgramBot';
                    }, Math.random() * 1000);
                    
                    return false;
                }
            }
        }, true);
    }
    
    blockContextMenu() {
        // Блокировка всех действий с правой кнопкой
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Динамическое изменение контента
            const warning = document.createElement('div');
            warning.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: rgba(0,0,0,0.9);
                color: white;
                padding: 20px;
                border-radius: 10px;
                z-index: 999999;
            `;
            warning.textContent = 'Контекстное меню заблокировано';
            document.body.appendChild(warning);
            
            setTimeout(() => warning.remove(), 1500);
            
            return false;
        }, true);
        
        // Блокировка перетаскивания
        document.addEventListener('dragstart', (e) => e.preventDefault(), true);
        document.addEventListener('drop', (e) => e.preventDefault(), true);
    }
    
    detectTampering() {
        // Защита от изменения DOM
        const originalDOM = document.documentElement.outerHTML;
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(() => {
                const currentDOM = document.documentElement.outerHTML;
                if (originalDOM !== currentDOM) {
                    document.body.innerHTML = '<h1>Обнаружено вмешательство</h1>';
                    throw new Error('DOM tampering detected');
                }
            });
        });
        
        observer.observe(document.documentElement, {
            attributes: true,
            childList: true,
            subtree: true,
            characterData: true
        });
    }
    
    obfuscateDOM() {
        // Динамическое изменение ID и классов
        setInterval(() => {
            const elements = document.querySelectorAll('[id], [class]');
            elements.forEach(el => {
                if (Math.random() > 0.9) {
                    if (el.id) el.id = 'id_' + Math.random().toString(36).substr(2, 9);
                    if (el.className) el.className = 'cls_' + Math.random().toString(36).substr(2, 9);
                }
            });
        }, 5000);
    }
    
    validateEnvironment() {
        // Проверка окружения
        const checks = [
            // Проверка на эмуляцию
            () => navigator.webdriver === undefined,
            // Проверка на headless браузер
            () => navigator.plugins.length > 0,
            // Проверка на automation
            () => !/PhantomJS|HeadlessChrome|Selenium/i.test(navigator.userAgent),
            // Проверка языка
            () => navigator.language === 'ru' || navigator.language === 'ru-RU'
        ];
        
        if (checks.some(check => !check())) {
            setTimeout(() => {
                document.body.innerHTML = '<div style="padding: 20px;">Доступ запрещен</div>';
                window.stop();
            }, 1000);
        }
    }
}

// Инициализация защиты
if (typeof window !== 'undefined') {
    window.vuntgramProtection = new VuntgramProtection();
    
    // Запрет доступа к объекту защиты
    Object.defineProperty(window, 'vuntgramProtection', {
        configurable: false,
        writable: false,
        enumerable: false
    });
}