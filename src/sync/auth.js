// Identity for sync.
//
// Default: an ANONYMOUS account, created silently on first sync. The player is
// never asked to sign up — gote has always been usable with no account and that
// does not change. An anonymous user is just a stable id to hang rows off.
//
// The catch, and the reason the email functions below exist: an anonymous
// account lives on ONE device. Two devices signing in anonymously become two
// unrelated users with two separate piles of stats. So anonymous auth gives
// frictionless identity, NOT cross-device sync. Linking an email is what makes
// an iPhone and an iPad the same person.
//
// Upgrading is lossless: linking an email keeps the same user id, so every
// event already uploaded stays attached. Nobody loses history by signing in
// later — which is what lets the app default to anonymous without regret.

import { getClient } from './client';

// Sign in anonymously if there is no session yet. Returns the user id, or null
// when sync is off or the network is down (every caller treats null as "not
// today" and tries again later — sync is always best-effort).
export async function ensureSession() {
  const supabase = getClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    if (data && data.session && data.session.user) return data.session.user.id;
    const { data: created, error } = await supabase.auth.signInAnonymously();
    if (error) return null;
    return created && created.user ? created.user.id : null;
  } catch {
    return null;
  }
}

export async function currentUserId() {
  const supabase = getClient();
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getUser();
    return data && data.user ? data.user.id : null;
  } catch {
    return null;
  }
}

// True when this session is anonymous — i.e. the data is stranded on this
// device and would be lost with it. The UI can use this to offer linking.
export async function isAnonymous() {
  const supabase = getClient();
  if (!supabase) return false;
  try {
    const { data } = await supabase.auth.getUser();
    const u = data && data.user;
    if (!u) return false;
    return u.is_anonymous === true || !u.email;
  } catch {
    return false;
  }
}

// Device 1: attach an email to the CURRENT (anonymous) account, keeping its id
// and all its history. Sends a 6-digit code to confirm ownership.
export async function linkEmail(email) {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'sync-disabled' };
  try {
    const { error } = await supabase.auth.updateUser({ email });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Device 2: sign in to an EXISTING account by email. `shouldCreateUser: false`
// on purpose — if the address is unknown this must fail loudly rather than
// silently minting a third empty account and looking like data loss.
export async function signInWithEmail(email) {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'sync-disabled' };
  try {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false },
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// Confirm either of the above with the emailed code.
export async function verifyCode(email, token, type = 'email') {
  const supabase = getClient();
  if (!supabase) return { ok: false, error: 'sync-disabled' };
  try {
    const { error } = await supabase.auth.verifyOtp({ email, token, type });
    return error ? { ok: false, error: error.message } : { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export async function signOut() {
  const supabase = getClient();
  if (!supabase) return;
  try {
    await supabase.auth.signOut();
  } catch {
    /* best-effort */
  }
}
