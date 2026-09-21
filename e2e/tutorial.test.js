// The guided tour.
//
// Auto-start is off under the e2e fixtures on purpose (an overlay on the menu
// would break every other spec), so each case starts the tour the way a
// returning user would: Settings → "Take the tutorial".
//
// scripts/test-tutorial.js already walks the whole sequence and checks the
// geometry in plain node. What is left for a real device is only what a real
// device can answer: that the bubble renders over the app, that the tour brings
// an off-screen target into view before pointing at it, that controls under the
// dimmed backdrop are still tappable, and that exiting behaves.
//
// Note there is no scrolling in this spec once a bubble is up: Detox refuses to
// scroll a list it does not consider fully visible, and the dim layer covers it.
// That is a constraint on the test, not on the user — the tour scrolls its own
// target into view, which is what makes tapping it directly work here.
const { by, device, element, expect, waitFor } = require('detox');
const {
  settle,
  visible,
  exists,
  tap,
  tapScroll,
  typeInto,
  tapCorrectChoice,
  TIMEOUT,
} = require('./helpers');


// Tap a control the tour is pointing at, through the dimmed backdrop.
//
// The settle is the point of the helper. Detox's toBeVisible passes at 75%, and
// the tour scrolls its target into view on the step's first measurement — so a
// row that is already three-quarters on screen satisfies `visible` while the
// tour is still moving it. Detox then aims the tap at where the row WAS, the
// row travels out from under it, and the touch lands on the sealed band beside
// the spotlight instead. Nothing is wrong with the overlay when this happens:
// let it come to rest and the same tap works, which is all a real finger does.
async function tapSpotlight(id) {
  await visible(id);
  await settle();
  await element(by.id(id)).tap();
}

// Settings → Take the tutorial. Lands back on the menu with step 1 up.
async function startTutorial() {
  await visible('mode-smart');
  await settle();
  await tapScroll('open-settings', 'menu-scroll');
  await visible('settings-username');
  await settle();
  await tapScroll('settings-tutorial', 'settings-scroll');
  await visible('tutorial-bubble');
}

// Pin what the tour's own Start button will ask, by playing that round first
// and walking straight back out. Nothing about the seeded round matters; the
// point is the setup it persists, which the menu card reopens on
// (src/roundsetup.js — remembered on Start, which is why this has to start one
// rather than just tick the icons).
//
// Needed because the tour taps Start at step 5 and the format is otherwise a
// weighted draw, so which SCREEN the round lands on would be a coin toss.
//
// Runs before the tour, on the fresh install each case already gets, so the
// icons are in their default all-on state and turning some off is exact.
async function seedRound(...typesToTurnOff) {
  await visible('mode-smart');
  await settle();
  for (const key of typesToTurnOff) await tap(`menu-type-${key}`);
  await tap('smart-start');
  // A photo round lands on `pick`, anything else on `study`.
  const screen = typesToTurnOff.includes('picture') ? 'study-reveal' : 'pick-screen';
  await visible(screen);
  await tap(typesToTurnOff.includes('picture') ? 'study-end' : 'pick-end');
  await visible('results-menu');
  await tap('results-menu');
  await visible('mode-smart');
  await settle();
}

// The progress line is styled uppercase, and textTransform happens natively —
// so this is the string Detox reads back, not the one in tutorialtext.js.
//
// The visibility check is not decoration. toHaveText matches a view that is
// mounted but fully transparent — which is the shape of the failure this spec
// most needs to catch: the step advances, its text is in the hierarchy, and the
// overlay never fades in. Detox treats an alpha-0 view as not visible, so this
// is what tells "the tour moved on" from "the tour is there but nobody can see
// it".
async function atStep(n, total = 13) {
  await waitFor(element(by.id('tutorial-progress')))
    .toHaveText(`${n} OF ${total}`)
    .withTimeout(TIMEOUT);
  await visible('tutorial-bubble');
}

