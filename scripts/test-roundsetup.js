// Tests for the remembered round setup in src/roundsetup.js.
//   node scripts/test-roundsetup.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'roundsetup.js');
const code = babel.transformFileSync(file, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, require);
const {
  DEFAULT_COUNT,
  MAX,
  restoreGroups,
  restoreTypes,
  restoreCount,
  packSetup,
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

const ALL_GROUPS = ['Aves', 'Insecta', 'Plantae'];
const ALL_TYPES = ['picture', 'name', 'pair', 'typed'];

// --- restoreGroups ---

t('restoreGroups: nothing saved selects every group', () => {
  assert.deepEqual(restoreGroups(null, ALL_GROUPS), ALL_GROUPS);
  assert.deepEqual(restoreGroups({}, ALL_GROUPS), ALL_GROUPS);
});

t('restoreGroups: null means all, including groups added since', () => {
  // The whole reason "everything" is stored as null: a deck that gains a group
  // should still play all of it.
  assert.deepEqual(restoreGroups({ groups: null }, ALL_GROUPS), ALL_GROUPS);
});

t('restoreGroups: a saved subset comes back', () => {
  assert.deepEqual(restoreGroups({ groups: ['Aves'] }, ALL_GROUPS), ['Aves']);
});

t('restoreGroups: groups the deck no longer has are dropped', () => {
  assert.deepEqual(restoreGroups({ groups: ['Aves', 'Fungi'] }, ALL_GROUPS), ['Aves']);
});

t('restoreGroups: falls back to all when nothing saved survives', () => {
  // Opening on an unstartable picker would read as the screen being broken.
  assert.deepEqual(restoreGroups({ groups: ['Fungi'] }, ALL_GROUPS), ALL_GROUPS);
  assert.deepEqual(restoreGroups({ groups: [] }, ALL_GROUPS), ALL_GROUPS);
});

t('restoreGroups: junk in storage degrades to all', () => {
  assert.deepEqual(restoreGroups({ groups: 'Aves' }, ALL_GROUPS), ALL_GROUPS);
  assert.deepEqual(restoreGroups({ groups: [1, 2] }, ALL_GROUPS), ALL_GROUPS);
});

// --- restoreTypes ---

t('restoreTypes: a single saved type comes back (the By name round)', () => {
  assert.deepEqual(restoreTypes({ types: ['name'] }, ALL_TYPES), ['name']);
});

t('restoreTypes: no question types offered means nothing to restore', () => {
  // Flash cards and the other single-question modes share this picker.
  assert.deepEqual(restoreTypes({ types: ['name'] }, []), []);
});

t('restoreTypes: a type that cannot run now is dropped', () => {
  // Offline, the photo grid needs four other species' pictures fetched live.
  assert.deepEqual(restoreTypes({ types: ['name', 'picture'] }, ALL_TYPES, ['picture']), ['name']);
});

t('restoreTypes: an all-unavailable selection falls back to what CAN run', () => {
  // Never the whole list: it would put the impossible type straight back.
  assert.deepEqual(
    restoreTypes({ types: ['picture'] }, ALL_TYPES, ['picture']),
    ['name', 'pair', 'typed']
  );
  assert.deepEqual(restoreTypes(null, ALL_TYPES, ['picture']), ['name', 'pair', 'typed']);
});

t('restoreTypes: unknown types are dropped, all-gone falls back to all', () => {
  assert.deepEqual(restoreTypes({ types: ['name', 'morse'] }, ALL_TYPES), ['name']);
  assert.deepEqual(restoreTypes({ types: ['morse'] }, ALL_TYPES), ALL_TYPES);
});

// --- restoreCount ---

t('restoreCount: nothing saved opens on the default', () => {
  assert.equal(restoreCount(null, 200), DEFAULT_COUNT);
});

t('restoreCount: max re-resolves against the deck of the day', () => {
  // Saved when the deck held 143; the deck has since grown.
  assert.equal(restoreCount({ count: MAX }, 143), 143);
  assert.equal(restoreCount({ count: MAX }, 400), 400);
});

t('restoreCount: a saved number is clamped to what is available', () => {
  assert.equal(restoreCount({ count: 32 }, 200), 32);
  assert.equal(restoreCount({ count: 200 }, 40), 40);
});

t('restoreCount: never returns zero, however small the deck', () => {
  assert.equal(restoreCount({ count: MAX }, 0), 1);
  assert.equal(restoreCount(null, 0), 1);
  assert.equal(restoreCount({ count: -5 }, 20), DEFAULT_COUNT);
  assert.equal(restoreCount({ count: 'lots' }, 20), DEFAULT_COUNT);
});

t('restoreCount: the default is itself clamped on a tiny deck', () => {
  assert.equal(restoreCount(null, 5), 5);
});

// --- packSetup ---

t('packSetup: everything selected collapses to intentions', () => {
  const s = packSetup({
    groups: ALL_GROUPS, allGroups: ALL_GROUPS,
    types: ALL_TYPES, allTypes: ALL_TYPES,
    count: 200, available: 200, flaggedOnly: false,
  });
  assert.deepEqual(s, { groups: null, types: null, count: MAX, flaggedOnly: false });
});

t('packSetup: a narrowed selection is stored as itself', () => {
  const s = packSetup({
    groups: ['Aves'], allGroups: ALL_GROUPS,
    types: ['name'], allTypes: ALL_TYPES,
    count: 32, available: 200, flaggedOnly: true,
  });
  assert.deepEqual(s, { groups: ['Aves'], types: ['name'], count: 32, flaggedOnly: true });
});

t('packSetup: a count at the ceiling is max, not a number', () => {
  assert.equal(packSetup({ count: 40, available: 40 }).count, MAX);
  assert.equal(packSetup({ count: 39, available: 40 }).count, 39);
});

t('packSetup: no question types offered stores none', () => {
  assert.equal(packSetup({ types: [], allTypes: [] }).types, null);
});

t('packSetup → restore round-trips the By name round', () => {
  // The round this whole change exists to preserve: name questions, whole deck.
  const saved = packSetup({
    groups: ALL_GROUPS, allGroups: ALL_GROUPS,
    types: ['name'], allTypes: ALL_TYPES,
    count: 143, available: 143, flaggedOnly: false,
  });
  assert.deepEqual(restoreGroups(saved, ALL_GROUPS), ALL_GROUPS);
  assert.deepEqual(restoreTypes(saved, ALL_TYPES), ['name']);
  assert.equal(restoreCount(saved, 190), 190); // deck grew; still the whole deck
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
