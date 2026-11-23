# Real-device runner (XCUITest)

Detox only drives simulators. This is a small Xcode UI-test project for
**physical** iPhones and iPads. It drives whatever gote build is installed on
the device, TestFlight builds included, so a release can be checked on real
hardware without a development build of the app.

The runner targets the app by bundle id (`com.gote.app`) and gets its
instructions from a step script passed on the command line. Changing what it
does needs no rebuild. It finds elements by the same `testID`s the Detox specs
use.

## One-time setup

- **Device:** unlock it, then tap **Trust** for this Mac. Turn on Settings →
  Privacy & Security → **Developer Mode**; the device restarts. Set Auto-Lock
  to Never while testing, because a locked device stalls xcodebuild without
  any error.
- **Mac:** sign Xcode in to the team's Apple ID (Xcode → Settings → Accounts).
- **First build:** creates an Apple Development certificate and registers the
  device on team 24M7W58WAU. It also adds the `com.gote.testrunner` App IDs.

```bash
xcrun devicectl list devices          # find the UDID
e2e/device/build.sh <udid>            # once per device, or after editing the Swift
```

## Running steps

```bash
e2e/device/run.sh <udid> "launch|waitid:mode-smart|shot:menu|tap:smart-start|waitid:study-reveal|shot:card"
```

Screenshots and accessibility trees land in `e2e/device/out/latest/`, named
after their steps (`01-menu.png`, `02-tree-card.txt`, …). Pass a third
argument to write them somewhere else.

Steps are separated by `|`:

| Step | Does |
| --- | --- |
| `launch` / `relaunch` / `terminate` / `home` | bring the app up (keeping its state) / restart it / quit it / go to the Home Screen |
| `tap:<id>` | tap the element with that accessibility identifier (`testID`) |
| `taplabel:<label>` / `tapcontains:<text>` | tap by exact label / label substring |
| `tapxy:<x>,<y>` | tap at a point given as 0–1 fractions of the screen |
| `waitid:<id>` / `waitlabel:<text>` | wait up to 20 s for an element |
| `wait:<seconds>` | sleep |
| `type:<text>` / `swipe:<up\|down\|left\|right>` | keyboard input / swipe |
| `shot:<name>` | screenshot |
| `tree:<name>` | compact accessibility tree: type, id, label, frame |

If a `tap` or `wait` doesn't find its element, the runner prints
`GOTE MISSING: …` and saves a screenshot and tree at that point.

**Driving TestFlight:** set `GOTE_BUNDLE=com.apple.TestFlight` to work in
TestFlight instead of gote, for example to update to the newest build:

```bash
GOTE_BUNDLE=com.apple.TestFlight e2e/device/run.sh <udid> "launch|tap:AppList.AppIcon.6792750976|wait:2|taplabel:Update|wait:40"
```

On iPhone, the Update button is in the app list. On iPad, tap the app first;
the button's id is `TestFlight.offerButton.update`.

**Production builds** don't contain the E2E mode's hidden `e2e-answer`
element. To answer a card, read the choices from a `tree:` (each one is
`study-choice-<name>`) and tap one by id. You can also use `tapxy`.
