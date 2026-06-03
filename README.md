# Gote

A card-based learning game for **iPhone and Android**, built with
[Expo](https://expo.dev) (React Native). It pulls your **iNaturalist**
observations and quizzes you on the species you've seen.

## Game modes

- **All cards** — multiple choice: a photo, pick the right species from 5 names.
- **Quick 16** — a fast round of 16 random cards.
- **Custom game** — choose how many cards and which taxon groups.
- **Speedrun** — endless cards; the run ends after 3 misses.
- **Pick the right one** — a species name, pick the matching photo from 4
  (the distractors are real look-alikes from iNaturalist's "similar species").

Plus a **Lexicon** (browse/search every species you've observed, filter by how
well you know them, tap through to a detail page) and a **Statistics** page
(lifetime accuracy, most-missed and best-known species).

## How it works

1. Enter an iNaturalist **username** in Settings (no password — it uses your
   public observations via the [iNaturalist v2 API](https://api.inaturalist.org/v2/docs/)).
2. Observations are downloaded once and cached locally; later launches sync only
   what changed.
3. Common names can be shown in any of iNaturalist's languages (the app UI
   stays in English).

## Running it on your phone

Most of the app runs in the **Expo Go** app:

1. Install **Expo Go** (App Store / Play Store).
2. Start the dev server from this folder:
   ```sh
   npm start
   ```
3. Scan the QR code — iPhone via the Camera app, Android from inside Expo Go.
   (Phone and computer must be on the same Wi-Fi; otherwise `npx expo start --tunnel`.)

For a standalone build on a device, this is a CNG project — run
`npx expo prebuild` then `npx expo run:ios` (or `run:android`).

## Tests

Pure logic (gestures, cache/sync, quiz, lexicon) is unit-tested:

```sh
npm test
```

## Project layout

```
App.js                       # screen state machine + data orchestration
index.js                     # Expo entry point
src/
  api.js                     # iNaturalist v2 API client + helpers
  storage.js                 # AsyncStorage: username, stats, prefs, obs cache
  cache.js                   # local photo-cache size / clear (expo-file-system)
  prefetch.js                # preloads upcoming card images
  quiz.js                    # multiple-choice distractor logic (pure, tested)
  lexicon.js                 # Lexicon filtering/status logic (pure, tested)
  gestures.js                # gesture decision helpers (pure, tested)
  theme.js                   # colors + monotone icon mapping
  components/                # Icon, ScreenHeader, PhotoViewer
  screens/                   # Menu, Study, PickImage, Custom, Settings,
                             #   Results, Stats, Lexicon, Detail
  hooks/                     # (none currently)
scripts/                     # node test runners (npm test)
assets/                      # app icon + splash (placeholder green)
```

## Notes & next steps

- **Public observations only.** Private/obscured observations would need
  iNaturalist OAuth login.
- **Placeholder icons.** `assets/*.png` are solid-green placeholders — swap in a
  real 1024×1024 icon and splash before publishing.
- **Publishing** to the stores uses
  [EAS Build](https://docs.expo.dev/build/introduction/): `npx eas build`.
