// Tests for the sync switch (src/sync/enabled.js, used by config.js): on everywhere except the
// F-Droid build and the two synthetic modes. Pure, so it runs in plain node
// through a small ESM wrapper (same approach as test-mastery.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'sync', 'enabled.js');

const script = `
import { syncEnabled } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}
const ok = { url: 'https://x.supabase.co', key: 'sb_publishable_x' };

console.log('\\nsyncEnabled');
eq('an ordinary build (iOS, Play, development) has sync', syncEnabled({ ...ok }), true);
eq('the F-Droid build does not', syncEnabled({ ...ok, fdroid: true }), false);
eq('E2E stays offline', syncEnabled({ ...ok, e2e: true }), false);
eq('the screenshot build never uploads its fake stats', syncEnabled({ ...ok, shots: true }), false);
eq('no credentials, no sync', syncEnabled({ inApp: true, url: '', key: '' }), false);
eq('a missing key alone is enough to disable it', syncEnabled({ url: ok.url, key: '' }), false);
eq('a node script never reaches for the service', syncEnabled({ ...ok, inApp: false }), false);
eq('F-Droid wins over everything else', syncEnabled({ ...ok, fdroid: true, e2e: false, shots: false }), false);

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'inherit' });
