// Single source of truth for the app version and release notes. The version
// here must match app.json / package.json (kept in sync manually on each
// release). The Settings → Changelog screen renders these entries.
//
// Versioning (semver-ish for an app):
//   • major (X.0.0) — big redesigns or breaking changes to saved data
//   • minor (1.X.0) — new features / game modes / screens
//   • patch (1.0.X) — bug fixes and small tweaks
// Newest entry first.

export const APP_VERSION = '1.4.4';

export const CHANGELOG = [
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
