// The guided tour: which step comes next, and where its bubble goes.
//
// Pure — no React, no storage, no measurement — so scripts/test-tutorial.js can
// walk the whole tour and check the geometry on a dozen screen sizes in plain
// node. The React side (src/components/Tutorial.js) only measures anchors and
// draws what this file decides.
//
// The sequence is a straight line, but the user is not on rails: they can wander
// off to any screen at any moment. Rather than trapping them, a step simply
// declares WHICH SCREEN it belongs to and is shown only there. Off that screen
// the tour is not lost — it is `waiting`, and says so in a slim bar (see
// `view` below). That one rule is what keeps the tour from ever dead-ending.
//
// Explicit `.js` on the import: scripts/test-tutorial.js loads this file
// directly under node ESM, which does not do Metro's extension guessing.
import { STEP_TEXT, WAITING, UI_TEXT } from './tutorialtext.js';

// Every element the tour can point at. Screens register a matching anchor
// (see useAnchorRef), and a test asserts the two lists have not drifted apart —
// a step pointing at an id nobody registers would silently lose its spotlight.
export const ANCHORS = [
  'open-settings', // menu → Settings row
  'menu-stats', // menu → the hero banner (opens Statistics)
  'mode-smart', // menu → Smart play
  'mode-nearby', // menu → Nearby species
  'settings-language', // settings → the species-name language section
  'settings-account', // settings → the username field, its hint and Save
  'settings-sync', // settings → Sync across devices
  'smart-start', // menu → the Smart play card's Start button
  'study-photos', // a card in play → the "more photos" grid button
];

// How a step ends:
//   'next'                      — the bubble shows a button; the user reads and
//                                 taps it.
//   { screen: 'x' }             — the user does the thing, and ARRIVING at
//                                 screen x is the proof. No button, so the tour
//                                 cannot be advanced past an action without
//                                 performing it.
//   { screen: 'x', cta: true }  — either one. A button AND arriving both count.
//
// Steps that ask for an action use the second form; steps that merely point
// something out use the first. Anything the user might reasonably not want to do
// (Nearby wants a location permission) must not be the second form.
//
// The third form exists because the first two are not the whole story for a
// step that both POINTS AT a control and offers a button. Every action step
// before it has taught one lesson — tap the lit-up thing — and the spotlight is
// a live hole, so tapping it is exactly what people do. The screen behind then
// changes, the step does not, and coming back re-lights the same control with
// the same instruction: a loop the user can only leave by noticing the button
// they have not needed until now. Optional means optional, not forbidden — so
// doing it counts too.
export const STEPS = [
  { id: 'welcome', screen: 'menu', anchor: null, advance: 'next' },
  { id: 'openSettings', screen: 'menu', anchor: 'open-settings', advance: { screen: 'settings' } },
  // Language before username, because the name language decides what the deck
  // that the username loads will be LABELLED in — set it afterwards and the
  // deck has to be fetched again. A button, not an arrival: most people are
  // happy with the default, and a step that cannot be passed without changing a
  // setting is a step that makes them change it for no reason.
  { id: 'language', screen: 'settings', anchor: 'settings-language', advance: 'next' },
  // Saving a username reloads the deck and lands back on the menu; so does
  // simply backing out. Either way the user has moved on, and so does the tour.
  { id: 'username', screen: 'settings', anchor: 'settings-account', advance: { screen: 'menu' } },
  // Both of these live on the menu now: Smart play is a card there rather than
  // a row you tap through to a setup screen, so the tour points at the card and
  // then at its own Start button. The step that used to be "go to the Smart
  // play screen" has no navigation left to wait for, so it ends on a button.
  { id: 'smart', screen: 'menu', anchor: 'mode-smart', advance: 'next' },
  { id: 'smartStart', screen: 'menu', anchor: 'smart-start', advance: { screen: 'study' } },
  { id: 'morePhotos', screen: 'study', anchor: 'study-photos', advance: 'next' },
  { id: 'stats', screen: 'menu', anchor: 'menu-stats', advance: { screen: 'stats' } },
  { id: 'statsTour', screen: 'stats', anchor: null, advance: 'next' },
  // Both of these light up a row that navigates. See the third form above.
  { id: 'nearby', screen: 'menu', anchor: 'mode-nearby', advance: { screen: 'nearby', cta: true } },
  { id: 'openSettings2', screen: 'menu', anchor: 'open-settings', advance: { screen: 'settings' } },
  { id: 'sync', screen: 'settings', anchor: 'settings-sync', advance: { screen: 'sync', cta: true } },
  { id: 'done', screen: 'settings', anchor: null, advance: 'next' },
];

