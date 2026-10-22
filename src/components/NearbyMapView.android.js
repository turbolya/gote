// The Nearby screen's map on Android: MapLibre with OpenFreeMap tiles (see
// mapstyle.js). iOS keeps react-native-maps (NearbyMapView.js); Android cannot,
// because that library links Google Play Services, which F-Droid cannot ship.
//
// Same props as the iOS component, so the screen does not care which it got:
// tap to drop a pin, a circle for the search radius, and a ref with
// animateToRegion(). The one difference: the pin is not draggable here — tap
// the map again to move it.

import React, { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import {
  Map as MapLibreMap,
  Camera,
  GeoJSONSource,
  Layer,
  ViewAnnotation,
} from '@maplibre/maplibre-react-native';
import { MAP_STYLE_URL } from '../mapstyle';
import { circlePolygon, regionToBounds } from '../geo';

const PAD = { top: 12, right: 12, bottom: 12, left: 12 };

const NearbyMapView = forwardRef(function NearbyMapView(
  { style, initialRegion, place, radiusKm, strokeColor, onPress },
  ref
) {
  const cameraRef = useRef(null);

  useImperativeHandle(
    ref,
    () => ({
      // Same call the iOS map takes: a { latitude, longitude, latitudeDelta,
      // longitudeDelta } region and a duration in ms.
      animateToRegion: (region, duration = 350) => {
        cameraRef.current?.fitBounds(regionToBounds(region), { padding: PAD, duration });
      },
    }),
    []
  );

  const circle = useMemo(
    () => (place ? circlePolygon(place.lat, place.lng, radiusKm) : null),
    [place, radiusKm]
  );

  return (
    <MapLibreMap
      style={style}
      mapStyle={MAP_STYLE_URL}
      compass={false}
      onPress={(e) => {
        if (!onPress) return;
        const [longitude, latitude] = e.nativeEvent.lngLat;
        // The shape the screen already reads from react-native-maps.
        onPress({ nativeEvent: { coordinate: { latitude, longitude } } });
      }}
    >
      <Camera
        ref={cameraRef}
        initialViewState={{ bounds: regionToBounds(initialRegion), padding: PAD }}
      />
      {circle && (
        <GeoJSONSource id="radius" data={circle}>
          <Layer
            id="radius-fill"
            type="fill"
            paint={{ 'fill-color': strokeColor, 'fill-opacity': 0.15 }}
          />
          <Layer
            id="radius-line"
            type="line"
            paint={{ 'line-color': strokeColor, 'line-width': 2 }}
          />
        </GeoJSONSource>
      )}
      {place && (
        <ViewAnnotation id="pin" lngLat={[place.lng, place.lat]}>
          <View style={[styles.pin, { backgroundColor: strokeColor }]} />
        </ViewAnnotation>
      )}
    </MapLibreMap>
  );
});

const styles = StyleSheet.create({
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
  },
});

export default NearbyMapView;
