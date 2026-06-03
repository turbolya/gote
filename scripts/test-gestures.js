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

const { isUpwardFlick, flickOutcome, FLICK_DY } = m.exports;

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
