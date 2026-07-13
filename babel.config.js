module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Required by react-native-reanimated v4 (used for the photo viewer's
    // cross-platform pinch/pan/double-tap zoom). MUST be the last plugin.
    plugins: ['react-native-worklets/plugin'],
  };
};
