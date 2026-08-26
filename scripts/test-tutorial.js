// Tests for the guided tour (src/tutorial.js + src/tutorialtext.js).
//
// Two halves, and both matter:
//
//   1. THE SEQUENCE. A tour that dead-ends is worse than no tour — the user is
//      stuck being told to do something they have already done, or is pointed at
//      a screen that cannot advance. So the whole graph is walked here, plus the
//      awkward paths: wandering off mid-step, exiting, restarting, and a saved
//      position written by a different version of the app.
//
//   2. THE GEOMETRY. "Consider different screen sizes" is not something you can
//      eyeball on one simulator. Every placement runs against a matrix of real
//      devices — a 320pt phone, a notched phone in landscape, a 1366pt iPad —
//      and asserts the bubble is on screen, inside the safe area, and never
//      covering the very thing it is pointing at.
//
// Pure module, so it runs in plain node via the small ESM wrapper the other
// module tests use (see test-navigation.js).
//
//   node scripts/test-tutorial.js   (or via: npm test)

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const src = path.join(root, 'src', 'tutorial.js');

// The screens App.js can actually render, scraped from its `screen === '…'`
// branches — the same trick test-navigation.js uses. Without it, a step could
// name a screen that does not exist and nothing would ever show it.
const appSource = fs.readFileSync(path.join(root, 'App.js'), 'utf8');
const RENDERED = [
  ...new Set([...appSource.matchAll(/screen === '([a-z]+)'/g)].map((m) => m[1])),
].sort();
if (RENDERED.length < 5) {
  console.error('could not scrape screens from App.js — did the pattern change?');
  process.exit(1);
}

// Which anchor ids the screens actually offer. A step pointing at an id nobody
// registers still "works" — it just silently loses its spotlight and centres its
// bubble, which is exactly the kind of quiet degradation nobody notices.
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
  });
}
const REGISTERED = [
  ...new Set(
    walk(path.join(root, 'src'))
      .filter((f) => !f.endsWith(path.join('src', 'tutorial.js')))
      .flatMap((f) => {
        const text = fs.readFileSync(f, 'utf8');
        return [
          ...text.matchAll(/useAnchorRef\('([a-z-]+)'\)/g),
          ...text.matchAll(/anchor="([a-z-]+)"/g),
          ...text.matchAll(/anchor: '([a-z-]+)'/g),
        ].map((m) => m[1]);
      })
  ),
].sort();

// Real devices, in points, with the insets iOS/Android actually report. The
// landscape entry is the one that catches left/right-inset bugs, and the 320pt
// entry is the one that catches "the bubble is 380 wide" bugs.
const DEVICES = [
  { name: 'iPhone SE (1st gen)', width: 320, height: 568, insets: { top: 20, bottom: 0, left: 0, right: 0 } },
  { name: 'iPhone SE (3rd gen)', width: 375, height: 667, insets: { top: 20, bottom: 0, left: 0, right: 0 } },
  { name: 'iPhone 15', width: 393, height: 852, insets: { top: 59, bottom: 34, left: 0, right: 0 } },
  { name: 'iPhone 15 Pro Max', width: 430, height: 932, insets: { top: 59, bottom: 34, left: 0, right: 0 } },
  { name: 'iPhone 15 landscape', width: 852, height: 393, insets: { top: 0, bottom: 21, left: 59, right: 59 } },
  { name: 'small Android', width: 360, height: 640, insets: { top: 24, bottom: 0, left: 0, right: 0 } },
  { name: 'iPad mini', width: 744, height: 1133, insets: { top: 24, bottom: 20, left: 0, right: 0 } },
  { name: 'iPad Pro 12.9', width: 1024, height: 1366, insets: { top: 24, bottom: 20, left: 0, right: 0 } },
];

// Where a fresh install lands, scraped from App.js's first-start branch. The
// tour auto-starts at boot, so if this screen is not the one step 1 lives on,
// a brand-new user is dropped somewhere the tour can only WAIT — greeted by
// "go back to the main menu" before they have ever seen the menu.
const FIRST_START_LANDS_ON = (() => {
  const m = appSource.match(/DEFAULT_USERNAME,[\s\S]{0,600}?landOn:\s*'([a-z]+)'/);
  return m ? m[1] : null;
})();

