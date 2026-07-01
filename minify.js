const fs = require('fs');
const path = require('path');
const { minify } = require('html-minifier-terser');
const JavaScriptObfuscator = require('javascript-obfuscator');

// HTML-страницы, которые нужно обработать
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

const obfuscatorOptions = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayThreshold: 0.75,
  selfDefending: true,
  disableConsoleOutput: true,
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
// кроме служебных файлов и HTML (их обрабатываем отдельно)
function copyStaticAssets(srcDir, distDir) {
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });

  for (const entry of entries) {
    if (IGNORE.has(entry.name)) continue;

    const srcPath = path.join(srcDir, entry.name);
    const distPath = path.join(distDir, entry.name);

    if (entry.isDirectory()) {
      fs.mkdirSync(distPath, { recursive: true });
      copyStaticAssets(srcPath, distPath);
    } else if (entry.isFile()) {
      if (htmlFiles.includes(entry.name)) continue;
      fs.copyFileSync(srcPath, distPath);
    }
  }
}

// Находит все <script>...</script> БЕЗ атрибута src
// (то есть встроенный JS-код, а не подключение внешнего файла)
// и обфусцирует содержимое каждого
function obfuscateInlineScripts(html) {
  const scriptRegex = /<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi;

  return html.replace(scriptRegex, (match, attrs, code) => {
    const trimmed = code.trim();

    // пустой script (например <script type="module" src="..."> без содержимого) — не трогаем
    if (!trimmed) return match;

    try {
      const result = JavaScriptObfuscator.obfuscate(trimmed, obfuscatorOptions);
      return `<script${attrs}>${result.getObfuscatedCode()}</script>`;
    } catch (err) {
      console.warn(`Не удалось обфусцировать inline-скрипт: ${err.message}`);
      return match; // если не получилось — оставляем как есть
    }
  });
}

// Обрабатывает HTML-файлы: обфускация встроенного JS + минификация
async function processHtmlFiles(srcDir, distDir) {
  for (const file of htmlFiles) {
    const srcPath = path.join(srcDir, file);
    const distPath = path.join(distDir, file);

    if (!fs.existsSync(srcPath)) {
      console.warn(`Пропущен (не найден): ${file}`);
      continue;
    }

    let html = fs.readFileSync(srcPath, 'utf8');

    // 1. обфусцируем встроенный JS
    html = obfuscateInlineScripts(html);

    // 2. минифицируем HTML (minifyJS:true просто дополнительно почистит уже обфусцированный код)
    const minified = await minify(html, minifyOptions);

    fs.writeFileSync(distPath, minified);
    console.log(`Обработан: ${file}`);
  }
}

async function build() {
  const srcDir = __dirname;
  const distDir = path.join(__dirname, 'dist');

  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  copyStaticAssets(srcDir, distDir);
  await processHtmlFiles(srcDir, distDir);

  console.log('Сборка завершена! Результат в папке dist/');
}

build().catch((err) => {
  console.error('Ошибка сборки:', err);
  process.exit(1);
});
