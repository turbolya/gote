// Settings / first-run screen: set the iNaturalist username and study options,
// then (re)load that user's observations.
//
// Design: grouped, iOS-style sections in rounded cards. Each row leads with a
// softly-tinted Ionicons tile so options are scannable and the screen feels
// modern rather than a flat wall of switches.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Switch,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { APP_VERSION } from '../changelog';
import { useTheme, useColors, useThemedStyles } from '../theme';
import { DEFAULT_LOCALE } from '../constants';
import { getCacheSize, clearCache, formatBytes } from '../cache';
import Icon from '../components/Icon';
import LanguageDropdown from '../components/LanguageDropdown';

const ISSUES_URL = 'https://github.com/turbolya/gote/issues/new';
const FEEDBACK_EMAIL = 'milder.spilled.9d@icloud.com';

// A short app/device footer appended to bug reports so we know the context.
const reportContext = () =>
  `---\nApp version: ${APP_VERSION}\nPlatform: ${Platform.OS} ${Platform.Version}\n`;

// Open a GitHub "new issue" page pre-filled with a bug-report template. The user
// submits it in their own browser session — the app never needs a GitHub token.
// (Requires a GitHub account; the email option below works for everyone.)
async function reportBugGitHub() {
  const title = '[Bug] ';
  const body =
    'Describe the bug:\n\n\n' +
    'Steps to reproduce:\n1. \n2. \n\n' +
    'What did you expect to happen?\n\n\n' +
    reportContext();
  const url =
    `${ISSUES_URL}?title=${encodeURIComponent(title)}` +
    `&body=${encodeURIComponent(body)}`;
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else throw new Error('cannot open');
  } catch {
    Alert.alert(
      'Couldn’t open the browser',
      `Please report the bug at:\n${ISSUES_URL}`
    );
  }
}

