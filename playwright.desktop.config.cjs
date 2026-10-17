require('./scripts/desktop-browser-guard.cjs');
const base = require('./playwright.config.cjs');
const { browserBatches } = require('./scripts/desktop-release-plan.cjs');

module.exports = {
  ...base,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  maxFailures: 1,
  reporter: 'line',
  use: {
    ...base.use,
    viewport: { width: 1600, height: 1000 },
    isMobile: false,
    hasTouch: false,
    screenshot: 'off',
    video: 'off',
    trace: 'off'
  },
  // An occupied port must fail rather than verify an unknown/stale server.
  webServer: { ...base.webServer, reuseExistingServer: false },
  projects: browserBatches
};
