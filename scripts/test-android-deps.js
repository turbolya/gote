// Guards the F-Droid build against Google Play Services creeping back in.
//
// F-Droid cannot ship proprietary libraries, and three of our dependencies link
// them (expo-location, react-native-maps) or fetch code from outside the repo
// (expo-updates). The Android build therefore never links them: package.json
// excludes them from Android autolinking, and every file that imports one has a
// sibling *.android.js that doesn't, so the Android bundle never loads them
// either. These tests keep both halves true. Pure static checks — no prebuild.
//
//   node scripts/test-android-deps.js   (or via: npm test)

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const BANNED = ['expo-location', 'expo-updates', 'react-native-maps'];

let pass = 0;
let fail = 0;
function test(name, fn) {
  try {
    fn();
    pass++;
    console.log('  ok  ', name);
  } catch (e) {
    fail++;
    console.log('  FAIL', name, '\n      ', e.message);
  }
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(js|jsx|ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

const imports = (file) => {
  const text = fs.readFileSync(file, 'utf8');
  return BANNED.filter((name) =>
    new RegExp(`(from|require\\()\\s*['"]${name}(/[^'"]*)?['"]`).test(text)
  );
};

const files = [
  path.join(root, 'App.js'),
  path.join(root, 'index.js'),
  ...sourceFiles(path.join(root, 'src')),
  ...sourceFiles(path.join(root, 'modules')),
];

const androidSibling = (file) => file.replace(/\.(js|jsx|ts|tsx)$/, '.android.$1');

test('package.json excludes the banned modules from Android autolinking', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const exclude = (((pkg.expo || {}).autolinking || {}).android || {}).exclude || [];
  for (const name of BANNED) {
    assert.ok(exclude.includes(name), `${name} is not in expo.autolinking.android.exclude`);
  }
});

test('the exclusion is Android-only (iOS still links them)', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const autolinking = (pkg.expo || {}).autolinking || {};
  assert.ok(!autolinking.exclude, 'a global exclude would drop them from iOS too');
});

test('no Android-reachable file imports a banned module', () => {
  const offenders = files
    .filter((f) => !/\.(ios|web)\.(js|jsx|ts|tsx)$/.test(f) && !/\.android\.(js|jsx|ts|tsx)$/.test(f))
    .filter((f) => imports(f).length > 0)
    .filter((f) => !fs.existsSync(androidSibling(f)))
    .map((f) => `${path.relative(root, f)} imports ${imports(f).join(', ')}`);
  assert.deepStrictEqual(offenders, [], `needs a .android.js sibling:\n        ${offenders.join('\n        ')}`);
});

test('no *.android.js file imports a banned module', () => {
  const offenders = files
    .filter((f) => /\.android\.(js|jsx|ts|tsx)$/.test(f))
    .filter((f) => imports(f).length > 0)
    .map((f) => path.relative(root, f));
  assert.deepStrictEqual(offenders, []);
});

// MapLibre draws the Android map. iOS keeps react-native-maps, so it must not be
// linked there (an extra native library nobody calls) and nothing outside an
// *.android.js file may import it (the iOS bundle would then need it).
const ANDROID_ONLY = ['@maplibre/maplibre-react-native'];

test('MapLibre is excluded from iOS autolinking', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const exclude = (((pkg.expo || {}).autolinking || {}).ios || {}).exclude || [];
  for (const name of ANDROID_ONLY) {
    assert.ok(exclude.includes(name), `${name} is not in expo.autolinking.ios.exclude`);
  }
});

test('only *.android.js files import MapLibre', () => {
  const offenders = files
    .filter((f) => !/\.android\.(js|jsx|ts|tsx)$/.test(f))
    .filter((f) =>
      ANDROID_ONLY.some((name) =>
        new RegExp(`(from|require\\()\\s*['"]${name}(/[^'"]*)?['"]`).test(fs.readFileSync(f, 'utf8'))
      )
    )
    .map((f) => path.relative(root, f));
  assert.deepStrictEqual(offenders, [], 'these would pull MapLibre into the iOS bundle');
});

test('the Android location helper uses the local native module', () => {
  const text = fs.readFileSync(path.join(root, 'src', 'geolocation.android.js'), 'utf8');
  assert.ok(text.includes("from '../modules/gote-location'"));
});

test('the local location module is Android-only', () => {
  const config = JSON.parse(
    fs.readFileSync(path.join(root, 'modules', 'gote-location', 'expo-module.config.json'), 'utf8')
  );
  assert.deepStrictEqual(config.platforms, ['android']);
});

test('app.config.js leaves normal builds exactly as app.json', () => {
  delete require.cache[require.resolve('../app.config.js')];
  const saved = process.env.FDROID;
  delete process.env.FDROID;
  const base = { plugins: ['x', ['@config-plugins/detox']] };
  const out = require('../app.config.js')({ config: base });
  process.env.FDROID = saved === undefined ? '' : saved;
  if (saved === undefined) delete process.env.FDROID;
  assert.strictEqual(out, base);
});

test('FDROID=1 drops detox and disables updates, keeping the other plugins', () => {
  delete require.cache[require.resolve('../app.config.js')];
  const saved = process.env.FDROID;
  process.env.FDROID = '1';
  const base = {
    plugins: ['expo-font', ['@config-plugins/detox'], ['expo-location', { a: 1 }]],
  };
  const out = require('../app.config.js')({ config: base });
  delete require.cache[require.resolve('../app.config.js')];
  if (saved === undefined) delete process.env.FDROID;
  else process.env.FDROID = saved;
  assert.deepStrictEqual(out.plugins, ['expo-font', ['expo-location', { a: 1 }]]);
  assert.strictEqual(out.updates.enabled, false);
  assert.strictEqual(base.plugins.length, 3, 'the input config must not be mutated');
});

// Sync stays off in the F-Droid build (a decision for the first submission, see
// docs/FDROID.md): the recipe must not bake in Supabase credentials, and the
// listing must not promise a feature the build does not have.
test('the F-Droid recipe leaves sync off', () => {
  const recipe = fs.readFileSync(path.join(root, 'docs', 'fdroid', 'com.gote.app.yml'), 'utf8');
  const lines = recipe.split('\n').filter((l) => !/^\s*(#|MaintainerNotes)/.test(l));
  const set = lines.filter((l) => /^\s*-\s.*EXPO_PUBLIC_SUPABASE/.test(l));
  assert.deepStrictEqual(set, [], 'a prebuild step sets Supabase credentials');
});

test('the F-Droid listing does not promise sync', () => {
  const dir = path.join(root, 'fastlane', 'metadata', 'android', 'en-US');
  for (const f of ['full_description.txt', 'short_description.txt']) {
    const text = fs.readFileSync(path.join(dir, f), 'utf8');
    assert.ok(!/sync|supabase/i.test(text), `${f} mentions sync or Supabase`);
  }
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
