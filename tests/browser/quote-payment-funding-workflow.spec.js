const {test, expect} = require('@playwright/test');
const {suppressBackupModalForFunctionalTest} = require('./test-helper.cjs');

async function setup(page, owner='NSA') {
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  await page.goto(`/src/program-planner/${owner==='NSA'?'nsa':'events'}.html`);
  const frame=page.frames().find(f=>f!==page.mainFrame());
  await frame.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
  const ids=await frame.evaluate(async owner=>{
    let ids;
    await UOS.ProgramApp.updateWorkspace(w=>{
      const recordId=owner+(owner==='NSA'?'-APP-PAYMENTS':'-EVENT-PAYMENTS');
      w.entities[owner==='NSA'?'applications':'events'].push({id:recordId,owner,title:'Synthetic payment customer',status:'received',dateReceived:'2026-10-13'});
      const promoted=UOS.ProgramModel.promoteRegisterRecord(w,recordId);
      w=UOS.ProgramCosting.upsertRateItem(promoted.workspace,{id:'RATE-PAYMENT-MATERIAL',description:'Payment workflow material',kind:'Material',kindSource:'user',category:'Material',unit:'each',unitRate:100,schedulerEnabled:false});
      w.entities.projects.find(p=>p.id===promoted.project.id).funding={operationalAmount:50};
      w.workspace.selectedEntityId=recordId;w.workspace.selectedProjectId=promoted.project.id;
      ids={recordId,projectId:promoted.project.id};return w;
    });
    await UOS.ProgramApp.navigateWithContext('costing',ids.recordId);return ids;
  },owner);
  await frame.locator('[data-costing-section="Material"]').click();
  await frame.locator('[data-costing-add-rate="RATE-PAYMENT-MATERIAL"]').click();
  await expect.poll(()=>frame.evaluate(id=>UOS.ProgramApp.workspace().entities.costingLines.filter(l=>l.projectId===id).length,ids.projectId)).toBe(1);
  await frame.evaluate(id=>UOS.ProgramApp.navigateWithContext('quotes',id),ids.recordId);
  return {frame,ids};
}
async function deposit(frame, amount, reference, method='Paid with Deposit') {
  await fillPayment(frame, amount, reference, method);
  await frame.locator(method==='Paid with Deposit'?'[data-deposit-record]':'[data-payment-record]').click();
  await expect.poll(()=>frame.evaluate(ref=>UOS.ProgramApp.workspace().entities.payments.filter(p=>p.reference===ref).length,reference)).toBe(1);
}
async function fillPayment(frame, amount, reference, method='Paid with Deposit') {
  await frame.locator('[data-quote-section-link="5"]').click();
  const form=frame.locator('[data-payment-form]');
  await form.locator('[name="amount"]').fill(String(amount));
  await form.locator('[name="paymentDate"]').fill('2026-10-13');
  await form.locator('[name="reference"]').fill(reference);
  await form.locator('[name="method"]').selectOption(method);
}
async function reverse(frame, reference) {
  const id=await frame.evaluate(ref=>UOS.ProgramApp.workspace().entities.payments.find(p=>p.reference===ref).id,reference);
  await frame.locator('[data-quote-section-link="5"]').click();
  await frame.locator(`[data-payment-reverse="${id}"]`).click();
  const dialog=frame.getByRole('dialog');
  await dialog.locator('textarea').fill('Synthetic workflow reversal');
  await dialog.locator('[data-payment-reversal-actor]').fill('Payment workflow officer');
  await dialog.getByRole('button',{name:'Reverse payment',exact:true}).click();
  await expect.poll(()=>frame.evaluate(id=>UOS.ProgramApp.workspace().entities.payments.find(p=>p.id===id).status,id)).toBe('Reversed');
}
async function funding(frame, value) {
  await frame.locator('[data-quote-section-link="4"]').click();
  await frame.locator(`[data-quote-funding-mode][value="${value}"]`).check();
  await expect.poll(()=>frame.evaluate(()=>{
    const w=UOS.ProgramApp.workspace();return w.entities.quotes.filter(q=>q.projectId===w.workspace.selectedProjectId).sort((a,b)=>b.revision-a.revision)[0]?.fundingMode;
  })).toBe(value);
}
async function aligned(frame) {
  await expect.poll(()=>frame.evaluate(()=>{
    const builder=document.querySelector('.program-quote-builder-pane').getBoundingClientRect();
    const preview=document.querySelector('.program-quote-preview-pane').getBoundingClientRect();
    const host=document.querySelector('[data-program-view="quotes"]').getBoundingClientRect();
    return Math.abs(builder.top-preview.top)<2 && builder.top-host.top<4 && builder.height>host.height*.9;
  })).toBe(true);
}
for(const owner of ['NSA','EVT']) {
  test(`${owner}: owner funding default and saved override survive reopening`,async({page})=>{
    const {frame,ids}=await setup(page,owner);
    const defaultMode=owner==='NSA'?'city':'customer';
    await expect(frame.locator(`[data-quote-funding-mode][value="${defaultMode}"]`)).toBeChecked();
    await frame.locator('[data-quote-section-link="5"]').click();
    if(owner==='NSA') await expect(frame.locator('[data-deposit-record]')).toBeDisabled();
    else await expect(frame.locator('[data-deposit-record]')).toBeEnabled();
    await expect(frame.locator('[data-payment-record]')).toBeDisabled();
    expect(await frame.evaluate(()=>UOS.ProgramApp.workspace().entities.quotes.length)).toBe(0);
    const override=owner==='NSA'?'customer':'city';
    await funding(frame,override);
    await page.reload();
    const restored=page.frames().find(f=>f!==page.mainFrame());
    await restored.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
    await restored.locator(`[data-register-record="${ids.recordId}"] [data-register-action="quotes"]`).click();
    await expect(restored.locator(`[data-quote-funding-mode][value="${override}"]`)).toBeChecked();
    expect(await restored.evaluate(id=>UOS.ProgramApp.workspace().entities.quotes.find(q=>q.projectId===id).fundingMode,ids.projectId)).toBe(override);
  });

  test(`${owner}: Customer funding permits a first deposit and lifecycle reversals`,async({page})=>{
    const {frame,ids}=await setup(page,owner);
    if(owner==='NSA') await funding(frame,'customer');
    await expect(frame.locator('[data-quote-funding-mode][value="customer"]')).toBeChecked();
    await expect(frame.locator('[data-deposit-record]')).toBeEnabled();
    await deposit(frame,20,'FIRST-DEPOSIT');
    await expect(frame.locator('[data-payment-paid]')).toHaveText('$20.00');
    await aligned(frame);
    await expect(frame.locator('[data-quote-funding-mode][value="city"]')).toBeDisabled();
    await reverse(frame,'FIRST-DEPOSIT');
    await expect(frame.locator('[data-quote-financial-lock]')).toBeHidden();
    await expect(frame.locator('[data-payment-paid]')).toHaveText('$0.00');
    await funding(frame,'city');await expect(frame.locator('[data-deposit-record]')).toBeDisabled();await expect(frame.locator('[data-payment-record]')).toBeDisabled();
    await funding(frame,'customer');await expect(frame.locator('[data-deposit-record]')).toBeEnabled();
    await funding(frame,'mixed');
    await frame.locator('[data-quote-customer-contribution]').fill('60');await frame.locator('[data-quote-customer-contribution]').press('Tab');
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.quotes[0].proposedCustomerContribution)).toBe(60);
    await deposit(frame,15,'MIXED-DEPOSIT');await expect(frame.locator('[data-payment-balance]')).toHaveText('$51.00');
    await reverse(frame,'MIXED-DEPOSIT');await funding(frame,'customer');
    for(const [field,value] of [['scope','Synthetic material delivery'],['terms','Synthetic payment terms']]) {
      await frame.locator(`[data-quote-${field}]`).fill(value);await frame.locator(`[data-quote-${field}]`).press('Tab');
    }
    await frame.locator('[data-quote-issue]').click();
    await frame.getByRole('dialog').getByRole('button',{name:'Issue quote',exact:true}).click();
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.quotes[0].status)).toBe('Issued');
    await frame.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
    await deposit(frame,30,'PARTIAL-PAYMENT','Bank transfer');await expect(frame.locator('[data-payment-status]')).toHaveText('Partially Paid');await expect(frame.locator('[data-payment-balance]')).toHaveText('$80.00');
    await deposit(frame,80,'FINAL-PAYMENT','Card');await expect(frame.locator('[data-payment-status]')).toHaveText('Paid');await expect(frame.locator('[data-quote-revision]')).toBeDisabled();
    await reverse(frame,'FINAL-PAYMENT');await expect(frame.locator('[data-payment-status]')).toHaveText('Partially Paid');
    await reverse(frame,'PARTIAL-PAYMENT');await expect(frame.locator('[data-payment-balance]')).toHaveText('$110.00');
    await expect(frame.locator('[data-quote-funding-mode][value="city"]')).toBeDisabled();
    await frame.locator('[data-quote-revision]').click();await frame.getByRole('dialog').getByRole('button',{name:'Create revision',exact:true}).click();
    await expect.poll(()=>frame.evaluate(()=>UOS.ProgramApp.workspace().entities.quotes.length)).toBe(2);
    await funding(frame,'city');await expect(frame.locator('[data-deposit-record]')).toBeDisabled();
    await funding(frame,'customer');await deposit(frame,10,'REVISION-DEPOSIT');await reverse(frame,'REVISION-DEPOSIT');
    await aligned(frame);
    await page.reload();
    const restored=page.frames().find(f=>f!==page.mainFrame());await restored.waitForFunction(()=>UOS.ProgramApp?.snapshot().phase==='ready');
    await expect.poll(()=>restored.evaluate(id=>{
      const w=UOS.ProgramApp.workspace();return {quotes:w.entities.quotes.filter(q=>q.projectId===id).length,reversed:w.entities.payments.filter(p=>p.projectId===id && p.status==='Reversed').length,amount:w.entities.payments.filter(p=>p.projectId===id).reduce((sum,p)=>sum+p.amount,0)};
    },ids.projectId)).toEqual({quotes:2,reversed:5,amount:155});
  });
  test(`${owner}: a saved Draft deposit keeps the Quote panes aligned`,async({page})=>{
    const {frame,ids}=await setup(page,owner);
    await frame.evaluate(async projectId=>UOS.ProgramApp.updateWorkspace(w=>UOS.ProgramQuotes.saveDraft(w,{projectId,fundingMode:'customer'})),ids.projectId);
    await frame.evaluate(async projectId=>UOS.ProgramApp.updateWorkspace(w=>{
      const quote=w.entities.quotes.find(q=>q.projectId===projectId);
      return UOS.ProgramQuotes.recordPayment(w,{quoteId:quote.id,amount:20,paymentDate:'2026-10-13',method:'Paid with Deposit',reference:'LAYOUT-DEPOSIT'});
    }),ids.projectId);
    await expect(frame.locator('[data-quote-financial-lock]')).toBeVisible();
    for(const width of [2048,1024]) { await page.setViewportSize({width,height:1000});await aligned(frame); }
  });
}