export const TOTAL = STEPS.length;

// Screens where even the "waiting" bar stays out of the way. The bar is a nudge,
// not a nag, and it must never sit on top of a card someone is trying to answer:
// `study` and `pick` are both a round in play, and `loading` has no UI to speak
// of.
//
// `results` used to be here too, as "the moment just after a round". That was
// wrong in practice: it is the one screen where the user is idle and choosing
// what to do next, and a tour that vanishes there looks like a tour that has
// broken. Nothing on Results has to be answered, so the bar covers nothing.
//
// Keep this list as short as it can be. Every screen on it is a screen where a
// running tour is completely invisible, and `view()` returning 'off' is
// indistinguishable to the user from the tour having given up.
export const QUIET_SCREENS = ['loading', 'study', 'pick'];

// --- state -------------------------------------------------------------------
// { status: 'new' | 'running' | 'done', step: <index into STEPS> }
//
// 'done' covers both finishing and exiting early: neither should auto-start the
// tour again, and both are restartable from Settings. The distinction would only
// exist to be got wrong.

export const INITIAL = { status: 'new', step: 0 };

export function startState() {
  return { status: 'running', step: 0 };
}

export function doneState() {
  return { status: 'done', step: 0 };
}

// Tolerates anything that has been through JSON, a schema change, or a downgrade
// — a corrupt tutorial flag must never be able to wedge the app.
export function normalize(raw) {
  if (!raw || typeof raw !== 'object') return { ...INITIAL };
  const status = ['new', 'running', 'done'].includes(raw.status) ? raw.status : 'new';
  const n = Number(raw.step);
  const valid = Number.isInteger(n) && n >= 0 && n < TOTAL;
  // A saved index past the end means the tour ran under an older, longer
  // sequence; treat that as done rather than resuming somewhere arbitrary.
  if (status === 'running') return valid ? { status, step: n } : doneState();
  // Only a running tour has a position. Carrying a step number on 'new' or
  // 'done' would leave two records meaning the same thing, and one of them
  // would eventually be compared with the other.
  return { status, step: 0 };
}

export function isRunning(state) {
  return !!state && state.status === 'running' && state.step >= 0 && state.step < TOTAL;
}

// Does this step's bubble carry a Next/Done button?
export function hasCta(step) {
  return !!step && (step.advance === 'next' || !!step.advance.cta);
}

export function stepAt(index) {
  return STEPS[index] || null;
}

export function currentStep(state) {
  return isRunning(state) ? STEPS[state.step] : null;
}

// The tour introduces the app, so it runs once, for someone who has never seen
// it. Not under the e2e/screenshot fixtures: an overlay on the menu would break
// every other spec, and the tour has its own (e2e/tutorial.test.js).
export function shouldAutoStart(state, { isE2E = false } = {}) {
  if (isE2E) return false;
  return !!state && state.status === 'new';
}

// The user tapped Next (or Done on the last step).
export function advance(state) {
  if (!isRunning(state)) return state;
  const next = state.step + 1;
  return next >= TOTAL ? doneState() : { status: 'running', step: next };
}

// The app navigated. A step waiting on this screen is now satisfied.
//
// One step at a time on purpose: no two consecutive screen-advanced steps wait
// on the same screen (a test enforces it), so a single arrival can never be
// meant to satisfy two steps, and a loop here could only ever skip one by
// accident.
export function onScreen(state, screen) {
  const step = currentStep(state);
  if (!step || step.advance === 'next') return state;
  return step.advance.screen === screen ? advance(state) : state;
}

// --- what to draw ------------------------------------------------------------

// The single question the overlay asks each render:
//
//   { mode: 'off' }                         — nothing to draw
//   { mode: 'step', step, index, number, total, text, anchor, cta }
//   { mode: 'waiting', text }               — the slim bar
//
// `cta` is the button label, so the last step reads "Done" rather than "Next".
export function view(state, screen) {
  const step = currentStep(state);
  if (!step) return { mode: 'off' };
  if (screen === step.screen) {
    return {
      mode: 'step',
      step,
      id: step.id,
      index: state.step,
      number: state.step + 1,
      total: TOTAL,
      text: STEP_TEXT[step.id],
      anchor: step.anchor,
      // A step the user MUST act on has no button — arriving somewhere is what
      // advances it. One that merely offers the action keeps both.
      cta: hasCta(step) ? (state.step === TOTAL - 1 ? UI_TEXT.finish : UI_TEXT.next) : null,
      progress: UI_TEXT.progress(state.step + 1, TOTAL),
    };
  }
  if (QUIET_SCREENS.includes(screen)) return { mode: 'off' };
  return { mode: 'waiting', text: WAITING[step.screen] || WAITING.menu, waitingFor: step.screen };
}

