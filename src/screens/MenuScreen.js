// Main menu: pick a game mode (or open Lexicon / Stats / Settings). Shown once a
// user's deck of observations has loaded.
//
// Design: a full-bleed green hero banner that fills the top edge-to-edge (under
// the status bar) with the account + lifetime accuracy and a background chart of
// recent games. On scroll it collapses up into a pinned compact banner. Below it,
// clean minimal sections — flat lists with hairline dividers and accent icons.

import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Pressable, Animated, Easing, Image, Linking, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { smoothPath } from '../components/charts';
import {
  cumulativeAccuracy,
  downsampleAccuracy,
  sampleBucketEnds,
  priorFor,
} from '../accuracy';
import Icon from '../components/Icon';
import WatchTip from '../components/WatchTip';
import OfflineBanner from '../components/OfflineBanner';
import { SpinnerWarmup } from '../components/LoadingImage';
import { useTheme, useThemedStyles } from '../theme';
import { Appear } from '../components/anim';
import { SPEEDRUN_LIVES, KOFI_URL } from '../constants';
import { IS_E2E } from '../e2e/testMode';
import { useAnchorRef, useTutorialScroller } from '../components/Tutorial';

// Modes that need a live network call to build a round, so they can't run
// offline at all: Nearby (a place query) and By picture (curated photos per
// round). The rest play from the already-loaded deck.
const ONLINE_ONLY = new Set(['nearby', 'pick']);

// The hero gradient is the brand teal in both themes (white text reads well on
// it either way), so it's intentionally not theme-dependent. Three stops give it
// a clearly non-uniform, diagonal shade.
const HERO_GRADIENT = ['#17A7C6', '#008AAC', '#02485A'];

// Light teal for the daily-streak flame on the hero (reads well on the teal).
const FLAME_TEAL = '#82D9EA';
const FLAME_DIM = 'rgba(255,255,255,0.5)';

// Hero heights (excluding the top safe-area inset).
const EXPANDED = 162;
const COLLAPSED = 74;
const RANGE = EXPANDED - COLLAPSED;

// Background accuracy-chart geometry.
const BAR_W = 7;
const BAR_GAP = 4;
// Vertical inset so the trend line never clips at the very top/bottom edge.
const LINE_PAD = 4;

const AnimatedPath = Animated.createAnimatedComponent(Path);

// A subtle chart of accuracy filling the hero behind the content: one vertical
// bar per game (oldest → newest), each a white gradient fading down. Always
// spans your FULL history — once there are more games than bars that fit, the
// data is downsampled (bars become per-bucket averages) rather than dropping the
// oldest games.
function AccuracyBars({ data = [], counts = [], lifetime = null }) {
  const styles = useThemedStyles(makeStyles);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w: width, h: height } = size;
  // Grow the bars up from the baseline once they're laid out.
  const grow = useRef(new Animated.Value(IS_E2E ? 1 : 0)).current;
  const maxBars =
    width > 0 ? Math.max(1, Math.floor((width + BAR_GAP) / (BAR_W + BAR_GAP))) : 0;
  // Per-game accuracy, downsampled to fit the available bars so the whole
  // lifetime stays on screen. Each bucket is a card-weighted average, so a long
  // round isn't averaged away by a short one sharing its bucket.
  const bars = maxBars > 0 ? downsampleAccuracy(data, counts, maxBars) : [];

  // Lifetime accuracy over time: the running card-weighted accuracy up to each
  // point, computed over the FULL history then sampled (at bucket ends) to the
  // same number of points as the bars — so the curve spans the entire history
  // and ends on the exact percentage printed below it.
  const lineVals =
    maxBars === 0
      ? []
      : sampleBucketEnds(
          cumulativeAccuracy(data, counts, priorFor(lifetime, data, counts)),
          maxBars
        );

  // Map the visible line values to pixel points centered on each bar.
  const points = lineVals.map((v, i) => ({
    x: i * (BAR_W + BAR_GAP) + BAR_W / 2,
    y: LINE_PAD + (1 - Math.min(100, Math.max(0, v)) / 100) * (height - 2 * LINE_PAD),
  }));
  const linePath = height > 0 ? smoothPath(points) : '';
  // Reveal the line by "drawing" it (strokeDashoffset) in step with the bars.
  const lineLen = Math.max(1, width * 3);

  useEffect(() => {
    if (IS_E2E || bars.length === 0) return;
    grow.setValue(0);
    Animated.timing(grow, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating height (%) + strokeDashoffset
    }).start();
  }, [bars.length, grow]);
  if (!data.length) return null;
  return (
    <View
      style={styles.chart}
      pointerEvents="none"
      onLayout={(e) =>
        setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })
      }
    >
      {bars.map((pct, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              height: grow.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', `${Math.max(3, pct)}%`],
              }),
            },
          ]}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.2)']}
            style={styles.barFill}
          />
        </Animated.View>
      ))}

      {/* Smooth lifetime-accuracy trend line, overlaid on the bars. */}
      {linePath && points.length >= 2 && (
        <Svg
          width={width}
          height={height}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <AnimatedPath
            d={linePath}
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray={lineLen}
            strokeDashoffset={grow.interpolate({
              inputRange: [0, 1],
              outputRange: [lineLen, 0],
            })}
          />
        </Svg>
      )}
    </View>
  );
}

