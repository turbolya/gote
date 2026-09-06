// Side-by-side comparison for a confused pair, opened from the "Species you mix
// up" list on Statistics. Shows both look-alikes together and lets the player
// write their own "tell" — the one difference that sets them apart. Writing it
// yourself is the point (active recall); gote just stores and resurfaces it.

import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import LoadingImage from '../components/LoadingImage';
import PhotoViewer from '../components/PhotoViewer';
import ScreenHeader from '../components/ScreenHeader';
import { useColors, useThemedStyles } from '../theme';
import { fetchTaxonPhotos, toLargePhoto } from '../api';

function SpeciesColumn({ info, onOpen, busy, testID }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.col}>
      {/* The photo opens this species' curated set, the same way the grid button
          does during a round. Telling two look-alikes apart from one thumbnail
          each is the hard way round: the differences that matter are often in a
          detail one photo happens not to show. */}
      <Pressable
        testID={testID}
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={onOpen ? `More photos of ${info.name}` : undefined}
        style={({ pressed }) => [styles.photoWrap, pressed && styles.photoPressed]}
      >
        {info.image ? (
          <LoadingImage source={{ uri: info.image }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]}>
            <Icon name="image" size={28} color={colors.muted} />
          </View>
        )}
        {!!onOpen && (
          <View style={styles.photoBadge} pointerEvents="none">
            {busy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Icon name="grid" size={14} color="#FFFFFF" />
            )}
          </View>
        )}
      </Pressable>
      <Text style={styles.name} numberOfLines={2}>{info.name}</Text>
      {!!info.sci && <Text style={styles.sci} numberOfLines={2}>{info.sci}</Text>}
    </View>
  );
}

