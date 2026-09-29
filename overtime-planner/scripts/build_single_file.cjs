const fs = require('fs');
const path = require('path');

console.log('=== COMPILING HORT OPS SINGLE-FILE SELF-CONTAINED APPLICATION ===');

const offlineDir = path.resolve(__dirname, '..');
const modularHtmlPath = path.join(offlineDir, 'index.modular.html');
const targetIndexPath = path.join(offlineDir, 'index.html');
const distDir = path.join(offlineDir, 'dist');
const targetDistPath = path.join(distDir, 'hort_ops_offline_planner.html');

if (!fs.existsSync(modularHtmlPath)) {
  console.error(`ERROR: Modular source template ${modularHtmlPath} not found.`);
  process.exit(1);
}

let html = fs.readFileSync(modularHtmlPath, 'utf8');

// 1. Inline CSS stylesheets
const cssRegex = /<link\s+rel=["']stylesheet["']\s+href=["']([^"']+)["']\s*\/?>/gi;
let cssCount = 0;
html = html.replace(cssRegex, (match, href) => {
  const cssPath = path.join(offlineDir, href);
  if (!fs.existsSync(cssPath)) {
    throw new Error(`Referenced CSS file not found: ${cssPath}`);
  }
  const cssContent = fs.readFileSync(cssPath, 'utf8');
  if (/@import\b/i.test(cssContent)) {
    throw new Error(`CSS file ${href} contains @import rule which violates self-contained offline architecture.`);
  }
  if (/url\(["']?(https?:|\/\/)/i.test(cssContent)) {
    throw new Error(`CSS file ${href} contains external remote url() reference.`);
  }
  cssCount++;
  console.log(`  + Inlined CSS (${href}) [${(cssContent.length / 1024).toFixed(1)} KB]`);
  return `<style data-source="${href}">\n/* === INLINED: ${href} === */\n${cssContent}\n</style>`;
});

// 2. Inline JavaScript modules
const scriptRegex = /<script\s+src=["']([^"']+)["']\s*><\/script>/gi;
let jsCount = 0;
html = html.replace(scriptRegex, (match, src) => {
  const jsPath = path.join(offlineDir, src);
  if (!fs.existsSync(jsPath)) {
    throw new Error(`Referenced JS file not found: ${jsPath}`);
  }
  let jsContent = fs.readFileSync(jsPath, 'utf8');
  // Safe-escape any closing script tags if present
  jsContent = jsContent.replace(/<\/script/gi, '<\\/script');
  jsCount++;
  console.log(`  + Inlined JS  (${src}) [${(jsContent.length / 1024).toFixed(1)} KB]`);
  return `<script data-source="${src}">\n/* === INLINED: ${src} === */\n${jsContent}\n</script>`;
});

// 3. Integrity checks on bundled HTML
if (/<link\s+rel=["']stylesheet/i.test(html)) {
  throw new Error('Bundle validation error: Un-inlined <link rel="stylesheet"> remains.');
}
if (/<script\s+src=/i.test(html)) {
  throw new Error('Bundle validation error: External <script src="..."> remains.');
}
if (cssCount === 0 || jsCount === 0) {
  throw new Error(`Bundle validation error: Expected CSS and JS files to inline (found ${cssCount} CSS, ${jsCount} JS).`);
}

const requiredRoots = [
  'header-mount',
  'content-mount',
  'staff-assign-modal-root',
  'job-edit-modal-root',
  'export-modal-root',
  'import-modal-root',
  'staff-exemption-modal-root'
];
requiredRoots.forEach(id => {
  if (!html.includes(`id="${id}"`)) {
    throw new Error(`Bundle validation error: Missing required DOM root #${id}`);
  }
});

// 4. Ensure target directories exist and write files
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

fs.writeFileSync(targetIndexPath, html, 'utf8');
fs.writeFileSync(targetDistPath, html, 'utf8');

const stats = fs.statSync(targetIndexPath);
console.log(`\n[SUCCESS] Single-file application compiled successfully:`);
console.log(`  - Inlined ${cssCount} stylesheet(s)`);
console.log(`  - Inlined ${jsCount} script module(s)`);
console.log(`  - Target 1: ${path.relative(offlineDir, targetIndexPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
console.log(`  - Target 2: ${path.relative(offlineDir, targetDistPath)} (${(stats.size / 1024).toFixed(1)} KB)`);
console.log('=== BUILD COMPLETE ===\n');
