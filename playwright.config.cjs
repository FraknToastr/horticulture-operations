// Browser proof must use the runtime installed by this project, not a host-wide pinned browser directory.
delete process.env.PLAYWRIGHT_BROWSERS_PATH;

module.exports = {
  testDir: "./tests/browser",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4199",
    headless: true,
 browserName: "chromium"
  },
  webServer: {
    command: "PORT=4199 node src/scripts/static-server.cjs",
    url: "http://127.0.0.1:4199/src/program-planner/index.html?workspace=NSA",
    reuseExistingServer: true,
    timeout: 15000
  }
};
