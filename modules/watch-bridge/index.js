// JS entry for the local WatchBridge Expo module (iOS-only native code).
// requireOptionalNativeModule returns null wherever the native side isn't
// linked (Android, web, tests), so callers can stay platform-agnostic.

import { requireOptionalNativeModule } from 'expo-modules-core';

const WatchBridge = requireOptionalNativeModule('WatchBridge');

// Push a plist-safe snapshot to the paired watch. Best-effort: silently a
// no-op without the native module, and delivery errors are swallowed natively.
export function updateWatchContext(context) {
  if (!WatchBridge) return;
  WatchBridge.updateContext(context).catch(() => {});
}

// Subscribe to game results played on the watch. The native side buffers
// every result; the event is only a wake-up, and consumePendingResults()
// drains the buffer atomically — so results queued before JS attached still
// arrive (drained immediately below) and nothing is double-processed.
// Returns an unsubscribe function.
export function subscribeWatchResults(onResult) {
  if (!WatchBridge) return () => {};
  const drain = () => {
    WatchBridge.consumePendingResults()
      .then((list) => (list || []).forEach(onResult))
      .catch(() => {});
  };
  const sub = WatchBridge.addListener('onWatchResults', drain);
  drain(); // anything that arrived before this subscription
  return () => sub.remove();
}
