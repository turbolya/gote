// Detox configuration. See e2e/README.md for the full build + run instructions.
//
// The app is built with EXPO_PUBLIC_E2E=1, which puts it in offline "E2E mode":
// it loads a fixture deck and stubs every network call (see src/e2e/*), so the
// tests are deterministic and never touch the iNaturalist API. The Release
// configuration bakes that env var into the JS bundle and is the recommended one
// for CI; the Debug configuration needs Metro started with the same env var.

/** @type {Detox.DetoxConfig} */
module.exports = {
  testRunner: {
    args: { $0: 'jest', config: 'e2e/jest.config.js' },
    jest: { setupTimeout: 180000 },
  },
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/gote.app',
      // NOTE: -destination, not -sdk. Passing -sdk iphonesimulator overrides
      // the SDK for EVERY target in the scheme — including the embedded watchOS
      // app/widget (targets/), which then fail to compile against the iOS SDK.
      // Scheme/workspace are lowercase "gote" (the CNG project name); the scheme
      // name is case-sensitive to xcodebuild, so capital "Gote" fails.
      // The marker is how e2e/preflight.js knows the app at binaryPath came
      // from HERE and not from a plain xcodebuild into the same derivedDataPath
      // — which would drop EXPO_PUBLIC_E2E and leave every spec waiting on a
      // menu that never comes.
      build:
        "EXPO_PUBLIC_E2E=1 xcodebuild -workspace ios/gote.xcworkspace -scheme gote -configuration Debug -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build -quiet && touch ios/build/Build/Products/Debug-iphonesimulator/e2e-build.marker",
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/gote.app',
      // See the -destination + lowercase-scheme notes on ios.debug above.
      build:
        "EXPO_PUBLIC_E2E=1 xcodebuild -workspace ios/gote.xcworkspace -scheme gote -configuration Release -destination 'generic/platform=iOS Simulator' -derivedDataPath ios/build -quiet && touch ios/build/Build/Products/Release-iphonesimulator/e2e-build.marker",
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: { type: 'iPhone 17' },
    },
  },
  configurations: {
    'ios.sim.debug': { device: 'simulator', app: 'ios.debug' },
    'ios.sim.release': { device: 'simulator', app: 'ios.release' },
  },
};
