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

// Scroll a container (by testID) until the target element is visible.
async function scrollToId(id, container, dir = 'down') {
  // Wait for the container to mount first (avoids a race right after a reload,
  // where whileElement would throw "no elements found" for the container).
  await exists(container);
  await waitFor(element(by.id(id)))
    .toBeVisible()
    .whileElement(by.id(container))
    .scroll(320, dir);
}

// Scroll the target into view, then tap it.
async function tapScroll(id, container, dir = 'down') {
  await scrollToId(id, container, dir);
  await element(by.id(id)).tap();
}

// Read an element's accessibility label (used to expose hidden test data).
async function labelOf(id) {
  await exists(id);
  const attrs = await element(by.id(id)).getAttributes();
  return attrs.label != null ? attrs.label : (attrs.elements && attrs.elements[0].label);
}

// Put text into a field, robustly.
//
// Three things, all of which this suite has flaked without:
//   • wait for the field — replaceText does not wait, so a screen that hasn't
//     finished mounting gives "No elements found".
//   • let it settle — synchronization is disabled suite-wide, so a field can
//     pass a visibility check and then fail the INTERACTION's own 100%
//     visibility threshold a moment later, while the screen is still animating
//     in ("View is not hittable at its visible point").
//   • replaceText, not typeText — typing raises the keyboard and fails that
//     same threshold far more often. Both search fields filter on onChangeText,
//     which replaceText fires just the same; pass '' to clear.
async function typeInto(id, text) {
  await visible(id);
  await new Promise((r) => setTimeout(r, 400));
  await element(by.id(id)).replaceText(text);
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
  scrollToId,
  tapScroll,
  labelOf,
  typeInto,
  tapCorrectChoice,
  tapCorrectPhoto,
};
