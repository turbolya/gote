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
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/Gote.app',
      build:
        'EXPO_PUBLIC_E2E=1 xcodebuild -workspace ios/Gote.xcworkspace -scheme Gote -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build -quiet',
    },
    'ios.release': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Release-iphonesimulator/Gote.app',
      build:
        'EXPO_PUBLIC_E2E=1 xcodebuild -workspace ios/Gote.xcworkspace -scheme Gote -configuration Release -sdk iphonesimulator -derivedDataPath ios/build -quiet',
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
