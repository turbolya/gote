// Statistics page: a lifetime summary plus a per-species breakdown — every
// species you've been quizzed on, with a thumbnail and two bars (correct /
// incorrect), sortable by success rate or by correct/incorrect counts.

import React, { useMemo, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ScrollView,
  FlatList,
  Alert,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { useColors, useThemedStyles } from '../theme';
import { fetchTaxonThumbs } from '../api';
import { AnimatedBar, animateNextLayout } from '../components/anim';
import { RecentGamesChart, AccuracyTrendChart } from '../components/charts';
import { topConfusionPairs, pairKey } from '../confusions';
import { shrunkRate, lifetimeRate, SHRINK_M } from '../accuracy';
import { speciesKey } from '../mastery';
import { scoreFrom, potentialFrom, weightedRate, WEIGHTS } from '../scoring';


// Row background tint endpoints: dark red for the lowest net score (correct −
// incorrect) in the list, brand teal for the highest. Interpolated per row.
const TINT_LOW = [139, 26, 26]; // dark red  (#8B1A1A)
const TINT_HIGH = [0, 138, 172]; // brand teal (#008AAC)
const TINT_ALPHA = 0.32;

// Sort modes for the per-species list.
const SORTS = [
  { key: 'pct', label: 'Success %' },
  { key: 'correct', label: 'Correct' },
  { key: 'incorrect', label: 'Incorrect' },
];

const knownOf = (s) => s.known || 0;
const missedOf = (s) => s.missed || 0;
const totalOf = (s) => knownOf(s) + missedOf(s);

// One compact species row: a recognition-% gradient fills the row background,
// the thumbnail + name sit on the left, and the two count bars (correct /
// incorrect) sit on the right. Count bars are scaled to `maxCount` (the largest
// single count across the list) so their lengths are comparable row to row;
// nonzero bars keep a minimum width so they stay visible.
const CardStatRow = React.memo(function CardStatRow({ item, image, maxCount, tint, onPress, onImageError, flagged, onFlag }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const known = knownOf(item);
  const missed = missedOf(item);
  // Bar length as a number (percent of the largest single count in the list);
  // nonzero counts keep a minimum so they stay visible. AnimatedBar grows it in.
  const barPct = (n) => (n > 0 ? Math.max(8, (n / maxCount) * 100) : 0);

  return (
    <Pressable
      testID={`stats-card-${item.key}`}
      onPress={onPress}
      // Background tinted by net score (correct − incorrect): teal = best in the
      // list, dark red = worst (see scoreTint in the parent).
      style={({ pressed }) => [styles.cardRow, { backgroundColor: tint }, pressed && styles.cardRowPressed]}
    >
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
          accessibilityRole="button"
          accessibilityLabel={flagged ? 'Unflag species' : 'Flag species'}
          style={styles.flagBtn}
        >
          <Icon
            name={flagged ? 'flag' : 'flag-outline'}
            size={18}
            color={flagged ? colors.flag : colors.muted}
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
},
// Only re-render a row when its own data changes. The row's handlers act on its
// stable `item`, so their (per-render) identity can be ignored — which lets an
// unrelated parent re-render (a different row's thumbnail loading, etc.) skip
// the ~12 mounted rows instead of re-rendering all of them.
(a, b) =>
  a.item === b.item &&
  a.image === b.image &&
  a.maxCount === b.maxCount &&
  a.tint === b.tint &&
  a.flagged === b.flagged);

// One species in a "you mix these up" pair: thumbnail + name.
function NemesisCell({ info }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.nemesisCell}>
      {info.image ? (
        <Image source={{ uri: info.image }} style={styles.nemesisThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.nemesisThumb, styles.nemesisThumbPlaceholder]}>
          <Icon name="image" size={16} color={colors.muted} />
        </View>
      )}
      <Text style={styles.nemesisName} numberOfLines={2}>{info.name}</Text>
      {!!info.sci && <Text style={styles.nemesisSci} numberOfLines={1}>{info.sci}</Text>}
    </View>
  );
}

