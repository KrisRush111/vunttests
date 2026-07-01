const JavaScriptObfuscator = require('javascript-obfuscator');
const fs = require('fs-extra');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(__dirname, 'public');

// файлы/папки, которые НЕ нужно копировать в сборку
const EXCLUDE = [
  'node_modules',
  'public',
  'build.js',
  'package.json',
  'package-lock.json',
  'vercel.json',
  '.git',
  '.gitignore',
  'README.md',
  '.github',
  'dist',
  'minify.js'
];

async function build() {
  await fs.emptyDir(OUT);

  const items = await fs.readdir(ROOT);

  for (const item of items) {
    if (EXCLUDE.includes(item)) continue;

    const srcPath = path.join(ROOT, item);
    const destPath = path.join(OUT, item);

    await fs.copy(srcPath, destPath);
  }

  // обфусцируем все .js файлы прямо в public/ (плоско)
  const files = await fs.readdir(OUT);

  for (const file of files) {
    if (!file.endsWith('.js')) continue;

    const filePath = path.join(OUT, file);
    const code = await fs.readFile(filePath, 'utf8');

    const result = JavaScriptObfuscator.obfuscate(code, {
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
    });

    await fs.writeFile(filePath, result.getObfuscatedCode());
    console.log(`Обфусцирован: ${file}`);
  }

  console.log('Сборка завершена! Результат в папке public/');
}

build().catch(err => {
  console.error(err);
  process.exit(1);
});
