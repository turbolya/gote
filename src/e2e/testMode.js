// E2E test mode. When the app is bundled with EXPO_PUBLIC_E2E=1 (set by the
// Detox build), the app runs fully OFFLINE against fixture data: it skips the
// iNaturalist network entirely and loads a fixed deck, so the end-to-end tests
// are deterministic and never hit the API's rate limit.
//
// In every normal build this is false and tree-shakes to a no-op.
export const IS_E2E = process.env.EXPO_PUBLIC_E2E === '1';

// Screenshot mode. When the app is bundled with EXPO_PUBLIC_SHOTS=1 (set by the
// screenshots build in screenshots-local/), the app runs against the REAL
// network + account like normal, but seeds realistic gameplay statistics on
// first launch so the App Store screenshots show a busy hero, a full accuracy
// chart, and a populated per-species breakdown. See src/e2e/shotsSeed.js.
//
// In every normal build this is false and the seeder is never invoked.
export const IS_SHOTS = process.env.EXPO_PUBLIC_SHOTS === '1';
