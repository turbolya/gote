// Lexicon, flags, species detail, settings and statistics.
const { by, device, element, expect, waitFor } = require('detox');
const { visible, tap, tapScroll, scrollToId, labelOf, TIMEOUT } = require('./helpers');

describe('Lexicon, flags & detail', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await device.disableSynchronization();
  });

  it('searches, opens a species detail page and returns', async () => {
    await tapScroll('open-lexicon', 'menu-scroll');
    await element(by.id('lexicon-search')).typeText('Robin');
    await visible('lexicon-row-1001'); // European Robin (fixture taxonId 1001)
    await tap('lexicon-row-1001');
    await visible('detail-back');
    await tap('detail-back');
    await visible('lexicon-search');
  });

  it('flags a species and filters to flagged only', async () => {
    await tapScroll('open-lexicon', 'menu-scroll');
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
    await visible('results-menu');
    // The missed list shows the species name; tapping opens the same detail page.
    await element(by.text(answer)).atIndex(0).tap();
    await visible('detail-back');
    await tap('detail-back');
    await visible('results-menu');
  });

  it('opens a species detail page from the statistics list', async () => {
    // Play a full flash round so every fixture species gets a tally.
    await tap('mode-flash');
    await tap('custom-start');
    for (let i = 0; i < 8; i++) {
      try {
        await visible('study-reveal', 4000);
      } catch (e) {
        break; // round finished
      }
      await tap('study-reveal');
      await tap('study-grade-knew');
    }
    await visible('results-menu');
    await tap('results-menu');
    await tap('menu-stats');
    // The trend charts sit above the list, so scroll the row into view first.
    // Flag toggle on the stats row (between the name and the bars).
    await tapScroll('stats-flag-1001', 'stats-scroll');
    // Tapping the row opens the same detail page as the Lexicon.
    await tapScroll('stats-card-1001', 'stats-scroll'); // European Robin (fixture)
    await visible('detail-back');
    await tap('detail-flag'); // flag toggle on the detail page
    await tap('detail-back');
    await scrollToId('stats-sort-pct', 'stats-scroll', 'up');
  });
});

describe('Settings & statistics', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await device.disableSynchronization();
  });

  it('opens the changelog and licensing pages and returns', async () => {
    await tapScroll('open-settings', 'menu-scroll');
    await visible('settings-username');

    await tapScroll('settings-changelog', 'settings-scroll');
    await waitFor(element(by.text("What's new"))).toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');

    await visible('settings-username');
    await tapScroll('settings-legal', 'settings-scroll');
    await waitFor(element(by.text('Data & licensing')))
      .toBeVisible()
      .withTimeout(TIMEOUT);
    await tap('screen-back');

    await tap('settings-back');
    await visible('mode-all');
  });

  it('opens statistics and shows the reset control', async () => {
    // Note: tapping Reset opens a native iOS alert, which Detox can't drive
    // reliably with synchronization disabled, so we stop at the button rather
    // than exercise the destructive system dialog.
    await tap('menu-stats'); // Statistics opens from the accuracy banner
    // Per-species list + sort options (a flash round was played earlier, so
    // there's at least one species with tallies). The trend charts sit above
    // the sort options, so scroll them into view first.
    await scrollToId('stats-sort-pct', 'stats-scroll');
    await tap('stats-sort-incorrect');
    await tap('stats-sort-correct');
    // Filter toggle: my observations (default) ↔ all species ever seen.
    await tap('stats-filter');
    await tap('stats-filter');
    await scrollToId('stats-reset', 'stats-scroll');
    await expect(element(by.id('stats-reset'))).toBeVisible();
    await tap('screen-back');
    await visible('mode-all');
  });
});
