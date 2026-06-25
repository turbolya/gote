// Runs the pure gesture-logic tests in plain Node by transpiling the ESM
// `src/gestures.js` to CommonJS in memory (no bundler needed).
//   node scripts/test-gestures.js   (or: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'gestures.js');
const code = babel.transformFileSync(file, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, require);

const {
  isUpwardFlick,
  flickOutcome,
  FLICK_DY,
  isBackSwipe,
  backSwipeCommitted,
  SWIPE_EDGE,
} = m.exports;

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok   ' + name);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + name + '  =>  ' + e.message);
  }
}

t('flick: claims upward', () => {
  assert.equal(isUpwardFlick(5, -60), true);
});
t('flick: rejects short / down / diagonal', () => {
  assert.equal(isUpwardFlick(0, -10), false);
  assert.equal(isUpwardFlick(0, 60), false);
  assert.equal(isUpwardFlick(50, -55), false);
});

t('flick: zoom-from-grid returns to grid', () => {
  assert.equal(flickOutcome({ dy: -(FLICK_DY + 1), vy: 0 }, { mode: 'zoom', fromGrid: true }), 'grid');
});
t('flick: zoom-opened-directly closes', () => {
  assert.equal(flickOutcome({ dy: -200, vy: 0 }, { mode: 'zoom', fromGrid: false }), 'close');
});
t('flick: grid view closes', () => {
  assert.equal(flickOutcome({ dy: -200, vy: -2 }, { mode: 'grid', fromGrid: false }), 'close');
});
t('flick: small drag cancels', () => {
  assert.equal(flickOutcome({ dy: -20, vy: 0 }, { mode: 'zoom', fromGrid: true }), 'cancel');
});
t('flick: fast velocity commits even if short', () => {
  assert.equal(flickOutcome({ dy: -30, vy: -1.5 }, { mode: 'grid', fromGrid: false }), 'close');
});

t('back-swipe: claims rightward drag from the left edge', () => {
  assert.equal(isBackSwipe({ x0: 10, dx: 40, dy: 5 }), true);
});
t('back-swipe: rejects swipes not starting at the edge', () => {
  assert.equal(isBackSwipe({ x0: SWIPE_EDGE + 50, dx: 40, dy: 5 }), false);
});
t('back-swipe: rejects vertical / leftward / tiny drags', () => {
  assert.equal(isBackSwipe({ x0: 5, dx: 40, dy: 40 }), false); // too vertical
  assert.equal(isBackSwipe({ x0: 5, dx: -40, dy: 5 }), false); // leftward
  assert.equal(isBackSwipe({ x0: 5, dx: 6, dy: 1 }), false); // too small
});
t('back-swipe: commits on travel or fling, cancels otherwise', () => {
  assert.equal(backSwipeCommitted({ dx: 120, vx: 0 }), true);
  assert.equal(backSwipeCommitted({ dx: 10, vx: 1.2 }), true);
  assert.equal(backSwipeCommitted({ dx: 30, vx: 0.1 }), false);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
