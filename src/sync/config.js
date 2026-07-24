// Where the Supabase credentials come from, and the single switch that decides
// whether sync exists at all.
//
// Read from EXPO_PUBLIC_* env vars, matching how EXPO_PUBLIC_E2E and
// EXPO_PUBLIC_SHOTS already work in this codebase: Expo inlines them into the
// JS bundle at build time, so there is no runtime config fetch and no extra
// dependency. See docs/SUPABASE.md for where to set them.
//
// Both values are safe to ship in a public binary. The anon key is designed to
// be public — it grants nothing on its own, because every table has row-level
// security and the policies key off auth.uid(). The key that must never appear
// here (or anywhere in this repo) is service_role.

import { IS_E2E, IS_SHOTS } from '../e2e/testMode';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

// Sync is entirely opt-in and OFF unless credentials were baked into the
// build. An unconfigured build behaves exactly as gote did before sync
// existed: local storage only, no account, no network beyond iNaturalist.
//
// It is also forced off in the two synthetic modes. E2E must stay offline and
// deterministic (the whole point of the fixture deck), and the screenshot build
// seeds fake lifetime stats — uploading those would poison the real account
// they are captured from.
export const SYNC_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY) && !IS_E2E && !IS_SHOTS;
