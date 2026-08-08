// Tests for the retrieval signals attached to each species tally
// (src/recall.js). Pure, so it runs in plain node via a small ESM wrapper
// (same approach as test-mastery.js).
//
// Nothing in the app reads these yet. They are tested now for the same reason
// they are recorded now: the shapes have to be right BEFORE months of data
// accumulate in them, because a wrong shape cannot be fixed retroactively — and
// a mean stored where a sum belongs would corrupt every multi-device account
// silently.

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'recall.js');

const script = `
import { sanitizeLatency, recordRecall, meanLatencyMs, LATENCY_MAX_MS } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}
function ok(name, cond) { eq(name, !!cond, true); }

console.log('\\nsanitizeLatency');
{
  eq('a normal answer', sanitizeLatency(2400), 2400);
  eq('rounds to whole ms', sanitizeLatency(2400.6), 2401);
  eq('the ceiling itself is kept', sanitizeLatency(LATENCY_MAX_MS), LATENCY_MAX_MS);
  // Past the ceiling it is not a measurement of recall, it is an interruption.
  // Discarded rather than clamped: clamping would record a fake 60s answer and
  // drag the mean, where 0 records "we do not know".
  eq('past the ceiling is discarded, not clamped', sanitizeLatency(LATENCY_MAX_MS + 1), 0);
  eq('a coffee break', sanitizeLatency(45 * 60 * 1000), 0);
  eq('zero is absence, not a measurement', sanitizeLatency(0), 0);
  eq('negative (clock moved) is absence', sanitizeLatency(-500), 0);
  eq('NaN', sanitizeLatency(NaN), 0);
  eq('null', sanitizeLatency(null), 0);
  eq('undefined', sanitizeLatency(undefined), 0);
  eq('a string of digits still works', sanitizeLatency('2400'), 2400);
  eq('junk string', sanitizeLatency('soon'), 0);
  eq('Infinity', sanitizeLatency(Infinity), 0);
}

console.log('\\nrecordRecall');
{
  eq('a first correct, timed answer',
    recordRecall(undefined, { correct: true, ms: 1500, at: 1000 }),
    { known: 1, missed: 0, lastSeen: 1000, msTotal: 1500, msCount: 1, points: 0, weight: 0 });
  eq('a first miss',
    recordRecall(undefined, { correct: false, ms: 9000, at: 1000 }),
    { known: 0, missed: 1, lastSeen: 1000, msTotal: 9000, msCount: 1, points: 0, weight: 0 });
  // An untimed answer (wrist round, Pick the right one) must not count as a
  // zero-latency one, or every mean drifts toward zero.
  eq('an untimed answer counts the result but not the timing',
    recordRecall({ known: 2, missed: 0, lastSeen: 5, msTotal: 3000, msCount: 2, points: 0, weight: 0 }, { correct: true, ms: 0, at: 10 }),
    { known: 3, missed: 0, lastSeen: 10, msTotal: 3000, msCount: 2, points: 0, weight: 0 });
  eq('an over-ceiling answer is untimed too',
    recordRecall({ known: 1, missed: 0, lastSeen: 5, msTotal: 1000, msCount: 1, points: 0, weight: 0 }, { correct: true, ms: 999999, at: 10 }),
    { known: 2, missed: 0, lastSeen: 10, msTotal: 1000, msCount: 1, points: 0, weight: 0 });
  // lastSeen takes the MAX, not the newest write: events arrive out of order,
  // so the last one applied is routinely not the last one played.
  eq('an out-of-order older answer does not rewind lastSeen',
    recordRecall({ known: 1, missed: 0, lastSeen: 900, msTotal: 0, msCount: 0, points: 0, weight: 0 }, { correct: true, ms: 0, at: 100 }).lastSeen,
    900);
  eq('junk previous entry is treated as empty',
    recordRecall({ known: 'x', missed: null, lastSeen: NaN, msTotal: undefined, msCount: {} }, { correct: true, ms: 500, at: 7 }),
    { known: 1, missed: 0, lastSeen: 7, msTotal: 500, msCount: 1, points: 0, weight: 0 });
  eq('no options at all still records a miss', recordRecall(undefined, { at: 3 }),
    { known: 0, missed: 1, lastSeen: 3, msTotal: 0, msCount: 0, points: 0, weight: 0 });
}

console.log('\\nrecordRecall — difficulty-weighted totals');
{
  // A wrong answer still adds its WEIGHT but no points, which is what makes a
  // miss on a hard question cost more than a miss on an easy one.
  const right = recordRecall(undefined, { correct: true, at: 1, score: { points: 2, weight: 2 } });
  eq('a correct typed answer banks its points', [right.points, right.weight], [2, 2]);
  const wrong = recordRecall(right, { correct: false, at: 2, score: { points: 0, weight: 2 } });
  eq('a wrong one adds weight but no points', [wrong.points, wrong.weight], [2, 4]);
  const easy = recordRecall(wrong, { correct: true, at: 3, score: { points: 0.5, weight: 0.5 } });
  eq('a correct photo answer is worth a quarter as much', [easy.points, easy.weight], [2.5, 4.5]);
  // An answer with no format (a wrist round) must not corrupt the totals.
  const none = recordRecall(easy, { correct: true, at: 4 });
  eq('an unscored answer leaves the totals alone', [none.points, none.weight], [2.5, 4.5]);
  eq('but still counts as known', none.known, 3);
}

console.log('\\nrecordRecall folds like the sync layer expects');
{
  // The whole point of sum+count: folding the same answers in any order, split
  // across two devices, must reach the same numbers.
  const answers = [
    { correct: true, ms: 1000, at: 10 },
    { correct: false, ms: 3000, at: 20 },
    { correct: true, ms: 2000, at: 30 },
  ];
  let a = undefined;
  for (const x of answers) a = recordRecall(a, x);
  let b = undefined;
  for (const x of [...answers].reverse()) b = recordRecall(b, x);
  eq('order does not change the outcome', a, b);
  eq('and the totals are right', a, { known: 2, missed: 1, lastSeen: 30, msTotal: 6000, msCount: 3, points: 0, weight: 0 });
}

console.log('\\nmeanLatencyMs');
{
  eq('mean over timed answers', meanLatencyMs({ msTotal: 6000, msCount: 3 }), 2000);
  // null, not 0 — a scheduler has to tell "answers instantly" from "no idea".
  eq('nothing timed is null, not zero', meanLatencyMs({ msTotal: 0, msCount: 0 }), null);
  eq('a tally with no timing fields at all', meanLatencyMs({ known: 4, missed: 1 }), null);
  eq('missing entry', meanLatencyMs(undefined), null);
  eq('junk', meanLatencyMs({ msTotal: 'x', msCount: 2 }), 0);
  ok('a negative count cannot produce a mean', meanLatencyMs({ msTotal: 100, msCount: -1 }) === null);
}

console.log('\\nconstants');
{
  ok('the ceiling is a positive whole number of ms', Number.isInteger(LATENCY_MAX_MS) && LATENCY_MAX_MS > 0);
  ok('and is generous enough for a genuinely hard card', LATENCY_MAX_MS >= 30000);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
