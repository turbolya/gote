// Dynamic layer over app.json. Normal builds are exactly app.json.
//
// FDROID=1 builds (see docs/FDROID.md) drop what F-Droid cannot ship:
//   - @config-plugins/detox: end-to-end test plumbing (a test AAR and a
//     cleartext network security config) that has no place in a release APK;
//   - over-the-air updates: F-Droid does not allow an app to fetch code from
//     outside its repository.
//
// The Play Services libraries (expo-location, react-native-maps) are not handled
// here: the Android build never links them at all — see "expo.autolinking" in
// package.json and the *.android.js files next to the code that uses them.

const isFdroid = process.env.FDROID === '1';

const pluginName = (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin);

module.exports = ({ config }) => {
  if (!isFdroid) return config;
  return {
    ...config,
    updates: { ...config.updates, enabled: false },
    plugins: (config.plugins || []).filter(
      (plugin) => pluginName(plugin) !== '@config-plugins/detox'
    ),
  };
};
