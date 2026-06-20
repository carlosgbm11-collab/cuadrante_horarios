const fs = require('fs');
const path = require('path');

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
