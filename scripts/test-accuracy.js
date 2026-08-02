// Tests for the accuracy weighting (src/accuracy.js) — both the card weighting
// that makes the trend line land on the lifetime figure, and the small-sample
// shrinkage that keeps a 1-for-1 species off the top of the board. Pure, so it
// runs in plain node via a small ESM wrapper (same approach as test-mastery.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'accuracy.js');

const script = `
import {
  alignCounts,
  roundWeights,
  historyTotals,
  priorFor,
  cumulativeAccuracy,
  downsampleAccuracy,
  sampleBucketEnds,
  lifetimeRate,
  shrunkRate,
  DEFAULT_ROUND_CARDS,
  SHRINK_M,
} from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}
function near(name, actual, expected, tol = 1e-9) {
  if (Math.abs(actual - expected) <= tol) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ~' + expected + '\\n         actual    ' + actual); }
}
const last = (a) => a[a.length - 1];

console.log('\\nalignCounts');
{
  eq('same length passes through', alignCounts([70, 80], [10, 20]), [10, 20]);
  // Counts are right-aligned: a device that predates them has sizes only for
  // its NEWEST rounds, so a short array must fill from the end.
  eq('short counts fill from the right', alignCounts([70, 80, 90], [20]), [0, 0, 20]);
  eq('no counts is all-unknown', alignCounts([70, 80], []), [0, 0]);
  eq('empty history is empty', alignCounts([], [5, 6]), []);
  // Overlong counts (shouldn't happen, but a corrupt blob must not shift bars).
  eq('overlong counts keep the newest', alignCounts([70], [4, 9]), [9]);
  eq('junk sizes read as unknown', alignCounts([70, 80], [null, 'x']), [0, 0]);
  eq('negative sizes read as unknown', alignCounts([70, 80], [-4, 8]), [0, 8]);
}

console.log('\\nroundWeights');
{
  eq('known sizes are used as-is', roundWeights([70, 80], [10, 30]), [10, 30]);
  // The fill is the player's OWN mean round length, not a constant, so it
  // matches how they actually play.
  eq('unknown filled with the mean of the known', roundWeights([70, 80, 90], [20, 30]), [25, 20, 30]);
  eq('nothing known falls back to the default',
     roundWeights([70, 80], []), [DEFAULT_ROUND_CARDS, DEFAULT_ROUND_CARDS]);
}

console.log('\\ncumulativeAccuracy — the bug this fixes');
{
  // Five 20-card rounds at 70%, then one lucky single card. Unweighted, the
  // one card drags the "lifetime accuracy" line up nearly five points.
  const history = [70, 70, 70, 70, 70, 100];
  const counts  = [20, 20, 20, 20, 20, 1];
  const unweighted = history.reduce((a, b) => a + b, 0) / history.length;
  near('unweighted mean is the wrong 75%', unweighted, 75);
  near('weighted lands on the true 70.3%', last(cumulativeAccuracy(history, counts)), (71 / 101) * 100, 1e-9);
  // And the one card barely moves it, which is the whole point.
  const series = cumulativeAccuracy(history, counts);
  eq('a 1-card round moves the line under 0.4pt',
     Math.abs(last(series) - series[4]) < 0.4, true);
  eq('unweighted, it would have moved it over 4pt', Math.abs(unweighted - 70) > 4, true);
}
{
  // A long round should dominate a short one, not tie with it.
  near('100 cards at 90% vs 1 card at 0%',
       last(cumulativeAccuracy([90, 0], [100, 1])), (90 / 101) * 100, 1e-9);
  eq('empty history is an empty series', cumulativeAccuracy([], []), []);
  // With no sizes at all every round weighs the same, so this degrades to the
  // old plain mean — the pre-2.37.0 chart, unchanged.
  near('no counts degrades to the plain mean', last(cumulativeAccuracy([50, 100], [])), 75);
}

console.log('\\nhistoryTotals / priorFor');
{
  eq('totals reconstruct the cards', historyTotals([70, 100], [20, 1]), { answered: 21, correct: 15 });
  // Left unrounded on purpose — see the note on historyTotals.
  near('the fractional residue is kept', historyTotals([60], [12]).correct, 7.2, 1e-9);
  // Lifetime holds cards the chart never drew: rounds trimmed off the front, and
  // single answers from the watch. They have to be seeded or the curve can't
  // reach the lifetime figure.
  eq('prior is what the chart is missing',
     priorFor({ answered: 121, correct: 85 }, [70, 100], [20, 1]), { answered: 100, correct: 70 });
  eq('nothing missing means no prior',
     priorFor({ answered: 21, correct: 15 }, [70, 100], [20, 1]), null);
  eq('a reset lifetime yields no prior', priorFor({ answered: 0, correct: 0 }, [70], [20]), null);
  eq('an impossible prior is refused',
     priorFor({ answered: 25, correct: 25 }, [0, 0], [20, 1]), null);
  eq('junk lifetime yields no prior', priorFor(null, [70], [20]), null);
}
{
  // The contract that started all this: the last point of the curve IS the
  // number printed beside it.
  const history = [40, 90, 60];
  const counts = [5, 50, 12];
  const lifetime = { answered: 400, correct: 300 };
  const prior = priorFor(lifetime, history, counts);
  near('curve ends exactly on the lifetime percentage',
       last(cumulativeAccuracy(history, counts, prior)), 75, 1e-9);
}

console.log('\\ndownsampleAccuracy');
{
  eq('fits already — unchanged', downsampleAccuracy([10, 20], [5, 5], 4), [10, 20]);
  // Two buckets: [100% on 1 card, 50% on 99 cards] and [80% on 10, 80% on 10].
  // The first bucket must read ~50.5%, not the 75% a plain mean would give.
  const bars = downsampleAccuracy([100, 50, 80, 80], [1, 99, 10, 10], 2);
  near('a bucket is card-weighted, not round-weighted', bars[0], (50.5 / 100) * 100, 1e-9);
  near('an even bucket is unaffected', bars[1], 80);
  eq('zero bars requested', downsampleAccuracy([10, 20, 30], [1, 1, 1], 0), []);
}

console.log('\\nsampleBucketEnds');
{
  eq('fits already — unchanged', sampleBucketEnds([1, 2], 5), [1, 2]);
  // The newest value must survive: it is the true lifetime accuracy.
  eq('keeps the final value', last(sampleBucketEnds([1, 2, 3, 4, 5, 6], 3)), 6);
}

console.log('\\nlifetimeRate');
{
  near('plain ratio', lifetimeRate({ answered: 200, correct: 150 }), 0.75);
  near('no data is 0.5', lifetimeRate({ answered: 0, correct: 0 }), 0.5);
  near('junk is 0.5', lifetimeRate(null), 0.5);
}

console.log('\\nshrunkRate — the small-sample fix');
{
  const prior = 0.7;
  // One correct answer is not 100%; it barely moves off the prior.
  near('1 for 1 lands near the lifetime rate', shrunkRate({ known: 1, missed: 0 }, prior), (1 + 8 * 0.7) / 9);
  // And crucially it no longer outranks a species with a real record.
  const thin = shrunkRate({ known: 1, missed: 0 }, prior);
  const solid = shrunkRate({ known: 40, missed: 2 }, prior);
  eq('40-for-42 now outranks 1-for-1', solid > thin, true);
  eq('raw rates had it backwards', 1 / 1 > 40 / 42, true);
  // Perfect still reads as near-perfect once it is earned.
  eq('100 for 100 is still ~98%', Math.round(shrunkRate({ known: 100, missed: 0 }, prior) * 100), 98);
  // One miss is not 0% either.
  eq('0 for 1 is not zero', shrunkRate({ known: 0, missed: 1 }, prior) > 0.5, true);
  // The adjustment fades — a big sample reports essentially its raw rate.
  near('large samples converge on the raw rate',
       shrunkRate({ known: 800, missed: 200 }, prior), (800 + 8 * 0.7) / 1008, 1e-9);
  // Never-seen species stay at 0 so they sort to the bottom, not to the prior.
  eq('never seen is 0', shrunkRate({ known: 0, missed: 0 }, prior), 0);
  eq('missing entry is 0', shrunkRate(undefined, prior), 0);
  eq('junk fields are 0', shrunkRate({ known: 'x', missed: null }, prior), 0);
  // A custom m tightens or loosens how much evidence is demanded.
  near('custom m', shrunkRate({ known: 1, missed: 0 }, 0.5, 2), (1 + 1) / 3);
}

console.log('\\nconstants');
{
  eq('shrink m is a positive integer', Number.isInteger(SHRINK_M) && SHRINK_M > 0, true);
  eq('default round size is a positive integer',
     Number.isInteger(DEFAULT_ROUND_CARDS) && DEFAULT_ROUND_CARDS > 0, true);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

try {
  execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    stdio: 'inherit',
  });
} catch {
  process.exit(1);
}
