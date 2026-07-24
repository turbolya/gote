# Screenshot capture

Automated App Store screenshots from the **live** app using a real iNaturalist
account (default `mate_koch`). It lives inside the repo so Detox/jest resolve
from `node_modules`; the captured PNGs are written **outside** it, to a separate
launch folder, so screenshots are never committed.

> Paths are currently hard-coded for the author's machine (`REPO`, `OUT`, `HOME`
> and `PATH` at the top of `capture-screenshots.sh`). Point them at your own
> checkout before running.

The build sets `EXPO_PUBLIC_SHOTS=1`, so on first launch the app seeds realistic
gameplay stats (a busy hero chart, a big lifetime score, a populated per‑species
Statistics page keyed to the real deck, and an active streak) — see
`src/e2e/shotsSeed.js`. It's deterministic and persists, so every device in the
run shows the same numbers. Normal (non‑shots) builds never touch the seeder.

## Run

```bash
./screenshots-local/capture-screenshots.sh
```

Optional:

```bash
# one device only
SHOTS_DEVICE="iPhone 17 Pro Max" ./screenshots-local/capture-screenshots.sh
# custom device list (newline-separated) / account / nearby place
SHOTS_DEVICES=$'iPhone 17 Pro Max\niPad Pro 13-inch (M4)' \
SHOTS_USER=mate_koch SHOTS_PLACE=Kaposvar ./screenshots-local/capture-screenshots.sh
```

## Output

`/Users/mkoch/Developer/gote-launch/screenshots/<timestamp>/<device>/`
- one subfolder **per device type** (e.g. `iphone-17-pro-max/`, `ipad-pro-13-inch-m4/`)
- each with: `01-menu`, `02-by-name`, `03-lexicon`, `04-detail`, `05-statistics`,
  `06-nearby`, `07-speedrun`, `08-results` (`.png`)
- **`apple-watch/`** — `watch-01-home`, `-02-photo`, `-03-answers`,
  `-04-summary`, `-05-complications` (see the Apple Watch note below)

## Apple Watch

The watch pass captures the watch app's screens and a complications showcase.
Because watchOS UI can't be driven headlessly (no Detox for the watch, no
`simctl` tap), the app has a screenshot mode: it's relaunched with
`-goteShot <home|photo|answers|summary|complications>` to jump straight to each
screen. Real photos + the seeded 83% stats come from a quick phone→watch sync
first; a demo snapshot is seeded as a fallback so nothing is blank.

- Needs a **paired iPhone+Watch simulator** (Xcode ▸ Devices ▸ + , or
  `xcrun simctl pair <watch-udid> <phone-udid>`). The script auto-discovers the
  first pair. Set `SHOTS_WATCH=0` to skip the watch pass.
- The **complications** shot is an in-app *showcase* of the Accuracy + Streak
  designs, not a live watch face — capturing a real face complication needs
  manual face editing (add the "gote" complication, then
  `xcrun simctl io <watch-udid> screenshot`).

## What it does

1. Builds a Release sim app **once**, **without** the e2e flag → real network +
   real account (to `../build-shots`, outside `ios/`).
2. For **each device type** (default: 6.9" iPhone, a standard iPhone, and a 13"
   iPad — required while `supportsTablet` is on): boots that simulator, signs
   into `mate_koch` via Settings, and plays a short Flash‑cards round so the
   hero / Statistics / streak look populated.
3. **Nearby species** is set to **Kaposvár, Hungary** with the default **50 km**
   radius: the simulator's GPS is set to Kaposvár's coordinates and the in-app
   "Use my location" button is tapped (iNaturalist's place DB has no Kaposvár
   entry, so coordinates are used rather than place search). Override with
   `SHOTS_LAT` / `SHOTS_LNG` / `SHOTS_PLACE`.
4. Captures each key screen and flattens the PNGs into that device's folder.

## Notes / tweaks

- **Device size:** App Store wants a 6.9" set — that's why it defaults to a Pro
  Max. Check installed sims with `xcrun simctl list devices available`.
- It's **best‑effort**: a screen that fails is skipped (logged), the rest still
  capture.
- **Slow network?** Bump the load delays with `SHOTS_SETTLE` (multiplier), e.g.
  `SHOTS_SETTLE=2 ./screenshots-local/capture-screenshots.sh` (or `3` for very
  slow links). It scales every content‑load wait and the wait timeouts.
- **No status‑bar cleanup** is done. For pixel‑perfect store images, consider
  running once and then using a tool like `xcrun simctl status_bar` to set a
  clean clock/battery before a second pass, or touch up in the marketing tool.
- The **Nearby** shot shows the map + radius slider without a dropped pin (no
  testID on the map). Drop a pin manually if you want the radius circle in‑frame.
- Requires the iOS app to be prebuilt-able (pods installed) — same prerequisites
  as the e2e build.
