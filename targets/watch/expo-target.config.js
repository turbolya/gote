// gote Apple Watch companion app (SwiftUI, generated into the Xcode project by
// @bacons/apple-targets on `expo prebuild`). Receives a snapshot (lifetime
// accuracy, streak, mini-deck) from the phone over WatchConnectivity, shows
// glanceable stats, and serves a 4-choice picture quiz. The app-group container
// is shared with the watch-face complication (targets/watch-widget).

/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'watch',
  name: 'GoteWatch',
  displayName: 'gote',
  bundleIdentifier: '.watch',
  deploymentTarget: '10.0',
  icon: '../../assets/app-icon.png',
  entitlements: {
    'com.apple.security.application-groups': ['group.com.gote.app'],
  },
};