// Open the user's mail app with a pre-filled feedback email. Works without any
// account — the report just lands in our inbox.
async function sendFeedbackEmail() {
  const subject = 'Gote feedback';
  const body =
    'Your feedback or bug report:\n\n\n' + reportContext();
  const url =
    `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;
  try {
    const ok = await Linking.canOpenURL(url);
    if (ok) await Linking.openURL(url);
    else throw new Error('cannot open');
  } catch {
    Alert.alert('No mail app found', `Please email us at:\n${FEEDBACK_EMAIL}`);
  }
}

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

// A small tinted icon tile shared by every settings row.
function Tile({ icon, accent, dim }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.tile}>
      <Icon name={icon} size={22} color={dim ? colors.muted : accent.fg} />
    </View>
  );
}

// A labelled switch row inside a section card.
function SwitchRow({ icon, accent, label, hint, value, onValueChange, disabled, dim }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.row}>
      <Tile icon={icon} accent={accent} dim={dim} />
      <View style={styles.flex}>
        <Text style={[styles.rowLabel, dim && styles.rowLabelDim]}>{label}</Text>
        {!!hint && <Text style={styles.rowHint}>{hint}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor="#fff"
      />
    </View>
  );
}

// A tappable navigation row (opens a screen / external link).
function NavRow({ icon, accent, label, trailing = 'chevron-right', onPress, testID }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  return (
    <Pressable
      testID={testID}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      onPress={onPress}
    >
      <Tile icon={icon} accent={accent} />
      <Text style={[styles.rowLabel, styles.flex]}>{label}</Text>
      <Icon name={trailing} size={18} color={colors.muted} />
    </Pressable>
  );
}

export default function SettingsScreen({
  initialUsername,
  perSpecies: initialPerSpecies,
  locale: initialLocale,
  researchGrade: initialResearchGrade,
  speciesOnly: initialSpeciesOnly,
  themeMode,
  onThemeModeChange,
  error,
  sync,
  onUpdateNow,
  onChangelog,
  onLegal,
  onSave,
  onBack,
}) {
  const { colors, accents } = useTheme();
  const styles = useThemedStyles(makeStyles);
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

  // Leaving Settings applies the current settings too — otherwise language /
  // filter changes made without pressing "Load observations" would be silently
  // discarded. onSave navigates back to the menu (re-deriving the deck, and
  // re-downloading only if the account or language changed); if there's no
  // username yet there's nothing to apply, so just go back.
  const leave = () => {
    if (canSave) submit();
    else if (onBack) onBack();
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {onBack && (
        <View style={styles.topBar}>
          <Pressable testID="settings-back" onPress={leave} hitSlop={12} style={styles.back}>
            <Icon name="chevron-left" size={24} color={colors.text} />
            <Text style={styles.backText}>Menu</Text>
          </Pressable>
        </View>
      )}

      <ScrollView
        testID="settings-scroll"
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logo}>
            <Icon name="feather" size={32} color={colors.primary} />
          </View>
          <Text style={styles.title}>Gote</Text>
          <Text style={styles.subtitle}>
            Learn to recognize the species you've observed on iNaturalist.
          </Text>
        </View>

        {/* Account */}
        <Text style={styles.section}>Account</Text>
        <View style={styles.card}>
          <View style={styles.inputRow}>
            <Tile icon="at-outline" accent={accents.green} />
            <TextInput
              testID="settings-username"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              placeholder="iNaturalist username"
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
          </View>
        </View>
        <Text style={styles.accountHint}>
          Only your ~1,000 most recent observations are loaded.
        </Text>

        {!!error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          testID="settings-load"
          style={[styles.button, !canSave && styles.buttonDisabled]}
          disabled={!canSave}
          onPress={submit}
        >
          <Icon name="save-outline" size={18} color="#fff" />
          <Text style={styles.buttonText}>Save</Text>
        </Pressable>

        {/* Appearance */}
        <Text style={styles.section}>Appearance</Text>
        <View style={styles.themeRow}>
          {[
            ['light', 'Light', 'sunny-outline'],
            ['dark', 'Dark', 'moon-outline'],
            ['system', 'System', 'phone-portrait-outline'],
          ].map(([mode, label, icon]) => {
            const on = themeMode === mode;
            return (
              <Pressable
                key={mode}
                testID={`theme-${mode}`}
                onPress={() => onThemeModeChange && onThemeModeChange(mode)}
                style={[styles.themeOption, on && styles.themeOptionOn]}
              >
                <Icon name={icon} size={22} color={on ? colors.primaryDark : colors.muted} />
                <Text style={[styles.themeLabel, on && styles.themeLabelOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Study options */}
        <Text style={styles.section}>Study options</Text>
        <View style={styles.card}>
          <SwitchRow
            icon="duplicate-outline"
            accent={accents.blue}
            label="One card per species"
            hint="Avoids repeats so you see more variety."
            value={perSpecies}
            onValueChange={setPerSpecies}
          />
          <View style={styles.sep} />
          <SwitchRow
            icon="ribbon-outline"
            accent={accents.amber}
            label="Research grade only"
            hint="Only community-verified observations identified to an exact species."
            value={researchGrade}
            onValueChange={setResearchGrade}
          />
          <View style={styles.sep} />
          <SwitchRow
            icon="pricetag-outline"
            accent={accents.teal}
            label="Identified to species"
            hint={
              researchGrade
                ? 'Already included by “Research grade only”.'
                : 'Only observations identified to an exact species (any grade).'
            }
            value={researchGrade || speciesOnly}
            onValueChange={setSpeciesOnly}
            disabled={researchGrade}
            dim={researchGrade}
          />
        </View>

        <Text style={styles.section}>Species name language</Text>
        <Text style={styles.sectionHint}>
          Common names come from iNaturalist in this language (the app itself
          stays in English).
        </Text>
        <LanguageDropdown value={locale} onChange={setLocale} />

        {/* Observations sync */}
        {onUpdateNow && (
          <>
            <Text style={styles.section}>Observations</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Tile icon="sync-outline" accent={accents.indigo} />
                <View style={styles.flex}>
                  <Text style={styles.rowLabel}>Synced data</Text>
                  <Text style={styles.rowHint}>
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
                    styles.pillButton,
                    styles.pillPrimary,
                    sync && sync.state === 'syncing' && styles.pillDisabled,
                  ]}
                  disabled={sync && sync.state === 'syncing'}
                  onPress={onUpdateNow}
                >
                  {sync && sync.state === 'syncing' ? (
                    <ActivityIndicator size="small" color={colors.primaryDark} />
                  ) : (
                    <Text style={styles.pillPrimaryText}>Update</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </>
        )}

        {/* Storage */}
        <Text style={styles.section}>Storage</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Tile icon="images-outline" accent={accents.slate} />
            <View style={styles.flex}>
              <Text style={styles.rowLabel}>Downloaded photos</Text>
              <Text style={styles.rowHint}>
                {cacheBytes === null
                  ? 'Measuring…'
                  : `${formatBytes(cacheBytes)} stored on this device`}
              </Text>
            </View>
            <Pressable
              style={[
                styles.pillButton,
                styles.pillDanger,
                (clearing || !cacheBytes) && styles.pillDisabled,
              ]}
              disabled={clearing || !cacheBytes}
              onPress={onClearCache}
            >
              {clearing ? (
                <ActivityIndicator size="small" color={colors.wrong} />
              ) : (
                <Text style={styles.pillDangerText}>Empty</Text>
              )}
            </Pressable>
          </View>
        </View>

        {/* About */}
        <Text style={styles.section}>About</Text>
        <View style={styles.card}>
          {onChangelog && (
            <>
              <NavRow
                testID="settings-changelog"
                icon="sparkles-outline"
                accent={accents.violet}
                label="What's new"
                onPress={onChangelog}
              />
              <View style={styles.sep} />
            </>
          )}
          <NavRow
            icon="mail"
            accent={accents.blue}
            label="Send feedback"
            trailing="external-link"
            onPress={sendFeedbackEmail}
          />
          <View style={styles.sep} />
          <NavRow
            icon="github"
            accent={accents.slate}
            label="Report a bug on GitHub"
            trailing="external-link"
            onPress={reportBugGitHub}
          />
          {onLegal && (
            <>
              <View style={styles.sep} />
              <NavRow
                testID="settings-legal"
                icon="info"
                accent={accents.teal}
                label="Data & licensing"
                onPress={onLegal}
              />
            </>
          )}
        </View>

        <Text style={styles.footer}>
          Photos &amp; data from iNaturalist and its observers, used under each
          observer’s license. Gote is an unofficial app, not affiliated with
          iNaturalist.{'\n'}
          Gote v{APP_VERSION}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingTop: 8 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  backText: { color: colors.text, fontSize: 17, fontWeight: '700' },
  container: { padding: 20, paddingTop: 12, paddingBottom: 32 },

  header: { alignItems: 'center', marginBottom: 24 },
  logo: {
    width: 76,
    height: 76,
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
    paddingHorizontal: 12,
  },

  section: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primaryDark,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 26,
    marginBottom: 4,
    marginLeft: 2,
  },
  sectionHint: {
    fontSize: 13,
    color: colors.muted,
    marginTop: 0,
    marginBottom: 8,
    marginLeft: 2,
    lineHeight: 18,
  },
  accountHint: {
    fontSize: 12.5,
    color: colors.muted,
    marginTop: 6,
    marginLeft: 2,
    lineHeight: 17,
  },

  // Appearance: a 3-way segmented control.
  themeRow: { flexDirection: 'row', gap: 10, marginTop: 2 },
  themeOption: {
    flex: 1,
    alignItems: 'center',
    gap: 5,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  themeOptionOn: { borderColor: colors.primary, backgroundColor: colors.faint },
  themeLabel: { fontSize: 13, fontWeight: '700', color: colors.muted },
  themeLabelOn: { color: colors.primaryDark },

  // Minimal: a flat group — no container, rows divided by hairlines.
  card: {},
  sep: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 42, // align under the text, past the icon
  },

  tile: {
    width: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
  },
  rowPressed: { opacity: 0.6 },
  rowLabel: { fontSize: 16, fontWeight: '600', color: colors.text },
  rowLabelDim: { color: colors.muted },
  rowHint: { fontSize: 13, color: colors.muted, marginTop: 2, lineHeight: 18 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  input: {
    flex: 1,
    fontSize: 18,
    color: colors.text,
    paddingVertical: 4,
  },

  pillButton: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 9,
    minWidth: 78,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  pillPrimary: { borderColor: colors.primary, backgroundColor: colors.faint },
  pillPrimaryText: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  pillDanger: { borderColor: colors.wrong },
  pillDangerText: { color: colors.wrong, fontSize: 14, fontWeight: '800' },
  pillDisabled: { opacity: 0.4 },

  error: { color: colors.wrong, marginTop: 14, fontSize: 14, lineHeight: 20 },

  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    marginTop: 16,
  },
  buttonDisabled: { backgroundColor: '#A7CFDA' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '800' },

  footer: {
    textAlign: 'center',
    color: colors.muted,
    fontSize: 12,
    marginTop: 28,
    lineHeight: 18,
  },
});
