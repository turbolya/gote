// A reusable fullscreen photo viewer: a horizontally-paged set of images, each
// pinch-zoomable, pan-when-zoomed, and double-tap to toggle zoom. Cross-platform
// (iOS + Android) via react-native-gesture-handler + reanimated. Used by the
// "Pick the right one" tiles and the species/study photo galleries.

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Icon from './Icon';
import { Appear } from './anim';

const DOUBLE_TAP_MS = 280;
const MAX_ZOOM = 5;
// Double-tap zoom level (a strong "zoom in to detail"; pinch can still go further).
const DOUBLE_TAP_ZOOM = 3;

// One swipeable, zoomable page. `onZoomChange(true|false)` tells the parent to
// disable horizontal paging while this page is zoomed in (so a pan drags the
// image instead of flipping to the next photo).
function ZoomablePage({ uri, screenW, screenH, onZoomChange }) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedTx = useSharedValue(0);
  const savedTy = useSharedValue(0);
  // JS-side mirror of "is this page zoomed", to enable the pan gesture and to
  // notify the parent (which toggles the FlatList's horizontal paging).
  const [zoomed, setZoomed] = useState(false);
  const notify = (z) => {
    setZoomed(z);
    if (onZoomChange) onZoomChange(z);
  };

  // Keep the image within bounds for the current scale (worklet).
  const clamp = () => {
    'worklet';
    const maxX = Math.max(0, (screenW * scale.value - screenW) / 2);
    const maxY = Math.max(0, (screenH * scale.value - screenH) / 2);
    tx.value = Math.min(maxX, Math.max(-maxX, tx.value));
    ty.value = Math.min(maxY, Math.max(-maxY, ty.value));
  };

  const resetZoom = () => {
    'worklet';
    scale.value = withTiming(1);
    savedScale.value = 1;
    tx.value = withTiming(0);
    ty.value = withTiming(0);
    savedTx.value = 0;
    savedTy.value = 0;
    runOnJS(notify)(false);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      'worklet';
      scale.value = Math.max(1, Math.min(MAX_ZOOM, savedScale.value * e.scale));
    })
    .onEnd(() => {
      'worklet';
      if (scale.value <= 1.01) {
        resetZoom();
      } else {
        savedScale.value = scale.value;
        clamp();
        savedTx.value = tx.value;
        savedTy.value = ty.value;
        runOnJS(notify)(true);
      }
    });

  // Pan only matters while zoomed; disabled otherwise so horizontal swipes page
  // between photos.
  const pan = Gesture.Pan()
    .enabled(zoomed)
    .onUpdate((e) => {
      'worklet';
      tx.value = savedTx.value + e.translationX;
      ty.value = savedTy.value + e.translationY;
    })
    .onEnd(() => {
      'worklet';
      clamp();
      savedTx.value = tx.value;
      savedTy.value = ty.value;
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDelay(DOUBLE_TAP_MS)
    .onEnd((e) => {
      'worklet';
      if (scale.value > 1.01) {
        resetZoom();
      } else {
        const target = DOUBLE_TAP_ZOOM;
        scale.value = withTiming(target);
        savedScale.value = target;
        // Shift toward the tapped point, clamped to bounds.
        const maxX = (screenW * target - screenW) / 2;
        const maxY = (screenH * target - screenH) / 2;
        const cx = Math.min(maxX, Math.max(-maxX, (screenW / 2 - e.x) * (target - 1)));
        const cy = Math.min(maxY, Math.max(-maxY, (screenH / 2 - e.y) * (target - 1)));
        tx.value = withTiming(cx);
        ty.value = withTiming(cy);
        savedTx.value = cx;
        savedTy.value = cy;
        runOnJS(notify)(true);
      }
    });

  const gesture = Gesture.Simultaneous(pinch, pan, doubleTap);

  const imgStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: tx.value },
      { translateY: ty.value },
      { scale: scale.value },
    ],
  }));

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.page, { width: screenW, height: screenH }]}>
        <Animated.Image
          source={{ uri }}
          style={[{ width: screenW, height: screenH }, imgStyle]}
          resizeMode="contain"
        />
      </Animated.View>
    </GestureDetector>
  );
}

export default function PhotoViewer({
  visible,
  photos = [],
  title,
  loading = false,
  startIndex = 0,
  onClose,
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  // Horizontal paging is disabled while any page is zoomed in, so a pan drags
  // the image rather than flipping photos.
  const [paging, setPaging] = useState(true);
  const listRef = useRef(null);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <GestureHandlerRootView style={styles.flex}>
      <View style={styles.backdrop}>
        <Appear style={styles.flex} offset={0} scaleFrom={0.92} duration={260}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        ) : photos.length === 0 ? (
          <View style={styles.center}>
            <Icon name="image" size={36} color="rgba(255,255,255,0.6)" />
            <Text style={styles.emptyText}>No other photos available</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={photos}
            horizontal
            pagingEnabled
            scrollEnabled={paging}
            initialScrollIndex={Math.min(startIndex, photos.length - 1)}
            getItemLayout={(_, i) => ({
              length: screenW,
              offset: screenW * i,
              index: i,
            })}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <ZoomablePage
                uri={item}
                screenW={screenW}
                screenH={screenH}
                onZoomChange={(z) => setPaging(!z)}
              />
            )}
          />
        )}
        </Appear>

        {!!title && photos.length > 0 && (
          <View style={styles.titleBar} pointerEvents="none">
            <Text style={styles.title}>{title}</Text>
            {photos.length > 1 && (
              <Text style={styles.hint}>{photos.length} photos · swipe</Text>
            )}
          </View>
        )}

        <Pressable
          style={styles.close}
          onPress={onClose}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Icon name="x" size={22} color="#fff" />
        </Pressable>
      </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  page: { alignItems: 'center', justifyContent: 'center' },
  titleBar: {
    position: 'absolute',
    top: 52,
    left: 24,
    right: 70,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  close: {
    position: 'absolute',
    top: 50,
    right: 24,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
