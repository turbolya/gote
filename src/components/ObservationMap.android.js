// Android shows no observation map (see ObservationMap.js): callers only render
// it where Platform.OS !== 'android'. This stub keeps react-native-maps, and
// the Google Play Services it links, out of the Android bundle.

export default function ObservationMap() {
  return null;
}
