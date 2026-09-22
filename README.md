# gote

Public site: [gote website](http://goteapp.com)

A card-based learning game for **iPhone and Android**, built with
[Expo](https://expo.dev) (React Native). It pulls your **iNaturalist**
observations and quizzes you on the species you've seen.

## Game modes

- **All cards** — multiple choice: a photo, pick the right species from 5 names.
- **Custom game** — choose how many cards and which taxon groups.
- **Speedrun** — endless cards; the run ends after 3 misses.
- **Pick the right one** — a species name, pick the matching photo from 4
  (the distractors are real look-alikes from iNaturalist's "similar species").
- **Nearby species** — instead of one observer's species, learn the ones
  typically seen around a location. Pick a spot (GPS or place search) and the
  groups you want; you get the most commonly observed species there.

Plus a **Lexicon** (browse/search every species you've observed, filter by how
well you know them, tap through to a detail page) and a **Statistics** page
(lifetime accuracy, most-missed and best-known species). Accuracy is counted
per card rather than per round, and the "best known" ranking discounts species
you've barely seen — so neither a one-card round nor a single lucky answer can
flatter the numbers.

## How it works

1. Enter an iNaturalist **username** in Settings (no password — it uses your
   public observations via the [iNaturalist v2 API](https://api.inaturalist.org/v2/docs/)).
2. Observations are downloaded once and cached locally; later launches sync only
   what changed.
3. Common names can be shown in any of iNaturalist's languages (the app UI
   stays in English).
4. **Works offline.** A pack of your deck's photos is downloaded in the
   background, so **By name, Speedrun, Custom** and **Flash cards** keep playing
   with no connection (from cards whose photos are ready). **Nearby** and **By
   picture** need a live connection, so they're paused offline.

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
  storage.js                 # AsyncStorage: username, stats, prefs, obs cache,
                             #   image manifest, data-version migrations
  cache.js                   # local photo-cache size / clear (expo-file-system)
  prefetch.js                # image preloading (OS warm) + filling the offline pack
  photocache.js              # the offline pack itself: real photo files on disk
  accuracy.js                # card-weighted accuracy + small-sample shrinkage (pure, tested)
  navigation.js              # where "back" goes from each screen (pure, tested)
  net.js                     # connectivity (useIsOffline, NetInfo)
  quiz.js                    # multiple-choice distractor logic (pure, tested)
  lexicon.js                 # Lexicon filtering/status logic (pure, tested)
  gestures.js                # gesture decision helpers (pure, tested)
  theme.js                   # colors + monotone icon mapping
  sync/                      # optional cross-device sync (versioned events/settings)
  components/                # Icon, ScreenHeader, PhotoViewer, OfflineBanner
  screens/                   # Menu, Study, PickImage, Custom, Settings,
                             #   Results, Stats, Lexicon, Detail
  hooks/                     # (none currently)
scripts/                     # node test runners (npm test)
assets/                      # app icon, splash, watch glyphs
```

## Notes & next steps

- **Public observations only.** Private/obscured observations would need
  iNaturalist OAuth login.
- **Publishing** to the stores uses
  [EAS Build](https://docs.expo.dev/build/introduction/). Build locally with
  `npm run build:ios` (add `:submit` to send the result to TestFlight): it
  frees the disposable gigabytes first — Detox's derived data under
  `ios/build`, and every `.ipa` but the newest — because `eas build --local`
  needs ~10 GB free and an e2e run leaves ~9 GB sitting there. `npm run
  clean:space` does the pruning on its own. Cloud builds are still
  `npx eas build`.

## Crash reporting

None at the moment. The app ships without any crash- or error-reporting SDK —
no telemetry leaves the device. (An earlier Sentry integration was removed while
it was still a no-op; it can be re-added later behind a DSN if needed.)

## License

Copyright (C) 2026 turbolya.

Licensed under the **GNU Affero General Public License v3.0** — see
[LICENSE](LICENSE). You may use, modify, and share this code, **but** any
derivative work or networked service built from it must also be released in full
under the AGPL-3.0. It may not be incorporated into closed-source or proprietary
software.

One **additional permission** applies, in
[LICENSE-EXCEPTION](LICENSE-EXCEPTION): the app may be distributed through the
Apple App Store, Google Play and comparable platforms despite the store terms
that would otherwise conflict with the AGPL-3.0 (device limits, store-signed
binaries). It covers distribution only — every copyleft obligation above stays
in force.

Contributions are accepted under the AGPL-3.0 **plus** that permission, so it
keeps covering the whole work as the codebase grows. Contributors also grant the
maintainer a licence to distribute their work under other terms — see
[CONTRIBUTING.md](CONTRIBUTING.md) for what that does and does not mean.

### The App Store build

**What you install from the App Store is not licensed to you under the
AGPL-3.0.** It is distributed by the copyright holder under Apple's standard
end-user licence agreement, like any other app on the store. Installing it gives
you no rights to its source.

That is not a contradiction, and nothing above is a fiction. A licence is a
grant the copyright holder makes to other people; it does not bind the holder,
who remains free to distribute the same work on different terms. So gote is
published here as free software under the AGPL-3.0, and also shipped as a
store binary under the store's own terms. This is why the grant in
CONTRIBUTING.md matters: it keeps that second route open as other people's code
enters the project.

**The source you are reading is the real thing.** It is the same code the store
build is made from, and it stays under the AGPL-3.0 for you and everyone else:
you may build it, change it, run it, and share it on those terms, including
onto your own device. What you cannot do is take Apple's binary and treat it as
an AGPL artefact.

If you want gote as free software, use this repository. If you want it as a
convenience with automatic updates, use the store. They are the same program.
