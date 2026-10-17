const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { suppressBackupModalForFunctionalTest } = require('./test-helper.cjs');
const { SOURCE, CANDIDATE } = require('../../scripts/review_nsa_workspace_warnings.cjs');

for (const [file, warnings] of [[SOURCE, 57], [CANDIDATE, 3]]) {
  test(`${path.basename(file)}: isolated import preserves IDs, lineage, JSON/ZIP round trips and reload`, async ({ page }) => {
    await suppressBackupModalForFunctionalTest(page);
    await page.setViewportSize({ width: 1600, height: 1000 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/*', route => {
      const url = new URL(route.request().url());
      return ['127.0.0.1', 'localhost'].includes(url.hostname) ? route.continue() : route.abort();
    });
    await page.goto('/src/program-planner/nsa.html');
    const frame = page.frames().find(candidate => candidate !== page.mainFrame());
    await frame.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const result = await frame.evaluate(async ({ input, name }) => {
      const U = UOS;
      const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
      const graph = workspace => JSON.stringify(stable({
        entities: Object.fromEntries(Object.entries(workspace.entities).map(([key, rows]) => [key, rows.slice().sort((a, b) => a.id.localeCompare(b.id))])),
        migration: workspace.migration, referenceData: workspace.referenceData, statusControl: workspace.statusControl
      }));
      const current = U.ProgramApp.workspace();
      const empty = current.entities.applications.length === 0 && current.entities.projects.length === 0;
      const expected = U.ProgramStatus.migrate(U.ProgramModel.normalize(JSON.parse(input)));
      // Adoption preserves these existing browser markers to prevent historical
      // rollout purges from running on imported data. Check their exact content;
      // keep all other migration metadata in the strict graph comparison.
      for (const [key, id] of [
        ['emptyOperationalBaseline', U.ProgramModel.emptyOperationalBaselineId],
        ['registerBaselineSanitation', U.ProgramModel.registerBaselineSanitationId]
      ]) {
        const marker = current.migration?.[key];
        if (marker?.id === id) expected.migration[key] = structuredClone(marker);
      }
      const staged = await U.ProgramData.stage(new File([input], name, { type: 'application/json' }), current, { expectedApp: 'NSA' });
      const imported = await U.ProgramData.apply(staged, {
        currentWorkspace: current,
        commit: (candidate, options) => U.ProgramApp.adoptWorkspace(candidate, options)
      });
      U.ProgramModel.assertValid(imported);
      const signature = graph(imported);
      const sourceDifferences = [];
      function compareSource(a, b, path = '') {
        if (JSON.stringify(a) === JSON.stringify(b)) return;
        if (a && b && typeof a === 'object' && typeof b === 'object') {
          for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) compareSource(a[key], b[key], path + '.' + key);
        } else sourceDifferences.push({ path, expected: a, actual: b });
      }
      compareSource(JSON.parse(graph(expected)), JSON.parse(signature));
      const json = U.ProgramData.exportJson(imported, 'NSA');
      const jsonRestored = U.ProgramModel.normalize(JSON.parse(json));
      U.ProgramModel.assertValid(jsonRestored);
      const privacy = U.ProgramPrivacy, wasPrivate = privacy.isEnabled();
      let zipMatches, zipBytes;
      try {
        privacy.setEnabled(false);
        const zip = U.ProgramData.exportBundle(imported, 'NSA');
        zipBytes = zip.byteLength;
        const restored = U.ProgramData.importBundle(zip, null, { expectedApp: 'NSA' });
        U.ProgramModel.assertValid(restored);
        zipMatches = graph(restored) === signature;
      } finally { privacy.setEnabled(wasPrivate); }
      const ids = Object.values(imported.entities).flat().map(record => record.id);
      const health = U.ProgramDataHealth.check(imported);
      return {
        empty, blocked: staged.preview.blocked,
        sourceDifferences, jsonMatches: graph(jsonRestored) === signature,
        zipMatches, zipBytes, graph: signature, duplicates: ids.length - new Set(ids).size,
        counts: health.counts, automationPaused: imported.migration.statusReadiness.automationPaused,
        unresolvedAmounts: imported.entities.projects.filter(project => project.funding?.operationalAmount == null).length,
        catalogLinks: imported.entities.projects.map(project => project.catalogId),
        archivedLinks: imported.migration.legacyRateMigrationArchive?.projectCatalogLinks || []
      };
    }, { input: fs.readFileSync(file, 'utf8'), name: path.basename(file) });
    expect(result.empty).toBe(true);
    expect(result.blocked).toBe(false);
    expect(result.sourceDifferences).toEqual([]);
    expect(result.jsonMatches).toBe(true);
    expect(result.zipMatches).toBe(true);
    expect(result.zipBytes).toBeGreaterThan(0);
    expect(result.duplicates).toBe(0);
    expect(result.counts).toEqual({ error: 0, warning: warnings, total: warnings });
    expect(result.automationPaused).toBe(true);
    expect(result.unresolvedAmounts).toBe(2);
    if (file === CANDIDATE) {
      expect(result.catalogLinks).toEqual([null, null]);
      expect(result.archivedLinks).toHaveLength(2);
    }
    await page.reload();
    const restored = page.frames().find(candidate => candidate !== page.mainFrame());
    await restored.waitForFunction(() => window.UOS?.ProgramApp?.snapshot().phase === 'ready');
    const after = await restored.evaluate(() => {
      const workspace = UOS.ProgramApp.workspace();
      UOS.ProgramModel.assertValid(workspace);
      const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
        ? Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])])) : value;
      return JSON.stringify(stable({
        entities: Object.fromEntries(Object.entries(workspace.entities).map(([key, rows]) => [key, rows.slice().sort((a, b) => a.id.localeCompare(b.id))])),
        migration: workspace.migration, referenceData: workspace.referenceData, statusControl: workspace.statusControl
      }));
    });
    expect(after).toBe(result.graph);
    expect(errors).toEqual([]);
  });
}
