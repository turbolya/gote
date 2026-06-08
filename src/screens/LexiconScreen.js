// Lexicon: a browsable, searchable table of every species the user has observed.
// Column 1 = square thumbnail, column 2 = name. Filter by how well you know each
// species in games: well known, missed, or not yet seen in a game.
// Tapping a row opens the species detail page.

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  TextInput,
  FlatList,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { useColors, useThemedStyles } from '../theme';
import {
  filterCards,
  statusCounts,
  uniqueByTaxon,
  displayName,
  genusOf,
} from '../lexicon';

const FLAG_ON = '#E0A800';

export default function LexiconScreen({
  cards,
  speciesStats,
  onBack,
  onSelect,
  flags,
  onToggleFlag,
}) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // The three knowledge-status filters. `icon`/`tint` give each a monotone glyph.
  const STATUSES = [
    { key: 'good', label: 'Known', icon: 'check-circle', tint: colors.correct },
    { key: 'missed', label: 'Missed', icon: 'alert-circle', tint: colors.wrong },
    { key: 'new', label: 'Not seen', icon: 'circle', tint: colors.muted },
  ];
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState(null); // null = all
  const [flagged, setFlagged] = useState(false);

  const isFlagged = (c) => !!(flags && flags.has(String(c.taxonId)));

  const species = useMemo(() => uniqueByTaxon(cards), [cards]);
  const counts = useMemo(
    () => statusCounts(cards, speciesStats),
    [cards, speciesStats]
  );
  const flaggedCount = useMemo(
    () => species.filter(isFlagged).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [species, flags]
  );

  // If every flagged species gets unflagged, drop the (now-empty) filter.
  const flaggedActive = flagged && flaggedCount > 0;

  const rows = useMemo(
    () =>
      filterCards(cards, {
        query,
        status,
        speciesStats,
        flagged: flaggedActive,
        flags,
      }),
    [cards, query, status, speciesStats, flaggedActive, flags]
  );

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Lexicon" onBack={onBack} />

      {/* Search */}
      <View style={styles.searchWrap}>
        <Icon name="search" size={18} color={colors.muted} />
        <TextInput
          testID="lexicon-search"
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder={`Search ${species.length} species…`}
          placeholderTextColor={colors.muted}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Icon name="x" size={18} color={colors.muted} />
          </Pressable>
        )}
      </View>

      {/* Status filter chips */}
      <View style={styles.filterRow}>
        {STATUSES.map((s) => {
          const on = status === s.key;
          return (
            <Pressable
              key={s.key}
              testID={`lexicon-filter-${s.key}`}
              onPress={() => setStatus(on ? null : s.key)}
              style={[styles.filterChip, on && styles.filterChipOn]}
            >
              <Icon
                name={s.icon}
                size={15}
                color={on ? s.tint : colors.muted}
              />
              <Text style={[styles.filterText, on && styles.filterTextOn]}>
                {s.label}
              </Text>
              <Text style={[styles.filterCount, on && styles.filterTextOn]}>
                {counts[s.key]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Flagged filter (only once at least one species is flagged) */}
      {flaggedCount > 0 && (
        <View style={styles.flagFilterRow}>
          <Pressable
            testID="lexicon-filter-flagged"
            onPress={() => setFlagged((v) => !v)}
            style={[styles.flagFilterChip, flaggedActive && styles.flagFilterChipOn]}
          >
            <Icon
              name={flaggedActive ? 'flag' : 'flag-outline'}
              size={15}
              color={flaggedActive ? FLAG_ON : colors.muted}
            />
            <Text style={[styles.filterText, flaggedActive && styles.filterTextOn]}>
              Flagged
            </Text>
            <Text style={[styles.filterCount, flaggedActive && styles.filterTextOn]}>
              {flaggedCount}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Results table */}
      <FlatList
        data={rows}
        keyExtractor={(c) => String(c.taxonId ?? c.scientific)}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            testID={`lexicon-row-${item.taxonId}`}
            style={styles.row}
            onPress={() => onSelect(item)}
          >
            <Image
              source={{ uri: item.image }}
              style={styles.thumb}
              resizeMode="cover"
            />
            <View style={styles.rowText}>
              <Text style={styles.name} numberOfLines={1}>
                {displayName(item)}
              </Text>
              <Text style={styles.sci} numberOfLines={1}>
                {item.common ? item.scientific : genusOf(item)}
              </Text>
            </View>
            {onToggleFlag && (
              <Pressable
                testID={`lexicon-flag-${item.taxonId}`}
                onPress={() => onToggleFlag(item.taxonId)}
                hitSlop={10}
                style={styles.flagBtn}
              >
                <Icon
                  name={isFlagged(item) ? 'flag' : 'flag-outline'}
                  size={20}
                  color={isFlagged(item) ? FLAG_ON : colors.muted}
                />
              </Pressable>
            )}
            <Icon name="chevron-right" size={20} color={colors.muted} />
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            {status
              ? 'No species in this category yet.'
              : 'No species match your search.'}
          </Text>
        }
      />
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 8,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  search: { flex: 1, fontSize: 16, color: colors.text },

  filterRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  filterChipOn: { borderBottomColor: colors.primary },
  filterText: { fontSize: 13.5, fontWeight: '700', color: colors.muted },
  filterTextOn: { color: colors.primaryDark },
  filterCount: { fontSize: 13, fontWeight: '700', color: colors.muted },

  flagFilterRow: { flexDirection: 'row', paddingHorizontal: 20, marginTop: 6 },
  flagFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  flagFilterChipOn: { borderBottomColor: FLAG_ON },

  listContent: { paddingTop: 8, paddingBottom: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 10,
    marginHorizontal: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 8,
    backgroundColor: colors.faint,
  },
  rowText: { flex: 1 },
  flagBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  sci: { fontSize: 13, fontStyle: 'italic', color: colors.muted, marginTop: 1 },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 15,
    marginTop: 40,
    paddingHorizontal: 20,
  },
});
