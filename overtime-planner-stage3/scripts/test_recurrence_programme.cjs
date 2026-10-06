'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {repoRoot,loadPlaywright} = require('./local-test-environment.cjs');

(async () => {
    const browser = await loadPlaywright().chromium.launch({headless:true});
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror',e => errors.push(e.message));
    page.on('dialog',d => d.dismiss());
    try {
        await page.goto(pathToFileURL(path.join(repoRoot(),'index.html')).href);
        await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
        const models = await page.evaluate(() => {
            const R = HortOpsRecurrence;
            const base = {id:'PROGRAMME',name:'Programme',category:'Parks',primaryTeam:'Parks',staffingSections:{teams:true,pools:true},startTime:'06:00 AM',durationHours:6,crewSize:1,status:'active',color:'#047857'};
            const weekly = {...base,frequencyType:'recurring_weeks',anchorDate:'2026-11-07',preferredDay:'saturday',intervalWeeks:2,scheduleEnd:{mode:'after_count',count:8}};
            const season = {...base,frequencyType:'seasonal',seasonalRule:{start:'11-01',end:'02-28',anchor:'11-07',firstYear:2026,intervalWeeks:2,days:[6],includePublicHolidays:false},scheduleEnd:{mode:'after_count',count:8}};
            const annual = {...base,frequencyType:'annual',annualRule:{kind:'weekday',startYear:2026,month:2,ordinal:2,weekday:6}};
            const leap = {...base,frequencyType:'annual',annualRule:{kind:'fixed',startYear:2020,month:2,day:29}};
            const pattern = {...base,frequencyType:'work_pattern',workPattern:{mode:'weekly',startDate:'2026-12-19',intervalWeeks:1,days:[6,0],includePublicHolidays:true,excludedDates:[]},scheduleEnd:{mode:'after_count',count:9}};
            return {
                weekly:R.datesInRange(weekly,'2026-11-01','2027-02-28'),
                restricted:R.datesInRange(weekly,'2027-01-01','2027-02-28'),
                seasonal:R.datesInRange(season,'2026-11-01','2028-02-29'),
                annual:R.dates(annual,2027),leap:R.datesInRange(leap,'2020-01-01','2021-12-31'),
                pattern:R.datesInRange(pattern,'2026-12-19','2027-02-28'),
                ordinaryFriday:R.validate({...base,frequencyType:'one_off',targetDate:'2026-11-06'}),
                holidayFriday:R.validate({...base,frequencyType:'one_off',targetDate:'2027-01-01'}),
                holidayMonday:R.isOperatingDate('2026-12-28'),ordinaryMonday:R.isOperatingDate('2027-01-04'),
                invalidAnnual:R.validate({...annual,annualRule:{kind:'fixed',startYear:2026,month:2,day:30}}),
                noDefault:R.validate({...annual,annualRule:{kind:'fixed',startYear:2026,month:2}}),
                weeklyJob:weekly,seasonJob:season,annualJob:annual,patternJob:pattern
            };
        });
        const expected = ['2026-11-07','2026-11-21','2026-12-05','2026-12-19','2027-01-02','2027-01-16','2027-01-30','2027-02-13'];
        assert.deepEqual(models.weekly,expected);
        assert.deepEqual(models.restricted,expected.slice(4));
        assert.deepEqual(models.seasonal.slice(0,8),expected);
        assert.equal(models.seasonal.length,16,'eight occurrences restart each annual season');
        assert.deepEqual(models.annual,['2027-02-13']);
        assert.deepEqual(models.leap,['2020-02-29']);
        assert.equal(models.pattern.length,9);
        assert(models.pattern.includes('2027-01-01'));
        assert.equal(models.ordinaryFriday.valid,false);
        assert.equal(models.holidayFriday.valid,true);
        assert.equal(models.holidayMonday,true);
        assert.equal(models.ordinaryMonday,false);
        assert.equal(models.invalidAnnual.valid,false);
        assert.equal(models.noDefault.valid,false);

        await page.evaluate(() => HortOpsApp.openAddJobModal());
        for (const type of ['work_pattern','annual','seasonal','one_off','recurring_weeks','work_pattern','one_off']) {
            await page.locator('#job-cadence').selectOption(type);
            assert.equal(await page.locator('#job-cadence').inputValue(),type,'all cadences remain escapable');
        }
        await page.locator('#job-cadence').selectOption('annual');
        await page.getByLabel('Month', {exact:true}).selectOption('3');
        await page.getByLabel('Day of month', {exact:true}).fill('14');
        await page.getByLabel('Day of month', {exact:true}).press('Tab');
        assert.equal(await page.locator('.recurrence-calendar-day.is-scheduled[aria-label="Scheduled 2026-03-14"]').count(), 1, 'annual scheduled date is circled in its calendar');
        assert.deepEqual(await page.locator('.recurrence-calendar-weekdays span').evaluateAll(nodes => nodes.slice(0, 7).map(node => node.textContent)), ['Mo','Tu','We','Th','Fr','Sa','Su'], 'calendar weeks begin on Monday');
        await page.locator('#job-cadence').selectOption('seasonal');
        for (const [label,value] of [['Season starts (MM-DD)','11-01'],['Season ends, inclusive (MM-DD)','02-28'],['Interval anchor in season (MM-DD)','11-07']]) {
            await page.getByLabel(label,{exact:true}).fill(value);
            await page.getByLabel(label,{exact:true}).press('Tab');
        }
        await page.getByLabel('End series',{exact:true}).selectOption('after_count');
        await page.getByLabel('Staffable occurrences per season',{exact:true}).fill('8');
        await page.getByLabel('Staffable occurrences per season',{exact:true}).press('Tab');
        assert.match(await page.locator('.recurrence-preview').innerText(),/15 occurrence/);
        await page.locator('.recurrence-editor').scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(require('node:os').tmpdir(),'hort-seasonal-editor.png')});
        await page.evaluate(() => HortOpsJobEditModal.close());
        const saved = await page.evaluate(({weeklyJob:weekly,seasonJob:season,annualJob:annual}) => {
            HortOpsDateUtils.getLocalDateKey = () => '2026-10-06';
            const parsed = HortOpsUserCsvParser.parseUserCsv('ID,Name,Email,Department,Team,Role,IsPlantOperator,Status\nEMP-PROG,Programme Worker,programme@example.test,Operations,Parks,Worker,FALSE,active\n',[]);
            const imported = HortOpsApp.importStaffMembers(parsed.staff);
            const jobs = [weekly,{...season,id:'SEASONAL',name:'Seasonal'},{...annual,id:'ANNUAL',name:'Annual'}].map(j => HortOpsApp.saveJob(j));
            return {imported,jobs};
        },models);
        assert.equal(saved.imported.success,true,saved.imported.error);
        saved.jobs.forEach(j => assert.equal(j.success,true,j.error));
        await page.locator('#planning-range-start').fill('2026-11-01');
        await page.locator('#planning-range-end').fill('2027-02-28');
        await page.locator('#planning-range-apply').click();
        assert.match(await page.locator('#content-mount').innerText(),/Programming horizon: 2026-11-01/);
        const digest = await page.evaluate(() => ({
            dates:HortOpsApp.state.allShifts.filter(s=>s.jobId==='PROGRAMME').map(s=>s.date),
            slots:HortOpsApp.state.slots.map(s=>s.saturdayDate),
            annual:HortOpsApp.state.allShifts.filter(s=>s.jobId==='ANNUAL').map(s=>s.date)
        }));
        assert.deepEqual(digest.dates,expected);
        assert.equal(new Set(digest.slots).size,digest.slots.length);
        assert.deepEqual(digest.annual,['2027-02-13']);
        const sundayBoundary = await page.evaluate(() => {
            const job = {id:'SUNDAY',name:'Sunday boundary',frequencyType:'one_off',targetDate:'2023-01-01',status:'active',startTime:'06:00 AM',durationHours:6,crewSize:1};
            const digest = HortOpsScheduler.generateRangeDigest([job],'2022-12-30','2023-01-02',true,{},[],{},{},true);
            return {dates:digest.allShifts.map(s=>s.date),slots:digest.slots.map(s=>s.saturdayDate)};
        });
        assert.deepEqual(sundayBoundary.dates,['2023-01-01']);
        assert.deepEqual(sundayBoundary.slots,['2022-12-31']);
        const allocation = await page.evaluate(() => {
            HortOpsStaffAssignModal.open('PROGRAMME@2026-12-19');
            HortOpsStaffAssignModal.stagedAssignedStaffIds = ['EMP-PROG'];
            HortOpsStaffAssignModal.stagedSlots = [{slotId:'SLOT-1',staffId:'EMP-PROG',mode:'fixed',repeatCount:5,isInherited:false,sourceDate:'2026-12-19'}];
            HortOpsStaffAssignModal.saveAllocation();
            return {active:HortOpsStaffAssignModal.activeShiftId,assignments:HortOpsApp.state.customAssignments,range:HortOpsApp.state.uiState.planningRange};
        });
        assert.equal(allocation.active,null,'allocation committed and closed');
        for (const date of expected.slice(3)) assert.deepEqual(allocation.assignments['PROGRAMME@'+date],['EMP-PROG'],'fixed rostering continues across January');
        assert.deepEqual(allocation.range,{start:'2026-11-01',end:'2027-02-28'});
        await page.reload();
        await page.waitForFunction(() => window.HortOpsWriterSession && HortOpsWriterSession.canWrite());
        assert.deepEqual(await page.evaluate(() => HortOpsApp.state.uiState.planningRange),allocation.range);
        assert.deepEqual(await page.evaluate(() => HortOpsApp.state.customAssignments['PROGRAMME@2027-02-13']),['EMP-PROG']);
        const safety = await page.evaluate(() => {
            // Storage-health/error indicators may change; workspace domains may not.
            const data = () => JSON.stringify(['jobs','staffList','customAssignments','customPermits','rostering','historicalSnapshots','budgetSettings','uiState','currentYear','activeView'].map(k=>[k,HortOpsApp.state[k]]));
            const before = data();
            const stored = JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
            const invalid = HortOpsApp.setPlanningRange('2027-02-30','2027-03-01');
            const validate = HortOpsSchemaValidator.validateWorkspaceSchema;
            HortOpsSchemaValidator.validateWorkspaceSchema = () => ({valid:false,error:'Injected validation failure'});
            const rejected = HortOpsApp.setPlanningRange('2026-12-01','2027-02-28');
            HortOpsSchemaValidator.validateWorkspaceSchema = validate;
            const save = HortOpsStorage.saveWorkspace;
            HortOpsStorage.saveWorkspace = () => ({success:false,error:'Injected storage failure'});
            const failed = HortOpsApp.setPlanningRange('2026-12-01','2027-02-28');
            HortOpsStorage.saveWorkspace = save;
            return {invalid,rejected,failed,stateUnchanged:before===data(),storedUnchanged:stored===JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))};
        });
        assert.equal(safety.invalid.success,false);
        assert.equal(safety.rejected.success,false);
        assert.equal(safety.failed.success,false);
        assert.equal(safety.stateUnchanged,true);
        assert.equal(safety.storedUnchanged,true);
        await page.evaluate(() => HortOpsWriterSession.release());
        await page.waitForFunction(() => !HortOpsWriterSession.canWrite());
        const guarded = await page.evaluate(() => {
            const before = JSON.stringify(HortOpsApp.state.uiState);
            const stored = JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]));
            const result = HortOpsApp.setPlanningRange('2026-12-01','2027-01-31');
            return {rejected:result === false || (result && result.success === false),unchanged:before === JSON.stringify(HortOpsApp.state.uiState),storedUnchanged:stored === JSON.stringify(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))};
        });
        assert.equal(guarded.rejected,true);
        assert.equal(guarded.unchanged,true);
        assert.equal(guarded.storedUnchanged,true);
        assert.deepEqual(errors,[]);
        console.log('PASS: canonical dates, holiday restrictions, explicit annual rules, seasonal/count continuity, cadence switching, persisted cross-year programme and allocation');
    } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
