// Where "back" goes from each screen. Pure, so scripts/test-navigation.js can
// check the whole graph in plain node.
//
// This exists because the answer used to be written down TWICE: once as each
// screen's own `onBack` prop, and again as a lookup table feeding the edge
// swipe-back gesture. Sync was added to the first and forgotten in the second,
// so its header chevron worked and swiping did nothing — the gesture silently
// disables itself for any screen missing from the table, which is the quietest
// possible failure. One map now feeds both, and the test below fails if a screen
// is added to neither list.

// Screens that go somewhere when you back out of them.
export const BACK_TO = {
  settings: 'menu',
  smart: 'menu',
  flash: 'menu',
  nearby: 'menu',
  stats: 'menu',
  lexicon: 'menu',
  // Settings sub-pages return to Settings, not all the way to the menu.
  changelog: 'settings',
  legal: 'settings',
  sync: 'settings',
};

// Screens with deliberately no back action, each for its own reason:
//   menu     — the root; there is nothing above it.
//   loading  — transient, and has its own Cancel.
//   study    — a round in progress; a stray edge swipe must not abandon it.
//   pick     — likewise.
//   results  — the end of a round, not a page you navigate back out of. Its
//              exits are explicit choices (Play again / Revisit missed / Menu).
export const NO_BACK = ['menu', 'loading', 'study', 'pick', 'results'];

// Every screen the app can show. Kept here so the test can assert that each one
// is classified exactly once.
export const SCREENS = [...Object.keys(BACK_TO), ...NO_BACK];

// The screen to return to, or null when there is nowhere to go. A null disables
// both the header button and the swipe, which is what we want — they must never
// disagree about whether back is possible.
export function backTarget(screen) {
  return Object.prototype.hasOwnProperty.call(BACK_TO, screen)
    ? BACK_TO[screen]
    : null;
}

// What the Android system back button (or gesture) should do right now. Pure for
// the same reason backTarget is: it is the one place that says what "back" means
// when several things could claim it, and it can be tested without a device.
//
// Priority, outermost first — the thing drawn on top is the thing that closes:
//   1. the overlays that sit above any screen (duel, comparison, species detail)
//   2. a round in progress ends, exactly like its End button (the results screen
//      is reversible: Play again, Revisit missed). Back must never be a way to
//      lose a round silently, but it also must not trap anyone in one.
//   3. loading cancels, like its Cancel button
//   4. results go to the menu, like its Menu button
//   5. a screen with a back target goes there (Settings through its own leave
//      handler, so pending edits are applied)
//   6. the menu — and Settings before any deck exists, which is the root of a
//      first run — has nowhere to go: { type: 'exit' }, so the caller returns
//      false and Android leaves the app, which is what back on the root does.
//
// Modals (photo viewer, support popup, language picker) never get here: React
// Native's Modal consumes the system back itself through onRequestClose.
export function systemBackAction({
  screen,
  hasDuel = false,
  hasCompare = false,
  hasDetail = false,
  canLeaveSettings = true,
} = {}) {
  if (hasDuel) return { type: 'close-duel' };
  if (hasCompare) return { type: 'close-compare' };
  if (hasDetail) return { type: 'close-detail' };
  if (screen === 'study' || screen === 'pick') return { type: 'end-round' };
  if (screen === 'loading') return { type: 'cancel-load' };
  if (screen === 'results') return { type: 'results-menu' };
  if (screen === 'settings') {
    return canLeaveSettings ? { type: 'leave-settings' } : { type: 'exit' };
  }
  const target = backTarget(screen);
  return target ? { type: 'navigate', target } : { type: 'exit' };
}
