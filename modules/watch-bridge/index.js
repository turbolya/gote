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
