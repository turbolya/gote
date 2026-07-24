// Detox config for App Store SCREENSHOTS (separate from the e2e config).
//
// Unlike the e2e build, this one does NOT set EXPO_PUBLIC_E2E, so the app runs
// against the REAL iNaturalist network and the configured account (mate_koch) —
// the screenshots use live photos and data. It DOES set EXPO_PUBLIC_SHOTS=1,
// which makes the app seed realistic gameplay stats on first launch (a busy
// hero, a full accuracy chart, a populated Statistics page — see
// src/e2e/shotsSeed.js). Built to ../build-shots (outside ios/, like
// build-device) so it doesn't disturb the e2e build or pod install.
//
// This whole folder is gitignored — it lives in the repo only so Detox + jest
// resolve from the repo's node_modules; the screenshots are written to the
// non-git gote-launch folder.

const path = require('path');

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: path.join(__dirname, 'jest.shots.config.js') },
    jest: { setupTimeout: 600000 },
  },
  artifacts: {
    rootDir: process.env.SHOTS_OUT || path.join(__dirname, 'out'),
    plugins: {
      screenshot: {
        keepOnlyFailedTestsArtifacts: false,
        shouldTakeAutomaticSnapshots: false, // only the explicit takeScreenshot() calls
      },
    },
  },
  apps: {
    'ios.shots': {
      type: 'ios.app',
      binaryPath: 'build-shots/Build/Products/Release-iphonesimulator/gote.app',
      // NOTE: -destination, not -sdk — -sdk would override the SDK for the
      // embedded watchOS targets too and break their compile (see .detoxrc.js).
      // Scheme/workspace are lowercase "gote" (the CNG project name); the scheme
      // name is case-sensitive to xcodebuild, so capital "Gote" fails.
      build:
        "EXPO_PUBLIC_SHOTS=1 xcodebuild -workspace ios/gote.xcworkspace -scheme gote -configuration Release -destination 'generic/platform=iOS Simulator' -derivedDataPath build-shots -quiet",
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      // 6.9" device gives App Store-ready dimensions; override with SHOTS_DEVICE.
      device: { type: process.env.SHOTS_DEVICE || 'iPhone 17 Pro Max' },
    },
  },
  configurations: {
    'ios.shots': { device: 'simulator', app: 'ios.shots' },
  },
};
