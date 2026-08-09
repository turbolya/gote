// Tests for sanitizeEvent (src/sync/outbox.js).
//
// Why this one function gets its own file: the `events` table carries CHECK
// constraints (answered >= 0, correct >= 0, pct null or 0..100) and Postgres
// refuses a violating row with SQLSTATE 23514 — permanently, not transiently.
// The whole outbox is pushed as ONE statement, so a single unacceptable row
// used to stop every other round uploading too, forever, while the screen said
// only "N rounds waiting to upload". This is the guard that stops such a row
// ever being created.
//
//   node scripts/test-outbox.js   (or via: npm test)

const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

// outbox.js reads and writes through src/kv.js, which imports AsyncStorage and
// therefore cannot be loaded by plain node. Transform to CJS and stub kv — the
// function under test touches none of it, but the module-level import runs.
function loadOutbox() {
  const file = path.join(__dirname, '..', 'src/sync/outbox.js');
  const code = babel.transformFileSync(file, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const m = { exports: {} };
  const stub = {
    __esModule: true,
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
    multiRemove: async () => {},
    getAllKeys: async () => [],
  };
  const fakeRequire = (id) => {
    if (id === '../kv') return stub;
    // outbox.js folds its overflow with merge.js (compactEvents), which is ESM
    // like everything else in the sync layer — transform it through the same
    // path rather than letting require() choke on it.
    if (id === './merge') {
      const mergeCode = babel.transformFileSync(path.join(__dirname, '..', 'src/sync/merge.js'), {
        plugins: ['@babel/plugin-transform-modules-commonjs'],
      }).code;
      const mm = { exports: {} };
      new Function('module', 'exports', 'require', mergeCode)(mm, mm.exports, require);
      return mm.exports;
    }
    return require(id);
  };
  new Function('module', 'exports', 'require', code)(m, m.exports, fakeRequire);
  return m.exports;
}

const { sanitizeEvent } = loadOutbox();

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ', name);
  } catch (e) {
    fail++;
    console.log('  FAIL', name, '\n       ', e.message);
  }
}

console.log('\nsanitizeEvent: never build a row the database must reject\n');

test('an ordinary round passes through untouched', () => {
  const e = sanitizeEvent({ answered: 12, correct: 9, pct: 75, n: 12 });
  assert.strictEqual(e.answered, 12);
  assert.strictEqual(e.correct, 9);
  assert.strictEqual(e.pct, 75);
  assert.strictEqual(e.n, 12);
});

test('every other field is preserved', () => {
  const e = sanitizeEvent({
    id: 'abc', device_id: 'dev', ts: 'T', local_day: '2026-08-09',
    species: { 1: { known: 1 } }, formats: { name: {} }, confusions: { a: 1 },
    history: [50], counts: [4], days: ['2026-08-09'],
  });
  assert.strictEqual(e.id, 'abc');
  assert.strictEqual(e.local_day, '2026-08-09');
  assert.deepStrictEqual(e.species, { 1: { known: 1 } });
  assert.deepStrictEqual(e.days, ['2026-08-09']);
});

test('negative counters are floored at zero (check_violation)', () => {
  const e = sanitizeEvent({ answered: -3, correct: -1, n: -5 });
  assert.strictEqual(e.answered, 0);
  assert.strictEqual(e.correct, 0);
  assert.strictEqual(e.n, 0);
});

test('pct is held inside 0..100', () => {
  assert.strictEqual(sanitizeEvent({ pct: 120 }).pct, 100);
  assert.strictEqual(sanitizeEvent({ pct: -4 }).pct, 0);
  assert.strictEqual(sanitizeEvent({ pct: 0 }).pct, 0);
  assert.strictEqual(sanitizeEvent({ pct: 100 }).pct, 100);
});

test('a null pct stays null — it means "not a round", not zero', () => {
  // A single watch answer sends no pct. Turning that into 0 would draw a
  // zero-accuracy bar on every device's chart.
  assert.strictEqual(sanitizeEvent({ pct: null }).pct, null);
  assert.strictEqual(sanitizeEvent({}).pct, null);
  assert.strictEqual(sanitizeEvent({ pct: undefined }).pct, null);
});

test('NaN and Infinity become zero rather than invalid JSON numbers', () => {
  // JSON.stringify turns these into null, which the NOT NULL columns refuse.
  const e = sanitizeEvent({ answered: NaN, correct: Infinity, n: -Infinity });
  assert.strictEqual(e.answered, 0);
  assert.strictEqual(e.correct, 0);
  assert.strictEqual(e.n, 0);
  assert.strictEqual(sanitizeEvent({ pct: NaN }).pct, 0);
});

test('fractional counters are rounded to integers', () => {
  // The columns are `integer`; a float is an invalid_text_representation.
  const e = sanitizeEvent({ answered: 3.7, correct: 2.2, n: 4.5, pct: 66.6 });
  assert.strictEqual(e.answered, 4);
  assert.strictEqual(e.correct, 2);
  assert.strictEqual(e.n, 5);
  assert.strictEqual(e.pct, 67);
});

test('numeric strings are coerced, not passed through', () => {
  const e = sanitizeEvent({ answered: '8', correct: '5', pct: '90' });
  assert.strictEqual(e.answered, 8);
  assert.strictEqual(e.correct, 5);
  assert.strictEqual(e.pct, 90);
});

test('junk coerces to zero instead of throwing', () => {
  const e = sanitizeEvent({ answered: 'x', correct: {}, n: [], pct: 'nope' });
  assert.strictEqual(e.answered, 0);
  assert.strictEqual(e.correct, 0);
  assert.strictEqual(e.n, 0);
  assert.strictEqual(e.pct, 0);
});

test('no argument at all still yields an acceptable row', () => {
  const e = sanitizeEvent();
  assert.strictEqual(e.answered, 0);
  assert.strictEqual(e.correct, 0);
  assert.strictEqual(e.n, 0);
  assert.strictEqual(e.pct, null);
});

test('the result always satisfies the table CHECK constraints', () => {
  const nasty = [
    { answered: -1 }, { correct: -99 }, { pct: 101 }, { pct: -1 },
    { answered: NaN }, { pct: Infinity }, { n: -2 }, { answered: '-7' },
  ];
  for (const input of nasty) {
    const e = sanitizeEvent(input);
    assert.ok(e.answered >= 0 && Number.isInteger(e.answered), `answered: ${JSON.stringify(input)}`);
    assert.ok(e.correct >= 0 && Number.isInteger(e.correct), `correct: ${JSON.stringify(input)}`);
    assert.ok(e.n >= 0 && Number.isInteger(e.n), `n: ${JSON.stringify(input)}`);
    assert.ok(e.pct === null || (e.pct >= 0 && e.pct <= 100), `pct: ${JSON.stringify(input)}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
