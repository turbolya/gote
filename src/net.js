// A tiny reactive "are we offline?" signal, built on NetInfo.
//
// Deliberately CONSERVATIVE: it reports offline only when the device explicitly
// has no connection (`isConnected === false`). A brief "unknown" at startup, or
// a connected-but-captive network, is treated as online — so we never falsely
// disable the online-only features (Nearby, observation updates) on a flaky
// signal. Being wrong toward "online" just means the normal best-effort network
// path runs and fails gracefully, which is the pre-existing behaviour.

import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useIsOffline() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let mounted = true;
    const apply = (state) => {
      if (mounted) setOffline(state && state.isConnected === false);
    };
    // Seed once, then subscribe. NetInfo.fetch resolves the current state; the
    // listener keeps it live as the user toggles airplane mode / walks out of
    // range. addEventListener returns its own unsubscribe.
    NetInfo.fetch().then(apply).catch(() => {});
    const unsubscribe = NetInfo.addEventListener(apply);
    return () => {
      mounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, []);
  return offline;
}
