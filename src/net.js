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
import { IS_E2E } from './e2e/testMode';

// E2E only: a simulator has no airplane mode, and the offline behaviour — the
// banner, the dimmed online-only modes, the paused Observations row — is worth
// testing. So under IS_E2E a test can pin this signal, through the hidden
// toggle App.js renders. Never reachable in a normal build: IS_E2E is false
// and the setter is a no-op, so no store, no listeners, no override.
let override = null;
const listeners = new Set();

export function setOfflineOverride(value) {
  if (!IS_E2E) return;
  override = typeof value === 'boolean' ? value : null;
  for (const fn of listeners) fn();
}

export function getOfflineOverride() {
  return override;
}

export function useIsOffline() {
  const [offline, setOffline] = useState(false);
  const [, bump] = useState(0);
  useEffect(() => {
    if (!IS_E2E) return undefined;
    const fn = () => bump((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
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
  return override === null ? offline : override;
}
