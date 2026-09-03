// Custom game setup: choose how many cards to study and which taxon groups to
// include. Groups and their counts are derived from the loaded deck.

import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Icon from '../components/Icon';
import GroupIcon from '../components/GroupIcon';
import ScreenHeader from '../components/ScreenHeader';
import { useAnchorRef } from '../components/Tutorial';
import { useColors, useThemedStyles, groupKey, groupLabel, groupIcon } from '../theme';
import { restoreGroups, restoreTypes, restoreCount, packSetup } from '../roundsetup';

const STEP = 4;
const PRESETS = [8, 16, 32];

export default function CustomScreen({
  deck,
  onStart,
  onBack,
  title = 'Custom game',
  flags,
  // Smart play only: the question types to offer. Given as [{ key, label }],
  // all enabled to start. Absent for the other modes, which ask one kind of
  // question by definition and so have nothing to choose.
  questionTypes = null,
  // The setup this mode was last STARTED with, or null. Restored rather than
  // applied blindly — the deck it was saved against may have changed shape
  // since (see src/roundsetup.js).
  initial = null,
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // The guided tour points at Start on the Smart play screen; the other modes
  // share this component and simply register the same anchor while they are up.
  const startAnchor = useAnchorRef('custom-start');
  const isFlagged = (c) => !!(flags && flags.has(String(c.taxonId)));

  // Optionally restrict the whole picker to flagged species.
  const [flaggedOnly, setFlaggedOnly] = useState(() => !!(initial && initial.flaggedOnly));
  // Every type on by default: the mode's whole premise is that it picks for you,
  // so narrowing it is the deliberate act, not the starting point. Once the
  // player HAS narrowed it and played that round, it opens there instead —
  // otherwise a one-type round is a fresh five taps every time.
  const [types, setTypes] = useState(
    () => new Set(restoreTypes(initial, (questionTypes || []).map((t) => t.key)))
  );
  const toggleType = (key) => {
    setTypes((prev) => {
      // Refuse to turn off the last one rather than letting the player reach a
      // round with no possible question. Disabling Start instead would be a
      // dead end they have to reason their way out of.
      if (prev.size === 1 && prev.has(key)) return prev;
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // How many distinct flagged species exist in this deck (for the toggle label).
  const flaggedCount = useMemo(() => {
    const seen = new Set();
    for (const c of deck) if (isFlagged(c)) seen.add(String(c.taxonId));
    return seen.size;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deck, flags]);

  // The deck the picker operates on (all cards, or only flagged ones).
  const baseDeck = useMemo(
    () => (flaggedOnly ? deck.filter(isFlagged) : deck),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deck, flaggedOnly, flags]
  );

  // Tally available cards per group, most common first.
  const groups = useMemo(() => {
    const counts = new Map();
    for (const c of baseDeck) {
      const k = groupKey(c.iconic);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({
        key,
        count,
        label: groupLabel(key),
        icon: groupIcon(key === 'Other' ? null : key),
      }))
      .sort((a, b) => b.count - a.count);
  }, [baseDeck]);

  // Selected group keys (default: all groups selected).
  const [selected, setSelected] = useState(
    () => new Set(restoreGroups(initial, groups.map((g) => g.key)))
  );

  const available = useMemo(
    () =>
      groups.reduce((sum, g) => (selected.has(g.key) ? sum + g.count : sum), 0),
    [groups, selected]
  );

  // `available` is already in scope, so a remembered "Max" reopens as the whole
  // of TODAY's deck rather than the number of cards there were last time.
  const [count, setCount] = useState(() => restoreCount(initial, available));

  // Keep the requested count within what the current selection can offer.
  useEffect(() => {
    setCount((c) => Math.max(1, Math.min(c, available || 1)));
  }, [available]);

  const toggleGroup = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clamp = (n) => Math.max(1, Math.min(n, available));
  const canStart = available > 0;

  return (
    <View style={styles.flex}>
      <ScreenHeader title={title} onBack={onBack} />

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {flaggedCount > 0 ? (
          <Pressable
            testID="custom-flagged"
            onPress={() => setFlaggedOnly((v) => !v)}
            style={[styles.flagToggle, flaggedOnly && styles.flagToggleOn]}
          >
            <Icon
              name={flaggedOnly ? 'flag' : 'flag-outline'}
              size={16}
              color={flaggedOnly ? colors.flag : colors.muted}
            />
            <Text
              style={[styles.flagToggleText, flaggedOnly && styles.flagToggleTextOn]}
            >
              Flagged only ({flaggedCount})
            </Text>
          </Pressable>
        ) : (
          // No flagged species in this deck yet. Show the option anyway —
          // disabled, with a hint — so players discover they can drill just
          // their flagged cards once they've flagged some.
          <View testID="custom-flagged-empty" style={styles.flagEmpty}>
            <View style={styles.flagEmptyRow}>
              <Icon name="flag-outline" size={16} color={colors.muted} />
              <Text style={styles.flagToggleText}>Flagged only</Text>
            </View>
            <Text style={styles.flagEmptyHint}>
              Flag species with the flag icon in a round to study just those here.
            </Text>
          </View>
        )}

        <View style={styles.labelRow}>
          <Text style={styles.label}>Groups</Text>
          {/* Quick actions, because clearing eleven chips one at a time to
              study a single group is the common case, not the rare one. "None"
              is safe to offer without a confirm: Start already disables itself
              and says "Select a group", so an empty selection is a visible
              dead end rather than a silent one. */}
          <View style={styles.groupActions}>
            <Pressable
              testID="custom-groups-all"
              disabled={selected.size === groups.length}
              onPress={() => setSelected(new Set(groups.map((g) => g.key)))}
              hitSlop={8}
            >
              <Text
                style={[
                  styles.groupAction,
                  selected.size === groups.length && styles.groupActionOff,
                ]}
              >
                All
              </Text>
            </Pressable>
            <Pressable
              testID="custom-groups-none"
              disabled={selected.size === 0}
              onPress={() => setSelected(new Set())}
              hitSlop={8}
            >
              <Text
                style={[styles.groupAction, selected.size === 0 && styles.groupActionOff]}
              >
                None
              </Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.chips}>
          {groups.map((g) => {
            const on = selected.has(g.key);
            return (
              <Pressable
                key={g.key}
                testID={`custom-group-${g.key}`}
                onPress={() => toggleGroup(g.key)}
                style={[styles.chip, on && styles.chipOn]}
              >
                <GroupIcon
                  name={g.icon}
                  size={16}
                  color={on ? colors.primaryDark : colors.muted}
                />
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {g.label} ({g.count})
                </Text>
              </Pressable>
            );
          })}
        </View>

        {questionTypes && (
          <>
            <Text style={[styles.label, { marginTop: 28 }]}>Question types</Text>
            <View style={styles.typeWrap}>
              {questionTypes.map((t) => {
                const on = types.has(t.key);
                return (
                  <Pressable
                    key={t.key}
                    testID={`smart-type-${t.key}`}
                    onPress={() => toggleType(t.key)}
                    style={[styles.typeChip, on && styles.typeChipOn]}
                  >
                    <Icon
                      name={on ? 'checkmark-circle' : 'ellipse-outline'}
                      size={17}
                      color={on ? colors.primary : colors.muted}
                    />
                    <Text style={[styles.typeChipText, on && styles.typeChipTextOn]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.typeHint}>
              All on lets the round pick whichever fits each species best. Turn
              some off to drill one kind — the last one can’t be turned off.
            </Text>
          </>
        )}

        <Text style={[styles.label, { marginTop: 28 }]}>Number of cards</Text>
        <View style={styles.stepper}>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setCount((c) => clamp(c - STEP))}
          >
            <Icon name="minus" size={24} color={colors.primaryDark} />
          </Pressable>
          <View style={styles.countBox}>
            <Text style={styles.countNum}>{Math.min(count, available)}</Text>
            <Text style={styles.countOf}>of {available} available</Text>
          </View>
          <Pressable
            style={styles.stepBtn}
            onPress={() => setCount((c) => clamp(c + STEP))}
          >
            <Icon name="plus" size={24} color={colors.primaryDark} />
          </Pressable>
        </View>

        <View style={styles.presets}>
          {PRESETS.filter((p) => p <= available).map((p) => (
            <Pressable
              key={p}
              style={styles.preset}
              onPress={() => setCount(p)}
            >
              <Text style={styles.presetText}>{p}</Text>
            </Pressable>
          ))}
          <Pressable style={styles.preset} onPress={() => setCount(available)}>
            <Text style={styles.presetText}>Max</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          ref={startAnchor}
          testID="custom-start"
          style={[styles.start, !canStart && styles.startDisabled]}
          disabled={!canStart}
          onPress={() =>
            onStart(
              [...selected],
              Math.min(count, available),
              flaggedOnly,
              [...types],
              // What to reopen on next time. Emitted here, on Start, and
              // nowhere else: a picker the player only looked at and backed out
              // of should not change what they play next.
              packSetup({
                groups: [...selected],
                allGroups: groups.map((g) => g.key),
                types: [...types],
                allTypes: (questionTypes || []).map((t) => t.key),
                count,
                available,
                flaggedOnly,
              })
            )
          }
        >
          {canStart && <Icon name="play" size={18} color={colors.onPrimary} />}
          <Text style={styles.startText}>
            {canStart
              ? `Start • ${Math.min(count, available)} cards`
              : 'Select a group'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingTop: 16 },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  groupActions: { flexDirection: 'row', gap: 16 },
  groupAction: { fontSize: 14, fontWeight: '700', color: colors.primary },
  // Greyed rather than hidden, so the pair doesn't shift about as you select.
  groupActionOff: { color: colors.muted, opacity: 0.5 },
  typeWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  typeChipOn: { borderColor: colors.primary, backgroundColor: colors.faint },
  typeChipText: { fontSize: 14, color: colors.muted, fontWeight: '600' },
  typeChipTextOn: { color: colors.text, fontWeight: '700' },
  typeHint: { fontSize: 12, color: colors.muted, marginTop: 8, lineHeight: 17 },

  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  flagToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: 22,
  },
  flagToggleOn: { borderBottomColor: colors.flag },
  flagToggleText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  // Was a hardcoded #7A5B00, which sat at 2.9:1 on the dark background.
  flagToggleTextOn: { color: colors.flag },
  // Disabled "Flagged only" shown when the deck has no flagged species yet, so
  // the capability is discoverable before anything is flagged.
  flagEmpty: { alignSelf: 'flex-start', marginBottom: 22 },
  flagEmptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  flagEmptyHint: { fontSize: 12.5, lineHeight: 17, color: colors.muted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  chipOn: { borderBottomColor: colors.primary },
  chipText: { fontSize: 14.5, fontWeight: '600', color: colors.muted },
  chipTextOn: { color: colors.primaryDark },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  stepBtn: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBox: { flex: 1, alignItems: 'center' },
  countNum: { fontSize: 44, fontWeight: '900', color: colors.text },
  countOf: { fontSize: 13, color: colors.muted, marginTop: 2 },
  presets: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginTop: 18,
  },
  preset: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.faint,
  },
  presetText: { fontSize: 15, fontWeight: '700', color: colors.text },
  footer: { padding: 20 },
  start: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
  },
  startDisabled: { backgroundColor: colors.border },
  startText: { color: colors.onPrimary, fontSize: 18, fontWeight: '800' },
});
