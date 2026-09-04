// A dropdown for picking the species-name language. Tapping the field opens a
// bottom sheet with a searchable list of every iNaturalist locale. Built from
// core RN components only (Modal + FlatList) so it works in Expo Go.

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  TextInput,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useColors, useThemedStyles } from '../theme';
import Icon from './Icon';
import { LANGUAGES, languageByCode } from '../constants';

export default function LanguageDropdown({ value, onChange }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = languageByCode(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.native.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const choose = (code) => {
    onChange(code);
    close();
  };

  const subtitle =
    selected.native && selected.native !== selected.name
      ? selected.native
      : null;

  return (
    <>
      <Pressable testID="language-field" style={styles.field} onPress={() => setOpen(true)}>
        <View style={styles.flex}>
          <Text style={styles.fieldText}>{selected.name}</Text>
          {subtitle && <Text style={styles.fieldSub}>{subtitle}</Text>}
        </View>
        <Icon name="chevron-down" size={20} color={colors.muted} style={styles.caret} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        transparent
        onRequestClose={close}
      >
        <View style={styles.backdrop}>
          <Pressable style={styles.backdropTop} onPress={close} />
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Species name language</Text>
              <Pressable onPress={close} hitSlop={12}>
                <Text style={styles.done}>Done</Text>
              </Pressable>
            </View>

            <TextInput
              style={styles.search}
              value={query}
              onChangeText={setQuery}
              placeholder="Search languages…"
              placeholderTextColor={colors.muted}
              autoCorrect={false}
              autoCapitalize="none"
            />

            <FlatList
              data={filtered}
              keyExtractor={(l) => l.code}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              renderItem={({ item }) => {
                const on = item.code === value;
                return (
                  <Pressable
                    style={[styles.row, on && styles.rowOn]}
                    onPress={() => choose(item.code)}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.rowName, on && styles.rowNameOn]}>
                        {item.name}
                      </Text>
                      {item.native !== item.name && (
                        <Text style={styles.rowNative}>{item.native}</Text>
                      )}
                    </View>
                    {on && <Icon name="check" size={18} color={colors.primaryDark} />}
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.empty}>No languages match “{query}”.</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  fieldText: { fontSize: 18, color: colors.text, fontWeight: '600' },
  fieldSub: { fontSize: 13, color: colors.muted, marginTop: 1 },
  caret: { marginLeft: 8 },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  backdropTop: { flex: 1 },
  sheet: {
    height: '75%',
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginTop: 10,
    marginBottom: 6,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  done: { fontSize: 17, fontWeight: '700', color: colors.primaryDark },
  search: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    color: colors.text,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  rowOn: { backgroundColor: colors.faint },
  rowName: { fontSize: 17, color: colors.text, fontWeight: '600' },
  rowNameOn: { color: colors.primaryDark, fontWeight: '800' },
  rowNative: { fontSize: 14, color: colors.muted, marginTop: 1 },
  check: { fontSize: 18, color: colors.primaryDark, fontWeight: '900' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 30, fontSize: 15 },
});
