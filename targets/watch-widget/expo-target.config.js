// Watch-face complication (WidgetKit) showing lifetime accuracy + streak.
// Embedded in the watch app (targets/watch) and reads the snapshot that app
// persists to the shared app-group defaults.

/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'watch-widget',
  name: 'GoteWatchWidget',
  displayName: 'gote',
  bundleIdentifier: '.watch.widget',
  deploymentTarget: '10.0',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.gote.app'],
  },
};
