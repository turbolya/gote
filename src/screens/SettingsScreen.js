// Settings / first-run screen: set the iNaturalist username and study options,
// then (re)load that user's observations.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../theme';
import { DEFAULT_LOCALE } from '../constants';
import { getCacheSize, clearCache, formatBytes } from '../cache';
import Icon from '../components/Icon';
import LanguageDropdown from '../components/LanguageDropdown';

// Friendly "x minutes ago" for the last-synced timestamp.
function timeAgo(ts) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? '' : 's'} ago`;
}

export default function SettingsScreen({
  initialUsername,
  perSpecies: initialPerSpecies,
  locale: initialLocale,
  researchGrade: initialResearchGrade,
  speciesOnly: initialSpeciesOnly,
  error,
  sync,
  onUpdateNow,
  onSave,
  onBack,
}) {
  const [username, setUsername] = useState(initialUsername || '');
  const [perSpecies, setPerSpecies] = useState(initialPerSpecies !== false);
  const [locale, setLocale] = useState(initialLocale || DEFAULT_LOCALE);
  const [researchGrade, setResearchGrade] = useState(!!initialResearchGrade);
  const [speciesOnly, setSpeciesOnly] = useState(!!initialSpeciesOnly);

  // Local photo-cache size; null while measuring.
  const [cacheBytes, setCacheBytes] = useState(null);
  const [clearing, setClearing] = useState(false);

  const refreshCache = useCallback(async () => {
    setCacheBytes(null);
    setCacheBytes(await getCacheSize());
  }, []);

  useEffect(() => {
    refreshCache();
  }, [refreshCache]);

  const onClearCache = async () => {
    setClearing(true);
    await clearCache();
    await refreshCache();
    setClearing(false);
  };

  const canSave = username.trim().length > 0;
  const submit = () =>
    canSave &&
    onSave(username.trim(), { perSpecies, locale, researchGrade, speciesOnly });

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {onBack && (
        <View style={styles.topBar}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.back}>
            <Icon name="chevron-left" size={22} color={colors.text} />
            <Text style={styles.backText}>Menu</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Icon name="feather" size={30} color={colors.primary} />
          </View>
          <Text style={styles.title}>Gote</Text>
          <Text style={styles.subtitle}>
            Learn to recognize the species you've observed on iNaturalist.
          </Text>
        </View>

        <Text style={styles.label}>iNaturalist username</Text>
        <TextInput
          style={styles.input}
          value={username}
          onChangeText={setUsername}
          placeholder="e.g. kueda"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.switchLabel}>One card per species</Text>
            <Text style={styles.switchHint}>
              Avoids repeats so you see more variety.
            </Text>
          </View>
          <Switch
            value={perSpecies}
            onValueChange={setPerSpecies}
            trackColor={{ true: colors.primary, false: '#CCC' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text style={styles.switchLabel}>Research grade only</Text>
            <Text style={styles.switchHint}>
              Only community-verified observations identified to an exact species.
            </Text>
          </View>
          <Switch
            value={researchGrade}
            onValueChange={setResearchGrade}
            trackColor={{ true: colors.primary, false: '#CCC' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.flex}>
            <Text
              style={[styles.switchLabel, researchGrade && styles.switchLabelDim]}
            >
              Identified to species
            </Text>
            <Text style={styles.switchHint}>
              {researchGrade
                ? 'Already included by “Research grade only”.'
                : 'Only observations identified to an exact species (any grade).'}
            </Text>
          </View>
          <Switch
            value={researchGrade || speciesOnly}
            onValueChange={setSpeciesOnly}
            disabled={researchGrade}
            trackColor={{ true: colors.primary, false: '#CCC' }}
            thumbColor="#fff"
          />
        </View>

        <Text style={[styles.label, styles.langLabel]}>
          Species name language
        </Text>
        <Text style={styles.switchHint}>
          Common names come from iNaturalist in this language (the app itself
          stays in English).
        </Text>
        <LanguageDropdown value={locale} onChange={setLocale} />

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={[styles.button, !canSave && styles.buttonDisabled]}
          disabled={!canSave}
          onPress={submit}
        >
          <Text style={styles.buttonText}>Load observations</Text>
        </Pressable>

        {onUpdateNow && (
          <>
            <Text style={[styles.label, styles.langLabel]}>Observations</Text>
            <View style={styles.cacheRow}>
              <View style={styles.flex}>
                <Text style={styles.switchLabel}>Synced data</Text>
                <Text style={styles.switchHint}>
                  {sync && sync.state === 'syncing'
                    ? 'Checking for updates…'
                    : sync && sync.state === 'error'
                    ? sync.message || 'Last update failed.'
                    : `Last updated ${timeAgo(sync && sync.syncedAt)}` +
                      (sync && sync.message ? ` · ${sync.message}` : '')}
                </Text>
              </View>
              <Pressable
                style={[
                  styles.cacheButton,
                  styles.updateButton,
                  sync && sync.state === 'syncing' && styles.cacheButtonDisabled,
                ]}
                disabled={sync && sync.state === 'syncing'}
                onPress={onUpdateNow}
              >
                {sync && sync.state === 'syncing' ? (
                  <ActivityIndicator size="small" color={colors.primaryDark} />
                ) : (
                  <Text style={styles.updateButtonText}>Update now</Text>
                )}
              </Pressable>
            </View>
          </>
        )}

        <Text style={[styles.label, styles.langLabel]}>Local cache</Text>
        <View style={styles.cacheRow}>
          <View style={styles.flex}>
            <Text style={styles.switchLabel}>Downloaded photos</Text>
            <Text style={styles.switchHint}>
              {cacheBytes === null
                ? 'Measuring…'
                : `${formatBytes(cacheBytes)} stored on this device`}
            </Text>
          </View>
          <Pressable
            style={[
              styles.cacheButton,
              (clearing || !cacheBytes) && styles.cacheButtonDisabled,
            ]}
            disabled={clearing || !cacheBytes}
            onPress={onClearCache}
          >
            {clearing ? (
              <ActivityIndicator size="small" color={colors.wrong} />
            ) : (
              <Text style={styles.cacheButtonText}>Empty cache</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footer}>
          Uses your public observations from the iNaturalist API.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 20, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 999,
    backgroundColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: colors.text,
    marginTop: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  langLabel: { marginTop: 24 },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: colors.text,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 12,
  },
  switchLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  switchLabelDim: { color: colors.muted },
  switchHint: { fontSize: 13, color: colors.muted, marginTop: 2 },
  cacheRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cacheButton: {
    borderWidth: 2,
    borderColor: colors.wrong,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 110,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cacheButtonDisabled: { opacity: 0.4 },
  updateButton: { borderColor: colors.primary },
  updateButtonText: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' },
  cacheButtonText: { color: colors.wrong, fontSize: 15, fontWeight: '700' },
  error: {
    color: colors.wrong,
    marginTop: 18,
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { backgroundColor: '#B8C99A' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  footer: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    marginTop: 24,
    paddingTop: 8,
  },
});
