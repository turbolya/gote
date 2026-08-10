// Tests for the Xcode 26 config plugin (plugins/withXcode26Build.js).
//
// The plugin exists because `expo prebuild` regenerates ios/, so the two fixes
// a local Xcode 26 build needs cannot live in that tree. Its risky parts are a
// string transform on the generated Podfile and the rule deciding when to apply
// at all — both testable here, without running a prebuild (which would wipe the
// working ios/ tree this machine builds from).
//
//   node scripts/test-plugin.js   (or via: npm test)

const assert = require('assert');
const plugin = require('../plugins/withXcode26Build');

const { patchPodfile, shouldApply, MARKER } = plugin;

// A Podfile shaped like the one Expo generates.
const PODFILE = `require File.join(File.dirname(\`node --print "require.resolve('expo/package.json')"\`), "scripts/autolinking")

target 'gote' do
  use_react_native!(
    :path => config[:reactNativePath],
  )

  post_install do |installer|
    react_native_post_install(
      installer,
      config[:reactNativePath],
      :mac_catalyst_enabled => false,
    )
  end
end
`;

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ', name);
  } catch (e) {
    fail++;
    console.log('  FAIL', name, '\n       ', e.message);
  }
}

console.log('\nXcode 26 config plugin\n');

test('the fmt fix is injected into the post_install block', () => {
  const out = patchPodfile(PODFILE);
  assert.ok(out.includes(MARKER), 'marker present');
  assert.ok(out.includes('FMT_USE_CONSTEVAL'), 'the patch is there');
  const at = out.indexOf(MARKER);
  const opens = out.indexOf('post_install do |installer|');
  const closes = out.indexOf('\n  end\nend');
  assert.ok(at > opens && at < closes, 'and it sits INSIDE post_install');
});

test('everything else in the Podfile is left alone', () => {
  const out = patchPodfile(PODFILE);
  for (const line of PODFILE.split('\n')) {
    if (line.trim()) assert.ok(out.includes(line), `lost a line: ${line}`);
  }
});

test('patching twice does not stack two copies', () => {
  // Prebuild runs more than once, and two copies of the hook would be harmless
  // but would make the Podfile grow without bound.
  const once = patchPodfile(PODFILE);
  const twice = patchPodfile(once);
  assert.strictEqual(twice, once, 'idempotent');
  assert.strictEqual(once.split(MARKER).length - 1, 1, 'exactly one copy');
});

test('the injected Ruby escapes its regex correctly', () => {
  // The hook is a JS template literal containing a Ruby regex. A single missed
  // backslash would emit `\s` as `s` and the patch would silently match nothing.
  const out = patchPodfile(PODFILE);
  assert.ok(
    out.includes("gsub(/define\\s+FMT_USE_CONSTEVAL\\s+1/, 'define FMT_USE_CONSTEVAL 0')"),
    'the Ruby regex survived JS escaping'
  );
});

test('a Podfile without the expected block fails loudly', () => {
  // Silently skipping would surface much later as an inscrutable compiler error.
  assert.throws(
    () => patchPodfile('target "gote" do\nend\n'),
    /no `post_install do \|installer\|` block/,
    'must throw, not shrug'
  );
});

test('applies on this machine, and on `eas build --local`', () => {
  assert.strictEqual(shouldApply({}), true, 'a plain local prebuild');
  assert.strictEqual(
    shouldApply({ EAS_BUILD_RUNNER: 'local-build-plugin' }),
    true,
    'eas build --local runs on this machine, so it needs the fix'
  );
});

test('does NOT apply on the EAS cloud builder', () => {
  // Its Xcode is pinned older, where prebuilt RN links fine. Applying it there
  // would add a full RN compile to every cloud build for nothing.
  assert.strictEqual(shouldApply({ EAS_BUILD_RUNNER: 'eas-build' }), false);
});

test('the env override wins in both directions', () => {
  assert.strictEqual(
    shouldApply({ EAS_BUILD_RUNNER: 'eas-build', GOTE_RN_FROM_SOURCE: '1' }),
    true,
    'forced on even in the cloud'
  );
  assert.strictEqual(
    shouldApply({ GOTE_RN_FROM_SOURCE: '0' }),
    false,
    'forced off locally — for when Xcode ships a fix'
  );
});

test('the plugin is a function config can use', () => {
  assert.strictEqual(typeof plugin, 'function');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
