'use strict';
// Overtime-only harness boundary. Never borrow ancestor/global dependencies.
const fs = require('fs');
const path = require('path');
const root = fs.realpathSync(path.resolve(__dirname, '..'));
function repoRoot() {
  if (process.env.HORTOPS_REPO_ROOT && fs.realpathSync(path.resolve(process.env.HORTOPS_REPO_ROOT)) !== root) {
    throw new Error('HORTOPS_REPO_ROOT must identify this independent Overtime project: ' + root);
  }
  return root;
}
function contained(realPath, label) {
  const relative = path.relative(root, realPath);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error(label + ' must be inside this Overtime project: ' + realPath);
  }
  return realPath;
}
function loadPlaywright() {
  try {
    repoRoot();
    // A dedicated browser installation belongs to this project, even if the
    // invoking shell has a global/other-application browser cache configured.
    process.env.PLAYWRIGHT_BROWSERS_PATH = path.join(root, '.cache', 'ms-playwright');
    const packageRoot = contained(fs.realpathSync(path.join(root, 'node_modules', 'playwright')), 'Playwright package');
    const playwright = require(packageRoot);
    const browserPath = contained(playwright.chromium.executablePath(), 'Chromium executable');
    if (!fs.existsSync(browserPath)) {
      throw new Error('Child-local Playwright is installed but its Chromium runtime is missing. Install with PLAYWRIGHT_BROWSERS_PATH=' + process.env.PLAYWRIGHT_BROWSERS_PATH + ' using the child-local Playwright CLI.');
    }
    contained(fs.realpathSync(browserPath), 'Chromium executable');
    return playwright;
  } catch (error) {
    console.error('[BLOCKED] Child-local Overtime browser tooling unavailable: ' + error.message);
    process.exit(2);
  }
}
module.exports = { repoRoot, loadPlaywright };
