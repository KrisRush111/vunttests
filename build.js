const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');

console.log('🚀 Защита кода Vuntgram...');

const PAGES = ['index.html', 'profile.html', 'chats.html', 'contacts.html'];
const folders = ['protected', 'public'];

// Создаем папки
folders.forEach(folder => {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);
});

// В защитный код добавьте этот блок:
const protectionCode = `
<script>
// ===== VUNTGRAM SUPER PROTECTION =====
(function() {
  'use strict';
  
  // 1. БЛОКИРОВКА ВСЕХ СОХРАНЕНИЙ
  // Блокировка Cmd/Ctrl+S
  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault();
      e.stopPropagation();
      alert('Сохранение страницы запрещено');
      return false;
    }
  });
  
  // 2. БЛОКИРОВКА МЕНЮ File → Save
  window.addEventListener('beforeunload', function(e) {
    // Не даем легко сохранить через диалог
    return "Вы уверены, что хотите уйти? Изменения могут быть потеряны.";
  });
  
  // 3. ЗАПРЕТ ПЕРЕТАСКИВАНИЯ ФАЙЛОВ
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'A') {
      e.preventDefault();
      return false;
    }
  });
  
  // 4. ПОДМЕНА СОДЕРЖИМОГО ПРИ СОХРАНЕНИИ
  // Перехватываем innerHTML и outerHTML
  var originalHTML = document.documentElement.outerHTML;
  Object.defineProperty(document.documentElement, 'innerHTML', {
    get: function() {
      return '<!-- Защищено Vuntgram -->' + this._originalInner;
    },
    set: function(value) {
      this._originalInner = value;
    }
  });
  
  // 5. АНТИ-ОТЛАДКА (уже есть, но усилим)
  setInterval(function() {
    (function() {})['constructor']('debugger')();
  }, 3000);
  
  // 6. БЛОКИРОВКА ПРАВОЙ КНОПКИ
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  });
  
  
  // 8. ОБНАРУЖЕНИЕ СОХРАНЕНИЯ ЧЕРЕЗ PRINT
  window.addEventListener('beforeprint', function() {
    alert('Печать/сохранение в PDF запрещено');
    window.stop();
  });
  
  // 9. ЗАЩИТА ОТ КОПИРОВАНИЯ ВСЕГО СОДЕРЖИМОГО
  document.addEventListener('selectstart', function(e) {
    e.preventDefault();
    return false;
  });
  
  document.addEventListener('copy', function(e) {
    e.preventDefault();
    e.clipboardData.setData('text/plain', 'Копирование запрещено Vuntgram');
    return false;
  });
  
  // 10. ДИНАМИЧЕСКОЕ ИЗМЕНЕНИЕ DOM ПРИ ПОПЫТКЕ СОХРАНЕНИЯ
  var saveAttempts = 0;
  window.addEventListener('keydown', function(e) {
    if (e.key === 's' && (e.metaKey || e.ctrlKey)) {
      saveAttempts++;
      if (saveAttempts > 2) {
        // При многократных попытках портим страницу
        document.body.innerHTML = '<h1>Доступ заблокирован</h1>';
        window.location.reload();
      }
    }
  });
})();
// =====================================
</script>
`;

// Обрабатываем страницы
PAGES.forEach(page => {
  console.log(`Обработка ${page}...`);
  
  try {
    if (fs.existsSync(page)) {
      let html = fs.readFileSync(page, 'utf8');
      
      // Добавляем защиту
      if (html.includes('</head>')) {
        html = html.replace('</head>', protectionCode + '</head>');
      }
      
      // Сохраняем в обе папки
      folders.forEach(folder => {
        fs.writeFileSync(`${folder}/${page}`, html);
      });
      
      console.log(`✓ ${page} защищен`);
    }
  } catch (error) {
    console.log(`Ошибка обработки ${page}:`, error.message);
  }
});

// Копируем статические файлы
const assets = ['icon-192x192.png', 'icon-512x512.png', 'manifest.json'];
assets.forEach(file => {
  if (fs.existsSync(file)) {
    folders.forEach(folder => {
      fs.copyFileSync(file, `${folder}/${file}`);
    });
  }
});

console.log('\n✅ Все страницы защищены!');
console.log('📁 Защищенные файлы в папках: protected/ и public/');
