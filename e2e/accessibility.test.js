// What a screen reader is told, read from the same accessibility tree VoiceOver
// uses. Each case is a bug the 2.46.2 device test found: icon-font glyphs
// leading every button's label, Speedrun's lives and score with no words at
// all, the popup's buttons swallowed by its backdrop, and an empty round graded
// "Keep practicing!".
const { by, device, element, waitFor } = require('detox');
const { settle, visible, exists, tap, tapScroll, typeInto, labelOf, TIMEOUT } = require('./helpers');
// The fixture deck's names (src/e2e/fixtures.js, which is ESM and app-side).
const FIXTURE_NAMES = [
  'European Robin', 'Barn Swallow', 'Great Tit', 'Common Blackbird', 'Monarch',
  'Western Honey Bee', 'Seven-spot Ladybird', 'Common Daisy',
];

const tapMode = (key) => tapScroll(`mode-${key}`, 'menu-scroll');

// A private-use character is an icon-font glyph. None belongs in a label.
const GLYPH = /[-]|[\udb80-\udbff][\udc00-\udfff]/;
const assertWords = (id, label) => {
  if (GLYPH.test(String(label || ''))) {
    throw new Error(`${id} still has an icon glyph in its label: ${JSON.stringify(label)}`);
  }
};

// Polls, and says what the label WAS when it never matches: Detox's own
// toHaveLabel only reports the label it wanted.
const expectLabel = async (id, want, ms = 8000) => {
  const end = Date.now() + ms;
  let got;
  do {
    got = await labelOf(id);
    if (got === want) return;
    await settle(400);
  } while (Date.now() < end);
  throw new Error(`${id} reads ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};

const freshMenu = async () => {
  await device.launchApp({ newInstance: true });
  await device.disableSynchronization();
  await visible('mode-smart');
  await settle();
};

describe('Accessibility', () => {
  beforeAll(async () => {
    await device.launchApp({ newInstance: true, delete: true });
    await device.disableSynchronization();
  });

  it('Speedrun names its lives and score, and a lost life is counted', async () => {
    await freshMenu();
    await tapMode('speedrun');
    await visible('study-reveal');
    await expectLabel('study-lives', '3 of 3 lives left');
    await expectLabel('study-speedrun-score', 'Score: 0');

    // A wrong pick: any offered name that is not the answer.
    await tap('study-reveal');
    const answer = await labelOf('e2e-answer');
    let wrong = null;
    for (const name of FIXTURE_NAMES) {
      if (name === answer) continue;
      try {
        await exists(`study-choice-${name}`, 500);
        wrong = name;
        break;
      } catch (e) { /* not offered this time */ }
    }
    if (!wrong) throw new Error('no wrong choice on screen');
    await tap(`study-choice-${wrong}`);
    await settle(600);
    // The miss is counted when the round moves on, not on the tap.
    await tap('study-next');
    await settle(600);
    await expectLabel('study-lives', '2 of 3 lives left');
    await tap('study-end');
    await visible('results-menu');
  });

  it('an empty round says nothing was scored, not "Keep practicing!"', async () => {
    await freshMenu();
    await tapMode('speedrun');
    await visible('study-reveal');
    await tap('study-end');
    await visible('results-empty');
    await waitFor(element(by.text('Keep practicing!'))).not.toExist().withTimeout(2000);
    await waitFor(element(by.text('0%'))).not.toExist().withTimeout(2000);
    await tap('results-menu');
    await visible('mode-smart');
  });

  it('buttons with an icon are named by their words alone', async () => {
    await freshMenu();
    await tapMode('nearby');
    await visible('nearby-search');
    for (const [id, want] of [['nearby-group-Aves', 'Birds'], ['nearby-group-Plantae', 'Plants']]) {
      const label = await labelOf(id);
      assertWords(id, label);
      if (label !== want) throw new Error(`${id} reads ${JSON.stringify(label)}, not ${want}`);
    }
    assertWords('nearby-gps', await labelOf('nearby-gps'));
    await typeInto('nearby-search', 'Test');
    await tap('nearby-result-9001');
    assertWords('nearby-start', await labelOf('nearby-start'));
    await tap('nearby-start');
    await visible('study-reveal');
    const end = await labelOf('study-end');
    assertWords('study-end', end);
    if (end !== 'End') throw new Error(`study-end reads ${JSON.stringify(end)}`);
    await tap('study-end');
    await visible('results-menu');
    assertWords('results-playagain', await labelOf('results-playagain'));
    await tap('results-menu');
  });

  it('the photo popup\'s close and info buttons are reachable on their own', async () => {
    await freshMenu();
    await tap('recent-photo-1008'); // Common Daisy, the newest fixture
    await visible('recent-popup-close');
    // Separate elements with their own names. Before 2.46.2 the backdrop was
    // the accessibility element and these two were folded into it.
    await expectLabel('recent-popup-close', 'Close');
    await expectLabel('recent-popup-info', 'More about this species');
    const backdrop = await element(by.id('recent-popup-backdrop')).getAttributes();
    if (backdrop.label && /Close|More about/.test(backdrop.label)) {
      throw new Error(`the backdrop still swallows the buttons: ${JSON.stringify(backdrop.label)}`);
    }
    // Settle first, as menu.test.js does: a tap during the fade is swallowed.
    await settle();
    await tap('recent-popup-close');
    await waitFor(element(by.id('recent-popup-close'))).not.toBeVisible().withTimeout(TIMEOUT);
  });
});
