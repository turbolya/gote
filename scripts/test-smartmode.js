// Tests for Smart play's question chooser (src/smartmode.js). Pure, so it runs
// in plain node via a small ESM wrapper (same approach as test-mastery.js).
//
// What has to hold, and would be invisible in play if it broke: a species you
// have never met must never be asked for from memory, a species you know cold
// must stop being offered as multiple choice, a live confusion must be able to
// surface as its pair — and no format may ever be chosen that this round cannot
// actually render (no photo grid offline, no pair without a partner).

const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'smartmode.js');

const script = `
import {
  FORMAT, ALL_FORMATS, formatWeights, chooseFormat,
  MIN_EVIDENCE, TYPED_MIN_EVIDENCE, TYPED_MIN_RATE, WEAK_RATE,
} from ${JSON.stringify(src)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}
function ok(name, cond) { eq(name, !!cond, true); }

// A deterministic RNG (LCG), so a weighted draw can be checked exactly.
function lcg(seed) { let s = seed >>> 0; return () => { s = (1664525 * s + 1013904223) >>> 0; return s / 4294967296; }; }
// Every format a species could be asked in over many draws.
function drawSet(opts, n = 4000) {
  const rng = lcg(7);
  const seen = new Set();
  for (let i = 0; i < n; i++) seen.add(chooseFormat(opts, rng));
  return [...seen].sort();
}

console.log('\\nformatWeights — a species never seen');
{
  const w = formatWeights({ evidence: 0, rate: 0 });
  eq('is introduced with the name visible', w[FORMAT.PICTURE] > 0, true);
  eq('and is never asked from memory', w[FORMAT.TYPED], 0);
  eq('nor as a pair it has no history of confusing', w[FORMAT.PAIR], 0);
  // A name list IS offered on a first meeting, just not often. Making the photo
  // grid the ONLY first question meant a deck with no history played entirely as
  // photo grids — indistinguishable from By picture, and the slowest format
  // besides. Found by playing the mode, not by reading it.
  ok('a name list is possible from the first meeting', w[FORMAT.NAME] > 0);
  ok('but the teaching format still leads clearly', w[FORMAT.PICTURE] > w[FORMAT.NAME] * 2);
}

console.log('\\nformatWeights — a species being learned');
{
  const w = formatWeights({ evidence: 2, rate: 0.5 });
  ok('leans on the easiest format', w[FORMAT.PICTURE] > w[FORMAT.NAME]);
  eq('still not from memory on 2 answers', w[FORMAT.TYPED], 0);
  const poor = formatWeights({ evidence: 20, rate: 0.3 });
  eq('a long but poor record is still not asked from memory', poor[FORMAT.TYPED], 0);
  ok('and is still given the easier format', poor[FORMAT.PICTURE] > 0);
}

console.log('\\nformatWeights — a species that is known');
{
  const w = formatWeights({ evidence: 10, rate: 0.95 });
  eq('the easiest format is retired', w[FORMAT.PICTURE], 0);
  ok('recall is now the likeliest question', w[FORMAT.TYPED] > w[FORMAT.NAME]);
  ok('but a name list still appears sometimes', w[FORMAT.NAME] > 0);
  // Exactly at the thresholds, not just past them.
  const edge = formatWeights({ evidence: TYPED_MIN_EVIDENCE, rate: TYPED_MIN_RATE });
  ok('the thresholds themselves qualify', edge[FORMAT.TYPED] > edge[FORMAT.NAME]);
  const under = formatWeights({ evidence: TYPED_MIN_EVIDENCE - 1, rate: TYPED_MIN_RATE });
  ok('one answer short does not', under[FORMAT.TYPED] < edge[FORMAT.TYPED]);
}

console.log('\\nformatWeights — the middle is not a cliff');
{
  // A species on its way up should get a trickle of typed questions before it
  // formally qualifies, so the format is not a sudden wall.
  const w = formatWeights({ evidence: 4, rate: 0.7 });
  ok('a trickle of recall before it qualifies', w[FORMAT.TYPED] > 0);
  ok('but the name list still dominates', w[FORMAT.NAME] > w[FORMAT.TYPED]);
}

console.log('\\nformatWeights — a live confusion');
{
  const w = formatWeights({ evidence: 8, rate: 0.9, hasPartner: true });
  ok('the pair is weighted heavily', w[FORMAT.PAIR] > 0);
  ok('but never to the exclusion of everything else', w[FORMAT.TYPED] > 0);
  eq('no partner, no pair', formatWeights({ evidence: 8, rate: 0.9 })[FORMAT.PAIR], 0);
}

console.log('\\nchooseFormat — only ever returns a real format');
{
  const rng = lcg(3);
  let allValid = true;
  for (let i = 0; i < 2000; i++) {
    const f = chooseFormat({ evidence: i % 12, rate: (i % 10) / 10, hasPartner: i % 3 === 0 }, rng);
    if (!ALL_FORMATS.includes(f)) allValid = false;
  }
  ok('over a wide sweep of inputs', allValid);
}

console.log('\\nchooseFormat — the excluded stay excluded');
{
  // PICTURE needs four other species' photos fetched live, so offline it must
  // never be chosen — including for a brand new species, whose weights ask for
  // nothing else.
  const offline = [FORMAT.NAME, FORMAT.PAIR, FORMAT.TYPED];
  eq('offline, an unseen species falls back to a name list',
    drawSet({ evidence: 0, rate: 0, allow: offline }), [FORMAT.NAME]);
  // Online, a fresh deck must not be a wall of photo grids.
  eq('a brand new species sees both introductory formats',
    drawSet({ evidence: 0, rate: 0 }), [FORMAT.NAME, FORMAT.PICTURE].sort());
  ok('offline, a photo grid is never drawn',
    !drawSet({ evidence: 6, rate: 0.9, hasPartner: true, allow: offline }).includes(FORMAT.PICTURE));
  // PAIR needs the partner card present in this deck.
  ok('without the partner card, no pair',
    !drawSet({ evidence: 8, rate: 0.9, hasPartner: true, allow: [FORMAT.NAME, FORMAT.TYPED] }).includes(FORMAT.PAIR));
  eq('an empty allow list is treated as no restriction',
    chooseFormat({ evidence: 0, rate: 0, allow: [] }, lcg(1)), FORMAT.PICTURE);
}

console.log('\\nchooseFormat — the draw is genuinely mixed');
{
  // "Semi-random" is the point: a known species must not be asked the same way
  // every single time, or the mode is just four modes wearing a trench coat.
  const known = drawSet({ evidence: 10, rate: 0.95 });
  ok('a known species sees more than one format', known.length >= 2);
  ok('and never the easiest one', !known.includes(FORMAT.PICTURE));
  const confused = drawSet({ evidence: 10, rate: 0.9, hasPartner: true });
  ok('a confused species can surface as its pair', confused.includes(FORMAT.PAIR));
  ok('but not only as its pair', confused.length >= 2);
}

console.log('\\nchooseFormat — junk in, playable question out');
{
  eq('no arguments', ALL_FORMATS.includes(chooseFormat()), true);
  eq('junk evidence and rate', ALL_FORMATS.includes(chooseFormat({ evidence: 'x', rate: null })), true);
  eq('a rate above 1 is clamped, not trusted', ALL_FORMATS.includes(chooseFormat({ evidence: 9, rate: 42 })), true);
  eq('an rng stuck at 0', ALL_FORMATS.includes(chooseFormat({ evidence: 9, rate: 0.9 }, () => 0)), true);
  // An rng returning exactly 1 lands past the end of the weighted range.
  eq('an rng stuck at 1', ALL_FORMATS.includes(chooseFormat({ evidence: 9, rate: 0.9 }, () => 1)), true);
  eq('an rng returning junk', ALL_FORMATS.includes(chooseFormat({ evidence: 9, rate: 0.9 }, () => NaN)), true);
}

console.log('\\nconstants are coherent');
{
  ok('recall needs more evidence than a species needs to be judged at all', TYPED_MIN_EVIDENCE >= MIN_EVIDENCE);
  ok('the recall bar is above the weak bar', TYPED_MIN_RATE > WEAK_RATE);
  ok('rates are fractions', TYPED_MIN_RATE <= 1 && WEAK_RATE <= 1);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
