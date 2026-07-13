// Crash / error reporting via Sentry, behind a thin wrapper so the rest of the
// app doesn't import Sentry directly and it can be disabled in one place.
//
// Sentry only activates when a DSN is configured in app.json
// (expo.extra.sentryDsn). With no DSN it's a no-op — so it stays silent in
// Expo Go / local dev and never throws if the native module isn't present.
//
// Note: we intentionally read the DSN from app.json, not process.env — Expo
// only inlines EXPO_PUBLIC_* vars into the JS bundle, so a plain SENTRY_DSN env
// var would be undefined at runtime.

import * as Sentry from '@sentry/react-native';
import appConfig from '../app.json';

const DSN = (appConfig.expo.extra && appConfig.expo.extra.sentryDsn) || null;

let enabled = false;

// Initialize Sentry. Safe to call once at startup; does nothing without a DSN.
export function initMonitoring() {
  if (!DSN) return;
  try {
    Sentry.init({
      dsn: DSN,
      // Crashes/errors only — no performance tracing or session replay, to keep
      // it lightweight and privacy-light.
      tracesSampleRate: 0,
      // Don't attach IPs / user identifiers we don't need.
      sendDefaultPii: false,
    });
    enabled = true;
  } catch {
    enabled = false;
  }
}

// Wrap the root component so unhandled render errors are captured. When Sentry
// isn't enabled, returns the component unchanged.
export function wrapApp(Component) {
  return enabled ? Sentry.wrap(Component) : Component;
}

// Manually report a caught error (best-effort; no-op when disabled).
export function captureError(err, context) {
  if (!enabled) return;
  try {
    Sentry.captureException(err, context ? { extra: context } : undefined);
  } catch {
    /* ignore */
  }
}
