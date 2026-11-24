// The species-name language and "Use my location", which no spec reached until
// the 2.46.2 device test listed them as untested.
//
// Location runs against the simulator's own location service: Detox grants or
// refuses the permission at launch and sets the coordinates, so expo-location
// and the permission path are the real ones, not a stub.
const { by, device, element, waitFor } = require('detox');
const { settle, visible, exists, tap, tapScroll, scrollToId, typeInto, labelOf, TIMEOUT } = require('./helpers');

const expectLabel = async (id, want, ms = 8000) => {
  const end = Date.now() + ms;
  let got;
  do {
    got = await labelOf(id);
    if (got === want) return;
    await settle(400);
  } while (Date.now() < end);
  throw new Error(`${id} reads ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

// Settings applies its changes on the way out (Save, or back), and only for an
// account: with no username there is nothing to load names for, and leaving
// just goes back. So the spec studies a named account, as a player would.
const openSettings = async () => {
  await visible('mode-smart');
  await settle();
  await tapScroll('open-settings', 'menu-scroll');
  await visible('settings-scroll');
  await settle();
};

const leaveSettings = async () => {
  await settle(300);
  await tap('settings-back');
  await visible('mode-smart');
  await settle();
};

const chooseLanguage = async (search, code) => {
  await scrollToId('language-field', 'settings-scroll');
  await tap('language-field');
  await settle(700); // the sheet slides up; a tap during it is lost
  await typeInto('language-search', search);
  await settle(500);
  await tap(`language-option-${code}`);
  await settle(700);
};

const openNearby = async () => {
  await visible('mode-smart');
  await settle();
  await tapScroll('mode-nearby', 'menu-scroll');
  // Not nearby-search: Nearby remembers the last place, and shows it instead.
  await visible('nearby-start');
};

describe('Species name language', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
  });

  it('a chosen language shows in the field and the filter, and survives a relaunch', async () => {
    await openSettings();
    await scrollToId('language-field', 'settings-scroll');
    if (!(await labelOf('language-field')).includes('English')) {
      throw new Error('a fresh install is not on English');
    }
    await chooseLanguage('hung', 'hu');
    await expectLabel('language-field', 'Hungarian, Magyar');
    await scrollToId('setting-named-only', 'settings-scroll');
    await waitFor(element(by.text('Only species named in Hungarian'))).toExist().withTimeout(TIMEOUT);
    // Last, because it raises the keyboard, which blocks scrolling.
    await element(by.id('settings-scroll')).scrollTo('top');
    await typeInto('settings-username', 'e2e-tester');
    await leaveSettings();

    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await openSettings();
    await scrollToId('language-field', 'settings-scroll');
    await expectLabel('language-field', 'Hungarian, Magyar');

    // Back to English, so the rest of the suite is not run in Hungarian.
    await chooseLanguage('engl', 'en');
    await expectLabel('language-field', 'English');
    await leaveSettings();
  });

  it('a search that matches nothing says so, and Done closes the list', async () => {
    await openSettings();
    await scrollToId('language-field', 'settings-scroll');
    await tap('language-field');
    await settle(700);
    await typeInto('language-search', 'zzzz');
    await waitFor(element(by.text('No languages match “zzzz”.'))).toExist().withTimeout(TIMEOUT);
    await tap('language-done');
    await waitFor(element(by.id('language-search'))).not.toExist().withTimeout(TIMEOUT);
    await leaveSettings();
  });
});

describe('Use my location', () => {
  it('with permission, it sets the place and a round can start from it', async () => {
    await device.launchApp({ newInstance: true, delete: true, permissions: { location: 'inuse' } });
    await device.disableSynchronization();
    await device.setLocation(47.4979, 19.0402);
    await openNearby();
    await tap('nearby-gps');
    await waitFor(element(by.id('nearby-place'))).toHaveText('My location').withTimeout(TIMEOUT);
    await tap('nearby-start');
    await visible('study-reveal');
    await tap('study-end');
    await visible('results-menu');
  });

  it('the chosen place is remembered, and clearing it brings the button back', async () => {
    await tap('results-menu');
    await openNearby();
    await waitFor(element(by.id('nearby-place'))).toHaveText('My location').withTimeout(TIMEOUT);
    await tap('nearby-place-clear');
    await visible('nearby-gps');
    await waitFor(element(by.id('nearby-place'))).not.toExist().withTimeout(TIMEOUT);
  });

  it('without permission, it says so and points to the search', async () => {
    await device.launchApp({ newInstance: true, delete: true, permissions: { location: 'never' } });
    await device.disableSynchronization();
    await openNearby();
    await tap('nearby-gps');
    await waitFor(element(by.id('nearby-error')))
      .toHaveText('Location permission denied. Search for a place instead.')
      .withTimeout(TIMEOUT);
    await waitFor(element(by.id('nearby-place'))).not.toExist().withTimeout(2000);
    // The search still works after the refusal.
    await typeInto('nearby-search', 'Test');
    await exists('nearby-result-9001');
  });
});
