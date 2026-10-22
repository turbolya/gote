// Android version of ObservationMap: the same fullscreen modal as
// ObservationMap.js, with MapLibre and OpenFreeMap tiles (see mapstyle.js)
// instead of react-native-maps, which links Google Play Services — F-Droid
// cannot ship that. Keep the chrome (close button, caption) in step with the
// iOS file.

import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Map as MapLibreMap,
  Camera,
  ViewAnnotation,
} from '@maplibre/maplibre-react-native';
import Icon from './Icon';
import { MAP_STYLE_URL } from '../mapstyle';

// Degrees either side of the pin: a few-km span so the surroundings give
// context without pinpointing a precise spot (also kind to obscured
// coordinates). Half of the iOS file's SPAN, which is the full width.
const HALF_SPAN = 0.04;

export default function ObservationMap({ visible, lat, lng, placeGuess, title, onClose }) {
  const insets = useSafeAreaInsets();
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);

  return (
    <Modal
      visible={visible && hasCoords}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      transparent={false}
    >
      <View style={styles.root}>
        {hasCoords && (
          <MapLibreMap
            style={StyleSheet.absoluteFill}
            mapStyle={MAP_STYLE_URL}
            compass={false}
          >
            <Camera
              initialViewState={{
                bounds: [lng - HALF_SPAN, lat - HALF_SPAN, lng + HALF_SPAN, lat + HALF_SPAN],
              }}
            />
            <ViewAnnotation id="observation" lngLat={[lng, lat]}>
              <View style={styles.pin} />
            </ViewAnnotation>
          </MapLibreMap>
        )}

        {/* Close button, floated top-left over the map (clear of the notch). */}
        <Pressable
          testID="obs-map-close"
          onPress={onClose}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Close map"
          style={[styles.closeBtn, { top: insets.top + 12 }]}
        >
          <Icon name="x" size={22} color="#111" />
        </Pressable>

        {/* Caption: species name + place, floated along the bottom. */}
        {(title || placeGuess) && (
          <View style={[styles.caption, { bottom: insets.bottom + 20 }]}>
            {!!title && <Text style={styles.captionTitle}>{title}</Text>}
            {!!placeGuess && (
              <Text style={styles.captionPlace} numberOfLines={2}>
                <Icon name="map-pin" size={13} color="rgba(255,255,255,0.85)" /> {placeGuess}
              </Text>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  pin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#fff',
    backgroundColor: '#d63a3a',
  },
  closeBtn: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  caption: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  captionTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  captionPlace: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 4,
  },
});
