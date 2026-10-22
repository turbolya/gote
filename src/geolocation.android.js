// Android "where am I": the platform's LocationManager through our own small
// native module (modules/gote-location), with the permission prompt from
// React Native's PermissionsAndroid. See geolocation.js for why not
// expo-location. Coarse location only — all "species near you" needs.

import { PermissionsAndroid } from 'react-native';
import GoteLocation from '../modules/gote-location';

const FIX_TIMEOUT_MS = 15000;

export async function getCurrentCoords() {
  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
  );
  if (result !== PermissionsAndroid.RESULTS.GRANTED) {
    throw Object.assign(new Error('Location permission denied'), { code: 'denied' });
  }
  if (!GoteLocation) throw new Error('Location is unavailable');
  const pos = await GoteLocation.getCurrentPosition(FIX_TIMEOUT_MS);
  return { lat: pos.latitude, lng: pos.longitude };
}
