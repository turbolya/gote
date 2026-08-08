// Tests for the cross-device sync merge (src/sync/merge.js).
//
// This is the file worth testing hardest in the whole sync layer: a mistake
// here doesn't throw, it quietly changes someone's lifetime numbers. The cases
// below are the ones that actually happen in the field — a duplicate delivery,
// two devices playing the same day, a phone that was offline for a week, a
// single watch answer that must not become a chart point.
//
// Pure functions only, so this runs in plain node with no simulator, no
// network and no Supabase project.

const path = require('path');
const { execFileSync } = require('child_process');

// merge.js is ESM (it ships in the app bundle); run the assertions inside a
// small ESM wrapper rather than converting the module to CommonJS just for the
// tests.
const src = path.join(__dirname, '..', 'src', 'sync', 'merge.js');

const script = `
import {
  localDay, emptyRollups, applyEvent, applyEvents, sortEvents,
  streakFromDays, mergeSettings, trimLedger,
  SETTINGS_PAYLOAD_VERSION, buildSettingsPayload, upgradeSettingsPayload,
  notesFromPayload, mergeNotes, displayNotes,
  flagsFromPayload, mergeFlags, flaggedIds,
  addConfusion, mergeConfusions, subtractConfusions,
} from ${JSON.stringify(src)};

let passed = 0;
let failed = 0;

function ok(name, cond) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
}
function eq(name, actual, expected) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

const day = (d) => '2026-03-' + String(d).padStart(2, '0');
// An event with the defaults filled in. It SPREADS the caller's object rather
// than copying a fixed list of fields: the old version named each field
// explicitly, so a test passing anything newer (formats, counts, lastSeen…) had
// it silently dropped and then watched the merge appear not to fold it — a
// failure that looks exactly like a bug in the code under test.
const ev = (o) => ({
  ts: Date.now(),
  answered: 0,
  correct: 0,
  n: 0,
  species: {},
  ...o,
  pct: o.pct === undefined ? null : o.pct,
});

console.log('\\nlocalDay');
{
  // Local calendar parts, never a UTC slice: someone playing at 00:30 in
  // Budapest must get today, not yesterday.
  const d = new Date(2026, 2, 5, 0, 30);
  eq('uses local date parts', localDay(d.getTime()), '2026-03-05');
  const late = new Date(2026, 2, 5, 23, 59);
  eq('late evening stays on the same day', localDay(late.getTime()), '2026-03-05');
}

console.log('\\napplyEvent');
{
  const r = applyEvent(emptyRollups(), ev({ id: 'a', localDay: day(1), answered: 10, correct: 7, pct: 70 }));
  eq('counts answered/correct', r.stats, { answered: 10, correct: 7 });
  eq('records the round on the chart', r.history, [70]);
  eq('marks the day active', r.days, [day(1)]);
}
{
  // A single watch answer: counts toward totals, but is NOT a round and must
  // never land on the accuracy chart as a 0% or 100% spike.
  const r = applyEvent(emptyRollups(), ev({ id: 'a', localDay: day(1), answered: 1, correct: 1 }));
  eq('a single answer still counts', r.stats, { answered: 1, correct: 1 });
  eq('a single answer is not a chart point', r.history, []);
  eq('a single answer still marks the day', r.days, [day(1)]);
}
{
  const base = emptyRollups();
  const r = applyEvent(base, ev({ id: 'a', localDay: day(1), answered: 1, correct: 1 }));
  eq('does not mutate its input', base, emptyRollups());
  ok('returns a new object', r !== base);
}
{
  const one = applyEvent(emptyRollups(), ev({ id: 'a', localDay: day(1), answered: 2, correct: 1, species: { 42: { name: 'Newt', sci: 'Lissotriton', known: 1, missed: 1 } } }));
  const two = applyEvent(one, ev({ id: 'b', localDay: day(1), answered: 1, correct: 1, species: { 42: { name: 'Newt', sci: 'Lissotriton', known: 1, missed: 0 } } }));
  eq('species tallies accumulate', two.species['42'], { name: 'Newt', sci: 'Lissotriton', image: null, known: 2, missed: 1, lastSeen: 0, msTotal: 0, msCount: 0 });
  eq('same day is not double-listed', two.days, [day(1)]);
}
{
  // Retrieval signals (src/recall.js). Nothing reads them yet, but they have to
  // fold correctly from the first event or the history is wrong forever.
  const sp = (o) => ({ 42: { name: 'Newt', sci: 'Lissotriton', ...o } });
  const one = applyEvent(emptyRollups(), ev({ id: 'a', localDay: day(1), species: sp({ known: 1, lastSeen: 500, msTotal: 1200, msCount: 1 }) }));
  const two = applyEvent(one, ev({ id: 'b', localDay: day(1), species: sp({ known: 1, lastSeen: 900, msTotal: 800, msCount: 1 }) }));
  eq('latency folds as a sum and a count', [two.species['42'].msTotal, two.species['42'].msCount], [2000, 2]);
  eq('lastSeen advances to the newer answer', two.species['42'].lastSeen, 900);
  // Out-of-order delivery is the normal case, not an edge case: an event from a
  // device that was offline for a week arrives after today's rounds.
  const late = applyEvent(two, ev({ id: 'c', localDay: day(1), species: sp({ known: 1, lastSeen: 100, msTotal: 400, msCount: 1 }) }));
  eq('a late-arriving older answer does not rewind lastSeen', late.species['42'].lastSeen, 900);
  eq('but its latency still counts', [late.species['42'].msTotal, late.species['42'].msCount], [2400, 3]);
  // An event from a client that predates these fields must not poison them.
  const old = applyEvent(late, ev({ id: 'd', localDay: day(1), species: sp({ known: 1 }) }));
  eq('an older client event leaves the signals intact', [old.species['42'].lastSeen, old.species['42'].msTotal, old.species['42'].msCount], [900, 2400, 3]);
  eq('and still counts the answer itself', old.species['42'].known, 4);
}
{
  // Lifetime totals split by question format. Smart play mixes formats of very
  // different difficulty inside one round, so the blended number alone stops
  // being comparable with itself as the mix shifts.
  const one = applyEvent(emptyRollups(), ev({ id: 'a', localDay: day(1), answered: 5, correct: 4, formats: { name: { answered: 3, correct: 3 }, typed: { answered: 2, correct: 1 } } }));
  eq('a mixed round splits by format', one.formats, { name: { answered: 3, correct: 3 }, typed: { answered: 2, correct: 1 } });
  const two = applyEvent(one, ev({ id: 'b', localDay: day(1), answered: 2, correct: 0, formats: { typed: { answered: 2, correct: 0 } } }));
  eq('and the splits accumulate', two.formats.typed, { answered: 4, correct: 1 });
  eq('untouched formats are left alone', two.formats.name, { answered: 3, correct: 3 });
  // The blended total must still agree with the sum of the parts.
  eq('the split reconciles with the blended total', two.stats, { answered: 7, correct: 4 });
  // Rounds from the fixed modes and from older clients carry no split at all.
  const bare = applyEvent(two, ev({ id: 'c', localDay: day(1), answered: 1, correct: 1 }));
  eq('an event with no split leaves it untouched', bare.formats, two.formats);
  eq('junk in the split does not throw', applyEvent(emptyRollups(), ev({ id: 'd', localDay: day(1), formats: { name: null, typed: 'x' } })).formats, { name: { answered: 0, correct: 0 }, typed: { answered: 0, correct: 0 } });
}
{
  const r = applyEvent(emptyRollups(), ev({ id: 'a', localDay: day(1), answered: 3, correct: 3, pct: 140 }));
  eq('clamps an out-of-range pct', r.history, [100]);
}
{
  const r = applyEvent(emptyRollups(), { id: 'a', localDay: day(1), answered: 'lots', correct: null, species: null });
  eq('survives junk fields', r.stats, { answered: 0, correct: 0 });
}

console.log('\\napplyEvent (baseline history + days)');
{
  // A first-sync baseline carries the device's whole accuracy chart at once as a
  // history array — so a joining device gets the bars, not just the total.
  const r = applyEvent(emptyRollups(), { id: 'base', localDay: day(9), answered: 30, correct: 24, history: [50, 60, 70, 80] });
  eq('a baseline history array becomes chart bars', r.history, [50, 60, 70, 80]);
  eq('the baseline still counts toward totals', r.stats, { answered: 30, correct: 24 });
}
{
  // The baseline days set rebuilds the streak calendar. A single event used to
  // carry only one day, stranding the day-by-day streak on the old device.
  const r = applyEvent(emptyRollups(), { id: 'base', localDay: day(9), days: [day(1), day(2), day(3)] });
  eq('a baseline days array unions into the day set', r.days.slice().sort(), [day(1), day(2), day(3), day(9)].sort());
}
{
  // Baseline bars fold onto whatever the device already has, and pct + history
  // can ride the same event without either being dropped.
  const local = applyEvent(emptyRollups(), ev({ id: 'own', localDay: day(8), answered: 1, correct: 1, pct: 90 }));
  const r = applyEvent(local, { id: 'base', localDay: day(1), answered: 5, correct: 5, pct: 40, history: [10, 20] });
  eq('baseline history appends to existing bars, then its own pct', r.history, [90, 10, 20, 40]);
}

console.log('\\napplyEvent (round sizes)');
{
  // Every chart point carries the cards it covered, so a 1-card round can't
  // weigh as much as a 100-card one downstream (src/accuracy.js).
  const r = applyEvent(emptyRollups(), ev({ id: 'a', localDay: day(1), answered: 20, correct: 14, pct: 70, n: 20 }));
  eq('a round records its size', r.counts, [20]);
}
{
  // A watch round reports answered: 0 (its cards were banked one at a time), so
  // the size has to ride in n or the bar would have no weight at all.
  const r = applyEvent(emptyRollups(), { id: 'w', localDay: day(1), answered: 0, correct: 0, pct: 80, n: 5 });
  eq('a watch round still carries a size', r.counts, [5]);
  eq('and still adds nothing to the totals', r.stats, { answered: 0, correct: 0 });
}
{
  // An event from a client that predates sizes. 0 means "unknown" — the reader
  // falls back to the player's own mean round length rather than guessing 1.
  const r = applyEvent(emptyRollups(), { id: 'old', localDay: day(1), answered: 4, correct: 2, pct: 50 });
  eq('an older event yields an unknown size', r.counts, [0]);
}
{
  // The two arrays must stay index-aligned through ANY mix of old and new
  // events, or every bar would be weighted by the wrong round.
  let r = applyEvent(emptyRollups(), { id: 'old', localDay: day(1), pct: 50 });
  r = applyEvent(r, ev({ id: 'new', localDay: day(2), answered: 30, correct: 30, pct: 100, n: 30 }));
  eq('history and counts stay the same length', r.history.length === r.counts.length, true);
  eq('an old point does not shift the new size', r.counts, [0, 30]);
}
{
  // A baseline's counts are right-aligned with its history, matching how the
  // device stores them: a device with bars from before sizes were recorded sends
  // sizes for its NEWEST bars only.
  const r = applyEvent(emptyRollups(), { id: 'base', localDay: day(9), history: [50, 60, 70, 80], counts: [12, 40] });
  eq('short baseline counts align to the newest bars', r.counts, [0, 0, 12, 40]);
}
{
  // Baseline bars plus the event's own pct, all sizes landing on the right bar.
  const local = applyEvent(emptyRollups(), ev({ id: 'own', localDay: day(8), answered: 9, correct: 8, pct: 90, n: 9 }));
  const r = applyEvent(local, { id: 'base', localDay: day(1), pct: 40, n: 4, history: [10, 20], counts: [1, 2] });
  eq('bars and sizes stay paired across a mixed event', r.history, [90, 10, 20, 40]);
  eq('sizes follow their own bars', r.counts, [9, 1, 2, 4]);
}
{
  const r = applyEvent(emptyRollups(), { id: 'j', localDay: day(1), pct: 50, n: 'lots' });
  eq('a junk size reads as unknown', r.counts, [0]);
}

{
  // A day that arrives from BOTH a baseline set and a later round folds in once.
  const withBase = applyEvent(emptyRollups(), { id: 'base', days: [day(1), day(2)] });
  const withRound = applyEvent(withBase, ev({ id: 'r', localDay: day(2), answered: 1, correct: 1, pct: 50 }));
  eq('a day shared by baseline and round is not double-listed', withRound.days.slice().sort(), [day(1), day(2)].sort());
}

console.log('\\napplyEvents (dedup + ordering)');
{
  // THE case this whole design exists for: the same row delivered twice must
  // not count twice.
  const events = [
    ev({ id: 'a', ts: 1000, localDay: day(1), answered: 5, correct: 5, pct: 100 }),
    ev({ id: 'a', ts: 1000, localDay: day(1), answered: 5, correct: 5, pct: 100 }),
  ];
  const { rollups, applied } = applyEvents(emptyRollups(), events, []);
  eq('a duplicate id is counted once', rollups.stats, { answered: 5, correct: 5 });
  eq('only one id reported applied', applied, ['a']);
}
{
  const first = applyEvents(emptyRollups(), [ev({ id: 'a', localDay: day(1), answered: 5, correct: 5, pct: 100 })], []);
  const again = applyEvents(first.rollups, [ev({ id: 'a', localDay: day(1), answered: 5, correct: 5, pct: 100 })], first.applied);
  eq('a re-pull of a known id changes nothing', again.rollups.stats, { answered: 5, correct: 5 });
  eq('nothing newly applied', again.applied, []);
}
{
  // Rows can arrive out of order (an offline device catching up). Totals must
  // not care, and the chart must end up chronological.
  const events = [
    ev({ id: 'c', ts: 3000, localDay: day(3), answered: 1, correct: 1, pct: 30 }),
    ev({ id: 'a', ts: 1000, localDay: day(1), answered: 1, correct: 0, pct: 10 }),
    ev({ id: 'b', ts: 2000, localDay: day(2), answered: 1, correct: 1, pct: 20 }),
  ];
  const { rollups } = applyEvents(emptyRollups(), events, []);
  eq('totals are order-independent', rollups.stats, { answered: 3, correct: 2 });
  eq('the chart is sorted by time', rollups.history, [10, 20, 30]);
}
{
  const events = [ev({ id: 'a', localDay: day(1) }), { no: 'id' }, null];
  const { applied } = applyEvents(emptyRollups(), events, []);
  eq('rows without an id are skipped', applied, ['a']);
}

console.log('\\nstreakFromDays');
{
  const now = new Date(2026, 2, 10, 12, 0).getTime(); // 2026-03-10
  eq('empty', streakFromDays([], now), { current: 0, longest: 0, lastActiveDay: null });
  eq('today only', streakFromDays([day(10)], now).current, 1);
  eq('three consecutive days ending today', streakFromDays([day(8), day(9), day(10)], now).current, 3);
  // Counted yesterday but not yet today: still alive, same as streakStatus's
  // 'atRisk' on the phone.
  eq('ending yesterday still counts', streakFromDays([day(8), day(9)], now).current, 2);
  // A run that stopped before yesterday has lapsed.
  eq('a lapsed run shows 0 current', streakFromDays([day(1), day(2), day(3)], now).current, 0);
  eq('but longest remembers it', streakFromDays([day(1), day(2), day(3)], now).longest, 3);
  // The reason days are a SET rather than a counter: two devices both record
  // the same day, and the union is still one day.
  eq('duplicate days collapse', streakFromDays([day(9), day(9), day(10)], now).current, 2);
  // Order of arrival is irrelevant.
  eq('unsorted input', streakFromDays([day(10), day(8), day(9)], now).current, 3);
  eq('a gap breaks the run', streakFromDays([day(1), day(3), day(9), day(10)], now).current, 2);
}
{
  // Month boundary — the reason day arithmetic goes through Date parts rather
  // than adding 86400000ms.
  const now = new Date(2026, 2, 1, 12, 0).getTime(); // 2026-03-01
  eq('spans the end of February', streakFromDays(['2026-02-27', '2026-02-28', '2026-03-01'], now).current, 3);
}
{
  // 2024 was a leap year: Feb 29 exists and must chain.
  const now = new Date(2024, 2, 1, 12, 0).getTime();
  eq('handles Feb 29', streakFromDays(['2024-02-28', '2024-02-29', '2024-03-01'], now).current, 3);
}

console.log('\\nmergeSettings');
{
  const local = { data: { prefs: { locale: 'en' } }, updatedAt: 100 };
  const remote = { data: { prefs: { locale: 'hu' } }, updatedAt: 200 };
  eq('newer remote wins', mergeSettings(local, remote).data.prefs.locale, 'hu');
  eq('newer local wins', mergeSettings(remote, local).data.prefs.locale, 'hu');
  eq('missing remote keeps local', mergeSettings(local, null), local);
  eq('missing local takes remote', mergeSettings(null, remote), remote);
}

console.log('\\nsettings payload versioning');
{
  eq('build stamps the current version', buildSettingsPayload({ locale: 'hu' }, 'ada').v, SETTINGS_PAYLOAD_VERSION);
  eq('build carries prefs + username', buildSettingsPayload({ locale: 'hu' }, 'ada'), { v: 2, prefs: { locale: 'hu' }, username: 'ada' });
  eq('build normalises missing fields', buildSettingsPayload(null, null), { v: 2, prefs: {}, username: null });

  // Reading the OLD unversioned blob: a missing v is v0 and upcasts to the
  // current version without losing the fields it did carry.
  const legacy = upgradeSettingsPayload({ prefs: { locale: 'en' }, username: 'leo' });
  eq('unversioned blob upcasts to v2', legacy.v, 2);
  eq('unversioned blob keeps its fields', { prefs: legacy.prefs, username: legacy.username }, { prefs: { locale: 'en' }, username: 'leo' });

  // The whole reason the DB merges rather than replaces: an unknown (newer) key
  // must survive being read by this (older) client, never be silently dropped.
  const withFuture = upgradeSettingsPayload({ v: 2, prefs: {}, username: 'x', deckPrefs: { sort: 'az' } });
  eq('unknown future keys are preserved on read', withFuture.deckPrefs, { sort: 'az' });

  // A payload already at the current version is returned unchanged.
  const current = buildSettingsPayload({ locale: 'de' }, 'mia');
  eq('current payload is unchanged by upcast', upgradeSettingsPayload(current), current);

  // A blob from a FUTURE version is passed through, not downgraded.
  eq('a newer version is left alone', upgradeSettingsPayload({ v: 5, prefs: {} }).v, 5);

  // Junk in, safe baseline out — never throws.
  eq('junk upcasts to a v2 baseline', upgradeSettingsPayload(null), { v: 2 });
  eq('a non-object upcasts to a v2 baseline', upgradeSettingsPayload('nope'), { v: 2 });
}

console.log('\\nnotes payload (v2) + per-note merge');
{
  // Notes ride the payload as n:<pairKey> top-level keys, so the DB shallow-
  // merge keeps each one independent. buildSettingsPayload spreads them out and
  // notesFromPayload reads them back.
  const notes = { 'A B': { text: 'toothed', t: 5 }, 'C D': { text: 'grey bill', t: 9 } };
  const payload = buildSettingsPayload({ locale: 'de' }, 'mia', notes);
  eq('build spreads notes as n:<pairKey> keys',
    { ['n:A B']: payload['n:A B'], ['n:C D']: payload['n:C D'] },
    { 'n:A B': { text: 'toothed', t: 5 }, 'n:C D': { text: 'grey bill', t: 9 } });
  eq('notesFromPayload reads them back', notesFromPayload(payload), notes);
  eq('a payload with no notes yields none', notesFromPayload(buildSettingsPayload({}, 'x')), {});
  // A legacy bare-string note upcasts (t 0) so it still round-trips.
  eq('a bare-string note upcasts', notesFromPayload(buildSettingsPayload({}, 'x', { 'A B': 'legacy' })),
    { 'A B': { text: 'legacy', t: 0 } });

  // mergeNotes: newer edit wins per note; notes on different pairs both survive.
  eq('newer edit wins per note',
    mergeNotes({ 'A B': { text: 'old', t: 1 } }, { 'A B': { text: 'new', t: 2 } }),
    { 'A B': { text: 'new', t: 2 } });
  eq('a stale edit loses',
    mergeNotes({ 'A B': { text: 'keep', t: 5 } }, { 'A B': { text: 'stale', t: 3 } }),
    { 'A B': { text: 'keep', t: 5 } });
  eq('edits on different pairs both survive',
    mergeNotes({ 'A B': { text: 'x', t: 1 } }, { 'C D': { text: 'y', t: 1 } }),
    { 'A B': { text: 'x', t: 1 }, 'C D': { text: 'y', t: 1 } });
  eq('a newer delete (tombstone) wins',
    mergeNotes({ 'A B': { text: 'note', t: 1 } }, { 'A B': { text: '', t: 4 } }),
    { 'A B': { text: '', t: 4 } });
  eq('merge is order-independent',
    mergeNotes({ 'A B': { text: 'a', t: 2 } }, { 'A B': { text: 'b', t: 2 } }),
    mergeNotes({ 'A B': { text: 'b', t: 2 } }, { 'A B': { text: 'a', t: 2 } }));

  // displayNotes: the UI shape — real text only, tombstones dropped.
  eq('displayNotes drops tombstones',
    displayNotes({ 'A B': { text: 'keep', t: 2 }, 'C D': { text: '', t: 3 } }),
    { 'A B': 'keep' });
}

console.log('\\nflags payload (v2, per-username) + per-flag merge');
{
  // Flags ride as f:<username>:<taxonId> keys, so switching accounts on a device
  // never cross-contaminates. build spreads them; flagsFromPayload reads back the
  // requested username only.
  const flags = { 10: { on: true, t: 3 }, 20: { on: false, t: 7 } };
  const payload = buildSettingsPayload({}, 'leo', null, flags);
  eq('build spreads flags as f:<user>:<id> keys',
    { a: payload['f:leo:10'], b: payload['f:leo:20'] },
    { a: { on: true, t: 3 }, b: { on: false, t: 7 } });
  eq('flagsFromPayload reads back this user only', flagsFromPayload(payload, 'leo'), flags);
  eq('another user sees none of them', flagsFromPayload(payload, 'ada'), {});
  eq('no flags ride without a username', buildSettingsPayload({}, null, null, { 10: { on: true, t: 1 } })['f::10'], undefined);

  // Two accounts' flags coexist as separate keys (what protects the DB merge).
  const both = { ...buildSettingsPayload({}, 'leo', null, { 10: { on: true, t: 1 } }),
                 'f:ada:99': { on: true, t: 1 } };
  eq('per-user keys keep accounts separate', flagsFromPayload(both, 'ada'), { 99: { on: true, t: 1 } });

  // mergeFlags: latest toggle wins; a set on one device and clear on another
  // resolve by time; a tie keeps the flag.
  eq('a later toggle wins',
    mergeFlags({ 10: { on: true, t: 1 } }, { 10: { on: false, t: 2 } }),
    { 10: { on: false, t: 2 } });
  eq('flags on different species both survive',
    mergeFlags({ 10: { on: true, t: 1 } }, { 20: { on: true, t: 1 } }),
    { 10: { on: true, t: 1 }, 20: { on: true, t: 1 } });
  eq('an equal-time tie keeps the flag',
    mergeFlags({ 10: { on: false, t: 5 } }, { 10: { on: true, t: 5 } }),
    { 10: { on: true, t: 5 } });
  eq('merge is order-independent',
    mergeFlags({ 10: { on: false, t: 5 } }, { 10: { on: true, t: 5 } }),
    mergeFlags({ 10: { on: true, t: 5 } }, { 10: { on: false, t: 5 } }));

  // flaggedIds: the display shape — on:true only.
  eq('flaggedIds lists the flagged, drops tombstones',
    flaggedIds({ 10: { on: true, t: 2 }, 20: { on: false, t: 3 } }).sort(),
    ['10']);
}

console.log('\\nconfusion matrix');
{
  eq('records a new pair', addConfusion({}, 'A', 'B'), { A: { B: 1 } });
  eq('increments an existing pair', addConfusion({ A: { B: 1 } }, 'A', 'B'), { A: { B: 2 } });
  eq('adds a second chosen species', addConfusion({ A: { B: 1 } }, 'A', 'C'), { A: { B: 1, C: 1 } });
  eq('a self-pair is ignored', addConfusion({}, 'A', 'A'), {});
  eq('a missing key is ignored', addConfusion({ X: { Y: 1 } }, '', 'B'), { X: { Y: 1 } });
  {
    const base = { A: { B: 1 } };
    addConfusion(base, 'A', 'B');
    eq('does not mutate its input', base, { A: { B: 1 } });
  }

  eq('merge deep-adds counts',
    mergeConfusions({ A: { B: 1, C: 2 } }, { A: { B: 3 }, D: { E: 1 } }),
    { A: { B: 4, C: 2 }, D: { E: 1 } });
  eq('merge with a missing side keeps the other', mergeConfusions(null, { A: { B: 1 } }), { A: { B: 1 } });
  eq('merge survives junk', mergeConfusions('x', { A: { B: 1 } }), { A: { B: 1 } });

  // Confusions ride the append-only event log, so applyEvent must fold them just
  // like species/stats.
  {
    const r = applyEvent(emptyRollups(), { id: 'a', localDay: day(1), confusions: { A: { B: 1 } } });
    eq('applyEvent folds a confusion delta', r.confusions, { A: { B: 1 } });
  }
  {
    const events = [
      { id: 'a', localDay: day(1), confusions: { A: { B: 1 } } },
      { id: 'b', localDay: day(1), confusions: { A: { B: 2 }, C: { D: 1 } } },
    ];
    const { rollups } = applyEvents(emptyRollups(), events, []);
    eq('applyEvents sums confusion deltas across events', rollups.confusions, { A: { B: 3 }, C: { D: 1 } });
  }
  {
    const r = applyEvent({ ...emptyRollups(), confusions: { A: { B: 1 } } }, { id: 'a', localDay: day(1), answered: 1, correct: 1 });
    eq('an event without confusions leaves them untouched', r.confusions, { A: { B: 1 } });
  }

  // subtractConfusions (baseline = raw totals minus what's still queued).
  eq('subtract removes queued counts', subtractConfusions({ A: { B: 3, C: 1 } }, { A: { B: 1 } }), { A: { B: 2, C: 1 } });
  eq('subtract drops a pair that reaches zero', subtractConfusions({ A: { B: 1 } }, { A: { B: 1 } }), {});
  eq('subtract clamps at zero', subtractConfusions({ A: { B: 1 } }, { A: { B: 5 } }), {});
  eq('subtract with a missing delta returns the base', subtractConfusions({ A: { B: 2 } }, null), { A: { B: 2 } });
}

console.log('\\ntrimLedger');
{
  const ids = Array.from({ length: 2500 }, (_, i) => 'id' + i);
  eq('caps growth', trimLedger(ids, 2000).length, 2000);
  eq('keeps the newest', trimLedger(ids, 2000)[1999], 'id2499');
  eq('leaves a short ledger alone', trimLedger(['a', 'b'], 2000), ['a', 'b']);
  eq('survives junk', trimLedger(null, 10), []);
}

console.log('\\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
`;

const out = execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
  stdio: 'inherit',
});
