// Drives the real app (live network, account = mate_koch) through the key
// screens and saves a screenshot of each. Best-effort: every capture is wrapped
// so one failing screen doesn't abort the rest.
//
// Run via screenshots-local/capture-screenshots.sh (sets the env below and
// flattens the output into the timestamped gote-launch folder).

const { device, element, by, waitFor } = require('detox');

// Slow-net knob: scales every content-load delay below. Bump it on a slow
// connection, e.g. SHOTS_SETTLE=2 (or 3) ./capture-screenshots.sh
const SETTLE = Math.max(1, Number(process.env.SHOTS_SETTLE) || 1);
const T = 180000 * SETTLE; // waitFor timeout (real downloads + image loads)

// Tell Detox to ignore network when deciding if the app is "idle" — the live app
// is always loading something (downloads, images, background sync), which would
// otherwise keep Detox waiting forever. The app still fetches; we gate content
// with explicit hold() delays before each screenshot.
const detach = async () => {
  try {
    await device.setURLBlacklist(['.*']);
  } catch {
    /* older Detox: ignore */
  }
  await device.disableSynchronization();
};
const USER = process.env.SHOTS_USER || 'mate_koch';
const TAXON_ID = process.env.SHOTS_TAXON_ID || '';
const TAXON_NAME = process.env.SHOTS_TAXON_NAME || '';
// Nearby‑species location (Kaposvár, Hungary by default). iNaturalist's place DB
// has no "Kaposvár" entry, so we set the simulator's GPS to these coordinates
// and use the in‑app "Use my location" button instead of place search.
const LAT = process.env.SHOTS_LAT || '46.3594';
const LNG = process.env.SHOTS_LNG || '17.7968';
const { execSync } = require('child_process');

const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Content-load wait, scaled by SETTLE so slow networks get proportionally longer.
const hold = (ms) => pause(Math.round(ms * SETTLE));
const visible = (id) => waitFor(element(by.id(id))).toBeVisible().withTimeout(T);
const tap = async (id) => {
  await visible(id);
  await element(by.id(id)).tap();
};
const present = async (id, timeout = 6000) => {
  try {
    await waitFor(element(by.id(id))).toBeVisible().withTimeout(timeout * SETTLE);
    return true;
  } catch {
    return false;
  }
};
const shot = async (name, settle = 1500) => {
  await hold(settle); // let images/tiles finish loading before the capture
  await device.takeScreenshot(name);
};
const step = async (label, fn) => {
  try {
    await fn();
  } catch (e) {
    console.warn(`[shots] skipped "${label}": ${e.message}`);
  }
};

// Reach an interactable menu, robust to two things: the account download taking
// a while, and the occasional support/review popup that rolls when the menu
// first shows (its backdrop covers the menu). Poll: dismiss the popup if up,
// then check for the menu; repeat until the menu is reachable.
const reachMenu = async () => {
  const deadline = Date.now() + T;
  while (Date.now() < deadline) {
    if (await present('support-later', 800)) {
      await element(by.id('support-later')).tap();
    }
    if (await present('mode-all', 800)) {
      await hold(1500); // hero + thumbnails
      return;
    }
    await hold(800);
  }
  await visible('mode-all'); // last resort — surfaces a clear failure
};

// Relaunch to a clean menu. After the first download the account is cached, so
// this is fast — and it's far more reliable than navigating back through every
// screen (which could strand us off-menu if a screen stays busy).
const goMenu = async () => {
  await device.launchApp({ newInstance: true, permissions: { location: 'inuse' } });
  await detach();
  await reachMenu();
};

