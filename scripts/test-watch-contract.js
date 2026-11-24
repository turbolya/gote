// The phone → watch → watch-face contract, tested off the watch.
//
//   phone   src/watch.js pushWatchSnapshot builds the application context
//   watch   Snapshot.from(context:keeping:)  (targets/watch/store.swift)
//           maps it, and saves the Snapshot JSON-encoded
//   widget  entry(from:)  (targets/watch-widget/index.swift) reads that back
//           for the complication
//
// The JS half runs the real pushWatchSnapshot. The Swift half compiles the
// real watch and widget code — cut out of the target sources by their markers,
// not copied — with swiftc for this Mac, so a renamed key or a changed type on
// either side fails here instead of on a wrist. Both the watch and the widget
// keep their own copy of the streak-ageing rule; they are checked against each
// other and against the calendar edge cases (month ends, DST).
//
//   node scripts/test-watch-contract.js
//
// Needs swiftc (Xcode or the command-line tools); skipped with a note where
// there is none, e.g. on Linux CI.
const babel = require('@babel/core');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync, spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

if (spawnSync('xcrun', ['--find', 'swiftc']).status !== 0) {
  console.log('  skip watch contract: no swiftc on this machine');
  process.exit(0);
}

// --- phone side: the real pushWatchSnapshot ---------------------------------
const sent = [];
const code = babel.transformFileSync(path.join(ROOT, 'src', 'watch.js'), {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const m = { exports: {} };
const fakeRequire = (id) => {
  if (id === 'react-native') return { Platform: { OS: 'ios' } };
  if (id === '../modules/watch-bridge') {
    return { updateWatchContext: (c) => sent.push(c), subscribeWatchResults: () => () => {} };
  }
  if (id === './api') return { toSmallPhoto: (u) => String(u).replace('/medium.', '/small.') };
  return require(id);
};
new Function('module', 'exports', 'require', code)(m, m.exports, fakeRequire);
const { pushWatchSnapshot } = m.exports;

const day = (offset) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const card = (id, common, scientific, image = `https://x/photos/${id}/medium.jpg`) =>
  ({ taxonId: id, common, scientific, image });

// Each case: what the phone is given, and what the watch and its face must
// show. `streak` on the wrist is the LIVE streak, aged by streakDay.
const cases = [
  {
    name: 'nothing played yet',
    input: { lifetime: { answered: 0, correct: 0 }, streak: null, deck: [] },
    want: { accuracy: null, correct: 0, answered: 0, streak: 0, streakBest: 0, streakDay: null, deck: [] },
  },
  {
    name: 'a played account with a streak counted today',
    input: {
      lifetime: { answered: 747, correct: 528 },
      streak: { count: 5, longest: 9, day: day(0) },
      deck: [
        card(1, 'European Robin', 'Erithacus rubecula'),
        card(2, null, 'Prenesta scyllalis'), // no common name: the Latin one goes
        { taxonId: 3, common: 'No photo', scientific: 'X', image: null }, // dropped
      ],
    },
    want: {
      accuracy: 71, correct: 528, answered: 747, streak: 5, streakBest: 9, streakDay: day(0),
      deck: [[1, 'European Robin'], [2, 'Prenesta scyllalis']],
    },
  },
  {
    name: 'a streak counted yesterday still counts',
    input: { lifetime: { answered: 10, correct: 9 }, streak: { count: 3, longest: 3, day: day(-1) }, deck: [card(4, 'Monarch', 'Danaus plexippus')] },
    want: { accuracy: 90, correct: 9, answered: 10, streak: 3, streakBest: 3, streakDay: day(-1), deck: [[4, 'Monarch']] },
  },
  {
    name: 'a streak last counted two days ago has lapsed on the wrist',
    input: { lifetime: { answered: 10, correct: 5 }, streak: { count: 4, longest: 6, day: day(-2) }, deck: [card(5, 'Great Tit', 'Parus major')] },
    want: { accuracy: 50, correct: 5, answered: 10, streak: 0, streakBest: 6, streakDay: day(-2), deck: [[5, 'Great Tit']] },
  },
  {
    name: 'a big deck is capped at 240 cards',
    input: {
      lifetime: { answered: 1, correct: 1 },
      streak: { count: 1, longest: 1, day: day(0) },
      deck: Array.from({ length: 300 }, (_, i) => card(1000 + i, `Species ${i}`, `Genus sp${i}`)),
    },
    want: { accuracy: 100, correct: 1, answered: 1, streak: 1, streakBest: 1, streakDay: day(0), deckCount: 240 },
  },
];

for (const c of cases) {
  const before = sent.length;
  pushWatchSnapshot(c.input);
  assert.strictEqual(sent.length, before + 1, `${c.name}: nothing was pushed`);
  c.context = sent[sent.length - 1];
}
// A stats-only push (the background complication refresh) has no deck key:
// the watch must keep the deck it already has.
const statsOnly = { ...cases[1].context };
delete statsOnly.deck;
cases.push({
  name: 'a stats-only push keeps the deck the watch already has',
  context: statsOnly,
  keeping: cases[1].context.deck.map((d) => [d.id, d.name]),
  want: { ...cases[1].want },
});
// The phone dedupes against the last push: the same snapshot again sends
// nothing, a changed one goes.
const n = sent.length;
pushWatchSnapshot(cases[4].input);
assert.strictEqual(sent.length, n, 'an identical snapshot was pushed twice');
pushWatchSnapshot(cases[1].input);
assert.strictEqual(sent.length, n + 1, 'a changed snapshot was not pushed');

// --- watch and widget side: the real Swift, cut from the targets -------------
const between = (file, start, end) => {
  const s = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const i = s.indexOf(start);
  const j = s.indexOf(end, i);
  assert.ok(i >= 0 && j > i, `${file}: markers "${start}" … "${end}" not found`);
  return s.slice(i, j);
};
const watchSwift = between('targets/watch/store.swift', '// MARK: - Streak freshness', 'final class WatchStore');
const widgetSwift = between('targets/watch-widget/index.swift', 'struct GoteEntry', 'private func loadEntry')
  // TimelineEntry only adds the `date` requirement, which the struct has.
  .replace('struct GoteEntry: TimelineEntry', 'struct GoteEntry')
  // File-private in the widget; the harness is another file.
  .replace(/^private /gm, '');

const harness = String.raw`
import Foundation

var failures = 0
func check(_ ok: Bool, _ what: String) {
  if ok { print("  ok   \(what)") } else { failures += 1; print("  FAIL \(what)") }
}

let cal = Calendar.current
func at(_ y: Int, _ mo: Int, _ d: Int) -> Date {
  cal.date(from: DateComponents(year: y, month: mo, day: d))!
}

// Calendar edges of the ageing rule, in this Mac's time zone.
check(goteStreakLapse("2026-03-31") == at(2026, 4, 2), "a streak from 31 March lapses at 2 April 00:00")
check(goteStreakLapse("2026-12-31") == at(2027, 1, 2), "…and from New Year's Eve at 2 January")
check(goteStreakLapse("2028-02-28") == at(2028, 3, 1), "…and across a leap day")
check(goteStreakLapse("2026-03-28") == at(2026, 3, 30), "…and across the March DST change")
check(goteStreakLapse("2026-10-24") == at(2026, 10, 26), "…and across the October DST change")
check(goteStreakLapse("not-a-day") == nil, "a malformed day has no lapse")
check(goteLiveStreak(7, nil) == 7, "no day: the count is trusted as sent")
check(goteLiveStreak(0, "2026-01-01") == 0, "a zero streak stays zero")

// The widget's copy of the rule must agree with the watch's, day for day.
var agree = true
for offset in -5...2 {
  let d = cal.date(byAdding: .day, value: offset, to: Date())!
  let c = cal.dateComponents([.year, .month, .day], from: d)
  let s = String(format: "%04d-%02d-%02d", c.year!, c.month!, c.day!)
  if goteLiveStreak(4, s) != liveStreak(4, s) || goteStreakLapse(s) != streakLapse(s) { agree = false }
}
check(agree, "the widget ages a streak exactly as the watch does")

// The phone's contexts, through the watch and onto the watch face.
let url = URL(fileURLWithPath: CommandLine.arguments[1])
let cases = try! JSONSerialization.jsonObject(with: Data(contentsOf: url)) as! [[String: Any]]
for c in cases {
  let name = c["name"] as! String
  let ctx = c["context"] as! [String: Any]
  let want = c["want"] as! [String: Any]
  var current = Snapshot.empty
  if let keep = c["keeping"] as? [[Any]] {
    current.deck = keep.map { WatchCard(id: $0[0] as! Int, name: $0[1] as! String, sci: "", image: "kept") }
  }
  let snap = Snapshot.from(context: ctx, keeping: current)
  check(snap.accuracy == want["accuracy"] as? Int, "\(name): accuracy")
  check(snap.correct == want["correct"] as! Int && snap.answered == want["answered"] as! Int, "\(name): correct / answered")
  check(snap.liveStreak == want["streak"] as! Int, "\(name): streak on the watch")
  check(snap.streakBest == want["streakBest"] as! Int, "\(name): best streak")
  check(snap.streakDay == want["streakDay"] as? String, "\(name): streak day")
  if let deck = want["deck"] as? [[Any]] {
    let got = snap.deck.map { [$0.id, $0.name] as [Any] }
    let same = got.count == deck.count && zip(got, deck).allSatisfy { ($0[0] as! Int) == ($1[0] as! Int) && ($0[1] as! String) == ($1[1] as! String) }
    check(same, "\(name): quiz deck")
  }
  if let count = want["deckCount"] as? Int { check(snap.deck.count == count, "\(name): deck size") }
  if c["keeping"] != nil { check(snap.deck.allSatisfy { $0.image == "kept" }, "\(name): the kept deck is the old one") }

  // What the watch saves is what the complication reads.
  let saved = try! JSONEncoder().encode(snap)
  let e = entry(from: saved)
  check(e.accuracy == snap.accuracy && e.answered == snap.answered && e.streakBest == snap.streakBest
        && e.streakDay == snap.streakDay, "\(name): the watch face reads what the watch saved")
  check(e.streak == want["streak"] as! Int, "\(name): streak on the watch face")
}
let none = entry(from: nil)
check(none.accuracy == nil && none.streak == 0 && none.answered == 0, "nothing saved yet: an empty watch face")

print("\(failures == 0 ? "watch contract passed" : "watch contract FAILED: \(failures)")")
exit(failures == 0 ? 0 : 1)
`;

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gote-watch-'));
try {
  const out = cases.map((c) => ({ name: c.name, context: c.context, want: c.want, keeping: c.keeping }));
  // JSON has no "absent": a null `want` means "not set", which Swift reads as nil.
  fs.writeFileSync(path.join(dir, 'cases.json'), JSON.stringify(out));
  fs.writeFileSync(path.join(dir, 'watch.swift'), `import Foundation\n${watchSwift}`);
  fs.writeFileSync(path.join(dir, 'widget.swift'), `import Foundation\n${widgetSwift}`);
  fs.writeFileSync(path.join(dir, 'main.swift'), harness);
  execFileSync('xcrun', ['swiftc', '-O', '-o', path.join(dir, 'contract'),
    path.join(dir, 'watch.swift'), path.join(dir, 'widget.swift'), path.join(dir, 'main.swift')],
  { stdio: ['ignore', 'inherit', 'inherit'] });
  const r = spawnSync(path.join(dir, 'contract'), [path.join(dir, 'cases.json')], { encoding: 'utf8' });
  process.stdout.write(r.stdout);
  process.stderr.write(r.stderr);
  process.exitCode = r.status;
} finally {
  fs.rmSync(dir, { recursive: true, force: true });
}
