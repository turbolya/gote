// gote — a card-based learning game built on the iNaturalist API.
//
// Flow (a small state machine, no navigation library needed):
//
//   loading ─► menu ─┬─► study ─► results ─► menu
//      ▲             │     (all / 16 / custom / speedrun)
//      │             ├─► custom ─► study ─► results
//      └─ settings ◄─┘   (set username & options, then (re)load the deck)
//
// Cards are a user's public iNaturalist observations: photo on the front,
// species name on the back. You self-grade each card; the app tracks your
// score and lets you re-study the ones you missed.

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  AppState,
  StatusBar as RNStatusBar,
  Platform,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { Ionicons, MaterialCommunityIcons, FontAwesome5 } from '@expo/vector-icons';

import {
  fetchCards,
  fetchUpdatedCards,
  fetchTaxonPhotos,
  fetchTaxonPhotosByIds,
  fetchSimilarSpecies,
  fetchNearbyCards,
  applyFilters,
  mergeCards,
  newestUpdatedAt,
  clearTaxonCache,
  shuffle,
} from './src/api';
import {
  loadUsername,
  saveUsername,
  loadStats,
  addToStats,
  loadPrefs,
  savePrefs,
  loadSpeciesStats,
  saveSpeciesStats,
  resetStatistics,
  loadCache,
  saveCache,
  cacheMatches,
  loadFlags,
  saveFlags,
  loadHistory,
  addGameResult,
  loadStreak,
  recordStreakDay,
  streakStatus,
  loadAppliedWatchIds,
  saveAppliedWatchIds,
  loadWatchTipDismissed,
  saveWatchTipDismissed,
  addActiveDay,
} from './src/storage';
// NOTE the alias: this component already has its own `syncNow` (the
// iNaturalist observation sync, below), and a local const shadows an import of
// the same name inside the function body — silently calling the wrong one.
import {
  recordEvent,
  syncNow as syncCloud,
  scheduleSync,
  syncSettings,
  pushSettings,
  SYNC_ENABLED,
} from './src/sync';
import { SPEEDRUN_LIVES, DEFAULT_LOCALE, SUPPORT_PROMPT_CHANCE, DEFAULT_USERNAME } from './src/constants';
import { buildPickRound } from './src/quiz';
import { prefetchImages } from './src/prefetch';
import { groupKey, ThemeProvider, themeFor, resolveScheme } from './src/theme';
import { IS_E2E, IS_SHOTS } from './src/e2e/testMode';
import { E2E_CARDS } from './src/e2e/fixtures';
import { seedScreenshotStats } from './src/e2e/shotsSeed';
import { pushWatchSnapshot, subscribeWatchResults } from './src/watch';
import MenuScreen from './src/screens/MenuScreen';
import CustomScreen from './src/screens/CustomScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StudyScreen from './src/screens/StudyScreen';
import PickImageScreen from './src/screens/PickImageScreen';
import ResultsScreen from './src/screens/ResultsScreen';
import StatsScreen from './src/screens/StatsScreen';
import LexiconScreen from './src/screens/LexiconScreen';
import DetailScreen from './src/screens/DetailScreen';
import ChangelogScreen from './src/screens/ChangelogScreen';
import LegalScreen from './src/screens/LegalScreen';
import SyncScreen from './src/screens/SyncScreen';
import NearbyConfigScreen from './src/screens/NearbyConfigScreen';
import SplashScreen from './src/components/SplashScreen';
import SupportModal from './src/components/SupportModal';
import SwipeBackView from './src/components/SwipeBackView';
import { Appear } from './src/components/anim';

const pickRandom = (cards, n) => shuffle(cards).slice(0, n);

// After this long, re-download an account's deck from scratch on load instead of
// an incremental sync. Incremental sync only adds/updates, so observations
// deleted or made private on iNaturalist would otherwise linger forever; a
// periodic full refresh prunes them (and repairs any cache drift).
const STALE_REFRESH_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