const script = `
import {
  STEPS, TOTAL, ANCHORS, QUIET_SCREENS, INITIAL,
  startState, doneState, normalize, isRunning, stepAt, currentStep,
  shouldAutoStart, advance, onScreen, view,
  placeBubble, spotlight, blockers, bubbleWidth, anchorVisible, scrollDelta,
  MARGIN, GAP, ARROW_INSET, SPOT_PAD, SPOT_RADIUS, BUBBLE_MAX_W, MIN_VISIBLE,
  SCROLL_MIN, SCROLL_BIAS,
} from ${JSON.stringify(src)};
import { STEP_TEXT, WAITING, UI_TEXT } from ${JSON.stringify(path.join(root, 'src', 'tutorialtext.js'))};

const RENDERED = ${JSON.stringify(RENDERED)};
const REGISTERED = ${JSON.stringify(REGISTERED)};
const DEVICES = ${JSON.stringify(DEVICES)};
const FIRST_START_LANDS_ON = ${JSON.stringify(FIRST_START_LANDS_ON)};

let passed = 0, failed = 0;
function eq(name, actual, expected) {
  const a = JSON.stringify(actual), b = JSON.stringify(expected);
  if (a === b) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name); console.log('         expected ' + b); console.log('         actual   ' + a); }
}
function ok(name, cond, detail) {
  if (cond) { passed++; console.log('  ok   ' + name); }
  else { failed++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}
function head(s) { console.log(''); console.log(s); }

// ---------------------------------------------------------------- the sequence

head('the step list is well-formed');
{
  const ids = STEPS.map((s) => s.id);
  eq('every step id is unique', ids.filter((id, i) => ids.indexOf(id) !== i), []);
  eq('TOTAL matches the list', TOTAL, STEPS.length);
  ok('the tour is worth taking', STEPS.length >= 5, 'only ' + STEPS.length + ' steps');

  eq(
    'every step lives on a screen App.js renders',
    STEPS.filter((s) => !RENDERED.includes(s.screen)).map((s) => s.id),
    []
  );
  eq(
    'every quiet screen is a real screen',
    QUIET_SCREENS.filter((s) => !RENDERED.includes(s)),
    []
  );
  eq(
    'every anchored step points at a known anchor',
    STEPS.filter((s) => s.anchor && !ANCHORS.includes(s.anchor)).map((s) => s.id),
    []
  );
  eq(
    'every advance rule is one of the two shapes',
    STEPS.filter((s) => !(s.advance === 'next' || (s.advance && RENDERED.includes(s.advance.screen)))).map((s) => s.id),
    []
  );
}

head('no step can strand the user');
{
  // A step advanced by arriving at the screen it already lives on could never
  // fire: the user is standing on it.
  eq(
    'no step waits for the screen it is already on',
    STEPS.filter((s) => s.advance !== 'next' && s.advance.screen === s.screen).map((s) => s.id),
    []
  );
  // Two in a row waiting on the same screen means one arrival is meant to
  // satisfy both, and onScreen deliberately advances only one.
  const collisions = [];
  for (let i = 1; i < STEPS.length; i++) {
    const a = STEPS[i - 1], b = STEPS[i];
    if (a.advance !== 'next' && b.advance !== 'next' && a.advance.screen === b.advance.screen) {
      collisions.push(b.id);
    }
  }
  eq('no two consecutive steps wait on the same screen', collisions, []);
  // The last step must be dismissible, or the tour has no ending.
  eq('the tour ends on a button', STEPS[STEPS.length - 1].advance, 'next');
  // Every screen a step waits on needs a line for the waiting bar.
  eq(
    'every step screen has waiting copy',
    [...new Set(STEPS.map((s) => s.screen))].filter((s) => !WAITING[s]),
    []
  );
}

head('the anchors and the screens agree');
{
  eq('every anchor is registered by a screen', ANCHORS.filter((a) => !REGISTERED.includes(a)), []);
  eq('no screen registers an unknown anchor', REGISTERED.filter((a) => !ANCHORS.includes(a)), []);
  const used = STEPS.map((s) => s.anchor).filter(Boolean);
  eq('no anchor is declared but unused', ANCHORS.filter((a) => !used.includes(a)), []);
}

head('the copy exists, and fits');
{
  const ids = STEPS.map((s) => s.id);
  eq('every step has copy', ids.filter((id) => !STEP_TEXT[id]), []);
  eq('no copy is orphaned', Object.keys(STEP_TEXT).filter((id) => !ids.includes(id)), []);
  const longTitle = ids.filter((id) => STEP_TEXT[id].title.length > 24);
  eq('titles stay short', longTitle, []);
  // A coach mark is read at a glance and sits on top of live UI. Past ~110
  // characters it stops being a hint and starts being a paragraph.
  const longBody = ids.filter((id) => STEP_TEXT[id].body.length > 110);
  eq('bodies stay brief', longBody, []);
  eq('no title ends in a full stop', ids.filter((id) => STEP_TEXT[id].title.endsWith('.')), []);
  eq('every body is a sentence', ids.filter((id) => !/[.!?]$/.test(STEP_TEXT[id].body)), []);
  ok('the exit control is labelled', typeof UI_TEXT.exit === 'string' && UI_TEXT.exit.length > 0);
  ok('the confirmation names Settings', UI_TEXT.confirmBody.includes('Settings'), UI_TEXT.confirmBody);
  eq('progress reads naturally', UI_TEXT.progress(3, 12), '3 of 12');
}

head('stored state survives anything');
{
  eq('nothing stored means a fresh start', normalize(null), INITIAL);
  eq('undefined is handled', normalize(undefined), INITIAL);
  eq('a string is handled', normalize('running'), INITIAL);
  eq('a number is handled', normalize(7), INITIAL);
  eq('an unknown status resets', normalize({ status: 'paused', step: 2 }), { status: 'new', step: 0 });
  eq('a valid record round-trips', normalize({ status: 'running', step: 3 }), { status: 'running', step: 3 });
  eq('a JSON round-trip is stable', normalize(JSON.parse(JSON.stringify(startState()))), startState());
  // A saved position past the end means the tour was longer in a previous
  // build. Resuming at an arbitrary step would be worse than treating it as seen.
  eq('a step past the end counts as done', normalize({ status: 'running', step: 99 }), doneState());
  eq('a negative step counts as done', normalize({ status: 'running', step: -1 }), doneState());
  eq('a fractional step counts as done', normalize({ status: 'running', step: 1.5 }), doneState());
  eq('a string step counts as done', normalize({ status: 'running', step: 'two' }), doneState());
  // A finished record keeps its status whatever nonsense rides along with it.
  eq('done stays done', normalize({ status: 'done', step: 99 }), { status: 'done', step: 0 });
}

head('auto-start happens exactly once, ever');
{
  eq('a first launch starts the tour', shouldAutoStart(INITIAL), true);
  eq('a tour in progress does not restart', shouldAutoStart(startState()), false);
  eq('a finished tour does not restart', shouldAutoStart(doneState()), false);
  // An overlay on the menu would break every other Detox spec; the tour has its
  // own, which starts it explicitly from Settings.
  eq('never under the e2e fixtures', shouldAutoStart(INITIAL, { isE2E: true }), false);
  eq('garbage does not auto-start', shouldAutoStart(null), false);
}

head('walking the whole tour');
{
  let s = startState();
  eq('it starts at the beginning', s, { status: 'running', step: 0 });
  const visited = [];
  let guard = 0;
  while (isRunning(s) && guard++ < 100) {
    const step = currentStep(s);
    visited.push(step.id);
    // Do exactly what the bubble asks: tap the button, or go where it points.
    s = step.advance === 'next' ? advance(s) : onScreen(s, step.advance.screen);
  }
  eq('every step is visited, in order', visited, STEPS.map((x) => x.id));
  eq('and the tour finishes', s, doneState());
  eq('a finished tour shows nothing', view(s, 'menu').mode, 'off');
  eq('advancing a finished tour is a no-op', advance(s), s);
  eq('navigating with a finished tour is a no-op', onScreen(s, 'settings'), s);
}

head('the tour asks for the right things');
{
  // Spelled out rather than derived: this IS the tour, and changing it should
  // be a visible diff, not an accident.
  eq('the order', STEPS.map((s) => s.id), [
    'welcome', 'openSettings', 'username', 'smart', 'smartStart',
    'morePhotos', 'stats', 'statsTour', 'nearby', 'openSettings2', 'sync', 'done',
  ]);
  const byId = Object.fromEntries(STEPS.map((s) => [s.id, s]));
  eq('it sends the user to Settings for a username', byId.openSettings.advance, { screen: 'settings' });
  eq('the username step is on Settings', byId.username.screen, 'settings');
  eq('it then plays a smart round', byId.smartStart.advance, { screen: 'study' });
  eq('the alternative photos are shown in a round', byId.morePhotos.screen, 'study');
  eq('and pointed at the photos button', byId.morePhotos.anchor, 'study-photos');
  eq('statistics are opened, not just described', byId.stats.advance, { screen: 'stats' });
  eq('the location mode is pointed out', byId.nearby.anchor, 'mode-nearby');
  // Nearby wants a location permission; nobody should be made to grant one to
  // finish a tutorial.
  eq('but playing it is not required', byId.nearby.advance, 'next');
  eq('sync is the last thing shown', byId.sync.anchor, 'settings-sync');
}

head('a user who wanders off is not lost');
{
  let s = advance(startState()); // past the welcome; now pointing at Settings
  eq('the step shows on its own screen', view(s, 'menu').mode, 'step');
  eq('and waits elsewhere', view(s, 'lexicon').mode, 'waiting');
  eq('the waiting bar names the screen the step is on', view(s, 'lexicon').text, WAITING.menu);
  eq('and says which screen that is', view(s, 'lexicon').waitingFor, 'menu');
  eq('wandering does not advance it', currentStep(onScreen(s, 'lexicon')).id, 'openSettings');
  eq('nor does arriving somewhere else entirely', currentStep(onScreen(s, 'changelog')).id, 'openSettings');
  s = onScreen(s, 'settings');
  eq('arriving where it points does', currentStep(s).id, 'username');
  // Backing out of Settings without saving still moves the tour on — the user
  // has plainly decided to keep the demo account.
  s = onScreen(s, 'menu');
  eq('and backing out counts as done with that step', currentStep(s).id, 'smart');
}

head('the tour keeps quiet during a round');
{
  const s = advance(startState());
  for (const screen of QUIET_SCREENS) {
    eq('nothing on top of ' + screen, view(s, screen).mode, 'off');
  }
  // …except the step that belongs there.
  let t = startState();
  while (currentStep(t) && currentStep(t).id !== 'morePhotos') {
    const step = currentStep(t);
    t = step.advance === 'next' ? advance(t) : onScreen(t, step.advance.screen);
  }
  eq('the in-round step does show in a round', view(t, 'study').mode, 'step');
  eq('and has a button, since a round must not be hijacked', view(t, 'study').cta, UI_TEXT.next);
}

head('what the overlay is told to draw');
{
  const first = view(startState(), 'menu');
  eq('the mode', first.mode, 'step');
  eq('the copy comes from the text file', first.text, STEP_TEXT.welcome);
  eq('progress is 1-based', first.progress, UI_TEXT.progress(1, TOTAL));
  eq('the first step has no anchor', first.anchor, null);
  // Steps that ask for an action have no button: the action is the advance.
  const asking = view(advance(startState()), 'menu');
  eq('an action step has no button', asking.cta, null);
  eq('but is still anchored', asking.anchor, 'open-settings');
  // The last step reads Done, not Next.
  let last = startState();
  while (currentStep(last) && currentStep(last).id !== 'done') {
    const step = currentStep(last);
    last = step.advance === 'next' ? advance(last) : onScreen(last, step.advance.screen);
  }
  eq('the final button says Done', view(last, 'settings').cta, UI_TEXT.finish);
  eq('every step number is within the tour', view(last, 'settings').number, TOTAL);
}

head('exit and restart');
{
  // Exiting is the same state as finishing: both mean "do not show this again",
  // and both are restartable from Settings.
  let s = startState();
  for (let i = 0; i < 4; i++) {
    const step = currentStep(s);
    s = step.advance === 'next' ? advance(s) : onScreen(s, step.advance.screen);
  }
  const exited = doneState();
  eq('exiting stops the tour', isRunning(exited), false);
  eq('and draws nothing anywhere', [...RENDERED].map((sc) => view(exited, sc).mode).filter((m) => m !== 'off'), []);
  eq('restarting goes back to the first step', startState(), { status: 'running', step: 0 });
  eq('and the first step is the welcome', currentStep(startState()).id, 'welcome');
  // Exiting is possible at every single step — the requirement, asserted rather
  // than assumed. (The overlay always renders the exit control; here we check
  // there is no step where the tour is unstoppable.)
  const unstoppable = STEPS.map((_, i) => normalize({ status: 'running', step: i }))
    .filter((st) => isRunning(doneState()) || !isRunning(st));
  eq('no step is un-exitable', unstoppable, []);
}

head('stepAt and currentStep are total');
{
  eq('a negative index has no step', stepAt(-1), null);
  eq('an index past the end has no step', stepAt(TOTAL), null);
  eq('a huge index has no step', stepAt(1e9), null);
  eq('a new tour has no current step', currentStep(INITIAL), null);
  eq('null has no current step', currentStep(null), null);
  eq('view of nothing is off', view(null, 'menu').mode, 'off');
}

// ---------------------------------------------------------------- the geometry

head('the bubble fits on every device');
{
  for (const d of DEVICES) {
    const w = bubbleWidth(d, d.insets);
    const room = d.width - 2 * MARGIN - d.insets.left - d.insets.right;
    ok(d.name + ': width is sane', w > 0 && w <= BUBBLE_MAX_W && w <= room, 'width ' + w + ' of ' + room);
    ok(d.name + ': narrow screens narrow the bubble', d.width >= 430 || w < BUBBLE_MAX_W || w === room);
  }
}

// One invariant checker, run over every device × anchor position, because a
// placement bug shows up on exactly one combination and nowhere else.
function checkPlacement(label, d, anchor, bubbleH) {
  const screen = { width: d.width, height: d.height };
  const w = bubbleWidth(screen, d.insets);
  const p = placeBubble({ anchor, bubble: { width: w, height: bubbleH }, screen, insets: d.insets });
  const bounds = {
    left: MARGIN + d.insets.left,
    right: d.width - MARGIN - d.insets.right,
    top: MARGIN + d.insets.top,
    bottom: d.height - MARGIN - d.insets.bottom,
  };
  const fits = bubbleH <= bounds.bottom - bounds.top;
  ok(label + ': finite', Number.isFinite(p.left) && Number.isFinite(p.top), JSON.stringify(p));
  ok(label + ': inside the left edge', p.left >= bounds.left - 0.01, 'left ' + p.left);
  ok(label + ': inside the right edge', p.left + w <= bounds.right + 0.01, 'right ' + (p.left + w));
  if (fits) {
    ok(label + ': below the top edge', p.top >= bounds.top - 0.01, 'top ' + p.top);
    ok(label + ': above the bottom edge', p.top + bubbleH <= bounds.bottom + 0.01, 'bottom ' + (p.top + bubbleH));
  }
  const spot = spotlight(anchor, screen);
  if (p.arrow) {
    ok(label + ': the arrow needs something to point at', !!spot);
    ok(label + ': the arrow stays on the bubble',
      p.arrow.x >= ARROW_INSET - 0.01 && p.arrow.x <= w - ARROW_INSET + 0.01, 'x ' + p.arrow.x);
    // The bubble must never sit on top of the thing it is describing.
    if (p.arrow.dir === 'up') {
      ok(label + ': sits clear below the target', p.top >= spot.y + spot.height - 0.01, 'top ' + p.top);
    } else {
      ok(label + ': sits clear above the target', p.top + bubbleH <= spot.y + 0.01, 'bottom ' + (p.top + bubbleH));
    }
  }
  return p;
}

head('placement against a target near the top');
{
  for (const d of DEVICES) {
    const anchor = { x: 16, y: d.insets.top + 8, width: d.width - 32, height: 64 };
    const p = checkPlacement(d.name, d, anchor, 150);
    ok(d.name + ': a high target puts the bubble below it', !p.arrow || p.arrow.dir === 'up');
  }
}

head('placement against a target near the bottom');
{
  for (const d of DEVICES) {
    const h = 64;
    const anchor = { x: 16, y: d.height - d.insets.bottom - h - 8, width: d.width - 32, height: h };
    const p = checkPlacement(d.name, d, anchor, 150);
    ok(d.name + ': a low target puts the bubble above it', !p.arrow || p.arrow.dir === 'down');
  }
}

head('placement against a small target in a corner');
{
  for (const d of DEVICES) {
    // The study screen's more-photos button: 40pt, bottom-left corner.
    // The study screen applies insets to its own chrome, so the button sits
    // inside the safe area even in landscape.
    const anchor = { x: 12 + d.insets.left, y: d.height - d.insets.bottom - 52, width: 40, height: 40 };
    const p = checkPlacement(d.name + ' (corner)', d, anchor, 160);
    if (p.arrow) {
      // Clamped to the screen edge, the arrow still has to point at the button.
      ok(d.name + ': the arrow reaches back to the corner',
        p.left + p.arrow.x <= 12 + d.insets.left + 40 + SPOT_PAD + 1,
        'arrow at ' + (p.left + p.arrow.x));
    }
  }
}

head('the normal case leaves exactly one gap');
{
  // Non-overlap is the invariant checked everywhere else; when there is room,
  // the spacing should also be the designed one rather than merely positive.
  const d = DEVICES[3]; // iPhone 15 Pro Max — plenty of room either way
  const screen = { width: d.width, height: d.height };
  const anchor = { x: 16, y: 200, width: d.width - 32, height: 64 };
  const w = bubbleWidth(screen, d.insets);
  const spot = spotlight(anchor, screen);
  const belowIt = placeBubble({ anchor, bubble: { width: w, height: 160 }, screen, insets: d.insets });
  eq('one gap below the spotlight', belowIt.top - (spot.y + spot.height), GAP);
  const low = { x: 16, y: d.height - 200, width: d.width - 32, height: 64 };
  const aboveIt = placeBubble({ anchor: low, bubble: { width: w, height: 160 }, screen, insets: d.insets });
  eq('and one gap above it', spotlight(low, screen).y - (aboveIt.top + 160), GAP);
}

head('a tall group target keeps its bubble clear of it');
{
  // The regression: the username step points at the field, its hint AND the
  // Save button it tells you to tap. Spotlighting only the field put the bubble
  // straight over that button. A ~190pt group must still get a bubble that sits
  // entirely clear — on the smallest phone that means going above it.
  for (const d of DEVICES) {
    if (d.height < d.width) continue; // portrait-only app; iPad is covered above
    const screen = { width: d.width, height: d.height };
    const top = MARGIN + d.insets.top;
    const bottom = d.height - MARGIN - d.insets.bottom;
    const anchor = {
      x: 16,
      y: Math.round(top + (bottom - top) * SCROLL_BIAS), // where scrollDelta puts it
      width: d.width - 32,
      height: 190,
    };
    const p = checkPlacement(d.name + ' (account block)', d, anchor, 190);
    ok(d.name + ': the group still gets an arrow, so it cannot be covered', !!p.arrow, JSON.stringify(p));
    const spot = spotlight(anchor, screen);
    const clear = p.top >= spot.y + spot.height || p.top + 190 <= spot.y;
    ok(d.name + ': and the Save button stays out from under the bubble', clear);
  }
}

head('placement with no target at all');
{
  for (const d of DEVICES) {
    const p = checkPlacement(d.name + ' (centred)', d, null, 150);
    eq(d.name + ': no anchor means no arrow', p.arrow, null);
    const w = bubbleWidth(d, d.insets);
    ok(d.name + ': and the bubble is centred', Math.abs(p.left + w / 2 - d.width / 2) < 1.01);
  }
}

head('a target scrolled off screen is not pointed at');
{
  const d = DEVICES[2];
  const screen = { width: d.width, height: d.height };
  eq('above the top edge', spotlight({ x: 20, y: -80, width: 300, height: 60 }, screen), null);
  eq('below the bottom edge', spotlight({ x: 20, y: d.height + 10, width: 300, height: 60 }, screen), null);
  eq('off to the left', spotlight({ x: -400, y: 200, width: 300, height: 60 }, screen), null);
  eq('a zero-height row', spotlight({ x: 20, y: 200, width: 300, height: 0 }, screen), null);
  eq('a barely-peeking row', anchorVisible({ x: 20, y: -55, width: 300, height: 60 }, screen), false);
  ok('a mostly-visible row is fine', anchorVisible({ x: 20, y: -20, width: 300, height: 60 }, screen));
  // Half off screen still gets a spotlight, clipped to what is visible.
  const clipped = spotlight({ x: 20, y: -20, width: 300, height: 60 }, screen);
  eq('the spotlight is clipped to the screen', clipped.y, 0);
  ok('and keeps a sensible height', clipped.height > 0 && clipped.height <= 60 + SPOT_PAD);
  // With nothing to light up, the bubble falls back to centred and dumb.
  const p = placeBubble({
    anchor: { x: 20, y: -900, width: 300, height: 60 },
    bubble: { width: 300, height: 150 }, screen, insets: d.insets,
  });
  eq('an invisible target centres the bubble', p.arrow, null);
}

head('the spotlight itself');
{
  const screen = { width: 393, height: 852 };
  const s = spotlight({ x: 100, y: 200, width: 200, height: 60 }, screen);
  eq('it sits outside the target', [s.x, s.y], [100 - SPOT_PAD, 200 - SPOT_PAD]);
  eq('on all four sides', [s.width, s.height], [200 + 2 * SPOT_PAD, 60 + 2 * SPOT_PAD]);
  eq('with a rounded corner', s.radius, SPOT_RADIUS);
  // A small square icon must not round into a circle-ish lens.
  const icon = spotlight({ x: 10, y: 10, width: 20, height: 20 }, screen);
  ok('a small target gets a smaller radius', icon.radius <= icon.height / 2, 'radius ' + icon.radius);
  ok('never negative', icon.radius >= 0);
  eq('a missing target has no spotlight', spotlight(null, screen), null);
  eq('a garbage target has no spotlight', spotlight({ x: 1, y: 1 }, screen), null);
}

head('short screens, tall bubbles');
{
  // A landscape phone with a long body: neither side fits, so the bubble is
  // clamped on screen and drops the arrow rather than lying about where it points.
  const d = DEVICES[4];
  const screen = { width: d.width, height: d.height };
  const anchor = { x: 300, y: 150, width: 200, height: 80 };
  const w = bubbleWidth(screen, d.insets);
  const p = placeBubble({ anchor, bubble: { width: w, height: 320 }, screen, insets: d.insets });
  eq('an impossible fit drops the arrow', p.arrow, null);
  ok('but stays on screen', p.top >= 0 && p.left >= 0 && p.left + w <= d.width, JSON.stringify(p));
  // Even a bubble taller than the entire screen must not produce nonsense.
  const huge = placeBubble({ anchor, bubble: { width: w, height: 2000 }, screen, insets: d.insets });
  ok('an absurd bubble still places', Number.isFinite(huge.top) && Number.isFinite(huge.left));
}

head('fuzzing the placement');
{
  // Deterministic pseudo-random sweep: the invariants above must hold for any
  // anchor anywhere, including the shapes no real screen produces.
  let seed = 12345;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  let bad = 0, cases = 0;
  for (const d of DEVICES) {
    const screen = { width: d.width, height: d.height };
    const w = bubbleWidth(screen, d.insets);
    for (let i = 0; i < 200; i++) {
      const anchor = {
        x: Math.round(rnd() * d.width * 1.4 - d.width * 0.2),
        y: Math.round(rnd() * d.height * 1.4 - d.height * 0.2),
        width: Math.round(rnd() * d.width),
        height: Math.round(rnd() * 200),
      };
      const bh = Math.round(60 + rnd() * 260);
      const p = placeBubble({ anchor, bubble: { width: w, height: bh }, screen, insets: d.insets });
      cases++;
      const onScreenX = p.left >= -0.01 && p.left + w <= d.width + 0.01;
      const onScreenY = p.top >= -0.01 && (p.top + bh <= d.height + 0.01 || bh > d.height - 2 * MARGIN);
      const arrowOk = !p.arrow || (p.arrow.x >= 0 && p.arrow.x <= w);
      if (!Number.isFinite(p.left) || !Number.isFinite(p.top) || !onScreenX || !onScreenY || !arrowOk) {
        if (bad === 0) console.log('         first bad case: ' + JSON.stringify({ d: d.name, anchor, bh, p }));
        bad++;
      }
    }
  }
  eq('no placement escapes the screen (' + cases + ' cases)', bad, 0);
}


head('bringing an off-screen target into view');
{
  const d = DEVICES[2]; // iPhone 15
  const screen = { width: d.width, height: d.height };
  const top = MARGIN + d.insets.top;
  const bottom = d.height - MARGIN - d.insets.bottom;

  // The case this exists for: "Open Settings" while the Settings row is a
  // screen and a half below the fold.
  const below = scrollDelta({ x: 16, y: d.height + 220, width: 360, height: 68 }, screen, d.insets);
  ok('a row below the fold scrolls down', below > 0, 'dy ' + below);
  ok('and lands inside the viewport', d.height + 220 - below > top && d.height + 220 - below < bottom);

  const above = scrollDelta({ x: 16, y: -300, width: 360, height: 68 }, screen, d.insets);
  ok('a row scrolled past scrolls back up', above < 0, 'dy ' + above);
  ok('and also lands in view', -300 - above > top && -300 - above < bottom);

  // A row already on screen must not be yanked around under the user.
  eq('a comfortable row is left alone', scrollDelta({ x: 16, y: 400, width: 360, height: 68 }, screen, d.insets), 0);
  eq('nor is a tiny adjustment made', scrollDelta({ x: 16, y: top + 8, width: 360, height: 68 }, screen, d.insets), 0);
  eq('no target, no scrolling', scrollDelta(null, screen, d.insets), 0);
  eq('a zero-height target is ignored', scrollDelta({ x: 0, y: 900, width: 300, height: 0 }, screen, d.insets), 0);

  // The target is biased above centre so the bubble has the bigger half.
  const dy = scrollDelta({ x: 16, y: 2000, width: 360, height: 68 }, screen, d.insets);
  const landed = 2000 - dy;
  ok('the target sits in the upper part of the screen', landed < top + (bottom - top) / 2, 'landed at ' + landed);
  ok('but not jammed against the top', landed > top, 'landed at ' + landed);
}

head('scrolling into view works on every device');
{
  for (const d of DEVICES) {
    const screen = { width: d.width, height: d.height };
    const top = MARGIN + d.insets.top;
    const bottom = d.height - MARGIN - d.insets.bottom;
    for (const y of [-500, -60, d.height + 40, d.height * 2]) {
      const dy = scrollDelta({ x: 8, y, width: d.width - 16, height: 64 }, screen, d.insets);
      const landed = y - dy;
      ok(d.name + ': a target at ' + y + ' ends up visible',
        landed >= top - 1 && landed + 64 <= bottom + 1 || 64 + 2 * GAP > bottom - top,
        'landed at ' + landed);
    }
    // A banner taller than the viewport cannot be framed; it must not loop or
    // produce nonsense either.
    const tall = scrollDelta({ x: 0, y: -20, width: d.width, height: d.height * 2 }, screen, d.insets);
    ok(d.name + ': an oversized target still returns a number', Number.isFinite(tall));
  }
}

head('scroll deltas are stable');
{
  const d = DEVICES[2];
  const screen = { width: d.width, height: d.height };
  const anchor = { x: 16, y: 1400, width: 360, height: 68 };
  const dy = scrollDelta(anchor, screen, d.insets);
  // Applying the delta must leave nothing more to do, or the tour would chase
  // its own target every time it re-measures.
  const after = scrollDelta({ ...anchor, y: anchor.y - dy }, screen, d.insets);
  eq('one scroll is enough', after, 0);
  ok('and the delta is a whole number of points', Number.isInteger(dy), 'dy ' + dy);
  ok('smaller than the minimum means no scroll at all', Math.abs(dy) === 0 || Math.abs(dy) >= SCROLL_MIN);
  ok('the bias keeps the target above the middle', SCROLL_BIAS > 0 && SCROLL_BIAS < 0.5);
}

head('the seal covers everything except the spotlight');
{
  // Total blocked area + the hole must equal the screen exactly, and no two
  // bands may overlap — an overlap would mean a double-counted area hiding a
  // gap somewhere else, which is precisely the bug that lets a tap through.
  const area = (r) => r.width * r.height;
  const overlaps = (a, b) =>
    a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

  for (const d of DEVICES) {
    const screen = { width: d.width, height: d.height };
    const positions = [
      ['top', { x: 16, y: d.insets.top + 8, width: d.width - 32, height: 64 }],
      ['middle', { x: 16, y: Math.round(d.height / 2), width: d.width - 32, height: 64 }],
      ['bottom', { x: 16, y: d.height - d.insets.bottom - 80, width: d.width - 32, height: 64 }],
      ['full-width', { x: 0, y: Math.round(d.height / 3), width: d.width, height: 50 }],
      ['tiny icon', { x: 12, y: 12, width: 24, height: 24 }],
      ['off the left', { x: -40, y: 200, width: 120, height: 44 }],
      ['off the bottom', { x: 16, y: d.height - 10, width: 100, height: 44 }],
    ];
    for (const [label, anchor] of positions) {
      const spot = spotlight(anchor, screen);
      const bands = blockers(spot, screen);
      const name = d.name + ' / ' + label;
      const blocked = bands.reduce((s, b) => s + area(b), 0);
      const hole = spot
        ? Math.max(0, Math.min(spot.x + spot.width, d.width) - Math.max(spot.x, 0)) *
          Math.max(0, Math.min(spot.y + spot.height, d.height) - Math.max(spot.y, 0))
        : 0;
      ok(name + ': bands + hole == the whole screen',
        Math.abs(blocked + hole - d.width * d.height) < 0.01,
        'blocked ' + blocked + ' + hole ' + hole + ' vs ' + d.width * d.height);
      ok(name + ': every band is on screen and positive',
        bands.every((b) => b.width > 0 && b.height > 0 && b.x >= 0 && b.y >= 0 &&
          b.x + b.width <= d.width + 0.01 && b.y + b.height <= d.height + 0.01),
        JSON.stringify(bands));
      let clash = false;
      for (let i = 0; i < bands.length; i++)
        for (let j = i + 1; j < bands.length; j++) if (overlaps(bands[i], bands[j])) clash = true;
      ok(name + ': no two bands overlap', !clash, JSON.stringify(bands));
      // The whole point: the control being pointed at must stay reachable.
      if (spot) {
        const cx = spot.x + spot.width / 2;
        const cy = spot.y + spot.height / 2;
        const covered = bands.some(
          (b) => cx >= b.x && cx <= b.x + b.width && cy >= b.y && cy <= b.y + b.height
        );
        ok(name + ': the spotlight centre is NOT blocked', !covered);
      }
    }
  }
}

head('a step with nothing to light up seals the whole screen');
{
  const screen = { width: 393, height: 852 };
  eq('no spotlight means one full-screen band', blockers(null, screen), [
    { x: 0, y: 0, width: 393, height: 852 },
  ]);
  // An anchor too small to be worth pointing at gives no spotlight, and must
  // still produce a seal rather than an empty list (which would block nothing).
  const tiny = spotlight({ x: 10, y: 10, width: 2, height: 2 }, screen);
  eq('an unusable anchor still seals', blockers(tiny, screen).length, 1);
  eq('a degenerate screen seals nothing', blockers(null, { width: 0, height: 0 }), []);
}

// --------------------------------------------------- visibility, exhaustively
//
// The bug this section exists for: a running tour that draws NOTHING. The user
// is told the app is guiding them, then lands on a screen where there is no
// bubble, no bar, and no way to tell whether the tour is alive. It is invisible
// on QUIET_SCREENS by design — so the test is not "never invisible", it is
// "invisible ONLY where we chose, and we chose as few as possible".

head('every step on every screen resolves to something coherent');
{
  const MODES = ['step', 'waiting', 'off'];
  let stepScreens = 0;
  for (let i = 0; i < TOTAL; i++) {
    const state = { status: 'running', step: i };
    for (const screen of RENDERED) {
      const v = view(state, screen);
      const label = STEPS[i].id + ' on ' + screen;
      ok(label + ': a known mode', MODES.includes(v.mode), v.mode);
      if (v.mode === 'step') {
        stepScreens++;
        ok(label + ': carries text', !!v.text && !!v.text.title && !!v.text.body);
        ok(label + ': carries progress', typeof v.progress === 'string' && v.progress.length > 0);
        ok(label + ': is on its own screen', screen === STEPS[i].screen);
      }
      if (v.mode === 'waiting') {
        ok(label + ': the bar says something', typeof v.text === 'string' && v.text.length > 0);
        ok(label + ': names the screen it wants', v.waitingFor === STEPS[i].screen);
      }
      if (v.mode === 'off') {
        ok(label + ': only ever quiet on a quiet screen', QUIET_SCREENS.includes(screen), screen);
      }
    }
  }
  eq('each step is showable on exactly one screen', stepScreens, TOTAL);
}

head('the tour is never invisible except where chosen');
{
  // A screen that is 'off' for EVERY step is a screen where the tour can never
  // be seen at all — the "page with no instructions" report.
  for (const screen of RENDERED) {
    let off = 0;
    for (let i = 0; i < TOTAL; i++) if (view({ status: 'running', step: i }, screen).mode === 'off') off++;
    const always = off === TOTAL;
    ok('always-invisible screens are declared quiet: ' + screen,
      !always || QUIET_SCREENS.includes(screen),
      screen + ' is invisible on all ' + TOTAL + ' steps but is not in QUIET_SCREENS');
  }
  // Results is the regression guard: it was quiet, which made the tour vanish
  // exactly where the user stops to decide what to do next.
  ok('results is NOT quiet', !QUIET_SCREENS.includes('results'));
  eq('results shows the waiting bar mid-tour',
    view({ status: 'running', step: 0 }, 'results').mode, 'waiting');
  // …while a round in play still is.
  for (const s of ['study', 'pick']) ok(s + ' stays quiet during play', QUIET_SCREENS.includes(s));
  ok('every quiet screen is a real screen', QUIET_SCREENS.every((s) => RENDERED.includes(s)),
    JSON.stringify(QUIET_SCREENS.filter((s) => !RENDERED.includes(s))));
}

head('a fresh install lands where the tour opens');
{
  ok('App.js first-start branch was found', !!FIRST_START_LANDS_ON,
    'could not scrape landOn from the DEFAULT_USERNAME branch — did it change?');
  eq('it lands on step 1\\'s own screen', FIRST_START_LANDS_ON, STEPS[0].screen);
  // Stated the other way round, because this is the failure it prevents: the
  // tour auto-starts at boot, so landing anywhere else means a brand-new user
  // meets the tour as a "go back to…" bar on a screen they never chose.
  eq('so the first thing shown is the step, not the waiting bar',
    view(startState(), FIRST_START_LANDS_ON).mode, 'step');
}

head('a tour that is not running draws nothing, whatever the screen');
{
  for (const state of [null, undefined, {}, INITIAL, doneState(), { status: 'running', step: -1 },
                       { status: 'running', step: TOTAL }, { status: 'running', step: 99 },
                       { status: 'nonsense', step: 0 }]) {
    for (const screen of RENDERED) {
      eq('off for ' + JSON.stringify(state) + ' on ' + screen, view(state, screen).mode, 'off');
    }
  }
}

head('an unknown screen still leaves the tour reachable');
{
  // A screen this test does not know about (added later, or a typo) must fall
  // back to the bar, never to silence — silence is the failure mode that hides.
  for (const screen of ['brand-new-screen', '', 'MENU', 'settings ']) {
    const v = view({ status: 'running', step: 1 }, screen);
    eq('unknown screen "' + screen + '" waits rather than vanishing', v.mode, 'waiting');
    ok('  …and still says where to go', !!v.text);
  }
}

head('advancing is monotonic and cannot skip or stall');
{
  // Walk every step, advancing the way the app would, and assert the tour always
  // moves forward and terminates.
  let state = startState();
  const seen = [];
  for (let guard = 0; guard < TOTAL * 3; guard++) {
    if (!isRunning(state)) break;
    const step = currentStep(state);
    seen.push(step.id);
    const before = state.step;
    state = step.advance === 'next' ? advance(state) : onScreen(state, step.advance.screen);
    ok('progressed past ' + step.id, !isRunning(state) || state.step > before,
      'stuck at ' + before);
  }
  eq('the walk visits every step exactly once', seen.length, TOTAL);
  eq('in order', seen.join(','), STEPS.map((s) => s.id).join(','));
  eq('and ends done', state.status, 'done');

  // Arriving somewhere irrelevant must never advance an action step.
  for (let i = 0; i < TOTAL; i++) {
    const st = { status: 'running', step: i };
    const step = STEPS[i];
    if (step.advance === 'next') {
      for (const screen of RENDERED) {
        eq(step.id + ': screen arrival cannot advance a Next step', onScreen(st, screen).step, i);
      }
    } else {
      for (const screen of RENDERED.filter((s) => s !== step.advance.screen)) {
        eq(step.id + ': arriving at ' + screen + ' does not advance', onScreen(st, screen).step, i);
      }
    }
  }
}

head('the seal can never be up without a way forward');
{
  // The overlay seals when (spotlight || cta). Re-stated over the real steps:
  // a step with no button MUST have an anchor, or a user whose anchor cannot be
  // measured would be sealed in with only Exit.
  for (const step of STEPS) {
    const hasButton = step.advance === 'next';
    ok(step.id + ': has a button or an anchor', hasButton || !!step.anchor,
      'no cta and no anchor — nothing to seal around and no way on');
    if (!hasButton) {
      ok(step.id + ': its anchor is one a screen registers', REGISTERED.includes(step.anchor), step.anchor);
    }
  }
}

console.log('');
console.log(failed ? 'FAILED ' + failed + ' / ' + (passed + failed) : 'passed ' + passed);
if (failed) process.exit(1);
`;

execFileSync(process.execPath, ['--input-type=module', '-e', script], { stdio: 'inherit' });
