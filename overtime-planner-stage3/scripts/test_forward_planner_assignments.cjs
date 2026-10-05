'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { loadPlaywright, repoRoot } = require('./local-test-environment.cjs');
const root = repoRoot(), playwright = loadPlaywright();
const folder = path.join(root, 'test_reports/forward-planner-assignments');
fs.mkdirSync(folder, { recursive: true });
const checks = [], errors = [], dialogs = [];
const report = { passed: false, checks, errors, dialogs };
async function ready(page) {
    await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
}
async function main() {
    const browser = await playwright.chromium.launch({headless:true});
    report.browserVersion = browser.version();
    try {
        for (const frequencyType of ['one_off', 'recurring_weeks']) {
            const context = await browser.newContext();
            try {
                const page = await context.newPage();
                page.on('pageerror', error => errors.push(error.message));
                page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.dismiss(); });
                await page.goto(pathToFileURL(path.join(root,'index.html')).href);
                await ready(page);
                const setup = await page.evaluate(frequencyType => {
                    const csv = 'ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\n' +
                        [1,2,3].map(i => 'EMP-VISIBLE-' + i + ',Visible Worker ' + i + ',visible' + i +
                            '@example.test,Horticulture,Parks,Gardener,FALSE,active').join('\n') + '\n';
                    const parsed = HortOpsUserCsvParser.parseUserCsv(csv, []);
                    const workforce = HortOpsApp.importStaffMembers(parsed.staff);
                    const job = HortOpsApp.saveJob({id:'JOB-VISIBLE',name:'Visible three-person job',category:'Parks',
                        frequencyType,targetDate:'2026-10-10',anchorDate:'2026-10-10',intervalWeeks:1,
                        preferredDay:'saturday',startTime:'06:00 AM',durationHours:6,crewSize:3,
                        status:'active',color:'#047857'});
                    HortOpsForwardPlanner.startWeekInitialized = true;
                    HortOpsForwardPlanner.startWeek = 40;
                    HortOpsForwardPlanner.windowSize = 6;
                    HortOpsApp.renderCurrentView();
                    return {parsed:parsed.success,workforce:workforce.success,job:job.success};
                }, frequencyType);
                assert.deepEqual(setup,{parsed:true,workforce:true,job:true});
                const vacancy = page.locator('button.vacancy-add-btn[onclick*="JOB-VISIBLE@2026-10-10"]');
                assert.equal(await vacancy.count(),3);
                await vacancy.first().click();
                await page.locator('button[onclick*="addStaff"][onclick*="EMP-VISIBLE-1"]').click();
                await page.locator('button[onclick*="saveAllocation"]').click();
                await page.waitForFunction(() => !HortOpsStaffAssignModal.activeShiftId);
                const inspect = () => page.evaluate(() => {
                    const shift = HortOpsApp.state.allShifts.find(s => s.shiftId === 'JOB-VISIBLE@2026-10-10');
                    const slot = HortOpsApp.state.slots.find(s => s.shifts.includes(shift));
                    const html = document.querySelector('#content-mount').innerHTML;
                    return { assigned:shift.assignedStaffIds, weekNumber:shift.weekNumber, slotWeek:slot.weekNumber,
                        dayOfWeek:shift.dayOfWeek, workers:[1,2,3].map(i => html.includes('Visible Worker ' + i)),
                        text:document.querySelector('#content-mount').innerText };
                });
                let state = await inspect();
                assert.deepEqual(state.assigned,['EMP-VISIBLE-1']);
                assert.equal(state.weekNumber,state.slotWeek,'committed occurrence must retain its display week');
                assert.equal(state.dayOfWeek,'Saturday','committed occurrence must retain its display day');
                assert.equal(state.workers[0],true,'assigned worker must appear beside remaining vacancies');
                assert.equal(await page.locator('button.shift-card-btn[onclick*="JOB-VISIBLE@2026-10-10"]').count(),1);
                assert.equal(await vacancy.count(),2);
                checks.push(frequencyType + ': partial assignment remains visible beside vacancies');
                await vacancy.first().click();
                for (const i of [2,3]) await page.locator('button[onclick*="addStaff"][onclick*="EMP-VISIBLE-' + i + '"]').click();
                await page.locator('button[onclick*="saveAllocation"]').click();
                await page.waitForFunction(() => !HortOpsStaffAssignModal.activeShiftId);
                state = await inspect();
                assert.deepEqual(state.assigned,['EMP-VISIBLE-1','EMP-VISIBLE-2','EMP-VISIBLE-3']);
                assert.deepEqual(state.workers,[true,true,true]);
                assert.match(state.text,/3 Rostered/);
                assert.equal(await vacancy.count(),0);
                const assignedCards = page.locator('button.shift-card-btn[onclick*="JOB-VISIBLE@2026-10-10"]');
                assert.equal(await assignedCards.count(),3);
                await assignedCards.first().click();
                assert.equal(await page.evaluate(() => HortOpsStaffAssignModal.activeShiftId),'JOB-VISIBLE@2026-10-10');
                await page.evaluate(() => HortOpsStaffAssignModal.close());
                checks.push(frequencyType + ': fully assigned crew replaces vacancies in planner');
                const persisted = await page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey));
                const snapshots = await page.evaluate(() => JSON.stringify(HortOpsApp.state.historicalSnapshots));
                await page.reload();
                await ready(page);
                await page.evaluate(() => {
                    HortOpsForwardPlanner.startWeekInitialized=true;
                    HortOpsForwardPlanner.startWeek=40;
                    HortOpsForwardPlanner.windowSize=6;
                    HortOpsApp.setActiveView('forward_planner');
                });
                state = await inspect();
                assert.deepEqual(state.workers,[true,true,true]);
                assert.equal(state.weekNumber,state.slotWeek);
                assert.equal(await assignedCards.count(),3);
                assert.equal(await page.evaluate(() => JSON.stringify(HortOpsApp.state.historicalSnapshots)),snapshots);
                const reloaded = JSON.parse(await page.evaluate(() => localStorage.getItem(HortOpsClientStorage.workspaceKey)));
                const before = JSON.parse(persisted);
                for (const field of ['assignments','historicalSnapshots','rostering','jobs','roster','permits']) {
                    assert.deepEqual(reloaded[field],before[field],field + ' must survive reload unchanged');
                }
                checks.push(frequencyType + ': reload preserves visible crew and original committed snapshot bytes');
            } finally { await context.close(); }
        }
        assert.deepEqual(errors,[]);
        assert.deepEqual(dialogs,[]);
        report.passed=true;
        console.log('FORWARD PLANNER ASSIGNMENT CHECKS PASSED: '+checks.length);
    } finally {
        await browser.close();
        fs.writeFileSync(path.join(folder,'results.json'),JSON.stringify(report,null,2)+'\n');
    }
}
main().catch(error => { console.error(error); process.exitCode=1; });
