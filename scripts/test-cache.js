// Tests for the pure cache/sync helpers in src/api.js and src/storage.js.
// Transpiles the ESM modules to CommonJS in memory (no bundler).
//   node scripts/test-cache.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

function load(rel) {
  const file = path.join(__dirname, '..', rel);
  const code = babel.transformFileSync(file, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const m = { exports: {} };
  // Stub out RN-only deps (AsyncStorage) so storage.js can load in Node.
  const fakeRequire = (id) => {
    if (id === '@react-native-async-storage/async-storage') {
      return { default: {} };
    }
    // E2E-only modules (ESM); api.js only touches them when IS_E2E is true.
    if (id === './e2e/testMode') return { IS_E2E: false };
    if (id === './e2e/fixtures') return {};
    return require(id);
  };
  new Function('module', 'exports', 'require', code)(m, m.exports, fakeRequire);
  return m.exports;
}

const api = load('src/api.js');
const storage = load('src/storage.js');
const { applyFilters, mergeCards, newestUpdatedAt } = api;
const { cacheMatches } = storage;

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

const card = (over = {}) => ({
  id: '1',
  taxonId: 10,
  scientific: 'Sci',
  rank: 'species',
  qualityGrade: 'research',
  observedOn: '2024-01-01',
  updatedAt: '2024-01-01T00:00:00Z',
  ...over,
});

// --- applyFilters ---
t('applyFilters: passthrough when no filters', () => {
  const cards = [card({ id: 'a' }), card({ id: 'b', taxonId: 11 })];
  assert.equal(applyFilters(cards, {}).length, 2);
});
t('applyFilters: perSpecies keeps one per taxon', () => {
  const cards = [
    card({ id: 'a', taxonId: 10 }),
    card({ id: 'b', taxonId: 10 }),
    card({ id: 'c', taxonId: 20 }),
  ];
  const out = applyFilters(cards, { perSpecies: true });
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((c) => c.taxonId), [10, 20]);
});
t('applyFilters: researchGrade drops non-research / non-species', () => {
  const cards = [
    card({ id: 'a', qualityGrade: 'research', rank: 'species' }),
    card({ id: 'b', qualityGrade: 'needs_id', rank: 'species', taxonId: 11 }),
    card({ id: 'c', qualityGrade: 'research', rank: 'genus', taxonId: 12 }),
  ];
  const out = applyFilters(cards, { researchGrade: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'a');
});
t('applyFilters: combined research + perSpecies', () => {
  const cards = [
    card({ id: 'a', taxonId: 10, qualityGrade: 'research' }),
    card({ id: 'b', taxonId: 10, qualityGrade: 'research' }),
    card({ id: 'c', taxonId: 20, qualityGrade: 'needs_id' }),
  ];
  const out = applyFilters(cards, { perSpecies: true, researchGrade: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'a');
});
t('applyFilters: speciesOnly keeps any-grade species, drops coarser ranks', () => {
  const cards = [
    card({ id: 'a', rank: 'species', qualityGrade: 'needs_id' }),
    card({ id: 'b', rank: 'genus', taxonId: 11, qualityGrade: 'research' }),
    card({ id: 'c', rank: 'species', taxonId: 12, qualityGrade: 'casual' }),
  ];
  const out = applyFilters(cards, { speciesOnly: true });
  assert.deepEqual(out.map((c) => c.id).sort(), ['a', 'c']);
});
t('applyFilters: speciesOnly uses rankLevel (subspecies kept, genus dropped)', () => {
  const cards = [
    card({ id: 'sp', taxonId: 1, rank: 'species', rankLevel: 10 }),
    card({ id: 'ssp', taxonId: 2, rank: 'subspecies', rankLevel: 5 }),
    card({ id: 'gen', taxonId: 3, rank: 'genus', rankLevel: 20 }),
    card({ id: 'fam', taxonId: 4, rank: 'family', rankLevel: 30 }),
  ];
  const out = applyFilters(cards, { perSpecies: false, speciesOnly: true });
  assert.deepEqual(out.map((c) => c.id).sort(), ['sp', 'ssp']); // <=10 kept
});
t('applyFilters: speciesOnly falls back to rank string when rankLevel missing', () => {
  const cards = [
    card({ id: 'a', taxonId: 1, rank: 'species' }), // no rankLevel
    card({ id: 'b', taxonId: 2, rank: 'genus' }),
  ];
  const out = applyFilters(cards, { perSpecies: false, speciesOnly: true });
  assert.deepEqual(out.map((c) => c.id), ['a']);
});
t('applyFilters: researchGrade takes precedence over speciesOnly', () => {
  const cards = [
    card({ id: 'a', rank: 'species', qualityGrade: 'research' }),
    card({ id: 'b', rank: 'species', taxonId: 11, qualityGrade: 'needs_id' }),
  ];
  // Both flags on → research-grade is the stricter one and wins.
  const out = applyFilters(cards, { researchGrade: true, speciesOnly: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'a');
});
t('applyFilters: does not mutate input', () => {
  const cards = [card({ id: 'a', taxonId: 10 }), card({ id: 'b', taxonId: 10 })];
  const copy = JSON.parse(JSON.stringify(cards));
  applyFilters(cards, { perSpecies: true });
  assert.deepEqual(cards, copy);
});

// --- mergeCards ---
t('mergeCards: adds new ids', () => {
  const a = [card({ id: '1' })];
  const b = [card({ id: '2', observedOn: '2024-02-01' })];
  const out = mergeCards(a, b);
  assert.equal(out.length, 2);
});
t('mergeCards: incoming overwrites existing by id', () => {
  const a = [card({ id: '1', scientific: 'Old' })];
  const b = [card({ id: '1', scientific: 'New' })];
  const out = mergeCards(a, b);
  assert.equal(out.length, 1);
  assert.equal(out[0].scientific, 'New');
});
t('mergeCards: sorted newest observedOn first', () => {
  const a = [card({ id: '1', observedOn: '2024-01-01' })];
  const b = [
    card({ id: '2', observedOn: '2024-03-01' }),
    card({ id: '3', observedOn: '2024-02-01' }),
  ];
  const out = mergeCards(a, b);
  assert.deepEqual(out.map((c) => c.id), ['2', '3', '1']);
});
t('mergeCards: caps to max', () => {
  const a = Array.from({ length: 5 }, (_, i) =>
    card({ id: String(i), observedOn: `2024-01-0${i + 1}` })
  );
  const out = mergeCards(a, [], 3);
  assert.equal(out.length, 3);
});

// --- newestUpdatedAt ---
t('newestUpdatedAt: picks max ISO timestamp', () => {
  const cards = [
    card({ id: '1', updatedAt: '2024-01-01T00:00:00Z' }),
    card({ id: '2', updatedAt: '2024-05-01T00:00:00Z' }),
    card({ id: '3', updatedAt: '2024-03-01T00:00:00Z' }),
  ];
  assert.equal(newestUpdatedAt(cards), '2024-05-01T00:00:00Z');
});
t('newestUpdatedAt: null when none present', () => {
  assert.equal(newestUpdatedAt([card({ updatedAt: null })]), null);
});
t('newestUpdatedAt: compares by real time across timezones', () => {
  // 18:00Z is LATER than 11:25-07:00 (=18:25Z)? No: 11:25-07:00 == 18:25Z,
  // which is later than 18:00Z. A naive string compare would pick "18:00Z".
  const cards = [
    card({ id: '1', updatedAt: '2026-06-01T18:00:00Z' }),
    card({ id: '2', updatedAt: '2026-06-01T11:25:00-07:00' }),
  ];
  assert.equal(newestUpdatedAt(cards), '2026-06-01T11:25:00-07:00');
});
t('newestUpdatedAt: ignores unparseable timestamps', () => {
  const cards = [
    card({ id: '1', updatedAt: 'not-a-date' }),
    card({ id: '2', updatedAt: '2024-01-01T00:00:00Z' }),
  ];
  assert.equal(newestUpdatedAt(cards), '2024-01-01T00:00:00Z');
});

// --- cacheMatches ---
// `version` must equal the current CACHE_VERSION in src/storage.js. We read it
// indirectly: a cache that otherwise matches but with a far-future version is
// rejected, while the "current" version is whatever cacheMatches accepts. To
// stay robust against version bumps, discover it by probing.
function currentCacheVersion() {
  for (let v = 1; v <= 50; v += 1) {
    if (cacheMatches({ version: v, username: 'x', locale: 'en', cards: [card()] }, 'x', 'en')) {
      return v;
    }
  }
  throw new Error('could not determine CACHE_VERSION');
}
const goodCache = {
  version: currentCacheVersion(),
  username: 'kueda',
  locale: 'en',
  cards: [card()],
};
t('cacheMatches: true for matching account', () => {
  assert.equal(cacheMatches(goodCache, 'kueda', 'en'), true);
});
t('cacheMatches: false on username mismatch', () => {
  assert.equal(cacheMatches(goodCache, 'other', 'en'), false);
});
t('cacheMatches: false on locale mismatch', () => {
  assert.equal(cacheMatches(goodCache, 'kueda', 'es'), false);
});
t('cacheMatches: false on empty cards', () => {
  assert.equal(cacheMatches({ ...goodCache, cards: [] }, 'kueda', 'en'), false);
});
t('cacheMatches: false on version mismatch', () => {
  assert.equal(cacheMatches({ ...goodCache, version: 999 }, 'kueda', 'en'), false);
});
t('cacheMatches: false for null cache', () => {
  assert.equal(cacheMatches(null, 'kueda', 'en'), false);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
