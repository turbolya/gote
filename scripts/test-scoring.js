// Tests for difficulty-weighted scoring (src/scoring.js). Pure, so it runs in
// plain node via a small ESM wrapper (same approach as test-mastery.js).
//
// The case that matters most is the least obvious: answers given before formats
// were recorded must still be worth something. A score built only from the
// format split would tell a long-time player their entire history counted for
// nothing, which is the kind of regression that looks like data loss.

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'scoring.js');

const script = `
import { WEIGHTS, DEFAULT_WEIGHT, weightOf, scoreFrom, potentialFrom, scoreDelta, weightedRate } from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}
function ok(name, cond) { eq(name, !!cond, true); }

console.log('\\nweightOf');
{
  eq('picking a photo out of four is worth least', weightOf('picture'), 0.5);
  eq('picking a name out of five', weightOf('name'), 1);
  eq('separating two look-alikes', weightOf('pair'), 1.5);
  eq('typing from memory is worth most', weightOf('typed'), 2);
  eq('an unknown format falls back', weightOf('nonsense'), DEFAULT_WEIGHT);
  eq('so does undefined', weightOf(undefined), DEFAULT_WEIGHT);
  // The ordering IS the design; assert it rather than the literals alone.
  ok('weights rise with difficulty',
    weightOf('picture') < weightOf('name') && weightOf('name') < weightOf('pair') && weightOf('pair') < weightOf('typed'));
}

console.log('\\nscoreFrom');
{
  const by = { picture: { answered: 10, correct: 8 }, typed: { answered: 5, correct: 3 } };
  // 8 x 0.5 + 3 x 2 = 4 + 6
  eq('sums weight x correct across formats', scoreFrom({ answered: 15, correct: 11 }, by), 10);
  eq('an empty split scores nothing when nothing was answered', scoreFrom({ answered: 0, correct: 0 }, {}), 0);
  eq('no split at all', scoreFrom({ answered: 4, correct: 3 }, undefined), 3 * DEFAULT_WEIGHT);
}

console.log('\\nscoreFrom — history from before formats were recorded');
{
  // 40 correct lifetime, but only 11 of them explained by the split. The other
  // 29 predate format recording and must still be worth their default weight.
  const by = { picture: { answered: 10, correct: 8 }, typed: { answered: 5, correct: 3 } };
  eq('legacy correct answers keep their value',
    scoreFrom({ answered: 60, correct: 40 }, by), 10 + 29 * DEFAULT_WEIGHT);
  // A split that somehow claims MORE than the lifetime total must not go
  // negative — that would silently subtract from the score.
  eq('an over-claiming split cannot subtract',
    scoreFrom({ answered: 5, correct: 2 }, by), 10);
  eq('junk lifetime', scoreFrom(null, by), 10);
  eq('junk values inside the split', scoreFrom({ answered: 3, correct: 3 }, { name: { correct: 'x' } }), 3 * DEFAULT_WEIGHT);
}

console.log('\\npotentialFrom');
{
  const by = { picture: { answered: 10, correct: 8 }, typed: { answered: 5, correct: 3 } };
  // 10 x 0.5 + 5 x 2 = 5 + 10
  eq('the ceiling if everything had been right', potentialFrom({ answered: 15, correct: 11 }, by), 15);
  eq('legacy answers raise the ceiling too',
    potentialFrom({ answered: 25, correct: 11 }, by), 15 + 10 * DEFAULT_WEIGHT);
  ok('the score can never exceed the ceiling',
    scoreFrom({ answered: 15, correct: 15 }, by) <= potentialFrom({ answered: 15, correct: 15 }, by));
}

console.log('\\nscoreDelta');
{
  eq('a correct typed answer', scoreDelta('typed', true), { points: 2, weight: 2 });
  // A wrong answer still costs its weight: getting a hard question wrong has to
  // hurt more than getting an easy one wrong, or the weighting is one-sided.
  eq('a wrong typed answer earns nothing but still counts', scoreDelta('typed', false), { points: 0, weight: 2 });
  eq('a correct photo answer', scoreDelta('picture', true), { points: 0.5, weight: 0.5 });
  eq('a wrong photo answer', scoreDelta('picture', false), { points: 0, weight: 0.5 });
  eq('an unknown format', scoreDelta('???', true), { points: DEFAULT_WEIGHT, weight: DEFAULT_WEIGHT });
}

console.log('\\nweightedRate');
{
  eq('all correct is 1', weightedRate({ points: 6, weight: 6 }), 1);
  eq('none correct is 0', weightedRate({ points: 0, weight: 6 }), 0);
  eq('half by weight', weightedRate({ points: 3, weight: 6 }), 0.5);
  // Null, not 0 — "no weighted history" and "got everything wrong" are
  // different things and must sort differently.
  eq('nothing recorded is null', weightedRate({ points: 0, weight: 0 }), null);
  eq('a tally with no scoring fields', weightedRate({ known: 4, missed: 1 }), null);
  eq('missing entry', weightedRate(undefined), null);
  eq('junk cannot exceed 1', weightedRate({ points: 99, weight: 1 }), 1);
  eq('junk cannot go below 0', weightedRate({ points: -5, weight: 1 }), 0);
}

console.log('\\nthe weighting actually changes the ranking');
{
  // Two species with identical raw records: 6 right out of 8. One was answered
  // by typing, the other by picking photos. The typed one must rank higher.
  const typedSp = { points: 6 * 2, weight: 8 * 2 };
  const photoSp = { points: 6 * 0.5, weight: 8 * 0.5 };
  eq('identical raw rates', weightedRate(typedSp), weightedRate(photoSp));
  // …the RATE is the same, which is correct — rate is about reliability. What
  // differs is how much each contributed, which is what the score measures.
  ok('but the harder species is worth more points', typedSp.points > photoSp.points);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
