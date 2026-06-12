// Main menu: pick a game mode (or open Lexicon / Stats / Settings). Shown once a
// user's deck of observations has loaded.
//
// Design: a full-bleed green hero banner that fills the top edge-to-edge (under
// the status bar) with the account + lifetime accuracy and a background chart of
// recent games. On scroll it collapses up into a pinned compact banner. Below it,
// clean minimal sections — flat lists with hairline dividers and accent icons.

import React, { useRef, useState } from 'react';
import { View, Text, Pressable, Animated, Image, Linking, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from '../components/Icon';
import { useTheme, useThemedStyles } from '../theme';
import { SPEEDRUN_LIVES, KOFI_URL } from '../constants';

// The hero gradient is the brand green in both themes (white text reads well on
// it either way), so it's intentionally not theme-dependent. Three stops give it
// a clearly non-uniform, diagonal shade.
const HERO_GRADIENT = ['#74A82C', '#4C7818', '#345610'];

// Hero heights (excluding the top safe-area inset).
const EXPANDED = 162;
const COLLAPSED = 74;
const RANGE = EXPANDED - COLLAPSED;

// Background accuracy-chart geometry.
const BAR_W = 7;
const BAR_GAP = 4;

// A subtle chart of recent games' accuracy filling the hero behind the content:
// one vertical bar per game (oldest → newest), each a white gradient fading down.
function AccuracyBars({ data = [] }) {
  const styles = useThemedStyles(makeStyles);
  const [width, setWidth] = useState(0);
  if (!data.length) return null;
  const maxBars =
    width > 0 ? Math.max(1, Math.floor((width + BAR_GAP) / (BAR_W + BAR_GAP))) : 0;
  const bars = maxBars > 0 ? data.slice(-maxBars) : [];
  return (
    <View
      style={styles.chart}
      pointerEvents="none"
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {bars.map((pct, i) => (
        <LinearGradient
          key={i}
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.2)']}
          style={[styles.bar, { height: `${Math.max(3, pct)}%` }]}
        />
      ))}
    </View>
  );
}

export default function MenuScreen({
  username,
  deckCount,
  lifetime,
  history = [],
  onSelectMode,
  onLexicon,
  onStats,
  onSettings,
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

  const Row = ({ icon, accent, title, sub, onPress, testID, first }) => (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.row, !first && styles.rowDivider, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Icon name={icon} size={24} color={accent.fg} style={styles.rowIcon} />
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{sub}</Text>
      </View>
      <Icon name="chevron-right" size={20} color={colors.muted} />
    </Pressable>
  );

  return (
    <View style={styles.flex}>
      <Animated.ScrollView
        testID="menu-scroll"
        style={styles.flex}
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + EXPANDED + 8 },
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
            <Row key={key} {...rest} first={i === 0} testID={`mode-${key}`} onPress={() => onSelectMode(key)} />
          ))}
        </View>

        <Text style={styles.section}>Learn</Text>
        <View style={styles.group}>
          <Row first testID="mode-flash" icon="documents-outline" accent={accents.indigo} title="Flash cards" sub="Reveal the answer, then grade yourself" onPress={() => onSelectMode('flash')} />
          <Row testID="open-lexicon" icon="library-outline" accent={accents.teal} title="Lexicon" sub="Browse all your species" onPress={onLexicon} />
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
            <View style={styles.flex}>
              <Text style={styles.heroTitle}>Gote</Text>
              <Animated.Text style={[styles.heroSub, { opacity: bigOpacity }]} numberOfLines={1}>
                {username} · {deckCount} cards
              </Animated.Text>
            </View>
            <View style={styles.heroBadge}>
              <Image
                source={require('../../assets/gote.png')}
                style={styles.heroBadgeImg}
                resizeMode="contain"
              />
            </View>
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
  bar: { width: BAR_W, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
  heroContent: { paddingHorizontal: 22 },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start' },
  heroTitle: { fontSize: 34, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  heroSub: { fontSize: 15, color: 'rgba(255,255,255,0.85)', marginTop: 2, fontWeight: '600' },
  heroBadge: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadgeImg: { width: 26, height: 26 },
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
});
