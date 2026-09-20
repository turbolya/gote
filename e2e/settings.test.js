// Settings: the preferences themselves, and that they survive a relaunch.
// Covers TC-6.1 (theme), TC-6.2 (study-option filters) and TC-6.3 (persistence
// across a restart), which the other suites only ever passed through.
const { by, device, element, expect, waitFor } = require('detox');
const { settle, visible, exists, tap, tapScroll, scrollToId, TIMEOUT } = require('./helpers');

// A RN Switch reports its state as a value of '1' / '0'; a theme option is a
// radio, whose chosen-ness is in `selected`. Both are read rather than inferred
// from a screenshot, so a preference that silently stops applying still fails.
const switchOn = async (id) => {
  await exists(`${id}-switch`);
  const { value } = await element(by.id(`${id}-switch`)).getAttributes();
  return value === '1' || value === 1 || value === true;
};
// By the spoken label: Detox does not surface accessibilityState.selected on
// iOS, and the tint that shows it on screen is not readable at all. The label
// carries ", selected" for exactly this reason (see SettingsScreen).
const themeChosen = async (mode) => {
  await exists(`theme-${mode}`);
  const { label } = await element(by.id(`theme-${mode}`)).getAttributes();
  return String(label || '').includes('selected');
};

// Idempotent, and each case calls it: a spec that only works when the one
// before it happened to leave the right screen up is a spec that cannot be run
// with -t, which is exactly when you most want to run one.
const openSettings = async () => {
  try {
    await exists('settings-scroll', 1500);
  } catch (e) {
    await visible('mode-smart');
    await settle();
    await tapScroll('open-settings', 'menu-scroll');
    await visible('settings-scroll');
  }
  // From the top every time, so a scrollToId below is a scroll DOWN.
  try {
    await element(by.id('settings-scroll')).scrollTo('top');
  } catch (e) { /* already there */ }
  await settle(250);
};

describe('Settings', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
  });

  it('TC-6.1 the theme can be set to light, dark or system', async () => {
    await openSettings();
    await scrollToId('theme-system', 'settings-scroll');
    // System is the default a fresh install opens on.
    if (!(await themeChosen('system'))) throw new Error('a fresh install is not on System');
    for (const mode of ['light', 'dark', 'system']) {
      await tap(`theme-${mode}`);
      await settle();
      if (!(await themeChosen(mode))) throw new Error(`${mode} did not take`);
      for (const other of ['light', 'dark', 'system'].filter((m) => m !== mode)) {
        if (await themeChosen(other)) throw new Error(`${other} stayed chosen alongside ${mode}`);
      }
    }
  });

  it('TC-6.2 each study-option filter toggles', async () => {
    await openSettings();
    // Four independent switches: flipping one must not move the others, which
    // is the failure a single shared handler would produce.
    const ids = ['setting-per-species', 'setting-research-grade', 'setting-species-only', 'setting-fresh-photos'];
    const before = {};
    for (const id of ids) {
      await scrollToId(id, 'settings-scroll');
      before[id] = await switchOn(id);
    }
    for (const id of ids) {
      await scrollToId(id, 'settings-scroll');
      await tap(`${id}-switch`);
      await settle(250);
      if ((await switchOn(id)) === before[id]) throw new Error(`${id} did not toggle`);
    }
    // …and they are all in their new state at once, not just one at a time.
    for (const id of ids) {
      await scrollToId(id, 'settings-scroll');
      if ((await switchOn(id)) === before[id]) throw new Error(`${id} reverted`);
    }
  });

  it('TC-6.3 theme and filters survive a force-quit', async () => {
    // Settings applies filter changes when you LEAVE the screen (see `leave`
    // in SettingsScreen — otherwise a change made without pressing "Load
    // observations" would be discarded). So this leaves before relaunching,
    // which is also the order a player does it in. Relaunching straight from
    // the screen is a different case, and a passing one either way: nothing
    // was applied, so nothing has to survive.
    await openSettings();
    const ids = ['setting-per-species', 'setting-research-grade', 'setting-species-only', 'setting-fresh-photos'];
    const wanted = {};
    for (const id of ids) {
      await scrollToId(id, 'settings-scroll');
      await tap(`${id}-switch`);
      await settle(250);
      wanted[id] = await switchOn(id);
    }
    await scrollToId('theme-dark', 'settings-scroll');
    await tap('theme-dark');
    await settle();
    await tap('settings-back');
    await visible('mode-smart');
    await settle();

    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await openSettings();
    // In page order: scrollToId only ever scrolls DOWN, and the switches sit
    // above the theme row.
    for (const id of ids) {
      await scrollToId(id, 'settings-scroll');
      if ((await switchOn(id)) !== wanted[id]) throw new Error(`${id} did not survive the relaunch`);
    }
    await scrollToId('theme-dark', 'settings-scroll');
    if (!(await themeChosen('dark'))) throw new Error('the theme did not survive the relaunch');
    // Leave the install on the default theme for whatever runs next.
    await tap('theme-system');
    await settle();
    await tap('settings-back');
    await visible('mode-smart');
  });
});