// --- geometry ----------------------------------------------------------------
// Bubble placement, in pure numbers. This is where "consider different screen
// sizes" actually lives: a 320pt phone in landscape with a notch, and a 1366pt
// iPad, go through the same four lines.

export const MARGIN = 16; // minimum breathing room from any screen edge
export const GAP = 10; // between the spotlight and the bubble
export const ARROW = 9; // half-width/height of the little pointer
export const ARROW_INSET = 18; // how close the arrow may get to a bubble corner
export const SPOT_PAD = 8; // how far the spotlight ring sits outside the target
export const SPOT_RADIUS = 16;
export const BUBBLE_MAX_W = 380;
// Below this much of the anchor on screen, treat it as not there: pointing at a
// row that has been scrolled away is worse than not pointing at all.
export const MIN_VISIBLE = 12;

const clamp = (v, lo, hi) => (hi < lo ? lo : Math.min(hi, Math.max(lo, v)));

function insetBounds(screen, insets = {}) {
  return {
    left: MARGIN + (insets.left || 0),
    right: screen.width - MARGIN - (insets.right || 0),
    top: MARGIN + (insets.top || 0),
    bottom: screen.height - MARGIN - (insets.bottom || 0),
  };
}

// As wide as the screen comfortably allows, up to a readable maximum. Narrow
// phones get a narrower bubble rather than one that runs off the edge.
export function bubbleWidth(screen, insets = {}) {
  const b = insetBounds(screen, insets);
  return Math.max(0, Math.min(BUBBLE_MAX_W, b.right - b.left));
}

// Is enough of the anchor on screen to be worth pointing at?
export function anchorVisible(anchor, screen) {
  if (!anchor || !(anchor.width > 0) || !(anchor.height > 0)) return false;
  const x = Math.min(anchor.x + anchor.width, screen.width) - Math.max(anchor.x, 0);
  const y = Math.min(anchor.y + anchor.height, screen.height) - Math.max(anchor.y, 0);
  return x >= MIN_VISIBLE && y >= MIN_VISIBLE;
}

// The hole punched in the dim layer, clipped to the screen. Null when there is
// nothing worth lighting up, which is also the overlay's cue to centre the
// bubble and drop its arrow.
export function spotlight(anchor, screen) {
  if (!anchorVisible(anchor, screen)) return null;
  const left = Math.max(0, anchor.x - SPOT_PAD);
  const top = Math.max(0, anchor.y - SPOT_PAD);
  const right = Math.min(screen.width, anchor.x + anchor.width + SPOT_PAD);
  const bottom = Math.min(screen.height, anchor.y + anchor.height + SPOT_PAD);
  const width = right - left;
  const height = bottom - top;
  return {
    x: left,
    y: top,
    width,
    height,
    // A radius larger than half the shorter side draws as a lens, not a
    // rounded rectangle — clamp it for small square targets like an icon.
    radius: Math.min(SPOT_RADIUS, width / 2, height / 2),
  };
}

// The screen minus the spotlight, as rectangles to seal off.
//
// A step is modal: the user must not be able to tap past it, or scroll the page
// out from under the thing being pointed at. But the spotlight itself has to
// stay live — for an action step ({ screen: 'x' }) tapping the real control is
// the ONLY way forward — so the blocked area is the screen with the target's
// rectangle taken out of it, returned as up to four bands:
//
//        ┌───────────────┐
//        │      top      │
//        ├────┬─────┬────┤
//        │left│ HOLE│righ│
//        ├────┴─────┴────┤
//        │     bottom    │
//        └───────────────┘
//
// No spotlight (a step that points at nothing, or one whose target has not been
// measured yet) means one full-screen band. Whether that is safe to render is
// the overlay's call, not this function's: a step with no target AND no button
// would have no way forward, and must not be sealed.
//
// The corners of the hole are square even though the ring is rounded. Blocking
// those few points would mean four more views to spare a touch that lands on the
// rounded edge of the control being pointed at anyway.
export function blockers(spot, screen) {
  if (!screen || !(screen.width > 0) || !(screen.height > 0)) return [];
  const full = { x: 0, y: 0, width: screen.width, height: screen.height };
  if (!spot) return [full];

  // Clip the hole to the screen, so a partly off-screen anchor cannot produce a
  // band with a negative width.
  const left = clamp(spot.x, 0, screen.width);
  const top = clamp(spot.y, 0, screen.height);
  const right = clamp(spot.x + spot.width, 0, screen.width);
  const bottom = clamp(spot.y + spot.height, 0, screen.height);
  if (!(right > left) || !(bottom > top)) return [full];

  const bands = [];
  if (top > 0) bands.push({ x: 0, y: 0, width: screen.width, height: top });
  if (bottom < screen.height) {
    bands.push({ x: 0, y: bottom, width: screen.width, height: screen.height - bottom });
  }
  if (left > 0) bands.push({ x: 0, y: top, width: left, height: bottom - top });
  if (right < screen.width) {
    bands.push({ x: right, y: top, width: screen.width - right, height: bottom - top });
  }
  return bands;
}