// Keep the native launch screen up until our own (identical-looking) JS splash
// has actually painted — otherwise there's a black flash in the gap between the
// native splash auto-hiding and React rendering its first frame. We hide it
// explicitly once the JS splash lays out (or, in E2E where there is no JS
// splash, once the fonts are ready). Module-level so it runs before first paint.
ExpoSplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  // loading | settings | menu | custom | study | results
  const [screen, setScreen] = useState('loading');
  // Branded launch splash overlay; dismissed (faded out) after a moment.
  // Skipped entirely in E2E so it never covers the UI under test.
  const [showSplash, setShowSplash] = useState(!IS_E2E);
  // Support/review popup: shown on a fraction of launches once the menu loads.
  const [showSupport, setShowSupport] = useState(false);
  const supportRolledRef = useRef(false);

  // Dismiss the native launch screen exactly once, the moment our JS splash (or,
  // in E2E, the real UI) is on screen — bridging the two with no black gap.
  const nativeSplashHidden = useRef(false);
  const hideNativeSplash = useCallback(() => {
    if (nativeSplashHidden.current) return;
    nativeSplashHidden.current = true;
    ExpoSplashScreen.hideAsync().catch(() => {});
  }, []);

  // Preload every icon font up front so glyphs never render as missing-glyph
  // "?" boxes (which happens if a family's font hasn't loaded when it's first
  // used). We render a tiny placeholder until they're ready (or error out).
  const [iconFontsLoaded, iconFontError] = useFonts({
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...FontAwesome5.font,
    // Brand wordmark face (the rounded "gote" logotype on the hero + splash).
    Fredoka: require('./assets/fonts/Fredoka-SemiBold.ttf'),
  });
  const [username, setUsername] = useState('');
  const [perSpecies, setPerSpecies] = useState(true);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [researchGrade, setResearchGrade] = useState(false);
  const [speciesOnly, setSpeciesOnly] = useState(false);

  // Theme: 'light' | 'dark' | 'system'. The active palette is provided to the
  // whole tree via ThemeProvider; styles read it through useThemedStyles.
  const [themeMode, setThemeMode] = useState('system');
  const systemScheme = useColorScheme();
  const theme = useMemo(
    () => themeFor(resolveScheme(themeMode, systemScheme)),
    [themeMode, systemScheme]
  );
  const colors = theme.colors;
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusBarStyle = theme.scheme === 'dark' ? 'light' : 'dark';

  // Change + persist the theme mode (applies immediately, app-wide).
  const onThemeModeChange = useCallback(
    (mode) => {
      setThemeMode(mode);
      const next = { perSpecies, locale, researchGrade, speciesOnly, themeMode: mode };
      savePrefs(next);
      pushSettings(next);
    },
    [perSpecies, locale, researchGrade, speciesOnly]
  );
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  // Distinguishes the two things that use the loading screen: loading an
  // account's own observations vs. fetching species near a place (which draws
  // from many observers, not the current user) — so the message can match.
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [lifetime, setLifetime] = useState({ answered: 0, correct: 0 });
  // Recent games' accuracy (0–100, oldest→newest) for the menu's mini chart.
  const [history, setHistory] = useState([]);
  // Daily streak record { current, longest, lastActiveDay }; the displayed
  // state (done / at-risk / broken) is derived via streakStatus at render.
  const [streak, setStreak] = useState(null);
  // Whether the "Did you know? (Apple Watch)" menu notice has been hidden. Always
  // still shown in Settings; iPhone-only display is handled inside WatchTip.
  const [watchTipDismissed, setWatchTipDismissed] = useState(false);

  // Raw cached cards (unfiltered) for the current account, kept in a ref so sync
  // can read/merge without re-renders. `fullDeck` is the filtered view shown to
  // the game (perSpecies/researchGrade applied locally).
  const rawCardsRef = useRef([]);
  const watermarkRef = useRef(null);
  const [fullDeck, setFullDeck] = useState([]);
  // The current display-filter prefs, mirrored in a ref so async callbacks (the
  // background sync) read the user's REAL settings — not a stale closure from
  // the first render, when these were still at their useState defaults. Without
  // this, the startup sync re-derived the deck with default filters and clobbered
  // the correctly-filtered count (e.g. showed 171 instead of 107 research-grade).
  const prefsRef = useRef({ perSpecies, researchGrade, speciesOnly });
  useEffect(() => {
    prefsRef.current = { perSpecies, researchGrade, speciesOnly };
  }, [perSpecies, researchGrade, speciesOnly]);
  // Sync status for the Settings UI: { state: idle|syncing|done|error, syncedAt, message }
  const [sync, setSync] = useState({ state: 'idle', syncedAt: null, message: null });
  // The card whose detail page is open, rendered as an overlay ON TOP of the
  // current screen (Lexicon / Statistics / Results) rather than replacing it —
  // so that screen stays mounted and its scroll position and filters are
  // preserved when the detail page is dismissed. null = no detail open.
  const [detailCard, setDetailCard] = useState(null);

  // Species the user has flagged, as a Set of taxon-id strings, scoped to the
  // current account. Mirrored in a ref so the game launchers (which filter by
  // flag) always read the latest set. `flags` always corresponds to the loaded
  // username; we persist under that name (read from a ref to avoid stale state).
  const [flags, setFlags] = useState(() => new Set());
  const flagsRef = useRef(flags);
  useEffect(() => {
    flagsRef.current = flags;
  }, [flags]);
  const usernameRef = useRef(username);
  useEffect(() => {
    usernameRef.current = username;
  }, [username]);

  // When there is no JS splash to wait for (E2E), drop the native splash as soon
  // as the fonts are ready so the UI under test isn't left covered.
  useEffect(() => {
    if ((iconFontsLoaded || iconFontError) && !showSplash) hideNativeSplash();
  }, [iconFontsLoaded, iconFontError, showSplash, hideNativeSplash]);

  // Once per launch, when the menu first appears, roll the support/review popup
  // (~1 in 10 launches). Never in E2E, so the test runs stay deterministic.
  useEffect(() => {
    if (screen === 'menu' && !supportRolledRef.current && !IS_E2E) {
      supportRolledRef.current = true;
      if (Math.random() < SUPPORT_PROMPT_CHANCE) setShowSupport(true);
    }
  }, [screen]);

  // Toggle a species' flag and persist (per username). Functional update avoids
  // stale state.
  const toggleFlag = useCallback((taxonId) => {
    if (taxonId == null) return;
    const key = String(taxonId);
    setFlags((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      saveFlags(usernameRef.current, [...next]);
      return next;
    });
  }, []);
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState([]);
  const [roundLabel, setRoundLabel] = useState('');
  const [mode, setMode] = useState('all'); // all | 16 | custom | speedrun | pick
  const [lives, setLives] = useState(SPEEDRUN_LIVES);
  // Bumped whenever Speedrun loops back to index 0 on a reshuffle. With a
  // single-card deck the index and card id don't change on the loop, so the
  // study screen's card-identity key wouldn't change and its per-card state
  // (phase/photo) would never reset — leaving the round stuck on the answered
  // card. Including this in the key forces the reset.
  const [loopNonce, setLoopNonce] = useState(0);

  // "Pick the right one" mode: each round's options are fetched per-card.
  const [pickRound, setPickRound] = useState(null);
  const [pickLoading, setPickLoading] = useState(false);
  const [pickError, setPickError] = useState(null);
  // Guards against a slow fetch landing after the user already moved on.
  const pickReqRef = useRef(0);

  // Per-species tallies for the statistics page. `speciesRef` is the live copy
  // we mutate as cards are graded; `speciesStats` is the snapshot for display.
  const [speciesStats, setSpeciesStats] = useState({});
  const speciesRef = useRef({});
  // Just THIS round's per-species deltas, for cross-device sync. speciesRef is
  // a running lifetime total and can't be uploaded as a delta without
  // double-counting everything the player has ever answered.
  const roundDeltaRef = useRef({});

  // How to restart the current mode (used by the "Play again" button).
  const replayRef = useRef(() => {});

  // Guards finishRound against double-firing (e.g. double-tapping "End", or
  // "End" racing the final-card grade), which would double-count lifetime stats
  // and add a duplicate streak/history entry. Reset when a round starts.
  const finishedRef = useRef(false);

  // AbortController for the in-progress full download / nearby fetch, so the
  // loading screen's Cancel button can stop it. Set when a download starts.
  const abortRef = useRef(null);
  const cancelLoad = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  // Latest "leave Settings" handler, registered by SettingsScreen while it's
  // mounted. Lets the swipe-back gesture apply pending settings on exit exactly
  // like the header back button (which routes through SettingsScreen.leave) —
  // otherwise swiping away silently discards edits (e.g. a language change).
  const settingsLeaveRef = useRef(null);

  // The pool of candidate cards for the current round's multiple-choice
  // distractors. Set per round: the account deck for account-based modes, the
  // nearby deck for "Nearby species", and carried over when revisiting missed
  // cards (so e.g. a nearby revisit never draws distractors from the unrelated
  // account deck). Full cards, so StudyScreen can pick taxonomically similar
  // distractors using each card's ancestry.
  const [roundPool, setRoundPool] = useState([]);

  // Re-derive the filtered deck from the raw cache + the given display prefs.
  const applyCurrentFilters = useCallback((prefs) => {
    const filtered = applyFilters(rawCardsRef.current, {
      perSpecies: prefs.perSpecies,
      researchGrade: prefs.researchGrade,
      speciesOnly: prefs.speciesOnly,
    });
    setFullDeck(filtered);
    return filtered;
  }, []);

  // Persist the raw cards + watermark for this account.
  const persistCache = useCallback((name, loc) => {
    const syncedAt = Date.now();
    saveCache({
      username: name,
      locale: loc,
      cards: rawCardsRef.current,
      watermark: watermarkRef.current,
      syncedAt,
    });
    return syncedAt;
  }, []);

  // Incremental sync: fetch only what changed since the watermark, merge, save.
  // Runs quietly (no loading screen) — used on startup and the manual button.
  const syncNow = useCallback(
    async (name, loc) => {
      if (!name) return;
      setSync((s) => ({ ...s, state: 'syncing', message: null }));
      try {
        const updated = await fetchUpdatedCards(name, {
          locale: loc,
          updatedSince: watermarkRef.current,
        });
        // iNat's `updated_since` is INCLUSIVE, so the card(s) at the watermark
        // come back on every sync. Keep only cards strictly newer than the
        // watermark as real changes — otherwise a no-op sync always reports
        // "Updated 1 observation." (When there's no watermark this is a full
        // fetch and wm is -Infinity, so everything is kept.)
        const wm = watermarkRef.current ? Date.parse(watermarkRef.current) : -Infinity;
        const changed = updated.filter(
          (c) => c.updatedAt && Date.parse(c.updatedAt) > wm
        );
        if (changed.length > 0) {
          rawCardsRef.current = mergeCards(rawCardsRef.current, changed);
          const newWatermark = newestUpdatedAt(rawCardsRef.current);
          if (newWatermark) watermarkRef.current = newWatermark;
          applyCurrentFilters(prefsRef.current);
        }
        const syncedAt = persistCache(name, loc);
        setSync({
          state: 'done',
          syncedAt,
          message:
            changed.length > 0
              ? `Updated ${changed.length} observation${changed.length === 1 ? '' : 's'}.`
              : 'Already up to date.',
        });
      } catch (e) {
        setSync((s) => ({
          ...s,
          state: 'error',
          message: e.message || 'Sync failed.',
        }));
      }
    },
    [applyCurrentFilters, persistCache]
  );

  // Full download for a brand-new account (or forced refresh). Shows the loading
  // screen, replaces the cache, then lands on `landOn` (the menu by default; the
  // very first run lands on Settings so the user can set their own username).
  const fullDownload = useCallback(
    async (name, prefs, { landOn = 'menu' } = {}) => {
      setError(null);
      setLoadingNearby(false);
      setProgress({ loaded: 0, total: 0 });
      // Set the username up front so the loading screen shows the NEW user, not
      // the previous one (restored below if the download fails).
      const prevUser = usernameRef.current;
      setUsername(name);
      setScreen('loading');
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const cards = await fetchCards(name, {
          locale: prefs.locale,
          signal: controller.signal,
          onProgress: (loaded, total) => setProgress({ loaded, total }),
        });
        // Only adopt the new account's flags once its deck actually loaded.
        setFlags(new Set(await loadFlags(name)));
        rawCardsRef.current = cards;
        watermarkRef.current = newestUpdatedAt(cards);
        applyCurrentFilters(prefs);
        await saveUsername(name);
        const syncedAt = persistCache(name, prefs.locale);
        setSync({ state: 'done', syncedAt, message: null });
        setScreen(landOn);
      } catch (e) {
        // If another account's deck is still loaded, restore that identity so
        // the username (and the flags saved under it) keep matching the deck.
        if (rawCardsRef.current.length > 0) setUsername(prevUser);
        if (e && e.name === 'AbortError') {
          // User cancelled: go back with no error, to the menu if a deck is
          // still loaded, otherwise Settings to pick a username.
          setScreen(rawCardsRef.current.length > 0 ? 'menu' : 'settings');
        } else {
          setError(e.message || 'Something went wrong. Please try again.');
          setScreen('settings');
        }
      } finally {
        abortRef.current = null;
      }
    },
    [applyCurrentFilters, persistCache]
  );

  // Decide how to load an account: use the cache if it matches (instant, then
  // background sync), otherwise do a full download.
  const loadAccount = useCallback(
    async (name, prefs, cache) => {
      const usable = cache || (await loadCache());
      const cacheOk = cacheMatches(usable, name, prefs.locale);
      // Once the cache is old enough, re-download in full so deletions on
      // iNaturalist are reflected (incremental sync can't remove cards).
      const stale = cacheOk && Date.now() - (usable.syncedAt || 0) > STALE_REFRESH_MS;
      if (cacheOk && !stale) {
        // Load this account's flagged species (per-username, like the obs
        // cache). The full-download path loads them itself on success — never
        // up front, so a failed account switch can't leave the old deck paired
        // with the new account's flags.
        setFlags(new Set(await loadFlags(name)));
        rawCardsRef.current = usable.cards;
        watermarkRef.current = usable.watermark || newestUpdatedAt(usable.cards);
        applyCurrentFilters(prefs);
        setSync({ state: 'idle', syncedAt: usable.syncedAt || null, message: null });
        setUsername(name);
        setScreen('menu');
        // Quietly catch up on anything that changed since we cached.
        syncNow(name, prefs.locale);
      } else {
        await fullDownload(name, prefs);
      }
    },
    [applyCurrentFilters, fullDownload, syncNow]
  );

  // Restore saved state on first launch.
  useEffect(() => {
    (async () => {
      const [savedUser, savedStats, savedPrefs, savedSpecies, savedCache, savedHistory, savedStreak, savedWatchTip] =
        await Promise.all([
          loadUsername(),
          loadStats(),
          loadPrefs(),
          loadSpeciesStats(),
          loadCache(),
          loadHistory(),
          loadStreak(),
          loadWatchTipDismissed(),
        ]);
      if (savedStats) setLifetime(savedStats);
      if (savedHistory && savedHistory.length) setHistory(savedHistory);
      if (savedStreak) setStreak(savedStreak);
      setWatchTipDismissed(savedWatchTip);
      // Flags are loaded per-account inside loadAccount (below).
      speciesRef.current = savedSpecies || {};
      setSpeciesStats(speciesRef.current);
      const ps = savedPrefs && typeof savedPrefs.perSpecies === 'boolean'
        ? savedPrefs.perSpecies
        : true;
      const loc = (savedPrefs && savedPrefs.locale) || DEFAULT_LOCALE;
      const rg = !!(savedPrefs && savedPrefs.researchGrade);
      const so = !!(savedPrefs && savedPrefs.speciesOnly);
      const tm = (savedPrefs && savedPrefs.themeMode) || 'system';
      setPerSpecies(ps);
      setLocale(loc);
      setResearchGrade(rg);
      setSpeciesOnly(so);
      setThemeMode(tm);
      // Seed the ref now: the startup background sync fires before React re-renders
      // with these values, and must filter by the saved prefs, not the defaults.
      prefsRef.current = { perSpecies: ps, researchGrade: rg, speciesOnly: so };
      // Cross-device sync. A no-op unless the build carries Supabase
      // credentials (src/sync/config.js). Fired here, once local state is
      // seeded, so anything folded in from another device isn't clobbered by
      // the restore — and NOT awaited, because a slow network must never delay
      // the menu appearing.
      if (SYNC_ENABLED) {
        syncCloud().then((merged) => {
          if (!merged) return;
          setLifetime(merged.lifetime);
          speciesRef.current = merged.species;
          setSpeciesStats({ ...merged.species });
          setHistory(merged.history);
          setStreak(merged.streak);
        });
        syncSettings();
      }
      // E2E: load the fixture deck offline and jump straight to the menu.
      if (IS_E2E) {
        setUsername('e2e-tester');
        rawCardsRef.current = E2E_CARDS;
        watermarkRef.current = null;
        applyCurrentFilters({ perSpecies: ps, researchGrade: rg, speciesOnly: so });
        setScreen('menu');
        return;
      }
      if (savedUser) {
        setUsername(savedUser);
        loadAccount(
          savedUser,
          { perSpecies: ps, locale: loc, researchGrade: rg, speciesOnly: so },
          savedCache
        );
      } else {
        // Very first start (fresh install): download the default public account's
        // deck (loarie) so there's something to play, then land on Settings so the
        // user can set their own username (or just back out and play loarie's). It
        // saves the username + cache, so later starts load from cache + a quick
        // incremental sync (see loadAccount) rather than downloading again.
        setUsername(DEFAULT_USERNAME);
        fullDownload(
          DEFAULT_USERNAME,
          { perSpecies: ps, locale: loc, researchGrade: rg, speciesOnly: so },
          { landOn: 'settings' }
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Screenshot builds only: once the real deck has loaded, plant realistic
  // gameplay stats (busy hero chart, lifetime score, per-species breakdown keyed
  // to this deck, active streak) so the App Store shots look like a used account.
  // Runs once; the seeder persists + no-ops on later relaunches (see shotsSeed).
  const shotsSeededRef = useRef(null);
  useEffect(() => {
    if (!IS_SHOTS) return;
    if (!fullDeck || fullDeck.length === 0 || !username) return;
    if (shotsSeededRef.current === username) return; // seeded this account already
    shotsSeededRef.current = username;
    seedScreenshotStats(fullDeck, username).then((seed) => {
      if (!seed) return; // already seeded this account — restore loaded it
      speciesRef.current = seed.species;
      setSpeciesStats(seed.species);
      setLifetime(seed.lifetime);
      setHistory(seed.history);
      setStreak(seed.streak);
    });
  }, [fullDeck, username]);

  // Keep the paired Apple Watch in sync: push the lifetime accuracy, streak,
  // and a mini-deck whenever they change (deduped inside pushWatchSnapshot).
  // No-op off iOS, without a paired watch, and in E2E.
  useEffect(() => {
    if (IS_E2E) return;
    pushWatchSnapshot({ lifetime, streak: streakStatus(streak), deck: fullDeck });
  }, [lifetime, streak, fullDeck]);

  // Start a fresh round from a set of cards. `pool` is the distractor pool for
  // multiple-choice (defaults to the round's own cards). An empty set is a
  // no-op: the study screen requires a non-empty deck, and starting without one
  // (e.g. "Research grade only" filtering everything out) would dead-end on a
  // blank screen.
  const startRound = useCallback((cards, m, label = '', pool = null) => {
    if (!cards || cards.length === 0) return;
    finishedRef.current = false;
    // Drop any deltas left by a round the player abandoned. Those cards were
    // never persisted locally either (tallies are saved at finishRound), so
    // carrying them into the next round would sync answers the phone itself
    // doesn't have.
    roundDeltaRef.current = {};
    setMode(m);
    setRoundLabel(label);
    setDeck(shuffle(cards));
    setRoundPool(pool && pool.length ? pool : cards);
    setIndex(0);
    setCorrectCount(0);
    setMissed([]);
    setLives(SPEEDRUN_LIVES);
    setLoopNonce(0);
    setScreen('study');
  }, []);

  // --- mode launchers (each records how to replay itself) ---
  const startAll = useCallback(() => {
    replayRef.current = startAll;
    startRound(fullDeck, 'all', '');
  }, [fullDeck, startRound]);

  const startSpeedrun = useCallback(() => {
    replayRef.current = startSpeedrun;
    startRound(fullDeck, 'speedrun', '');
  }, [fullDeck, startRound]);

  // Shared by Custom (multiple-choice) and Flash cards (self-grade): both pick a
  // count of cards from the chosen groups; only the play `mode` differs.
  // `flaggedOnly` further restricts the pool to flagged species.
  const startPicked = useCallback(
    (groups, count, mode, label, flaggedOnly) => {
      let pool =
        groups && groups.length
          ? fullDeck.filter((c) => groups.includes(groupKey(c.iconic)))
          : fullDeck;
      if (flaggedOnly) {
        const set = flagsRef.current;
        pool = pool.filter((c) => set.has(String(c.taxonId)));
      }
      // Distractors come from the whole deck, not just the picked subset.
      const run = () => startRound(pickRandom(pool, count), mode, label, fullDeck);
      replayRef.current = run;
      run();
    },
    [fullDeck, startRound]
  );

  const startCustom = useCallback(
    (groups, count, flaggedOnly) =>
      startPicked(groups, count, 'custom', 'Custom game', flaggedOnly),
    [startPicked]
  );

  // Flash cards: same picker as Custom, but played as a self-grade round
  // (reveal the answer, then "I knew it" / "Missed it") instead of choices.
  const startFlash = useCallback(
    (groups, count, flaggedOnly) =>
      startPicked(groups, count, 'flash', 'Flash cards', flaggedOnly),
    [startPicked]
  );

  // --- "Nearby species" mode -------------------------------------------------
  // Independent of the loaded account: fetches the most typical species near a
  // chosen location/groups and plays them as a self-grade round.
  const startNearby = useCallback(
    async (config) => {
      setError(null);
      setProgress({ loaded: 0, total: 0 });
      setLoadingNearby(true);
      setScreen('loading');
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const cards = await fetchNearbyCards({
          lat: config.lat,
          lng: config.lng,
          radius: config.radius,
          iconicTaxa: config.iconicTaxa,
          locale,
          signal: controller.signal,
          onProgress: (loaded, total) => setProgress({ loaded, total }),
        });
        const run = () => startRound(cards, 'nearby', 'Nearby species');
        replayRef.current = run;
        run();
      } catch (e) {
        // On cancel, quietly return to the Nearby setup with no error.
        if (!(e && e.name === 'AbortError')) {
          setError(e.message || 'Could not load nearby species.');
        }
        setScreen('nearby');
      } finally {
        abortRef.current = null;
      }
    },
    [locale, startRound]
  );

  // --- "Pick the right one" mode ---------------------------------------------
  // Each round fetches the target's curated photos + similar species, then
  // builds 4 tiles. Skips cards that can't form a fair round (too few
  // look-alikes), advancing until one works or the deck is exhausted.
  const prepPickRound = useCallback(async (roundDeck, startIdx, onExhausted) => {
    const reqId = ++pickReqRef.current;
    setPickError(null);
    setPickRound(null);
    setPickLoading(true);

    // Give up after this many candidates in a row return no curated photo at
    // all. A real species always has one, so a run of empties means the network
    // is down or we're rate-limited — bail instead of walking the whole deck
    // (~2-3 API calls each) hammering the 60/min limit.
    const MAX_CONSECUTIVE_EMPTY = 6;
    let consecutiveEmpty = 0;

    for (let i = startIdx; i < roundDeck.length; i++) {
      const card = roundDeck[i];
      const [correctPhotos, similar] = await Promise.all([
        fetchTaxonPhotos(card.taxonId),
        fetchSimilarSpecies(card.taxonId, locale),
      ]);
      if (pickReqRef.current !== reqId) return; // superseded — bail

      // No curated photo for the target → can't build a round anyway, and if it
      // keeps happening the API is likely unavailable. Skip the extra batch call
      // and count toward the early-abort threshold.
      if (correctPhotos.length === 0) {
        if (++consecutiveEmpty >= MAX_CONSECUTIVE_EMPTY) break;
        continue;
      }
      consecutiveEmpty = 0;

      // Distractors must use OFFICIAL curated photos too (not the single
      // default thumbnail), so fetch each similar species' curated photos in
      // one batch and attach them.
      const photoMap = await fetchTaxonPhotosByIds(similar.map((s) => s.taxonId));
      if (pickReqRef.current !== reqId) return; // superseded — bail
      const similarWithPhotos = similar.map((s) => ({
        ...s,
        photos: photoMap[s.taxonId] || [],
      }));

      const round = buildPickRound({ card, correctPhotos, similar: similarWithPhotos });
      if (round) {
        // Warm the cache with this round's tile photos before they render.
        prefetchImages(round.options.map((o) => o.photo));
        setIndex(i);
        setPickRound(round);
        setPickLoading(false);
        return;
      }
      // else: not enough look-alikes with curated photos; try the next card.
    }
    // Ran out of usable cards (or bailed early on repeated empty lookups).
    setPickLoading(false);
    if (onExhausted) onExhausted();
  }, [locale]);

  const startPick = useCallback(() => {
    replayRef.current = startPick;
    finishedRef.current = false;
    roundDeltaRef.current = {}; // see startRound

    const roundDeck = shuffle(fullDeck);
    setMode('pick');
    setRoundLabel('Pick the right one');
    setDeck(roundDeck);
    setRoundPool(roundDeck); // for a multiple-choice revisit of missed cards
    setIndex(0);
    setCorrectCount(0);
    setMissed([]);
    setScreen('pick');
    prepPickRound(roundDeck, 0, () => {
      setPickError('Not enough look-alike data to play right now.');
    });
  }, [fullDeck, prepPickRound]);

  const onSelectMode = useCallback(
    (m) => {
      if (m === 'all') startAll();
      else if (m === 'speedrun') startSpeedrun();
      else if (m === 'pick') startPick();
      else if (m === 'custom') setScreen('custom');
      else if (m === 'flash') setScreen('flash');
      else if (m === 'nearby') setScreen('nearby');
    },
    [startAll, startSpeedrun, startPick]
  );

  const finishRound = useCallback(async (finalCorrect, finalMissed, total) => {
    if (finishedRef.current) return; // already finishing this round — ignore
    finishedRef.current = true;
    const updated = await addToStats(total, finalCorrect);
    setLifetime(updated);
    // Persist the per-species tallies accumulated during the round.
    saveSpeciesStats(speciesRef.current);
    setSpeciesStats({ ...speciesRef.current });
    // Record this game's accuracy for the menu chart, and count today toward
    // the daily streak (both skip empty rounds).
    if (total > 0) {
      addGameResult((finalCorrect / total) * 100).then(setHistory);
      recordStreakDay().then(setStreak);
      addActiveDay();
    }
    // Queue the round for other devices. Local storage is already written
    // above, so this is purely additive and safe to fail — an offline round
    // still counts here and uploads whenever the network returns.
    const delta = roundDeltaRef.current;
    roundDeltaRef.current = {};
    if (total > 0) {
      // Queue, then flush. recordEvent only writes to the outbox; without this
      // the round would sit there until the next cold launch, which looks
      // exactly like sync being broken. Not awaited — the results screen must
      // never wait on the network.
      recordEvent({
        answered: total,
        correct: finalCorrect,
        pct: (finalCorrect / total) * 100,
        species: delta,
      }).then(() => syncCloud());
    }
    setMissed(finalMissed);
    setCorrectCount(finalCorrect);
    setScreen('results');
  }, []);

  // Record a single card's outcome into the per-species tallies. Returns the
  // species key so callers can build a sync delta for it.
  //
  // `track` accumulates the same outcome into this round's delta. Watch results
  // pass false: they arrive one answer at a time and are uploaded as their own
  // event immediately, so folding them into the phone's in-progress round would
  // count them twice.
  const recordResult = useCallback((card, correct, { track = true } = {}) => {
    if (!card) return null;
    const key = card.taxonId != null ? String(card.taxonId) : card.scientific;
    const prev = speciesRef.current[key] || { known: 0, missed: 0 };
    speciesRef.current[key] = {
      name: card.common || card.scientific,
      sci: card.scientific,
      // Thumbnail for the per-species stats list (kept so it shows even when the
      // species isn't in the current deck, e.g. Nearby rounds).
      image: card.image || prev.image || null,
      known: prev.known + (correct ? 1 : 0),
      missed: prev.missed + (correct ? 0 : 1),
    };
    if (track) {
      const d = roundDeltaRef.current[key] || { known: 0, missed: 0 };
      roundDeltaRef.current[key] = {
        name: card.common || card.scientific,
        sci: card.scientific,
        image: card.image || d.image || null,
        known: d.known + (correct ? 1 : 0),
        missed: d.missed + (correct ? 0 : 1),
      };
    }
    return key;
  }, []);

  // Results played on the Apple Watch: fold each answered card into the
  // per-species tallies + lifetime totals + daily streak, and each finished
  // wrist round into the accuracy history — wrist play counts exactly like
  // phone play. Applications are serialized through a promise chain so the
  // read-modify-write storage updates can't interleave. The streak uses the
  // WATCH timestamp (recordStreakDay guards against rewinding, so late-synced
  // results can't corrupt it). The updated stats then flow back to the watch
  // via the snapshot-sync effect above.
  // Catch up whenever the app comes back to the foreground. Rounds played
  // offline in the field would otherwise wait for a cold launch, and a phone
  // that is only ever backgrounded can go days without one.
  useEffect(() => {
    if (!SYNC_ENABLED) return undefined;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleSync(1000);
    });
    return () => sub.remove();
  }, []);

  const watchApplyRef = useRef(Promise.resolve());
  const watchIdsRef = useRef(null); // Set of applied result ids (lazy-loaded)
  useEffect(() => {
    if (IS_E2E) return undefined;
    const apply = (r) => {
      watchApplyRef.current = watchApplyRef.current
        .then(async () => {
          if (!r || typeof r !== 'object') return;
          // Dedup: the watch sends each result on two channels (and
          // transferUserInfo can redeliver across launches). Apply each unique
          // `rid` once, remembered across restarts.
          if (watchIdsRef.current === null) {
            watchIdsRef.current = new Set(await loadAppliedWatchIds());
          }
          if (r.rid != null) {
            if (watchIdsRef.current.has(r.rid)) return; // already counted
            watchIdsRef.current.add(r.rid);
            saveAppliedWatchIds([...watchIdsRef.current]);
          }
          if (r.kind === 'answer' && r.id != null) {
            // Prefer the phone's own full card (real scientific name, image) —
            // the watch's mini-deck is a subset of this deck, and it no longer
            // echoes `sci` back. Fall back to the watch-supplied fields only if
            // the card somehow isn't in the current deck.
            const deckCard = rawCardsRef.current.find(
              (c) => String(c.taxonId) === String(r.id)
            );
            const card = deckCard || {
              taxonId: r.id,
              common: r.name,
              scientific: r.sci || r.name,
              image: r.image || null,
            };
            // track:false — this is its own event, not part of a phone round.
            const key = recordResult(card, !!r.correct, { track: false });
            saveSpeciesStats(speciesRef.current);
            setSpeciesStats({ ...speciesRef.current });
            setLifetime(await addToStats(1, r.correct ? 1 : 0));
            setStreak(await recordStreakDay(r.ts || Date.now()));
            addActiveDay(r.ts || Date.now());
            // A wrist answer syncs to the user's other devices exactly like a
            // phone answer. No pct: one card is not a round, and it must not
            // land on the accuracy chart.
            if (key) {
              recordEvent({
                answered: 1,
                correct: r.correct ? 1 : 0,
                ts: r.ts || Date.now(),
                species: {
                  [key]: {
                    name: card.common || card.scientific,
                    sci: card.scientific,
                    image: card.image || null,
                    known: r.correct ? 1 : 0,
                    missed: r.correct ? 0 : 1,
                  },
                },
              });
            }
          } else if (r.kind === 'round' && r.total > 0) {
            setHistory(await addGameResult((r.correct / r.total) * 100));
            // The finished wrist round as a chart point. Its cards were already
            // counted one by one above, so this carries pct only.
            recordEvent({ pct: (r.correct / r.total) * 100, ts: r.ts || Date.now() });
          }
          // Debounced: a watch session arrives one answer at a time, and a
          // round-trip per answer would be a dozen requests in as many seconds.
          scheduleSync();
        })
        .catch(() => {});
    };
    return subscribeWatchResults(apply);
  }, [recordResult]);

  const handleGrade = useCallback(
    (correct) => {
      const card = deck[index];
      recordResult(card, correct);
      const nextCorrect = correct ? correctCount + 1 : correctCount;
      const nextMissed = correct ? missed : [...missed, card];
      setCorrectCount(nextCorrect);
      setMissed(nextMissed);

      if (mode === 'speedrun') {
        const nextLives = correct ? lives : lives - 1;
        if (!correct) setLives(nextLives);
        if (nextLives <= 0) {
          finishRound(nextCorrect, nextMissed, nextCorrect + nextMissed.length);
          return;
        }
        // Cards come endlessly: reshuffle and loop when the deck runs out.
        if (index + 1 >= deck.length) {
          setDeck(shuffle(deck));
          setIndex(0);
          // Force a fresh card even when the deck is a single card (index + id
          // unchanged), so the round doesn't stick on the answered state.
          setLoopNonce((n) => n + 1);
        } else {
          setIndex(index + 1);
        }
        return;
      }

      if (index + 1 >= deck.length) {
        finishRound(nextCorrect, nextMissed, deck.length);
      } else {
        setIndex(index + 1);
      }
    },
    [deck, index, correctCount, missed, mode, lives, finishRound, recordResult]
  );

  // Grade a tap in "Pick the right one" (tally only; advancing waits for Next).
  const handlePickGrade = useCallback(
    (correct) => {
      const card = deck[index];
      recordResult(card, correct);
      if (correct) setCorrectCount((c) => c + 1);
      else setMissed((m) => [...m, card]);
    },
    [deck, index, recordResult]
  );

  // Advance to the next pick round (or finish when the deck is done).
  const handlePickNext = useCallback(() => {
    const total = correctCount + missed.length;
    if (index + 1 >= deck.length) {
      finishRound(correctCount, missed, total);
      return;
    }
    prepPickRound(deck, index + 1, () =>
      finishRound(correctCount, missed, total)
    );
  }, [deck, index, correctCount, missed, finishRound, prepPickRound]);

  // --- render ---
  // Hold the UI until the icon fonts are loaded, so icons never render as "?"
  // boxes. Proceed anyway if loading errored (better a missing icon than a hang).
  if (!iconFontsLoaded && !iconFontError) {
    return (
      <ThemeProvider value={theme}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.safe}>
            <StatusBar style={statusBarStyle} />
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  // The study screen renders full-bleed (its blurred photo backdrop must reach
  // the very top/bottom edges), so it lives OUTSIDE the SafeAreaView and applies
  // insets internally to just its chrome.
  if (screen === 'study' && deck.length > 0) {
    return (
      <ThemeProvider value={theme}>
      <SafeAreaProvider>
        <Appear style={styles.studyRoot} offset={0} duration={300}>
          <StatusBar style="light" />
          <StudyScreen
            deck={deck}
            index={index}
            loopNonce={loopNonce}
            correctCount={correctCount}
            roundLabel={roundLabel}
            speedrun={mode === 'speedrun'}
            lives={lives}
            choiceMode={['all', 'custom', 'speedrun', 'nearby'].includes(mode)}
            choicePool={roundPool}
            flags={flags}
            onToggleFlag={toggleFlag}
            onGrade={handleGrade}
            onQuit={() =>
              finishRound(correctCount, missed, correctCount + missed.length)
            }
          />
        </Appear>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
      </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  // "Pick the right one" renders full-bleed (it owns its insets), like study.
  if (screen === 'pick') {
    return (
      <ThemeProvider value={theme}>
      <SafeAreaProvider>
        <Appear style={styles.pickRoot} offset={0} duration={300}>
          <StatusBar style={statusBarStyle} />
          <PickImageScreen
            round={pickRound}
            index={index}
            total={deck.length}
            correctCount={correctCount}
            loading={pickLoading}
            error={pickError}
            flagged={
              !!deck[index] && flags.has(String(deck[index].taxonId))
            }
            onToggleFlag={() =>
              deck[index] && toggleFlag(deck[index].taxonId)
            }
            onPick={handlePickGrade}
            onNext={handlePickNext}
            onQuit={() =>
              finishRound(correctCount, missed, correctCount + missed.length)
            }
          />
        </Appear>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
      </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  // Menu renders full-bleed (its hero banner reaches the very top edge), so it
  // lives OUTSIDE the SafeAreaView and insets its own content. Status bar is
  // light because the green hero is always behind it.
  if (screen === 'menu') {
    return (
      <ThemeProvider value={theme}>
        <SafeAreaProvider>
          <Appear style={styles.menuRoot} offset={0} duration={320}>
            <StatusBar style="light" />
            <MenuScreen
              username={username}
              deckCount={fullDeck.length}
              lifetime={lifetime}
              history={history}
              streak={streakStatus(streak)}
              watchTipDismissed={watchTipDismissed}
              onDismissWatchTip={() => {
                setWatchTipDismissed(true);
                saveWatchTipDismissed(true);
              }}
              onSelectMode={onSelectMode}
              onLexicon={() => setScreen('lexicon')}
              onStats={() => setScreen('stats')}
              onSettings={() => {
                setError(null);
                setScreen('settings');
              }}
            />
          </Appear>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
          <SupportModal visible={showSupport} onClose={() => setShowSupport(false)} />
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={theme}>
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style={statusBarStyle} />

        {/* Swipe-right-from-the-left-edge to go back. The target mirrors each
            screen's own back action: the regular pages return to the menu, and
            Settings sub-pages return to Settings. Screens without a back action
            (loading, results) pass null, which disables the gesture. */}
        <SwipeBackView
          style={styles.flex}
          onBack={
            {
              settings: fullDeck.length > 0
                ? () => (settingsLeaveRef.current || (() => setScreen('menu')))()
                : null,
              custom: () => setScreen('menu'),
              flash: () => setScreen('menu'),
              nearby: () => setScreen('menu'),
              stats: () => setScreen('menu'),
              lexicon: () => setScreen('menu'),
              changelog: () => setScreen('settings'),
              legal: () => setScreen('settings'),
            }[screen] || null
          }
        >
        {/* Keyed on `screen` so each of these non-full-bleed screens fades +
            slides in when navigated to. */}
        <Appear key={screen} style={styles.flex} offset={10} duration={300}>
        {screen === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {loadingNearby
                ? 'Finding species observed near this place…'
                : `Loading observations${username ? ` for ${username}` : ''}…`}
            </Text>
            {progress.total > 0 && (
              <Text style={styles.loadingSub}>
                {Math.min(progress.loaded, progress.total)} of {progress.total}
              </Text>
            )}
            <Pressable
              testID="loading-cancel"
              onPress={cancelLoad}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={({ pressed }) => [styles.loadingCancel, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.loadingCancelText}>Cancel</Text>
            </Pressable>
          </View>
        )}

        {screen === 'settings' && (
          <SettingsScreen
            initialUsername={username}
            perSpecies={perSpecies}
            locale={locale}
            researchGrade={researchGrade}
            speciesOnly={speciesOnly}
            themeMode={themeMode}
            onThemeModeChange={onThemeModeChange}
            error={error}
            sync={sync}
            onUpdateNow={
              username ? () => syncNow(username, locale) : null
            }
            onChangelog={() => setScreen('changelog')}
            onLegal={() => setScreen('legal')}
            onSync={SYNC_ENABLED ? () => setScreen('sync') : null}
            onBack={fullDeck.length > 0 ? () => setScreen('menu') : null}
            registerLeave={(fn) => { settingsLeaveRef.current = fn; }}
            onSave={(name, prefs) => {
              setPerSpecies(prefs.perSpecies);
              setLocale(prefs.locale);
              setResearchGrade(prefs.researchGrade);
              setSpeciesOnly(prefs.speciesOnly);
              // Keep the ref current immediately (a re-download triggers a sync
              // that filters via prefsRef before this render's state commits).
              prefsRef.current = {
                perSpecies: prefs.perSpecies,
                researchGrade: prefs.researchGrade,
                speciesOnly: prefs.speciesOnly,
              };
              savePrefs({ ...prefs, themeMode });
              // The username is the first arg, not a field on `prefs`
              // (SettingsScreen calls onSave(username.trim(), { … })).
              pushSettings({ ...prefs, themeMode }, name);
              // Re-download only when the account identity changes (username or
              // language). The toggles are local filters, so just re-derive the
              // deck and stay put — no network needed.
              const accountChanged =
                name !== username || prefs.locale !== locale;
              if (accountChanged) {
                // Localized taxon names are cached per locale; drop them so the
                // new language is reflected.
                if (prefs.locale !== locale) clearTaxonCache();
                loadAccount(name, prefs);
              } else {
                applyCurrentFilters(prefs);
                setScreen('menu');
              }
            }}
          />
        )}

        {screen === 'custom' && (
          <CustomScreen
            deck={fullDeck}
            flags={flags}
            onStart={startCustom}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'flash' && (
          <CustomScreen
            deck={fullDeck}
            title="Flash cards"
            flags={flags}
            onStart={startFlash}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'nearby' && (
          <NearbyConfigScreen
            onStart={startNearby}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'stats' && (
          <StatsScreen
            species={speciesStats}
            cards={fullDeck}
            lifetime={lifetime}
            history={history}
            streak={streakStatus(streak)}
            flags={flags}
            onToggleFlag={toggleFlag}
            onBack={() => setScreen('menu')}
            onSelect={(card) => setDetailCard(card)}
            onReset={async () => {
              await resetStatistics();
              speciesRef.current = {};
              setSpeciesStats({});
              setLifetime({ answered: 0, correct: 0 });
              setHistory([]);
              setStreak({ current: 0, longest: 0, lastActiveDay: null });
            }}
          />
        )}

        {screen === 'changelog' && (
          <ChangelogScreen onBack={() => setScreen('settings')} />
        )}

        {screen === 'legal' && (
          <LegalScreen onBack={() => setScreen('settings')} />
        )}

        {screen === 'lexicon' && (
          <LexiconScreen
            cards={fullDeck}
            speciesStats={speciesStats}
            flags={flags}
            onToggleFlag={toggleFlag}
            onBack={() => setScreen('menu')}
            onSelect={(card) => setDetailCard(card)}
          />
        )}

        {screen === 'sync' && (
          <SyncScreen
            onBack={() => setScreen('settings')}
            // Signing in can fold in a whole other device's history, so adopt
            // the merged rollups immediately rather than waiting for a relaunch.
            onSynced={(merged) => {
              setLifetime(merged.lifetime);
              speciesRef.current = merged.species;
              setSpeciesStats({ ...merged.species });
              setHistory(merged.history);
              setStreak(merged.streak);
            }}
          />
        )}

        {screen === 'results' && (
          <ResultsScreen
            mode={mode}
            total={correctCount + missed.length}
            correct={correctCount}
            missed={missed}
            lifetime={lifetime}
            streak={streakStatus(streak)}
            onRevisitMissed={() =>
              startRound(missed, 'all', 'Revisiting missed cards', roundPool)
            }
            onPlayAgain={() => replayRef.current()}
            onMenu={() => setScreen('menu')}
            flags={flags}
            onToggleFlag={toggleFlag}
            onSelectMissed={(card) => setDetailCard(card)}
          />
        )}
        </Appear>
        </SwipeBackView>

        {/* Species detail page — an overlay over the current screen (Lexicon /
            Statistics / Results), which stays mounted underneath so its scroll
            position and filters survive when this is dismissed. Slides up in. */}
        {detailCard && (
          <SafeAreaView style={styles.detailOverlay} edges={['top', 'bottom']}>
            <SwipeBackView style={styles.flex} onBack={() => setDetailCard(null)}>
              <Appear style={styles.flex} offset={40} duration={300}>
                <DetailScreen
                  card={detailCard}
                  locale={locale}
                  flags={flags}
                  onToggleFlag={toggleFlag}
                  onBack={() => setDetailCard(null)}
                />
              </Appear>
            </SwipeBackView>
          </SafeAreaView>
        )}
      </SafeAreaView>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
      <SupportModal visible={showSupport} onClose={() => setShowSupport(false)} />
    </SafeAreaProvider>
    </ThemeProvider>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  flex: { flex: 1 },
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  // The study screen is full-bleed: its photo backdrop must reach every edge,
  // so no safe-area padding here (StudyScreen insets its own chrome).
  studyRoot: { flex: 1, backgroundColor: '#1A1D1A' },
  // Menu is full-bleed (hero reaches the top edge); MenuScreen insets its content.
  menuRoot: { flex: 1, backgroundColor: colors.bg },
  // Pick-the-right-one owns its own insets too.
  pickRoot: { flex: 1, backgroundColor: colors.bg },
  // Detail page overlay: fills the safe area, covering the screen beneath it.
  detailOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  loadingSub: { marginTop: 6, fontSize: 14, color: colors.muted },
  loadingCancel: { marginTop: 28, paddingVertical: 8, paddingHorizontal: 16 },
  loadingCancelText: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
