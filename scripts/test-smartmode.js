// Tests for Smart play's question chooser (src/smartmode.js). Pure, so it runs
// in plain node via a small ESM wrapper (same approach as test-mastery.js).
//
// What has to hold, and would be invisible in play if it broke: a species you
// have never met, or keep missing, is asked mostly by name, the easiest
// question, and never from memory; the hard questions (the photo grid, typed
// recall) grow with how well it is known; a live confusion must be able to
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
  // The name list is the easiest question (src/scoring.js ranks it lowest),
  // so a species you have never met is met there.
  ok('is asked mostly by name', w[FORMAT.NAME] > w[FORMAT.PICTURE] * 2);
  eq('and is never asked from memory', w[FORMAT.TYPED], 0);
  eq('nor as a pair it has no history of confusing', w[FORMAT.PAIR], 0);
  // …but not ONLY by name. A deck with no history would then play entirely as
  // one format, indistinguishable from By name.
  ok('a photo grid is still possible from the first meeting', w[FORMAT.PICTURE] > 0);
}

console.log('\\nformatWeights — a species being learned');
{
  const w = formatWeights({ evidence: 2, rate: 0.5 });
  ok('leans on the easiest format, the name list', w[FORMAT.NAME] > w[FORMAT.PICTURE] * 2);
  eq('still not from memory on 2 answers', w[FORMAT.TYPED], 0);
  // A species you keep missing is a HARD species — it goes back to names,
  // however many times it has come up.
  const poor = formatWeights({ evidence: 20, rate: 0.3 });
  eq('a long but poor record is still not asked from memory', poor[FORMAT.TYPED], 0);
  ok('and is asked mostly by name', poor[FORMAT.NAME] > poor[FORMAT.PICTURE] * 2);
}

console.log('\\nformatWeights — a species that is known');
{
  const w = formatWeights({ evidence: 10, rate: 0.95 });
  ok('recall is now the likeliest question', w[FORMAT.TYPED] > w[FORMAT.PICTURE]);
  ok('the photo grid is the next hardest, and next likeliest', w[FORMAT.PICTURE] > w[FORMAT.NAME]);
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
  ok('with a real share of photo grids', w[FORMAT.PICTURE] > w[FORMAT.TYPED]);
  ok('though fewer than names', w[FORMAT.NAME] > w[FORMAT.PICTURE]);
}

console.log('\\nformatWeights — the hard photo grid grows with the species');
{
  // The whole point of the change: the photo grid used to be handed to new and
  // weak species as the easy question, and retired once one was known.
  const share = (w) => w[FORMAT.PICTURE] / Object.values(w).reduce((a, b) => a + b, 0);
  const fresh = share(formatWeights({ evidence: 0, rate: 0 }));
  const weak = share(formatWeights({ evidence: 20, rate: 0.3 }));
  const middle = share(formatWeights({ evidence: 4, rate: 0.7 }));
  const known = share(formatWeights({ evidence: 10, rate: 0.95 }));
  ok('a new species gets fewer photo grids than one being learned', fresh < middle);
  ok('so does a species being missed', weak < middle);
  ok('and a known species still gets them', known > 0);
  // …and the name list does the opposite.
  const names = (o) => formatWeights(o)[FORMAT.NAME];
  ok('names dominate for new and weak species, not for known ones',
    names({ evidence: 0, rate: 0 }) > names({ evidence: 10, rate: 0.95 }) &&
    names({ evidence: 20, rate: 0.3 }) > names({ evidence: 10, rate: 0.95 }));
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
  // An EMPTY list means nothing is allowed — the shape a pairs-only round takes
  // on a species with no confusion recorded. It must fall back to a name list,
  // not to "anything goes": that served typed recall and photo grids in a round
  // the player asked for as pairs.
  eq('an empty allow list falls back to a name list',
    drawSet({ evidence: 10, rate: 0.95, allow: [] }), [FORMAT.NAME]);
  eq('…on a species never seen too',
    drawSet({ evidence: 0, rate: 0, allow: [] }), [FORMAT.NAME]);
  // An omitted one still means no restriction.
  eq('no allow list at all is no restriction',
    drawSet({ evidence: 10, rate: 0.95 }), [FORMAT.NAME, FORMAT.PICTURE, FORMAT.TYPED].sort());
}

console.log('\\nchooseFormat — the draw is genuinely mixed');
{
  // "Semi-random" is the point: a known species must not be asked the same way
  // every single time, or the mode is just four modes wearing a trench coat.
  const known = drawSet({ evidence: 10, rate: 0.95 });
  ok('a known species sees more than one format', known.length >= 2);
  ok('including the photo grid', known.includes(FORMAT.PICTURE));
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
