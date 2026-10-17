'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { root, buildRoot } = require('./prepare.cjs');
const { build } = require('./build.cjs');
build();
const overlay = {
  '/src/shared/js/program-runtime.js': path.join(__dirname, 'program-runtime.candidate.js'),
  '/src/shared/js/imports.js': path.join(__dirname, 'imports.candidate.js'),
  '/src/shared/vendor/pdfjs/pdf.min.mjs': path.join(buildRoot, 'package/legacy/build/pdf.min.mjs'),
  '/src/shared/vendor/pdfjs/pdf.worker.min.mjs': path.join(buildRoot, 'package/legacy/build/pdf.worker.min.mjs')
};
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html',
  '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
const server = http.createServer((request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (!pathname.startsWith('/src/')) { response.writeHead(404).end(); return; }
    const file = overlay[pathname] || path.resolve(root, '.' + pathname);
    if (!file.startsWith(path.join(root, 'src') + path.sep) && !Object.values(overlay).includes(file)) { response.writeHead(403).end(); return; }
    const body = fs.readFileSync(file);
    response.writeHead(200, { 'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store', 'X-Stage4-Assessment': 'isolated-pdfjs-6.4.299' });
    response.end(body);
  } catch { response.writeHead(404).end(); }
});
server.listen(4204, '127.0.0.1', () => console.log('Stage 4 PDF assessment overlay: http://127.0.0.1:4204'));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close());
