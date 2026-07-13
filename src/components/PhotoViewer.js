// A reusable fullscreen photo viewer: a horizontally-paged, pinch-zoomable set
// of images. Used by the "Pick the right one" tiles for both "zoom this photo"
// (one image) and "other photos of this species" (several). Core RN only
// (Modal + ScrollView pinch-zoom + paged FlatList) so it works in Expo Go.

import React, { useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  ScrollView,
  FlatList,
  ActivityIndicator,
  useWindowDimensions,
  StyleSheet,
} from 'react-native';
import Icon from './Icon';
import { Appear } from './anim';

const DOUBLE_TAP_MS = 280;
const MAX_ZOOM = 5;
// Double-tap zoom level (a strong "zoom in to detail"; pinch can still go further).
const DOUBLE_TAP_ZOOM = 3;

// One swipeable page: pinch-to-zoom plus double-tap to toggle between fit-to-
// screen (1×) and a zoomed-in view centered on the tapped point. Sized from the
// live window dimensions (passed in) so it stays correct across rotation/resize.
function ZoomablePage({ uri, screenW, screenH }) {
  const scrollRef = useRef(null);
  const zoomedRef = useRef(false);
  const lastTap = useRef(0);

  const zoomTo = (scale, x, y) => {
    const responder = scrollRef.current?.getScrollResponder?.() || scrollRef.current;
    const zoom = responder?.scrollResponderZoomTo;
    if (typeof zoom !== 'function') return; // iOS-only API; no-op elsewhere
    if (scale <= 1) {
      zoom.call(responder, { x: 0, y: 0, width: screenW, height: screenH, animated: true });
      zoomedRef.current = false;
    } else {
      const w = screenW / scale;
      const h = screenH / scale;
      zoom.call(responder, {
        x: Math.max(0, x - w / 2),
        y: Math.max(0, y - h / 2),
        width: w,
        height: h,
        animated: true,
      });
      zoomedRef.current = true;
    }
  };

  const onTap = (e) => {
    const now = Date.now();
    const { locationX, locationY } = e.nativeEvent;
    if (now - lastTap.current < DOUBLE_TAP_MS) {
      lastTap.current = 0;
      zoomTo(zoomedRef.current ? 1 : DOUBLE_TAP_ZOOM, locationX, locationY);
    } else {
      lastTap.current = now;
    }
  };

  // Keep the toggle in sync if the user pinch-zooms manually.
  const onScroll = (e) => {
    zoomedRef.current = e.nativeEvent.zoomScale > 1.01;
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={[styles.page, { width: screenW }]}
      contentContainerStyle={styles.pageContent}
      maximumZoomScale={MAX_ZOOM}
      minimumZoomScale={1}
      bouncesZoom
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      onScroll={onScroll}
      scrollEventThrottle={16}
    >
      <Pressable onPress={onTap}>
        <Image source={{ uri }} style={{ width: screenW, height: screenH }} resizeMode="contain" />
      </Pressable>
    </ScrollView>
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
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
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
            data={photos}
            horizontal
            pagingEnabled
            initialScrollIndex={Math.min(startIndex, photos.length - 1)}
            getItemLayout={(_, i) => ({
              length: screenW,
              offset: screenW * i,
              index: i,
            })}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <ZoomablePage uri={item} screenW={screenW} screenH={screenH} />
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

        <Pressable style={styles.close} onPress={onClose} hitSlop={12}>
          <Icon name="x" size={22} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  page: { flex: 1 },
  pageContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
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
