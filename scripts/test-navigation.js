// Tests for the back-navigation graph (src/navigation.js). Pure, so it runs in
// plain node via a small ESM wrapper (same approach as test-mastery.js).
//
// The point of these is the graph's SHAPE, not the individual targets: a screen
// classified in neither list gets a silently disabled swipe-back gesture, which
// is exactly the bug this map was introduced to prevent.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const src = path.join(__dirname, '..', 'src', 'navigation.js');

// The screens App.js can actually render, scraped from its `screen === '…'`
// branches. Without this the map could only be checked against itself, and a
// newly added screen — the exact way Sync lost its swipe-back — would classify
// as nothing and be tested as nothing.
const appSource = fs.readFileSync(path.join(__dirname, '..', 'App.js'), 'utf8');
const rendered = [
  ...new Set(
    [...appSource.matchAll(/screen === '([a-z]+)'/g)].map((m) => m[1])
  ),
].sort();
if (rendered.length < 5) {
  console.error('could not scrape screens from App.js — did the pattern change?');
  process.exit(1);
}

const script = `
import { BACK_TO, NO_BACK, SCREENS, backTarget, systemBackAction } from ${JSON.stringify(src)};
const RENDERED = ${JSON.stringify(rendered)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + '\\n         expected ' + b + '\\n         actual   ' + a); }
}

console.log('\\nbackTarget');
{
  eq('a top-level page returns to the menu', backTarget('stats'), 'menu');
  eq('a settings sub-page returns to settings', backTarget('legal'), 'settings');
  // The regression this map exists for: Sync had a header chevron but was
  // missing from the swipe table, so the gesture silently did nothing.
  eq('sync returns to settings', backTarget('sync'), 'settings');
  eq('the root has nowhere to go', backTarget('menu'), null);
  eq('a round in progress has no back', backTarget('study'), null);
  eq('results has no back', backTarget('results'), null);
  eq('an unknown screen has no back', backTarget('nope'), null);
  eq('undefined is handled', backTarget(undefined), null);
  // Must not inherit anything from Object.prototype.
  eq('prototype keys are not screens', backTarget('constructor'), null);
  eq('toString is not a screen', backTarget('toString'), null);
}

console.log('\\nevery screen is classified exactly once');
{
  const both = Object.keys(BACK_TO).filter((s) => NO_BACK.includes(s));
  eq('no screen is in both lists', both, []);
  eq('SCREENS covers both lists', SCREENS.length, Object.keys(BACK_TO).length + NO_BACK.length);
  const dupes = SCREENS.filter((s, i) => SCREENS.indexOf(s) !== i);
  eq('no duplicate screens', dupes, []);
}

console.log('\\nthe graph is well-formed');
{
  const unknown = Object.entries(BACK_TO)
    .filter(([, to]) => !SCREENS.includes(to))
    .map(([from]) => from);
  eq('every target is a real screen', unknown, []);

  const selfLoops = Object.entries(BACK_TO)
    .filter(([from, to]) => from === to)
    .map(([from]) => from);
  eq('no screen backs into itself', selfLoops, []);

  // Walking back from anywhere must terminate, and terminate at the root —
  // otherwise a user could get stuck in a loop with no way out to the menu.
  const stuck = [];
  for (const start of SCREENS) {
    let cur = start;
    const seen = new Set();
    while (backTarget(cur)) {
      if (seen.has(cur)) { stuck.push(start); break; }
      seen.add(cur);
      cur = backTarget(cur);
    }
    if (cur !== 'menu' && !NO_BACK.includes(cur)) stuck.push(start);
  }
  eq('backing out always terminates', stuck, []);

  const notRoot = SCREENS.filter((s) => {
    let cur = s;
    let hops = 0;
    while (backTarget(cur) && hops++ < 10) cur = backTarget(cur);
    // Every screen with a back action must eventually reach the menu.
    return backTarget(s) && cur !== 'menu';
  });
  eq('every backable screen reaches the menu', notRoot, []);
}

console.log('\\nthe map matches the screens App.js actually renders');
{
  // This is the assertion that would have caught the Sync bug: a screen App.js
  // can show, classified in neither list, gets no swipe-back and no warning.
  const unclassified = RENDERED.filter((s) => !SCREENS.includes(s));
  eq('every rendered screen is classified', unclassified, []);
  // And the converse — a screen removed from App.js should not linger here.
  const orphaned = SCREENS.filter((s) => !RENDERED.includes(s));
  eq('no screen in the map is unrenderable', orphaned, []);
}

console.log('\\nthe screens with no back are the intended ones');
{
  // Deliberately spelled out: adding a screen here is a decision to give it no
  // back gesture, and should be a visible diff rather than an omission.
  eq('no-back list', [...NO_BACK].sort(), ['loading', 'menu', 'pick', 'results', 'study']);
}

console.log('\\nsystem back (Android)');
{
  eq('menu exits the app', systemBackAction({ screen: 'menu' }), { type: 'exit' });
  eq('a top-level page goes to the menu', systemBackAction({ screen: 'stats' }), { type: 'navigate', target: 'menu' });
  eq('a settings sub-page goes to settings', systemBackAction({ screen: 'legal' }), { type: 'navigate', target: 'settings' });
  eq('sync goes to settings', systemBackAction({ screen: 'sync' }), { type: 'navigate', target: 'settings' });
  eq('settings leaves through its own handler', systemBackAction({ screen: 'settings' }), { type: 'leave-settings' });
  eq('settings with no deck is the root of a first run', systemBackAction({ screen: 'settings', canLeaveSettings: false }), { type: 'exit' });
  eq('a card round ends like End', systemBackAction({ screen: 'study' }), { type: 'end-round' });
  eq('a pick round ends like End', systemBackAction({ screen: 'pick' }), { type: 'end-round' });
  eq('loading cancels', systemBackAction({ screen: 'loading' }), { type: 'cancel-load' });
  eq('results go to the menu', systemBackAction({ screen: 'results' }), { type: 'results-menu' });
  eq('an unknown screen exits rather than trapping', systemBackAction({ screen: 'nope' }), { type: 'exit' });
  eq('no arguments exits', systemBackAction(), { type: 'exit' });
  // Overlays sit on top of whatever screen is showing, mid-round included.
  eq('a species detail closes first', systemBackAction({ screen: 'lexicon', hasDetail: true }), { type: 'close-detail' });
  eq('an overlay beats ending the round', systemBackAction({ screen: 'study', hasCompare: true }), { type: 'close-compare' });
  eq('the duel is above the comparison', systemBackAction({ screen: 'stats', hasDuel: true, hasCompare: true, hasDetail: true }), { type: 'close-duel' });
  eq('the comparison is above the detail', systemBackAction({ screen: 'stats', hasCompare: true, hasDetail: true }), { type: 'close-compare' });
  // Every screen must have a defined answer, so a new one cannot trap the user.
  const undecided = SCREENS.filter((s) => !systemBackAction({ screen: s }).type);
  eq('every screen has a back action', undecided, []);
  const trapped = SCREENS.filter((s) => s !== 'menu' && systemBackAction({ screen: s }).type === 'exit');
  eq('only the menu exits (settings aside)', trapped, []);
}

console.log('\\n' + (failed ? 'FAILED ' + failed : 'passed ' + passed) + (failed ? ' / ' + (passed + failed) : ''));
if (failed) process.exit(1);
`;

// stdio: 'inherit' so a failure prints its own report rather than being buried
// in an execFileSync error dump (matches test-mastery.js and friends).
execFileSync(process.execPath, ['--input-type=module', '-e', script], {
  stdio: 'inherit',
});
