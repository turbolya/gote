// Tests for the pure Lexicon helpers in src/lexicon.js.
//   node scripts/test-lexicon.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'lexicon.js');
const code = babel.transformFileSync(file, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const m = { exports: {} };
// A require anchored at the SOURCE file, not this script — lexicon.js imports
// './mastery.js', which must resolve against src/, and mastery.js is transpiled
// the same way so its ESM syntax doesn't hit plain require.
const srcRequire = (id) => {
  if (!id.startsWith('.')) return require(id);
  const dep = require.resolve(id, { paths: [path.dirname(file)] });
  const depCode = babel.transformFileSync(dep, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const dm = { exports: {} };
  new Function('module', 'exports', 'require', depCode)(dm, dm.exports, srcRequire);
  return dm.exports;
};
new Function('module', 'exports', 'require', code)(m, m.exports, srcRequire);
const {
  genusOf,
  uniqueByTaxon,
  displayName,
  statsKey,
  statusOf,
  filterCards,
  statusCounts,
} = m.exports;

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok   ' + name);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + name + '  =>  ' + e.message);
  }
}

const cards = [
  { taxonId: 1, scientific: 'Danaus plexippus', common: 'Monarch' },
  { taxonId: 2, scientific: 'Danaus gilippus', common: 'Queen' },
  { taxonId: 3, scientific: 'Bombus terrestris', common: 'Buff-tailed Bumblebee' },
  { taxonId: 4, scientific: 'Apis mellifera', common: 'Western Honey Bee' },
  { taxonId: 1, scientific: 'Danaus plexippus', common: 'Monarch' }, // dup taxon
];
// Gameplay tallies keyed by taxonId-as-string (mirrors App.recordResult).
const speciesStats = {
  1: { known: 5, missed: 1 }, // good
  2: { known: 1, missed: 3 }, // missed
  3: { known: 2, missed: 2 }, // missed (tie → missed)
  // taxon 4 absent → new
};

t('genusOf: first word of binomial', () => {
  assert.equal(genusOf({ scientific: 'Danaus plexippus' }), 'Danaus');
  assert.equal(genusOf(null), null);
});

t('uniqueByTaxon: dedupes by taxonId', () => {
  assert.equal(uniqueByTaxon(cards).length, 4);
});

t('displayName: prefers common name', () => {
  assert.equal(displayName({ common: 'Monarch', scientific: 'Danaus plexippus' }), 'Monarch');
  assert.equal(displayName({ scientific: 'Danaus plexippus' }), 'Danaus plexippus');
});

t('statsKey: taxonId as string, falls back to scientific', () => {
  assert.equal(statsKey({ taxonId: 7, scientific: 'X' }), '7');
  assert.equal(statsKey({ scientific: 'X' }), 'X');
});

t('statusOf: good when known > missed', () => {
  assert.equal(statusOf(cards[0], speciesStats), 'good');
});
t('statusOf: missed when missed >= known (played)', () => {
  assert.equal(statusOf(cards[1], speciesStats), 'missed');
  assert.equal(statusOf({ taxonId: 3 }, speciesStats), 'missed'); // tie → missed
});
t('statusOf: new when never played', () => {
  assert.equal(statusOf(cards[3], speciesStats), 'new');
  assert.equal(statusOf({ taxonId: 999 }, {}), 'new');
});

t('filterCards: no filter → all, sorted, deduped', () => {
  const out = filterCards(cards, { speciesStats });
  assert.deepEqual(out.map((c) => c.common), [
    'Buff-tailed Bumblebee',
    'Monarch',
    'Queen',
    'Western Honey Bee',
  ]);
});

t('filterCards: status=good', () => {
  const out = filterCards(cards, { status: 'good', speciesStats });
  assert.deepEqual(out.map((c) => c.taxonId), [1]);
});

t('filterCards: status=missed', () => {
  const out = filterCards(cards, { status: 'missed', speciesStats });
  assert.deepEqual(out.map((c) => c.taxonId).sort(), [2, 3]);
});

t('filterCards: status=new', () => {
  const out = filterCards(cards, { status: 'new', speciesStats });
  assert.deepEqual(out.map((c) => c.taxonId), [4]);
});

t('filterCards: query + status combine', () => {
  // "bee" matches taxa 3 & 4; only 4 is "new".
  const out = filterCards(cards, { query: 'bee', status: 'new', speciesStats });
  assert.deepEqual(out.map((c) => c.taxonId), [4]);
});

t('filterCards: flagged keeps only flagged taxa (Set or array)', () => {
  const flags = new Set(['1', '4']);
  assert.deepEqual(
    filterCards(cards, { flagged: true, flags }).map((c) => c.taxonId).sort(),
    [1, 4]
  );
  // accepts an array of ids too
  assert.deepEqual(
    filterCards(cards, { flagged: true, flags: ['2'] }).map((c) => c.taxonId),
    [2]
  );
  // flagged:false ignores flags entirely
  assert.equal(filterCards(cards, { flagged: false, flags }).length, 4);
});

t('filterCards: flagged combines with query + status', () => {
  const flags = new Set(['1', '2']);
  // status good (taxon 1) ∩ flagged {1,2} = [1]
  assert.deepEqual(
    filterCards(cards, { status: 'good', flagged: true, flags, speciesStats })
      .map((c) => c.taxonId),
    [1]
  );
  // query 'queen' (taxon 2) ∩ flagged {1,2} = [2]
  assert.deepEqual(
    filterCards(cards, { query: 'queen', flagged: true, flags })
      .map((c) => c.taxonId),
    [2]
  );
});

t('filterCards: query matches common and scientific', () => {
  assert.equal(filterCards(cards, { query: 'danaus', speciesStats }).length, 2);
  assert.equal(filterCards(cards, { query: 'honey', speciesStats }).length, 1);
  assert.equal(filterCards(cards, { query: 'zzz', speciesStats }).length, 0);
});

t('statusCounts: tallies each bucket over unique taxa', () => {
  assert.deepEqual(statusCounts(cards, speciesStats), { good: 1, missed: 2, new: 1 });
});

t('statusCounts: empty stats → all new', () => {
  assert.deepEqual(statusCounts(cards, {}), { good: 0, missed: 0, new: 4 });
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
