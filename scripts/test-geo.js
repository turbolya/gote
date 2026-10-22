// Tests for src/geo.js — the radius circle and region→bounds helpers behind the
// Android (MapLibre) map.
//
//   node scripts/test-geo.js   (or via: npm test)

const assert = require('assert');

// geo.js is an ES module (the app is bundled by Metro); load it through a tiny
// CommonJS shim rather than adding a transpiler to the test run.
const fs = require('fs');
const path = require('path');
const source = fs
  .readFileSync(path.join(__dirname, '..', 'src', 'geo.js'), 'utf8')
  .replace(/export function/g, 'function');
const { circlePolygon, regionToBounds } = new Function(
  `${source}; return { circlePolygon, regionToBounds };`
)();

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

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const rad = (d) => (d * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(a));
};

test('every point of the circle is the requested distance from the centre', () => {
  for (const [lat, lng, km] of [[47.5, 19.04, 50], [-33.9, 151.2, 2.5], [64.1, -21.9, 500], [0, 0, 100]]) {
    const ring = circlePolygon(lat, lng, km).geometry.coordinates[0];
    for (const [pLng, pLat] of ring) {
      const d = haversineKm(lat, lng, pLat, pLng);
      assert.ok(Math.abs(d - km) / km < 0.002, `${km} km circle at ${lat},${lng}: point is ${d.toFixed(3)} km away`);
    }
  }
});

test('the ring is closed and has steps + 1 points', () => {
  const ring = circlePolygon(10, 20, 5, 32).geometry.coordinates[0];
  assert.strictEqual(ring.length, 33);
  assert.deepStrictEqual(ring[0], ring[ring.length - 1]);
});

test('it is a GeoJSON Polygon feature', () => {
  const f = circlePolygon(10, 20, 5);
  assert.strictEqual(f.type, 'Feature');
  assert.strictEqual(f.geometry.type, 'Polygon');
  assert.strictEqual(f.geometry.coordinates.length, 1);
});

test('a circle over the antimeridian stays continuous (longitudes are not wrapped)', () => {
  const ring = circlePolygon(0, 179.9, 100).geometry.coordinates[0];
  for (let i = 1; i < ring.length; i++) {
    assert.ok(Math.abs(ring[i][0] - ring[i - 1][0]) < 5, 'adjacent points must not jump across the world');
  }
  assert.ok(Math.max(...ring.map((p) => p[0])) > 180);
});

test('regionToBounds turns a region into [west, south, east, north]', () => {
  const b = regionToBounds({ latitude: 10, longitude: 20, latitudeDelta: 4, longitudeDelta: 6 });
  assert.deepStrictEqual(b, [17, 8, 23, 12]);
});

test('regionToBounds clamps latitude so the whole-world default stays valid', () => {
  const b = regionToBounds({ latitude: 0, longitude: 0, latitudeDelta: 200, longitudeDelta: 100 });
  assert.strictEqual(b[1], -85);
  assert.strictEqual(b[3], 85);
  assert.deepStrictEqual([b[0], b[2]], [-50, 50]);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
