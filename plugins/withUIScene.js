// Adopt the UIKit scene life cycle, which iOS 27 makes mandatory.
//
// Apps built against the iOS 27 SDK are killed at launch unless they adopt it:
//
//   Application failed to launch: UIScene life cycle is required for apps built
//   with this SDK.
//
// It is not a warning and not conditional on the device's OS — the app simply
// does not start. Nothing in the JS layer is involved.
//
// Expo SDK 57 ships the pieces (`ExpoAppSceneDelegate`, whose own doc comment
// says "Required by the iOS 27") but does NOT wire them up: prebuild still
// generates the pre-scene AppDelegate that makes its own window, and there is
// no config flag or built-in mod for it. So the app has to opt in, and because
// `expo prebuild` regenerates ios/, opting in has to happen here.
//
// Three changes, which together are what ExpoAppSceneDelegate documents as its
// contract:
//
//   1. The app delegate stops creating the window and starting React Native —
//      the scene delegate owns both now — but still creates the factory, and
//      declares it conforms to ExpoReactNativeFactoryProvider so the scene
//      delegate can reach it.
//   2. A scene delegate subclassing ExpoAppSceneDelegate exists. It is appended
//      to AppDelegate.swift rather than added as its own file ON PURPOSE: a new
//      file would have to be registered in the Xcode project too, and editing
//      the pbxproj is a far more fragile thing to do on every prebuild than
//      appending to a file that is already compiled.
//   3. Info.plist names that class as the scene delegate. Without the manifest
//      UIKit does not consider the app to have adopted anything, and the launch
//      assertion fires regardless of the code.

const { withDangerousMod, withInfoPlist } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const MARKER = '// [gote] UIScene life cycle';
const SCENE_CLASS = 'SceneDelegate';

// The window creation the scene delegate takes over. Matched rather than
// rewritten wholesale so an SDK bump that changes the rest of the file still
// applies — and so a change to THIS block is loud instead of silent.
const WINDOW_BLOCK = `#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif
`;

const SCENE_DELEGATE = `

${MARKER} — see plugins/withUIScene.js.
// Creates the window from the connecting scene and starts React Native into it,
// which is what the app delegate used to do. ExpoAppSceneDelegate does all the
// work; this exists so Info.plist has a class in this module to name.
class ${SCENE_CLASS}: ExpoAppSceneDelegate {}
`;

function patchAppDelegate(contents) {
  if (contents.includes(MARKER)) return contents; // already patched

  if (!contents.includes(WINDOW_BLOCK)) {
    throw new Error(
      '[withUIScene] the generated AppDelegate no longer contains the expected ' +
        'window-creation block. Expo may have adopted the scene life cycle itself — ' +
        'check, and delete this plugin if so, rather than patching around it.'
    );
  }
  // The scene delegate creates the window and starts React Native instead.
  let out = contents.replace(
    WINDOW_BLOCK,
    `    // Window creation and startReactNative moved to ${SCENE_CLASS} — the scene
    // life cycle owns the window. ${MARKER}
`
  );

  // The scene delegate finds the factory through this protocol.
  out = out.replace(
    /class AppDelegate: ExpoAppDelegate \{/,
    'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {'
  );
  if (!out.includes('ExpoReactNativeFactoryProvider {')) {
    throw new Error(
      '[withUIScene] could not add ExpoReactNativeFactoryProvider to the AppDelegate ' +
        'declaration — the generated class line changed shape.'
    );
  }

  return out + SCENE_DELEGATE;
}

const withUIScene = (config) => {
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const name = cfg.modRequest.projectName;
      const file = path.join(cfg.modRequest.platformProjectRoot, name, 'AppDelegate.swift');
      fs.writeFileSync(file, patchAppDelegate(fs.readFileSync(file, 'utf8')));
      return cfg;
    },
  ]);

  config = withInfoPlist(config, (cfg) => {
    cfg.modResults.UIApplicationSceneManifest = {
      // One window, as before. Multiple scenes would mean multiple React roots,
      // which is a product decision rather than a migration step.
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          {
            UISceneConfigurationName: 'Default Configuration',
            // $(PRODUCT_MODULE_NAME) so the Swift class resolves whatever the
            // target ends up being called.
            UISceneDelegateClassName: `$(PRODUCT_MODULE_NAME).${SCENE_CLASS}`,
          },
        ],
      },
    };
    return cfg;
  });

  return config;
};

module.exports = withUIScene;
// Exported for scripts/test-plugin.js — the string transform is the risky part
// and is testable without running a prebuild.
module.exports.patchAppDelegate = patchAppDelegate;
module.exports.MARKER = MARKER;
module.exports.SCENE_CLASS = SCENE_CLASS;
