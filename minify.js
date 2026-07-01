const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

// Список ваших файлов — добавляйте/убирайте по необходимости
const files = [
  'index.html',
  'chats.html',
  'profile.html',
  'Contacts.html',
];

const minifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
};

async function build() {
  const distDir = path.join(__dirname, 'dist');

  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir);
  }

  for (const file of files) {
    const srcPath = path.join(__dirname, file);

    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️  Файл не найден, пропускаю: ${file}`);
      continue;
    }

    const html = fs.readFileSync(srcPath, 'utf8');
    const result = await minify(html, minifyOptions);

    const distPath = path.join(distDir, file);
    fs.writeFileSync(distPath, result);
    console.log(`✅ Собрано: dist/${file}`);
  }

  console.log('🎉 Готово!');
}

build();