for(const owner of ['NSA','EVT']) {
  test(`${owner}: first-deposit failure keeps data and retry records one payment despite repeated submits`,async({page})=>{
  const {frame,ids}=await setup(page,owner);
    if(owner==='NSA') await funding(frame,'customer');
    const initialQuoteCount=owner==='NSA'?1:0;
  const before=await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities));
  const rejected=await frame.evaluate(async projectId=>{
    try {
      await UOS.ProgramApp.updateWorkspace(w=>{
        w=UOS.ProgramQuotes.saveDraft(w,{projectId,fundingMode:'customer'});
        const quote=w.entities.quotes.find(q=>q.projectId===projectId);
        return UOS.ProgramQuotes.recordPayment(w,{quoteId:quote.id,amount:20,paymentDate:'2026-10-13',method:'Bank transfer',reference:'REJECT-DRAFT-PAYMENT'});
      });
      return '';
    } catch(error) { return error.message; }
  },ids.projectId);
  expect(rejected).toContain('Issue or accept the Quote');
  expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
    expect(await frame.evaluate(async()=>{const w=await UOS.ProgramStorage.get();return {quotes:w.entities.quotes.length,payments:w.entities.payments.length};})).toEqual({quotes:initialQuoteCount,payments:0});
  await frame.evaluate(()=>{
    window.paymentCommit=UOS.storage.commitRevision;
    UOS.storage.commitRevision=()=>Promise.reject(new Error('Synthetic payment commit failure'));
  });
  await fillPayment(frame,20,'RETRY-DEPOSIT');await frame.locator('[data-deposit-record]').click();
  await expect(frame.getByRole('dialog')).toContainText('Synthetic payment commit failure');
  expect(await frame.evaluate(()=>JSON.stringify(UOS.ProgramApp.workspace().entities))).toBe(before);
    expect(await frame.evaluate(async()=>{const w=await UOS.ProgramStorage.get();return {quotes:w.entities.quotes.length,payments:w.entities.payments.length};})).toEqual({quotes:initialQuoteCount,payments:0});
  await frame.evaluate(()=>UOS.storage.commitRevision=window.paymentCommit);
  await frame.getByRole('dialog').getByRole('button',{name:'OK',exact:true}).click();
  await expect(frame.locator('[data-deposit-record]')).toBeEnabled();
  await expect(frame.locator('[data-payment-form] [name="reference"]')).toHaveValue('RETRY-DEPOSIT');
  await frame.evaluate(()=>{
    UOS.storage.commitRevision=(...args)=>new Promise((resolve,reject)=>{
      window.releaseDepositCommit=()=>{UOS.storage.commitRevision=window.paymentCommit;window.paymentCommit.apply(UOS.storage,args).then(resolve,reject);};
    });
  });
  await frame.locator('[data-deposit-record]').click();await expect(frame.locator('[data-deposit-record]')).toBeDisabled();
  await frame.evaluate(()=>document.querySelector('[data-payment-form]').requestSubmit(document.querySelector('[data-deposit-record]')));
  await frame.waitForFunction(()=>typeof window.releaseDepositCommit==='function');await frame.evaluate(()=>window.releaseDepositCommit());
  await expect.poll(()=>frame.evaluate(()=>{const w=UOS.ProgramApp.workspace();return {quotes:w.entities.quotes.length,payments:w.entities.payments.length,amount:w.entities.payments[0]?.amount};})).toEqual({quotes:1,payments:1,amount:20});
  expect(await frame.evaluate(async()=>{const w=await UOS.ProgramStorage.get();return {quotes:w.entities.quotes.length,payments:w.entities.payments.length,amount:w.entities.payments[0]?.amount};})).toEqual({quotes:1,payments:1,amount:20});
});

}

