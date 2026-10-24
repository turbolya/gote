// Turn on R8 (code shrinking and obfuscation) for Android release builds.
//
// The generated android/gradle.properties leaves `android.enableMinifyInReleaseBuilds`
// off, and `expo prebuild` regenerates the folder, so the flag has to be set here.
// F-Droid's reviewers asked for R8 (an unminified APK is larger and ships every
// unused class); Play builds get the same, so both stores run the code that was
// tested. It is one Gradle property, so this is a small plugin of its own instead
// of the expo-build-properties package: that package drags in a second copy next
// to the one @config-plugins/detox nests, and expo-doctor (CI) fails on duplicates.
//
// The F-Droid recipe (docs/fdroid/com.gote.app.yml) also appends the flag, because
// the recipe pins tag v2.46.0, which predates this plugin.

const { withGradleProperties } = require('expo/config-plugins');

const KEY = 'android.enableMinifyInReleaseBuilds';

// Pure, so scripts/test-android-deps.js can check it without a prebuild.
function setMinify(properties) {
  const rest = properties.filter((item) => !(item.type === 'property' && item.key === KEY));
  return [...rest, { type: 'property', key: KEY, value: 'true' }];
}

const withAndroidMinify = (config) =>
  withGradleProperties(config, (c) => {
    c.modResults = setMinify(c.modResults);
    return c;
  });

module.exports = withAndroidMinify;
module.exports.setMinify = setMinify;
module.exports.KEY = KEY;
