// Tests for src/photoretry.js.
//   node scripts/test-photoretry.js   (or via: npm test)
const babel = require('@babel/core');
const assert = require('assert');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'photoretry.js');
const code = babel.transformFileSync(file, {
  plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code;
const m = { exports: {} };
new Function('module', 'exports', 'require', code)(m, m.exports, require);
const { retryUri, SLOW_PHOTO_MS } = m.exports;

let pass = 0;
let fail = 0;
function t(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok   ' + name);
  } catch (e) {
    fail++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
}

const URL = 'https://inaturalist-open-data.s3.amazonaws.com/photos/123/large.jpg';

t('the first attempt is the plain URL', () => {
  assert.equal(retryUri(URL, 0), URL);
});

t('a retry changes only the fragment, so the server sees the same URL', () => {
  const r = retryUri(URL, 1);
  assert.notEqual(r, URL);
  assert.equal(r.split('#')[0], URL);
});

t('each retry is a new key, not a pile-up of fragments', () => {
  assert.notEqual(retryUri(URL, 1), retryUri(URL, 2));
  assert.equal(retryUri(retryUri(URL, 1), 2), retryUri(URL, 2));
});

t('a query string is kept as it is', () => {
  const q = 'https://static.inaturalist.org/photos/9/large.jpeg?1700000000';
  assert.equal(retryUri(q, 3).split('#')[0], q);
});

t('local files and missing URIs are left alone', () => {
  assert.equal(retryUri('file:///data/gote-photos/abc.jpg', 2), 'file:///data/gote-photos/abc.jpg');
  assert.equal(retryUri(null, 1), null);
  assert.equal(retryUri('', 1), '');
});

t('slow is seconds, not a hair trigger', () => {
  assert.ok(SLOW_PHOTO_MS >= 8000 && SLOW_PHOTO_MS <= 30000);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
