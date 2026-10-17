'use strict';

// Loaded by the desktop config in both the runner and Playwright workers.
// Fail before an excluded operation occurs; never silently skip an assertion.
const api = require('playwright');
function block(reason) { throw new Error(`DESKTOP_RELEASE_POLICY: ${reason}`); }
function checkOptions(options = {}) {
  if (options.isMobile || options.hasTouch) block('mobile or touch emulation');
  if (options.viewport && options.viewport.width < 768) block('viewport width below 768');
  if (options.recordVideo) block('video recording');
}
const pages = new WeakSet(), contexts = new WeakSet(), browsers = new WeakSet();
function guardPage(page) {
  if (pages.has(page)) return page;
  pages.add(page);
  page.screenshot = () => block('page screenshot');
  Object.getPrototypeOf(page.locator('html')).screenshot = () => block('locator screenshot');
  page.touchscreen.tap = () => block('touch interaction');
  const resize = page.setViewportSize;
  page.setViewportSize = function (viewport) {
    checkOptions({ viewport });
    return resize.call(this, viewport);
  };
  return page;
}
function guardContext(context) {
  if (contexts.has(context)) return context;
  contexts.add(context);
  context.tracing.start = () => block('trace recording');
  context.tracing.startChunk = () => block('trace recording');
  context.on('page', guardPage);
  for (const page of context.pages()) guardPage(page);
  const newPage = context.newPage;
  context.newPage = async function (...args) { return guardPage(await newPage.apply(this, args)); };
  return context;
}
function guardBrowser(browser) {
  if (browsers.has(browser)) return browser;
  browsers.add(browser);
  const newContext = browser.newContext, newPage = browser.newPage;
  browser.newContext = async function (options) {
    checkOptions(options);
    return guardContext(await newContext.call(this, options));
  };
  browser.newPage = async function (options) {
    checkOptions(options);
    return guardPage(await newPage.call(this, options));
  };
  return browser;
}
for (const name of ['chromium', 'firefox', 'webkit']) {
  const type = api[name], launch = type.launch;
  type.launch = async function (...args) { return guardBrowser(await launch.apply(this, args)); };
  type.launchPersistentContext = () => block('persistent browser profile');
}

module.exports = { checkOptions, guardPage, guardContext, guardBrowser };
