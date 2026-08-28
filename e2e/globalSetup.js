// Jest's globalSetup: our preflight (see ./preflight.js), then Detox's own.
//
// Ordered so a bad environment stops the run before a simulator is booted and
// an app installed — the point is to fail in one line instead of in 34.
const detoxGlobalSetup = require('detox/runners/jest/globalSetup');
const preflight = require('./preflight');

module.exports = async function globalSetup(...args) {
  preflight();
  return detoxGlobalSetup(...args);
};
