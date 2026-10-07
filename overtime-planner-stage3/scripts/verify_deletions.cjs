'use strict';
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const deletionsFile = path.join(root, 'DELETIONS.txt');

if (!fs.existsSync(deletionsFile)) {
  console.error('FAIL: DELETIONS.txt not found in repository root');
  process.exit(1);
}

const lines = fs.readFileSync(deletionsFile, 'utf8')
  .split(/\r?\n/)
  .map(l => l.trim())
  .filter(l => l.length > 0 && !l.startsWith('#'));

let failures = 0;
for (const rel of lines) {
  const full = path.join(root, rel);
  if (fs.existsSync(full)) {
    console.error(`FAIL: Quarantined/deleted file still present in tree: ${rel}`);
    failures++;
  } else {
    console.log(`PASS: Confirmed absent: ${rel}`);
  }
}

if (failures > 0) {
  console.error(`\nFAILED: ${failures} quarantined file(s) still present in tree.`);
  process.exit(1);
}

console.log('\nALL DELETIONS VERIFIED CLEAN (100% OK)');
