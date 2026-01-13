#!/usr/bin/env node
/**
 * Generate PNG icons from SVG for PWA
 * Run with: node scripts/generate-icons.js
 *
 * Note: This creates data URI encoded PNGs as placeholders.
 * For production, use a tool like sharp or imagemagick to convert SVG to PNG.
 */

const fs = require('fs');
const path = require('path');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const iconsDir = path.join(__dirname, '../public/icons');

// Read the SVG content
const svg192Path = path.join(iconsDir, 'icon-192.svg');
const svgContent = fs.readFileSync(svg192Path, 'utf8');

console.log('📦 Generating PNG icon placeholders...');
console.log('⚠️  For production, convert SVG to actual PNG using sharp or imagemagick\n');

// Create a simple HTML file that can be used to generate PNGs manually
const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Seri Icon Generator</title>
  <style>
    body {
      font-family: system-ui;
      padding: 20px;
      background: #f3f4f6;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .icon-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .icon-item {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      text-align: center;
    }
    canvas {
      max-width: 100%;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
    }
    button {
      margin-top: 10px;
      padding: 8px 16px;
      background: #059669;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }
    button:hover {
      background: #047857;
    }
    .info {
      background: #dbeafe;
      border: 1px solid #3b82f6;
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎨 Générateur d'icônes Seri</h1>
    <div class="info">
      <p><strong>Instructions:</strong></p>
      <ol>
        <li>Cliquez sur "Télécharger PNG" pour chaque taille</li>
        <li>Placez les fichiers dans <code>/public/icons/</code></li>
        <li>Les noms de fichiers: <code>icon-{size}.png</code></li>
      </ol>
    </div>

    <div class="icon-grid" id="icon-grid"></div>
  </div>

  <script>
    const sizes = ${JSON.stringify(sizes)};
    const svgContent = \`${svgContent.replace(/`/g, '\\`')}\`;

    function generateIcon(size) {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      const img = new Image();
      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(svgBlob);

      img.onload = function() {
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
      };

      img.src = url;
      return canvas;
    }

    function downloadCanvas(canvas, size) {
      canvas.toBlob(function(blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = \`icon-\${size}.png\`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    }

    // Generate all sizes
    const grid = document.getElementById('icon-grid');
    sizes.forEach(size => {
      const item = document.createElement('div');
      item.className = 'icon-item';

      const title = document.createElement('h3');
      title.textContent = \`\${size}×\${size}\`;
      item.appendChild(title);

      const canvas = generateIcon(size);
      item.appendChild(canvas);

      const button = document.createElement('button');
      button.textContent = 'Télécharger PNG';
      button.onclick = () => downloadCanvas(canvas, size);
      item.appendChild(button);

      grid.appendChild(item);
    });
  </script>
</body>
</html>`;

// Write the HTML generator
const htmlPath = path.join(__dirname, '../public/generate-icons.html');
fs.writeFileSync(htmlPath, htmlContent);

console.log('✅ Created icon generator: public/generate-icons.html');
console.log('');
console.log('Next steps:');
console.log('1. Open http://localhost:8888/generate-icons.html in your browser');
console.log('2. Download all PNG icons');
console.log('3. Place them in public/icons/');
console.log('4. Update manifest.json to reference PNG files');
console.log('');
console.log('Alternative: Use sharp or imagemagick for automated conversion');
console.log('  npm install sharp');
console.log('  Then update this script to use sharp for conversion');
