// Tests for the "mastered species" check (src/mastery.js). Pure, so it runs in
// plain node via a small ESM wrapper (same approach as test-verify.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'mastery.js');

const script = `
import { isMastered, MASTERY_MIN_CORRECT, MASTERY_MIN_ACCURACY } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

console.log('\\nisMastered');
{
  // 5 correct, 0 wrong -> 100% accuracy, meets the floor exactly.
  eq('exactly the min correct, perfect accuracy', isMastered({ known: 5, missed: 0 }), true);
  // 4 correct is below the correct-count floor, however accurate.
  eq('below the correct-count floor', isMastered({ known: 4, missed: 0 }), false);
  // 8 correct / 2 wrong = 80% exactly -> mastered (>= boundary).
  eq('exactly 80% accuracy at the boundary', isMastered({ known: 8, missed: 2 }), true);
  // 7 correct / 2 wrong = 77.8% -> below 80%.
  eq('just under 80% accuracy', isMastered({ known: 7, missed: 2 }), false);
  // Plenty correct but poor accuracy.
  eq('many correct but low accuracy', isMastered({ known: 6, missed: 6 }), false);
  // No data / never seen.
  eq('empty entry is not mastered', isMastered({}), false);
  eq('missing entry is not mastered', isMastered(undefined), false);
  eq('all misses is not mastered', isMastered({ known: 0, missed: 5 }), false);
  // Custom thresholds are honoured.
  eq('custom thresholds', isMastered({ known: 3, missed: 0 }, { minCorrect: 3, minAccuracy: 1 }), true);
  // Junk fields don't throw.
  eq('junk fields', isMastered({ known: 'x', missed: null }), false);
}

console.log('\\nconstants');
{
  eq('min correct is a positive integer', Number.isInteger(MASTERY_MIN_CORRECT) && MASTERY_MIN_CORRECT > 0, true);
  eq('min accuracy is a fraction in (0,1]', MASTERY_MIN_ACCURACY > 0 && MASTERY_MIN_ACCURACY <= 1, true);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '-e', script], {
  stdio: 'inherit',
});
