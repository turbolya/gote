// Sync across devices. Reached from Settings, and only shown at all when the
// build carries Supabase credentials (src/sync/config.js).
//
// The thing this screen exists to solve: gote signs you in anonymously so it can
// back your progress up without ever asking for an account — but an anonymous
// account lives on ONE device. Two phones signing in anonymously are two
// unrelated users. Attaching an email is what makes them the same person.
//
// States:
//   off            → offer to turn sync on
//   on, anonymous  → backing up; linking an email is tucked behind an opt-in
//                    "Connect another device" so the default view stays simple
//   awaiting code  → the verification code from the email (length set by the
//                    Supabase project, so we don't assume six digits)
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
  Alert,
  StyleSheet,
} from 'react-native';
import ScreenHeader from '../components/ScreenHeader';
import Icon from '../components/Icon';
import { useColors, useAccents, useThemedStyles } from '../theme';
import {
  getSyncStatus,
  enableSync,
  disableSync,
  linkEmail,
  signInWithEmail,
  confirmLink,
  confirmSignIn,
  afterAuthChange,
  deleteAccount,
} from '../sync';

// 'link'   — attach an address to the account this device already has
// 'signin' — join an account that lives on another device
const LINK = 'link';
const SIGNIN = 'signin';

// Seconds to wait before another code can be requested. Supabase rate-limits
// server-side too; this just stops the button inviting a request that would bounce.
const RESEND_COOLDOWN = 30;

