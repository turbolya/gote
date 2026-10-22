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

## Still open

- Expo ships its module AARs prebuilt (`local-maven-repo/` inside each npm
  package) and the Android build consumes them. F-Droid builds from source;
  `expo.autolinking.android.buildFromSource` ("opt out of prebuilt modules") looks
  like the switch but has not been tried.
- React Native's prebuilt artifacts in `node_modules/react-native/android`, and
  the `hermesc` / `dotslash` executables, are flagged by the scanner. The usual
  fix is to delete them in the recipe so Gradle resolves from Maven Central; the
  Hermes compiler may need a source build.
- A `fastlane/metadata/android/en-US/` folder, version/tag scheme (`versionCode`
  is 1 in `app.json`), the signing decision, and the `fdroiddata` recipe.
- Sync reads `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` at
  build time; the recipe has to provide them (sync stays off when they are empty).
