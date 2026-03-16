// core-protection.js - Улучшенная защита для всех страниц
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
        // Расширенная защита от отладки (debugger loop)
        const debuggerLoop = () => {
            setInterval(() => {
                const startTime = performance.now();
                // Вызов debugger заставляет браузер остановиться, если DevTools открыт
                (function(){})['constructor']('debugger')();
                const endTime = performance.now();
                
                // Если выполнение заняло слишком много времени, значит DevTools открыт
                if (endTime - startTime > 100) {
                    this.onViolation('Debugger detected');
                }
            }, 1000);
            
            // Случайные изменения интервалов для усложнения обхода
            setTimeout(debuggerLoop, Math.random() * 5000 + 1000);
        };
        debuggerLoop();
    }
    
    blockDevTools() {
        // Обнаружение открытия DevTools через проверку размеров
        const checkDevTools = () => {
            const threshold = 160;
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            
            if (widthThreshold || heightThreshold) {
                this.onViolation('DevTools detected via window size');
            }
        };
        
        // Обнаружение через console.log и геттеры (более современный метод)
        const devtools = {
            isOpen: false,
            orientation: undefined
        };
        const threshold = 160;
        const emitEvent = (isOpen, orientation) => {
            if (isOpen) {
                this.onViolation('DevTools detected via console');
            }
        };

        setInterval(() => {
            const widthThreshold = window.outerWidth - window.innerWidth > threshold;
            const heightThreshold = window.outerHeight - window.innerHeight > threshold;
            const orientation = widthThreshold ? 'vertical' : 'horizontal';

            if (!(heightThreshold && widthThreshold) &&
                ((window.Firebug && window.Firebug.chrome && window.Firebug.chrome.isInitialized) || widthThreshold || heightThreshold)) {
                if (!devtools.isOpen || devtools.orientation !== orientation) {
                    emitEvent(true, orientation);
                }
                devtools.isOpen = true;
                devtools.orientation = orientation;
            } else {
                if (devtools.isOpen) {
                    emitEvent(false, undefined);
                }
                devtools.isOpen = false;
                devtools.orientation = undefined;
            }
        }, 500);
    }
    
    blockKeys() {
        // Расширенная блокировка клавиш (Windows, Linux, Mac)
        document.addEventListener('keydown', (e) => {
            const isCtrl = e.ctrlKey || e.metaKey; // metaKey для Mac (Cmd)
            const isShift = e.shiftKey;
            const isAlt = e.altKey;
            
            // F12
            if (e.key === 'F12' || e.keyCode === 123) {
                this.prevent(e);
            }
            
            // Ctrl+U (View Source)
            if (isCtrl && (e.key === 'u' || e.key === 'U' || e.keyCode === 85)) {
                this.prevent(e);
            }
            
            // Ctrl+Shift+I / Cmd+Opt+I (Inspect)
            if (isCtrl && isShift && (e.key === 'i' || e.key === 'I' || e.keyCode === 73)) {
                this.prevent(e);
            }
            if (isCtrl && isAlt && (e.key === 'i' || e.key === 'I' || e.keyCode === 73)) {
                this.prevent(e);
            }
            
            // Ctrl+Shift+J / Cmd+Opt+J (Console)
            if (isCtrl && isShift && (e.key === 'j' || e.key === 'J' || e.keyCode === 74)) {
                this.prevent(e);
            }
            if (isCtrl && isAlt && (e.key === 'j' || e.key === 'J' || e.keyCode === 74)) {
                this.prevent(e);
            }
            
            // Ctrl+Shift+C / Cmd+Opt+C (Element Picker)
            if (isCtrl && isShift && (e.key === 'c' || e.key === 'C' || e.keyCode === 67)) {
                this.prevent(e);
            }
            if (isCtrl && isAlt && (e.key === 'c' || e.key === 'C' || e.keyCode === 67)) {
                this.prevent(e);
            }
            
            // Ctrl+S / Cmd+S (Save Page)
            if (isCtrl && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
                this.prevent(e);
            }
            
            // F11 (Full screen - иногда используется для обхода)
            if (e.key === 'F11' || e.keyCode === 122) {
                // this.prevent(e); // Опционально
            }
        }, true);
    }
    
    blockContextMenu() {
        // Блокировка правой кнопки мыши
        document.addEventListener('contextmenu', (e) => {
            this.prevent(e);
            this.showWarning('Контекстное меню заблокировано');
        }, true);
        
        // Блокировка перетаскивания (чтобы нельзя было перетащить картинку или текст)
        document.addEventListener('dragstart', (e) => e.preventDefault(), true);
    }
    
    detectTampering() {
        // Защита от изменения DOM (например, удаления скриптов защиты)
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.removedNodes.length > 0) {
                    for (const node of mutation.removedNodes) {
                        if (node.id === 'vuntgram-protection-script' || node.tagName === 'SCRIPT') {
                            this.onViolation('Script removal detected');
                        }
                    }
                }
            }
        });
        
        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }
    
    obfuscateDOM() {
        // Периодическая проверка целостности критических элементов
        setInterval(() => {
            if (!document.getElementById('vuntgram-protection-script')) {
                // Если скрипт удален, перезагружаем или блокируем
                // window.location.reload();
            }
        }, 2000);
    }
    
    validateEnvironment() {
        // Проверка на автоматизацию (Selenium, Puppeteer и т.д.)
        const isAutomated = navigator.webdriver || 
                           !!window.__webdriver_evaluate || 
                           !!window.__selenium_evaluate || 
                           !!window.__webdriver_script_function;
        
        if (isAutomated) {
            this.onViolation('Automation detected');
        }
    }
    
    // Вспомогательные методы
    prevent(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
    }
    
    showWarning(text) {
        const warning = document.createElement('div');
        warning.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 0, 0, 0.8);
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000000;
            font-family: sans-serif;
            pointer-events: none;
        `;
        warning.textContent = text;
        document.body.appendChild(warning);
        setTimeout(() => warning.remove(), 2000);
    }
    
    onViolation(reason) {
        console.warn('Security Violation:', reason);
        // Редирект на страницу-заглушку или в бота
        window.location.href = 'https://t.me/VuntgramBot?start=security_alert';
        
        // Очистка страницы для предотвращения просмотра
        document.documentElement.innerHTML = '<div style="background:#000;color:#f00;height:100vh;display:flex;align-items:center;justify-content:center;font-family:sans-serif;"><h1>ACCESS DENIED</h1></div>';
    }
}

// Инициализация
(function() {
    const protection = new VuntgramProtection();
    // Делаем объект недоступным для изменения из консоли
    Object.freeze(protection);
})();
