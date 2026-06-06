// Lexicon, flags, species detail, settings and statistics.
const { by, device, element, expect, waitFor } = require('detox');
const { visible, tap, labelOf, TIMEOUT } = require('./helpers');

describe('Lexicon, flags & detail', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('searches, opens a species detail page and returns', async () => {
    await tap('open-lexicon');
    await element(by.id('lexicon-search')).typeText('Robin');
    await visible('lexicon-row-1001'); // European Robin (fixture taxonId 1001)
    await tap('lexicon-row-1001');
    await visible('detail-back');
    await tap('detail-back');
    await visible('lexicon-search');
  });

  it('flags a species and filters to flagged only', async () => {
    await tap('open-lexicon');
    await element(by.id('lexicon-search')).typeText('Robin');
    await tap('lexicon-flag-1001'); // flag it
    await element(by.id('lexicon-search')).clearText();
    await tap('lexicon-filter-flagged'); // chip appears once something is flagged
    await visible('lexicon-row-1001');
    // The flagged-only filter should hide unflagged species (row not rendered).
    await expect(element(by.id('lexicon-row-1002'))).not.toExist();
  });

  it('flags a missed species from the results screen and opens its detail', async () => {
    await tap('mode-flash');
    await tap('custom-start');
    await visible('study-screen');
    const answer = await labelOf('e2e-answer');
    await tap('study-reveal'); // Reveal answer
    await tap('study-grade-missed'); // mark it missed
    await tap('study-end');
    await visible('results-screen');
    // The missed list shows the species name; tapping opens the same detail page.
    await element(by.text(answer)).atIndex(0).tap();
    await visible('detail-back');
    await tap('detail-back');
    await visible('results-screen');
  });
});

describe('Settings & statistics', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('opens the changelog and licensing pages and returns', async () => {
    await tap('open-settings');
    await visible('settings-username');

    await tap('settings-changelog');
    await waitFor(element(by.text("What's new"))).toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');

    await visible('settings-username');
    await tap('settings-legal');
    await waitFor(element(by.text('Data & licensing')))
      .toBeVisible()
      .withTimeout(TIMEOUT);
    await tap('screen-back');

    await tap('settings-back');
    await visible('mode-all');
  });

  it('shows the reset confirmation and cancels it', async () => {
    await tap('open-stats');
    await visible('stats-reset');
    await tap('stats-reset');
    // System confirmation dialog — cancel so we don't wipe data.
    await element(by.label('Cancel')).atIndex(0).tap();
    await tap('screen-back');
    await visible('mode-all');
  });
});
