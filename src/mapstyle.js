// Where the Android map gets its tiles. OpenFreeMap serves OpenStreetMap data
// with no account, API key or request limit (its public instance runs on
// donations, with no SLA); MapLibre adds the required "OpenFreeMap ©
// OpenMapTiles Data from OpenStreetMap" attribution itself.
//
// Using it means the tile host sees which area is being viewed — see
// PRIVACY.md. To switch provider (or self-host), change this one URL.

export const MAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty';
