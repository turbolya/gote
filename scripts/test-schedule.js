// Tests for the spaced-repetition input (src/schedule.js) — the confusion
// signal that biases sampled rounds toward unresolved mix-ups. Pure, so it runs
// in plain node via a small ESM wrapper (same approach as test-verify.js).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'schedule.js');
const conf = path.join(__dirname, '..', 'src', 'confusions.js');

const script = `
import { pairPriority, dueConfusionPairs, scheduleDeck } from ${JSON.stringify(src)};
import { pairKey } from ${JSON.stringify(conf)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}
function ok(name, cond) { eq(name, !!cond, true); }

// A deterministic RNG (LCG) so scheduleDeck's shuffles are reproducible.
function lcg(seed) { let s = seed >>> 0; return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }

const cards = (keys) => keys.map((k) => ({ taxonId: k, common: 'sp' + k }));
const keysOf = (deck) => deck.map((c) => String(c.taxonId)).sort();

console.log('\\npairPriority');
{
  eq('count with no wins is the raw count', pairPriority(5, 0), 5);
  eq('a recovery streak damps it', pairPriority(6, 2), 2); // 6/(1+2)
  eq('zero count is not due', pairPriority(0, 3), 0);
  ok('a fixed pair ranks below a fresh one', pairPriority(4, 3) < pairPriority(4, 0));
}

console.log('\\ndueConfusionPairs');
{
  const confusions = { A: { B: 4 }, C: { D: 6 } };
  // No wins: order by raw count (C/D 6 before A/B 4).
  eq('ranks by priority (count) with no wins',
    dueConfusionPairs(confusions, {}).map((p) => [p.a, p.b, p.priority]),
    [['C', 'D', 6], ['A', 'B', 4]]);
  // A big recovery streak on C/D pushes it below A/B.
  const wins = { [pairKey('C', 'D')]: 5 }; // 6/(1+5) = 1 < 4
  eq('a recovery streak reorders due pairs',
    dueConfusionPairs(confusions, wins).map((p) => p.a + p.b),
    ['AB', 'CD']);
  // Below the floor -> not due.
  eq('sub-floor pairs are not due', dueConfusionPairs({ A: { B: 2 } }, {}), []);
}

console.log('\\nscheduleDeck');
{
  const pool = cards([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // A due pair (1<->2). With size 6, both members should be pulled in.
  const confusions = { 1: { 2: 4 } };
  const deck = scheduleDeck(pool, { confusions, size: 6, rng: lcg(42) });
  eq('returns exactly size cards', deck.length, 6);
  ok('pulls in both members of the due pair', keysOf(deck).includes('1') && keysOf(deck).includes('2'));

  // No due pairs -> a plain sample of size (still exactly size, all from pool).
  const plain = scheduleDeck(pool, { confusions: {}, size: 4, rng: lcg(7) });
  eq('degrades to a size sample with no due pairs', plain.length, 4);
  ok('sample is drawn from the pool', plain.every((c) => c.taxonId >= 1 && c.taxonId <= 10));

  // Pool no larger than size -> just (a shuffle of) the whole pool.
  const small = scheduleDeck(cards([1, 2, 3]), { confusions: { 1: { 2: 9 } }, size: 5, rng: lcg(1) });
  eq('pool <= size returns the whole pool', keysOf(small), ['1', '2', '3']);

  // The reserve is capped: many due pairs can't crowd out the whole round.
  const bigConf = { 1: { 2: 9 }, 3: { 4: 8 }, 5: { 6: 7 }, 7: { 8: 6 } };
  const capped = scheduleDeck(pool, { confusions: bigConf, size: 6, reserveFraction: 0.4, rng: lcg(3) });
  eq('reserve is bounded (round stays mixed)', capped.length, 6);
  // reserve = floor(6*0.4) = 2, so at most one pair (2 cards) is forced in;
  // the round still contains cards outside the confused set.
  ok('keeps non-confused cards in the round', capped.some((c) => c.taxonId > 8));

  // A partner missing from the pool: the present member is still resurfaced.
  const half = scheduleDeck(cards([1, 3, 4, 5, 6, 7, 8, 9]), { confusions: { 1: { 2: 5 } }, size: 4, rng: lcg(9) });
  ok('resurfaces the present member when the partner is absent', keysOf(half).includes('1'));
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '-e', script], {
  stdio: 'inherit',
});
