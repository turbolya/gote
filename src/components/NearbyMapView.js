// The Nearby screen's map: tap to drop a pin, a circle for the search radius.
// iOS only — Android gets NearbyMapView.android.js, which draws nothing, so the
// Android bundle never loads react-native-maps (it links Google Play Services).

import React, { forwardRef } from 'react';
import MapView, { Marker, Circle } from 'react-native-maps';

const NearbyMapView = forwardRef(function NearbyMapView(
  { style, initialRegion, place, radiusKm, strokeColor, onPress, onMarkerDragEnd },
  ref
) {
  return (
    <MapView ref={ref} style={style} initialRegion={initialRegion} onPress={onPress}>
      {place && (
        <>
          <Marker
            coordinate={{ latitude: place.lat, longitude: place.lng }}
            draggable
            onDragEnd={onMarkerDragEnd}
          />
          <Circle
            center={{ latitude: place.lat, longitude: place.lng }}
            radius={radiusKm * 1000}
            strokeColor={strokeColor}
            strokeWidth={2}
            fillColor="rgba(0,138,172,0.15)"
          />
        </>
      )}
    </MapView>
  );
});

export default NearbyMapView;