// One tappable list row (game mode / Lexicon / Settings). Top-level (stable
// identity) so incidental re-renders don't replay the entrance animation.
// Staggers in via `index`, and springs down slightly while pressed.
function Row({ icon, accent, title, sub, onPress, testID, first, index = 0, disabled, anchor }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  // Rows the guided tour points at (see ANCHORS in src/tutorial.js). A no-op
  // for every other row, and when no tour is running.
  const anchorRef = useAnchorRef(anchor);
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 7, tension: 220 }).start();
  return (
    <Appear delay={index * 55} offset={10}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          ref={anchorRef}
          testID={testID}
          disabled={disabled}
          onPress={disabled ? undefined : onPress}
          onPressIn={() => !disabled && to(0.97)}
          onPressOut={() => !disabled && to(1)}
          style={({ pressed }) => [
            styles.row,
            !first && styles.rowDivider,
            pressed && styles.rowPressed,
            disabled && styles.rowDisabled,
          ]}
        >
          <Icon name={icon} size={24} color={disabled ? colors.muted : accent.fg} style={styles.rowIcon} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowSub}>{sub}</Text>
          </View>
          <Icon name={disabled ? 'cloud-offline-outline' : 'chevron-right'} size={disabled ? 18 : 20} color={colors.muted} />
        </Pressable>
      </Animated.View>
    </Appear>
  );
}