// How far to scroll to bring a target into view, in points (positive = scroll
// down / further into the content). Zero when it is already somewhere sensible.
//
// This exists because the tour points at rows that are genuinely off screen on a
// first launch — "Open Settings" is below the fold on every phone once the menu
// has six game modes above it. Telling someone to tap something they cannot see
// is the difference between a tour and a riddle.
//
// The target lands at ~40% of the viewport rather than centred, leaving the
// larger half free for the bubble.
export const SCROLL_BIAS = 0.4;
// Below this, scrolling would be a twitch rather than a help.
export const SCROLL_MIN = 24;

export function scrollDelta(anchor, screen, insets = {}) {
  if (!anchor || !(anchor.height > 0)) return 0;
  const top = MARGIN + (insets.top || 0);
  const bottom = screen.height - MARGIN - (insets.bottom || 0);
  const viewport = bottom - top;
  if (viewport <= 0) return 0;
  // Already comfortably in view, with room for a bubble on one side or the
  // other: leave the user's scroll position alone.
  const fitsWhole = anchor.height + 2 * GAP <= viewport;
  if (fitsWhole && anchor.y >= top && anchor.y + anchor.height <= bottom) return 0;
  const want = top + viewport * SCROLL_BIAS;
  const dy = anchor.y - want;
  return Math.abs(dy) < SCROLL_MIN ? 0 : Math.round(dy);
}

// Where the bubble goes, given a measured anchor and a measured bubble.
//
//   { left, top, arrow: { x, dir: 'up' | 'down' } | null }
//
// `dir` is the direction the arrow POINTS: 'up' means the bubble sits below its
// target. The arrow is dropped whenever it would lie: no anchor, or a screen so
// short that the bubble has to overlap the thing it describes.
export function placeBubble({ anchor, bubble, screen, insets = {} }) {
  const b = insetBounds(screen, insets);
  const w = bubble.width;
  const h = bubble.height;
  const centred = {
    left: clamp((screen.width - w) / 2, b.left, b.right - w),
    top: clamp((screen.height - h) / 2, b.top, b.bottom - h),
    arrow: null,
  };
  const spot = spotlight(anchor, screen);
  if (!spot) return centred;

  const below = spot.y + spot.height + GAP;
  const above = spot.y - GAP - h;
  const fitsBelow = below + h <= b.bottom;
  const fitsAbove = above >= b.top;

  // The bubble is centred on the target, then pulled back inside the safe area;
  // the arrow follows the target as far as its own corners allow.
  const place = (top, dir) => {
    const left = clamp(spot.x + spot.width / 2 - w / 2, b.left, b.right - w);
    const x = clamp(spot.x + spot.width / 2 - left, ARROW_INSET, w - ARROW_INSET);
    return { left, top, arrow: { x, dir } };
  };

  if (fitsBelow) return place(below, 'up');
  if (fitsAbove) return place(above, 'down');

  // Neither side has room for the full gap — a short screen, or a target that
  // nearly fills it. Take the roomier side and clamp on screen. If that STILL
  // leaves the bubble entirely off the target, keep the arrow: being a few
  // points shy of the ideal gap is no reason to stop pointing. Only a bubble
  // that has to overlap what it describes drops the arrow, because there is
  // then nothing honest for it to point at.
  const top = clamp(
    b.bottom - below >= above + h - b.top ? below : above,
    b.top,
    b.bottom - h
  );
  if (top >= spot.y + spot.height) return place(top, 'up');
  if (top + h <= spot.y) return place(top, 'down');
  return { left: centred.left, top, arrow: null };
}