describe('App Store screenshots', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true, // clean slate so first-run lands on Settings
      permissions: { location: 'inuse' },
    });
    // Ignore network for idle + disable auto-sync (the live app never idles).
    await detach();

    // First run downloads the default account, then lands on Settings — switch
    // it to the real account we want in the screenshots.
    await visible('settings-username');
    // Use clearText + typeText (not replaceText) so React Native's onChangeText
    // actually fires and the username state updates — otherwise the submit keeps
    // the default account.
    await element(by.id('settings-username')).tap();
    await element(by.id('settings-username')).clearText();
    await element(by.id('settings-username')).typeText(USER);
    // returnKeyType="go" + onSubmitEditing → the return key submits and leaves
    // Settings; tap Save only as a fallback if we're somehow still there.
    await element(by.id('settings-username')).tapReturnKey().catch(() => {});
    if (await present('settings-load', 4000)) {
      await element(by.id('settings-load')).tap();
    }
    await reachMenu(); // menu after the account's deck downloads (handles popup)

    // Seed some history so the hero, Statistics and streak look alive: grade a
    // few flash cards, then End the round to reach Results (08).
    await step('seed stats (flash cards)', async () => {
      await tap('mode-flash');
      await hold(1500); // let CustomScreen compute groups + enable Start
      await tap('custom-start');
      await hold(2000); // let the round start + the first card mount
      let graded = 0;
      for (let i = 0; i < 7; i++) {
        if (!(await present('study-reveal', 12000))) break;
        await element(by.id('study-reveal')).tap();
        await hold(900); // let the answer panel + grade buttons settle (needed!)
        // Mostly "knew", some "missed", so the stats show both teal and red.
        const grade = i % 3 === 2 ? 'study-grade-missed' : 'study-grade-knew';
        if (!(await present(grade, 8000))) break;
        await element(by.id(grade)).tap();
        graded++;
        await hold(900); // let the next card load before the next reveal
      }
      console.warn(`[shots] seed: graded ${graded} cards`);
      if (await present('study-end', 3000)) await element(by.id('study-end')).tap();
      if (await present('results-screen', 8000)) await shot('08-results', 1500);
    });
  });

  // Each screen is its own test so a relaunch resets us to a clean menu between
  // them — no fragile back-navigation, and one bad screen can't strand the rest.
  beforeEach(async () => {
    await goMenu();
  });

  it('01 — home / menu', async () => {
    await shot('01-menu', 2500);
  });

  it('02 — by name (photo + choices)', async () => {
    await tap('mode-all');
    await visible('study-reveal');
    await hold(4500); // let the full-screen photo download + render
    await element(by.id('study-reveal')).tap(); // reveal the choices
    await shot('02-by-name', 1500);
  });

  it('03 — lexicon, 04 — species detail', async () => {
    await tap('open-lexicon');
    await visible('lexicon-search');
    await shot('03-lexicon', 3000); // wait for row thumbnails
    if (TAXON_ID && TAXON_NAME) {
      await element(by.id('lexicon-search')).replaceText(TAXON_NAME);
      await hold(1800);
      if (await present(`lexicon-row-${TAXON_ID}`, 8000)) {
        await element(by.id(`lexicon-row-${TAXON_ID}`)).tap();
        await shot('04-detail', 4500); // detail fetches hero + curated photos + taxonomy
      }
    }
  });

  it('05 — statistics', async () => {
    await tap('menu-stats');
    await shot('05-statistics', 3000); // wait for row thumbnails
  });

  it('06 — nearby (Kaposvár, 50 km)', async () => {
    await tap('mode-nearby');
    await visible('nearby-search');
    // Put the simulator at Kaposvár, then use the in-app GPS button so the map
    // centers there and frames the default 50 km radius circle.
    try {
      execSync(`xcrun simctl location booted set ${LAT},${LNG}`);
    } catch (e) {
      console.warn(`[shots] simctl location failed: ${e.message}`);
    }
    await hold(800);
    await element(by.text('Use my location')).tap();
    try {
      await waitFor(element(by.text('My location'))).toBeVisible().withTimeout(30000 * SETTLE);
    } catch {
      /* still screenshot whatever's shown */
    }
    await shot('06-nearby', 4500); // map flies + tiles load
  });

  it('07 — speedrun (timed flash + pie)', async () => {
    // Timing-sensitive: the photo must have loaded AND we must capture within the
    // ~3 s before the pie auto-advances to the choices. Re-run if it misses.
    await tap('mode-speedrun');
    await visible('study-screen');
    await shot('07-speedrun', 1600);
  });

  // Confusion lessons: the "Species you mix up" list on Statistics, the
  // side-by-side comparison, and the A/B duel drill — all fed by the seeded
  // confusion pairs (src/e2e/shotsSeed.js).
  it('09 — species you mix up', async () => {
    await tap('menu-stats');
    await visible('stats-scroll');
    // Scroll the confusion section into view (it sits below the per-species board).
    await waitFor(element(by.id('stats-confusion-0')))
      .toBeVisible()
      .whileElement(by.id('stats-scroll'))
      .scroll(350, 'down');
    await shot('09-mixups', 2500); // let the pair thumbnails resolve
  });

  it('10 — compare, 11 — duel drill', async () => {
    await tap('menu-stats');
    await visible('stats-scroll');
    await waitFor(element(by.id('stats-confusion-0')))
      .toBeVisible()
      .whileElement(by.id('stats-scroll'))
      .scroll(350, 'down');
    // Open the side-by-side comparison for the top mix-up pair.
    await element(by.id('stats-confusion-0')).tap();
    await visible('compare-scroll');
    await shot('10-compare', 3500); // both curated photos load
    // From the comparison, start the A/B duel drill. Wait on an answer button,
    // not the "duel-screen" container: Detox's visibility check is unreliable on
    // a full-screen view whose centre is fully covered by a child (here the
    // photo), so toBeVisible() on the container can time out even though the
    // screen is rendered. The choice button is a leaf Detox detects reliably.
    await step('duel', async () => {
      await tap('compare-drill');
      await visible('duel-choice-a');
      await shot('11-duel', 3000);
    });
  });

  it('12 — settings (fresh photo once mastered)', async () => {
    // "Settings" sits below the fold on the menu — scroll it into view first.
    await visible('menu-scroll');
    await waitFor(element(by.id('open-settings')))
      .toBeVisible()
      .whileElement(by.id('menu-scroll'))
      .scroll(320, 'down');
    await element(by.id('open-settings')).tap();
    await visible('settings-scroll');
    // Bring the "Fresh photo once mastered" study option into view.
    await waitFor(element(by.id('setting-fresh-photos')))
      .toBeVisible()
      .whileElement(by.id('settings-scroll'))
      .scroll(300, 'down');
    await shot('12-settings', 1500);
  });
});
