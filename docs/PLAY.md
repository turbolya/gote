# Google Play

One branch (`main`) serves iOS, Google Play and F-Droid. They differ only in build
settings and signing, never in code:

| Store | Artifact | Built by | Sync | Signed with |
| --- | --- | --- | --- | --- |
| iOS | IPA | EAS `testflight` / `production` | on | Apple |
| F-Droid | APK | F-Droid's recipe (`docs/fdroid/com.gote.app.yml`, `EXPO_PUBLIC_FDROID=1`) | off | F-Droid's key |
| Google Play | AAB | EAS `play` profile | on | our upload key (Play re-signs with its own) |

The Android code is the F-Droid-clean one (see `docs/FDROID.md`): no Play Services,
framework `LocationManager`, MapLibre maps, no expo-updates. That is deliberate, so
Play needs no Google Maps key and there is no second Android codebase. The
autolinking exclusions are in `package.json`, so EAS honours them.

## Building

```bash
npx eas-cli build -p android --profile play      # an AAB, signed by EAS with the upload key
npx eas-cli submit -p android --latest           # to the "internal" track
```

- The `play` profile extends `production` but sets `autoIncrement: false`. The
  production profile auto-increments, which on Android rewrites
  `android.versionCode` in `app.json` and would break the
  `major*10000 + minor*100 + patch` scheme (and F-Droid's versionCode for the same
  version). `scripts/test-versions.js` guards both.
- Play needs a new versionCode for every upload, and the scheme gives one per
  version. To re-upload the same version, bump the patch (and add
  `fastlane/.../changelogs/<code>.txt`, which the same test requires).
- Tag the release (`v<version>`) and build every store from that tag.
- Let EAS manage the upload keystore (`eas credentials`) and turn on Play App
  Signing. An F-Droid install and a Play install cannot update each other (different
  signing keys); that is expected.

## Before the first upload

- Play Console account: $25 fee and identity verification. A new personal account
  usually has to run a closed test with a minimum number of testers for 14 days before
  production access; check the current rule in the Console, it changes.
- Create the app record for `com.gote.app`; ship to internal, then closed testing.
- Listing: reuse `fastlane/metadata/android/en-US/` (title, short and full
  description, icon, phone screenshots). Play also needs a 1024x500 feature graphic.
  Play's title limit is 30 characters and short description 80, the same limits the
  F-Droid listing test already checks.
- Target audience: not directed at children (the privacy policy says under 13).
- Content rating: no violence, gambling or user-to-user content; educational.
- Privacy policy URL: https://goteapp.com/PRIVACY.html
- Account deletion URL (Play asks when an app can create accounts, and sync does):
  https://goteapp.com/PRIVACY.html#deleting-your-data — check that this anchor
  exists on the published page, and that the page says how to delete without the app.
- Permissions: only `ACCESS_COARSE_LOCATION` (declare it as used for Nearby species,
  foreground only). `app.json` blocks fine location, overlay and storage permissions.

## Data safety form: draft answers

Written from `PRIVACY.md` and the code on 2026-10-23. **Review before submitting**:
these are declarations to Google, and the Play build has sync available.

Does the app collect or share user data? **Yes.** Is all of it encrypted in
transit? **Yes** (HTTPS only). Can users request deletion? **Yes**: in-app
"Delete synced account", and email.

| Data type | Collected | Shared | Optional | Purpose | Why |
| --- | --- | --- | --- | --- | --- |
| Approximate location | yes | yes, with iNaturalist | yes (user can pick a place by hand) | App functionality | "Nearby species" sends coordinates to the iNaturalist API as the search area; nothing is stored by us |
| Email address | yes, only if the user links devices | no | yes | Account management | Supabase (our service provider) stores it to recognise the user's devices |
| User IDs | yes | no | yes (needs sync) | App functionality, account management | random sync account id; the iNaturalist username the user typed is also synced |
| App interactions | yes | no | yes (needs sync) | App functionality | round-by-round history, per-species answers and timings |
| Other user-generated content | yes | no | yes (needs sync) | App functionality | the user's own notes on the "species you mix up" screen |

Not collected: photos or videos, contacts, precise location, device identifiers,
financial info, health, web browsing, crash logs or diagnostics (no analytics or
crash SDK in the app), advertising data. No data is sold. No ads.

Notes for the reviewer in us:
- Everything marked "needs sync" is only sent after the user turns sync on; without
  it nothing leaves the device apart from iNaturalist requests and map tiles.
- Map tiles come from OpenFreeMap (IP address and the tiles viewed, no account);
  Google's form has no category for that, and `PRIVACY.md` discloses it.
- If Google's reviewers treat the iNaturalist request as "shared", the table above
  already says so; if they treat it as a service provider, answer "not shared".
