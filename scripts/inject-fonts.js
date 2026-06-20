const fs = require('fs');
const path = require('path');

// Copy font to dist/fonts/
const fontSrc = path.join(__dirname, '..', 'public', 'fonts', 'Ionicons.ttf');
const fontsDir = path.join(__dirname, '..', 'dist', 'fonts');
const fontDst = path.join(fontsDir, 'Ionicons.ttf');

if (!fs.existsSync(fontsDir)) {
  fs.mkdirSync(fontsDir, { recursive: true });
}
fs.copyFileSync(fontSrc, fontDst);
console.log('Ionicons.ttf copied to dist/fonts/');

// Inject @font-face into dist/index.html
const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

const fontCSS = `  <style>
    @font-face {
      font-family: 'Ionicons';
      src: url('/fonts/Ionicons.ttf') format('truetype');
      font-display: block;
    }
  </style>`;

html = html.replace('</head>', `${fontCSS}\n</head>`);
fs.writeFileSync(indexPath, html);
console.log('Ionicons font-face injected into dist/index.html');
