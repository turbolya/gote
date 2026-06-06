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

  it('lands on the menu with every mode and explore entry', async () => {
    for (const id of [
      'mode-all',
      'mode-pick',
      'mode-custom',
      'mode-flash',
      'mode-speedrun',
      'mode-nearby',
    ]) {
      await visible(id);
    }
    // The Explore rows are below the fold — scroll to reach them.
    for (const id of ['open-lexicon', 'open-stats', 'open-settings']) {
      await scrollToId(id, 'menu-scroll');
    }
  });

  it('opens the Lexicon and returns', async () => {
    await tapScroll('open-lexicon', 'menu-scroll');
    await visible('lexicon-search');
    await tap('screen-back');
    await visible('mode-all');
  });

  it('opens Statistics and returns', async () => {
    await tapScroll('open-stats', 'menu-scroll');
    await waitFor(element(by.text('Statistics'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');
    await visible('mode-all');
  });

  it('opens Settings and returns', async () => {
    await tapScroll('open-settings', 'menu-scroll');
    await visible('settings-username');
    await tap('settings-back');
    await visible('mode-all');
  });
});
