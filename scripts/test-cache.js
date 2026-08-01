// Tests for the pure cache/sync helpers in src/api.js and src/storage.js.
// Transpiles the ESM modules to CommonJS in memory (no bundler).
//   node scripts/test-cache.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

// A stateful in-memory kv backend, for tests that actually read back what they
// wrote (e.g. the data-version migration runner).
function memKv() {
  const store = new Map();
  return {
    getItem: async (k) => (store.has(k) ? store.get(k) : null),
    setItem: async (k, v) => { store.set(k, String(v)); },
    removeItem: async (k) => { store.delete(k); },
    multiRemove: async (ks) => { (ks || []).forEach((k) => store.delete(k)); },
  };
}

function load(rel, kvImpl) {
  const file = path.join(__dirname, '..', rel);
  const code = babel.transformFileSync(file, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const m = { exports: {} };
  // Stub out RN-only deps so storage.js can load in Node. src/kv.js is the
  // key-value seam storage.js goes through; it imports AsyncStorage at module
  // scope, which does not exist outside a React Native runtime. (These tests
  // only exercise pure helpers like cacheMatches, so no-op methods suffice —
  // scripts/test-sync-integration.js is the one that drives real reads/writes,
  // via kv's own in-memory backend.)
  const fakeRequire = (id) => {
    if (id === '@react-native-async-storage/async-storage') {
      return { default: {} };
    }
    if (id === './kv' || id === '../kv') {
      return (
        kvImpl || {
          getItem: async () => null,
          setItem: async () => {},
          removeItem: async () => {},
          multiRemove: async () => {},
        }
      );
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
t('applyFilters: researchGrade keeps community-verified at any rank', () => {
  // Research grade is a quality signal, not a rank one: a research-grade genus
  // (community agreed it can't be improved) must be kept, not dropped.
  const cards = [
    card({ id: 'a', qualityGrade: 'research', rank: 'species' }),
    card({ id: 'b', qualityGrade: 'needs_id', rank: 'species', taxonId: 11 }),
    card({ id: 'c', qualityGrade: 'research', rank: 'genus', taxonId: 12 }),
  ];
  const out = applyFilters(cards, { researchGrade: true });
  assert.deepEqual(out.map((c) => c.id).sort(), ['a', 'c']); // both research-grade
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
t('applyFilters: researchGrade + speciesOnly compose (research AND species)', () => {
  // The two filters are orthogonal; together they keep only cards that are both
  // community-verified AND identified to an exact species.
  const cards = [
    card({ id: 'a', rank: 'species', qualityGrade: 'research' }),               // both → kept
    card({ id: 'b', rank: 'species', taxonId: 11, qualityGrade: 'needs_id' }),  // not research → dropped
    card({ id: 'c', rank: 'genus', taxonId: 12, qualityGrade: 'research' }),    // not species → dropped
  ];
  const out = applyFilters(cards, { researchGrade: true, speciesOnly: true });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, 'a');
});
t('applyFilters: namedOnly keeps cards with a localized common name', () => {
  // A card's `common` is null when iNaturalist has no name for that taxon in the
  // selected language, so it would show only its scientific name. namedOnly drops
  // exactly those.
  const cards = [
    card({ id: 'a', taxonId: 10, common: 'Gőte' }),  // has a Hungarian name → kept
    card({ id: 'b', taxonId: 11, common: null }),     // no localized name → dropped
    card({ id: 'c', taxonId: 12, common: '' }),       // empty is not a name → dropped
  ];
  const out = applyFilters(cards, { namedOnly: true });
  assert.deepEqual(out.map((c) => c.id), ['a']);
});
t('applyFilters: namedOnly composes with the other filters', () => {
  const cards = [
    card({ id: 'a', taxonId: 10, rank: 'species', qualityGrade: 'research', common: 'Named' }), // all → kept
    card({ id: 'b', taxonId: 11, rank: 'species', qualityGrade: 'research', common: null }),    // unnamed → dropped
    card({ id: 'c', taxonId: 12, rank: 'genus', qualityGrade: 'research', common: 'Named' }),   // not species → dropped
  ];
  const out = applyFilters(cards, { researchGrade: true, speciesOnly: true, namedOnly: true });
  assert.deepEqual(out.map((c) => c.id), ['a']);
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
t('mergeCards: a just-changed OLD card survives the cap (new ID on old obs)', () => {
  // Cache already at the cap with the newest-observed cards.
  const a = [
    card({ id: '1', observedOn: '2024-03-01' }),
    card({ id: '2', observedOn: '2024-02-01' }),
    card({ id: '3', observedOn: '2024-01-15' }),
  ];
  // An old observation just got an identification (so it comes back in `incoming`).
  const b = [card({ id: '9', observedOn: '2010-01-01', scientific: 'Newly IDed' })];
  const out = mergeCards(a, b, 3);
  assert.equal(out.length, 3);
  assert.ok(out.some((c) => c.id === '9')); // the change is kept, not dropped
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

// --- runDataMigrations (local data versioning) ---
// Needs a stateful kv so the stamped version can be read back.
async function tAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log('  ok   ' + name);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + name + '  =>  ' + e.message);
  }
}

async function asyncTests() {
  await tAsync('loadDataVersion is 0 on a fresh store', async () => {
    const s = load('src/storage.js', memKv());
    assert.equal(await s.loadDataVersion(), 0);
  });
  await tAsync('runDataMigrations stamps DATA_VERSION and reports it', async () => {
    const s = load('src/storage.js', memKv());
    const v = await s.runDataMigrations();
    assert.equal(v, s.DATA_VERSION);
    assert.equal(await s.loadDataVersion(), s.DATA_VERSION);
  });
  await tAsync('runDataMigrations is idempotent', async () => {
    const s = load('src/storage.js', memKv());
    await s.runDataMigrations();
    await s.runDataMigrations();
    assert.equal(await s.loadDataVersion(), s.DATA_VERSION);
  });
  await tAsync('a device already at the current version is left at it', async () => {
    const kvImpl = memKv();
    await kvImpl.setItem('@gote/dataVersion', String(load('src/storage.js', kvImpl).DATA_VERSION));
    const s = load('src/storage.js', kvImpl);
    assert.equal(await s.runDataMigrations(), s.DATA_VERSION);
  });

  // --- downloaded-image manifest (offline deck filter) ---
  await tAsync('downloaded manifest is empty on a fresh store', async () => {
    const s = load('src/storage.js', memKv());
    assert.deepEqual(await s.loadDownloadedImages(), []);
  });
  await tAsync('addDownloadedImages persists + dedupes', async () => {
    const s = load('src/storage.js', memKv());
    await s.addDownloadedImages(['a', 'b']);
    await s.addDownloadedImages(['b', 'c', '', null]); // dupe + blanks ignored
    assert.deepEqual((await s.loadDownloadedImages()).sort(), ['a', 'b', 'c']);
  });
  await tAsync('addDownloadedImages caps to the newest entries', async () => {
    const s = load('src/storage.js', memKv());
    const many = Array.from({ length: 1600 }, (_, i) => 'u' + i);
    await s.addDownloadedImages(many);
    const kept = await s.loadDownloadedImages();
    assert.equal(kept.length, 1500);
    assert.ok(kept.includes('u1599')); // the newest survives
    assert.ok(!kept.includes('u0')); // the oldest is dropped
  });
  await tAsync('clearDownloadedImages empties the manifest', async () => {
    const s = load('src/storage.js', memKv());
    await s.addDownloadedImages(['a', 'b']);
    await s.clearDownloadedImages();
    assert.deepEqual(await s.loadDownloadedImages(), []);
  });

  // --- confusion matrix ---
  await tAsync('confusions are empty on a fresh store', async () => {
    const s = load('src/storage.js', memKv());
    assert.deepEqual(await s.loadConfusions(), {});
  });
  await tAsync('confusions round-trip through storage', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveConfusions({ A: { B: 2 }, C: { D: 1 } });
    assert.deepEqual(await s.loadConfusions(), { A: { B: 2 }, C: { D: 1 } });
  });

  // --- confusion notes ("my tell") — canonical { text, t } shape for sync ---
  await tAsync('confusion notes are empty on a fresh store', async () => {
    const s = load('src/storage.js', memKv());
    assert.deepEqual(await s.loadConfusionNotes(), {});
  });
  await tAsync('saveConfusionNote stores a trimmed, timestamped note', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveConfusionNote('A B', '  toothed leaves  ', 1234);
    assert.deepEqual(await s.loadConfusionNotes(), { 'A B': { text: 'toothed leaves', t: 1234 } });
  });
  await tAsync('a blank note becomes a tombstone (kept so the delete syncs)', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveConfusionNote('A B', 'note', 1);
    await s.saveConfusionNote('A B', '   ', 2);
    assert.deepEqual(await s.loadConfusionNotes(), { 'A B': { text: '', t: 2 } });
  });
  await tAsync('a legacy bare-string note upcasts to { text, t: 0 }', async () => {
    const kv = memKv();
    await kv.setItem('@gote/confusionNotes', JSON.stringify({ 'A B': 'old note' }));
    const s = load('src/storage.js', kv);
    assert.deepEqual(await s.loadConfusionNotes(), { 'A B': { text: 'old note', t: 0 } });
  });
  await tAsync('saveConfusionNotes overwrites the whole map', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveConfusionNotes({ 'C D': { text: 'grey bill', t: 7 } });
    assert.deepEqual(await s.loadConfusionNotes(), { 'C D': { text: 'grey bill', t: 7 } });
  });

  // --- confusion wins ("verify the fix" recovery streaks) ---
  await tAsync('confusion wins are empty on a fresh store', async () => {
    const s = load('src/storage.js', memKv());
    assert.deepEqual(await s.loadConfusionWins(), {});
  });
  await tAsync('confusion wins round-trip through storage', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveConfusionWins({ 'A B': 4, 'C D': 1 });
    assert.deepEqual(await s.loadConfusionWins(), { 'A B': 4, 'C D': 1 });
  });

  // --- flags — canonical { [taxonId]: { on, t } } per username, for sync ---
  await tAsync('saveFlag stores a timestamped, per-account flag', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveFlag('leo', 10, true, 1234);
    assert.deepEqual(await s.loadFlagsRecord('leo'), { 10: { on: true, t: 1234 } });
    assert.deepEqual(await s.loadFlags('leo'), ['10']);
  });
  await tAsync('unflagging keeps a tombstone (so the change syncs)', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveFlag('leo', 10, true, 1);
    await s.saveFlag('leo', 10, false, 2);
    assert.deepEqual(await s.loadFlagsRecord('leo'), { 10: { on: false, t: 2 } });
    assert.deepEqual(await s.loadFlags('leo'), []); // display drops tombstones
  });
  await tAsync('flags are scoped per username', async () => {
    const s = load('src/storage.js', memKv());
    await s.saveFlag('leo', 10, true, 1);
    await s.saveFlag('ada', 20, true, 1);
    assert.deepEqual(await s.loadFlags('leo'), ['10']);
    assert.deepEqual(await s.loadFlags('ada'), ['20']);
  });
  await tAsync('a legacy array of ids upcasts to { on, t: 0 }', async () => {
    const kv = memKv();
    await kv.setItem('@gote/flags', JSON.stringify({ leo: ['10', '20'] }));
    const s = load('src/storage.js', kv);
    assert.deepEqual(await s.loadFlagsRecord('leo'), { 10: { on: true, t: 0 }, 20: { on: true, t: 0 } });
    assert.deepEqual((await s.loadFlags('leo')).sort(), ['10', '20']);
  });
  await tAsync('the pre-1.8.1 global flat list folds into the first account', async () => {
    const kv = memKv();
    await kv.setItem('@gote/flags', JSON.stringify(['10', '20']));
    const s = load('src/storage.js', kv);
    assert.deepEqual((await s.loadFlags('leo')).sort(), ['10', '20']);
  });
}

asyncTests().then(() => {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
});
