// Lexicon, flags, species detail, settings and statistics.
const { by, device, element, expect, waitFor } = require('detox');
const { visible, tap, tapScroll, scrollToId, labelOf, typeInto, TIMEOUT } = require('./helpers');

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
    await typeInto('lexicon-search', 'Robin');
    await visible('lexicon-row-1001'); // European Robin (fixture taxonId 1001)
    await tap('lexicon-row-1001');
    await visible('detail-back');
    await tap('detail-back');
    await visible('lexicon-search');
  });

  it('flags a species and filters to flagged only', async () => {
    await tapScroll('open-lexicon', 'menu-scroll');
    await typeInto('lexicon-search', 'Robin');
    await tap('lexicon-flag-1001'); // flag it
    await typeInto('lexicon-search', '');
    await tap('lexicon-filter-flagged'); // chip appears once something is flagged
    await visible('lexicon-row-1001');
    // The flagged-only filter should hide unflagged species (row not rendered).
    await expect(element(by.id('lexicon-row-1002'))).not.toExist();
  });

  it('flags a missed species from the results screen and opens its detail', async () => {
    await tapScroll('mode-flash', 'menu-scroll');
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
    await tapScroll('mode-flash', 'menu-scroll');
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
    // Stops at the button on purpose: this test is about the controls above it,
    // and the tallies it relies on must survive for it. The last test in the
    // file drives the confirm alert through to an actual reset.
    await tap('menu-stats'); // Statistics opens from the accuracy banner
    // Per-species list + sort options (a flash round was played earlier, so
    // there's at least one species with tallies). The trend charts sit above
    // the sort/filter controls, AND changing the sort or filter scrolls the list
    // back to the top — so re-scroll to each control before tapping it.
    await tapScroll('stats-sort-incorrect', 'stats-scroll');
    await tapScroll('stats-sort-correct', 'stats-scroll');
    // Filter toggle: my observations (default) ↔ all species ever seen.
    await tapScroll('stats-filter', 'stats-scroll');
    await tapScroll('stats-filter', 'stats-scroll');
    await scrollToId('stats-reset', 'stats-scroll');
    await expect(element(by.id('stats-reset'))).toBeVisible();
    await tap('screen-back');
    await visible('mode-all');
  });

  // Deliberately last in the file: it wipes the tallies every test above builds
  // on. The reset handler is the one place that clears in-memory state, storage
  // and the synced note tombstones together, and a throw there is invisible
  // until a real user taps the button — so it is worth driving the system alert
  // the test above declines to.
  it('resetting statistics empties the per-species list', async () => {
    await tap('menu-stats');
    await tapScroll('stats-sort-incorrect', 'stats-scroll'); // list has rows
    await scrollToId('stats-reset', 'stats-scroll');
    await tap('stats-reset');
    // The destructive button on the native confirm.
    await waitFor(element(by.label('Reset')).atIndex(0)).toBeVisible().withTimeout(TIMEOUT);
    await element(by.label('Reset')).atIndex(0).tap();
    // With no tallies left the list is replaced by its empty state, so the sort
    // chips (which only render alongside rows) must be gone.
    await waitFor(element(by.id('stats-sort-incorrect')))
      .not.toExist()
      .withTimeout(TIMEOUT);
  });
});
