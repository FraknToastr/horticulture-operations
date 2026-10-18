const path = require('node:path');
const root = path.resolve(__dirname, '../../../..');
const desktop = require(path.join(root, 'playwright.desktop.config.cjs'));

module.exports = {
  ...desktop,
  testDir: path.join(root, 'tests/browser'),
  outputDir: '/tmp/nsa-evt-stage5-browser-output',
  webServer: { ...desktop.webServer, cwd: root },
  reporter: [
    ['line'],
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || path.resolve(__dirname, '../stage-5-browser-results.json') }]
  ],
  projects: [{
    name: 'stage5-desktop',
    testMatch: [
      'quote-first-interaction.spec.js',
      'quote-payment-funding-workflow.spec.js',
      'draft-quoted-cost-deletion.spec.js',
      'payment-reversal-attribution.spec.js',
      'stage5-inspector-styles.spec.js',
      'stage5-clean-start.spec.js',
      'stage5-remediation-report.spec.js'
    ]
  }]
};
