// Where the Supabase credentials come from, and the single switch that decides
// whether sync exists at all.
//
// Sync is ON in every build except the F-Droid one (and the two synthetic test
// modes). The connection details default to this project's public ones; the
// EXPO_PUBLIC_* env vars, which Expo inlines into the JS bundle at build time
// (as for EXPO_PUBLIC_E2E and EXPO_PUBLIC_SHOTS), override them. See
// docs/SUPABASE.md.
//
// Both values are safe to ship in a public binary. The publishable (or anon)
// key is designed to be public — it grants nothing on its own, because every
// table has row-level security and the policies key off auth.uid(). The key
// that must NEVER appear here or anywhere in this repo is the secret one
// (sb_secret_… / service_role): it bypasses RLS entirely.

import { IS_E2E, IS_SHOTS } from '../e2e/testMode';
import { syncEnabled } from './enabled';

// The F-Droid build is the ONE build without sync. Its recipe writes
// EXPO_PUBLIC_FDROID=1 into .env before the bundle is built (docs/FDROID.md);
// every other build — iOS, TestFlight, Play, development, a fresh clone with no
// .env — has sync. `=== '1'` is written out literally so Metro inlines it and can
// fold the credentials below away in an F-Droid bundle.
export const IS_FDROID = process.env.EXPO_PUBLIC_FDROID === '1';

// This project's public connection details. Both are safe to ship (see above)
// and already ship in eas.json and in every release binary; they are the default
// so that sync is on without any build having to remember to supply them. An
// EXPO_PUBLIC_* value still overrides them, to point a build at another project.
// Empty in an F-Droid bundle, which must not contain a backend it never calls.
export const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (process.env.EXPO_PUBLIC_FDROID === '1' ? '' : 'https://gpnmouedaccoexfqvmkh.supabase.co');

// Supabase has two generations of client key. New projects issue a PUBLISHABLE
// key (sb_publishable_…); older ones an `anon` JWT. They are interchangeable in
// createClient, so accept either — publishable first, since that is what a
// project created today hands you.
export const SUPABASE_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (process.env.EXPO_PUBLIC_FDROID === '1' ? '' : 'sb_publishable_gv0VjWQaJRzSihdd4tuxdQ_ys1UJQ4G');

const IN_APP = typeof navigator !== 'undefined' && navigator.product === 'ReactNative';

// `let`, not `const`, purely so tests can force it on: under Node it is false
// (see IN_APP), so every sync function would otherwise return early. ESM live
// bindings mean importers see the change. Nothing in the app ever reassigns it.
export let SYNC_ENABLED = syncEnabled({
  inApp: IN_APP,
  fdroid: IS_FDROID,
  url: SUPABASE_URL,
  key: SUPABASE_KEY,
  e2e: IS_E2E,
  shots: IS_SHOTS,
});

// Tests only.
export function setSyncEnabledForTests(value) {
  SYNC_ENABLED = Boolean(value);
}
