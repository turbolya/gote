// Every game mode end-to-end.
const { by, device, element, expect, waitFor } = require('detox');
const {
  visible,
  exists,
  tap,
  tapScroll,
  tapCorrectChoice,
  tapCorrectPhoto,
  TIMEOUT,
} = require('./helpers');

// Tap a menu mode card, scrolling the menu if it's below the fold.
const tapMode = (key) => tapScroll(`mode-${key}`, 'menu-scroll');

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

  it('Custom game: toggle a group and start a multiple-choice round', async () => {
    await tapMode('custom');
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

  it('Nearby species: search a place, then play', async () => {
    await tapMode('nearby');
    await visible('nearby-search');
    await element(by.id('nearby-search')).typeText('Test');
    await tap('nearby-result-9001'); // fixture place
    await tap('nearby-start');
    await visible('study-reveal');
    await tap('study-end');
    await visible('results-menu');
  });
});
