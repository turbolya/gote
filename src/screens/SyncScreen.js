// Sync across devices. Reached from Settings, and only shown at all when the
// build carries Supabase credentials (src/sync/config.js).
//
// The thing this screen exists to solve: gote signs you in anonymously so it can
// back your progress up without ever asking for an account — but an anonymous
// account lives on ONE device. Two phones signing in anonymously are two
// unrelated users. Attaching an email is what makes them the same person.
//
// Three states:
//   anonymous      → offer to connect (link) or to join an existing account
//   awaiting code  → six digits from the email
//   linked         → show the address, offer to sign out
//
// Deliberately plain: no password to forget, no account to create up front, and
// playing never requires any of it.

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import { useColors, useThemedStyles } from '../theme';
import {
  getSyncStatus,
  linkEmail,
  signInWithEmail,
  confirmLink,
  confirmSignIn,
  afterAuthChange,
  signOutAndReset,
  ensureSession,
} from '../sync';

// 'link'   — attach an address to the account this device already has
// 'signin' — join an account that lives on another device
const LINK = 'link';
const SIGNIN = 'signin';

export default function SyncScreen({ onBack, onSynced }) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);

  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState(LINK);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('idle'); // idle | code
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    setStatus(await getSyncStatus());
  }, []);

  useEffect(() => {
    // Make sure a session exists before reporting state, or a first visit shows
    // "not signed in" purely because sync hasn't run yet.
    (async () => {
      await ensureSession();
      await refresh();
    })();
  }, [refresh]);

  const send = useCallback(async () => {
    const addr = email.trim().toLowerCase();
    if (!addr || !addr.includes('@')) {
      setError('Enter an email address.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = mode === LINK ? await linkEmail(addr) : await signInWithEmail(addr);
    setBusy(false);
    if (!res.ok) {
      setError(friendlyError(res.error, mode));
      return;
    }
    setStage('code');
    setNotice(`We sent a 6-digit code to ${addr}.`);
  }, [email, mode]);

  const confirm = useCallback(async () => {
    const addr = email.trim().toLowerCase();
    const token = code.trim();
    if (token.length < 6) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    const res = mode === LINK ? await confirmLink(addr, token) : await confirmSignIn(addr, token);
    if (!res.ok) {
      setBusy(false);
      setError(friendlyError(res.error, mode));
      return;
    }
    // Reconciles the account switch (see afterAuthChange) and runs a sync, so
    // the other device's history is already folded in when we hand back.
    const merged = await afterAuthChange();
    setBusy(false);
    setStage('idle');
    setCode('');
    setNotice(
      mode === LINK
        ? 'This device is connected. Sign in with the same address on your other devices.'
        : 'Signed in. Your progress from both devices has been merged.'
    );
    await refresh();
    if (merged && onSynced) onSynced(merged);
  }, [code, email, mode, refresh, onSynced]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    await signOutAndReset();
    await ensureSession();
    setBusy(false);
    setEmail('');
    setNotice('Signed out. This device keeps its own progress.');
    await refresh();
  }, [refresh]);

  const linked = status && status.signedIn && !status.anonymous && status.email;

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Sync across devices" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!status ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : linked ? (
          <>
            <View style={styles.card}>
              <View style={styles.linkedRow}>
                <Icon name="check-circle" size={20} color={colors.correct} />
                <View style={styles.linkedText}>
                  <Text style={styles.linkedTitle}>Connected</Text>
                  <Text style={styles.linkedEmail}>{status.email}</Text>
                </View>
              </View>
              <Text style={styles.hint}>
                Your rounds, statistics and streak are shared with every device
                signed in to this address. Sign in with it on another device to
                bring them together.
              </Text>
            </View>
            {status.queued > 0 && (
              <Text style={styles.queued}>
                {status.queued} round{status.queued === 1 ? '' : 's'} waiting to
                upload — they'll go up next time you're online.
              </Text>
            )}
            <Pressable
              testID="sync-signout"
              style={styles.secondaryBtn}
              onPress={disconnect}
              disabled={busy}
            >
              <Text style={styles.secondaryText}>Sign out on this device</Text>
            </Pressable>
            <Text style={styles.footnote}>
              Signing out leaves this device's progress exactly as it is. Nothing
              is deleted.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.intro}>
              gote keeps your progress on your device. Add an email address and
              it's backed up too — and the same statistics, streak and species
              list appear on your other devices.
            </Text>
            <Text style={styles.introSmall}>
              No password, no account to create. We only use the address to
              recognise your devices.
            </Text>

            <View style={styles.tabs}>
              <Tab
                label="This is my first device"
                active={mode === LINK}
                onPress={() => { setMode(LINK); setStage('idle'); setError(null); setNotice(null); }}
                styles={styles}
              />
              <Tab
                label="I already have gote elsewhere"
                active={mode === SIGNIN}
                onPress={() => { setMode(SIGNIN); setStage('idle'); setError(null); setNotice(null); }}
                styles={styles}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                testID="sync-email"
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                editable={stage === 'idle' && !busy}
              />

              {stage === 'code' && (
                <>
                  <Text style={[styles.label, styles.labelSpaced]}>6-digit code</Text>
                  <TextInput
                    testID="sync-code"
                    style={[styles.input, styles.codeInput]}
                    value={code}
                    onChangeText={setCode}
                    placeholder="123456"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={6}
                    textContentType="oneTimeCode"
                    editable={!busy}
                  />
                </>
              )}

              {!!notice && <Text style={styles.notice}>{notice}</Text>}
              {!!error && <Text style={styles.error}>{error}</Text>}

              <Pressable
                testID="sync-submit"
                style={[styles.primaryBtn, busy && styles.btnBusy]}
                onPress={stage === 'code' ? confirm : send}
                disabled={busy}
              >
                {busy ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={styles.primaryText}>
                    {stage === 'code'
                      ? 'Confirm'
                      : mode === LINK
                        ? 'Connect this device'
                        : 'Send me a code'}
                  </Text>
                )}
              </Pressable>

              {stage === 'code' && !busy && (
                <Pressable onPress={() => { setStage('idle'); setCode(''); setError(null); }}>
                  <Text style={styles.link}>Use a different address</Text>
                </Pressable>
              )}
            </View>

            <Text style={styles.footnote}>
              {mode === LINK
                ? 'Everything you have played on this device stays with you — connecting keeps it and adds a backup.'
                : 'Your progress on this device is merged into that account, not replaced.'}
            </Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Tab({ label, active, onPress, styles }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabOn]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextOn]}>{label}</Text>
    </Pressable>
  );
}

