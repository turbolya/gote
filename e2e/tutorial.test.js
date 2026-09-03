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
const { visible, exists, tap, tapScroll, TIMEOUT } = require('./helpers');

// Let a freshly-navigated screen finish animating in.
//
// Synchronization is disabled suite-wide, so a screen can pass a visibility
// check while its entrance animation is still running — and Detox will not
// scroll a list that is not 100% visible, which is what an in-flight entrance
// looks like. Same reason helpers.typeInto waits before replaceText.
async function settle(ms = 450) {
  await new Promise((r) => setTimeout(r, ms));
}

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
async function atStep(n, total = 12) {
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
    await visible('settings-username');
    await atStep(3);
  });

  it('waits, visibly, when the step is on a screen the user is not on', async () => {
    // Getting into the waiting state takes a moment to set up. Detox cannot tap
    // anything under the dim (a geometric visibility check, which pointerEvents:
    // none does not fool), so the only ways off a step's screen here are the
    // spotlit control itself and a relaunch — which reopens on the menu.
    //
    // Steps 1-5 all live on the menu now, so the first step that can be waited
    // FOR is 6 — "other pictures", which lives on a card in play. Walk to it,
    // then relaunch: the app reopens on the menu, which is exactly the
    // situation a user creates by wandering off mid-round.
    //
    // Seeded to a name round so step 5's Start lands on `study`, where step 6
    // lives; a photo round would land on `pick` and never reach it.
    await seedRound('picture');

    await startTutorial();
    await tap('tutorial-next'); // → 2, open Settings
    await tapSpotlight('open-settings'); // the tour scrolls it into view
    await atStep(3); // the username step, on Settings

    await device.launchApp({ newInstance: true }); // reopens on the menu…
    await device.disableSynchronization();
    await atStep(4); // …which is what step 3 was waiting for

    await tap('tutorial-next'); // → 5, "tap Start" on the card
    await atStep(5);
    await tapSpotlight('smart-start');
    await visible('study-reveal');
    await atStep(6); // "other pictures", which lives on a card in play

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
    await element(by.text('Keep going')).tap();
    await visible('tutorial-waiting');

    // Going back to where it was waiting brings the step back. (Settle first:
    // the alert's own dismissal animation still counts as covering the screen.)
    await settle();
    await tap('smart-start');
    await visible('study-reveal');
    await visible('tutorial-bubble');
    await atStep(6);
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
    await atStep(3);

    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    await atStep(4); // arriving on the menu satisfied step 3
    await tap('tutorial-next'); // → 5, "tap Start" on the card
    await atStep(5);

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
});
