// Tests for the film strip's card picker in src/recent.js.
//   node scripts/test-recent.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'recent.js');
const code = babel.transformFileSync(file, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, require);
const { recentCards } = m.exports;

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

const card = (id, observedOn, extra = {}) => ({
  taxonId: id,
  image: `photo-${id}.jpg`,
  observedOn,
  ...extra,
});
const ids = (list) => list.map((c) => c.taxonId);

t('takes the newest five, newest first', () => {
  const deck = [
    card(1, '2026-09-01'), card(2, '2026-08-01'), card(3, '2026-09-10'),
    card(4, '2026-07-01'), card(5, '2026-09-05'), card(6, '2026-06-01'),
  ];
  assert.deepEqual(ids(recentCards(deck, 5)), [3, 5, 1, 2, 4]);
});

t('the default is the newest ten', () => {
  // Twelve cards, one a month through 2026: the default drops the two oldest.
  const deck = Array.from({ length: 12 }, (_, i) =>
    card(i + 1, `2026-${String(i + 1).padStart(2, '0')}-01`)
  );
  assert.deepEqual(ids(recentCards(deck)), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
});

t('does not trust the order it was handed', () => {
  // The deck arrives newest-first today, and every filter preserves that — but
  // the strip must be right even if that ever stops being true.
  const deck = [card(1, '2026-01-01'), card(2, '2026-09-09')];
  assert.deepEqual(ids(recentCards(deck, 5)), [2, 1]);
});

t('a card with no photo is not a thumbnail', () => {
  const deck = [
    card(1, '2026-09-10'),
    { taxonId: 2, observedOn: '2026-09-11' }, // no image at all
    { taxonId: 3, observedOn: '2026-09-12', image: '' }, // empty string
    card(4, '2026-09-09'),
  ];
  assert.deepEqual(ids(recentCards(deck, 5)), [1, 4]);
});

t('undated observations are kept, ranked last', () => {
  // observed_on is optional on iNaturalist. Dropping these would empty the
  // strip for someone whose recent sightings happen to carry no date.
  const deck = [card(1, null), card(2, '2026-09-01'), card(3, undefined)];
  assert.deepEqual(ids(recentCards(deck, 5)), [2, 1, 3]);
});

t('undated cards keep the order the deck gave them', () => {
  const deck = [card(7, null), card(8, null), card(9, null)];
  assert.deepEqual(ids(recentCards(deck, 5)), [7, 8, 9]);
});

t('same date keeps the deck order', () => {
  const deck = [card(1, '2026-09-01'), card(2, '2026-09-01'), card(3, '2026-09-01')];
  assert.deepEqual(ids(recentCards(deck, 5)), [1, 2, 3]);
});

t('a short deck returns what there is, not padding', () => {
  assert.equal(recentCards([card(1, '2026-09-01'), card(2, '2026-08-01')], 5).length, 2);
});

t('an empty or junk deck is an empty strip, never a crash', () => {
  assert.deepEqual(recentCards([]), []);
  assert.deepEqual(recentCards(null), []);
  assert.deepEqual(recentCards(undefined), []);
  assert.deepEqual(recentCards([null, undefined, {}]), []);
});

t('it does not reorder the caller\'s array', () => {
  // fullDeck is shared state; sorting it in place would shuffle the deck every
  // mode plays from.
  const deck = [card(1, '2026-01-01'), card(2, '2026-09-09')];
  const before = ids(deck);
  recentCards(deck, 5);
  assert.deepEqual(ids(deck), before);
});

t('a silly count degrades to an empty strip rather than throwing', () => {
  const deck = [card(1, '2026-09-01')];
  assert.deepEqual(recentCards(deck, 0), []);
  assert.deepEqual(recentCards(deck, -3), []);
  assert.deepEqual(recentCards(deck, 'five'), []);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
