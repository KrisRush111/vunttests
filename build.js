const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const htmlMinifier = require('html-minifier');
const Terser = require('terser');
const CleanCSS = require('clean-css');

const PAGES = ['index.html', 'profile.html', 'chats.html', 'contacts.html'];
const PROTECTED_DIR = 'protected';

// Конфигурация обфускации
const OBFUSCATION_CONFIG = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.75,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.4,
  debugProtection: true,
  debugProtectionInterval: 4000,
  disableConsoleOutput: true,
  identifierNamesGenerator: 'hexadecimal',
  log: false,
  numbersToExpressions: true,
  renameGlobals: false,
  selfDefending: true,
  simplify: true,
  splitStrings: true,
  splitStringsChunkLength: 10,
  stringArray: true,
  stringArrayEncoding: ['base64'],
  stringArrayIndexShift: true,
  stringArrayWrappersCount: 2,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 4,
  stringArrayWrappersType: 'function',
  stringArrayThreshold: 0.75,
  transformObjectKeys: true,
  unicodeEscapeSequence: false
};

// Защита от отладки и копирования
const PROTECTION_CODE = `
// ========== ЗАЩИТА VUNTGRAM ==========
(function() {
    var start = Date.now();
    
    // Анти-отладка
    setInterval(function() {
        if (Date.now() - start > 100) {
            (function() {})['constructor']('debugger')();
        }
    }, 1000);
    
    // Защита от DevTools
    var devtools = function() {};
    devtools.toString = function() {
        window.location.href = 'https://t.me/VuntgramBot';
        return '';
    };
    console.log('%c', devtools);
    
    // Блокировка клавиш
    document.addEventListener('keydown', function(e) {
        // F12, Ctrl+Shift+I, Ctrl+U, Ctrl+S
        if (e.keyCode === 123 || 
            (e.ctrlKey && e.shiftKey && e.keyCode === 73) ||
            (e.ctrlKey && e.keyCode === 85) ||
            (e.ctrlKey && e.keyCode === 83)) {
            e.preventDefault();
            e.stopPropagation();
            return false;
        }
    });
    
    // Блокировка контекстного меню
    document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
    });
    
    // Защита от копирования
    document.addEventListener('copy', function(e) {
        e.preventDefault();
        alert('Копирование запрещено');
        return false;
    });
    
    // Обнаружение DevTools
    var element = new Image();
    Object.defineProperty(element, 'id', {
        get: function() {
            window.location.reload();
        }
    });
    console.log(element);
})();
// =====================================
`;

// Функция для извлечения и обфускации JS из HTML
async function extractAndObfuscateJS(html, pageName) {
    const scripts = [];
    let processedHtml = html;
    
    // Извлекаем все inline скрипты
    const scriptRegex = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
    let match;
    let index = 0;
    
    while ((match = scriptRegex.exec(html)) !== null) {
        const fullMatch = match[0];
        const scriptContent = match[1];
        
        if (scriptContent.trim()) {
            const scriptId = `script_${pageName}_${index}`;
            const scriptPath = path.join(PROTECTED_DIR, `${scriptId}.js`);
            
            try {
                // Минификация + обфускация
                const minified = await Terser.minify(scriptContent, {
                    compress: { drop_debugger: false },
                    mangle: { toplevel: true }
                });
                
                if (minified.error) throw minified.error;
                
                const obfuscated = JavaScriptObfuscator.obfuscate(
                    minified.code,
                    OBFUSCATION_CONFIG
                );
                
                const finalCode = PROTECTION_CODE + '\n' + obfuscated.getObfuscatedCode();
                fs.writeFileSync(scriptPath, finalCode);
                
                // Заменяем inline скрипт на внешний
                processedHtml = processedHtml.replace(
                    fullMatch,
                    `<script src="${scriptPath}"></script>`
                );
                
                scripts.push(scriptPath);
                index++;
            } catch (error) {
                console.error(`Ошибка обработки скрипта ${scriptId}:`, error);
            }
        }
    }
    
    return processedHtml;
}

// Функция минификации HTML
function minifyHTML(html) {
    return htmlMinifier.minify(html, {
        collapseWhitespace: true,
        removeComments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        removeScriptTypeAttributes: true,
        removeStyleLinkTypeAttributes: true,
        minifyJS: true,
        minifyCSS: true
    });
}

// Функция минификации CSS
function minifyCSS(css) {
    return new CleanCSS({}).minify(css).styles;
}

// Главная функция обработки
async function processPages() {
    // Создаем папку для защищенных файлов
    if (!fs.existsSync(PROTECTED_DIR)) {
        fs.mkdirSync(PROTECTED_DIR);
    }
    
    for (const page of PAGES) {
        if (!fs.existsSync(page)) {
            console.warn(`Файл ${page} не найден, пропускаем`);
            continue;
        }
        
        console.log(`Обработка ${page}...`);
        
        try {
            // Читаем исходный HTML
            let html = fs.readFileSync(page, 'utf8');
            
            // 1. Минификация и обфускация CSS
            const styleRegex = /<style[^>]*>([\s\S]*?)<\/style>/gi;
            html = html.replace(styleRegex, (match, css) => {
                try {
                    const minifiedCSS = minifyCSS(css);
                    return `<style>${minifiedCSS}</style>`;
                } catch (error) {
                    console.error('Ошибка минификации CSS:', error);
                    return match;
                }
            });
            
            // 2. Извлечение и обфускация JavaScript
            html = await extractAndObfuscateJS(html, path.basename(page, '.html'));
            
            // 3. Минификация HTML
            html = minifyHTML(html);
            
            // 4. Добавляем дополнительные защитные заголовки
            const metaTags = `
                <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';">
                <meta name="referrer" content="no-referrer">
            `;
            
            html = html.replace('</head>', `${metaTags}</head>`);
            
            // 5. Сохраняем защищенную версию
            const outputPath = path.join(PROTECTED_DIR, page);
            fs.writeFileSync(outputPath, html);
            
            console.log(`✓ ${page} защищен и сохранен в ${outputPath}`);
            
        } catch (error) {
            console.error(`Ошибка обработки ${page}:`, error);
        }
    }
    
    // Копируем статические файлы
    const staticFiles = ['фон.webp', 'фон3.webp', 'фон4.webp', 'фон5.webp', 'фон6.webp', 'фон7.webp'];
    for (const file of staticFiles) {
        if (fs.existsSync(file)) {
            fs.copyFileSync(file, path.join(PROTECTED_DIR, file));
        }
    }
    
    console.log('\n✅ Все страницы защищены!');
    console.log(`📁 Защищенные файлы в папке: ${PROTECTED_DIR}`);
    console.log('\nДля публикации на GitHub Pages используйте содержимое папки "protected"');
}

// Запуск
processPages().catch(console.error);