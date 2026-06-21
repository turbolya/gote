// Species detail page (opened from the Lexicon). Shows the user's own photo as
// a hero image, iNaturalist's curated photos in a horizontal strip, the
// taxonomy (named ancestors), and a Wikipedia summary. Detail beyond what the
// card holds is fetched lazily from the taxa API.

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import PhotoViewer from '../components/PhotoViewer';
import { useColors, useThemedStyles } from '../theme';
import { fetchTaxonDetail, toLargePhoto } from '../api';

// Ranks worth surfacing in the taxonomy block (skip the very fine sub-ranks).
const SHOWN_RANKS = ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species'];

const FLAG_ON = '#E0A800'; // amber for an active flag

export default function DetailScreen({ card, locale, flags, onToggleFlag, onBack }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const flagged = !!(flags && card.taxonId != null && flags.has(String(card.taxonId)));
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  // Index of the photo open in the fullscreen viewer (pinch-zoom + swipe), or
  // null when closed.
  const [viewerIndex, setViewerIndex] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setDetail(null);
    (async () => {
      const d = await fetchTaxonDetail(card.taxonId, locale);
      if (!cancelled) {
        setDetail(d);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [card.taxonId, locale]);

  const name = card.common || card.scientific;
  const ancestors = (detail?.ancestors || []).filter((a) =>
    SHOWN_RANKS.includes(a.rank)
  );
  // Curated photos minus the hero (avoid showing the same shot twice up top).
  const curated = (detail?.photos || []).filter((u) => u !== card.image);
  // The full set for the fullscreen viewer: the user's hero photo first, then
  // the curated strip — so the strip's photo at position i opens at index i + 1.
  const viewerPhotos = [card.image, ...curated].map(toLargePhoto);

  return (
    <View style={styles.flex}>
      {/* Hero image with floating back button */}
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Pressable
            testID="detail-hero"
            style={styles.heroImg}
            onPress={() => setViewerIndex(0)}
          >
            <Image
              source={{ uri: toLargePhoto(card.image) }}
              style={styles.heroImg}
              resizeMode="cover"
            />
          </Pressable>
          <Pressable testID="detail-back" onPress={onBack} hitSlop={12} style={styles.backFab}>
            <Icon name="chevron-left" size={24} color={colors.onDark} />
          </Pressable>
          {onToggleFlag && card.taxonId != null && (
            <Pressable
              testID="detail-flag"
              onPress={() => onToggleFlag(card.taxonId)}
              hitSlop={12}
              style={styles.flagFab}
            >
              <Icon
                name={flagged ? 'flag' : 'flag-outline'}
                size={22}
                color={flagged ? FLAG_ON : colors.onDark}
              />
            </Pressable>
          )}
        </View>

        <View style={styles.body}>
          <Text style={styles.name}>{name}</Text>
          {card.common ? (
            <Text style={styles.sci}>{card.scientific}</Text>
          ) : null}
          {!!card.rank && (
            <Text style={styles.rank}>{card.rank.toUpperCase()}</Text>
          )}

          {/* Curated photos */}
          {curated.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>More photos</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.stripContent}
              >
                {curated.map((uri, i) => (
                  <Pressable
                    key={uri}
                    testID={`detail-photo-${i}`}
                    onPress={() => setViewerIndex(i + 1)}
                  >
                    <Image source={{ uri }} style={styles.stripImg} />
                  </Pressable>
                ))}
              </ScrollView>
            </>
          )}

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading details…</Text>
            </View>
          )}

          {/* Description */}
          {detail?.summary ? (
            <>
              <Text style={styles.sectionLabel}>About</Text>
              <Text style={styles.summary}>{detail.summary}</Text>
              {detail.wikipediaUrl && (
                <Pressable
                  onPress={() => Linking.openURL(detail.wikipediaUrl)}
                  style={styles.wikiLink}
                >
                  <Icon name="external-link" size={15} color={colors.primaryDark} />
                  <Text style={styles.wikiText}>Read on Wikipedia</Text>
                </Pressable>
              )}
            </>
          ) : null}

          {/* Taxonomy */}
          {ancestors.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Taxonomy</Text>
              <View style={styles.taxBox}>
                {ancestors.map((a) => (
                  <View key={a.rank} style={styles.taxRow}>
                    <Text style={styles.taxRank}>{a.rank}</Text>
                    <View style={styles.flex}>
                      <Text style={styles.taxName}>{a.name}</Text>
                      {a.common ? (
                        <Text style={styles.taxCommon}>{a.common}</Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {detail?.observationsCount != null && (
            <Text style={styles.obsCount}>
              {detail.observationsCount.toLocaleString()} observations on
              iNaturalist
            </Text>
          )}
        </View>
      </ScrollView>

      <PhotoViewer
        visible={viewerIndex !== null}
        photos={viewerPhotos}
        title={name}
        startIndex={viewerIndex || 0}
        onClose={() => setViewerIndex(null)}
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  scroll: { paddingBottom: 40 },
  hero: { width: '100%', aspectRatio: 1.1, backgroundColor: colors.faint },
  heroImg: { width: '100%', height: '100%' },
  backFab: {
    position: 'absolute',
    top: 12,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flagFab: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { padding: 20 },
  name: { fontSize: 26, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  sci: { fontSize: 17, fontStyle: 'italic', color: colors.muted, marginTop: 2 },
  rank: {
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: '700',
    color: colors.primary,
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 24,
    marginBottom: 10,
  },
  stripContent: { gap: 10, paddingRight: 4 },
  stripImg: {
    width: 130,
    height: 130,
    borderRadius: 14,
    backgroundColor: colors.faint,
  },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20 },
  loadingText: { color: colors.muted, fontSize: 14 },
  summary: { fontSize: 15, lineHeight: 22, color: colors.text },
  wikiLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  wikiText: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' },
  taxBox: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  taxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  taxRank: {
    width: 72,
    fontSize: 11,
    fontWeight: '700',
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taxName: { fontSize: 15, fontWeight: '700', color: colors.text },
  taxCommon: { fontSize: 13, color: colors.muted, marginTop: 1 },
  obsCount: { fontSize: 13, color: colors.muted, marginTop: 24, textAlign: 'center' },
});
