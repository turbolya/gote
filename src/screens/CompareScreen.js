// Side-by-side comparison for a confused pair, opened from the "Species you mix
// up" list on Statistics. Shows both look-alikes together and lets the player
// write their own "tell" — the one difference that sets them apart. Writing it
// yourself is the point (active recall); gote just stores and resurfaces it.

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from 'react-native';
import Icon from '../components/Icon';
import ScreenHeader from '../components/ScreenHeader';
import { useColors, useThemedStyles } from '../theme';

function SpeciesColumn({ info }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.col}>
      {info.image ? (
        <Image source={{ uri: info.image }} style={styles.photo} resizeMode="cover" />
      ) : (
        <View style={[styles.photo, styles.photoPlaceholder]}>
          <Icon name="image" size={28} color={colors.muted} />
        </View>
      )}
      <Text style={styles.name} numberOfLines={2}>{info.name}</Text>
      {!!info.sci && <Text style={styles.sci} numberOfLines={2}>{info.sci}</Text>}
    </View>
  );
}

export default function CompareScreen({ pair, initialNote = '', onSaveNote, onDrill, onClose }) {
  const styles = useThemedStyles(makeStyles);
  const colors = useColors();
  const [text, setText] = useState(initialNote || '');

  if (!pair) return null;

  // Persist the note (trimmed; blank clears it). Called on blur and on close so
  // nothing is lost without a Save button.
  const commit = () => {
    if (onSaveNote && text !== initialNote) onSaveNote(pair.pairKey, text);
  };
  const close = () => {
    commit();
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
            <SpeciesColumn info={pair.a} />
            <View style={styles.vsWrap}>
              <Icon name="swap-horizontal" size={18} color={colors.muted} />
            </View>
            <SpeciesColumn info={pair.b} />
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
    photo: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 16,
      backgroundColor: colors.border,
    },
    photoPlaceholder: { alignItems: 'center', justifyContent: 'center' },
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
