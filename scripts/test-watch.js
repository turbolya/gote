// Tests for the storage behaviour the Apple Watch stat-sync relies on:
//   • recordStreakDay's no-rewind guard (late-synced watch results must never
//     rewind or reset the streak), plus its normal same-day / next-day / gap
//     transitions.
//   • the exact storage sequence one wrist round produces (addToStats per
//     answer + addGameResult for the round) lands the right lifetime totals
//     and history.
//   node scripts/test-watch.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

// Stateful in-memory AsyncStorage mock (the real thing is native-only). Just
// the getItem/setItem/removeItem/multiRemove that storage.js uses.
function makeAsyncStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    async getItem(k) {
      return store.has(k) ? store.get(k) : null;
    },
    async setItem(k, v) {
      store.set(k, v);
    },
    async removeItem(k) {
      store.delete(k);
    },
    async multiRemove(keys) {
      keys.forEach((k) => store.delete(k));
    },
    _store: store,
  };
}

function loadStorage(asyncStorage) {
  const file = path.join(__dirname, '..', 'src/storage.js');
  const code = babel.transformFileSync(file, {
    plugins: ['@babel/plugin-transform-modules-commonjs'],
  }).code;
  const m = { exports: {} };
  const fakeRequire = (id) => {
    if (id === '@react-native-async-storage/async-storage') {
      // __esModule so Babel's _interopRequireDefault keeps `.default` as our
      // mock rather than double-wrapping it (which would make getItem undefined).
      return { __esModule: true, default: asyncStorage };
    }
    return require(id);
  };
  new Function('module', 'exports', 'require', code)(m, m.exports, fakeRequire);
  return m.exports;
}

let pass = 0;
let fail = 0;
const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push(`  ok   ${name}`);
    pass++;
  } catch (e) {
    results.push(`  FAIL ${name}\n       ${e.message}`);
    fail++;
  }
}

// A fixed "today" so day-key math is deterministic regardless of when this runs.
const TODAY = new Date('2026-07-16T12:00:00').getTime();
const DAY = 24 * 60 * 60 * 1000;

(async () => {
  // --- streak no-rewind guard -------------------------------------------------
  await test('recordStreakDay: a result dated BEFORE lastActiveDay is ignored', async () => {
    const as = makeAsyncStorage();
    const s = loadStorage(as);
    // Establish "played today" at a 5-day streak.
    await as.setItem(
      '@gote/streak',
      JSON.stringify({ current: 5, longest: 5, lastActiveDay: '2026-07-16' })
    );
    // A watch result from YESTERDAY arrives late.
    const out = await s.recordStreakDay(TODAY - DAY);
    assert.strictEqual(out.current, 5, 'streak must not rewind');
    assert.strictEqual(out.longest, 5);
    assert.strictEqual(out.lastActiveDay, '2026-07-16', 'lastActiveDay must not move back');
  });

  await test('recordStreakDay: a same-day result is idempotent (no double count)', async () => {
    const as = makeAsyncStorage();
    const s = loadStorage(as);
    await as.setItem(
      '@gote/streak',
      JSON.stringify({ current: 5, longest: 7, lastActiveDay: '2026-07-16' })
    );
    const out = await s.recordStreakDay(TODAY);
    assert.strictEqual(out.current, 5, 'same-day replay keeps the count');
    assert.strictEqual(out.longest, 7);
  });

  await test('recordStreakDay: a next-day result advances the streak', async () => {
    const as = makeAsyncStorage();
    const s = loadStorage(as);
    await as.setItem(
      '@gote/streak',
      JSON.stringify({ current: 5, longest: 5, lastActiveDay: '2026-07-15' })
    );
    const out = await s.recordStreakDay(TODAY);
    assert.strictEqual(out.current, 6, 'continued streak increments');
    assert.strictEqual(out.longest, 6, 'longest tracks the new high');
    assert.strictEqual(out.lastActiveDay, '2026-07-16');
  });

  await test('recordStreakDay: a gap (2+ days) restarts at 1 but keeps longest', async () => {
    const as = makeAsyncStorage();
    const s = loadStorage(as);
    await as.setItem(
      '@gote/streak',
      JSON.stringify({ current: 9, longest: 9, lastActiveDay: '2026-07-13' })
    );
    const out = await s.recordStreakDay(TODAY);
    assert.strictEqual(out.current, 1, 'gap restarts the streak');
    assert.strictEqual(out.longest, 9, 'personal best is preserved');
  });

  await test('recordStreakDay: first ever play starts a 1-day streak', async () => {
    const as = makeAsyncStorage();
    const s = loadStorage(as);
    const out = await s.recordStreakDay(TODAY);
    assert.strictEqual(out.current, 1);
    assert.strictEqual(out.longest, 1);
    assert.strictEqual(out.lastActiveDay, '2026-07-16');
  });

  // --- one wrist round's storage sequence ------------------------------------
  await test('watch round: per-answer addToStats accumulates lifetime totals', async () => {
    const as = makeAsyncStorage({ '@gote/stats': JSON.stringify({ answered: 6, correct: 1 }) });
    const s = loadStorage(as);
    // Three answered cards: correct, wrong, correct (mirrors the App.js apply).
    await s.addToStats(1, 1);
    await s.addToStats(1, 0);
    const last = await s.addToStats(1, 1);
    assert.deepStrictEqual(last, { answered: 9, correct: 3 });
    const persisted = JSON.parse(await as.getItem('@gote/stats'));
    assert.deepStrictEqual(persisted, { answered: 9, correct: 3 });
  });

  await test('watch round: addGameResult appends the round accuracy to history', async () => {
    const as = makeAsyncStorage({ '@gote/history': JSON.stringify([17]) });
    const s = loadStorage(as);
    const out = await s.addGameResult((2 / 3) * 100); // 2/3 correct → 67
    assert.deepStrictEqual(out, [17, 67]);
  });

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
