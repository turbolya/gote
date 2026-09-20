// Offline behaviour. A simulator has no airplane mode, so these drive the
// IS_E2E-only override in src/net.js through the hidden toggle App.js renders
// (testID e2e-offline-toggle) — the app's own signal, pinned, rather than a
// mock of the screens under test.
//
// Covers TC-7.1 (the banner and what it dims), TC-7.3 (online-only modes are
// blocked, not broken), TC-7.4 (the Observations row pauses) and TC-7.7
// (reconnecting clears all of it). TC-7.2, 7.5, 7.6 and 7.8 stay manual: they
// are about the downloaded photo pack and a real backgrounded app.
const { by, device, element, expect, waitFor } = require('detox');
const { settle, visible, exists, tap, tapScroll, scrollToId, TIMEOUT } = require('./helpers');

// The toggle flips; its label says which way it went, so a spec can put the
// app in a known state rather than assuming.
const setOffline = async (want) => {
  await exists('e2e-offline-toggle');
  for (let i = 0; i < 3; i++) {
    const { label } = await element(by.id('e2e-offline-toggle')).getAttributes();
    if ((label === 'offline') === want) return;
    await element(by.id('e2e-offline-toggle')).tap();
    await settle(400);
  }
  throw new Error(`could not put the app ${want ? 'offline' : 'online'}`);
};

const chipValue = async (id) => (await element(by.id(id)).getAttributes()).value;

// A relaunch rather than a walk back to the menu: the override lives in the
// JS module, so a fresh launch is also a guaranteed ONLINE start. Each case
// therefore begins in the same state and can be run on its own with -t.
const freshMenu = async () => {
  await device.launchApp({ newInstance: true });
  await device.disableSynchronization();
  await visible('mode-smart');
  await settle();
};

describe('Offline', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
  });

  afterAll(async () => {
    // Leave the app online for whatever runs next.
    try { await setOffline(false); } catch (e) { /* nothing to undo */ }
  });

  it('TC-7.1 the banner appears, and the photo question goes with it', async () => {
    await visible('mode-smart');
    await settle();
    await expect(element(by.id('offline-banner'))).not.toExist();
    await setOffline(true);
    await visible('offline-banner');
    // The photo grid needs four other species' photos fetched live, so it is
    // the one question type that cannot run — it dims with the banner.
    if ((await chipValue('menu-type-picture')) !== '0') {
      throw new Error('the photo chip is still on with no connection');
    }
  });

  it('TC-7.3 Nearby species is blocked rather than broken', async () => {
    await freshMenu();
    await setOffline(true);
    await visible('mode-smart');
    await tapScroll('mode-nearby', 'menu-scroll');
    // Tapping it must not navigate: no dead screen, no spinner forever.
    await settle();
    await visible('mode-smart');
    await expect(element(by.id('nearby-search'))).not.toExist();
  });

  it('TC-7.4 the Observations row says it is paused, and Update is disabled', async () => {
    await freshMenu();
    await setOffline(true);
    await visible('mode-smart');
    await settle();
    await tapScroll('open-settings', 'menu-scroll');
    await visible('settings-scroll');
    await waitFor(element(by.text('Offline — reconnect to update.')))
      .toExist()
      .withTimeout(TIMEOUT);
    // By what the button DOES, not by its `enabled` attribute: Detox reads a
    // disabled RN Pressable as enabled on iOS. A live Update would put the row
    // into "Checking for updates…"; a paused one leaves it saying Offline.
    // The UPDATE pill, not settings-load — that one is Save, and saving leaves
    // the screen, which is how this case first read as "the text vanished".
    await element(by.id('settings-update')).tap();
    await settle(800);
    await waitFor(element(by.text('Offline — reconnect to update.')))
      .toExist()
      .withTimeout(TIMEOUT);
    await tap('settings-back');
    await visible('mode-smart');
  });

  it('TC-7.7 reconnecting clears the banner and re-enables everything', async () => {
    await freshMenu();
    await setOffline(true);
    await visible('offline-banner');
    await setOffline(false);
    await waitFor(element(by.id('offline-banner'))).not.toExist().withTimeout(TIMEOUT);
    if ((await chipValue('menu-type-picture')) !== '1') {
      throw new Error('the photo chip did not come back');
    }
    // …and Nearby opens again.
    await tapScroll('mode-nearby', 'menu-scroll');
    await visible('nearby-search');
    await tap('screen-back');
    await visible('mode-smart');
  });
});
