// A reusable fullscreen photo viewer: a horizontally-paged set of images, each
// pinch-zoomable, pan-when-zoomed, and double-tap to toggle zoom. Cross-platform
// (iOS + Android) via react-native-gesture-handler + reanimated. Used by the
// "Pick the right one" tiles and the species/study photo galleries.
//
// Two ways in, because two things are being asked for:
//   • Straight to one photo (`grid` off) — "show me THIS one bigger", which is
//     what a double-tap on a card or a tap on a tile means.
//   • A scrollable grid first (`grid` on) — "show me the other photos", where
//     the point is to see the set. Picking one opens it full-screen, and back
//     returns to the grid rather than dumping the user out of the viewer.
//
// A photo shown full-screen carries its credit. iNaturalist photos are licensed
// individually by the people who took them, and a picture filling the screen
// with no attribution is the one place that reads as the app's own.

import React, { useEffect, useRef, useState } from 'react';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Icon from './Icon';
import { Spinner } from './LoadingImage';
import { Appear } from './anim';
import { photoCredit, toSmallPhoto } from '../api';

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
  // Spinner until the full-size photo arrives (a failed load clears it too, so
  // a broken photo doesn't spin forever).
  const [loaded, setLoaded] = useState(false);
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
          onLoad={() => setLoaded(true)}
          onError={() => setLoaded(true)}
        />
        {/* Sibling overlay rather than a wrapper: the image carries the pinch/
            pan transform, so nesting it would fight the gesture handling. */}
        {!loaded && (
          <View style={styles.pageSpinner} pointerEvents="none">
            <Spinner size={56} />
          </View>
        )}
      </Animated.View>
    </GestureDetector>
  );
}

// One thumbnail in the grid. Its own component so a re-render of the grid (a
// photo loading, the credit changing) doesn't reset every cell's image.
function GridCell({ uri, size, onPress, index }) {
  return (
    <Pressable
      testID={`photo-cell-${index}`}
      onPress={onPress}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Photo ${index + 1}`}
      style={({ pressed }) => [
        styles.cell,
        { width: size, height: size },
        pressed && styles.cellPressed,
      ]}
    >
      <Image source={{ uri: toSmallPhoto(uri) }} style={styles.cellImage} resizeMode="cover" />
    </Pressable>
  );
}

export default function PhotoViewer({
  visible,
  photos = [],
  title,
  loading = false,
  startIndex = 0,
  grid = false,
  onClose,
}) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Horizontal paging is disabled while any page is zoomed in, so a pan drags
  // the image rather than flipping photos.
  const [paging, setPaging] = useState(true);
  // Null means the grid is up; a number means that photo is full-screen. A
  // viewer opened without `grid` is never null — there is no grid to go back to.
  const [page, setPage] = useState(grid ? null : startIndex);
  // Which photo the pager is on, for the credit footer. Tracked separately from
  // `page`, which only says where the pager STARTED.
  const [shown, setShown] = useState(startIndex);
  const listRef = useRef(null);

  // Opening again starts where the caller asked, not where the last visit left
  // off. Keyed on `visible` so it costs nothing while closed.
  useEffect(() => {
    if (!visible) return;
    setPage(grid ? null : startIndex);
    setShown(startIndex);
    setPaging(true);
  }, [visible, grid, startIndex]);

  // Back out one layer at a time: full-screen returns to the grid it came from,
  // and only the outermost layer closes. Android's hardware back and the
  // on-screen control share this, so they cannot disagree.
  const back = () => {
    if (grid && page !== null) setPage(null);
    else onClose();
  };

  // Thumbnails big enough to tell two photos of the same species apart, and a
  // count that suits the width — three across a phone, more on an iPad.
  const cols = Math.max(3, Math.min(6, Math.round(screenW / 130)));
  const cell = Math.floor((screenW - GRID_GAP * (cols + 1)) / cols);
  const credit = page !== null && photos.length ? photoCredit(photos[shown]) : null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={back}
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
        ) : page === null ? (
          <FlatList
            testID="photo-grid"
            data={photos}
            // numColumns cannot change on a live list, so a rotation that
            // changes the count remounts it rather than throwing.
            key={`cols-${cols}`}
            numColumns={cols}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            contentContainerStyle={[
              styles.gridContent,
              { paddingTop: insets.top + 96, paddingBottom: insets.bottom + 24 },
            ]}
            renderItem={({ item, index }) => (
              <GridCell uri={item} size={cell} index={index} onPress={() => {
                setShown(index);
                setPage(index);
              }} />
            )}
          />
        ) : (
          <FlatList
            ref={listRef}
            data={photos}
            horizontal
            pagingEnabled
            scrollEnabled={paging}
            initialScrollIndex={Math.min(page, photos.length - 1)}
            getItemLayout={(_, i) => ({
              length: screenW,
              offset: screenW * i,
              index: i,
            })}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            showsHorizontalScrollIndicator={false}
            // Which photo the credit belongs to. Momentum end rather than
            // onScroll: paging snaps, so this fires once per photo instead of
            // on every frame of the swipe.
            onMomentumScrollEnd={(e) => {
              const i = Math.round(e.nativeEvent.contentOffset.x / screenW);
              setShown(Math.max(0, Math.min(photos.length - 1, i)));
            }}
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
          <View
            style={[styles.titleBar, grid && page !== null && styles.titleBarInset]}
            pointerEvents="none"
          >
            <Text style={styles.title}>{title}</Text>
            {photos.length > 1 && (
              <Text style={styles.hint}>
                {page === null
                  ? `${photos.length} photos · tap to open`
                  : `${shown + 1} of ${photos.length} · swipe`}
              </Text>
            )}
          </View>
        )}

        {/* The credit for the photo filling the screen. Only full-screen: the
            grid shows several at once, and one line cannot honestly caption
            them all. */}
        {!!credit && (
          <View
            style={[styles.creditBar, { paddingBottom: insets.bottom + 14 }]}
            pointerEvents="none"
          >
            <Text testID="photo-credit" style={styles.creditText} numberOfLines={2}>
              {credit}
            </Text>
          </View>
        )}

        {/* Back to the grid, and close, as two separate controls: one X that
            meant "up a layer" here and "leave" there would be a coin toss every
            time. Only the viewer opened on a grid has anywhere to go back to. */}
        {grid && page !== null && (
          <Pressable
            testID="photo-back"
            style={styles.back}
            onPress={() => setPage(null)}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to all photos"
          >
            <Icon name="chevron-left" size={24} color="#fff" />
          </Pressable>
        )}

        <Pressable
          testID="photo-close"
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

// Hairline gutters: the grid is about seeing the photos, not the spaces.
const GRID_GAP = 3;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  page: { alignItems: 'center', justifyContent: 'center' },
  pageSpinner: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBar: {
    position: 'absolute',
    top: 52,
    left: 24,
    right: 70,
  },
  // Clears the back control when there is one.
  titleBarInset: { left: 72 },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  hint: { color: 'rgba(255,255,255,0.7)', fontSize: 13, marginTop: 2 },
  back: {
    position: 'absolute',
    top: 50,
    left: 18,
    width: 44,
    height: 44,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: { paddingHorizontal: GRID_GAP / 2 },
  cell: { margin: GRID_GAP / 2, borderRadius: 6, overflow: 'hidden', backgroundColor: '#111' },
  cellPressed: { opacity: 0.6 },
  cellImage: { width: '100%', height: '100%' },
  creditBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  creditText: { color: 'rgba(255,255,255,0.85)', fontSize: 12.5, lineHeight: 17 },
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
