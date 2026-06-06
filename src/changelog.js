// Single source of truth for the app version and release notes. The version
// here must match app.json / package.json (kept in sync manually on each
// release). The Settings → Changelog screen renders these entries.
//
// Versioning (semver-ish for an app):
//   • major (X.0.0) — big redesigns or breaking changes to saved data
//   • minor (1.X.0) — new features / game modes / screens
//   • patch (1.0.X) — bug fixes and small tweaks
// Newest entry first.

export const APP_VERSION = '1.9.6';

export const CHANGELOG = [
  {
    version: '1.9.6',
    date: '2026-06-06',
    changes: [
      'Internal: fixed a harmless React key warning logged from the menu.',
    ],
  },
  {
    version: '1.9.5',
    date: '2026-06-06',
    changes: [
      'Toned down the menu accuracy bars so they sit more softly behind the '
        + 'header.',
    ],
  },
  {
    version: '1.9.4',
    date: '2026-06-06',
    changes: [
      'No more accidental answers: the choices (and the “I knew it / Missed '
        + 'it” buttons) now appear in the center of the screen, away from the '
        + '“Show choices / Reveal answer” button you just tapped.',
    ],
  },
  {
    version: '1.9.3',
    date: '2026-06-06',
    changes: [
      'Menu accuracy chart: bars now fade from solid white at the top to '
        + 'transparent at the bottom, and a 100% bar rises to just below your '
        + 'username.',
    ],
  },
  {
    version: '1.9.2',
    date: '2026-06-06',
    changes: [
      'The flag on cards now sits in the top bar next to the score: a white '
        + 'outline when off, a filled flag when on.',
    ],
  },
  {
    version: '1.9.1',
    date: '2026-06-06',
    changes: [
      'End-of-round buttons are clearer: “Revisit missed” (light orange, eye '
        + 'icon) and “Play again” (light green, play icon) are now easy to tell '
        + 'apart.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-06-06',
    changes: [
      'The menu header now shows a subtle bar chart of your recent games’ '
        + 'accuracy behind the title, newest on the right.',
    ],
  },
  {
    version: '1.8.1',
    date: '2026-06-06',
    changes: [
      'Flagged species are now remembered per iNaturalist account (like your '
        + 'cached observations), so switching accounts no longer mixes flags.',
    ],
  },
  {
    version: '1.8.0',
    date: '2026-06-06',
    changes: [
      'Flag species you want to revisit: tap the flag on any card while '
        + 'playing, or on a missed species at the end of a round.',
      'In the Lexicon you can flag or unflag any species and filter to just '
        + 'your flagged ones.',
      'Custom game and Flash cards now have a “Flagged only” option to study '
        + 'just the species you flagged.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-06-06',
    changes: [
      'On the end-of-round screen, tap any species you missed to open its '
        + 'full detail page (photos, taxonomy, Wikipedia) — the same one as in '
        + 'the Lexicon.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-06-05',
    changes: [
      'Custom game and Speedrun are now multiple-choice too (answer + four '
        + 'alternatives), matching All cards and Nearby species.',
      'New mode: Flash cards — same picker as Custom game, but reveal the '
        + 'answer and grade yourself (the classic self-grade style).',
      'End-of-round screen: the Main menu button is now emphasized, with a '
        + 'matching ✕ in the top corner.',
      'Fixed some result/answer icons that were not displaying after the '
        + 'recent icon refresh.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-06-05',
    changes: [
      'Nearby species is now a multiple-choice quiz: pick the right name from '
        + 'the answer plus four look-alike alternatives (like All cards), '
        + 'instead of self-grading.',
    ],
  },
  {
    version: '1.5.2',
    date: '2026-06-05',
    changes: [
      'Fixed: the card count was wrong right after launch — your study '
        + 'filters (e.g. “Research grade only”) are now applied correctly on '
        + 'startup instead of only after a manual sync.',
    ],
  },
  {
    version: '1.5.1',
    date: '2026-06-05',
    changes: [
      'Amphibians now show a frog icon instead of the stand-in turtle.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-06-05',
    changes: [
      'Fresh, more modern look for the main menu and Settings: a gradient '
        + 'header, colour-coded game cards, and grouped settings sections.',
      'New icon set (Ionicons) throughout the app — rounder, clearer glyphs '
        + 'that better match each option.',
    ],
  },
  {
    version: '1.4.5',
    date: '2026-06-04',
    changes: [
      'Proper nature icons for taxon groups (leaf, mushroom, bird, fish, paw, '
        + 'turtle, bee, spider, …) instead of the old abstract placeholders.',
    ],
  },
  {
    version: '1.4.4',
    date: '2026-06-04',
    changes: [
      'More resilient networking: if iNaturalist rate-limits a request, the app '
        + 'now waits and retries automatically instead of failing.',
    ],
  },
  {
    version: '1.4.3',
    date: '2026-06-04',
    changes: [
      'Performance: species photo/detail lookups are now cached for the '
        + 'session, cutting repeat network requests (helps stay under '
        + 'iNaturalist’s rate limit, especially in "Pick the right one").',
    ],
  },
  {
    version: '1.4.2',
    date: '2026-06-04',
    changes: [
      'Card photos now show in full (no cropping) — wide or tall photos fit the '
        + 'screen with a blurred fill behind, so identifying features are never '
        + 'cut off.',
    ],
  },
  {
    version: '1.4.1',
    date: '2026-06-04',
    changes: [
      'Fixed: swiping or tapping a card no longer reveals/hides the species '
        + 'name. Use the Reveal answer button; double-tap a photo to zoom.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-06-04',
    changes: [
      'New game mode: Nearby species — learn the species typically observed '
        + 'around a location. Pick a spot by GPS or place search, choose which '
        + 'groups (birds, mammals, plants, …), and study the most common ones.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-06-04',
    changes: [
      'Cards now show the photo’s copyright/license (from iNaturalist) as small '
        + 'print in the corner, replacing the now-redundant fullscreen button '
        + '(double-tap a photo to zoom).',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-06-04',
    changes: [
      'New: "Data & licensing" screen in Settings explaining that photos and '
        + 'data come from iNaturalist and its observers, under each observer’s '
        + 'copyright/license.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-06-04',
    changes: [
      'New: in-app changelog (this screen) and app versioning.',
      'New: crash reporting via Sentry (off until a DSN is configured).',
      'New: branded launch splash with a stylized newt.',
      'New: "Report a bug" and "Send feedback" options in Settings.',
      'Fixed: "Identified to species" filter now correctly excludes genus-level '
        + 'observations and keeps subspecies.',
      'Removed the Quick 16 game mode.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-05-31',
    changes: [
      'First version of Gote.',
      'Game modes: All cards, Custom game, Speedrun, and Pick the right one.',
      'Lexicon to browse and search every species you have observed.',
      'Statistics: lifetime accuracy, most-missed and best-known species.',
      'Species-name language picker and offline observation cache.',
    ],
  },
];