export default function StatsScreen({ species, cards = [], confusions = {}, confusionNotes = {}, onCompare, lifetime, statsByFormat = {}, history = [], historyCounts = [], streak, flags, onToggleFlag, onBack, onSelect, onReset }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [sort, setSort] = useState('pct');
  // Which card's explanation is open. ONE at a time, deliberately: the whole
  // point of hiding them is that the page reads as figures, and three expanded
  // essays would put it straight back where it started.
  const [openInfo, setOpenInfo] = useState(null);
  // Default: only species in the current user's loaded observations. Toggling
  // off shows every species ever quizzed (incl. Nearby rounds / past decks).
  const [obsOnly, setObsOnly] = useState(true);
  // taxonId → fetched thumbnail URL, for species not in the current deck whose
  // stats predate per-species thumbnails (null = looked up, none found).
  const [fetchedImages, setFetchedImages] = useState({});
  // Keys we've already requested a default thumbnail for, so we never re-fetch
  // the same species. A ref (not state) so it never triggers a re-render and
  // never grows the render cost — safe even with thousands of rows.
  const requestedThumbsRef = useRef(new Set());

  // Fetch default thumbnails for the given rows that still lack a usable image.
  // Driven by which rows are actually on screen (see onViewableItemsChanged), so
  // the work scales with the visible window, not the total list length — a long
  // "All species" list never fires a burst of rate-limited calls up front.
  const fetchThumbsFor = useCallback((items) => {
    const need = [];
    for (const it of items) {
      const key = it && it.key;
      if (!key || !/^\d+$/.test(key)) continue; // taxonId-keyed species only
      if (requestedThumbsRef.current.has(key)) continue;
      if (it.image) continue; // already has a stored/deck image
      requestedThumbsRef.current.add(key);
      need.push(key);
    }
    if (need.length === 0) return;
    (async () => {
      const map = await fetchTaxonThumbs(need.map(Number));
      setFetchedImages((prev) => {
        const next = { ...prev };
        for (const k of need) next[k] = map[k] || null;
        return next;
      });
    })();
  }, []);

  // Stable refs for FlatList viewability (it warns if these change per render).
  const viewConfigRef = useRef({ itemVisiblePercentThreshold: 10 });
  const onViewableRef = useRef(({ viewableItems }) => {
    fetchThumbsFor(viewableItems.map((v) => v.item));
  });

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
      const k = speciesKey(c);
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

  // Top "you mix these up" pairs, with each species resolved to a name + thumb
  // from the deck or the per-species tallies. Pairs we can't name locally (e.g. a
  // By-picture distractor never seen as a card) are dropped for now — they'll
  // resolve once confusions carry names / sync. Direction is folded together.
  const nemesis = useMemo(() => {
    const info = (key) => {
      const dc = cardByKey[key];
      if (dc) return { name: dc.common || dc.scientific, sci: dc.scientific, image: dc.image || null };
      const s = species && species[key];
      if (s && (s.name || s.sci)) return { name: s.name || s.sci, sci: s.sci || '', image: s.image || null };
      return null;
    };
    const out = [];
    for (const p of topConfusionPairs(confusions, { min: 3, limit: 8 })) {
      const a = info(p.a);
      const b = info(p.b);
      if (a && b) out.push({ pairKey: pairKey(p.a, p.b), count: p.count, a, b, aKey: String(p.a), bKey: String(p.b) });
    }
    return out;
  }, [confusions, cardByKey, species]);

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
      // Success % ranks on the SHRUNK rate, not the raw one. Raw, a species
      // answered right once sits at a flat 100% and outranks one you've got
      // right forty times out of forty-two — which makes the top of this list
      // the species you've barely seen. Shrinking toward your own lifetime rate
      // means a thin sample has to earn its position (see src/accuracy.js);
      // once there's real evidence the two rates are indistinguishable.
      const prior = lifetimeRate(lifetime);
      // Rank on the DIFFICULTY-WEIGHTED rate where there is one, so a species
      // known by typing outranks one known only from a four-photo grid. Species
      // answered entirely before scoring existed have no weighted history at
      // all, so they fall back to the raw shrunk rate rather than sorting to the
      // bottom as if they were unknown.
      const rate = (s) => {
        const w = weightedRate(s);
        return w == null ? shrunkRate(s, prior) : shrunkRate({ known: s.points, missed: Math.max(0, s.weight - s.points) }, prior);
      };
      arr.sort((a, b) => rate(b) - rate(a) || totalOf(b) - totalOf(a));
    }
    return arr;
  }, [filtered, sort, lifetime]);

  // Single-pass max of every count in the list. (Avoid Math.max(...arr): the
  // spread overflows the call stack on very large lists — e.g. Nearby decks
  // spanning many users.)
  const maxCount = useMemo(() => {
    let m = 1;
    for (const s of filtered) {
      const k = knownOf(s);
      const mi = missedOf(s);
      if (k > m) m = k;
      if (mi > m) m = mi;
    }
    return m;
  }, [filtered]);

  // Net score (correct − incorrect) per species, and the list's range, so each
  // row's background can be tinted teal (the highest net) → dark red (the lowest).
  // Single-pass (no Math.min/max spread — see maxCount above).
  const [minNet, maxNet] = useMemo(() => {
    if (!filtered.length) return [0, 0];
    let lo = Infinity;
    let hi = -Infinity;
    for (const s of filtered) {
      const n = knownOf(s) - missedOf(s);
      if (n < lo) lo = n;
      if (n > hi) hi = n;
    }
    return [lo, hi];
  }, [filtered]);
  const scoreTint = (net) => {
    const span = maxNet - minNet;
    const t = span > 0 ? (net - minNet) / span : 0.5;
    const mix = (i) => Math.round(TINT_LOW[i] + (TINT_HIGH[i] - TINT_LOW[i]) * t);
    return `rgba(${mix(0)}, ${mix(1)}, ${mix(2)}, ${TINT_ALPHA})`;
  };

  // Resolved thumbnail for a row: the stored/deck image (unless it failed to
  // load), else a fetched default thumbnail (unless that failed too).
  const imageFor = (item) => {
    if (item.image && !errored.has(item.image)) return item.image;
    const f = fetchedImages[item.key];
    if (f && !errored.has(f)) return f;
    return null;
  };

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

  // The FlatList ref. We deliberately do NOT auto-scroll to the top when the
  // sort or filter changes: the sort/filter controls live in the scrollable
  // header (below the trend charts), so jumping to the top would hide them —
  // forcing the user to scroll back down to change sort again. Keeping the
  // position lets the list re-order/re-filter in place right under the controls.
  const scrollRef = useRef(null);

  // A card heading with an ⓘ in the corner. The explanation lives behind it
  // rather than under every chart, so the numbers are what you see first and
  // the reasoning is one tap away when you want it.
  const cardHead = (key, title) => (
    <View style={styles.cardHead}>
      <Text style={styles.chartTitle}>{title}</Text>
      <Pressable
        testID={`stats-info-${key}`}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={openInfo === key ? `Hide what ${title} means` : `What does ${title} mean?`}
        onPress={() => {
          animateNextLayout();
          setOpenInfo(openInfo === key ? null : key);
        }}
      >
        <Icon
          name={openInfo === key ? 'close-circle' : 'information-circle-outline'}
          size={20}
          color={openInfo === key ? colors.primary : colors.muted}
        />
      </Pressable>
    </View>
  );
  const cardInfo = (key, children) =>
    openInfo === key ? <Text style={styles.chartCaption}>{children}</Text> : null;

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

  // Summary + streak block, shared by the empty state and the list header.
  const summaryBlock = (
    <>
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

      {/* Score, kept apart from the accuracy row on purpose: it answers a
          different question. Accuracy is what fraction you got right; this is
          how much those answers were WORTH, so naming a species from memory
          counts for four times as much as picking its photo out of four. */}
      <View style={styles.scoreCard}>
        <View style={styles.scoreRow}>
          <View style={styles.flex}>
            <Text style={styles.scoreLabel}>Score</Text>
            {/* The ceiling stays visible: a score with no scale is just a
                number, and "of 189" is the part that makes it mean something. */}
            <Text style={styles.scoreSub}>
              of {Math.round(potentialFrom(lifetime, statsByFormat))} possible
            </Text>
          </View>
          <Text style={styles.scoreNum}>{Math.round(scoreFrom(lifetime, statsByFormat))}</Text>
          <Pressable
            testID="stats-info-score"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={openInfo === 'score' ? 'Hide what Score means' : 'What does Score mean?'}
            onPress={() => {
              animateNextLayout();
              setOpenInfo(openInfo === 'score' ? null : 'score');
            }}
          >
            <Icon
              name={openInfo === 'score' ? 'close-circle' : 'information-circle-outline'}
              size={20}
              color={openInfo === 'score' ? colors.primary : colors.muted}
            />
          </Pressable>
        </View>
        {cardInfo(
          'score',
          <>
            Harder questions are worth more — typing a name counts{' '}
            {WEIGHTS.typed / WEIGHTS.picture}× a photo choice, because there is
            nothing to guess among.
            {statsByFormat.flash && statsByFormat.flash.answered > 0
              ? ' Flash cards don’t score — you grade those yourself.'
              : ''}
          </>
        )}
      </View>

      {/* Daily streak */}
      {streak && (
        <View style={styles.streakCard}>
          <Icon
            name={streak.count > 0 ? 'flame' : 'flame-outline'}
            size={28}
            color={streak.count > 0 ? colors.primary : colors.muted}
          />
          <View style={styles.flex}>
            <Text style={styles.streakTitle}>
              {streak.count > 0 ? `${streak.count}-day streak` : 'No streak yet'}
            </Text>
            {/* "Best" stays put: it is a figure, not an explanation, and it is
                the only place the record appears. Only the sentence describing
                what a streak IS goes behind the ⓘ. */}
            {streak.longest > 0 && (
              <Text style={styles.streakSub}>Best: {streak.longest}</Text>
            )}
            {cardInfo(
              'streak',
              streak.count > 0
                ? 'Days you’ve played in a row. Play any round today to keep it going.'
                : 'Play a round today to start a daily streak.'
            )}
          </View>
          <Pressable
            testID="stats-info-streak"
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={openInfo === 'streak' ? 'Hide what the streak means' : 'What does the streak mean?'}
            onPress={() => {
              animateNextLayout();
              setOpenInfo(openInfo === 'streak' ? null : 'streak');
            }}
          >
            <Icon
              name={openInfo === 'streak' ? 'close-circle' : 'information-circle-outline'}
              size={20}
              color={openInfo === 'streak' ? colors.primary : colors.muted}
            />
          </Pressable>
        </View>
      )}
    </>
  );

  // Accuracy split by question format. Ordered by how hard the format is rather
  // than by score, because that ordering is the entire point: a lower number
  // further down the list is expected, not a problem.
  const formatRows = useMemo(() => {
    const ORDER = [
      ['picture', 'Choosing the photo'],
      ['name', 'Choosing the name'],
      ['pair', 'Look-alike pairs'],
      ['typed', 'Typing from memory'],
      ['flash', 'Flash cards'],
    ];
    return ORDER.map(([key, label]) => {
      const v = statsByFormat[key] || {};
      const answered = Number(v.answered) || 0;
      const correct = Number(v.correct) || 0;
      return { key, label, answered, pct: answered > 0 ? Math.round((correct / answered) * 100) : 0 };
    }).filter((r) => r.answered > 0);
  }, [statsByFormat]);

  // Only worth the space once there is something to COMPARE. With one format it
  // would just restate the accuracy above it.
  const formatBlock = formatRows.length >= 2 && (
    <View style={styles.chartCard}>
      {cardHead('formats', 'By question type')}
      {formatRows.map((r) => (
        <View key={r.key} style={styles.fmtRow}>
          <Text style={styles.fmtLabel} numberOfLines={1}>{r.label}</Text>
          <View style={styles.fmtTrack}>
            <AnimatedBar pct={r.pct} style={[styles.barFill, { backgroundColor: colors.primary }]} />
          </View>
          <Text style={styles.fmtPct}>{r.pct}%</Text>
          <Text style={styles.fmtCount}>{r.answered}</Text>
        </View>
      ))}
{cardInfo('formats', <>
        These are not equally hard. Typing a name from memory has nothing to
        choose from, while picking a photo out of four gives you a one-in-four
        chance without knowing anything — so a lower score further down this
        list is expected, and comparing your overall accuracy across sessions
        only means something if the mix stayed similar.
      </>)}
    </View>
  );

  // Trend charts over the per-game accuracy history. Shown when there's data.
  const chartsBlock = (
    <>
      {history.length >= 1 && (
        <View style={styles.chartCard}>
          {cardHead('recent', 'Recent games')}
          <RecentGamesChart history={history} height={104} />
{cardInfo('recent', <>
            Each bar is one round — how accurately you identified that game’s
            cards (taller = better). Oldest on the left, newest on the right.
          </>)}
        </View>
      )}
      {history.length >= 2 && (
        <View style={styles.chartCard}>
          {cardHead('trend', 'Accuracy trend')}
          <AccuracyTrendChart
            history={history}
            counts={historyCounts}
            lifetime={lifetime}
            height={104}
          />
{cardInfo('trend', <>
            Your running lifetime accuracy — every card you’ve answered up to
            that point, so a long round counts for more than a short one. It
            steadies as you play more, so the slope shows whether you’re
            improving, and it ends on the accuracy above.
          </>)}
        </View>
      )}
    </>
  );

  // The look-alikes this player systematically swaps — surfaced so they can be
  // studied as a pair. Shown only once there's a real pattern to act on.
  const nemesisBlock = nemesis.length > 0 && (
    <View style={styles.chartCard}>
      {cardHead('mixups', 'Species you mix up')}
      {nemesis.map((p, idx) => {
        const hasNote = !!confusionNotes[p.pairKey];
        return (
          <Pressable
            key={p.pairKey}
            testID={`stats-confusion-${idx}`}
            onPress={() => onCompare && onCompare(p)}
            style={({ pressed }) => [styles.nemesisRow, pressed && styles.cardRowPressed]}
          >
            <View style={styles.nemesisPair}>
              <NemesisCell info={p.a} />
              <Text style={styles.nemesisVs}>vs</Text>
              <NemesisCell info={p.b} />
            </View>
            <View style={styles.nemesisFoot}>
              <Text style={styles.nemesisCount}>
                Mixed up {p.count} {p.count === 1 ? 'time' : 'times'}
              </Text>
              <View style={styles.nemesisFootRight}>
                <Text style={[styles.nemesisCompare, hasNote && styles.nemesisCompareNote]}>
                  {hasNote ? 'Your tell ✓' : 'Compare'}
                </Text>
                <Icon name="chevron-right" size={16} color={colors.muted} />
              </View>
            </View>
          </Pressable>
        );
      })}
{cardInfo('mixups', <>
        Look-alikes you’ve picked for each other. Tap a pair to see them side by
        side and jot down what tells them apart.
      </>)}
    </View>
  );

  // List header: summary + the "By species" board controls (filter + sort).
  const listHeader = (
    <>
      {summaryBlock}
      {formatBlock}
      {chartsBlock}
      {nemesisBlock}
      <Text style={styles.boardTitle}>By species</Text>

      {/* Filter — a labelled "Show" row so it reads clearly as a filter (which
          species appear), distinct from the "Sort by" row below. */}
      <View style={styles.controlRow}>
        <Text style={styles.controlLabel}>Show</Text>
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
            color={obsOnly ? colors.onPrimary : colors.muted}
          />
          <Text style={[styles.filterText, obsOnly && styles.filterTextOn]}>
            {obsOnly ? 'My observations' : 'All species'}
          </Text>
        </Pressable>
      </View>

      {/* Sort — a labelled "Sort by" row; the chips only reorder the list, they
          don't filter it. */}
      <View style={styles.controlRow}>
        <Text style={styles.controlLabel}>Sort by</Text>
        <View style={styles.sortChips}>
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
      </View>

      {/* Say what "Success %" actually ranks on. Without this the order looks
          broken to anyone who spots a 1-for-1 species sitting below a 40-for-42
          one — which is the whole point of ranking this way. */}
      {sort === 'pct' && (
        <Text style={styles.sortNote}>
          Ranked by how reliably you know each species, so a species you’ve seen
          once can’t top the list on a single lucky answer. It takes about{' '}
          {SHRINK_M} answers before a species is judged on its own record alone.
        </Text>
      )}
    </>
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Statistics" onBack={onBack} />

      {empty ? (
        <ScrollView
          testID="stats-scroll"
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
        >
          {summaryBlock}
          <Text style={styles.emptyText}>
            Play a few rounds and a per-species breakdown — how often you get each
            one right or wrong — will show up here.
          </Text>
        </ScrollView>
      ) : (
        // Virtualized list: only the on-screen rows are mounted, so a long
        // "All species" breakdown (e.g. Nearby decks spanning many users) stays
        // fast and stable instead of mounting every row + image at once.
        <FlatList
          ref={scrollRef}
          testID="stats-scroll"
          data={sorted}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <CardStatRow
              item={item}
              image={imageFor(item)}
              maxCount={maxCount}
              tint={scoreTint(knownOf(item) - missedOf(item))}
              onPress={() => openDetail(item)}
              onImageError={(url) => {
                markErrored(url);
                // A broken stored image: try a default thumbnail as a fallback.
                fetchThumbsFor([{ key: item.key }]);
              }}
              flagged={!!(flags && flags.has(item.key))}
              onFlag={onToggleFlag ? () => onToggleFlag(item.key) : null}
            />
          )}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={
            <Text style={styles.noneText}>
              None of your current observations have been quizzed yet. Tap “My
              observations” above to see every species you’ve seen.
            </Text>
          }
          ListFooterComponent={
            <Pressable testID="stats-reset" style={styles.resetButton} onPress={confirmReset}>
              <Text style={styles.resetText}>Reset statistics</Text>
            </Pressable>
          }
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          onViewableItemsChanged={onViewableRef.current}
          viewabilityConfig={viewConfigRef.current}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={11}
          removeClippedSubviews
        />
      )}
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

  // Daily-streak card.
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.faint,
    borderRadius: 16,
    padding: 16,
    marginBottom: 22,
  },
  streakTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  streakSub: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 2 },

  // Trend-chart cards (recent games + accuracy trend).
  chartCard: {
    backgroundColor: colors.faint,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  chartCaption: { fontSize: 13, lineHeight: 18, color: colors.muted, marginTop: 12 },
  // Explains the Success % ordering, sitting just under the sort chips.
  sortNote: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.muted,
    marginTop: 8,
    marginBottom: 2,
  },

  // "Species you mix up" — one row per confused pair.
  nemesisRow: {
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  // Two species cells with a centred "vs" between them.
  nemesisPair: { flexDirection: 'row', alignItems: 'flex-start' },
  nemesisCell: { flex: 1, alignItems: 'center' },
  nemesisThumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.border },
  nemesisThumbPlaceholder: { alignItems: 'center', justifyContent: 'center' },
  nemesisName: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  nemesisSci: { fontSize: 11, fontStyle: 'italic', color: colors.muted, textAlign: 'center', marginTop: 1 },
  nemesisVs: {
    alignSelf: 'center',
    marginHorizontal: 10,
    fontSize: 12,
    fontWeight: '800',
    color: colors.muted,
    textTransform: 'uppercase',
  },
  nemesisFoot: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nemesisFootRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  nemesisCount: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  nemesisCompare: { fontSize: 13, fontWeight: '700', color: colors.muted },
  nemesisCompareNote: { color: colors.primaryDark },
  emptyText: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 40,
    paddingHorizontal: 20,
  },

  boardTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // A labelled control row: a fixed-width "Show" / "Sort by" tag, then the
  // control, so it's obvious which buttons filter and which sort.
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  controlLabel: {
    width: 54,
    fontSize: 12,
    fontWeight: '700',
    color: colors.muted,
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
  filterTextOn: { color: colors.onPrimary },

  noneText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 16,
  },

  // Sort segmented chips (wrap under the "Sort by" label on narrow screens).
  sortChips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sortChip: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipOn: { borderColor: colors.primary, backgroundColor: colors.primary },
  sortText: { fontSize: 13, fontWeight: '700', color: colors.muted },
  sortTextOn: { color: colors.onPrimary },

  // Per-species row — compact: thumb + name left, count bars right. The row
  // background is tinted by net score (set inline; see scoreTint).
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
    marginBottom: 6,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardRowPressed: { opacity: 0.6 },
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
  // "By question type" rows. A fixed-width track, unlike the per-species bars
  // which flex — here the label is the variable-length part and the bars must
  // line up with each other to be comparable at a glance.
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scoreCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    // Matches chartCard: every card on this page separates itself from the NEXT
    // one, so a card without a bottom margin butts straight into whatever
    // follows. marginTop is the extra step down from the summary row above,
    // which has no margin of its own.
    padding: 16,
    marginTop: 14,
    marginBottom: 16,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  scoreLabel: { fontSize: 15, fontWeight: '800', color: colors.text },
  scoreSub: { fontSize: 12, color: colors.muted, marginTop: 3, lineHeight: 17 },
  scoreNum: { fontSize: 30, fontWeight: '900', color: colors.primary, letterSpacing: -0.5 },
  fmtRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 7 },
  fmtLabel: { flex: 1, fontSize: 14, color: colors.text },
  fmtTrack: {
    width: 72,
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.card,
    overflow: 'hidden',
  },
  fmtPct: { width: 44, textAlign: 'right', fontSize: 14, fontWeight: '800', color: colors.text },
  fmtCount: { width: 34, textAlign: 'right', fontSize: 12, color: colors.muted },

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
