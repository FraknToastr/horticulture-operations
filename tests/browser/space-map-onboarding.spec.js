const {test,expect}=require('@playwright/test');
const {suppressBackupModalForFunctionalTest}=require('./test-helper.cjs');

async function setup(page,owner){
  await suppressBackupModalForFunctionalTest(page);
  await page.setViewportSize({width:1600,height:1000});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`/src/program-planner/${owner==='NSA'?'nsa':'events'}.html`);
  const frame=page.frames().find(item=>item!==page.mainFrame());
  await frame.waitForFunction(()=>window.UOS?.ProgramApp?.snapshot().phase==='ready');
  const recordId=await frame.evaluate(async owner=>{
    const id=`${owner}-${owner==='NSA'?'APP':'EVENT'}-ONBOARDING`;
    await UOS.ProgramApp.updateWorkspace(workspace=>{
      workspace.entities[owner==='NSA'?'applications':'events'].push({id,owner,type:owner==='NSA'?'application':'event',title:'Empty Space Map',status:'received',dateReceived:'2026-10-16'});
      workspace.workspace.selectedEntityId=id;workspace.workspace.selectedProjectId='';
      return workspace;
    });
    await UOS.ProgramApp.navigate('map');return id;
  },owner);
  await frame.waitForFunction(()=>UOS.ProgramMapController.getMapController()?.ready());
  return {frame,recordId,errors};
}

async function mapPoint(frame){
  const canvas=frame.locator('.maplibregl-canvas'),bounds=await canvas.boundingBox();
  await canvas.click({position:{x:bounds.width*.6,y:bounds.height*.7}});
}

