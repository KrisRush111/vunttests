const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');

// HTML-страницы, которые нужно минифицировать
const htmlFiles = [
  'index.html',
  'chats.html',
  'profile.html',
  'contacts.html',
];

const minifyOptions = {
  collapseWhitespace: true,
  removeComments: true,
  minifyCSS: true,
  minifyJS: true,
};

// Папки/файлы, которые НЕ нужно копировать в dist
const IGNORE = new Set([
  'node_modules',
  '.git',
  '.github',
  'dist',
  'minify.js',
  'package.json',
  'package-lock.json',
  '.gitignore',
]);

// Рекурсивно копирует всё из корня проекта в dist,
// кроме служебных файлов и HTML (их минифицируем отдельно)
function copyStaticAssets(srcDir, distDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;

    const srcPath = path.join(srcDir, entry.name);
    const distPath = path.join(distDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(distPath, { recursive: true });
      copyStaticAssets(srcPath, distPath);
    } else {
      // HTML-файлы из списка выше обработаем отдельно (минификация),
      // остальное — просто копируем как есть
      if (htmlFiles.includes(entry.name)) continue;
      fs.copyFileSync(srcPath, distPath);
      console.log(`📄 Скопировано: ${path.relative(__dirname, distPath)}`);
    }
  }
}

async function build() {
  const rootDir = __dirname;
  const distDir = path.join(rootDir, 'dist');

  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // 1. Копируем все статические файлы (js, css, json, картинки и т.д.)
  copyStaticAssets(rootDir, distDir);

  // 2. Минифицируем HTML-страницы
  for (const file of htmlFiles) {
    const srcPath = path.join(rootDir, file);

    if (!fs.existsSync(srcPath)) {
      console.warn(`⚠️  Файл не найден, пропускаю: ${file}`);
      continue;
    }

    const html = fs.readFileSync(srcPath, 'utf8');
    const result = await minify(html, minifyOptions);

    const distPath = path.join(distDir, file);
    fs.writeFileSync(distPath, result);
    console.log(`✅ Минифицировано: dist/${file}`);
  }

  console.log('🎉 Готово!');
}

build().catch((err) => {
  console.error('❌ Ошибка сборки:', err);
  process.exit(1);
});
