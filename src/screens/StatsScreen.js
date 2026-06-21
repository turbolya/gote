// Statistics page: a lifetime summary plus a per-species breakdown — every
// species you've been quizzed on, with a thumbnail and two bars (correct /
// incorrect), sortable by success rate or by correct/incorrect counts.

import React, { useMemo, useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  Alert,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { useColors, useThemedStyles } from '../theme';
import { fetchTaxonThumbs } from '../api';
import { AnimatedBar, animateNextLayout } from '../components/anim';

// Subtle teal fill for the per-row "recognition %" background bar (brand teal,
// fading out toward its tip; fixed across light/dark like the hero gradient).
const PCT_GRADIENT = ['rgba(0,138,172,0.22)', 'rgba(0,138,172,0.03)'];

const FLAG_ON = '#E0A800'; // amber for an active flag

// Sort modes for the per-species list.
const SORTS = [
  { key: 'pct', label: 'Success %' },
  { key: 'correct', label: 'Correct' },
  { key: 'incorrect', label: 'Incorrect' },
];

const knownOf = (s) => s.known || 0;
const missedOf = (s) => s.missed || 0;
const totalOf = (s) => knownOf(s) + missedOf(s);
const successOf = (s) => (totalOf(s) > 0 ? knownOf(s) / totalOf(s) : 0);

// One compact species row: a recognition-% gradient fills the row background,
// the thumbnail + name sit on the left, and the two count bars (correct /
// incorrect) sit on the right. Count bars are scaled to `maxCount` (the largest
// single count across the list) so their lengths are comparable row to row;
// nonzero bars keep a minimum width so they stay visible.
function CardStatRow({ item, image, maxCount, onPress, onImageError, flagged, onFlag }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const known = knownOf(item);
  const missed = missedOf(item);
  const total = known + missed;
  const pct = total > 0 ? Math.round((known / total) * 100) : 0;
  // Bar length as a number (percent of the largest single count in the list);
  // nonzero counts keep a minimum so they stay visible. AnimatedBar grows it in.
  const barPct = (n) => (n > 0 ? Math.max(8, (n / maxCount) * 100) : 0);

  return (
    <Pressable
      testID={`stats-card-${item.key}`}
      onPress={onPress}
      style={({ pressed }) => [styles.cardRow, pressed && styles.cardRowPressed]}
    >
      {/* Overall recognition % as a gradient bar behind the whole row. */}
      <LinearGradient
        colors={PCT_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.pctBg, { width: `${pct}%` }]}
        pointerEvents="none"
      />

      {image ? (
        <Image
          source={{ uri: image }}
          style={styles.thumb}
          resizeMode="cover"
          onError={() => onImageError && onImageError(image)}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Icon name="image" size={18} color={colors.muted} />
        </View>
      )}

      <View style={styles.nameCol}>
        <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
        {!!item.sci && (
          <Text style={styles.cardSci} numberOfLines={1}>{item.sci}</Text>
        )}
      </View>

      {onFlag && (
        <Pressable
          testID={`stats-flag-${item.key}`}
          onPress={onFlag}
          hitSlop={10}
          style={styles.flagBtn}
        >
          <Icon
            name={flagged ? 'flag' : 'flag-outline'}
            size={18}
            color={flagged ? FLAG_ON : colors.muted}
          />
        </Pressable>
      )}

      <View style={styles.barsCol}>
        <View style={styles.barLine}>
          <View style={styles.barTrack}>
            <AnimatedBar pct={barPct(known)} style={[styles.barFill, { backgroundColor: colors.correct }]} />
          </View>
          <Text style={[styles.barCount, { color: colors.correct }]}>{known}</Text>
        </View>
        <View style={styles.barLine}>
          <View style={styles.barTrack}>
            <AnimatedBar pct={barPct(missed)} style={[styles.barFill, { backgroundColor: colors.wrong }]} />
          </View>
          <Text style={[styles.barCount, { color: colors.wrong }]}>{missed}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function StatsScreen({ species, cards = [], lifetime, flags, onToggleFlag, onBack, onSelect, onReset }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [sort, setSort] = useState('pct');
  // Default: only species in the current user's loaded observations. Toggling
  // off shows every species ever quizzed (incl. Nearby rounds / past decks).
  const [obsOnly, setObsOnly] = useState(true);
  // taxonId → fetched thumbnail URL, for species not in the current deck whose
  // stats predate per-species thumbnails (null = looked up, none found).
  const [fetchedImages, setFetchedImages] = useState({});
  // Image URLs that failed to load, so we can fall back to a fetched thumbnail.
  const [errored, setErrored] = useState(() => new Set());
  const markErrored = (url) =>
    url &&
    setErrored((prev) => {
      if (prev.has(url)) return prev;
      const next = new Set(prev);
      next.add(url);
      return next;
    });

  // key (taxonId/scientific) → the full deck card, for thumbnails, the
  // "my observations" filter, and opening the detail page with full data.
  const cardByKey = useMemo(() => {
    const m = {};
    for (const c of cards) {
      const k = c.taxonId != null ? String(c.taxonId) : c.scientific;
      if (k && !m[k]) m[k] = c;
    }
    return m;
  }, [cards]);

  const list = useMemo(
    () =>
      Object.entries(species || {}).map(([key, s]) => ({
        key,
        ...s,
        image: s.image || (cardByKey[key] && cardByKey[key].image) || null,
      })),
    [species, cardByKey]
  );

  // Apply the "my observations" filter (default on).
  const filtered = useMemo(
    () => (obsOnly ? list.filter((s) => cardByKey[s.key]) : list),
    [list, obsOnly, cardByKey]
  );

  const sorted = useMemo(() => {
    const arr = [...filtered];
    if (sort === 'correct') {
      arr.sort((a, b) => knownOf(b) - knownOf(a) || totalOf(b) - totalOf(a));
    } else if (sort === 'incorrect') {
      arr.sort((a, b) => missedOf(b) - missedOf(a) || totalOf(b) - totalOf(a));
    } else {
      arr.sort((a, b) => successOf(b) - successOf(a) || totalOf(b) - totalOf(a));
    }
    return arr;
  }, [filtered, sort]);

  const maxCount = useMemo(
    () => Math.max(1, ...filtered.map((s) => Math.max(knownOf(s), missedOf(s)))),
    [filtered]
  );

  // Resolved thumbnail for a row: the stored/deck image (unless it failed to
  // load), else a fetched default thumbnail (unless that failed too).
  const imageFor = (item) => {
    if (item.image && !errored.has(item.image)) return item.image;
    const f = fetchedImages[item.key];
    if (f && !errored.has(f)) return f;
    return null;
  };

  // Fetch a default thumbnail for any visible species that has no usable image
  // yet — older stats for species no longer in the deck, or a broken stored
  // URL. Batched + cached in the API.
  useEffect(() => {
    const need = sorted
      .filter(
        (s) =>
          /^\d+$/.test(s.key) &&
          !(s.key in fetchedImages) &&
          !(s.image && !errored.has(s.image))
      )
      .map((s) => s.key);
    if (need.length === 0) return;
    let cancelled = false;
    (async () => {
      const map = await fetchTaxonThumbs(need.map(Number));
      if (cancelled) return;
      setFetchedImages((prev) => {
        const next = { ...prev };
        for (const k of need) next[k] = map[k] || null;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [sorted, fetchedImages, errored]);

  // Open the detail page: prefer the full deck card; otherwise build a minimal
  // card from the stats entry (the detail page fetches the rest by taxonId).
  const openDetail = (item) => {
    if (!onSelect) return;
    const deckCard = cardByKey[item.key];
    if (deckCard) {
      onSelect(deckCard);
      return;
    }
    const numeric = /^\d+$/.test(item.key);
    onSelect({
      taxonId: numeric ? Number(item.key) : null,
      image: imageFor(item),
      common: item.name && item.name !== item.sci ? item.name : null,
      scientific: item.sci || item.name,
      rank: '',
    });
  };

  const lifetimePct =
    lifetime && lifetime.answered > 0
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

  const empty = list.length === 0;

  // Jump back to the top when the sort or filter changes (but NOT on unrelated
  // re-renders like returning from the detail page, which keeps the position).
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [sort, obsOnly]);

  const confirmReset = () => {
    Alert.alert(
      'Reset statistics?',
      'This permanently clears your lifetime score and all per-species tallies.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onReset },
      ]
    );
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Statistics" onBack={onBack} />

      <ScrollView
        ref={scrollRef}
        testID="stats-scroll"
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>
              {lifetimePct !== null ? `${lifetimePct}%` : '—'}
            </Text>
            <Text style={styles.summaryLabel}>Accuracy</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{lifetime ? lifetime.answered : 0}</Text>
            <Text style={styles.summaryLabel}>Cards answered</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNum}>{list.length}</Text>
            <Text style={styles.summaryLabel}>Species seen</Text>
          </View>
        </View>

        {empty ? (
          <Text style={styles.emptyText}>
            Play a few rounds and a per-species breakdown — how often you get each
            one right or wrong — will show up here.
          </Text>
        ) : (
          <>
            <View style={styles.boardHeader}>
              <Text style={styles.boardTitle}>By species</Text>
              {/* Filter: my observations (default) ↔ all species ever seen. */}
              <Pressable
                testID="stats-filter"
                onPress={() => {
                  animateNextLayout();
                  setObsOnly((v) => !v);
                }}
                style={[styles.filterToggle, obsOnly && styles.filterToggleOn]}
              >
                <Icon
                  name={obsOnly ? 'funnel' : 'funnel-outline'}
                  size={13}
                  color={obsOnly ? colors.onDark : colors.muted}
                />
                <Text style={[styles.filterText, obsOnly && styles.filterTextOn]}>
                  {obsOnly ? 'My observations' : 'All species'}
                </Text>
              </Pressable>
            </View>

            {/* Sort options */}
            <View style={styles.sortRow}>
              {SORTS.map((s) => {
                const on = sort === s.key;
                return (
                  <Pressable
                    key={s.key}
                    testID={`stats-sort-${s.key}`}
                    onPress={() => {
                      animateNextLayout();
                      setSort(s.key);
                    }}
                    style={[styles.sortChip, on && styles.sortChipOn]}
                  >
                    <Text style={[styles.sortText, on && styles.sortTextOn]}>
                      {s.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {sorted.length === 0 ? (
              <Text style={styles.noneText}>
                None of your current observations have been quizzed yet. Tap “My
                observations” above to see every species you’ve seen.
              </Text>
            ) : (
              sorted.map((item) => (
                <CardStatRow
                  key={item.key}
                  item={item}
                  image={imageFor(item)}
                  maxCount={maxCount}
                  onPress={() => openDetail(item)}
                  onImageError={markErrored}
                  flagged={!!(flags && flags.has(item.key))}
                  onFlag={onToggleFlag ? () => onToggleFlag(item.key) : null}
                />
              ))
            )}

            <Pressable testID="stats-reset" style={styles.resetButton} onPress={confirmReset}>
              <Text style={styles.resetText}>Reset statistics</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  summary: {
    flexDirection: 'row',
    paddingVertical: 20,
    marginBottom: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNum: { fontSize: 30, fontWeight: '900', color: colors.text },
  summaryLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 40,
    paddingHorizontal: 20,
  },

  boardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  boardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  // "My observations" / "All species" filter toggle
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterToggleOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  filterText: { fontSize: 12.5, fontWeight: '700', color: colors.muted },
  filterTextOn: { color: colors.onDark },

  noneText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },

  // Sort segmented chips
  sortRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sortChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  sortText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  sortTextOn: { color: colors.onDark },

  // Per-species row — compact: thumb + name left, count bars right, with the
  // recognition-% gradient filling the row background.
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: colors.faint,
  },
  cardRowPressed: { opacity: 0.6 },
  pctBg: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  thumb: {
    width: 40,
    height: 40,
    borderRadius: 9,
    backgroundColor: colors.border,
  },
  thumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nameCol: { flex: 1, minWidth: 0 },
  cardName: { fontSize: 15, fontWeight: '700', color: colors.text },
  cardSci: { fontSize: 12, fontStyle: 'italic', color: colors.muted, marginTop: 1 },
  flagBtn: { width: 30, height: 40, alignItems: 'center', justifyContent: 'center' },

  barsCol: { width: 80, gap: 5 },
  barLine: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  barTrack: {
    flex: 1,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  barCount: { width: 20, textAlign: 'right', fontSize: 12, fontWeight: '800' },

  resetButton: { alignItems: 'center', paddingVertical: 14, marginTop: 18 },
  resetText: { color: colors.wrong, fontSize: 15, fontWeight: '700' },
});
