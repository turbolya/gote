// Menu + cross-screen navigation.
const { by, device, element, expect, waitFor } = require('detox');
const { visible, tap, TIMEOUT } = require('./helpers');

describe('Menu & navigation', () => {
  beforeAll(async () => {
    // Start from a clean install so flags/history don't leak between runs.
    await device.launchApp({ newInstance: true, delete: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('lands on the menu with every mode and explore entry', async () => {
    for (const id of [
      'mode-all',
      'mode-pick',
      'mode-custom',
      'mode-flash',
      'mode-speedrun',
      'mode-nearby',
      'open-lexicon',
      'open-stats',
      'open-settings',
    ]) {
      await visible(id);
    }
  });

  it('opens the Lexicon and returns', async () => {
    await tap('open-lexicon');
    await visible('lexicon-search');
    await tap('screen-back');
    await visible('mode-all');
  });

  it('opens Statistics and returns', async () => {
    await tap('open-stats');
    await waitFor(element(by.text('Statistics'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');
    await visible('mode-all');
  });

  it('opens Settings and returns', async () => {
    await tap('open-settings');
    await visible('settings-username');
    await tap('settings-back');
    await visible('mode-all');
  });
});
