// Every word the tutorial says, in one file.
//
// Kept apart from src/tutorial.js (which owns the sequence and the geometry) so
// the copy can be reworded — or translated — without touching logic, and so a
// wording change never risks the step machine. scripts/test-tutorial.js asserts
// the two files agree: every step has copy, every piece of copy has a step, and
// nothing here is longer than a coach mark can comfortably hold.
//
// House style for these:
//   • title — 1-3 words, sentence case, no full stop.
//   • body  — one sentence, ideally under ~90 characters. It sits over the UI
//     it is describing, so it should name the thing and stop.
//
// Explicit `.js` on the import, as in src/tutorial.js: scripts/test-tutorial.js
// loads this file under node ESM, which does not do Metro's extension guessing.
import { DEFAULT_USERNAME } from './constants.js';

// Shown in the bubble, keyed by step id (see STEPS in src/tutorial.js).
export const STEP_TEXT = {
  welcome: {
    title: 'Welcome to gote',
    body: 'A one-minute tour of the app. You can leave whenever you like.',
  },
  openSettings: {
    title: 'Start here',
    body: 'Open Settings — first we will point gote at your own observations.',
  },
  language: {
    title: 'Your language',
    body: 'Species names come from iNaturalist — choose the language you want them in.',
  },
  username: {
    title: 'Your species',
    body: `Type your iNaturalist username and tap Save — or keep ${DEFAULT_USERNAME} for now if you have no account.`,
  },
  smart: {
    title: 'Smart play',
    body: 'The main game: mixed questions, picked for what you have not learned yet.',
  },
  smartStart: {
    title: 'Keep it short',
    body: 'A handful of cards is plenty for now. Tap Start.',
  },
  morePhotos: {
    title: 'Other pictures',
    body: 'One photo rarely shows a species. Tap the grid for more of this one.',
  },
  stats: {
    title: 'Your progress',
    body: 'Tap the banner to see how you are doing.',
  },
  statsTour: {
    title: 'Statistics',
    body: 'Accuracy, streaks, and the look-alikes you keep mixing up all live here.',
  },
  nearby: {
    title: 'Nearby species',
    body: 'Learn what lives in a place — including one you have never been to.',
  },
  openSettings2: {
    title: 'One last thing',
    body: 'Back into Settings for it.',
  },
  sync: {
    title: 'All your devices',
    body: 'Switch this on to carry your progress between your phone, tablet and watch.',
  },
  done: {
    title: 'That is the tour',
    body: 'Go and learn some species. Settings can replay this any time.',
  },
};

// Shown in the slim bar when the tutorial is waiting on a screen the user is
// not currently on. No entry for the Smart play options screen: both of its
// steps moved onto the menu card, so no step lives there to wait for — so the tour never simply vanishes with no way back to it.
// Keyed by the screen the step is waiting for.
export const WAITING = {
  menu: 'Tutorial · go back to the menu to continue',
  settings: 'Tutorial · open Settings to continue',
  study: 'Tutorial · start a round to continue',
  stats: 'Tutorial · open Statistics to continue',
};

// Buttons and the exit confirmation.
export const UI_TEXT = {
  next: 'Next',
  finish: 'Done',
  exit: 'Exit tutorial',
  // Progress readout in the bubble, e.g. "3 of 12".
  progress: (n, total) => `${n} of ${total}`,
  confirmTitle: 'Exit the tutorial?',
  confirmBody: 'You can start it again any time from Settings.',
  confirmKeep: 'Keep going',
  confirmExit: 'Exit',
  // The Settings row that starts or replays the tour.
  settingsRow: 'Take the tutorial',
};
