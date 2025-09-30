// Добавьте в конец script тега в каждом HTML файле
// PWA Update Manager
class PWAUpdateManager {
  constructor() {
    this.init();
  }
  
  init() {
    this.setupServiceWorker();
    this.setupUpdateListeners();
  }
  
  setupServiceWorker() {
    if ('serviceWorker' in navigator) {
      // Регистрируем Service Worker
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker зарегистрирован');
          
          // Проверяем обновления при загрузке
          registration.update();
          
          // Слушаем сообщения от Service Worker
          navigator.serviceWorker.addEventListener('message', event => {
            this.handleServiceWorkerMessage(event);
          });
        })
        .catch(error => {
          console.error('Ошибка регистрации Service Worker:', error);
        });
    }
  }
  
  setupUpdateListeners() {
    // Проверяем обновления при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && navigator.serviceWorker) {
        navigator.serviceWorker.ready.then(registration => {
          registration.update();
        });
      }
    });
    
    // Периодическая проверка (каждые 10 минут)
    setInterval(() => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.ready.then(registration => {
          registration.update();
        });
      }
    }, 10 * 60 * 1000);
  }
  
  handleServiceWorkerMessage(event) {
    const { data } = event;
    
    if (data.type === 'MAJOR_UPDATE_AVAILABLE') {
      this.showUpdateNotification();
    }
    
    if (data.type === 'CONTENT_UPDATED') {
      console.log('Контент обновлен:', data.url);
      // Можно обновить интерфейс если нужно
    }
  }
  
  showUpdateNotification() {
    // Создаем баннер об обновлении
    const updateBanner = document.createElement('div');
    updateBanner.innerHTML = `
      <div style="position: fixed; top: 0; left: 0; right: 0; background: #0088cc; color: white; padding: 12px; text-align: center; z-index: 10000; box-shadow: 0 2px 10px rgba(0,0,0,0.2); display: flex; justify-content: center; align-items: center; gap: 15px;">
        <span>Доступно обновление Vuntgram!</span>
        <button id="reloadApp" style="background: white; color: #0088cc; border: none; padding: 6px 16px; border-radius: 15px; cursor: pointer; font-weight: bold;">
          Обновить
        </button>
      </div>
    `;
    document.body.appendChild(updateBanner);

    document.getElementById('reloadApp').addEventListener('click', () => {
      window.location.reload();
    });
  }
}

// Инициализируем при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
  new PWAUpdateManager();
});