test('Accepted Quote handles an overpayment and reversal without changing its commercial snapshot',async({page})=>{
  const {frame,ids}=await setup(page);
  const snapshot=await frame.evaluate(async projectId=>{
    let snapshot;
    await UOS.ProgramApp.updateWorkspace(w=>{
      w=UOS.ProgramQuotes.saveDraft(w,{projectId,fundingMode:'customer'});
      const quote=w.entities.quotes.find(q=>q.projectId===projectId);
      w=UOS.ProgramQuotes.issue(w,quote.id);w=UOS.ProgramQuotes.accept(w,quote.id);
      snapshot=JSON.stringify(UOS.ProgramQuotes.commercialProjection(w,quote.id));return w;
    });return snapshot;
  },ids.projectId);
  await deposit(frame,115,'OVERPAYMENT','Bank transfer');
  await expect(frame.locator('[data-payment-status]')).toHaveText('Overpaid');await expect(frame.locator('[data-payment-balance]')).toHaveText('-$5.00');
  await expect(frame.locator('[data-quote-funding-mode][value="city"]')).toBeDisabled();
  await reverse(frame,'OVERPAYMENT');await expect(frame.locator('[data-payment-status]')).toHaveText('Unpaid');
  expect(await frame.evaluate(()=>{const w=UOS.ProgramApp.workspace();return JSON.stringify(UOS.ProgramQuotes.commercialProjection(w,w.entities.quotes[0].id));})).toBe(snapshot);
});
