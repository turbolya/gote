// What's new: the release history, rendered from src/changelog.js. Reached from
// Settings → About → What's new.

import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import { colors } from '../theme';
import { CHANGELOG, APP_VERSION } from '../changelog';

export default function ChangelogScreen({ onBack }) {
  return (
    <View style={styles.flex}>
      <ScreenHeader title="What's new" onBack={onBack} backLabel="Settings" />
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
        {CHANGELOG.map((release) => (
          <View key={release.version} style={styles.release}>
            <View style={styles.versionRow}>
              <Text style={styles.version}>v{release.version}</Text>
              {release.version === APP_VERSION && (
                <View style={styles.currentTag}>
                  <Text style={styles.currentText}>current</Text>
                </View>
              )}
              <Text style={styles.date}>{release.date}</Text>
            </View>
            {release.changes.map((change, i) => (
              <View key={i} style={styles.changeRow}>
                <Icon
                  name="check"
                  size={15}
                  color={colors.primary}
                  style={styles.changeIcon}
                />
                <Text style={styles.changeText}>{change}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 40 },
  release: { marginBottom: 28 },
  versionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  version: { fontSize: 22, fontWeight: '900', color: colors.text, letterSpacing: -0.4 },
  currentTag: {
    backgroundColor: colors.faint,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  currentText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  date: { marginLeft: 'auto', fontSize: 13, color: colors.muted },
  changeRow: { flexDirection: 'row', gap: 10, marginBottom: 8 },
  changeIcon: { marginTop: 3 },
  changeText: { flex: 1, fontSize: 15, lineHeight: 21, color: colors.text },
});
