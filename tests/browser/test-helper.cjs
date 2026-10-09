async function suppressBackupModalForFunctionalTest(page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('uos.program.backup-reminder:NSA', 'acknowledged');
      window.sessionStorage.setItem('uos.program.backup-reminder:EVT', 'acknowledged');
      window.sessionStorage.setItem('uos.program.backup-reminder:workspace', 'acknowledged');
    } catch (_) {}
  });
}

async function startSpaceCreation(frame, kind) {
  const hub=frame.locator('#spaceRadialToggle');
  if(await hub.getAttribute('aria-expanded')==='false') await hub.click();
  await frame.locator('[data-space-create="'+kind+'"]').click();
}
module.exports = { suppressBackupModalForFunctionalTest, startSpaceCreation };
