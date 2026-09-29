const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('=== RUNNING STATIC RELEASE GATES ===');

const baseDir = path.resolve(__dirname, '..');
const jsDir = path.join(baseDir, 'js');

function getAllJsFiles(dir) {
  let files = [];
  fs.readdirSync(dir).forEach(file => {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      files = files.concat(getAllJsFiles(fullPath));
    } else if (file.endsWith('.js')) {
      files.push(fullPath);
    }
  });
  return files;
}

const jsFiles = getAllJsFiles(jsDir);
console.log(`Auditing ${jsFiles.length} JavaScript files...`);

// 1. Syntax Validation (node --check)
let syntaxFailures = 0;
jsFiles.forEach(file => {
  try {
    execSync(`node --check "${file}"`, { stdio: 'pipe' });
  } catch (err) {
    console.error(`SYNTAX ERROR in ${file}:`, err.message);
    syntaxFailures++;
  }
});

if (syntaxFailures > 0) {
  console.error(`FAILED: ${syntaxFailures} files had syntax errors.`);
  process.exit(1);
}
console.log(`[PASS] All ${jsFiles.length} JavaScript files passed node --check syntax audit.`);

// 2. Undeclared Helper Scan
let helperFailures = 0;
jsFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const hasEscHtmlCall = /\bescHtml\s*\(/.test(content);
  const hasEscAttrCall = /\bescAttr\s*\(/.test(content);

  const declaresEscHtml = /(?:var|function|let|const)\s+escHtml\b/.test(content);
  const declaresEscAttr = /(?:var|function|let|const)\s+escAttr\b/.test(content);

  if (hasEscHtmlCall && !declaresEscHtml) {
    console.error(`UNDECLARED HELPER: escHtml used without declaration in ${path.relative(baseDir, file)}`);
    helperFailures++;
  }
  if (hasEscAttrCall && !declaresEscAttr) {
    console.error(`UNDECLARED HELPER: escAttr used without declaration in ${path.relative(baseDir, file)}`);
    helperFailures++;
  }
});

if (helperFailures > 0) {
  console.error(`FAILED: ${helperFailures} undeclared helper usages found.`);
  process.exit(1);
}
console.log('[PASS] Zero undeclared helper identifiers detected.');

console.log('STATIC RELEASE TESTS PASSED (100%)');
