// Checks that run once, before Detox starts.
//
// Two environment faults have cost this suite hours. Neither announces itself:
// both come out as timeouts on some screen, which reads like a bug in that
// screen rather than in the machine or in the binary under test.
//
//   1. Another simulator left booted. A second iOS runtime brings its own
//      diagnosticd and apsd and competes for the machine. The suite does not
//      fail outright — it runs several times slower, so every wait in it gets
//      closer to its 20s limit. Measured here: with one stray device booted,
//      `browse` went from 92s to 1088s. Nothing in the output says "the machine
//      is oversubscribed"; it just goes red in a different place each run.
//
//   2. A binary built WITHOUT EXPO_PUBLIC_E2E. The app then talks to the real
//      iNaturalist API, sits on the loading screen, and every spec times out
//      waiting for the menu — 33 red tests that say nothing about the app.
//      Easy to cause by accident, because a plain `xcodebuild` writes the app
//      to the same derivedDataPath the Detox build uses, so the wrong binary
//      ends up at exactly the path .detoxrc.js points at.
//
// Both are one file-stat and one `simctl list` to detect, and neither is
// diagnosable from the failures they cause.

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const detoxrc = require('../.detoxrc');

// Written by the `build` command in .detoxrc.js, beside the .app it belongs to
// — so debug and release each get their own and cannot vouch for each other.
const MARKER = 'e2e-build.marker';

// Which app config this run will use. Detox takes --configuration; fall back to
// the release one, which is what the handbook and CI use.
function appConfig() {
  const i = process.argv.indexOf('--configuration');
  const name = i > -1 ? process.argv[i + 1] : null;
  const chosen = (name && detoxrc.configurations[name]) || detoxrc.configurations['ios.sim.release'];
  return detoxrc.apps[chosen.app];
}

// Everything booted, across runtimes.
function bootedDevices() {
  const out = execFileSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], {
    encoding: 'utf8',
  });
  return Object.values(JSON.parse(out).devices || {}).flat();
}

// Leave the device the suite is about to drive; shut the rest down. Loudly,
// because taking someone's simulator away silently would be its own mystery.
function shutDownStrays() {
  const keep = detoxrc.devices.simulator.device.type;
  let strays;
  try {
    strays = bootedDevices().filter((d) => d.name !== keep);
  } catch (e) {
    // Not being able to ask is not a reason to refuse to run.
    console.warn(`e2e preflight: could not list booted simulators (${e.message})`);
    return;
  }
  for (const d of strays) {
    console.warn(
      `e2e preflight: shutting down "${d.name}" — a second booted simulator ` +
        'starves this run and turns real passes into timeouts.'
    );
    try {
      execFileSync('xcrun', ['simctl', 'shutdown', d.udid], { stdio: 'ignore' });
    } catch (e) {
      console.warn(`e2e preflight: could not shut down "${d.name}" (${e.message})`);
    }
  }
}

// The app at binaryPath must be the one the Detox build produced, not a plain
// build that happens to have landed in the same place.
function checkBinaryIsE2E() {
  const { binaryPath } = appConfig();
  const app = path.join(__dirname, '..', binaryPath);
  const binary = path.join(app, path.basename(app, '.app'));
  const marker = path.join(path.dirname(app), MARKER);

  if (!fs.existsSync(binary)) {
    throw new Error(
      `No app at ${binaryPath}.\nBuild it first:  npm run e2e:build`
    );
  }
  if (!fs.existsSync(marker)) {
    throw new Error(
      `${binaryPath} was not built by the Detox build, so it is probably not in\n` +
        'E2E mode — it would talk to the real API and every spec would time out\n' +
        'waiting for the menu.\n\nRebuild it:  npm run e2e:build'
    );
  }
  if (fs.statSync(binary).mtimeMs > fs.statSync(marker).mtimeMs) {
    throw new Error(
      `${binaryPath} has been rebuilt since the last Detox build — most likely by\n` +
        'a plain `xcodebuild`, which writes to the same derivedDataPath and drops\n' +
        'EXPO_PUBLIC_E2E. The app would talk to the real API and every spec would\n' +
        'time out waiting for the menu.\n\nRebuild it:  npm run e2e:build'
    );
  }
}

module.exports = function preflight() {
  checkBinaryIsE2E();
  shutDownStrays();
};
