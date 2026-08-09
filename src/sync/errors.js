// Turning Supabase's auth errors into something a player can act on.
//
// Lives in its own module (rather than inside SyncScreen) because it is pure
// string handling and the cost of getting it wrong is high: this text is the
// ONLY thing the user has to go on when sign-in fails, and a confident wrong
// message sends them round a loop that cannot end. See scripts/test-syncerrors.js.

export const LINK = 'link';
export const SIGNIN = 'signin';

// Supabase's messages are accurate but written for developers. Translate the
// ones a user can actually hit; pass anything else through rather than hiding a
// real problem behind a vague apology.
export function friendlyError(message, mode) {
  const m = String(message || '').toLowerCase();
  if (m.includes('already been registered') || m.includes('already registered')) {
    return 'That address is already used by another device. Choose "I already have gote elsewhere" to sign in with it.';
  }
  if (m.includes('signups not allowed') || m.includes('user not found')) {
    return mode === SIGNIN
      ? "We don't know that address yet. Connect your first device with it, then sign in here."
      : message;
  }
  // Supabase returns ONE message — "Token has expired or is invalid" — for a
  // code that expired, one that was mistyped, and one that was already used.
  // It must be matched BEFORE the plain 'expired' test below, which it also
  // satisfies: reporting it as expired and telling the user to resend sent them
  // round a loop no resend could break, because a fresh code fails the same way
  // when the cause is a consumed or mismatched token.
  if (m.includes('expired or is invalid') || (m.includes('expired') && m.includes('invalid'))) {
    return 'That code didn’t work. It may have expired, already been used, or been mistyped — make sure you’re using the code from the newest email, or tap “Resend code”.';
  }
  if (m.includes('expired')) {
    return 'That code has expired. Tap “Resend code” for a new one.';
  }
  if (m.includes('invalid') && m.includes('token')) {
    return "That code doesn't match. Check the email and try again.";
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts just now. Wait a minute and try again.';
  }
  if (m === 'sync-disabled') return 'Sync is not available in this build.';
  return message || 'Something went wrong. Try again.';
}
