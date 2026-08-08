/** Jest config for the Detox end-to-end suite. */
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/e2e/**/*.test.js'],
  testTimeout: 180000,
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  setupFilesAfterEnv: ['<rootDir>/e2e/setup.js'],
  // Jest's default crawler reaches for watchman, which this suite has no use
  // for — it runs once against a built binary and never watches for changes.
  // When watchman can't write its state directory it doesn't degrade, it throws
  // an unhandled 'error' event and the whole run dies before a single test
  // starts, which reads exactly like a broken test suite.
  watchman: false,
  verbose: true,
};