export default function SyncScreen({ onBack, onSynced }) {
  const colors = useColors();
  const accents = useAccents();
  const styles = useThemedStyles(makeStyles);

  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState(LINK);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [stage, setStage] = useState('idle'); // idle | code
  const [connecting, setConnecting] = useState(false); // is the link form open?
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const refresh = useCallback(async () => {
    setStatus(await getSyncStatus());
  }, []);

  useEffect(() => {
    // Just read the state. Deliberately does NOT create a session — opening this
    // screen must not itself start syncing, or "off by default" would be a lie.
    refresh();
  }, [refresh]);

  // Tick the resend cooldown down to zero.
  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resetLinkFlow = useCallback(() => {
    setConnecting(false);
    setStage('idle');
    setCode('');
    setCooldown(0);
    setError(null);
  }, []);

  const turnOn = useCallback(async () => {
    setBusy(true);
    setError(null);
    await enableSync();
    setBusy(false);
    setNotice('Sync is on. Your progress is backed up, and you can add an email to share it across devices.');
    await refresh();
  }, [refresh]);

  const turnOff = useCallback(async () => {
    setBusy(true);
    await disableSync();
    setBusy(false);
    setEmail('');
    resetLinkFlow();
    setNotice('Sync is off. Everything stays on this device.');
    await refresh();
  }, [refresh, resetLinkFlow]);

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
    setCode('');
    setCooldown(RESEND_COOLDOWN);
    setNotice(`We sent a code to ${addr}. Enter it below.`);
  }, [email, mode]);

  // Bug fix: request a fresh code. Same call as the first send; disabled while
  // the cooldown is running so we don't invite a rate-limited request.
  const resend = useCallback(async () => {
    if (cooldown > 0 || busy) return;
    await send();
  }, [cooldown, busy, send]);

  const doConfirm = useCallback(async () => {
    const addr = email.trim().toLowerCase();
    const token = code.trim();
    // The code length is a Supabase project setting (6–10), so don't hard-code
    // six here — just require a plausible minimum and let verifyOtp be the judge.
    if (token.length < 6) {
      setError('Enter the code from the email.');
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
    // the other device's history — and, when signing in, its settings — are
    // already folded in when we hand back.
    const result = await afterAuthChange(mode === LINK ? 'link' : 'signin');
    setBusy(false);
    resetLinkFlow();
    setNotice(
      mode === LINK
        ? 'This device is connected. Sign in with the same address on your other devices.'
        : 'Signed in. Your progress from both devices has been merged.'
    );
    await refresh();
    if (result && onSynced) onSynced(result);
  }, [code, email, mode, refresh, onSynced, resetLinkFlow]);

  // The submit handler for the code step. LINK goes straight through — it keeps
  // this device's data. SIGNIN joins another account, which REPLACES this
  // device's settings with that account's, so make the user acknowledge that
  // first. (Play history is merged, not lost; settings are not.)
  const onConfirmPress = useCallback(() => {
    if (code.trim().length < 6) {
      setError('Enter the code from the email.');
      return;
    }
    if (mode !== SIGNIN) {
      doConfirm();
      return;
    }
    Alert.alert(
      'Sign in and replace this device’s settings?',
      'Your play history on this device will be merged into that account and '
        + 'kept.\n\nBut this device’s settings — theme, display filters, language '
        + 'and the iNaturalist account you’re studying — will be replaced by the '
        + 'ones saved to that account.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign in', style: 'destructive', onPress: doConfirm },
      ]
    );
  }, [code, mode, doConfirm]);

  const openConnect = useCallback((nextMode) => {
    setMode(nextMode);
    setConnecting(true);
    setStage('idle');
    setError(null);
    setNotice(null);
  }, []);

  // Delete the account and everything synced to it. Two-step by design: it is
  // irreversible, and the confirmation spells out exactly what goes and what
  // stays, because "delete account" reads like "delete everything" and this
  // deliberately leaves the device's own statistics alone.
  const removeAccount = useCallback(() => {
    Alert.alert(
      'Delete synced account?',
      'This permanently deletes your account and every round, statistic and '
        + 'setting synced to it, on all your devices. It cannot be undone.\n\n'
        + "This device's own statistics stay on this device. To clear those "
        + 'too, use Reset statistics in Settings afterwards.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setError(null);
            const res = await deleteAccount();
            setBusy(false);
            if (!res.ok) {
              setError(
                res.error === 'not-signed-in'
                  ? 'You are not signed in.'
                  : `Could not delete the account: ${res.error}`
              );
              return;
            }
            setEmail('');
            resetLinkFlow();
            setNotice(
              'Your account and all synced data have been deleted. This device '
                + 'keeps its own statistics.'
            );
            await refresh();
          },
        },
      ]
    );
  }, [refresh, resetLinkFlow]);

  const linked = status && status.signedIn && !status.anonymous && status.email;

  const resendLabel = cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code';

  return (
    <View style={styles.flex}>
      <ScreenHeader title="Sync across devices" onBack={onBack} />
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {!status ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : !status.on ? (
          // OFF — the default. Nothing has been uploaded and no account exists
          // until the user turns this on here.
          <>
            <Text style={styles.intro}>
              Right now everything gote knows about you stays on this device —
              nothing is uploaded anywhere.
            </Text>
            <Text style={styles.intro}>
              Turn on sync to back up your progress and share the same
              statistics, streak and species list across your devices.
            </Text>
            <Text style={styles.introSmall}>
              This stores your gameplay history on our server. No password and no
              account to create; add an email only if you want a second device.
              You can turn it off or delete everything at any time.
            </Text>
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable
              testID="sync-enable"
              style={[styles.primaryBtn, busy && styles.btnBusy]}
              onPress={turnOn}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={styles.primaryText}>Turn on sync</Text>
              )}
            </Pressable>
          </>
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
            {!!notice && <Text style={styles.notice}>{notice}</Text>}
            <Pressable
              testID="sync-turnoff"
              style={styles.secondaryBtn}
              onPress={turnOff}
              disabled={busy}
            >
              <Text style={styles.secondaryText}>Turn off sync on this device</Text>
            </Pressable>
            <Text style={styles.footnote}>
              Turning off sync stops uploading and leaves this device's progress
              exactly as it is. Your synced data stays on the server until you
              delete the account below.
            </Text>
          </>
        ) : (
          // ON, not yet linked to an email. Default view is deliberately just the
          // status + turn off + delete; linking a second device is opt-in, tucked
          // behind "Connect another device" so this screen isn't a form by default.
          <>
            <View style={styles.card}>
              <View style={styles.linkedRow}>
                <Icon name="cloud" size={20} color={colors.primary} />
                <View style={styles.linkedText}>
                  <Text style={styles.linkedTitle}>Sync is on</Text>
                  <Text style={styles.linkedEmail}>Backing up this device</Text>
                </View>
              </View>
              <Text style={styles.hint}>
                Your progress is being backed up. To share it with another phone,
                tablet or watch, connect them with an email address — no password,
                no account to create.
              </Text>
            </View>

            {!connecting ? (
              <Pressable
                testID="sync-connect"
                style={styles.connectBtn}
                onPress={() => openConnect(LINK)}
                disabled={busy}
              >
                <Icon name="link-outline" size={16} color={colors.primaryDark} />
                <Text style={styles.connectText}>Connect another device</Text>
              </Pressable>
            ) : (
              <>
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
                  {mode === SIGNIN && (
                    <View style={styles.warnBox}>
                      <Icon name="alert-triangle" size={16} color={accents.amber.fg} />
                      <Text style={styles.warnText}>
                        Signing in replaces this device’s settings — theme,
                        filters, language and the account you study — with that
                        account’s. Your play history is merged in, not lost.
                      </Text>
                    </View>
                  )}
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
                      <Text style={[styles.label, styles.labelSpaced]}>Verification code</Text>
                      <TextInput
                        testID="sync-code"
                        style={[styles.input, styles.codeInput]}
                        value={code}
                        onChangeText={setCode}
                        placeholder="Code from the email"
                        placeholderTextColor={colors.muted}
                        keyboardType="number-pad"
                        maxLength={10}
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
                    onPress={stage === 'code' ? onConfirmPress : send}
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
                    <View style={styles.codeActions}>
                      <Pressable
                        testID="sync-resend"
                        onPress={resend}
                        disabled={cooldown > 0}
                        hitSlop={8}
                      >
                        <Text style={[styles.link, cooldown > 0 && styles.linkMuted]}>
                          {resendLabel}
                        </Text>
                      </Pressable>
                      <Pressable
                        onPress={() => { setStage('idle'); setCode(''); setCooldown(0); setError(null); }}
                        hitSlop={8}
                      >
                        <Text style={styles.link}>Use a different address</Text>
                      </Pressable>
                    </View>
                  )}
                </View>

                <Text style={styles.footnote}>
                  {mode === LINK
                    ? 'Everything you have played on this device stays with you — connecting keeps it and adds a backup.'
                    : 'Your play history is merged into that account and kept — but this device’s settings (theme, filters, language and the account you study) are replaced by that account’s.'}
                </Text>

                <Pressable style={styles.cancelWrap} onPress={resetLinkFlow} hitSlop={8}>
                  <Text style={styles.link}>Cancel</Text>
                </Pressable>
              </>
            )}

            <Pressable
              testID="sync-turnoff"
              style={styles.secondaryBtn}
              onPress={turnOff}
              disabled={busy}
            >
              <Text style={styles.secondaryText}>Turn off sync on this device</Text>
            </Pressable>
          </>
        )}

        {/* Outside the linked/anonymous split on purpose. An anonymous account
            is still an account with rows on the server, so deletion has to be
            reachable without signing in first — both for guideline 5.1.1(v) and
            because someone who never linked an email still deserves a way to
            erase what was stored for them. */}
        {status && status.signedIn && (
          <View style={styles.danger}>
            <Text style={styles.dangerLabel}>Delete account</Text>
            <Text style={styles.footnote}>
              Permanently deletes your synced account and everything on it, on
              every device. This device's own statistics stay here.
            </Text>
            <Pressable
              testID="sync-delete"
              style={styles.dangerBtn}
              onPress={removeAccount}
              disabled={busy}
            >
              <Icon name="trash" size={16} color={colors.wrong} />
              <Text style={styles.dangerText}>Delete synced account</Text>
            </Pressable>
          </View>
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
    return 'That code has expired. Tap “Resend code” for a new one.';
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

const makeStyles = (colors, accents) =>
  StyleSheet.create({
    flex: { flex: 1, backgroundColor: colors.bg },
    container: { padding: 20, paddingBottom: 40 },
    spinner: { marginTop: 40 },

    intro: { fontSize: 15, lineHeight: 21, color: colors.text, marginBottom: 10 },
    introSmall: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.muted,
      marginTop: 2,
      marginBottom: 20,
    },

    tabs: { flexDirection: 'row', gap: 8, marginTop: 20, marginBottom: 16 },
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
    codeInput: { letterSpacing: 4, fontSize: 20, fontWeight: '700', textAlign: 'center' },

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
    },
    linkMuted: { color: colors.muted },
    cancelWrap: { marginTop: 16, alignItems: 'center' },
    codeActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 16,
    },

    // Opt-in reveal for the email-linking form, so the on-but-anonymous screen
    // is not a form by default.
    connectBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.faint,
      borderRadius: 14,
      paddingVertical: 13,
      marginTop: 16,
    },
    connectText: { color: colors.primaryDark, fontSize: 15, fontWeight: '700' },

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

    // Warning that signing in overwrites this device's settings.
    warnBox: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      backgroundColor: accents.amber.bg,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    warnText: { flex: 1, fontSize: 13, lineHeight: 18, color: accents.amber.fg },

    // Set apart from the rest, so an irreversible action is never one stray tap
    // away from the ordinary controls above it.
    danger: {
      marginTop: 32,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    dangerLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.wrong,
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    dangerBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1.5,
      borderColor: colors.wrong,
      borderRadius: 14,
      paddingVertical: 13,
      marginTop: 14,
    },
    dangerText: { color: colors.wrong, fontSize: 15, fontWeight: '700' },
  });
