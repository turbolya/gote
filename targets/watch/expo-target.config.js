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
  // watchOS masks the icon into a CIRCLE, which crops hardest at the top and
  // bottom — and app-icon.png is full-bleed (the newt spans 78% of its height,
  // with only a 9% bottom margin), so it came out cramped. adaptive-icon.png is
  // the same newt padded into a safe zone (23–29% margins), which sits
  // comfortably inside the circular mask. Supplied square and opaque: the
  // system does the masking, so pre-cutting a circle would only add corners.
  icon: '../../assets/adaptive-icon.png',
  // Generated into the target's asset catalog → usable as Image("newt").
  images: {
    newt: '../../assets/gote.png',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.gote.app'],
  },
};
