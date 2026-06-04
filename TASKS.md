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
- [ ] Legal review before public release: have someone with legal expertise check
      the Data & licensing disclaimer (src/screens/LegalScreen.js), iNaturalist
      attribution/terms compliance, and App Store submission requirements. Current
      text is plain-language, not lawyer-vetted.

## App Store release

(Also blocking: the app-icon, splash, design-review, and legal-review tasks above.)

- [ ] Enroll in the Apple Developer Program ($99/year) — required for App Store.
- [ ] Set up EAS Build & Submit: `eas.json`, `eas build -p ios`, `eas submit`
      (cloud builds + upload to App Store Connect / TestFlight).
- [ ] Create the app record in App Store Connect (bundle id com.gote.app) and
      set up TestFlight for beta testing before public release.
- [ ] Add iOS build number + auto-increment (app.json ios.buildNumber +
      eas.json autoIncrement) so each upload has a unique build.
- [ ] Set ITSAppUsesNonExemptEncryption=false in app.json ios.config (only
      standard HTTPS is used) to skip the export-compliance prompt each build.
- [ ] Finalize real app metadata: name, subtitle, description, keywords,
      category, support URL, marketing URL.
- [ ] Produce App Store screenshots for required device sizes (6.7" + others).
- [ ] Write a Privacy Policy (URL required by App Store) and fill in the
      Privacy "Nutrition Label" — declare location use (Nearby species),
      Sentry crash data if enabled, and that no account/PII is collected.
- [ ] Re-confirm the app icon meets Apple rules (1024×1024, no alpha/transparency)
      once the real icon is made.
- [ ] Set a real EAS/Expo project (eas init / projectId) and confirm signing
      (distribution cert + provisioning profile, managed by EAS).
- [ ] Pre-submission QA pass on a release build: every game mode, Nearby GPS +
      search, offline/empty states, and that Sentry/analytics don't crash.

## Done
