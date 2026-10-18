const {test,expect}=require('@playwright/test');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
const {suppressBackupModalForFunctionalTest}=require('./test-helper.cjs');
async function physicalClick(page,locator,refreshFrame){
 const box=await locator.boundingBox();
 const original=refreshFrame?await locator.elementHandle():null;
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
 await page.mouse.down();
 if(refreshFrame){
  await refreshFrame.evaluate(()=>UOS.QuoteBuilderController.renderUI());
  expect(await original.evaluate(node=>node.isConnected),'refresh must retain the pressed control').toBe(true);
  const refreshed=await locator.boundingBox();
  // Drawer animation can change subpixel layout; it must not move the target.
  for(const key of ['x','y','width','height'])expect(Math.abs(refreshed[key]-box[key]),'pressed control '+key).toBeLessThanOrEqual(1);
 }
 await page.mouse.up();
}
async function position(f){
 return f.evaluate(()=>({
  scroll:document.querySelector('.program-quote-pane-body').scrollTop,
  height:document.querySelector('.program-quote-pane-body').clientHeight,
  contentHeight:document.querySelector('.program-quote-pane-body').scrollHeight,
  selected:UOS.ProgramApp.workspace().workspace.selectedProjectId,
  destination:UOS.ProgramApp.workspace().workspace.destination
 }));
}
for(const owner of ['NSA','EVT']){
 test(owner+': first deposit, reversal and evidence clicks preserve Payments',async({page})=>{
  await suppressBackupModalForFunctionalTest(page);
  await page.addInitScript(() => sessionStorage.setItem('uos.program.statusOperator', 'Session Test Officer'));
  const entry='/src/program-planner/'+(owner==='NSA'?'nsa':'events')+'.html';
  await page.goto(process.env.QUOTE_FILE_MODE?pathToFileURL(path.join(process.cwd(),entry)).href:entry);
  let f=page.frames().find(x=>x!==page.mainFrame());
  await f.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
  const id=await f.evaluate(async owner=>{
   let id=owner+(owner==='NSA'?'-APP-':'-EVENT-')+'FIRST-CLICK';
   await UOS.ProgramApp.updateWorkspace(w=>{
    w.entities[owner==='NSA'?'applications':'events'].push({id,owner,title:'First click customer',status:'received',dateReceived:'2026-10-14'});
    w=UOS.ProgramModel.promoteRegisterRecord(w,id).workspace;
    return UOS.ProgramCosting.upsertRateItem(w,{id:'RATE-FIRST-CLICK',description:'Test material',kind:'Material',kindSource:'user',category:'Material',unit:'each',unitRate:100,schedulerEnabled:false});
   });return id;
  },owner);
  // Enter through actual Register controls, not navigateWithContext.
  const row=f.locator('[data-register-record="'+id+'"]');
  await row.locator('[data-register-action="costing"]').click();
  await f.locator('[data-costing-section="Material"]').click();
  await f.locator('[data-costing-add-rate="RATE-FIRST-CLICK"]').click();
  await expect.poll(()=>f.evaluate(()=>UOS.ProgramApp.workspace().entities.costingLines.length)).toBe(1);
  await row.locator('[data-register-action="quotes"]').click();
    if(owner==='NSA') {
      await expect(f.locator('[data-quote-funding-mode][value="city"]')).toBeChecked();
      await f.locator('[data-quote-section-link="4"]').click();
      await f.locator('[data-quote-funding-mode][value="customer"]').check();
      await expect.poll(()=>f.evaluate(()=>UOS.ProgramApp.workspace().entities.quotes[0]?.fundingMode)).toBe('customer');
    }
  await expect(f.locator('[data-quote-funding-mode][value="customer"]')).toBeChecked();
  await f.locator('[data-quote-section-link="5"]').click();
  await expect(f.locator('[data-deposit-record]')).toBeEnabled();
  const form=f.locator('[data-payment-form]');
  await form.locator('[name="amount"]').fill('20');
  await form.locator('[name="reference"]').fill('FIRST-CLICK');
  await physicalClick(page,f.locator('[data-deposit-record]'));
  await expect(f.locator('[data-payment-paid]')).toHaveText('$20.00');
  const payment=await f.evaluate(()=>UOS.ProgramApp.workspace().entities.payments[0]);
  const reverse=f.locator('[data-payment-reverse="'+payment.id+'"]');
  await reverse.scrollIntoViewIfNeeded();
  const before=await position(f);
  await physicalClick(page,reverse,f);
  const dialog=f.locator('.uos-modal[role="dialog"]');
  await expect(dialog).toContainText('Reverse payment?');
  await expect(dialog.locator('[data-payment-reversal-actor]')).toHaveValue('Session Test Officer');
  expect(await position(f)).toEqual(before);
  await dialog.getByRole('button',{name:'Keep payment',exact:true}).click();
  await expect(dialog).toHaveCount(0);
  expect(await f.evaluate(()=>UOS.ProgramApp.workspace().entities.payments[0].reversedBy || '')).toBe('');
  await expect(reverse).toBeFocused();
  expect(await position(f)).toEqual(before);
  await physicalClick(page,reverse);
  await expect(dialog).toContainText('Reverse payment?');
  await f.evaluate(id=>document.querySelector('[data-payment-reverse="'+id+'"]').click(),payment.id);
  await expect(dialog).toHaveCount(1);
  await dialog.getByRole('button',{name:'Reverse payment',exact:true}).click();
  await expect(dialog).toBeVisible();
  expect(await f.evaluate(()=>UOS.ProgramApp.workspace().entities.payments[0].status)).not.toBe('Reversed');
  await dialog.locator('textarea').fill('Incorrect deposit reference');
  await dialog.locator('[data-payment-reversal-actor]').fill('   ');
  await dialog.getByRole('button',{name:'Reverse payment',exact:true}).click();
  await expect(dialog).toBeVisible();
  expect(await f.evaluate(()=>UOS.ProgramApp.workspace().entities.payments[0].status)).not.toBe('Reversed');
  await dialog.locator('[data-payment-reversal-actor]').fill('  Reversing Test Officer  ');
  await dialog.getByRole('button',{name:'Reverse payment',exact:true}).click();
  await expect(f.locator('[data-payment-paid]')).toHaveText('$0.00');
  expect(await f.evaluate(()=>UOS.ProgramApp.workspace().entities.payments[0].reversedBy)).toBe('Reversing Test Officer');
  const evidence=f.getByRole('button',{name:'View payment reversal reason',exact:true});
  await expect(evidence).toBeFocused();
  await evidence.scrollIntoViewIfNeeded();
  const beforeEvidence=await position(f);
  await physicalClick(page,evidence,f);
  await expect(f.locator('[data-status-reason-dialog]')).toBeVisible();
  await expect(f.locator('[data-status-reason-text]')).toHaveText('Incorrect deposit reference');
  await expect(f.locator('[data-status-reason-actor]')).toHaveText('Reversing Test Officer');
  expect(await position(f)).toEqual(beforeEvidence);
  await expect(f.locator('[data-status-reason-time]')).not.toHaveText('Not recorded');
  await f.getByRole('button',{name:'Close',exact:true}).click();
  await expect(evidence).toBeFocused();
  await evidence.press('Enter');
  await expect(f.locator('[data-status-reason-dialog]')).toBeVisible();
  await evidence.evaluate(()=>document.querySelector('[data-status-reason-close]').click());
  // Reopening a stored workspace must not require a funding toggle or warm-up click.
  await page.reload();
  f=page.frames().find(x=>x!==page.mainFrame());
  await f.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
  await f.locator('[data-register-record="'+id+'"] [data-register-action="quotes"]').click();
  await f.locator('[data-quote-section-link="5"]').click();
  await expect(f.locator('[data-deposit-record]')).toBeEnabled();
  const restored=f.locator('[data-payment-reason-id="'+payment.id+'"]');
  await restored.scrollIntoViewIfNeeded();
  const restoredPosition=await position(f);
  await physicalClick(page,restored);
  await expect(f.locator('[data-status-reason-dialog]')).toBeVisible();
  await expect(f.locator('[data-status-reason-text]')).toHaveText('Incorrect deposit reference');
  await expect(f.locator('[data-status-reason-actor]')).toHaveText('Reversing Test Officer');
  expect(await position(f)).toEqual(restoredPosition);
  const timestamp=await f.evaluate(id=>new Date(UOS.ProgramApp.workspace().entities.payments.find(p=>p.id===id).reversedAt).toLocaleString('en-AU'),payment.id);
  await expect(f.locator('[data-status-reason-time]')).toHaveText(timestamp);
 });
}
