// A reusable fullscreen photo viewer: a horizontally-paged, pinch-zoomable set
// of images. Used by the "Pick the right one" tiles for both "zoom this photo"
// (one image) and "other photos of this species" (several). Core RN only
// (Modal + ScrollView pinch-zoom + paged FlatList) so it works in Expo Go.

import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  Modal,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Dimensions,
  StyleSheet,
} from 'react-native';
import Icon from './Icon';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function PhotoViewer({
  visible,
  photos = [],
  title,
  loading = false,
  startIndex = 0,
  onClose,
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
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
              length: SCREEN_W,
              offset: SCREEN_W * i,
              index: i,
            })}
            keyExtractor={(uri, i) => `${i}-${uri}`}
            showsHorizontalScrollIndicator={false}
            renderItem={({ item }) => (
              <ScrollView
                style={styles.page}
                contentContainerStyle={styles.pageContent}
                maximumZoomScale={4}
                minimumZoomScale={1}
                bouncesZoom
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image source={{ uri: item }} style={styles.img} resizeMode="contain" />
              </ScrollView>
            )}
          />
        )}

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
  backdrop: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  emptyText: { color: 'rgba(255,255,255,0.7)', fontSize: 15 },
  page: { width: SCREEN_W },
  pageContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  img: { width: SCREEN_W, height: SCREEN_H },
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
