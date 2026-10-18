const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');
const directory = path.resolve('docs/remediation/nsa-evt-release-2026-10-17');
const reportUrl = pathToFileURL(path.join(directory, 'final-remediation-report.html')).href;

async function offline(page) {
  const requests = [], errors = [];
  page.on('request', request => { if (/^https?:/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  await page.route(/^https?:/, route => route.abort());
  await page.goto(reportUrl);
  return { requests, errors };
}

test('remediation report is self-contained, matches Markdown/data and supports keyboard filtering', async ({ page }, testInfo) => {
  const observed = await offline(page);
  const source = fs.readFileSync(path.join(directory, 'stage-5-results.json'), 'utf8');
  const data = JSON.parse(source);
  expect(JSON.parse(await page.locator('#report-data').textContent())).toEqual(data);
  const hash = crypto.createHash('sha256').update(source).digest('hex');
  expect(await page.locator('meta[name="report-data-sha256"]').getAttribute('content')).toBe(hash);
  expect(fs.readFileSync(path.join(directory, 'final-remediation-report.md'), 'utf8')).toContain('report-data-sha256: ' + hash);
  expect(data.ownerDecisionsRemaining).toBe(0);
  expect(data.cleanAutomationDefault).toBe('paused');
  expect(data.releaseReadiness).toBe('UNVERIFIED');
  await expect(page.locator('.stage:visible')).toHaveCount(5);
  await page.getByLabel('Stage', { exact: true }).selectOption('5');
  await expect(page.locator('.stage:visible')).toHaveCount(1);
  await expect(page.locator('.finding:visible')).toHaveCount(3);
  await page.getByLabel('Stage', { exact: true }).selectOption('all');
  await page.getByLabel('Finding status').selectOption('open');
  await expect(page.locator('.finding:visible')).toHaveCount(1);
  const finding = page.locator('.finding:visible');
  await finding.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(finding).toHaveAttribute('open', '');
  await expect(finding).toContainText('MapLibre 5.3.0');
  await page.getByLabel('Search findings').fill('no-such-finding');
  await expect(page.getByRole('status')).toHaveText('0 of 8 findings shown');
  await page.getByLabel('Search findings').fill('');
  await page.getByLabel('Finding status').selectOption('all');
  await page.getByRole('button', { name: 'Expand visible findings' }).click();
  await expect(page.locator('.finding[open]')).toHaveCount(8);
  await page.getByRole('button', { name: 'Collapse findings' }).click();
  await expect(page.locator('.finding[open]')).toHaveCount(0);
  expect(observed.requests).toEqual([]);
  expect(observed.errors).toEqual([]);
  await testInfo.attach('report-proof', { contentType: 'application/json', body: Buffer.from(JSON.stringify({
    browserVersion: page.context().browser().version(), dataSHA256: hash,
    stageCount: data.stages.length, findingCount: data.findings.length,
    networkRequests: observed.requests.length, pageErrors: observed.errors.length
  })) });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('essential report content and native disclosures remain usable offline', async ({ page }) => {
    const observed = await offline(page);
    await expect(page.locator('.stage:visible')).toHaveCount(5);
    await expect(page.locator('.finding:visible')).toHaveCount(8);
    await expect(page.getByRole('heading', { name: 'Focused verification' })).toBeVisible();
    await expect(page.getByLabel('Finding status')).not.toBeVisible();
    const finding = page.locator('.finding').first();
    await finding.locator('summary').focus();
    await page.keyboard.press('Space');
    await expect(finding).toHaveAttribute('open', '');
    expect(observed.requests).toEqual([]);
    expect(observed.errors).toEqual([]);
  });
});
