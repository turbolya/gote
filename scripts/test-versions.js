// Keeps the version fields in step, and the F-Droid listing with them.
//
// The version lives in four places that are edited by hand on every release:
// package.json, app.json, src/changelog.js (APP_VERSION) and Android's
// versionCode. F-Droid additionally wants a changelog file named after the
// versionCode, and a versionCode that only ever goes up. The formula below makes
// the last one automatic: major*10000 + minor*100 + patch, so 2.46.0 is 24600 and
// 2.46.1 is 24601 — monotonic as long as minor and patch stay under 100.
//
//   node scripts/test-versions.js   (or via: npm test)

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(root, ...p), 'utf8');

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

const pkg = JSON.parse(read('package.json'));
const app = JSON.parse(read('app.json')).expo;
const changelogVersion = (read('src', 'changelog.js').match(/APP_VERSION\s*=\s*'([^']+)'/) || [])[1];
const [major, minor, patch] = pkg.version.split('.').map(Number);
const expectedCode = major * 10000 + minor * 100 + patch;
const listing = path.join(root, 'fastlane', 'metadata', 'android', 'en-US');

test('package.json, app.json and the changelog agree on the version', () => {
  assert.strictEqual(app.version, pkg.version);
  assert.strictEqual(changelogVersion, pkg.version);
});

test('the first changelog entry is the current version', () => {
  const first = (read('src', 'changelog.js').match(/version:\s*'([^']+)'/) || [])[1];
  assert.strictEqual(first, pkg.version);
});

test('the version is plain major.minor.patch, each part under 100 where it matters', () => {
  assert.ok(/^\d+\.\d+\.\d+$/.test(pkg.version), pkg.version);
  assert.ok(minor < 100 && patch < 100, 'the versionCode formula needs minor and patch under 100');
});

test('android.versionCode follows major*10000 + minor*100 + patch', () => {
  assert.strictEqual(app.android.versionCode, expectedCode);
});

test('there is an F-Droid changelog named after the versionCode, within 500 bytes', () => {
  const file = path.join(listing, 'changelogs', `${expectedCode}.txt`);
  assert.ok(fs.existsSync(file), `missing ${path.relative(root, file)}`);
  assert.ok(Buffer.byteLength(fs.readFileSync(file, 'utf8')) <= 500, 'F-Droid truncates changelogs at 500 bytes');
});

test('the F-Droid text fields are within the store limits', () => {
  const len = (f) => [...fs.readFileSync(path.join(listing, f), 'utf8').trim()].length;
  assert.ok(len('title.txt') <= 30, 'title');
  assert.ok(len('short_description.txt') <= 80, 'short description');
  assert.ok(len('full_description.txt') <= 4000, 'full description');
});

test('the F-Droid listing has an icon and at least two phone screenshots', () => {
  assert.ok(fs.existsSync(path.join(listing, 'images', 'icon.png')));
  const shots = fs.readdirSync(path.join(listing, 'images', 'phoneScreenshots'));
  assert.ok(shots.length >= 2, `${shots.length} screenshots`);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
