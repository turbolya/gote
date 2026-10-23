// The rule for whether sync exists in a build, on its own so that
// scripts/test-syncconfig.js can load it in plain node (config.js pulls in
// modules node cannot resolve).
//
//   inApp  — running inside the app (React Native), not a node test script. Under
//            node the code below would otherwise reach for the live service, so
//            tests opt in explicitly with setSyncEnabledForTests.
//   fdroid — the F-Droid build: no sync, by decision (docs/FDROID.md).
//   e2e / shots — the two synthetic modes. E2E must stay offline and
//            deterministic, and the screenshot build seeds fake lifetime stats
//            that must never be uploaded to the real account they are captured
//            from.
export function syncEnabled({ inApp = true, fdroid = false, url = '', key = '', e2e = false, shots = false } = {}) {
  return !!inApp && !fdroid && Boolean(url && key) && !e2e && !shots;
}