export default function CompareScreen({ pair, initialNote = '', offline = false, onSaveNote, onDrill, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const [text, setText] = useState(initialNote || '');
  // { photos, title, startIndex, grid } | null
  const [viewer, setViewer] = useState(null);
  // Which side is fetching, so only that photo shows a spinner.
  const [busy, setBusy] = useState(null);
  // Curated sets already fetched, keyed by taxon id — reopening a side should
  // not go back to the network.
  const galleries = useRef({});
  // Ids each open, so a slow fetch cannot fill a viewer the player has since
  // closed or reopened for the other species. Same guard PickImageScreen uses
  // for its per-tile browse.
  const openSeq = useRef(0);

  // Open one species' photos. Same shape as the round's grid button: the whole
  // point is the SET, so it lands on the grid rather than on a single picture
  // the player then has to swipe blind to get past.
  //
  // Offline it still opens, on the one photo already on screen — no fetch, no
  // grid. Refusing the tap entirely would make the picture look inert when
  // there is something perfectly good to show.
  const openGallery = async (key, info) => {
    if (busy) return;
    const own = info && info.image ? [info.image] : [];
    const title = info && info.name;
    if (offline || !key) {
      if (!own.length) return;
      setViewer({ photos: own.map(toLargePhoto), title, startIndex: 0, grid: false });
      return;
    }
    const cached = galleries.current[key];
    if (cached) {
      setViewer({ photos: cached, title, startIndex: 0, grid: cached.length > 1 });
      return;
    }
    const seq = ++openSeq.current;
    setBusy(key);
    let curated = [];
    try {
      curated = await fetchTaxonPhotos(key);
    } catch {
      /* best-effort — fall back to whatever is already on screen */
    }
    if (openSeq.current !== seq) return; // superseded — bail
    // The shown photo first, so the tap reads as "this one, bigger" before it
    // reads as "and the others". toLargePhoto upgrades a thumbnail URL, which
    // matters here: a species outside the deck is carrying a square thumb.
    const merged = [...new Set([...own, ...curated])].map(toLargePhoto);
    setBusy(null);
    if (!merged.length) return;
    galleries.current[key] = merged;
    setViewer({ photos: merged, title, startIndex: 0, grid: merged.length > 1 });
  };

  if (!pair) return null;

  // Persist the note (trimmed; blank clears it). Called on blur and on close so
  // nothing is lost without a Save button.
  const commit = () => {
    if (onSaveNote && text !== initialNote) onSaveNote(pair.pairKey, text);
  };
  const close = () => {
    commit();
    openSeq.current += 1; // any in-flight photo fetch is no longer wanted
    onClose && onClose();
  };
  // Straight into the drill — save the note first so it can resurface there.
  const drill = () => {
    commit();
    onDrill && onDrill(pair);
  };

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Tell them apart" onBack={close} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          testID="compare-scroll"
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {pair.count > 0 && (
            <Text style={styles.count}>
              You’ve mixed these up {pair.count} {pair.count === 1 ? 'time' : 'times'}.
            </Text>
          )}

          <View style={styles.row}>
            <SpeciesColumn
              info={pair.a}
              testID="compare-photo-a"
              busy={busy === pair.aKey}
              onOpen={() => openGallery(pair.aKey, pair.a)}
            />
            <View style={styles.vsWrap}>
              <Icon name="swap-horizontal" size={18} color={colors.muted} />
            </View>
            <SpeciesColumn
              info={pair.b}
              testID="compare-photo-b"
              busy={busy === pair.bKey}
              onOpen={() => openGallery(pair.bKey, pair.b)}
            />
          </View>

          <Text style={styles.label}>Your tell</Text>
          <Text style={styles.hint}>
            What’s the one difference that sets them apart? Writing it in your own
            words is what makes it stick.
          </Text>
          <TextInput
            testID="compare-note"
            style={styles.input}
            value={text}
            onChangeText={setText}
            onBlur={commit}
            placeholder="e.g. the leaves are toothed, not smooth"
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
          />

          {onDrill && (
            <Pressable testID="compare-drill" style={styles.drillBtn} onPress={drill}>
              <Icon name="repeat" size={18} color={colors.onPrimary} />
              <Text style={styles.drillText}>Drill this pair</Text>
            </Pressable>
          )}
          {onDrill && (
            <Text style={styles.drillHint}>
              A quick two-way drill — just these two, until you can call them apart.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <PhotoViewer
        visible={!!viewer}
        photos={viewer ? viewer.photos : []}
        title={viewer ? viewer.title : null}
        startIndex={viewer ? viewer.startIndex : 0}
        grid={!!viewer && viewer.grid}
        onClose={() => setViewer(null)}
      />
    </View>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    container: { padding: 20, paddingBottom: 40 },

    count: {
      textAlign: 'center',
      color: colors.muted,
      fontSize: 14,
      marginBottom: 18,
    },

    row: { flexDirection: 'row', alignItems: 'flex-start' },
    col: { flex: 1, alignItems: 'center' },
    photoWrap: { width: '100%' },
    photoPressed: { opacity: 0.7 },
    photo: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      backgroundColor: colors.border,
    },
    photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
    // Corner badge marking the photo as openable. Same grid glyph as the
    // more-photos button in a round, on the dark scrim that button also uses,
    // so the two read as the same affordance rather than two different ones.
    photoBadge: {
      position: 'absolute',
      right: 8,
      bottom: 8,
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
    },
    name: {
      marginTop: 10,
      fontSize: 15,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
    },
    sci: {
      fontSize: 12,
      fontStyle: 'italic',
      color: colors.muted,
      textAlign: 'center',
      marginTop: 2,
    },
    vsWrap: { alignSelf: 'center', paddingHorizontal: 12 },

    label: {
      marginTop: 28,
      fontSize: 13,
      fontWeight: '800',
      color: colors.primaryDark,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    hint: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 6,
      marginBottom: 10,
    },
    input: {
      minHeight: 96,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.text,
      fontSize: 16,
      lineHeight: 22,
      padding: 14,
    },

    drillBtn: {
      marginTop: 24,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      minHeight: 54,
      borderRadius: 16,
      backgroundColor: colors.primary,
    },
    drillText: { color: colors.onPrimary, fontSize: 17, fontWeight: '800' },
    drillHint: {
      marginTop: 10,
      color: colors.muted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
  });
