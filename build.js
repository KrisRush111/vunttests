const fs = require('fs');
const JavaScriptObfuscator = require('javascript-obfuscator');

console.log('🚀 Защита кода Vuntgram...');

const PAGES = ['index.html', 'profile.html', 'chats.html', 'contacts.html'];
const folders = ['protected', 'public'];

// Создаем папки
folders.forEach(folder => {
  if (!fs.existsSync(folder)) fs.mkdirSync(folder);
});

// Простая защита (без минификации)
const protectionCode = `
<script>
// Vuntgram Protection
(function(){
  setInterval(()=>{debugger},4000);
  document.addEventListener('contextmenu',e=>e.preventDefault());
  document.addEventListener('keydown',e=>{
    if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&e.key==='I')){
      e.preventDefault();
      location.href='https://t.me/VuntgramBot';
    }
  });
})();
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
