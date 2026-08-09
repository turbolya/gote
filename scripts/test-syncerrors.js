// Tests for the sync sign-in error messages (src/sync/errors.js).
//
// This text is the only thing a user has to go on when sign-in fails, so a
// confident wrong message is worse than a vague one — it sends them somewhere
// that cannot work. The case that motivated these tests: Supabase answers a bad
// verifyOtp with "Token has expired or is invalid", which satisfies a naive
// 'expired' test, so every failure told the user to resend the code. Resending
// cannot fix a consumed or mistyped token, so the advice looped forever.
//
//   node scripts/test-syncerrors.js   (or via: npm test)
const assert = require('assert');
const { execFileSync } = require('child_process');
const path = require('path');

const src = path.join(__dirname, '..', 'src/sync/errors.js');

const script = `
import { friendlyError, LINK, SIGNIN } from ${JSON.stringify(src)};
const out = {
  combined: friendlyError('Token has expired or is invalid', LINK),
  combinedCased: friendlyError('Token has expired or is invalid', SIGNIN),
  expiredOnly: friendlyError('Email link has expired', LINK),
  invalidOnly: friendlyError('Invalid token', LINK),
  registered: friendlyError('Email address already been registered', LINK),
  unknownSignin: friendlyError('Signups not allowed for otp', SIGNIN),
  unknownLink: friendlyError('Signups not allowed for otp', LINK),
  rate: friendlyError('For security purposes, you can only request this after 60 seconds. Rate limit', LINK),
  disabled: friendlyError('sync-disabled', LINK),
  passthrough: friendlyError('Some unmapped server failure', LINK),
  empty: friendlyError('', LINK),
  nullish: friendlyError(null, LINK),
};
console.log(JSON.stringify(out));
`;

const res = JSON.parse(
  execFileSync(process.execPath, ['--input-type=module', '--eval', script], {
    encoding: 'utf8',
  })
);

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ', name);
  } catch (e) {
    fail++;
    console.log('  FAIL', name, '\n       ', e.message);
  }
}

console.log('\nsync sign-in error messages\n');

test('the combined expired/invalid message does NOT claim the code expired', () => {
  // The regression: this string contains "expired", so an ordering that tests
  // for it first reports a definite expiry and tells the user to resend.
  assert.ok(
    !/has expired\./.test(res.combined),
    `must not assert expiry, got: ${res.combined}`
  );
});

test('...and offers the causes a resend cannot fix', () => {
  assert.ok(/already been used/i.test(res.combined), 'mentions a consumed code');
  assert.ok(/mistyped/i.test(res.combined), 'mentions a mistyped code');
  assert.ok(/newest email/i.test(res.combined), 'points at the newest email');
});

test('the combined message is the same in both modes', () => {
  assert.strictEqual(res.combined, res.combinedCased);
});

test('a message that ONLY says expired still says so plainly', () => {
  assert.match(res.expiredOnly, /expired/i);
  assert.match(res.expiredOnly, /Resend code/i);
});

test('a message that only says invalid says the code does not match', () => {
  assert.match(res.invalidOnly, /doesn't match/i);
});

test('an already-registered address points at the sign-in path', () => {
  assert.match(res.registered, /already used by another device/i);
});

test('an unknown address is explained when signing in', () => {
  assert.match(res.unknownSignin, /don't know that address/i);
});

test('but the raw message passes through when LINKING', () => {
  // Linking should never hit "signups not allowed"; hiding it behind sign-in
  // advice would mask a real configuration problem.
  assert.strictEqual(res.unknownLink, 'Signups not allowed for otp');
});

test('rate limiting asks the user to wait, not to retry immediately', () => {
  assert.match(res.rate, /Wait a minute/i);
});

test('a build with no credentials says sync is unavailable', () => {
  assert.match(res.disabled, /not available in this build/i);
});

test('an unmapped message is passed through, not swallowed', () => {
  assert.strictEqual(res.passthrough, 'Some unmapped server failure');
});

test('an empty or missing message still says something', () => {
  assert.strictEqual(res.empty, 'Something went wrong. Try again.');
  assert.strictEqual(res.nullish, 'Something went wrong. Try again.');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