export default function MenuScreen({
  username,
  deckCount,
  lifetime,
  history = [],
  historyCounts = [],
  streak,
  watchTipDismissed,
  onDismissWatchTip,
  onSelectMode,
  onLexicon,
  onStats,
  onSettings,
  offline,
}) {
  const { colors, accents } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const statsAnchor = useAnchorRef('menu-stats');
  // Let the guided tour bring a row below the fold into view before pointing at
  // it — Settings sits under six game modes and starts off screen everywhere.
  // The offset is tracked here because only this list knows where it is.
  const scrollRef = useRef(null);
  const scrollOffset = useRef(0);
  useTutorialScroller((dy) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(0, scrollOffset.current + dy), animated: true });
    }
  });
  const lifetimePct =
    lifetime && lifetime.answered > 0
      ? Math.round((lifetime.correct / lifetime.answered) * 100)
      : null;

  // Drives the collapsing header from the scroll offset.
  const scrollY = useRef(new Animated.Value(0)).current;
  const headerHeight = scrollY.interpolate({
    inputRange: [0, RANGE],
    outputRange: [insets.top + EXPANDED, insets.top + COLLAPSED],
    extrapolate: 'clamp',
  });
  const bigOpacity = scrollY.interpolate({
    inputRange: [0, RANGE * 0.6],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  // Soft drop shadow that fades in as the banner collapses (lifts it off the
  // list). iOS uses shadow*, Android uses elevation — both animate on the JS
  // driver alongside the height/opacity above.
  const shadowOpacity = scrollY.interpolate({
    inputRange: [0, RANGE],
    outputRange: [0, 0.18],
    extrapolate: 'clamp',
  });
  const elevation = scrollY.interpolate({
    inputRange: [0, RANGE],
    outputRange: [0, 8],
    extrapolate: 'clamp',
  });

  // Offline with an empty playable deck: the deck-local modes have no cards
  // whose photos are downloaded, so there's nothing to play. (deckCount is the
  // playable count — already narrowed to downloaded cards when offline.)
  const noOfflineCards = offline && deckCount === 0;

  const playModes = [
    { key: 'smart', anchor: 'mode-smart', icon: 'sparkles-outline', accent: accents.rose, title: 'Smart play', sub: 'Mixed questions, picked for what you know' },
    { key: 'pick', icon: 'apps-outline', accent: accents.blue, title: 'By picture', sub: 'See a name, choose its photo' },
    { key: 'speedrun', icon: 'flash', accent: accents.amber, title: 'Speedrun', sub: `Endless cards — survive ${SPEEDRUN_LIVES} misses` },
    { key: 'nearby', anchor: 'mode-nearby', icon: 'compass-outline', accent: accents.teal, title: 'Nearby species', sub: 'Learn species typical to a place' },
  ];

  return (
    <View style={styles.flex}>
      {/* Decodes the loading spinner while the menu is up, so the first card of
          a round can paint it immediately instead of showing bare black. */}
      <SpinnerWarmup />
      <Animated.ScrollView
        ref={scrollRef}
        testID="menu-scroll"
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          // The menu is full-bleed (no SafeAreaView), so add the bottom inset
          // to keep the last items clear of the home indicator.
          { paddingTop: insets.top + EXPANDED + 8, paddingBottom: insets.bottom + 28 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          {
            useNativeDriver: false,
            listener: (e) => {
              scrollOffset.current = e.nativeEvent.contentOffset.y;
            },
          }
        )}
      >
        {/* "Did you know?" Apple Watch notice — iPhone-only, dismissible
            (self-hides on iPad/Android and once hidden). */}
        <WatchTip dismissed={watchTipDismissed} onDismiss={onDismissWatchTip} />

        {offline && (
          <OfflineBanner
            message={
              noOfflineCards
                ? 'You’re offline and no photos are downloaded yet. Connect once to load your deck.'
                : undefined
            }
          />
        )}

        <Text style={styles.section}>Play</Text>
        <View style={styles.group}>
          {playModes.map(({ key, sub, ...rest }, i) => {
            // Two reasons a mode is unavailable offline:
            //  • Nearby / By picture need live API calls (a place query, or
            //    curated photos per round), so they can't run at all.
            //  • The deck-local modes CAN run offline, but only from cards whose
            //    photos are downloaded — if none are, there's nothing to play.
            const onlineOnly = offline && ONLINE_ONLY.has(key);
            const off = onlineOnly || (noOfflineCards && !onlineOnly);
            const offSub = onlineOnly ? 'Needs a connection' : 'No downloaded photos yet';
            return (
              <Row
                key={key}
                {...rest}
                sub={off ? offSub : sub}
                disabled={off}
                first={i === 0}
                index={i}
                testID={`mode-${key}`}
                onPress={() => onSelectMode(key)}
              />
            );
          })}
        </View>

        <Text style={styles.section}>Learn</Text>
        <View style={styles.group}>
          <Row first index={0} testID="mode-flash" icon="documents-outline" accent={accents.indigo} title="Flash cards" sub={noOfflineCards ? 'No downloaded photos yet' : 'Reveal the answer, then grade yourself'} disabled={noOfflineCards} onPress={() => onSelectMode('flash')} />
          <Row index={1} testID="open-lexicon" icon="library-outline" accent={accents.teal} title="Lexicon" sub="Browse all your species" onPress={onLexicon} />
        </View>

        <Text style={styles.section}>Settings</Text>
        <View style={styles.group}>
          <Row first testID="open-settings" anchor="open-settings" icon="settings-outline" accent={accents.slate} title="Settings" sub="Account, language and study options" onPress={onSettings} />
        </View>

        {/* Quiet support link at the very bottom — deliberately low-key. */}
        <Pressable
          testID="menu-kofi"
          onPress={() => Linking.openURL(KOFI_URL).catch(() => {})}
          style={({ pressed }) => [styles.kofi, pressed && styles.kofiPressed]}
        >
          <Icon name="cafe-outline" size={16} color={colors.muted} />
          <Text style={styles.kofiText}>Buy me a coffee</Text>
        </Pressable>
        <Text style={styles.kofiNote}>
          gote is free — donations just help keep it that way and don’t unlock
          any features.
        </Text>
      </Animated.ScrollView>

      {/* Full-bleed collapsing hero banner (pinned on top). The whole banner —
          lifetime accuracy + recent-games chart — is tappable, opening Stats. */}
      <Animated.View
        style={[styles.hero, { height: headerHeight, shadowOpacity, elevation }]}
      >
        <View style={styles.heroClip}>
        <Pressable ref={statsAnchor} testID="menu-stats" onPress={onStats} style={styles.flex}>
        <LinearGradient
          colors={HERO_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Recent-accuracy chart fills the area below the title, fading on collapse. */}
        <Animated.View
          style={[styles.barsLayer, { top: insets.top + 46, opacity: bigOpacity }]}
          pointerEvents="none"
        >
          <AccuracyBars data={history} counts={historyCounts} lifetime={lifetime} />
        </Animated.View>

        <View style={[styles.heroContent, { paddingTop: insets.top + 10 }]}>
          <View style={styles.heroTop}>
            <Image
              source={require('../../assets/gote.png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
            <View style={styles.flex}>
              <Text testID="menu-wordmark" style={styles.heroTitle}>gote</Text>
              <Animated.Text style={[styles.heroSub, { opacity: bigOpacity }]} numberOfLines={1}>
                {username} · {deckCount} cards
              </Animated.Text>
            </View>
            {/* Daily streak: filled flame once you've played today, outline when
                the streak is alive but today's round is still pending. */}
            {streak && (
              <View style={styles.streakChip} testID="menu-streak">
                <Icon
                  name={streak.state === 'done' ? 'flame' : 'flame-outline'}
                  size={18}
                  color={streak.count > 0 ? FLAME_TEAL : FLAME_DIM}
                />
                <Text
                  style={[
                    styles.streakCount,
                    { color: streak.count > 0 ? FLAME_TEAL : FLAME_DIM },
                  ]}
                >
                  {streak.count}
                </Text>
              </View>
            )}
          </View>

          {lifetimePct !== null && (
            <Animated.View style={[styles.statPill, { opacity: bigOpacity }]}>
              <Icon name="bar-chart-2" size={15} color="#FFFFFF" />
              <Text style={styles.statPillText}>
                {lifetimePct}% lifetime accuracy · {lifetime.correct}/
                {lifetime.answered}
              </Text>
            </Animated.View>
          )}
        </View>
        </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { paddingHorizontal: 20, paddingBottom: 44 },

  // Full-bleed collapsing hero. The shadow lives here (no overflow clipping so
  // it can spill below); the inner heroClip clips the gradient/chart to height.
  hero: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  heroClip: { flex: 1, overflow: 'hidden' },
  barsLayer: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  chart: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: BAR_GAP,
  },
  bar: { width: BAR_W },
  barFill: { flex: 1, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  heroContent: { paddingHorizontal: 22, zIndex: 1 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  // Daily-streak flame chip, top-right of the hero.
  streakChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  streakCount: { fontSize: 18, fontWeight: '900' },
  // Brand wordmark: the rounded Fredoka logotype, lowercase, per the design
  // system. The face is SemiBold (600) baked into the file, so no fontWeight.
  heroTitle: { fontSize: 38, fontFamily: 'Fredoka', color: '#FFFFFF', letterSpacing: 0.5 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },
  // The logo is white on transparent, so it sits directly on the green hero
  // (no backdrop tile needed).
  heroLogo: { width: 44, height: 44 },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    // Keep the pill (and its text) above the chart layer.
    zIndex: 2,
  },
  statPillText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    // Slight drop shadow so the text stays legible even if the trend line passes
    // directly behind the pill.
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },

  // Minimal sections
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 22,
    marginBottom: 4,
    marginLeft: 2,
  },
  group: {},
  row: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 15 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { opacity: 0.5 },
  rowDisabled: { opacity: 0.45 },
  rowIcon: { width: 28, textAlign: 'center' },
  rowTitle: { fontSize: 16.5, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 1 },

  kofi: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 30,
    paddingVertical: 10,
  },
  kofiPressed: { opacity: 0.55 },
  kofiText: { fontSize: 13.5, fontWeight: '600', color: colors.muted },
  kofiNote: {
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 6,
    paddingHorizontal: 24,
    opacity: 0.85,
  },
});
