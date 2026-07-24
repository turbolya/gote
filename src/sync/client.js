// The Supabase client, created lazily so an unconfigured build never
// constructs one (and never touches the network or storage for a session it
// will not use).
//
// Deliberately imports nothing React-Native-only: the session lives behind
// src/kv.js and the URL polyfill is applied by the app entry point (index.js),
// not here. That keeps this module loadable from a plain Node script, which is
// what lets scripts/test-sync-integration.js drive the real push/pull code
// against a real database instead of only unit-testing the merge.

import { createClient } from '@supabase/supabase-js';
import { storageAdapter } from '../kv';
import { SUPABASE_URL, SUPABASE_KEY, SYNC_ENABLED } from './config';

let client = null;
let override = null;

export function getClient() {
  if (override) return override;
  if (!SYNC_ENABLED) return null;
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      // Sessions live alongside the rest of the app's state, so a signed-in
      // user stays signed in across launches.
      storage: storageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar for an OAuth callback to land in; leaving
      // this on makes supabase-js look for one and log noise on every launch.
      detectSessionInUrl: false,
    },
  });
  return client;
}

// Tests only: supply a pre-built client (and bypass SYNC_ENABLED, which is
// false under Node because no EXPO_PUBLIC_* vars are inlined there). Call with
// no argument to go back to the real one.
export function setClientForTests(next) {
  override = next || null;
  client = null;
}
