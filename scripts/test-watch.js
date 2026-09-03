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
    // storage.js reads and writes through src/kv.js, so the mock goes in there.
    // kv exports plain named functions (not a default), and the mock already has
    // exactly the four it needs, so it can stand in directly.
    if (id === './kv') {
      return { __esModule: true, ...asyncStorage };
    }
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
    // A wrist round of 3 cards, 2 right. The card count rides along because every
    // aggregate over the chart is weighted by it (src/accuracy.js) — and for a
    // watch round it can't be recovered any other way: those cards were already
    // banked one at a time, so the round itself reports no lifetime delta.
    const out = await s.addGameResult((2 / 3) * 100, 3); // 2/3 correct → 67
    assert.deepStrictEqual(
      { history: out.history, counts: out.counts },
      { history: [17, 67], counts: [0, 3] }
    );
    // It also hands back the bar it created, so the caller can put that exact
    // id on the wire — every other device then adopts it instead of inventing
    // one, which is what makes a re-send a no-op rather than a duplicate bar.
    assert.ok(out.bar && out.bar.id, 'the new bar is returned');
    assert.strictEqual(out.bar.pct, 67);
    assert.strictEqual(out.bar.n, 3);
    // The pre-existing bar has no recorded size, so it sits at 0 ("unknown") and
    // the new count lines up opposite its own round, not the older one.
    assert.deepStrictEqual(JSON.parse(await as.getItem('@gote/historyCounts')), [0, 3]);
  });

  // --- per-format lifetime totals ---------------------------------------------
  // The Score card and the "By question type" breakdown both read this map, and
  // it is also a sync wire field, so junk from an older/newer client must fold
  // to a number rather than poisoning the totals with NaN.
  await test('statsByFormat: round-trips, accumulates and survives junk', async () => {
    const as = makeAsyncStorage();
    const s = loadStorage(as);
    assert.deepStrictEqual(await s.loadStatsByFormat(), {}, 'nothing recorded yet');

    const one = await s.addToStatsByFormat({ name: { answered: 3, correct: 2 } });
    assert.deepStrictEqual(one, { name: { answered: 3, correct: 2 } });

    // A second round adds to the format it used and leaves the others alone.
    const two = await s.addToStatsByFormat({
      name: { answered: 2, correct: 2 },
      typed: { answered: 1, correct: 0 },
    });
    assert.deepStrictEqual(two.name, { answered: 5, correct: 4 }, 'sums, never replaces');
    assert.deepStrictEqual(two.typed, { answered: 1, correct: 0 }, 'a new format starts at the delta');
    assert.deepStrictEqual(await s.loadStatsByFormat(), two, 'and it persisted');

    // An empty round must not invent an entry, and a malformed one must not
    // turn a real total into NaN — which would render as an empty bar forever.
    assert.deepStrictEqual(await s.addToStatsByFormat({}), two, 'an empty delta is a no-op');
    assert.deepStrictEqual(await s.addToStatsByFormat(), two, 'a missing delta is a no-op');
    const junk = await s.addToStatsByFormat({ name: { answered: 'x', correct: null }, pair: null });
    assert.deepStrictEqual(junk.name, { answered: 5, correct: 4 }, 'junk counts as zero');
    assert.strictEqual(junk.pair, undefined, 'a null entry adds no format');
  });

  await test('statsByFormat: unreadable storage reads as empty, not as a crash', async () => {
    const as = makeAsyncStorage({ '@gote/statsByFormat': '{not json' });
    const s = loadStorage(as);
    assert.deepStrictEqual(await s.loadStatsByFormat(), {});
  });

  await test('resetStatistics clears the active-day set, not just the streak', async () => {
    // The streak is RECOMPUTED from the active-day set whenever a sync folds in
    // a remote event (applyRemote → streakFromDays). Clearing the streak while
    // keeping the days meant a synced device watched its streak reset to 0 and
    // then come back on the next pull — reset looked like it didn't stick.
    const as = makeAsyncStorage({
      '@gote/stats': JSON.stringify({ answered: 50, correct: 40 }),
      '@gote/history': JSON.stringify([80, 90]),
      '@gote/historyCounts': JSON.stringify([10, 12]),
      '@gote/streak': JSON.stringify({ current: 3, longest: 5, lastActiveDay: '2026-08-07' }),
      '@gote/activeDays': JSON.stringify(['2026-08-05', '2026-08-06', '2026-08-07']),
    });
    const s = loadStorage(as);
    await s.resetStatistics();
    assert.deepStrictEqual(await s.loadStats(), { answered: 0, correct: 0 });
    assert.deepStrictEqual(await s.loadHistory(), []);
    assert.deepStrictEqual(await s.loadHistoryCounts(), []);
    assert.deepStrictEqual(await s.loadActiveDays(), [], 'the day set must go too');
    assert.strictEqual(await as.getItem('@gote/streak'), null);
  });

  // The test above names its keys by hand, which is exactly how the active-day
  // bug got in: a new statistic was added and reset simply wasn't told about it.
  // So seed EVERY key storage.js declares — read out of the source, so a key
  // added tomorrow is seeded automatically — and assert that what survives a
  // reset is precisely the survivor list below. Forgetting a new statistic then
  // fails here instead of shipping as "reset didn't stick".
  await test('resetStatistics clears every statistic, and only the statistics', async () => {
    const src = require('fs').readFileSync(
      path.join(__dirname, '..', 'src/storage.js'), 'utf8'
    );
    const allKeys = [...new Set(src.match(/'@gote\/[A-Za-z]+'/g) || [])]
      .map((q) => q.slice(1, -1));
    assert.ok(allKeys.length >= 15, `expected to find the key table, got ${allKeys.length}`);

    // Everything that is NOT a statistic: identity, settings, the disposable
    // download caches, and the flags the player set by hand. These must survive
    // — clearing a score should not sign you out or drop your flagged species.
    // confusionNotes is here because reset TOMBSTONES it rather than deleting
    // it (see the next test), so the key is still present afterwards.
    const survivors = new Set([
      '@gote/username', '@gote/prefs', '@gote/settingsStamp', '@gote/dataVersion',
      '@gote/obscache', '@gote/downloadedImages', '@gote/flags',
      '@gote/confusionNotes',
      '@gote/watchResultIds', '@gote/watchTipDismissed',
      // Having been shown around the app is not a score. Replaying the tour on
      // a reset would be a surprise, and it is one tap away in Settings anyway.
      '@gote/tutorial',
      // Where the round picker reopens: a preference, not a score. Clearing the
      // tallies is not a reason to forget that the player drills birds only.
      '@gote/roundSetup',
    ]);

    const as = makeAsyncStorage(Object.fromEntries(allKeys.map((k) => [k, '"seeded"'])));
    await loadStorage(as).resetStatistics();
    const left = allKeys.filter((k) => as._store.has(k)).sort();
    assert.deepStrictEqual(
      left,
      allKeys.filter((k) => survivors.has(k)).sort(),
      'a key here is either a statistic reset must clear, or a survivor to add above'
    );
  });

  await test('resetStatistics tombstones the pair notes rather than deleting them', async () => {
    // Notes ride the SETTINGS row, which is last-write-wins per note and re-read
    // on every pull — so a plain delete loses the race against another device's
    // copy and every note comes back. An empty-text note stamped `now` is the
    // app's own delete (saveConfusionNote), and it is what actually propagates.
    const as = makeAsyncStorage({
      '@gote/confusions': JSON.stringify({ '1001': { '1002': 3 } }),
      '@gote/confusionWins': JSON.stringify({ '1001|1002': 2 }),
      '@gote/confusionNotes': JSON.stringify({
        '1001|1002': { text: 'orange breast, not red', t: 100 },
        '1003|1004': { text: 'check the tail', t: 200 },
      }),
    });
    const s = loadStorage(as);
    const notes = await s.resetStatistics(5000);

    // Derived from play: gone outright.
    assert.deepStrictEqual(await s.loadConfusions(), {}, 'the matrix is derived, so it goes');
    assert.strictEqual(await as.getItem('@gote/confusionWins'), null, 'recovery streaks go too');

    // Authored by the player: cleared as a syncable deletion, freshly stamped so
    // it beats the copy still sitting in the other device's settings row.
    assert.deepStrictEqual(notes, {
      '1001|1002': { text: '', t: 5000 },
      '1003|1004': { text: '', t: 5000 },
    }, 'returned so the caller can push the deletion');
    assert.deepStrictEqual(await s.loadConfusionNotes(), notes, 'and persisted');

    // Nothing is left for the UI to draw.
    const { displayNotes } = await import('../src/sync/merge.js');
    assert.deepStrictEqual(displayNotes(await s.loadConfusionNotes()), {});
  });

  await test('resetStatistics with no notes writes no tombstones', async () => {
    const as = makeAsyncStorage({ '@gote/stats': JSON.stringify({ answered: 1, correct: 1 }) });
    const s = loadStorage(as);
    assert.deepStrictEqual(await s.resetStatistics(), {}, 'nothing to tombstone');
    assert.deepStrictEqual(await s.loadConfusionNotes(), {});
  });

  // --- applied-id dedup store -------------------------------------------------
  await test('applied watch ids: round-trips and caps at MAX_WATCH_IDS (500)', async () => {
    const as = makeAsyncStorage();
    const s = loadStorage(as);
    assert.deepStrictEqual(await s.loadAppliedWatchIds(), [], 'empty by default');
    await s.saveAppliedWatchIds(['a', 'b', 'c']);
    assert.deepStrictEqual(await s.loadAppliedWatchIds(), ['a', 'b', 'c']);
    // Overflow keeps only the newest 500 (FIFO, newest last).
    const many = Array.from({ length: 600 }, (_, i) => `r${i}`);
    await s.saveAppliedWatchIds(many);
    const kept = await s.loadAppliedWatchIds();
    assert.strictEqual(kept.length, 500);
    assert.strictEqual(kept[0], 'r100', 'drops the oldest 100');
    assert.strictEqual(kept[499], 'r599', 'keeps the newest');
  });

  console.log(results.join('\n'));
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
