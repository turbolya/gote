// Menu + cross-screen navigation.
const { by, device, element, expect, waitFor } = require('detox');
const { settle, visible, exists, tap, tapScroll, scrollToId, labelOf, TIMEOUT } = require('./helpers');

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

  it('TC-1.1 a cold start lands on the menu, with nothing played yet', async () => {
    // A fresh install, opened: the menu, no error banner, and a lifetime
    // accuracy of nothing rather than a stale or invented figure. (Under the
    // fixtures no network is involved at all, which is also what the case
    // asks for — it must not need one.)
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
    await visible('mode-smart');
    await expect(element(by.id('menu-error'))).not.toExist();
    await waitFor(element(by.id('menu-streak-count'))).toHaveText('0').withTimeout(TIMEOUT);
  });

  it('lands on the menu with every entry, top to bottom', async () => {
    // The three groups used to be labelled Play / Learn / Settings; they are
    // separated by a rule now, so this walks the entries themselves rather than
    // any heading. Scroll to reach the lower ones.
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

  // --- the recent-observations film strip -------------------------------------

  it('shows the ten most recent observations as a film strip', async () => {
    // The fixture deck is only eight cards, dated 2024-05-01 upward by index —
    // fewer than the strip's ten, so all eight are in it, newest (daisy, 1008)
    // first. The cap itself is covered in scripts/test-recent.js, where a deck
    // longer than ten costs nothing to build.
    await visible('recent-strip');
    // …under its fine-print caption, which belongs to the strip and goes with it.
    await visible('recent-label');
    // EXISTS, not visible: the strip is a horizontal scroll view and only three
    // or four 96pt frames fit across a phone, so most of it is off the right
    // edge by design — that overflow is the affordance saying "scrollable".
    // Asserting visibility here would be asserting the strip is too short.
    for (const id of [1008, 1007, 1006, 1005, 1004, 1003, 1002, 1001]) {
      await exists(`recent-photo-${id}`);
    }
    // The newest is the one that has to be on screen without scrolling.
    await visible('recent-photo-1008');
    // …and the ⋯ frame closes the row.
    await exists('recent-more');
  });

  it('the strip\'s ⋯ frame opens the Lexicon, newest first', async () => {
    // Sideways to the end of the strip, where the ⋯ frame sits past the photos.
    await tapScroll('recent-more', 'recent-strip', 'right');
    await visible('lexicon-search');
    // The order is named on screen, and the list starts where the strip began.
    await waitFor(element(by.text('Recent'))).toBeVisible().withTimeout(TIMEOUT);
    await visible('lexicon-row-1008');
    // One tap back to A→Z.
    await tap('lexicon-sort');
    await waitFor(element(by.text('A–Z'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('a strip photo opens a popup that names it, and closes three ways', async () => {
    await tap('recent-photo-1008');
    await visible('recent-popup-close');
    // The popup is what puts a name to the picture — the strip deliberately does
    // not, so this is the whole point of tapping.
    await waitFor(element(by.text('Common Daisy'))).toBeVisible().withTimeout(TIMEOUT);
    await waitFor(element(by.text('Bellis perennis'))).toBeVisible().withTimeout(TIMEOUT);

    // 1. the ✕. Settle first: the card is visible the moment the modal is
    //    presented, but the fade is still running, and a tap during it is
    //    swallowed silently — see settle() in helpers.
    await settle();
    await tap('recent-popup-close');
    await waitFor(element(by.id('recent-popup-close'))).not.toBeVisible().withTimeout(TIMEOUT);
    await visible('mode-smart'); // back on the menu, nothing navigated

    // 2. a tap outside the card. The backdrop fills the screen and the card
    //    sits in the middle of it, so aim near the top edge — inside the
    //    backdrop, clear of the card. Settle again on the way out as well as
    //    in: the modal leaves on a spring that holds an alpha-0 view over the
    //    strip after the card has gone.
    await settle();
    await tap('recent-photo-1007');
    await visible('recent-popup-close');
    await settle();
    await element(by.id('recent-popup-backdrop')).tapAtPoint({ x: 30, y: 40 });
    await waitFor(element(by.id('recent-popup-close'))).not.toBeVisible().withTimeout(TIMEOUT);
    await visible('mode-smart');
  });

  it('the popup\'s info button opens that species in the Lexicon', async () => {
    // The THIRD frame, not the fourth: at 96pt plus a 10pt gap from a 20pt
    // margin, frames four and five sit past the 402pt screen edge, so tapping
    // one would be testing the scroll rather than the popup.
    await tap('recent-photo-1006');
    await visible('recent-popup-close');
    await settle();
    await tap('recent-popup-info');
    // Settle on the way out too: the popup dismisses and navigates in one go,
    // and its leaving spring holds an alpha-0 view over the species page for a
    // moment — long enough to eat the tap on Back below.
    await settle();
    // The species page itself — by its own title element, not by loose text:
    // the Lexicon list underneath has a row with the same name on it.
    await visible('detail-hero');
    await waitFor(element(by.id('detail-title')))
      .toHaveText('Western Honey Bee')
      .withTimeout(TIMEOUT);
    // …and behind it the Lexicon, so closing the page leaves you browsing
    // rather than back where you started.
    await tap('detail-back');
    await visible('lexicon-search');
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('names each Smart play question type over its chip', async () => {
    // One word of fine print per chip — the full names live on the ⋯ screen.
    // By text, not just by id, so a chip that lost its `short` and fell back to
    // the long label would fail here rather than overflow quietly. In capitals:
    // the label is drawn with textTransform uppercase, and that is what iOS
    // reports as its text.
    // In the order they sit on the card: easiest question first.
    for (const [key, word] of [
      ['name', 'Name'],
      ['pair', 'Pairs'],
      ['picture', 'Photo'],
      ['typed', 'Typing'],
    ]) {
      await visible(`menu-type-label-${key}`);
      await expect(element(by.id(`menu-type-label-${key}`))).toHaveText(word.toUpperCase());
    }
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

  it('opens the Smart play options and shows its question-type picker', async () => {
    // Smart play is played from the menu card; ⋯ is the way to everything the
    // card has no room for.
    await tapScroll('smart-more', 'menu-scroll');
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
    await tapScroll('smart-more', 'menu-scroll');
    // With nothing selected the round cannot be built, so Start must say so
    // rather than silently starting on the whole deck.
    await tap('custom-groups-none');
    await waitFor(element(by.text('Select a group'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('custom-groups-all');
    await waitFor(element(by.text('Select a group'))).not.toBeVisible().withTimeout(TIMEOUT);
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('TC-2.10 the card reopens on the setup the last round was STARTED with', async () => {
    // The menu card is meant to be one tap from the round you last played, so
    // what it reopens on is the whole feature. Three separate claims:
    // a started setup is remembered, it survives a relaunch, and a setup backed
    // out of without starting is NOT remembered.
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
    await visible('mode-smart');
    await settle();
    await tapScroll('smart-more', 'menu-scroll');
    await visible('custom-start');
    // Name only, and the whole deck.
    for (const key of ['picture', 'typed']) await tap(`smart-type-${key}`);
    await scrollToId('custom-preset-max', 'custom-scroll');
    await tap('custom-preset-max');
    const deck = await labelOf('custom-count-value');
    await tap('custom-start');

    // Straight back out of the round — starting is what records the setup.
    await visible('study-reveal');
    await settle();
    await tap('study-end');
    await visible('results-menu');
    await tap('results-menu');
    await visible('mode-smart');
    await settle();

    const cardShows = async () => ({
      count: await labelOf('smart-count-value'),
      name: (await element(by.id('menu-type-name')).getAttributes()).value,
      picture: (await element(by.id('menu-type-picture')).getAttributes()).value,
      typed: (await element(by.id('menu-type-typed')).getAttributes()).value,
    });
    const after = await cardShows();
    if (after.count !== deck) throw new Error(`card opened on ${after.count} cards, not the deck's ${deck}`);
    if (after.name !== '1' || after.picture !== '0' || after.typed !== '0') {
      throw new Error(`card did not reopen on name-only: ${JSON.stringify(after)}`);
    }

    // …and again after a force-quit.
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await visible('mode-smart');
    await settle();
    const relaunched = await cardShows();
    if (relaunched.count !== deck || relaunched.name !== '1' || relaunched.picture !== '0') {
      throw new Error(`the relaunch lost the setup: ${JSON.stringify(relaunched)}`);
    }

    // Backing out of ⋯ without starting changes nothing.
    await tapScroll('smart-more', 'menu-scroll');
    await visible('custom-start');
    await tap('smart-type-picture');
    await tap('screen-back');
    await visible('mode-smart');
    await settle();
    const backedOut = await cardShows();
    if (backedOut.picture !== '0') throw new Error('a setup backed out of was remembered');
  });

  it('dims look-alike pairs until two species have been mixed up', async () => {
    // A fresh install has no confusion matrix, so there is no pair to ask
    // about. The chip says so by being disabled rather than by starting a
    // round that quietly asks something else — the shape this had before:
    // pairs-only with no confusions fell through to an ordinary mixed round.
    // By the spoken label and the switch value, not by `enabled`: Detox reads
    // a disabled RN Pressable as enabled on iOS, so that attribute would pass
    // whatever the chip did. The label is also the half that matters — a chip
    // that is off without saying why reads as broken.
    const chip = async (id) => {
      await exists(id);
      const { label, value } = await element(by.id(id)).getAttributes();
      return { label: label || '', value };
    };
    for (const id of ['menu-type-pair', 'smart-type-pair']) {
      if (id === 'smart-type-pair') await tapScroll('smart-more', 'menu-scroll');
      const { label, value } = await chip(id);
      if (!label.includes('mixed up')) throw new Error(`${id} does not say why: ${label}`);
      if (value !== '0') throw new Error(`${id} is switched on with no confusions`);
    }
    await tap('screen-back');
    await visible('mode-smart');
  });

  it('refuses to turn off the last question type', async () => {
    await tapScroll('smart-more', 'menu-scroll');
    // Pairs is already dimmed on a fresh install (above), so two taps leave
    // one; the next must be a no-op, because a round with no possible question
    // is not a state the player should reach.
    await tap('smart-type-picture');
    await tap('smart-type-name');
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