// Supabase's messages are accurate but written for developers. Translate the
// ones a user can actually hit; pass anything else through rather than hiding
// a real problem behind a vague apology.
function friendlyError(message, mode) {
  const m = String(message || '').toLowerCase();
  if (m.includes('already been registered') || m.includes('already registered')) {
    return 'That address is already used by another device. Choose "I already have gote elsewhere" to sign in with it.';
  }
  if (m.includes('signups not allowed') || m.includes('user not found')) {
    return mode === SIGNIN
      ? "We don't know that address yet. Connect your first device with it, then sign in here."
      : message;
  }
  if (m.includes('token has expired') || m.includes('expired')) {
    return 'That code has expired. Request a new one.';
  }
  if (m.includes('invalid') && m.includes('token')) {
    return "That code doesn't match. Check the email and try again.";
  }
  if (m.includes('rate limit') || m.includes('too many')) {
    return 'Too many attempts just now. Wait a minute and try again.';
  }
  if (m === 'sync-disabled') return 'Sync is not available in this build.';
  return message || 'Something went wrong. Try again.';
}

const makeStyles = (colors) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    container: { padding: 20, paddingBottom: 40 },
    spinner: { marginTop: 40 },

    intro: { fontSize: 15, lineHeight: 21, color: colors.text },
    introSmall: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.muted,
      marginTop: 8,
      marginBottom: 18,
    },

    tabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    tab: {
      flex: 1,
      paddingVertical: 10,
      paddingHorizontal: 10,
      borderRadius: 12,
      backgroundColor: colors.faint,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tabOn: { backgroundColor: colors.primary, borderColor: colors.primary },
    tabText: { fontSize: 13, fontWeight: '600', color: colors.text, textAlign: 'center' },
    tabTextOn: { color: colors.onPrimary },

    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.primaryDark,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      marginBottom: 6,
    },
    labelSpaced: { marginTop: 16 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.bg,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      color: colors.text,
    },
    codeInput: { letterSpacing: 6, fontSize: 20, fontWeight: '700', textAlign: 'center' },

    notice: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 12 },
    error: { fontSize: 13, lineHeight: 19, color: colors.wrong, marginTop: 12 },

    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 16,
      minHeight: 50,
      justifyContent: 'center',
    },
    btnBusy: { opacity: 0.7 },
    primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '800' },
    link: {
      color: colors.primaryDark,
      fontSize: 13,
      fontWeight: '600',
      textAlign: 'center',
      marginTop: 14,
    },

    linkedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    linkedText: { flex: 1 },
    linkedTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
    linkedEmail: { fontSize: 14, color: colors.muted, marginTop: 2 },
    hint: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 14 },
    queued: { fontSize: 13, lineHeight: 19, color: colors.muted, marginTop: 14 },

    secondaryBtn: {
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: 14,
      paddingVertical: 13,
      alignItems: 'center',
      marginTop: 20,
    },
    secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },

    footnote: { fontSize: 12, lineHeight: 18, color: colors.muted, marginTop: 14 },
  });
