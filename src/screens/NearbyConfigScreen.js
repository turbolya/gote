// Configuration screen for the "Nearby species" game. The player picks a
// location (GPS or place search) and which taxon groups to include, then starts
// a round of the species most typically observed there.

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import * as Location from 'expo-location';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import GroupIcon from '../components/GroupIcon';
import { useColors, useThemedStyles, groupLabel, groupIcon } from '../theme';
import { searchPlaces } from '../api';

// The groups offered for nearby play (iconic taxon → label). Ordered for a
// sensible grid; "Other animals" (Animalia) catches reptiles/amphibians/etc.
const GROUPS = [
  'Aves',
  'Mammalia',
  'Plantae',
  'Insecta',
  'Fungi',
  'Reptilia',
  'Amphibia',
  'Arachnida',
  'Mollusca',
  'Actinopterygii',
];

const RADII = [10, 25, 50, 100];

export default function NearbyConfigScreen({ onBack, onStart }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  // Selected location: { lat, lng, name } | null.
  const [place, setPlace] = useState(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [radius, setRadius] = useState(50);
  // Selected groups (default: birds + mammals + plants — the broad favourites).
  const [selected, setSelected] = useState(
    () => new Set(['Aves', 'Mammalia', 'Plantae'])
  );
  const [error, setError] = useState(null);
  const searchTimer = useRef(null);

  const onChangeQuery = (text) => {
    setQuery(text);
    setError(null);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    // Debounce the place lookup so we don't fire on every keystroke.
    searchTimer.current = setTimeout(async () => {
      const places = await searchPlaces(text);
      setResults(places);
      setSearching(false);
    }, 350);
  };

  const pickPlace = (p) => {
    setPlace({ lat: p.lat, lng: p.lng, name: p.name });
    setQuery('');
    setResults([]);
  };

  const useGps = async () => {
    setError(null);
    setGpsBusy(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Location permission denied. Search for a place instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPlace({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        name: 'My location',
      });
      setQuery('');
      setResults([]);
    } catch {
      setError('Couldn’t get your location. Search for a place instead.');
    } finally {
      setGpsBusy(false);
    }
  };

  const toggleGroup = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const canStart = !!place && selected.size > 0;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Nearby species" onBack={onBack} />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Location */}
        <Text style={styles.label}>Location</Text>

        {place ? (
          <View style={styles.chosenPlace}>
            <Icon name="map-pin" size={18} color={colors.primary} />
            <Text style={styles.chosenText} numberOfLines={2}>
              {place.name}
            </Text>
            <Pressable onPress={() => setPlace(null)} hitSlop={10}>
              <Icon name="x" size={18} color={colors.muted} />
            </Pressable>
          </View>
        ) : (
          <>
            <Pressable
              style={styles.gpsButton}
              onPress={useGps}
              disabled={gpsBusy}
            >
              {gpsBusy ? (
                <ActivityIndicator size="small" color={colors.primaryDark} />
              ) : (
                <Icon name="navigation" size={18} color={colors.primaryDark} />
              )}
              <Text style={styles.gpsText}>Use my location</Text>
            </Pressable>

            <View style={styles.searchWrap}>
              <Icon name="search" size={18} color={colors.muted} />
              <TextInput
                testID="nearby-search"
                style={styles.search}
                value={query}
                onChangeText={onChangeQuery}
                placeholder="Search for a place…"
                placeholderTextColor={colors.muted}
                autoCorrect={false}
              />
              {searching && <ActivityIndicator size="small" color={colors.muted} />}
            </View>

            {results.map((p) => (
              <Pressable
                key={p.id}
                testID={`nearby-result-${p.id}`}
                style={styles.resultRow}
                onPress={() => pickPlace(p)}
              >
                <Icon name="map-pin" size={16} color={colors.muted} />
                <Text style={styles.resultText} numberOfLines={1}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </>
        )}

        {/* Radius */}
        <Text style={[styles.label, styles.section]}>Search radius</Text>
        <View style={styles.radiusRow}>
          {RADII.map((r) => {
            const on = radius === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRadius(r)}
                style={[styles.radiusChip, on && styles.radiusChipOn]}
              >
                <Text style={[styles.radiusText, on && styles.radiusTextOn]}>
                  {r} km
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Groups */}
        <Text style={[styles.label, styles.section]}>Groups</Text>
        <View style={styles.groups}>
          {GROUPS.map((key) => {
            const on = selected.has(key);
            return (
              <Pressable
                key={key}
                testID={`nearby-group-${key}`}
                onPress={() => toggleGroup(key)}
                style={[styles.groupChip, on && styles.groupChipOn]}
              >
                <GroupIcon
                  name={groupIcon(key)}
                  size={16}
                  color={on ? colors.primaryDark : colors.muted}
                />
                <Text style={[styles.groupText, on && styles.groupTextOn]}>
                  {groupLabel(key)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {!!error && <Text style={styles.error}>{error}</Text>}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="nearby-start"
          style={[styles.start, !canStart && styles.startDisabled]}
          disabled={!canStart}
          onPress={() =>
            onStart({
              lat: place.lat,
              lng: place.lng,
              radius,
              iconicTaxa: [...selected],
            })
          }
        >
          {canStart && <Icon name="play" size={18} color={colors.onDark} />}
          <Text style={styles.startText}>
            {!place
              ? 'Pick a location'
              : selected.size === 0
              ? 'Pick a group'
              : 'Start'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 24, paddingTop: 12 },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  section: { marginTop: 28 },

  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 12,
  },
  gpsText: { color: colors.primaryDark, fontSize: 16, fontWeight: '700' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  search: { flex: 1, fontSize: 16, color: colors.text },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  resultText: { flex: 1, fontSize: 15, color: colors.text },
  chosenPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.faint,
    borderRadius: 14,
    padding: 16,
  },
  chosenText: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },

  radiusRow: { flexDirection: 'row', gap: 22 },
  radiusChip: {
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  radiusChipOn: { borderBottomColor: colors.primary },
  radiusText: { fontSize: 14.5, fontWeight: '700', color: colors.muted },
  radiusTextOn: { color: colors.primaryDark },

  groups: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, rowGap: 4 },
  groupChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 8,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  groupChipOn: { borderBottomColor: colors.primary },
  groupText: { fontSize: 14.5, fontWeight: '600', color: colors.muted },
  groupTextOn: { color: colors.primaryDark },

  error: { color: colors.wrong, marginTop: 18, fontSize: 14, lineHeight: 20 },

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
  startDisabled: { backgroundColor: '#C2CDB0' },
  startText: { color: colors.onDark, fontSize: 18, fontWeight: '800' },
});
