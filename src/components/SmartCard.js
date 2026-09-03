// Smart play, on the menu itself.
//
// It used to be a row you tapped to reach a setup screen: two navigations
// before a single card. Since Smart play absorbed By name and By picture it is
// the only way to reach three of the four question formats, so the cost of that
// detour went up exactly as the mode became the default thing to do.
//
// So the common round is built here — which questions, how many, go — and the
// full picker (groups, flagged-only, presets) stays one tap away behind the ⋯.
//
// The type toggles are icons with no labels, which is a deliberate trade: four
// labelled chips do not fit a menu card at any text size worth supporting, and
// the labels are still there on the ⋯ screen. They carry accessibilityLabel, so
// the reading is only lost visually, not to a screen reader.

import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Slider from '@react-native-community/slider';
import Icon from './Icon';
import { useAnchorRef } from './Tutorial';
import { useColors, useThemedStyles } from '../theme';
import { restoreTypes, restoreCount, packSetup } from '../roundsetup';

// What the menu card opens on when nothing is remembered. Smaller than the
// picker's own default: this is the "I have a minute" surface, and a round you
// can finish is worth more than one you abandon.
export const CARD_COUNT = 8;

export default function SmartCard({
  available = 0, // cards the deck can offer right now
  types: questionTypes = [], // [{ key, label, icon }]
  initial = null, // the setup this mode was last started with
  unavailableTypes = null,
  disabled = false,
  disabledNote = null,
  onStart, // (types, count, setup) => void
  onOptions, // open the full picker
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // Step 4 of the tour points at the card, step 5 at its Start button.
  const cardAnchor = useAnchorRef('mode-smart');
  const startAnchor = useAnchorRef('smart-start');

  const allKeys = useMemo(() => questionTypes.map((t) => t.key), [questionTypes]);
  const blocked = useMemo(() => new Set(unavailableTypes || []), [unavailableTypes]);

  const [types, setTypes] = useState(
    () => new Set(restoreTypes(initial, allKeys, unavailableTypes))
  );
  const [count, setCount] = useState(() => restoreCount(initial, available, CARD_COUNT));

  // The deck can shrink under a remembered count (a filter, a smaller account).
  const cap = Math.max(1, available);
  const cards = Math.min(count, cap);

  const toggle = (key) => {
    if (blocked.has(key)) return;
    setTypes((prev) => {
      // Same rule as the full picker: the last one standing cannot be turned
      // off, because a round with no possible question is not a state to reach.
      const on = [...prev].filter((k) => !blocked.has(k));
      if (on.length === 1 && on[0] === key) return prev;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const activeTypes = useMemo(() => {
    const on = [...types].filter((k) => !blocked.has(k));
    return on.length ? on : allKeys.filter((k) => !blocked.has(k));
  }, [types, blocked, allKeys]);

  const start = () => {
    if (disabled || !onStart) return;
    onStart(
      activeTypes,
      cards,
      // Groups and flagged-only are not on this card, so it plays all of them
      // and says so — storing what it actually played, rather than inheriting a
      // narrowing the player cannot see from here.
      packSetup({
        groups: [],
        allGroups: [],
        types: activeTypes,
        allTypes: allKeys,
        count: cards,
        available: cap,
        flaggedOnly: false,
      })
    );
  };

  return (
    <View ref={cardAnchor} testID="mode-smart" style={styles.card} collapsable={false}>
      <View style={styles.head}>
        <Icon name="sparkles-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>Smart play</Text>
        <Pressable
          testID="smart-more"
          onPress={onOptions}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="More Smart play options"
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Icon name="ellipsis-horizontal" size={20} color={colors.muted} />
        </Pressable>
      </View>

      <View style={styles.types}>
        {questionTypes.map((t) => {
          const off = blocked.has(t.key);
          const on = !off && types.has(t.key);
          return (
            <Pressable
              key={t.key}
              testID={`menu-type-${t.key}`}
              onPress={() => toggle(t.key)}
              disabled={off}
              accessibilityRole="switch"
              accessibilityState={{ checked: on, disabled: off }}
              accessibilityLabel={off ? `${t.label} — needs a connection` : t.label}
              style={({ pressed }) => [
                styles.type,
                on && styles.typeOn,
                off && styles.typeOff,
                pressed && styles.pressed,
              ]}
            >
              <Icon
                name={off ? 'cloud-offline-outline' : t.icon}
                size={21}
                // The brand teal, the same one the slider and Start use for
                // "active" — on a dark ground the tinted fill alone is too
                // close to the card to carry the on/off reading by itself.
                color={on ? colors.primary : colors.muted}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.countRow}>
        <Slider
          testID="smart-count"
          style={styles.slider}
          minimumValue={1}
          maximumValue={cap}
          step={1}
          value={cards}
          onValueChange={setCount}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          accessibilityLabel="Number of cards"
        />
        <Text style={styles.count} testID="smart-count-value">
          {cards}
        </Text>
      </View>

      <Pressable
        ref={startAnchor}
        testID="smart-start"
        onPress={start}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => [styles.start, disabled && styles.startOff, pressed && styles.pressed]}
      >
        {!disabled && <Icon name="play" size={17} color={colors.onPrimary} />}
        <Text style={styles.startText}>
          {disabled ? disabledNote || 'Not available' : `Start • ${cards} cards`}
        </Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      padding: 14,
      paddingTop: 12,
      gap: 12,
    },
    head: { flexDirection: 'row', alignItems: 'center', gap: 9 },
    title: { flex: 1, fontSize: 16.5, fontWeight: '700', color: colors.text },
    more: { padding: 4, marginRight: -4 },
    pressed: { opacity: 0.55 },

    types: { flexDirection: 'row', gap: 8 },
    type: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
    },
    typeOn: { borderColor: colors.primary, backgroundColor: colors.faint },
    typeOff: { opacity: 0.45 },

    countRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    // Negative margins claw back the slider's own built-in padding, so the
    // track lines up with the chips above it rather than sitting inset.
    slider: { flex: 1, marginLeft: -6 },
    count: {
      minWidth: 28,
      textAlign: 'right',
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      fontVariant: ['tabular-nums'],
    },

    start: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 7,
      paddingVertical: 12,
      borderRadius: 13,
      backgroundColor: colors.primary,
    },
    startOff: { backgroundColor: colors.border },
    startText: { fontSize: 15.5, fontWeight: '800', color: colors.onPrimary },
  });
