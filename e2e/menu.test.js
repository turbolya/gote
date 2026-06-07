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
      'mode-all', // By name
      'mode-pick', // By picture
      'mode-speedrun',
      'mode-nearby',
      'mode-custom',
      'mode-flash', // Learn
      'open-lexicon',
      'open-stats', // Settings
      'open-settings',
    ]) {
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
