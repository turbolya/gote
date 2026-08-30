// Every game mode end-to-end.
const { by, device, element, expect, waitFor } = require('detox');
const {
  visible,
  exists,
  tap,
  tapScroll,
  typeInto,
  tapCorrectChoice,
  tapCorrectPhoto,
  TIMEOUT,
} = require('./helpers');

// Tap a menu mode card, scrolling the menu if it's below the fold.
const tapMode = (key) => tapScroll(`mode-${key}`, 'menu-scroll');

// Let a screen finish animating in. Synchronization is disabled suite-wide, so
// a view can pass a visibility check while its entrance is still running — and
// a tap aimed at it can then miss.
const settle = (ms = 450) => new Promise((r) => setTimeout(r, ms));

describe('Game modes', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await device.disableSynchronization();
  });

  it('All cards: answer correctly, then Play again, then finish to results', async () => {
    await tapMode('all');
    await visible('study-reveal');

    // Choices appear centered, not under the (bottom) Show-choices button.
    await tap('study-reveal');
    await tapCorrectChoice();
    await waitFor(element(by.id('study-prompt')))
      .toHaveText('Correct!')
      .withTimeout(TIMEOUT);
    await tap('study-next');

    // Replay path from the results screen.
    await tap('study-end');
    await visible('results-menu');
    await tap('results-playagain');
    await visible('study-reveal');
    await tap('study-end');
    await visible('results-menu');
    await tap('results-menu');
    await visible('mode-all');
  });

  it('Flash cards: pick set, reveal, self-grade, reach results', async () => {
    await tapMode('flash');
    await visible('custom-start');
    await tap('custom-start');

    await visible('study-reveal');
    await tap('study-reveal'); // Reveal answer
    await visible('study-grade-knew');
    await tap('study-grade-knew');

    await tap('study-end');
    await visible('results-menu');
    await tap('results-menu');
  });

  // The group picker used to be exercised through Custom game, which Smart play
  // covered and which is gone from the menu. Smart play uses the same screen,
  // so the picker is still tested — through the mode that still exists.
  it('Smart play: toggle a group and start a round', async () => {
    await tapMode('smart');
    await visible('custom-start');
    await tap('custom-group-Aves'); // off
    await tap('custom-group-Aves'); // on again
    await tap('custom-start');
    await visible('study-reveal');
    await tap('study-reveal');
    await tapCorrectChoice();
    await waitFor(element(by.id('study-prompt')))
      .toHaveText('Correct!')
      .withTimeout(TIMEOUT);
    await tap('study-end');
    await visible('results-menu');
  });

  it('Speedrun: answer a round', async () => {
    await tapMode('speedrun');
    await visible('study-reveal');
    await tap('study-reveal');
    await tapCorrectChoice();
    await waitFor(element(by.id('study-prompt')))
      .toHaveText('Correct!')
      .withTimeout(TIMEOUT);
    await tap('study-next');
    await tap('study-end');
    await visible('results-menu');
  });

  it('Pick the right one: match the correct photo', async () => {
    await tapMode('pick');
    await visible('pick-screen');
    await exists('e2e-pick-answer'); // round loaded
    await tapCorrectPhoto();
    await waitFor(element(by.text('Correct!'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('pick-end');
    await visible('results-menu');
  });

  it('Smart play: routes each card to the screen its format belongs on', async () => {
    await tapMode('smart');
    await tap('custom-start');

    // Smart play is the only mode whose next card may belong on a DIFFERENT
    // screen — a photo question renders on the pick screen, a name question on
    // the study screen. That is what this guards: a card routed to the wrong
    // screen, where the round just stops advancing and no assertion about any
    // single screen would notice.
    //
    // Which screen the current card landed on.
    //
    // Identified by each screen's hidden e2e answer marker rather than by its
    // root container: `study-screen` and `pick-screen` sit on full-screen root
    // Views, and toBeVisible demands a 100% visibility threshold, so once the
    // card's own content covers the root the check fails even though the screen
    // is plainly up. The markers also mean "this card is ready to answer", not
    // merely "the screen mounted", so a photo card still loading its grid keeps
    // the poll going instead of being tapped too early.
    //
    // Results is in the list because the suite shares one app install: earlier
    // tests leave tallies behind, so the deck is not always long enough to serve
    // three more cards.
    const whichScreen = async () => {
      for (let t = 0; t < 10; t++) {
        for (const [id, name] of [
          ['e2e-pick-answer', 'pick'],
          ['e2e-answer', 'study'],
          ['results-menu', 'results'],
        ]) {
          try {
            await exists(id, 1200);
            // Synchronization is disabled suite-wide, so a tap can otherwise
            // land on a view that is still animating in.
            await new Promise((r) => setTimeout(r, 400));
            return name;
          } catch (e) { /* try the next candidate */ }
        }
      }
      throw new Error('Smart play card landed on none of pick / study / results');
    };

    let answered = 0;
    let finished = false;
    for (let i = 0; i < 3 && !finished; i++) {
      const where = await whichScreen();
      if (where === 'results') {
        finished = true;
      } else if (where === 'pick') {
        await tapCorrectPhoto();
        await tap('pick-next');
        answered += 1;
      } else {
        await tap('study-reveal');
        await tapCorrectChoice();
        await tap('study-next');
        answered += 1;
      }
    }
    // The point of the test is that cards kept being served and answered across
    // whatever mix of screens came up — not how many the deck happened to hold.
    // (`expect` in this file is Detox's element matcher, so this is a plain check.)
    if (answered === 0) throw new Error('Smart play served no answerable card');

    if (!finished) {
      // End from whichever screen the round is sitting on.
      try {
        await tap('pick-end', 4000);
      } catch (e) {
        await tap('study-end');
      }
    }
    await visible('results-menu');
  });

  it('Nearby species: search a place, then play', async () => {
    await tapMode('nearby');
    await typeInto('nearby-search', 'Test'); // waits for the field itself
    await tap('nearby-result-9001'); // fixture place
    await tap('nearby-start');
    await visible('study-reveal');
    await tap('study-end');
    await visible('results-menu');
  });

  it('More photos: a grid first, then one full-screen with its credit', async () => {
    // The button is about the SET, so it opens on the grid — landing on a
    // single photo would hide the others behind a blind swipe.
    //
    // Wait for the menu to finish animating in first: synchronization is off
    // suite-wide, so a row can pass a visibility check and still fail the tap's
    // own hittability check while the entrance is running. The tests above this
    // one get that time for free by following another test.
    await visible('mode-smart');
    await settle();
    await tapMode('all');
    await visible('study-reveal');
    await tap('study-photos');
    await visible('photo-grid');
    // The viewer fades and scales in (Appear). Detox aims a tap at the cell's
    // UNTRANSFORMED frame, so during that animation a tap on an off-centre cell
    // lands in the gutter and quietly does nothing — the test then sits waiting
    // for a full-screen photo that never opened. Same reason the tour spec
    // settles before touching a freshly-navigated screen.
    await settle();
    // No photo is full-screen yet, so nothing to credit and nowhere to go back
    // to: both belong to the layer above.
    await expect(element(by.id('photo-credit'))).not.toExist();
    await expect(element(by.id('photo-back'))).not.toExist();

    // Cell 1 is a curated photo of the species, credited by the same path the
    // real API takes: src/api.js files each photo's attribution as it parses.
    //
    // toExist + toHaveText rather than toBeVisible: the footer is
    // pointerEvents="none" so it cannot swallow a pinch or a swipe on the photo
    // underneath, and Detox's iOS visibility check is hit-test based, which
    // reads an unhittable view as not visible.
    await tap('photo-cell-1');
    await exists('photo-credit');
    await waitFor(element(by.id('photo-credit')))
      .toHaveText('© Fixture Photographer 1, some rights reserved (CC BY)')
      .withTimeout(TIMEOUT);

    // Back goes up one layer, to the grid — not out of the viewer.
    await tap('photo-back');
    await visible('photo-grid');
    await expect(element(by.id('photo-credit'))).not.toExist();

    // Cell 0 is the card's own observation photo, whose credit comes from the
    // card rather than from the photo parser — a different path to the same
    // footer, and the one a cached deck relies on.
    await tap('photo-cell-0');
    await waitFor(element(by.id('photo-credit')))
      .toHaveText('© e2e tester, some rights reserved (CC BY-NC)')
      .withTimeout(TIMEOUT);
    await tap('photo-back');
    await visible('photo-grid');

    // …and close leaves altogether, back to the card.
    await tap('photo-close');
    await visible('study-reveal');
  });
});
