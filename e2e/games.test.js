// Every game mode end-to-end.
const { by, device, element, expect, waitFor } = require('detox');
const {
  settle,
  visible,
  exists,
  tap,
  scrollToId,
  tapScroll,
  typeInto,
  tapCorrectChoice,
  tapCorrectPhoto,
  labelOf,
  TIMEOUT,
} = require('./helpers');

// Tap a menu mode card, scrolling the menu if it's below the fold.
const tapMode = (key) => tapScroll(`mode-${key}`, 'menu-scroll');

// The look-alike in the fixtures that is NOT one of the player's own species.
const STRANGER = 9001;

// The name round — photo → pick from five names — which used to be the "By
// name" menu entry and is now the Smart play card narrowed to one question
// type. Walked in full rather than shortcut to another mode that happens to ask
// the same question, because this path IS the replacement and is the thing that
// would quietly stop working.
//
// From a clean install on purpose: the card reopens on the last setup it was
// STARTED with, so "turn three icons off" only means something from a known
// state.
async function startNameRound() {
  await device.launchApp({ newInstance: true, delete: true });
  await device.disableSynchronization();
  await visible('mode-smart');
  await tap('menu-type-picture');
  await tap('menu-type-pair');
  await tap('menu-type-typed');
  await tap('smart-start');
}

// The photo round — a name at the top, four photos below — which used to be the
// "By picture" menu entry. Same shape as startNameRound, and clean-installed for
// the same reason.
async function startPhotoRound() {
  await device.launchApp({ newInstance: true, delete: true });
  await device.disableSynchronization();
  await visible('mode-smart');
  await tap('menu-type-name');
  await tap('menu-type-pair');
  await tap('menu-type-typed');
  await tap('smart-start');
}

