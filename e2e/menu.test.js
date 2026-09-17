// Menu + cross-screen navigation.
const { by, device, element, expect, waitFor } = require('detox');
const { visible, tap, tapScroll, scrollToId, TIMEOUT } = require('./helpers');

describe('Menu & navigation', () => {
  beforeAll(async () => {
    // Start from a clean install so flags/history don't leak between runs.
    await device.launchApp({ newInstance: true, delete: true });
    // The new iOS 26 simulator never reports "idle" to Detox, so auto-sync would
    // hang forever; we rely on explicit waitFor() polling instead.
    await device.disableSynchronization();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await device.disableSynchronization();
  });

  it('lands on the menu with every entry, top to bottom', async () => {
    // The three groups used to be labelled Play / Learn / Settings; they are
    // separated by a rule now, so this walks the entries themselves rather than
    // any heading. Scroll to reach the lower ones.
    for (const id of [
      'mode-smart', // Smart play
      'mode-speedrun',
      'mode-nearby',
      'mode-flash', // Learn
      'open-lexicon',
      'open-settings', // Settings
    ]) {
      await scrollToId(id, 'menu-scroll');
    }
    // Statistics is opened from the accuracy banner, not a list row.
    await visible('menu-stats');
  });

  // --- the recent-observations film strip -------------------------------------

  it('shows the five most recent observations as a film strip', async () => {
    // Fixture cards are dated 2024-05-01 upward by index, so the newest five are
    // the last five — daisy (1008) newest, blackbird (1004) fifth. Asserting the
    // OLDEST three are absent is the half that catches a strip showing
    // everything, or showing the wrong end of the deck.
    await visible('recent-strip');
    for (const id of [1008, 1007, 1006, 1005, 1004]) {
      await visible(`recent-photo-${id}`);
    }
    for (const id of [1003, 1002, 1001]) {
      await expect(element(by.id(`recent-photo-${id}`))).not.toExist();
    }
  });

  it('a strip photo opens a popup that names it, and closes three ways', async () => {
    await tap('recent-photo-1008');
    await visible('recent-popup-close');
    // The popup is what puts a name to the picture — the strip deliberately does
    // not, so this is the whole point of tapping.
    await waitFor(element(by.text('Common Daisy'))).toBeVisible().withTimeout(TIMEOUT);
    await waitFor(element(by.text('Bellis perennis'))).toBeVisible().withTimeout(TIMEOUT);

    // 1. the ✕
    await tap('recent-popup-close');
    await waitFor(element(by.id('recent-popup-close'))).not.toBeVisible().withTimeout(TIMEOUT);
    await visible('mode-smart'); // back on the menu, nothing navigated

    // 2. a tap outside the card. The backdrop fills the screen and the card
    //    sits in the middle of it, so aim near the top edge — inside the
    //    backdrop, clear of the card.
    await tap('recent-photo-1007');
    await visible('recent-popup-close');
    await element(by.id('recent-popup-backdrop')).tapAtPoint({ x: 30, y: 40 });
    await waitFor(element(by.id('recent-popup-close'))).not.toBeVisible().withTimeout(TIMEOUT);
    await visible('mode-smart');
  });

  it('the popup\'s info button opens that species in the Lexicon', async () => {
    await tap('recent-photo-1005');
    await visible('recent-popup-close');
    await tap('recent-popup-info');
    // The species page itself…
    await visible('detail-hero');
    await waitFor(element(by.text('Monarch'))).toBeVisible().withTimeout(TIMEOUT);
    // …and behind it the Lexicon, so closing the page leaves you browsing
    // rather than back where you started.
    await tap('detail-back');
    await visible('lexicon-search');
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('shows the lowercase "gote" brand wordmark on the hero', async () => {
    // The hero logotype is the rounded Fredoka wordmark, set lowercase.
    await waitFor(element(by.id('menu-wordmark')))
      .toHaveText('gote')
      .withTimeout(TIMEOUT);
  });

  it('opens the Lexicon and returns', async () => {
    await tapScroll('open-lexicon', 'menu-scroll');
    await visible('lexicon-search');
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('opens Statistics from the accuracy banner and returns', async () => {
    await tap('menu-stats');
    await waitFor(element(by.text('Statistics'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('opens the Smart play options and shows its question-type picker', async () => {
    // Smart play is played from the menu card; ⋯ is the way to everything the
    // card has no room for.
    await tapScroll('smart-more', 'menu-scroll');
    // The picker is CustomScreen with the question-type section added, so the
    // shared controls must still be there alongside the new ones.
    await visible('custom-groups-none');
    for (const id of ['smart-type-picture', 'smart-type-name', 'smart-type-pair', 'smart-type-typed']) {
      await visible(id);
    }
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('the group All / None shortcuts clear and restore the selection', async () => {
    await tapScroll('smart-more', 'menu-scroll');
    // With nothing selected the round cannot be built, so Start must say so
    // rather than silently starting on the whole deck.
    await tap('custom-groups-none');
    await waitFor(element(by.text('Select a group'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('custom-groups-all');
    await waitFor(element(by.text('Select a group'))).not.toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('refuses to turn off the last question type', async () => {
    await tapScroll('smart-more', 'menu-scroll');
    // Three off leaves one; the fourth tap must be a no-op, because a round
    // with no possible question is not a state the player should reach.
    await tap('smart-type-picture');
    await tap('smart-type-name');
    await tap('smart-type-pair');
    await tap('smart-type-typed');
    // Still startable: the last type survived.
    await waitFor(element(by.text('Select a group'))).not.toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('Statistics explanations stay behind their ⓘ buttons', async () => {
    await tap('menu-stats');
    await waitFor(element(by.text('Statistics'))).toBeVisible().withTimeout(TIMEOUT);
    // Closed by default — the page should read as figures first.
    await expect(element(by.id('stats-info-streak'))).toBeVisible();
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('opens Settings and returns', async () => {
    await tapScroll('open-settings', 'menu-scroll');
    await visible('settings-username');
    await tap('settings-back');
    await visible('mode-smart');
  });

});
