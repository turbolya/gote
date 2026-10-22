# F-Droid

F-Droid builds the app from source and refuses proprietary libraries, so the
Android build has to be free of Google Play Services and must not fetch code from
outside this repository. This file records what was changed for that and what is
still open. Run F-Droid's scanner (`pip install fdroidserver`, then
`fdroid scanner path/to/app-release.apk`) after any dependency change.

## What the Android build no longer contains

| Was | Why it was a problem | Now |
| --- | --- | --- |
| `expo-location` | links `play-services-location` | Android uses `modules/gote-location` (framework `LocationManager`, coarse only) through `src/geolocation.android.js`; iOS still uses `expo-location` |
| `react-native-maps` | links `play-services-maps`, `-base`, `-location` | Android never loads it: `NearbyMapView.android.js` and `ObservationMap.android.js` draw the same maps with MapLibre instead (see below); iOS keeps `react-native-maps` |
| `expo-updates` | downloads code from outside the repo | not linked on Android; unused (no `updates` config) |

All three are excluded from **Android** autolinking only, by
`expo.autolinking.android.exclude` in `package.json`; iOS links them as before.
Conversely `@maplibre/maplibre-react-native` is excluded from **iOS** autolinking
(`expo.autolinking.ios.exclude`), and only `*.android.js` files may import it.
`scripts/test-android-deps.js` (part of `npm test`) fails if a file that Android
bundles imports one of them, or if the exclusion list drifts.

## The Android map

MapLibre (MIT) with tiles from [OpenFreeMap](https://openfreemap.org): no account,
no API key. The tile URL is the one constant in `src/mapstyle.js` — change it to
use another provider or to self-host. MapLibre's Android location engine is left
on `default`; `google` would link `play-services-location` again. The radius
circle is a polygon from `src/geo.js` (MapLibre has no metre-radius circle). The
Android pin is not draggable — tap the map to move it. Tile requests reveal the
viewed area to the tile host; `PRIVACY.md` says so.

## `FDROID=1`

`app.config.js` is a thin layer over `app.json`. With `FDROID=1` it also drops
`@config-plugins/detox` (an AAR, a test class and a cleartext network security
config that a release APK has no use for) and sets `updates.enabled=false`.
Normal builds are exactly `app.json`.

`android/` is generated and gitignored, so a local build must regenerate it after
any of the above changes: `FDROID=1 npx expo prebuild --platform android --clean`.

## Listing, versions and the recipe

- `fastlane/metadata/android/en-US/` is what F-Droid reads for the listing: title,
  short and full description, icon, eight phone screenshots (cut from the Pixel 3
  set) and `changelogs/<versionCode>.txt` (500 bytes at most).
- `android.versionCode` in `app.json` is `major*10000 + minor*100 + patch`
  (2.46.0 = 24600), so it only ever goes up. On each release bump it with the
  version and add `changelogs/<versionCode>.txt`; `scripts/test-versions.js` fails
  if the versions, the formula or the changelog file are out of step.
- `docs/fdroid/com.gote.app.yml` is the draft `fdroiddata` recipe. It passes
  `fdroid lint` and `fdroid rewritemeta` against fdroiddata's own `config/`. Its
  scanignore/scandelete lists come from a scan of a clean `npm ci` tree: 52
  findings (mostly iOS-only files and Detox) down to 0.

Release steps once the branch is merged: bump the version, tag `v<version>`,
push the tag; F-Droid's `UpdateCheckData` reads `app.json` at the tag. The first
submission is a merge request to gitlab.com/fdroid/fdroiddata with the recipe.

## Recipe replay (2026-10-22)

The recipe's own steps were replayed on a fresh `git clone` of the committed branch
(no `.env`, so no credentials): `npm ci`, `buildFromSource`, the `local-maven-repo`
and `prebuilds` deletions, `FDROID=1 expo prebuild`, the `signingConfig` removal,
then the scanner with the `scanignore`/`scandelete` lists read from the recipe file
itself, then `gradlew assembleRelease`. Results:
- source scan: 0 problems (75 files removed by `scandelete`);
- output `app-release-unsigned.apk`, versionCode 24600, unsigned as intended;
- `fdroid scanner` on that APK: 0 problems;
- no Supabase URL or key in the JS bundle (only code identifiers);
- installed on a Pixel 3 (signed locally with the debug key): Settings has no
  "Sync across devices" row, and a round with the photo cache, fonts and gradients
  worked, with all Expo modules built from source and no crash.
Skipped locally: the JDK 17 to 21 `sed` (this Mac has JDK 17 only) and, being macOS,
the Linux-only `sudo` and `sdkmanager` steps; the macOS `hermesc` that the recipe
deletes was put back for the build.

## Signing

Decision (first submission): **F-Droid signs the build with its own key.** The
recipe deletes the `signingConfig` line from the generated `build.gradle`, so the
build comes out unsigned and F-Droid signs it; there is no `Binaries:` entry.

Why not a reproducible build signed with our own key: it needs the APK to come out
byte-identical on F-Droid's build server and on ours, which React Native builds
rarely do without extra work, and the repo has no real keystore yet (the release
build uses the generated template's debug key, which is public). Google Play, when
it ships, signs with its own app-signing key anyway, so installs from different
stores would not be interchangeable even then.

Consequences to know about:
- An F-Droid install cannot be updated from, or over, an APK from another source
  (a GitHub release, a local build, Play) without uninstalling first. The app's
  data lives in app storage, and with sync off there is no cloud copy, so
  uninstalling loses it.
- Revisit this if a signed APK is ever published outside F-Droid and the same
  users should move between the two. Then create a real keystore (kept out of the
  repo), sign release builds with it, and ask F-Droid for a reproducible build.
- Separately from F-Droid: any APK we hand out ourselves should not use the debug
  key, since anyone can sign an update with it.

## Still open

- A build on F-Droid's own build server (`fdroid build`), which needs their VM or
  container. Not verified there: the JDK 17 to 21 `sed` in the recipe, building more
  than one ABI (the draft builds arm64-v8a only), and the Linux-only steps (`sudo`
  Node install, `sdkmanager`).
- The `v2.46.0` tag and the branch have to exist upstream before the recipe's
  `commit:` resolves.
- Sync is off in the F-Droid build, by decision for the first submission: the
  recipe sets no `EXPO_PUBLIC_SUPABASE_*` variables, so `SYNC_ENABLED` is false, the
  Settings row is hidden and nothing but iNaturalist and the map tiles is contacted.
  To turn it on later, add the two variables to the recipe's `prebuild`, put the
  hosted service back under `AntiFeatures`, and restore the sync line in
  `full_description.txt`. `scripts/test-android-deps.js` guards the off state.
