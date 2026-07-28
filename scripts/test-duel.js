// Tests for the A/B duel-drill logic (src/duel.js). Pure, so it runs in plain
// node via a small ESM wrapper (same approach as test-confusions.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'duel.js');

const script = `
import {
  nextTarget, duelStreak, isMastered, duelDone, duelSummary,
  DUEL_MASTERY_STREAK, DUEL_MAX_QUESTIONS,
} from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

console.log('\\nnextTarget');
{
  // Honours rand for the free choice (< 0.5 -> a, else b).
  eq('rand picks a', nextTarget([], () => 0.1), 'a');
  eq('rand picks b', nextTarget([], () => 0.9), 'b');
  // Never a third in a row: two a's already -> forced b even if rand says a.
  eq('breaks a run of a', nextTarget(['a', 'a'], () => 0.0), 'b');
  eq('breaks a run of b', nextTarget(['b', 'b'], () => 0.9), 'a');
  // A single repeat is still free (rand decides).
  eq('single repeat is free', nextTarget(['a'], () => 0.0), 'a');
  // Defensive: non-array input doesn't throw.
  eq('handles junk input', nextTarget(null, () => 0.9), 'b');
}

console.log('\\nduelStreak');
{
  eq('empty is zero', duelStreak([]), 0);
  eq('counts the trailing run', duelStreak([true, false, true, true]), 2);
  eq('a miss at the end resets', duelStreak([true, true, false]), 0);
  eq('all correct', duelStreak([true, true, true]), 3);
}

console.log('\\nisMastered / duelDone');
{
  const six = [true, true, true, true, true, true];
  eq('six in a row is mastered', isMastered(six), true);
  eq('five in a row is not', isMastered([true, true, true, true, true]), false);
  // Only the trailing run counts: a miss six-ago leaves a streak of five.
  eq('a miss inside the last six blocks mastery',
    isMastered([true, false, true, true, true, true, true]), false);
  eq('a miss at the very end blocks mastery',
    isMastered([true, true, true, true, true, true, false]), false);
  // duelDone: mastery ends it early...
  eq('done on mastery', duelDone(six), true);
  // ...and the cap ends it even with misses.
  const capped = Array.from({ length: DUEL_MAX_QUESTIONS }, (_, i) => i % 2 === 0);
  eq('done at the cap', duelDone(capped), true);
  eq('not done mid-drill', duelDone([true, false, true]), false);
  // The mastery bar is a positive integer and at most the cap.
  eq('mastery bar sane',
    Number.isInteger(DUEL_MASTERY_STREAK) && DUEL_MASTERY_STREAK > 0 && DUEL_MASTERY_STREAK <= DUEL_MAX_QUESTIONS,
    true);
}

console.log('\\nduelSummary');
{
  eq('summarises a won drill',
    duelSummary([false, true, true, true, true, true, true]),
    { total: 7, correct: 6, streak: 6, mastered: true, goal: 6, max: 20 });
  eq('summarises a capped drill',
    duelSummary([false, false, true]),
    { total: 3, correct: 1, streak: 1, mastered: false, goal: 6, max: 20 });
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '-e', script], {
  stdio: 'inherit',
});
