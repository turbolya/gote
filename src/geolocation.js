// "Where am I" for the Nearby screen: { lat, lng } from the device.
//
// iOS (and anywhere without a platform file) uses expo-location. Android uses
// geolocation.android.js, which avoids it: expo-location links Google Play
// Services, which F-Droid cannot ship.
//
// Rejects with err.code === 'denied' when the permission is refused; any other
// rejection means a fix could not be had.

import * as Location from 'expo-location';

export async function getCurrentCoords() {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw Object.assign(new Error('Location permission denied'), { code: 'denied' });
  }
  const pos = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  });
  return { lat: pos.coords.latitude, lng: pos.coords.longitude };
}
