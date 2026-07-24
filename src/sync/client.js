// The Supabase client, created lazily so an unconfigured build never
// constructs one (and never touches the network or AsyncStorage for a session
// it will not use).

import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_URL, SUPABASE_KEY, SYNC_ENABLED } from './config';

let client = null;

export function getClient() {
  if (!SYNC_ENABLED) return null;
  if (client) return client;
  client = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      // Sessions live in AsyncStorage like the rest of the app's state, so a
      // signed-in user stays signed in across launches.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL bar for an OAuth callback to land in; leaving
      // this on makes supabase-js look for one and log noise on every launch.
      detectSessionInUrl: false,
    },
  });
  return client;
}
