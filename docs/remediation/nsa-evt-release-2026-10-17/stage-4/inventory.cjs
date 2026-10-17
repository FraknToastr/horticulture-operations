'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { root, evidence } = require('./prepare.cjs');
const identify = relative => {
  const bytes = fs.readFileSync(path.join(root, relative));
  return { path: relative, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
};
const walk = relative => fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap(entry => {
  const name = `${relative}/${entry.name}`;
  return entry.isDirectory() ? walk(name) : [identify(name)];
});
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json')));
const pinned = name => lock.packages[`node_modules/${name}`].version;
const localLicense = relative => ({ path: relative, present: fs.existsSync(path.join(root, relative)) });
const report = {
  checkedAt: new Date().toISOString(), scope: 'NSA/EVT shared runtime and its build/test dependencies; Overtime excluded',
  dependencies: [
    { name: 'maplibre-gl', version: '5.3.0', role: 'lazy fallback runtime', license: 'BSD-3-Clause',
      versionEvidence: 'JS header and runtime version token; CSS pairing inferred from its directory',
      licenseEvidence: localLicense('src/shared/vendor/maplibre/LICENSE.txt'),
      upstreamLicense: 'https://github.com/maplibre/maplibre-gl-js/blob/v5.3.0/LICENSE.txt' },
    { name: 'pdfjs-dist', version: '2.16.105', build: '172ccdbe5', role: 'lazy PDF import runtime and matching worker', license: 'Apache-2.0',
      versionEvidence: 'API/worker embedded version declarations',
      licenseEvidence: localLicense('src/shared/vendor/pdfjs/LICENSE'),
      upstreamLicense: 'https://github.com/mozilla/pdfjs-dist/blob/v2.16.105/LICENSE',
      notice: 'No separate root NOTICE exists in assessed official 6.4.299 package; do not invent a requirement for one' },
    { name: 'three', version: pinned('three'), role: 'shipped renderer bundle', license: 'MIT',
      versionEvidence: 'Pinned lockfile and source/build imports; generated asset exposes revision 186, not an exact patch attestation',
      licenseEvidence: localLicense('src/shared/vendor/space-map/three-LICENSE.txt') },
    { name: 'earcut', version: pinned('earcut'), role: 'shipped polygon triangulation in renderer and geometry workers', license: 'ISC',
      versionEvidence: 'Pinned lockfile, geometry.mjs import and build script',
      licenseEvidence: localLicense('src/shared/vendor/space-map/earcut-LICENSE.txt') },
    { name: 'esbuild', version: pinned('esbuild'), role: 'build-only; not a browser runtime', license: 'MIT',
      licenseEvidence: localLicense('src/shared/vendor/space-map/esbuild-LICENSE.txt') },
    { name: '@playwright/test', version: pinned('@playwright/test'), role: 'test-only', license: 'Apache-2.0' },
    { name: 'fake-indexeddb', version: pinned('fake-indexeddb'), role: 'test-only', license: 'Apache-2.0' }
  ],
  vendorFiles: walk('src/shared/vendor'),
  fonts: { license: 'SIL-OFL-1.1', evidence: identify('src/shared/fonts/OFL.txt') },
  auxiliaryExcludedRuntime: {
    tool: 'GeoForge standalone converter',
    jszip: identify('src/GeoForge-MapLibre-KML-KMZ-GeoJSON/geo-converter/vendor/jszip.min.js'),
    version: '3.10.1', license: 'MIT OR GPL-3.0',
    notes: 'Separate launcher tool; also references CDN MapLibre 5.6.0. Neither is loaded by NSA/EVT.'
  },
  gaps: [
    'Full local PDF.js and MapLibre licence texts are missing, although their source headers retain notices and links',
    'Current bundles lack a shipped package/version/build-to-asset provenance manifest',
    'Exact Three patch and CSS version cannot be independently established from those asset banners alone',
    'Top-level exact-version advisories are a snapshot, not a complete bundled-transitive SBOM or security certification'
  ]
};
fs.writeFileSync(path.join(evidence, 'stage-4-vendor-inventory.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ dependencies: report.dependencies.length, vendorFiles: report.vendorFiles.length,
  missingFullLicenses: report.dependencies.filter(item => item.licenseEvidence && !item.licenseEvidence.present).map(item => item.name) }));
