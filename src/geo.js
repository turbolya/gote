// Small geographic helpers for the Android map (MapLibre), which has no
// "circle with a radius in metres" the way react-native-maps does.

const EARTH_RADIUS_KM = 6371;
const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

// A GeoJSON polygon approximating the circle of `radiusKm` around a point.
// The ring is closed (first point repeated). Longitudes are NOT wrapped to
// ±180, so a circle crossing the antimeridian stays one continuous ring that
// the renderer draws across the seam instead of as a streak across the world.
export function circlePolygon(lat, lng, radiusKm, steps = 64) {
  const angular = radiusKm / EARTH_RADIUS_KM;
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const bearing = (2 * Math.PI * i) / steps;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angular) +
        Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
    );
    const lng2 =
      lng1 +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
        Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
      );
    ring.push([toDeg(lng2), toDeg(lat2)]);
  }
  ring[ring.length - 1] = ring[0].slice();
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [ring] },
  };
}

// A react-native-maps style region ({ latitude, longitude, latitudeDelta,
// longitudeDelta }) as MapLibre bounds [west, south, east, north]. Latitude is
// clamped to what Web Mercator can show, so the "whole world" default view
// stays valid.
export function regionToBounds(region) {
  const MAX_LAT = 85;
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  return [
    region.longitude - halfLng,
    Math.max(-MAX_LAT, region.latitude - halfLat),
    region.longitude + halfLng,
    Math.min(MAX_LAT, region.latitude + halfLat),
  ];
}