describe('Game modes', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await device.disableSynchronization();
  });

  it('Name questions: answer correctly, then Play again, then finish to results', async () => {
    await startNameRound();
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
    await visible('mode-smart');
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
  it('Smart play options: toggle a group and start a round', async () => {
    // The group picker lives behind the card's ⋯ now — the card itself carries
    // only the question types, the count and Start.
    await tap('smart-more');
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

  it('Photo questions: match the correct photo', async () => {
    await startPhotoRound();
    await visible('pick-screen');
    await exists('e2e-pick-answer'); // round loaded
    await tapCorrectPhoto();
    await waitFor(element(by.text('Correct!'))).toBeVisible().withTimeout(TIMEOUT);
    await tap('pick-end');
    await visible('results-menu');
  });

  // Scroll to something if the page scrolls at all. The compare page is short
  // enough to fit on a large phone, and Detox throws "not scrollable" rather
  // than shrugging when there is nothing to scroll.
  // The fullscreen viewer is a modal that fades and springs; a close tap that
  // lands during either animation is swallowed and the modal simply stays. A
  // finger taps again, so this does too.
  const closeViewer = async () => {
    for (let i = 0; i < 4; i++) {
      await settle();
      try {
        await element(by.id('photo-close')).tap();
      } catch (e) { /* gone already */ }
      try {
        await waitFor(element(by.id('photo-close'))).not.toBeVisible().withTimeout(2500);
        await settle();
        return;
      } catch (e) { /* still up */ }
    }
    throw new Error('the photo viewer would not close');
  };

  const reveal = async (id, container) => {
    try {
      await scrollToId(id, container);
    } catch (e) {
      // Nothing to scroll. Settle rather than assert visibility straight away:
      // arriving here usually means a viewer has just closed, and its leaving
      // spring holds an alpha-0 view over the page for a moment — which Detox
      // reads as "not visible" for whatever is underneath.
      await exists(id);
      await settle(700);
    }
  };

  it('a look-alike you keep picking reaches "Species you mix up", and its photos open', async () => {
    // The regression this guards: a confusion is stored as two taxon ids, and
    // the wrong tiles on a photo grid are iNaturalist look-alikes rather than
    // the player's own species (see e2eSimilar). Nothing local could name the
    // one they picked, so the pair was counted, ranked, and then dropped — the
    // card never appeared however many rounds were played.
    //
    // Three full photo rounds over the eight-card fixture deck, always picking
    // the same stranger. Rounds are the whole deck, so every species is shown
    // exactly once per round and every pair lands on three — the floor at which
    // a mix-up counts as systematic (CONFUSION_HINT_MIN).
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();

    for (let round = 0; round < 3; round++) {
      await visible('mode-smart');
      await settle();
      if (round === 0) {
        // Photo questions only. Remembered afterwards, so later rounds just
        // press Start — tapping the chips again would turn them back on.
        await tap('menu-type-name');
        await tap('menu-type-pair');
        await tap('menu-type-typed');
      }
      await tap('smart-start');
      for (let card = 0; card < 8; card++) {
        await visible('pick-screen');
        await exists('e2e-pick-answer');
        await tap(`pick-tile-${STRANGER}`);
        await settle(300);
        if (card < 7) await tap('pick-next');
      }
      await tap('pick-end');
      await visible('results-menu');
      await tap('results-menu');
    }

    await visible('mode-smart');
    await tap('menu-stats');
    // The card sits below the charts, so scroll to it rather than asserting on
    // whatever the first screenful happens to hold. (The heading itself is no
    // good as a matcher: it is styled uppercase and textTransform happens
    // natively, so Detox reads "SPECIES YOU MIX UP".)
    await scrollToId('stats-confusion-0', 'stats-scroll');
    await visible('stats-confusion-0');
    // …and the row NAMES the stranger. This is the assertion that fails without
    // the directory: the pair is counted either way, but an unnameable species
    // means the row — and with it the whole card — is dropped.
    await waitFor(element(by.text('Stranger Robin')).atIndex(0))
      .toBeVisible()
      .withTimeout(TIMEOUT);

    // Continued here rather than in a test of its own: getting a confused pair
    // on screen costs three full rounds, and "Tell them apart" is only
    // reachable through one.
    await tap('stats-confusion-0');
    await waitFor(element(by.text('Tell them apart'))).toBeVisible().withTimeout(TIMEOUT);
    await settle();

    // Either species' photo opens that species' curated set — the same grid the
    // more-photos button opens during a round. Telling two look-alikes apart
    // from one thumbnail each is the hard way round.
    await tap('compare-photo-a');
    await visible('photo-grid');
    await settle();
    // …and a cell goes full-screen, credited, like everywhere else photos open.
    await tap('photo-cell-1');
    await exists('photo-credit');
    await tap('photo-back');
    await visible('photo-grid');
    await tap('photo-close');
    // Back on the compare page, not dumped somewhere else.
    await waitFor(element(by.text('Tell them apart'))).toBeVisible().withTimeout(TIMEOUT);
    // Settle before touching it again: the viewer leaves on an opacity spring,
    // and an alpha-0 view still covers the screen while that runs — the tap
    // below lands on it and Detox reports the photo as not hittable. Same
    // reason the tour spec settles after its confirmation alert.
    await settle();

    // The species that is NOT one of the player's own opens its set too — it is
    // only a taxon id here, so its photos have to come from the network.
    await tap('compare-photo-b');
    await visible('photo-grid');
    // Wait for the viewer to actually LEAVE before touching the page under it:
    // `exists` on that page is true the whole time the modal covers it, and a
    // tap meant for the page would hit the modal.
    await closeViewer();

    // TC-5.9 — "Your tell": the note is the point of the compare page, and it
    // is worth nothing if it does not come back. Written, left, reopened.
    await reveal('compare-note', 'compare-scroll');
    await typeInto('compare-note', 'toothed leaves, not smooth');
    // The note commits onBlur, so something has to take focus away first. The
    // TITLE, not the page: a tap into the page lands on a species photo and
    // opens the viewer over everything, which is how this read as "the back
    // button vanished".
    await element(by.text('Tell them apart')).tap();
    await settle(600);
    // Its own id: the compare page is an overlay OVER Statistics, so a plain
    // 'screen-back' matches two buttons and Detox can tap neither.
    await tap('compare-back');
    await visible('stats-scroll');
    // The row now advertises that there is a note to come back to.
    await scrollToId('stats-confusion-0', 'stats-scroll');
    await waitFor(element(by.text('Your tell ✓'))).toBeVisible().withTimeout(TIMEOUT);
    await settle();
    await tap('stats-confusion-0');
    await exists('compare-scroll');
    await settle();
    await reveal('compare-note', 'compare-scroll');
    await waitFor(element(by.id('compare-note')))
      .toHaveText('toothed leaves, not smooth')
      .withTimeout(TIMEOUT);

    // TC-5.12 — the A/B drill, which only this pair can reach: two species, one
    // photo, answer until it ends, and back to the pair rather than adrift.
    await reveal('compare-drill', 'compare-scroll');
    await tap('compare-drill');
    // The drill fetches both species' photos first and renders a "Setting up
    // the drill…" screen meanwhile, so wait for the question rather than for
    // the playing screen's own id.
    await exists('e2e-duel-answer', TIMEOUT);
    // EXISTS, not visible: duel-screen is the full-screen root, and Detox reads
    // a root as not visible once its own content covers it — the same note the
    // routing case makes about study-screen and pick-screen.
    await exists('duel-screen');
    await settle();
    for (let i = 0; i < 12; i++) {
      try {
        await exists('duel-done-title', 1200);
        break;
      } catch (e) { /* still answering */ }
      const answer = await labelOf('e2e-duel-answer');
      await tap(`duel-choice-${answer}`);
      await settle(400);
      try {
        await tap('duel-continue', 2000);
      } catch (e) { /* the last card ends the drill instead */ }
    }
    await exists('duel-done-title');
    await tap('duel-close');
    // Back into the app rather than a dead end — the compare page it was
    // opened from, or the Statistics list behind that. Which of the two is a
    // navigation choice, not the thing this case is about.
    let landed = false;
    for (const id of ['compare-scroll', 'stats-scroll']) {
      try {
        await exists(id, 4000);
        landed = true;
        break;
      } catch (e) { /* try the other */ }
    }
    if (!landed) throw new Error('closing the drill landed on neither the pair nor Statistics');
  });

  it('Smart play: routes each card to the screen its format belongs on', async () => {
    // Clean install: this is the one test that needs EVERY question type on,
    // and the picker now reopens on whatever was last started — which an
    // earlier test in this file deliberately narrowed to name questions.
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
    await visible('mode-smart');
    await tap('smart-start'); // every type on, straight off the card

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
    // Speedrun rather than the name round above: this test only needs a study
    // card with photos, and Speedrun is one tap and touches no saved setup.
    await tapMode('speedrun');
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

  it('TC-3.5 zooming holds the page, and paging returns when it is let go', async () => {
    // The two gestures share the photo: while it is zoomed a drag must pan the
    // image, and only once it is back at 1x may a sideways swipe page. Told
    // apart by the credit, which names the photo on screen — a pan that paged
    // by mistake would change it.
    await visible('mode-smart');
    await settle();
    await tapMode('speedrun');
    await visible('study-reveal');
    await settle();
    await element(by.id('study-photo')).multiTap(2);
    await exists('photo-pager');
    await settle();
    const creditNow = async () => {
      const { text, label } = await element(by.id('photo-credit')).getAttributes();
      return text || label || '';
    };
    const first = await creditNow();

    // Pinch open, then drag: the photo moves under the finger, the pager does
    // not. Detox's pinch is on the pager itself, which is what holds the pages.
    await element(by.id('photo-pager')).pinch(2.5, 'slow');
    await settle();
    await element(by.id('photo-pager')).swipe('left', 'fast', 0.6);
    await settle();
    if ((await creditNow()) !== first) throw new Error('a drag while zoomed paged to another photo');

    // Double-tap is the way back out of zoom, and then the same swipe pages.
    await element(by.id('photo-pager')).multiTap(2);
    await settle(800);
    await element(by.id('photo-pager')).swipe('left', 'fast', 0.75);
    await settle();
    if ((await creditNow()) === first) throw new Error('unzoomed, the swipe did not page');
    await tap('photo-close');
    await visible('study-reveal');
  });

  it('Double-tap: this photo full-screen, a swipe to the others, back to the grid', async () => {
    await visible('mode-smart');
    await settle();
    await tapMode('speedrun');
    await visible('study-reveal');
    await settle();

    // Straight to THIS photo — the card's own, whose credit is the tester's —
    // not to the grid the ⊞ button opens on.
    await element(by.id('study-photo')).multiTap(2);
    await exists('photo-pager');
    await waitFor(element(by.id('photo-credit')))
      .toHaveText('© e2e tester, some rights reserved (CC BY-NC)')
      .withTimeout(TIMEOUT);
    await expect(element(by.id('photo-grid'))).not.toExist();
    // The grid is behind it, so there is somewhere to go back to.
    await visible('photo-back');

    // Not zoomed, so a sideways swipe pages to the species' next photo — one
    // the viewer did not have when it opened, fetched while it was up. Settle
    // first: the viewer is still fading and scaling in (Appear).
    await settle();
    await element(by.id('photo-pager')).swipe('left', 'fast', 0.75);
    await waitFor(element(by.id('photo-credit')))
      .toHaveText('© Fixture Photographer 1, some rights reserved (CC BY)')
      .withTimeout(TIMEOUT);

    // Leaving the photo lands on every photo of the species, not on the card.
    await tap('photo-back');
    await visible('photo-grid');
    await exists('photo-cell-3'); // own photo + the three fetched
    await tap('photo-close');
    await visible('study-reveal');
  });
});
