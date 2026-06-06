// Shared helpers for the Detox specs.
const { by, element, waitFor } = require('detox');

const TIMEOUT = 20000;

// Wait until an element (by testID) is visible.
async function visible(id, timeout = TIMEOUT) {
  await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout);
}

// Wait until an element exists in the hierarchy (may be off-screen / tiny).
async function exists(id, timeout = TIMEOUT) {
  await waitFor(element(by.id(id))).toExist().withTimeout(timeout);
}

// Wait for, then tap, an element by testID.
async function tap(id, timeout = TIMEOUT) {
  await visible(id, timeout);
  await element(by.id(id)).tap();
}

// Read an element's accessibility label (used to expose hidden test data).
async function labelOf(id) {
  await exists(id);
  const attrs = await element(by.id(id)).getAttributes();
  return attrs.label != null ? attrs.label : (attrs.elements && attrs.elements[0].label);
}

// In a multiple-choice study round: read the correct answer (exposed via a
// hidden element) and tap the matching choice tile.
async function tapCorrectChoice() {
  const answer = await labelOf('e2e-answer');
  await tap(`study-choice-${answer}`);
  return answer;
}

// In "Pick the right one": read the correct taxonId and tap that photo tile.
async function tapCorrectPhoto() {
  const taxonId = await labelOf('e2e-pick-answer');
  await tap(`pick-tile-${taxonId}`);
  return taxonId;
}

module.exports = {
  TIMEOUT,
  visible,
  exists,
  tap,
  labelOf,
  tapCorrectChoice,
  tapCorrectPhoto,
};
