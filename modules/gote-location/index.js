// JS entry for the local GoteLocation Expo module (Android-only native code).
// requireOptionalNativeModule returns null wherever the native side isn't
// linked (iOS, web, tests), so callers can stay platform-agnostic.

import { requireOptionalNativeModule } from 'expo-modules-core';

export default requireOptionalNativeModule('GoteLocation');
