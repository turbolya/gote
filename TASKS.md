# Tasks

A running list of things to do for Gote. Check items off as they're done.

## To do

- [ ] Make the GitHub repo public
- [ ] Refine the splash-screen newt illustration (review the hand-coded SVG on
      device; consider a polished designed asset, and matching native splash art)
- [ ] Replace the placeholder app icon (assets/icon.png, adaptive-icon.png,
      favicon.png are solid-green placeholders — make a real 1024×1024 icon)
- [ ] Do a general design review across the whole app (consistency of spacing,
      colors, typography, and components on every screen)
- [ ] Game Center integration (iOS): leaderboards (e.g. speedrun streak,
      lifetime accuracy) and achievements. Needs a native module + EAS/dev
      build — not available in Expo Go.
- [ ] Integrate Aptabase for privacy-first usage analytics (open-source, no PII,
      self-hostable). Wrap in a src/analytics.js, keep opt-out friendly. Needs an
      account/app key + native dev build — not available in Expo Go.
- [ ] Finish Sentry setup: create a Sentry project, put its DSN in app.json
      (expo.extra.sentryDsn) or the SENTRY_DSN env var, re-add "@sentry/react-native"
      to expo.plugins, and set SENTRY_ORG/SENTRY_PROJECT/SENTRY_AUTH_TOKEN so the
      source-map upload build step works (stack traces map to source). The plugin
      was removed for now because that build step fails without an org/token.

## Done
