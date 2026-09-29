async function suppressBackupModalForFunctionalTest(page) {
  await page.addInitScript(() => {
    try {
      window.sessionStorage.setItem('uos.program.backup-reminder:NSA', 'acknowledged');
      window.sessionStorage.setItem('uos.program.backup-reminder:EVT', 'acknowledged');
      window.sessionStorage.setItem('uos.program.backup-reminder:workspace', 'acknowledged');
    } catch (_) {}
  });
}

module.exports = { suppressBackupModalForFunctionalTest };
