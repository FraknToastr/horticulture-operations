const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const allowedExt = new Set(['.md', '.txt', '.js', '.cjs', '.html', '.json']);
const skipNames = new Set(['MANIFEST.sha256.txt']);
const hits = [];

function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (allowedExt.has(path.extname(ent.name).toLowerCase()) && !skipNames.has(ent.name)) scan(p);
  }
}

function scan(file) {
  const rel = path.relative(root, file).replace(/\\/g, '/');
  if (rel === 'scripts/review24_package_privacy_hygiene.cjs') return;
  const text = fs.readFileSync(file, 'utf8');

  // Detect historical investigation filenames that encode a two-token human name
  // without embedding any specific person's identity in this test.
  const filenamePattern = /\b[A-Z][A-Z'-]+_[A-Z][A-Z'-]+_DUPLICATED_ASSIGNMENTS_INVESTIGATION\.md\b/g;
  for (const m of text.matchAll(filenamePattern)) {
    hits.push({ file: rel, kind: 'identity-bearing historical filename', sample: m[0].replace(/^[^_]+_[^_]+/, '<REDACTED_NAME>') });
  }

  // Detect explicit prose identifying a named employee.
  const employeePattern = /\bemployee\s+[A-Z][a-z'-]+\s+[A-Z][a-z'-]+\b/g;
  for (const m of text.matchAll(employeePattern)) {
    hits.push({ file: rel, kind: 'named employee reference', sample: 'employee <REDACTED_NAME>' });
  }
}

walk(root);

if (hits.length) {
  console.error('Package privacy hygiene violations detected:');
  for (const hit of hits) console.error(` - ${hit.file}: ${hit.kind} (${hit.sample})`);
}
assert.strictEqual(hits.length, 0, `Expected zero identity-bearing historical references; found ${hits.length}`);
console.log('[PASS] Package-wide privacy hygiene: no identity-bearing historical filenames or named-employee prose detected.');
