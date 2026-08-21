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
const { visible, tap, tapScroll, TIMEOUT } = require('./helpers');

// Let a freshly-navigated screen finish animating in.
//
// Synchronization is disabled suite-wide, so a screen can pass a visibility
// check while its entrance animation is still running — and Detox will not
// scroll a list that is not 100% visible, which is what an in-flight entrance
// looks like. Same reason helpers.typeInto waits before replaceText.
async function settle(ms = 450) {
  await new Promise((r) => setTimeout(r, ms));
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

// The progress line is styled uppercase, and textTransform happens natively —
// so this is the string Detox reads back, not the one in tutorialtext.js.
async function atStep(n, total = 12) {
  await waitFor(element(by.id('tutorial-progress')))
    .toHaveText(`${n} OF ${total}`)
    .withTimeout(TIMEOUT);
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
    await element(by.id('open-settings')).tap();
    await visible('settings-username');
    await atStep(3);
  });

  it('waits, visibly, when the step is on a screen the user is not on', async () => {
    // Getting into the waiting state takes a moment to set up. Detox cannot tap
    // anything under the dim (a geometric visibility check, which pointerEvents:
    // none does not fool), so the only ways off a step's screen here are the
    // spotlit control itself and a relaunch — which reopens on the menu.
    //
    // So: walk to the step that waits for the Smart play screen, then relaunch.
    // That is exactly the situation a user creates by wandering off.
    await startTutorial();
    await tap('tutorial-next'); // → 2, open Settings
    await visible('open-settings'); // the tour scrolls it into view
    await element(by.id('open-settings')).tap();
    await atStep(3); // the username step, on Settings

    await device.launchApp({ newInstance: true }); // reopens on the menu…
    await device.disableSynchronization();
    await atStep(4); // …which is what step 3 was waiting for

    await visible('mode-smart');
    await element(by.id('mode-smart')).tap();
    await atStep(5); // "tap Start", on the Smart play screen

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
    await element(by.id('mode-smart')).tap();
    await visible('tutorial-bubble');
    await atStep(5);
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
