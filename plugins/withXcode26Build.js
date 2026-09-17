// Keep an iOS build working on current Xcode.
//
// The name is historical: it started as the Xcode 26 fix and has since had to
// cover Xcode 27 as well. Everything here has to be fixed in the generated
// `ios/` tree — which `expo prebuild` regenerates, so hand-applying any of it
// lasts exactly until the next clean prebuild. That is what this plugin is for.
//
// Note the two halves apply differently, on purpose. The Xcode 26 fixes are
// workarounds for whatever compiler is on THIS machine, so they are skipped on
// the cloud builder, whose Xcode is pinned older. The deployment-target floor
// below is not a workaround at all — it is stale metadata that any Xcode 27+
// rejects — so it applies everywhere, or cloud builds break the day EAS bumps
// its image.
//
//   1. Prebuilt React Native core + Xcode 26 fails to link: "SwiftUICore not an
//      allowed client" with the debug dylib on, or missing facebook::react::
//      debug symbols with it off. Fixed by building RN from source
//      (ios.buildReactNativeFromSource).
//   2. Building from source then hits fmt 11.0.2's consteval path:
//      "FMT_STRING ... not a constant expression". Fixed by forcing
//      FMT_USE_CONSTEVAL to 0 in fmt's base.h. That file only exists once pods
//      are installed, which is AFTER a config plugin has run — so the patch is
//      injected as a Podfile post_install hook and applies itself on every pod
//      install instead.
//
// NOT applied on the EAS cloud builder by default. Its Xcode is pinned older,
// where prebuilt RN links fine, and building RN from source there would add a
// long compile to every cloud build for no benefit. So cloud output stays
// byte-identical to what it was before this plugin existed, and only local
// builds (including `eas build --local`) take the workaround.
//
//   GOTE_RN_FROM_SOURCE=1  force it on  (e.g. to reproduce a local build in CI)
//   GOTE_RN_FROM_SOURCE=0  force it off (e.g. once Xcode ships a fix)

const { withPodfileProperties, withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Marker so a second prebuild doesn't stack a second copy of the hook.
const MARKER = '# [gote] Xcode 26 fmt consteval fix';

const HOOK = `
    ${MARKER} — see plugins/withXcode26Build.js.
    # fmt 11.0.2's consteval path fails to compile under Apple clang 21 once RN
    # is built from source. Patch the header rather than passing -D: base.h
    # defines FMT_USE_CONSTEVAL itself, so a command-line define loses to it.
    # Runs on every pod install, so a reinstall cannot reintroduce the error.
    fmt_base = File.join(__dir__, 'Pods', 'fmt', 'include', 'fmt', 'base.h')
    if File.exist?(fmt_base)
      src = File.read(fmt_base)
      patched = src.gsub(/define\\s+FMT_USE_CONSTEVAL\\s+1/, 'define FMT_USE_CONSTEVAL 0')
      if patched != src
        File.write(fmt_base, patched)
        Pod::UI.puts '[gote] Patched fmt base.h: FMT_USE_CONSTEVAL -> 0 (Xcode 26 fix)'
      end
    end
`;

// --- Xcode 27: the deployment-target floor --------------------------------------

// Xcode 27 refuses to build a target whose IPHONEOS_DEPLOYMENT_TARGET is below
// 15.0. Several pods still declare 11.0–13.4 in their podspecs — mostly on the
// generated resource-bundle targets nobody sets by hand — and the build fails
// with one error per offender before a line is compiled.
//
// The app itself has been 15.1 since SDK 54, so this raises stale pod metadata
// to what the app already requires. It lowers nothing and cannot change the
// minimum iOS version the store sees.
const FLOOR_MARKER = '# [gote] deployment-target floor';

const FLOOR_HOOK = `
    ${FLOOR_MARKER} — see plugins/withXcode26Build.js.
    # Xcode 27 rejects any target below iOS 15.0, and several pods still ship
    # podspecs declaring 11.0-13.4. Raise those to the app's own minimum; pods
    # already at or above it are left alone.
    installer.pods_project.targets.each do |t|
      t.build_configurations.each do |cfg|
        current = cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && current.to_f < 15.1
          cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '15.1'
        end
      end
    end
`;

// Insert the floor hook. Same anchoring as patchPodfile, and same reason for
// being loud if the template moves: a build that silently loses this fails much
// later with a wall of unrelated-looking errors.
function patchPodfileFloor(contents) {
  if (contents.includes(FLOOR_MARKER)) return contents;
  const anchor = /(post_install do \|installer\|\n)/;
  if (!anchor.test(contents)) {
    throw new Error(
      '[withXcode26Build] no `post_install do |installer|` block in the Podfile — ' +
        'the generated template changed, so the deployment-target floor would be ' +
        'silently dropped.'
    );
  }
  return contents.replace(anchor, `$1${FLOOR_HOOK}`);
}

// Should the workaround apply to this build?
//
// Deliberately a function of the environment rather than of the machine: the
// question is "will this compile on a pinned older Xcode or on whatever is
// installed here", and only the build runner knows that.
function shouldApply(env = process.env) {
  if (env.GOTE_RN_FROM_SOURCE === '1') return true;
  if (env.GOTE_RN_FROM_SOURCE === '0') return false;
  // 'eas-build' is the cloud builder; 'local-build-plugin' is `eas build --local`,
  // which runs on this machine and therefore needs the workaround.
  return env.EAS_BUILD_RUNNER !== 'eas-build';
}

// Insert the hook at the top of the Podfile's post_install block. Anchored on
// `post_install do |installer|` rather than on the react_native_post_install
// call below it, because that call's argument list changes between SDK versions
// and this line has not. Position inside the block does not matter: pods are on
// disk before any of it runs.
function patchPodfile(contents) {
  if (contents.includes(MARKER)) return contents; // already patched
  const anchor = /(post_install do \|installer\|\n)/;
  if (!anchor.test(contents)) {
    throw new Error(
      '[withXcode26Build] no `post_install do |installer|` block in the Podfile — ' +
        'the generated template changed, so the fmt fix would be silently dropped.'
    );
  }
  return contents.replace(anchor, `$1${HOOK}`);
}

const withXcode26Build = (config) => {
  // Unconditional: see the note at the top. This one is not about the local
  // compiler, so gating it would hide the problem until EAS moves to Xcode 27.
  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      fs.writeFileSync(podfile, patchPodfileFloor(fs.readFileSync(podfile, 'utf8')));
      return cfg;
    },
  ]);

  if (!shouldApply()) return config;

  config = withPodfileProperties(config, (cfg) => {
    cfg.modResults['ios.buildReactNativeFromSource'] = 'true';
    return cfg;
  });

  config = withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfile = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      // Loud on purpose. Everything else here degrades quietly, but a build that
      // silently loses this fix fails much later with a confusing compiler error.
      fs.writeFileSync(podfile, patchPodfile(fs.readFileSync(podfile, 'utf8')));
      return cfg;
    },
  ]);

  return config;
};

module.exports = withXcode26Build;
// Exported for scripts/test-plugin.js — the string transform is the part worth
// testing, and it can be tested without running a prebuild.
module.exports.patchPodfile = patchPodfile;
module.exports.patchPodfileFloor = patchPodfileFloor;
module.exports.FLOOR_MARKER = FLOOR_MARKER;
module.exports.shouldApply = shouldApply;
module.exports.MARKER = MARKER;