describe('Guided tour', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    // The iOS 26 simulator never reports "idle" to Detox, so auto-sync would
    // hang forever; the suite polls with waitFor instead.
    await device.disableSynchronization();
  });

  // A fresh install per case, not just a reload: the tour's progress is
  // persisted on purpose, so a reload would carry one test's position into the
  // next (and leave a bubble covering the menu the next case starts from).
  beforeEach(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
  });

  it('does not start by itself under the fixtures', async () => {
    // If this ever fails, every other spec in the suite is about to fail too.
    await visible('mode-smart');
    await expect(element(by.id('tutorial-bubble'))).not.toExist();
  });

  it('starts from Settings and opens on the menu', async () => {
    await startTutorial();
    // Restarting returns to the menu, because the first step lives there.
    await visible('menu-stats');
    await atStep(1);
    await visible('tutorial-title');
    await visible('tutorial-body');
  });

  it('advances when the user taps Next', async () => {
    await startTutorial();
    await tap('tutorial-next');
    await atStep(2);
    // Step 2 asks the user to open Settings, so it has no Next button — doing
    // the thing is what advances it.
    await expect(element(by.id('tutorial-next'))).not.toExist();
  });

  it('scrolls its target into view, and it can be tapped through the backdrop', async () => {
    // Two things at once, because they are the same moment: "Open Settings"
    // points at a row that starts below the fold, and the spotlight is a hole
    // rather than a picture of one. No scrolling here — the tour does it.
    await startTutorial();
    await tap('tutorial-next'); // → "open Settings"
    await atStep(2);
    await visible('open-settings');
    // Once there is a target to seal around, the step is modal: the bands are
    // up. Asserted AFTER the target resolves, not on arrival — this step has no
    // Next button, so until its anchor has been measured there is deliberately
    // nothing sealed. Sealing a step with no target and no button would leave
    // Exit as the only way out.
    await expect(element(by.id('tutorial-block')).atIndex(0)).toExist();
    // …and the spotlight is still a hole, not a picture of one.
    await tapSpotlight('open-settings');
    await atStep(3);
    // Step 3 asks for a name language, and that section sits well down the
    // Settings screen — so the same scroll-into-view the menu just did has to
    // happen again here, on a DIFFERENT scroller (SettingsScreen's, not the
    // menu's), which is the part worth a real device.
    //
    // Asserted on the picker rather than on the spotlit section around it: the
    // spotlight is a rounded hole, so the section's square corners are always
    // under the dim and it can never be 100% visible, which is the threshold
    // Detox applies. The picker sits well inside the hole.
    await visible('language-field');
  });

  it('waits, visibly, when the step is on a screen the user is not on', async () => {
    // Getting into the waiting state takes a moment to set up. Detox cannot tap
    // anything under the dim (a geometric visibility check, which pointerEvents:
    // none does not fool), so the only ways off a step's screen here are the
    // spotlit control itself and a relaunch — which reopens on the menu.
    //
    // Steps 3 and 4 live on Settings, and 5-6 back on the menu, so the first
    // step that can be waited FOR from the menu is 7 — "other pictures", which
    // lives on a card in play. Walk to it, then relaunch: the app reopens on
    // the menu, which is exactly the situation a user creates by wandering off
    // mid-round.
    //
    // Seeded to a name round so step 6's Start lands on `study`, where step 7
    // lives; a photo round would land on `pick` and never reach it.
    await seedRound('picture');

    await startTutorial();
    await tap('tutorial-next'); // → 2, open Settings
    await tapSpotlight('open-settings'); // the tour scrolls it into view
    await atStep(3); // the name-language step, on Settings
    await tap('tutorial-next'); // → 4, the username step, also on Settings
    await atStep(4);

    await device.launchApp({ newInstance: true }); // reopens on the menu…
    await device.disableSynchronization();
    await atStep(5); // …which is what step 4 was waiting for

    await tap('tutorial-next'); // → 6, "tap Start" on the card
    await atStep(6);
    await tapSpotlight('smart-start');
    await visible('study-reveal');
    await atStep(7); // "other pictures", which lives on a card in play

    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await visible('mode-smart');

    // Not lost, and not silent: a bar says how to get back to it…
    await visible('tutorial-waiting');
    await expect(element(by.id('tutorial-bubble'))).not.toExist();
    // …and crucially the screen is NOT sealed here. Waiting means the user has
    // gone somewhere the tour is not; blocking them there would be the trap the
    // modal step is careful to avoid.
    await expect(element(by.id('tutorial-block')).atIndex(0)).not.toExist();
    // …and the tour can still be left from there, which is the whole reason the
    // bar exists rather than the tour simply vanishing.
    await tap('tutorial-exit');
    await waitFor(element(by.text('Exit the tutorial?'))).toBeVisible().withTimeout(TIMEOUT);

    // Dismiss it, and make sure it is GONE before touching the app again. Two
    // separate flakes live here, both about the alert being native — it is
    // presented in its own UITransitionView, over everything:
    //
    //   • a tap that lands while it is still animating IN is swallowed, so the
    //     alert simply stays up. Tapping again is what a real finger does, and
    //     is the only thing that helps: no amount of waiting dismisses it.
    //   • while it is up (or still tearing down), every tap anywhere hits it
    //     rather than the app — the "not hittable… Hit: UITransitionView"
    //     failure this case used to end with at smart-start below.
    let dismissed = false;
    for (let i = 0; i < 5 && !dismissed; i++) {
      await settle();
      try {
        await element(by.text('Keep going')).tap();
      } catch (e) { /* already gone: the check below decides */ }
      try {
        await waitFor(element(by.text('Exit the tutorial?')))
          .not.toBeVisible()
          .withTimeout(2000);
        dismissed = true;
      } catch (e) { /* still up — tap it again */ }
    }
    if (!dismissed) throw new Error('the exit alert would not dismiss');
    await visible('tutorial-waiting');

    // Going back to where it was waiting brings the step back.
    await settle();
    await tap('smart-start');
    await visible('study-reveal');
    await visible('tutorial-bubble');
    await atStep(7);
  });

  // Both of the reports this spec grew from: screens where the tour drew
  // nothing at all, and screens where it blocked without saying why.

  it('stays visible on Results, where a round ends', async () => {
    // Results used to be a QUIET_SCREEN, so the tour vanished on the one screen
    // where the user stops and decides what to do next — indistinguishable from
    // the tour having died.
    //
    // The round this plays is a PHOTO round, and that is load-bearing. Step 5
    // spotlights Start on the menu card and advances when the study screen
    // appears; a photo question lands on `pick` instead, which no step waits
    // for. So the tour neither advances nor seals, and we get what the test
    // needs: a real round in play with the tour merely waiting.
    //
    // Which format comes up is otherwise a weighted draw, so it is pinned the
    // way a player would pin it — the card reopens on the last setup that was
    // STARTED, so we start a photo-only round first and the tour's own Start
    // button inherits it.
    await seedRound('name', 'pair', 'typed');

    await startTutorial();
    await tap('tutorial-next'); // → 2, open Settings
    await tapSpotlight('open-settings');
    await atStep(3); // the name-language step
    await tap('tutorial-next'); // → 4, the username step
    await atStep(4);

    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await atStep(5); // arriving on the menu satisfied step 4
    await tap('tutorial-next'); // → 6, "tap Start" on the card
    await atStep(6);

    // Tapped through the dimmed backdrop, like every other spotlit control.
    await tapSpotlight('smart-start');
    await visible('pick-screen');
    await exists('e2e-pick-answer'); // the round actually built

    // A round in play, so the tour is deliberately silent — and crucially not
    // sealed: it has not advanced, it is simply somewhere it is not needed.
    await expect(element(by.id('tutorial-waiting'))).not.toExist();
    await expect(element(by.id('tutorial-bubble'))).not.toExist();
    await expect(element(by.id('tutorial-block')).atIndex(0)).not.toExist();

    await tap('pick-end');
    await visible('results-menu');

    // …and Results is where it must come back. This is the regression: Results
    // used to be quiet too, so the tour vanished exactly where the user stops
    // and decides what to do next.
    await visible('tutorial-waiting');
    await expect(element(by.id('tutorial-block')).atIndex(0)).not.toExist();
  });

  it('never blocks the screen without showing instructions', async () => {
    // The seal is gated on the bubble having laid out, because blocking with
    // nothing drawn reads as the app having frozen. Checked on both kinds of
    // step: one with a button, and one whose only way on is the real control.
    await startTutorial();

    // Step 1 — a Next button, no spotlight: sealed whole, bubble must be up.
    await visible('tutorial-bubble');
    await expect(element(by.id('tutorial-block')).atIndex(0)).toExist();
    await expect(element(by.id('tutorial-next'))).toExist();

    await tap('tutorial-next');
    await atStep(2);

    // Step 2 — an action step: spotlight up, bubble up, seal up together.
    await visible('open-settings');
    await visible('tutorial-bubble');
    await expect(element(by.id('tutorial-block')).atIndex(0)).toExist();
    await visible('tutorial-title');
    await visible('tutorial-body');
  });

  it('confirms before exiting, and can be dismissed', async () => {
    await startTutorial();
    await tap('tutorial-exit');
    await waitFor(element(by.text('Exit the tutorial?'))).toBeVisible().withTimeout(TIMEOUT);
    // The confirmation has to say where the tour can be found again.
    await expect(element(by.text('You can start it again any time from Settings.'))).toBeVisible();
    await element(by.text('Keep going')).tap();
    await visible('tutorial-bubble');
    await atStep(1);
  });

  it('exits for good, and can be restarted from Settings', async () => {
    await startTutorial();
    await tap('tutorial-exit');
    await waitFor(element(by.text('Exit the tutorial?'))).toBeVisible().withTimeout(TIMEOUT);
    await element(by.text('Exit')).tap();
    await waitFor(element(by.id('tutorial-bubble'))).not.toExist().withTimeout(TIMEOUT);
    // Gone for good — not just until the next launch.
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await visible('mode-smart');
    await expect(element(by.id('tutorial-bubble'))).not.toExist();
    // …unless asked for again.
    await startTutorial();
    await atStep(1);
  });

  it('resumes where it left off after a relaunch', async () => {
    await startTutorial();
    await tap('tutorial-next');
    await atStep(2);
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await visible('tutorial-bubble');
    await atStep(2);
  });

  it('walks all thirteen steps to the end', async () => {
    // One long walk, because that is the only way to reach the later steps:
    // each waits for the screen the one before it navigates to. Covers the
    // steps the other cases in this file never reach — TC-9.4, 9.7, 9.8, 9.9,
    // 9.10, 9.11, 9.12, 9.14 and 9.15.
    //
    // Every hand-off goes through tapUntil: a tap that lands while the tour is
    // fading a bubble in, sliding a spotlight or presenting a screen is
    // swallowed, and one swallowed tap here fails the whole walk. A real
    // finger taps again.
    const tapUntil = async (id, check, attempts = 4) => {
      for (let i = 0; i < attempts; i++) {
        await settle();
        try {
          await element(by.id(id)).tap();
        } catch (e) { /* the check below decides */ }
        try {
          await check();
          return;
        } catch (e) { /* not through yet */ }
      }
      throw new Error(`tapping ${id} never took effect`);
    };
    // Under the tour, anything outside the spotlight is behind a dim, which
    // Detox counts as obscuring — so arrivals are checked by EXISTENCE.
    const there = (id) => async () => exists(id, 3000);

    await seedRound('picture'); // a name round, so step 6's Start lands on `study`
    await startTutorial();
    await atStep(1);

    await tapUntil('tutorial-next', async () => atStep(2));

    // TC-9.2: the spotlit row is tappable through the dim, and that IS the step.
    await tapUntil('open-settings', there('settings-scroll'));
    await atStep(3);
    // TC-9.15: the name language comes BEFORE the username — it decides what
    // the deck the username loads is labelled in.
    await exists('settings-language');

    // A button, not an arrival: most people keep the default language, and a
    // step that cannot be passed without changing a setting would make them.
    await tapUntil('tutorial-next', async () => atStep(4));

    // TC-9.4: the username field AND Save stay usable under the dim. Typing
    // proves the field; Save is checked for reach rather than pressed twice.
    await typeInto('settings-username', 'e2e-tester');
    await settle();
    const save = await element(by.id('settings-load')).getAttributes();
    if (save.hittable === false) throw new Error('Save is sealed off at step 4');

    // Save lands back on the menu, which is what advances the step. It has to
    // be Save: the header's back button is outside the spotlight, sealed off.
    await tapUntil('settings-load', there('mode-smart'), 2);
    await atStep(5);

    await tapUntil('tutorial-next', async () => atStep(6));

    // TC-9.7: step 6 leads into a real round.
    await tapUntil('smart-start', there('study-reveal'));
    await atStep(7);
    // TC-9.8: and step 7 points at the more-photos button, mid-round.
    await exists('study-photos');

    // TC-9.9: the tour stays out of the way — the card is still answerable.
    await tapUntil('tutorial-next', there('study-reveal'));
    await tap('study-reveal');
    await tapCorrectChoice();
    await settle();

    // Step 8 waits for the menu, so finish the round to get there.
    await tapUntil('study-end', there('results-menu'));
    await tapUntil('results-menu', there('mode-smart'));
    await atStep(8);

    // TC-9.10: step 8 opens Statistics from the accuracy banner.
    await tapUntil('menu-stats', there('stats-scroll'));
    await atStep(9);

    // Step 10 is on the menu, so the tour waits (the unsealed bar) until we
    // walk back ourselves — which is the point of that state.
    await tapUntil('tutorial-next', there('tutorial-waiting'));
    await tapUntil('screen-back', there('mode-smart'));
    await atStep(10);

    // TC-9.11 / TC-9.14: opening Nearby counts as doing the step, and nothing
    // demands the location permission on the way.
    await tapUntil('mode-nearby', there('nearby-search'));
    await tapUntil('screen-back', there('mode-smart'));
    await atStep(11);

    await tapUntil('open-settings', there('settings-scroll'));
    await atStep(12);

    // Step 12 points at the Sync row — which this build does not have: that
    // row appears only when the build carries Supabase credentials
    // (SYNC_ENABLED), and the Detox build is compiled without them. The step
    // is written for exactly that case (`cta: true`), so its own button
    // advances it, and it must: a step whose target does not exist would
    // otherwise be a dead end. TC-9.13 — tapping the spotlit row itself —
    // therefore stays manual.
    await expect(element(by.id('settings-sync'))).not.toExist();
    await tapUntil('tutorial-next', async () => atStep(13));

    // TC-9.12: the last step ends the tour rather than looping.
    await tapUntil('tutorial-next', async () => {
      await waitFor(element(by.id('tutorial-bubble'))).not.toExist().withTimeout(3000);
    });
    // …and it stays gone on the next launch.
    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await visible('mode-smart');
    await expect(element(by.id('tutorial-bubble'))).not.toExist();
  });
});
