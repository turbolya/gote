// Jest config for the screenshot run. rootDir is the repo root so the Detox jest
// runner modules resolve from the repo's node_modules; the only test it runs is
// this folder's screenshots.test.js.
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testMatch: ['<rootDir>/screenshots-local/screenshots.test.js'],
  testTimeout: 1800000, // 30 min — real downloads + per-screen loads add up
  maxWorkers: 1,
  globalSetup: 'detox/runners/jest/globalSetup',
  globalTeardown: 'detox/runners/jest/globalTeardown',
  reporters: ['detox/runners/jest/reporter'],
  testEnvironment: 'detox/runners/jest/testEnvironment',
  verbose: true,
};
