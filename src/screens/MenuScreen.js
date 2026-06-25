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
import { smoothPath, cumulativeAverage } from '../components/charts';
import Icon from '../components/Icon';
import { useTheme, useThemedStyles } from '../theme';
import { Appear } from '../components/anim';
import { SPEEDRUN_LIVES, KOFI_URL } from '../constants';
import { IS_E2E } from '../e2e/testMode';

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

// A subtle chart of recent games' accuracy filling the hero behind the content:
// one vertical bar per game (oldest → newest), each a white gradient fading down.
function AccuracyBars({ data = [] }) {
  const styles = useThemedStyles(makeStyles);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const { w: width, h: height } = size;
  // Grow the bars up from the baseline once they're laid out.
  const grow = useRef(new Animated.Value(IS_E2E ? 1 : 0)).current;
  const maxBars =
    width > 0 ? Math.max(1, Math.floor((width + BAR_GAP) / (BAR_W + BAR_GAP))) : 0;
  const bars = maxBars > 0 ? data.slice(-maxBars) : [];

  // Lifetime accuracy over time: the running average of every game's accuracy
  // up to that point. Computed over the FULL history (not just the visible
  // window) so the leftmost visible point still reflects all earlier games,
  // then sliced to align 1:1 with the bars.
  const lineVals = maxBars === 0 ? [] : cumulativeAverage(data).slice(-maxBars);

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
function Row({ icon, accent, title, sub, onPress, testID, first, index = 0 }) {
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v) =>
    Animated.spring(scale, { toValue: v, useNativeDriver: true, friction: 7, tension: 220 }).start();
  return (
    <Appear delay={index * 55} offset={10}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Pressable
          testID={testID}
          onPress={onPress}
          onPressIn={() => to(0.97)}
          onPressOut={() => to(1)}
          style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.rowPressed]}
        >
          <Icon name={icon} size={24} color={accent.fg} style={styles.rowIcon} />
          <View style={styles.flex}>
            <Text style={styles.rowTitle}>{title}</Text>
            <Text style={styles.rowSub}>{sub}</Text>
          </View>
          <Icon name="chevron-right" size={20} color={colors.muted} />
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
  streak,
  onSelectMode,
  onLexicon,
  onStats,
  onSettings,
  onDebugSupport,
}) {
  const { colors, accents } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const insets = useSafeAreaInsets();
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

  const playModes = [
    { key: 'all', icon: 'albums-outline', accent: accents.green, title: 'By name', sub: 'See a photo, choose its name' },
    { key: 'pick', icon: 'apps-outline', accent: accents.blue, title: 'By picture', sub: 'See a name, choose its photo' },
    { key: 'speedrun', icon: 'flash', accent: accents.amber, title: 'Speedrun', sub: `Endless cards — survive ${SPEEDRUN_LIVES} misses` },
    { key: 'nearby', icon: 'compass-outline', accent: accents.teal, title: 'Nearby species', sub: 'Learn species typical to a place' },
    { key: 'custom', icon: 'options-outline', accent: accents.violet, title: 'Custom game', sub: 'Choose how many cards and which groups' },
  ];

  return (
    <View style={styles.flex}>
      <Animated.ScrollView
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
          { useNativeDriver: false }
        )}
      >
        <Text style={styles.section}>Play</Text>
        <View style={styles.group}>
          {playModes.map(({ key, ...rest }, i) => (
            <Row key={key} {...rest} first={i === 0} index={i} testID={`mode-${key}`} onPress={() => onSelectMode(key)} />
          ))}
        </View>

        <Text style={styles.section}>Learn</Text>
        <View style={styles.group}>
          <Row first index={0} testID="mode-flash" icon="documents-outline" accent={accents.indigo} title="Flash cards" sub="Reveal the answer, then grade yourself" onPress={() => onSelectMode('flash')} />
          <Row index={1} testID="open-lexicon" icon="library-outline" accent={accents.teal} title="Lexicon" sub="Browse all your species" onPress={onLexicon} />
        </View>

        <Text style={styles.section}>Settings</Text>
        <View style={styles.group}>
          <Row first testID="open-settings" icon="settings-outline" accent={accents.slate} title="Settings" sub="Account, language and study options" onPress={onSettings} />
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

        {/* DEBUG ONLY — remove before release: opens the
            support/review popup on demand for testing. */}
        {onDebugSupport && (
          <Pressable
            testID="menu-debug-support"
            onPress={onDebugSupport}
            style={({ pressed }) => [styles.debugBtn, pressed && styles.kofiPressed]}
          >
            <Icon name="bug-outline" size={15} color={colors.muted} />
            <Text style={styles.debugText}>Debug: open support popup</Text>
          </Pressable>
        )}
      </Animated.ScrollView>

      {/* Full-bleed collapsing hero banner (pinned on top). The whole banner —
          lifetime accuracy + recent-games chart — is tappable, opening Stats. */}
      <Animated.View
        style={[styles.hero, { height: headerHeight, shadowOpacity, elevation }]}
      >
        <View style={styles.heroClip}>
        <Pressable testID="menu-stats" onPress={onStats} style={styles.flex}>
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
          <AccuracyBars data={history} />
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
    // Dark, mostly-opaque teal (the hero gradient's darkest stop) so the white
    // trend line behind the hero can't bleed through and wash out the text.
    backgroundColor: 'rgba(2,72,90,0.7)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    // Keep the pill (and its text) above the chart layer.
    zIndex: 2,
  },
  statPillText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

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

  // DEBUG ONLY — remove before release.
  debugBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginTop: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 12,
  },
  debugText: { fontSize: 13, fontWeight: '700', color: colors.muted },
});