for(const owner of ['NSA','EVT']){
  test(`${owner}: first-use sidebar guidance preserves guarded creation and only saved work dismisses it`,async({page})=>{
    const {frame,recordId,errors}=await setup(page,owner);
    const guide=frame.locator('#spaceMapOnboarding'),add=guide.locator('[data-space-onboarding-add]');
    await expect(guide).toBeVisible();
    await expect(guide.getByRole('heading',{name:'Tips',exact:true})).toHaveCount(1);
    await expect.poll(()=>guide.evaluate(node=>node.querySelector('.space-onboarding__heading').getBoundingClientRect().bottom<=node.querySelector('[data-space-onboarding-add]').getBoundingClientRect().top)).toBe(true);
    await expect(guide.getByRole('button')).toHaveCount(1);
    await expect(guide.locator('.space-onboarding__orb')).toHaveCount(4);
    await expect(guide).toContainText('Save the current edit.');
    await expect(guide).toContainText('Reverse the latest step.');
    await expect(guide).toContainText('Discard the unsaved edit.');
    await expect(frame.locator('#eventPickerList')).toHaveText('');
    await expect.poll(()=>guide.evaluate(node=>{
      const body=node.parentElement.getBoundingClientRect(),rect=node.getBoundingClientRect();
      const circles=node.querySelectorAll('.space-onboarding__orb');
      return Math.abs((body.left+body.right-rect.left-rect.right)/2)<1 &&
        [...circles].every(circle=>getComputedStyle(circle).zIndex==='2') &&
        getComputedStyle(node.querySelector('.space-onboarding__connections')).pointerEvents==='none';
    })).toBe(true);

    await frame.locator('[data-space-mode="projects"]').click();
    await expect(guide).toBeHidden();
    await expect(frame.getByRole('button',{name:'Create a Project',exact:true})).toBeVisible();
    await expect(frame.locator('.space-editor__project-guidance')).toHaveText(owner==='NSA' ? 'The Nature Strip Application is in the Register. Proceed to create a Project' : 'The Event is in the Register. Proceed to create a Remediation Project.');
    await expect.poll(()=>frame.locator('#spaceProjectEmpty').evaluate(node=>{
      const body=node.closest('.space-editor__body').getBoundingClientRect();
      const button=node.querySelector('button').getBoundingClientRect(),message=node.querySelector('p').getBoundingClientRect();
      const footer=document.querySelector('.space-editor__moasure-section').getBoundingClientRect();
      const center=(body.left+body.right)/2;
      return Math.abs((button.left+button.right)/2-center)<1 && Math.abs((message.left+message.right)/2-center)<1 && button.bottom<=message.top && message.bottom<=footer.top;
    })).toBe(true);
    await expect(frame.locator('#moasureImportButton')).toBeVisible();
    await frame.locator('[data-space-mode="register"]').click();
    await expect(guide).toBeVisible();
    await add.click();
    await expect(frame.locator('#spaceRadialToggle')).toHaveAttribute('aria-expanded','true');
    await add.focus();await add.press('Space');
    await expect(add).toHaveAttribute('aria-expanded','false');
    await expect(frame.locator('#spaceRadialToggle')).toHaveAttribute('aria-expanded','false');
    await add.press('Enter');
    await expect(add).toHaveAttribute('aria-label','Collapse creation menu');
    await expect(frame.locator('[data-space-create="location"]')).toBeEnabled();
    await expect(frame.locator('[data-space-create="polygon"]')).toBeDisabled();
    await frame.locator('[data-space-create="location"]').click();
    await mapPoint(frame);
    await expect(frame.locator('#spaceAcceptDraft')).toBeEnabled();
    await expect(guide).toBeVisible();
    await frame.locator('#spaceCancelDraft').click();
    await expect(guide).toBeVisible();
    expect(await frame.evaluate(id=>UOS.ProgramModel.registerLocations(UOS.ProgramApp.workspace(),id).length,recordId)).toBe(0);

    if(await add.getAttribute('aria-expanded')==='false')await add.click();await frame.locator('[data-space-create="location"]').click();
    await mapPoint(frame);await frame.locator('#spaceAcceptDraft').click();
    await expect(guide).toBeHidden();
    await expect(frame.locator('[data-space-pin]')).toHaveCount(1);

    // Clearing saved work restores the guide; a saved polygon dismisses it in
    // Space Manager while Location still needs its own saved pin.
    await frame.evaluate(id=>UOS.ProgramApp.updateWorkspace(workspace=>{workspace.entities.applications.concat(workspace.entities.events).find(item=>item.id===id).locations=[];return workspace;}),recordId);
    await frame.locator('[data-space-mode="projects"]').click();
    await frame.getByRole('button',{name:'Create a Project',exact:true}).click();
    await expect.poll(()=>frame.evaluate(id=>UOS.ProgramModel.projectForRegister(UOS.ProgramApp.workspace(),id)?.id,recordId)).toBeTruthy();
    const projectId=await frame.evaluate(id=>UOS.ProgramModel.projectForRegister(UOS.ProgramApp.workspace(),id).id,recordId);
    await expect(guide).toContainText('Polygon');
    await expect(guide.getByRole('heading',{name:'Tips',exact:true})).toHaveCount(1);
    await expect(guide).toBeVisible();
    await frame.evaluate(async({projectId,owner})=>UOS.ProgramApp.updateWorkspace(workspace=>UOS.WorkAreaService.createGeometry(workspace,projectId,{
      id:owner+'-GEO-ONBOARDING',geometry:{type:'Polygon',coordinates:[[[138.6,-34.92],[138.601,-34.92],[138.601,-34.921],[138.6,-34.92]]]},payload:{}
    })),{projectId,owner});
    await expect(guide).toBeHidden();
    await frame.locator('[data-space-mode="register"]').click();
    await expect(guide).toBeVisible();
    await expect(guide).toContainText('Location');
    await frame.locator('[data-space-mode="projects"]').click();
    await expect(guide).toBeHidden();
    await expect(frame.locator('#shapeList [data-shape-card-id]')).toHaveCount(1);
    expect(errors).toEqual([]);
  });
}
