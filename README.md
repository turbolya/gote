# gote

Public site: [gote website](http://goteapp.com)

A card-based learning game for **iPhone, iPad, Apple Watch and Android**, built
with [Expo](https://expo.dev) (React Native). It pulls your **iNaturalist**
observations and quizzes you on the species you've seen.

## Game modes

- **Smart play** — the default, played straight from a card on the menu. It
  picks the question that fits each species: a five-name list while a species
  is new or you keep missing it, the photo grid and typing from memory as you
  get to know it, and a two-way duel on look-alikes you actually confuse. The
  four types can be narrowed from the card, or behind its ⋯ along with groups,
  flagged-only and the card count.
- **Speedrun** — endless cards; the run ends after 3 misses.
- **Nearby species** — instead of one observer's species, learn the ones
  typically seen around a location. Pick a spot (GPS or place search) and the
  groups you want; you get the most commonly observed species there.
- **Flash cards** — reveal the answer and grade yourself. The one mode the app
  does not mark, which is why it counts toward accuracy but scores nothing.

The four question types are weighted by difficulty when scoring: choosing the
name 1, a look-alike pair 1.5, picking the photo or typing the name 2.

Plus a **Lexicon** (browse/search every species you've observed, filter by how
well you know them, sort A–Z or by most recent, tap through to a detail page)
and a **Statistics** page (lifetime accuracy, a weighted score, the species you
mix up, and a per-species breakdown). Accuracy is counted per card rather than
per round, and the "best known" ranking discounts species you've barely seen —
so neither a one-card round nor a single lucky answer can flatter the numbers.

Your mix-ups drive the rest: a pair you keep confusing gets a side-by-side
compare page with your own note, a two-way drill, and it resurfaces in later
rounds on its own (`src/schedule.js`) until you can tell them apart.

## How it works

1. Enter an iNaturalist **username** in Settings (no password — it uses your
   public observations via the [iNaturalist v2 API](https://api.inaturalist.org/v2/docs/)).
2. Observations are downloaded once and cached locally; later launches sync only
   what changed.
3. Common names can be shown in any of iNaturalist's languages (the app UI
   stays in English).
4. **Works offline.** A pack of your deck's photos is downloaded in the
   background, so **Smart play, Speedrun** and **Flash cards** keep playing with
   no connection (from cards whose photos are ready). **Nearby** needs a live
   connection and is paused offline, as is the **photo grid** question — it
   fetches four other species' pictures per card.
5. **Optional sync.** Sign in with an email code to carry stats, streak,
   settings and your mix-up notes between devices (Supabase; `src/sync/`).
   Everything works without it.

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

Pure logic — the question chooser, scoring, accuracy, confusions, spaced
repetition, sync merges, the tour, gestures, the cache — is unit-tested, and
the manual test plan's shape is validated in the same run:

```sh
npm test
```

End-to-end, against fixture data in the simulator (Detox):

```sh
npm run e2e:build   # pod install + build the release sim app
npm run e2e:test    # 55 specs across menu, games, browse, settings, offline, tour
```

The manual cases that automation cannot reach — two-device sync, the watch, a
real store build — live in [docs/MANUAL-TESTS.md](docs/MANUAL-TESTS.md), which
is the source of truth for the Testiny project.

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
  smartmode.js               # which question to ask about a species (pure, tested)
  scoring.js                 # difficulty-weighted scoring (pure, tested)
  confusions.js              # the mix-up matrix and its ranking (pure, tested)
  schedule.js                # spaced repetition over confused pairs (pure, tested)
  tutorial.js                # the guided tour's steps and geometry (pure, tested)
  components/                # SmartCard, RecentStrip, PhotoViewer, Tutorial, …
  screens/                   # Menu, Study, PickImage, Custom, Settings, Results,
                             #   Stats, Lexicon, Detail, Compare, Duel, Nearby,
                             #   Sync, Changelog, Legal
  e2e/                       # fixtures + the build-time flags that select them
scripts/                     # node test runners (npm test)
e2e/                         # Detox specs (npm run e2e:build && npm run e2e:test)
screenshots-local/           # App Store screenshot capture (writes outside the repo)
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
- **Detox builds** (`npm run e2e:build`) run `pod install` first — idempotent,
  under a minute, and without it a build that follows a pruned `ios/build`
  fails with "Build input file cannot be found" for codegen files that are
  plainly sitting there.

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
