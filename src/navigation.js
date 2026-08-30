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
