'use strict';

// Assessment only. Downloads never enter src/, node_modules or the project lockfile.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const root = path.resolve(__dirname, '../../../..');
const evidence = path.dirname(__dirname);
const buildRoot = '/tmp/nsa-evt-stage4-pdfjs-6.4.299';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

async function get(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'nsa-evt-stage4-readonly-assessment', Accept: 'application/json' },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}
function selectedTarFiles(tgz, names) {
  const tar = zlib.gunzipSync(tgz), files = {};
  for (let offset = 0; offset + 512 <= tar.length;) {
    const name = tar.subarray(offset, offset + 100).toString().replace(/\0.*$/, '');
    if (!name) break;
    const size = parseInt(tar.subarray(offset + 124, offset + 136).toString().replace(/\0.*$/, '').trim(), 8) || 0;
    if (names.includes(name)) files[name] = tar.subarray(offset + 512, offset + 512 + size);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  for (const name of names) if (!files[name]) throw new Error(`Required package file missing: ${name}`);
  return files;
}
async function main() {
  fs.mkdirSync(buildRoot, { recursive: true });
  const metadataPath = path.join(evidence, 'stage-4-pdf-package.json');
  const metadata = await (await get('https://registry.npmjs.org/pdfjs-dist/6.4.299')).json();
  if (metadata.name !== 'pdfjs-dist' || metadata.version !== '6.4.299') throw new Error('Unexpected PDF package identity');
  if (new URL(metadata.dist.tarball).origin !== 'https://registry.npmjs.org') throw new Error('Unexpected package origin');
  if (fs.existsSync(metadataPath)) {
    const previous = JSON.parse(fs.readFileSync(metadataPath));
    if (previous.dist.integrity !== metadata.dist.integrity) throw new Error('Published package integrity changed; stop for review');
  }
  const archivePath = path.join(buildRoot, 'pdfjs-dist-6.4.299.tgz');
  const archive = fs.existsSync(archivePath) ? fs.readFileSync(archivePath) : Buffer.from(await (await get(metadata.dist.tarball)).arrayBuffer());
  const integrity = 'sha512-' + crypto.createHash('sha512').update(archive).digest('base64');
  if (integrity !== metadata.dist.integrity) throw new Error('Package integrity mismatch');
  fs.writeFileSync(archivePath, archive);
  const names = ['package/build/pdf.min.mjs', 'package/build/pdf.worker.min.mjs',
    'package/legacy/build/pdf.min.mjs', 'package/legacy/build/pdf.worker.min.mjs',
    'package/LICENSE', 'package/package.json'];
  const files = selectedTarFiles(archive, names);
  for (const [name, bytes] of Object.entries(files)) {
    const destination = path.join(buildRoot, name);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
  }
  const packageEvidence = {
    checkedAt: new Date().toISOString(), name: metadata.name, version: metadata.version,
    license: metadata.license, engines: metadata.engines, dist: metadata.dist,
    archiveSHA256: sha(archive), archiveBytes: archive.length,
    selectedFiles: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, { bytes: bytes.length, sha256: sha(bytes) }])),
    isolatedBuildRoot: buildRoot, repositoryDependenciesChanged: false,
    notice: 'The published package does not include a root NOTICE file; no NOTICE is invented.'
  };
  fs.writeFileSync(metadataPath, JSON.stringify(packageEvidence, null, 2) + '\n');

  const packages = [
    ['pdfjs-dist', '2.16.105', 'shipped-runtime'], ['pdfjs-dist', '6.4.299', 'assessment-only'],
    ['maplibre-gl', '5.3.0', 'shipped-runtime'], ['three', '0.186.1', 'shipped-bundle'],
    ['earcut', '3.2.4', 'shipped-bundle'], ['esbuild', '0.28.2', 'build-only'],
    ['@playwright/test', '1.62.0', 'test-only'], ['fake-indexeddb', '6.2.4', 'test-only']
  ];
  const advisories = [];
  for (const [name, version, use] of packages) {
    const url = 'https://api.github.com/advisories?' + new URLSearchParams({ ecosystem: 'npm', affects: `${name}@${version}`, per_page: '100' });
    try {
      const response = await get(url), data = await response.json();
      if (!Array.isArray(data)) throw new Error('Unexpected advisory response');
      advisories.push({ name, version, use, url, checkedAt: new Date().toISOString(), completeFirstPage: !response.headers.get('link')?.includes('rel="next"'),
        advisories: data.map(item => ({ ghsaId: item.ghsa_id, cveId: item.cve_id, summary: item.summary, severity: item.severity,
          url: item.html_url, publishedAt: item.published_at, updatedAt: item.updated_at, withdrawnAt: item.withdrawn_at,
          vulnerabilities: item.vulnerabilities })) });
    } catch (error) { advisories.push({ name, version, use, url, error: error.message, status: 'UNVERIFIED' }); }
  }
  fs.writeFileSync(path.join(evidence, 'stage-4-advisories.json'), JSON.stringify({ checkedAt: new Date().toISOString(), source: 'GitHub Global Security Advisories API', packages: advisories }, null, 2) + '\n');
  console.log(JSON.stringify({ package: metadata.version, verifiedIntegrity: true, archiveBytes: archive.length,
    advisories: advisories.map(item => ({ name: item.name, version: item.version, count: item.advisories?.length, error: item.error })) }));
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { root, evidence, buildRoot };
