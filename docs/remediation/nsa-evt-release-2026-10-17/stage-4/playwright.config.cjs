const path = require('node:path');
const { root } = require('./prepare.cjs');
require(path.join(root, 'scripts/desktop-browser-guard.cjs'));
const base = require(path.join(root, 'playwright.config.cjs'));
module.exports = {
  testDir: __dirname,
  testMatch: 'pdf-compat.spec.cjs',
  timeout: 30000,
  workers: 1,
  retries: 0,
  maxFailures: 1,
  forbidOnly: true,
  reporter: [['line'], ['json', { outputFile: path.join(__dirname, '../stage-4-browser-results.json') }]],
  outputDir: '/tmp/nsa-evt-stage4-playwright-results',
  use: { ...base.use, viewport: { width: 1600, height: 1000 }, isMobile: false, hasTouch: false,
    screenshot: 'off', video: 'off', trace: 'off' },
  webServer: [
    { ...base.webServer, cwd: root, reuseExistingServer: false },
    { command: `node "${path.join(__dirname, 'serve-isolated.cjs')}"`, cwd: root,
      url: 'http://127.0.0.1:4204/src/program-planner/nsa.html', reuseExistingServer: false, timeout: 15000 }
  ]
};
