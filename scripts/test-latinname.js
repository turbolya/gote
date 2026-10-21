// Tests for the Latin-name line (src/latinname.js). Pure, so it runs in plain
// node through a small ESM wrapper (same approach as test-mastery.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'latinname.js');

const script = `
import { latinLine } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

console.log('\\nlatinLine');
eq('on: the scientific name goes under the common one',
  latinLine({ show: true, common: 'European Robin', scientific: 'Erithacus rubecula' }), 'Erithacus rubecula');
eq('off: nothing', latinLine({ show: false, common: 'European Robin', scientific: 'Erithacus rubecula' }), null);
eq('off by default', latinLine({ common: 'European Robin', scientific: 'Erithacus rubecula' }), null);
eq('no common name: the scientific name is already the name', latinLine({ show: true, common: null, scientific: 'Erithacus rubecula' }), null);
eq('empty common name', latinLine({ show: true, common: '', scientific: 'Erithacus rubecula' }), null);
eq('common equals scientific, ignoring case', latinLine({ show: true, common: 'erithacus RUBECULA', scientific: 'Erithacus rubecula' }), null);
eq('no scientific name', latinLine({ show: true, common: 'European Robin', scientific: null }), null);
eq('whitespace is trimmed', latinLine({ show: true, common: ' Robin ', scientific: '  Erithacus rubecula ' }), 'Erithacus rubecula');
eq('no arguments', latinLine(), null);

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'inherit' });
