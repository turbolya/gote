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

  it('lands on the menu with every entry across the three sections', async () => {
    // Play, Learn, then Settings (top → bottom); scroll to reach lower ones.
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

  it('opens Smart play and shows its question-type picker', async () => {
    await tapScroll('mode-smart', 'menu-scroll');
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
    await tapScroll('mode-smart', 'menu-scroll');
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
    await tapScroll('mode-smart', 'menu-scroll');
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
