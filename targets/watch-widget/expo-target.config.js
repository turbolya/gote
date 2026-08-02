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
  // Generated into the widget's asset catalog → usable as Image("newt") in the
  // Streak complication. Deliberately the small newt-glyph.png, NOT the
  // full-size gote.png the watch app uses: WidgetKit archives a complication's
  // rendered content under a tight size budget, and a 651x798 bitmap (~2 MB
  // decoded) to draw a 15pt glyph blew it — watchOS then fell back to the
  // redacted placeholder, showing grey boxes instead of the newt and the
  // streak number. 128px tall stays crisp at every complication size.
  images: {
    newt: '../../assets/newt-glyph.png',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.gote.app'],
  },
};
