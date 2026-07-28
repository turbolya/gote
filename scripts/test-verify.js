// Tests for the "verify the fix" logic: nemesisPartners (src/confusions.js) +
// the recovery-streak reducers (src/verify.js). Pure, so it runs in plain node
// via a small ESM wrapper (same approach as test-duel.js).

const path = require('path');
const { execFileSync } = require('child_process');

const conf = path.join(__dirname, '..', 'src', 'confusions.js');
const verify = path.join(__dirname, '..', 'src', 'verify.js');

const script = `
import { nemesisPartners, pairKey, CONFUSION_HINT_MIN } from ${JSON.stringify(conf)};
import {
  verifyStreak, recordVerifyWin, recordVerifyMiss, shouldCelebrateVerify,
  VERIFY_STREAK_MIN,
} from ${JSON.stringify(verify)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

console.log('\\nnemesisPartners');
{
  // Below the floor (default = CONFUSION_HINT_MIN, 3) -> no partners.
  eq('empty below the floor', nemesisPartners({ A: { B: 2 } }, 'A'), []);

  // Folds both directions of the pair, then passes the floor.
  eq('folds both directions',
    nemesisPartners({ A: { B: 2 }, B: { A: 1 } }, 'A'),
    [{ partner: 'B', count: 3 }]);

  // Symmetric: querying the other side gives the same total.
  eq('symmetric from B',
    nemesisPartners({ A: { B: 2 }, B: { A: 1 } }, 'B'),
    [{ partner: 'A', count: 3 }]);

  // Multiple partners, strongest first; self and sub-floor excluded.
  eq('ranks partners, drops self + weak',
    nemesisPartners({ A: { A: 9, B: 5, C: 3, D: 1 } }, 'A'),
    [{ partner: 'B', count: 5 }, { partner: 'C', count: 3 }]);

  // Numeric-key input (real taxonIds) is coerced to strings.
  eq('coerces numeric keys', nemesisPartners({ 10: { 20: 4 } }, 10), [{ partner: '20', count: 4 }]);

  // Custom floor.
  eq('respects a custom min',
    nemesisPartners({ A: { B: 2 } }, 'A', { min: 2 }), [{ partner: 'B', count: 2 }]);

  // Junk input doesn't throw.
  eq('handles junk', nemesisPartners(null, 'A'), []);
}

console.log('\\nverifyStreak / record');
{
  const pk = pairKey('A', 'B');
  eq('empty streak is zero', verifyStreak({}, pk), 0);
  eq('reads a streak', verifyStreak({ [pk]: 4 }, pk), 4);
  eq('a win extends the run', verifyStreak(recordVerifyWin({ [pk]: 2 }, pk), pk), 3);
  eq('first win starts at 1', verifyStreak(recordVerifyWin({}, pk), pk), 1);
  eq('a miss clears the run', verifyStreak(recordVerifyMiss({ [pk]: 5 }, pk), pk), 0);
  // Immutability: the inputs aren't mutated.
  const base = { [pk]: 2 };
  recordVerifyWin(base, pk); recordVerifyMiss(base, pk);
  eq('does not mutate the input', base[pk], 2);
  // A blank pairKey is a no-op.
  eq('blank key is a no-op', recordVerifyWin({ [pk]: 1 }, ''), { [pk]: 1 });
}

console.log('\\nshouldCelebrateVerify');
{
  eq('below the bar', shouldCelebrateVerify(VERIFY_STREAK_MIN - 1), false);
  eq('at the bar', shouldCelebrateVerify(VERIFY_STREAK_MIN), true);
  eq('the bar is a positive integer',
    Number.isInteger(VERIFY_STREAK_MIN) && VERIFY_STREAK_MIN > 0, true);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '-e', script], {
  stdio: 'inherit',
});
