# End-to-end tests (Detox)

These are gray-box E2E tests that drive the real app on an iOS Simulator with
[Detox](https://wix.github.io/Detox/). They cover the whole app: the menu, all
six game modes, the Lexicon, species detail, flagging, results, settings and
statistics.

## How it stays deterministic (offline E2E mode)

The app talks to the iNaturalist API, which is rate-limited and non-deterministic
— useless for E2E. So the tests build the app with **`EXPO_PUBLIC_E2E=1`**, which
turns on "E2E mode" (`src/e2e/testMode.js`):

- `App.js` skips the network on launch and loads a fixed fixture deck
  (`src/e2e/fixtures.js`), landing straight on the menu.
- Every API call in `src/api.js` short-circuits to fixture data.
- The launch splash is skipped.
- Study/Pick screens render a tiny hidden element exposing the current correct
  answer (`e2e-answer` / `e2e-pick-answer`) so a test can always tap the right
  choice. In normal builds none of this code runs.

## One-time setup

```bash
# 1. Detox's iOS simulator helper
brew tap wix/brew && brew install applesimutils

# 2. Native project with the Detox config plugin applied
npx expo prebuild -p ios

# (Xcode + an installed "iPhone 17" simulator are required. Edit the device
#  name in .detoxrc.js if you use a different simulator.)
```

The Detox tooling (`detox`, `jest`, `@config-plugins/detox`) is already in
`devDependencies`.

## Build & run

Release (recommended — the E2E env var is baked into the JS bundle):

```bash
npm run e2e:build      # detox build --configuration ios.sim.release
npm run e2e:test       # detox test  --configuration ios.sim.release
```

Debug (faster rebuilds, but you must start Metro with the env var yourself):

```bash
EXPO_PUBLIC_E2E=1 npx expo start          # in one terminal
npm run e2e:build:debug
npm run e2e:test:debug
```

## Files

- `.detoxrc.js` — Detox configuration (apps, simulator, build commands).
- `e2e/jest.config.js` — Jest runner config for Detox.
- `e2e/helpers.js` — shared helpers (tap by id, read the hidden answer, …).
- `e2e/menu.test.js` — menu renders; navigation in/out of each screen.
- `e2e/games.test.js` — All cards, Flash cards, Custom, Speedrun, Pick, Nearby.
- `e2e/browse.test.js` — Lexicon search/flag/filter, detail, results-missed
  flagging, settings pages, stats reset confirmation.

## Notes

- These are separate from the fast unit tests (`npm test`), which keep running in
  CI without a simulator.
- `testID`s used by the specs live on the components; grep for `testID=` to find
  them. Keep them stable when refactoring.
