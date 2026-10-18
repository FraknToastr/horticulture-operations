const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const desktop = require(path.join(root, 'playwright.desktop.config.cjs'));
module.exports = {
  ...desktop,
  testDir: path.join(root, 'tests/browser'),
  outputDir: '/tmp/nsa-evt-ui-refinements-browser-output',
  webServer: { ...desktop.webServer, cwd: root },
  reporter: [['line'], ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || path.join(__dirname, 'browser-results.json') }]],
  projects: [{ name: 'ui-refinements-desktop', testMatch: [
    'map-navigation-refinements.spec.js', 'header-status-refinements.spec.js',
    'quote-payment-funding-workflow.spec.js', 'quote-first-interaction.spec.js'
  ] }]
};
