// gote — a card-based learning game built on the iNaturalist API.
//
// Flow (a small state machine, no navigation library needed):
//
//   loading ─► menu ─┬─► study ─► results ─► menu
//      ▲             │     (all / 16 / smart / speedrun)
//      │             ├─► smart ──► study ─► results
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
  runDataMigrations,
  loadUsername,
  saveUsername,
  loadStats,
  addToStats,
  addToStatsByFormat,
  loadStatsByFormat,
  loadPrefs,
  savePrefs,
  loadSpeciesStats,
  saveSpeciesStats,
  loadConfusions,
  saveConfusions,
  loadConfusionNotes,
  saveConfusionNote,
  loadConfusionWins,
  saveConfusionWins,
  resetStatistics,
  loadCache,
  saveCache,
  cacheMatches,
  loadFlags,
  saveFlag,
  loadHistory,
  loadHistoryCounts,
  addGameResult,
  loadStreak,
  recordStreakDay,
  streakStatus,
  loadAppliedWatchIds,
  saveAppliedWatchIds,
  loadWatchTipDismissed,
  saveWatchTipDismissed,
  loadTutorial,
  saveTutorial,
  loadRoundSetup,
  saveRoundSetup,
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
import { addConfusion, displayNotes } from './src/sync/merge';
import { pairCount, pairKey, nemesisPartners } from './src/confusions';
import { verifyStreak, recordVerifyWin, recordVerifyMiss } from './src/verify';
import { scheduleDeck } from './src/schedule';
import { isMastered, speciesKey } from './src/mastery';
import { recordRecall } from './src/recall';
import { FORMAT, chooseFormat, ALL_FORMATS } from './src/smartmode';
import { scoreDelta } from './src/scoring';

// The question types Smart play offers on its start screen. Labels match the
// Statistics breakdown so the two screens name the same thing the same way.
const SMART_QUESTION_TYPES = [
  { key: FORMAT.PICTURE, label: 'Choosing the photo' },
  { key: FORMAT.NAME, label: 'Choosing the name' },
  { key: FORMAT.PAIR, label: 'Look-alike pairs' },
  { key: FORMAT.TYPED, label: 'Typing from memory' },
];
import { shrunkRate, lifetimeRate } from './src/accuracy';
import {
  prefetchImages,
  prefetchDeck,
  initDownloadedImages,
  isImageDownloaded,
} from './src/prefetch';
import { groupKey, ThemeProvider, themeFor, resolveScheme } from './src/theme';
import { IS_E2E, IS_SHOTS } from './src/e2e/testMode';
import { TutorialProvider, TutorialOverlay } from './src/components/Tutorial';
import { Spinner } from './src/components/LoadingImage';
import {
  INITIAL as TUTORIAL_INITIAL,
  normalize as normalizeTutorial,
  startState as startTutorial,
  isRunning as tutorialRunning,
  shouldAutoStart,
} from './src/tutorial';
import { useIsOffline } from './src/net';
import { E2E_CARDS } from './src/e2e/fixtures';
import { seedScreenshotStats } from './src/e2e/shotsSeed';
import { pushWatchSnapshot, subscribeWatchResults } from './src/watch';
import MenuScreen from './src/screens/MenuScreen';
import CustomScreen from './src/screens/CustomScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import StudyScreen from './src/screens/StudyScreen';
import PickImageScreen from './src/screens/PickImageScreen';
import CompareScreen from './src/screens/CompareScreen';
import DuelScreen from './src/screens/DuelScreen';
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
import { backTarget } from './src/navigation';
import { Appear } from './src/components/anim';

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
  // loading | settings | menu | smart | study | results
  const [screen, setScreen] = useState('loading');
  // Live "no connection" flag, used to pause the online-only features (Nearby,
  // observation updates). Forced off in the synthetic modes, which run against
  // fixtures and must never see a network-dependent affordance disabled.
  const offline = useIsOffline() && !IS_E2E && !IS_SHOTS;
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
  // Optional: keep only cards that have a common name in the selected language,
  // hiding taxa iNaturalist has no localized name for (which would otherwise show
  // only their scientific name). Off by default.
  const [namedOnly, setNamedOnly] = useState(false);
  // Optional: once you've mastered a species (src/mastery.js), show a random
  // official photo instead of your own observation shot — so recognition is
  // tested on the species, not one memorised picture. Off by default.
  const [freshPhotos, setFreshPhotos] = useState(false);

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
      const next = { perSpecies, locale, researchGrade, speciesOnly, namedOnly, freshPhotos, themeMode: mode };
      savePrefs(next);
      // Pass the username too: the server settings row is one blob per user, so
      // omitting it here would overwrite the stored username with null.
      pushSettings(next, username);
    },
    [perSpecies, locale, researchGrade, speciesOnly, namedOnly, freshPhotos, username]
  );
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  // Distinguishes the two things that use the loading screen: loading an
  // account's own observations vs. fetching species near a place (which draws
  // from many observers, not the current user) — so the message can match.
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [lifetime, setLifetime] = useState({ answered: 0, correct: 0 });
  // Lifetime totals split by question format — shown on Statistics so a blended
  // accuracy stays interpretable once Smart play mixes formats (src/storage.js).
  const [statsByFormat, setStatsByFormat] = useState({});
  // Recent games' accuracy (0–100, oldest→newest) for the menu's mini chart,
  // plus how many cards each of those games covered — right-aligned with it, so
  // every aggregate weighs a 100-card round above a 1-card one (src/accuracy.js).
  const [history, setHistory] = useState([]);
  const [historyCounts, setHistoryCounts] = useState([]);
  // Daily streak record { current, longest, lastActiveDay }; the displayed
  // state (done / at-risk / broken) is derived via streakStatus at render.
  const [streak, setStreak] = useState(null);
  // Whether the "Did you know? (Apple Watch)" menu notice has been hidden. Always
  // still shown in Settings; iPhone-only display is handled inside WatchTip.
  const [watchTipDismissed, setWatchTipDismissed] = useState(false);
  // Guided tour. Held here (not in the provider) because every root return
  // mounts its own TutorialProvider, and progress has to survive those.
  const [tutorial, setTutorial] = useState(TUTORIAL_INITIAL);
  // Read by effects that must not depend on the tour's progress (see the
  // support-prompt roll below).
  const tutorialRef = useRef(tutorial);
  tutorialRef.current = tutorial;

  // Raw cached cards (unfiltered) for the current account, kept in a ref so sync
  // can read/merge without re-renders. `fullDeck` is the filtered view shown to
  // the game (perSpecies/researchGrade applied locally).
  const rawCardsRef = useRef([]);
  const watermarkRef = useRef(null);
  const [fullDeck, setFullDeck] = useState([]);
  // Flips true once the downloaded-photo manifest has been read from storage, so
  // the offline deck filter (playableDeck below) recomputes with real data.
  const [dlReady, setDlReady] = useState(false);
  // The deck the deck-local modes actually play from. Online it's the full
  // filtered deck; OFFLINE it's narrowed to cards whose photos are downloaded,
  // so a round never shows blank cards. (By picture / Nearby are online-only and
  // gated in the menu, so they don't read this.)
  const playableDeck = useMemo(
    () => (offline ? fullDeck.filter((c) => isImageDownloaded(c.image)) : fullDeck),
    [fullDeck, offline, dlReady]
  );
  // Proactively warm an offline pack once a deck is loaded and we're online, so
  // the deck-local modes stay playable without a connection later. No-op offline
  // (nothing to download) and cheap when repeated (prefetch dedupes per URL).
  useEffect(() => {
    if (!offline && fullDeck.length > 0) prefetchDeck(fullDeck);
  }, [fullDeck, offline]);
  // The current display-filter prefs, mirrored in a ref so async callbacks (the
  // background sync) read the user's REAL settings — not a stale closure from
  // the first render, when these were still at their useState defaults. Without
  // this, the startup sync re-derived the deck with default filters and clobbered
  // the correctly-filtered count (e.g. showed 171 instead of 107 research-grade).
  const prefsRef = useRef({ perSpecies, researchGrade, speciesOnly, namedOnly });
  useEffect(() => {
    prefsRef.current = { perSpecies, researchGrade, speciesOnly, namedOnly };
  }, [perSpecies, researchGrade, speciesOnly, namedOnly]);
  // Sync status for the Settings UI: { state: idle|syncing|done|error, syncedAt, message }
  const [sync, setSync] = useState({ state: 'idle', syncedAt: null, message: null });
  // The card whose detail page is open, rendered as an overlay ON TOP of the
  // current screen (Lexicon / Statistics / Results) rather than replacing it —
  // so that screen stays mounted and its scroll position and filters are
  // preserved when the detail page is dismissed. null = no detail open.
  const [detailCard, setDetailCard] = useState(null);
  // The confused pair currently open in the side-by-side comparison overlay, and
  // the player's "my tell" notes (keyed by confusions.js pairKey).
  const [comparePair, setComparePair] = useState(null);
  // The confused pair currently open in the A/B duel drill (from the comparison's
  // "Drill this pair"). null = no drill open.
  const [duelPair, setDuelPair] = useState(null);
  const [confusionNotes, setConfusionNotes] = useState({});

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

  // Restore the tour, and start it for someone who has never seen it. Started
  // here, at boot, rather than on arrival at the menu: step 1 lives on the menu
  // and simply waits for it, so a launch that spends a while loading a deck
  // still gets the tour at the right moment rather than missing its cue.
  //
  // What it must NOT do is leave the user somewhere the tour is only waiting
  // before they have seen the menu at all — being told to "go back to the main
  // menu" on a screen you were dropped on is nonsense. A fresh install therefore
  // lands on the menu (see the first-start branch below), which is where step 1
  // is, so the tour opens with its welcome rather than with a nag.
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = normalizeTutorial(await loadTutorial());
      if (!alive) return;
      const next = shouldAutoStart(saved, { isE2E: IS_E2E || IS_SHOTS })
        ? startTutorial()
        : saved;
      setTutorial(next);
      if (next !== saved) saveTutorial(next);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Where the round picker should reopen. Loaded once at boot, so the Smart
  // play and Flash cards screens can seed their state synchronously on first
  // render — an async read inside the picker would either flash the defaults
  // first or race the player's own first tap.
  //
  // Smart play is the only way to a name-only round now that By name has left
  // the menu, so "one tap to replay what I played last time" is the thing that
  // keeps that round as cheap as it used to be.
  const [roundSetup, setRoundSetup] = useState({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const saved = await loadRoundSetup();
      if (alive) setRoundSetup(saved);
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Remember what a mode was last STARTED with. Fire-and-forget: failing to
  // record a preference must never interrupt a round that is already beginning.
  const rememberSetup = useCallback((key, setup) => {
    if (!setup) return;
    setRoundSetup((prev) => {
      const next = { ...prev, [key]: setup };
      saveRoundSetup(next);
      return next;
    });
  }, []);

  // One place to change the tour, so persistence can never be forgotten at a
  // call site (exiting, finishing and every Next all come through here).
  const changeTutorial = useCallback((next) => {
    setTutorial(next);
    saveTutorial(next);
  }, []);

  // "Take the tutorial" in Settings. Returns to the menu with it, because the
  // tour opens there — otherwise its first step would start out waiting.
  const restartTutorial = useCallback(() => {
    changeTutorial(startTutorial());
    setScreen('menu');
  }, [changeTutorial]);

  // When there is no JS splash to wait for (E2E), drop the native splash as soon
  // as the fonts are ready so the UI under test isn't left covered.
  useEffect(() => {
    if ((iconFontsLoaded || iconFontError) && !showSplash) hideNativeSplash();
  }, [iconFontsLoaded, iconFontError, showSplash, hideNativeSplash]);

  // Once per launch, when the menu first appears, roll the support/review popup
  // (~1 in 10 launches). Never in E2E, so the test runs stay deterministic.
  //
  // Never over the guided tour either. It is a native Modal, so it sits above
  // the tour's overlay and covers the step someone is in the middle of reading
  // — and on a first launch the tour IS running, which is exactly the moment
  // asking for a rating is both intrusive and worthless as feedback. Read
  // through a ref so a tour ending later in the launch cannot re-roll it.
  useEffect(() => {
    if (screen === 'menu' && !supportRolledRef.current && !IS_E2E) {
      supportRolledRef.current = true;
      if (tutorialRunning(tutorialRef.current)) return;
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
      const on = !next.has(key);
      if (on) next.add(key);
      else next.delete(key);
      // Persist (stamped) then mirror to the settings row so the flag syncs.
      // pushSettings is a no-op when sync is off.
      saveFlag(usernameRef.current, key, on).then(() =>
        pushSettings(
          { perSpecies, locale, researchGrade, speciesOnly, namedOnly, freshPhotos, themeMode },
          usernameRef.current
        )
      );
      return next;
    });
  }, [perSpecies, locale, researchGrade, speciesOnly, namedOnly, freshPhotos, themeMode]);
  const [deck, setDeck] = useState([]);
  const [index, setIndex] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [missed, setMissed] = useState([]);
  const [roundLabel, setRoundLabel] = useState('');
  // smart | speedrun | pick | flash | nearby, plus 'all' — a plain
  // multiple-choice name round. 'all' was the By name menu entry until Smart
  // play absorbed it; the mode itself stays because "Revisiting missed cards"
  // is one, whatever mode produced the misses.
  const [mode, setMode] = useState('all');
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
  // Confusion matrix: `{ [correctKey]: { [chosenKey]: count } }` — which species
  // the player systematically mixes up. `confusionRef` is the running lifetime
  // copy (persisted with the round); `confusionDeltaRef` is JUST this round's
  // confusions, uploaded with the round's sync event and then cleared — the same
  // lifetime-vs-delta split as speciesRef / roundDeltaRef.
  const confusionRef = useRef({});
  const confusionDeltaRef = useRef({});
  // This round's answers split by question format (see formatForCard).
  const formatDeltaRef = useRef({});
  // "Verify the fix" recovery streaks: pairKey → consecutive correct answers on
  // a former-nemesis pair. Device-local (like the "my tell" notes), so it rides
  // a ref + its own storage rather than the synced events log.
  const confusionWinsRef = useRef({});

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
  // Mirrors of state the round planner reads. It runs once at round start, from
  // inside startRound, so reading state through a closure would risk a stale
  // value deciding a whole round's questions.
  const lifetimeRef = useRef({ answered: 0, correct: 0 });
  const offlineRef = useRef(false);

  // Smart play only: the question format chosen for each card, index-aligned
  // with `deck`. Built once when the round starts (AFTER the shuffle, so it
  // cannot drift out of alignment) rather than per render — chooseFormat is
  // random, so deciding lazily would let a card change its own question
  // mid-answer. null in every other mode.
  const [formatPlan, setFormatPlan] = useState(null);
  lifetimeRef.current = lifetime;
  offlineRef.current = offline;
  const deckRef = useRef([]);
  const formatPlanRef = useRef(null);
  deckRef.current = deck;
  formatPlanRef.current = formatPlan;
  const roundPoolRef = useRef([]);
  roundPoolRef.current = roundPool;

  // Re-derive the filtered deck from the raw cache + the given display prefs.
  const applyCurrentFilters = useCallback((prefs) => {
    const filtered = applyFilters(rawCardsRef.current, {
      perSpecies: prefs.perSpecies,
      researchGrade: prefs.researchGrade,
      speciesOnly: prefs.speciesOnly,
      namedOnly: prefs.namedOnly,
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

  // Adopt settings that arrived from another device — at launch (the pull below)
  // or right after signing in. Updates the live UI immediately, and reloads the
  // deck only when the identity-defining fields (account or language) actually
  // moved (pullSettings tells us, comparing against local storage). The toggles
  // are local filters, so those just re-derive the deck in place.
  const applyRemoteSettings = useCallback(
    (s) => {
      if (!s) return;
      // Notes and flags merge independently of the prefs last-write-wins, so
      // adopt them even when only they changed (pullSettings may return them
      // without prefs). On a username change, loadAccount below reloads the new
      // account's flags from the just-merged storage, so skip the live set here.
      if (s.notes) setConfusionNotes(s.notes);
      if (s.flags && !s.usernameChanged) setFlags(new Set(s.flags));
      if (!s.prefs) return;
      const p = s.prefs;
      if (typeof p.perSpecies === 'boolean') setPerSpecies(p.perSpecies);
      if (p.locale) setLocale(p.locale);
      if (typeof p.researchGrade === 'boolean') setResearchGrade(p.researchGrade);
      if (typeof p.speciesOnly === 'boolean') setSpeciesOnly(p.speciesOnly);
      if (typeof p.namedOnly === 'boolean') setNamedOnly(p.namedOnly);
      if (typeof p.freshPhotos === 'boolean') setFreshPhotos(p.freshPhotos);
      if (p.themeMode) setThemeMode(p.themeMode);
      if (s.username) setUsername(s.username);
      prefsRef.current = {
        perSpecies: !!p.perSpecies,
        researchGrade: !!p.researchGrade,
        speciesOnly: !!p.speciesOnly,
        namedOnly: !!p.namedOnly,
      };
      const filterPrefs = {
        perSpecies: !!p.perSpecies,
        locale: p.locale || locale,
        researchGrade: !!p.researchGrade,
        speciesOnly: !!p.speciesOnly,
        namedOnly: !!p.namedOnly,
      };
      if (s.usernameChanged || s.localeChanged) {
        if (s.localeChanged) clearTaxonCache();
        loadAccount(s.username || usernameRef.current, filterPrefs);
      } else {
        applyCurrentFilters(filterPrefs);
      }
    },
    [locale, loadAccount, applyCurrentFilters]
  );

  // Restore saved state on first launch.
  useEffect(() => {
    (async () => {
      // Bring this device's stored data up to the current shape before anything
      // reads it. Forward-only, best-effort, no-op when already current.
      await runDataMigrations();
      // Seed the downloaded-photo manifest so an offline first screen can filter
      // the deck to cards that will actually render. Non-blocking for the rest.
      initDownloadedImages().then(() => setDlReady(true));
      // Restore the confusion matrix so this session accumulates onto it, and
      // the "my tell" notes for the comparison view.
      loadConfusions().then((c) => {
        confusionRef.current = c || {};
      });
      loadConfusionNotes().then((n) => setConfusionNotes(displayNotes(n)));
      loadConfusionWins().then((w) => {
        confusionWinsRef.current = w || {};
      });
      const [savedUser, savedStats, savedFormats, savedPrefs, savedSpecies, savedCache, savedHistory, savedHistoryN, savedStreak, savedWatchTip] =
        await Promise.all([
          loadUsername(),
          loadStats(),
          loadStatsByFormat(),
          loadPrefs(),
          loadSpeciesStats(),
          loadCache(),
          loadHistory(),
          loadHistoryCounts(),
          loadStreak(),
          loadWatchTipDismissed(),
        ]);
      if (savedStats) setLifetime(savedStats);
      if (savedFormats) setStatsByFormat(savedFormats);
      if (savedHistory && savedHistory.length) setHistory(savedHistory);
      if (savedHistoryN && savedHistoryN.length) setHistoryCounts(savedHistoryN);
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
      const no = !!(savedPrefs && savedPrefs.namedOnly);
      const fp = !!(savedPrefs && savedPrefs.freshPhotos);
      const tm = (savedPrefs && savedPrefs.themeMode) || 'system';
      setPerSpecies(ps);
      setLocale(loc);
      setResearchGrade(rg);
      setSpeciesOnly(so);
      setNamedOnly(no);
      setFreshPhotos(fp);
      setThemeMode(tm);
      // Seed the ref now: the startup background sync fires before React re-renders
      // with these values, and must filter by the saved prefs, not the defaults.
      prefsRef.current = { perSpecies: ps, researchGrade: rg, speciesOnly: so, namedOnly: no };
      // Cross-device sync. A no-op unless the build carries Supabase
      // credentials (src/sync/config.js). Fired here, once local state is
      // seeded, so anything folded in from another device isn't clobbered by
      // the restore — and NOT awaited, because a slow network must never delay
      // the menu appearing.
      if (SYNC_ENABLED) {
        syncCloud().then((merged) => {
          if (!merged) return;
          setLifetime(merged.lifetime);
          if (merged.formats) setStatsByFormat(merged.formats);
          speciesRef.current = merged.species;
          setSpeciesStats({ ...merged.species });
          setHistory(merged.history);
          setHistoryCounts(merged.historyCounts || []);
          setStreak(merged.streak);
          if (merged.confusions) confusionRef.current = merged.confusions;
        });
        syncSettings().then((s) => { if (s) applyRemoteSettings(s); });
      }
      // E2E: load the fixture deck offline and jump straight to the menu.
      if (IS_E2E) {
        setUsername('e2e-tester');
        rawCardsRef.current = E2E_CARDS;
        watermarkRef.current = null;
        applyCurrentFilters({ perSpecies: ps, researchGrade: rg, speciesOnly: so, namedOnly: no });
        setScreen('menu');
        return;
      }
      if (savedUser) {
        setUsername(savedUser);
        loadAccount(
          savedUser,
          { perSpecies: ps, locale: loc, researchGrade: rg, speciesOnly: so, namedOnly: no },
          savedCache
        );
      } else {
        // Very first start (fresh install): download the default public account's
        // deck (loarie) so there's something to play, then land on the MENU. It
        // saves the username + cache, so later starts load from cache + a quick
        // incremental sync (see loadAccount) rather than downloading again.
        //
        // This used to land on Settings, so a first-time user could set their own
        // username straight away. That read badly once the tour existed: the tour
        // opens on the menu, so a first launch dropped the user in Settings with
        // the tour already nagging "go back to the main menu" — before they had
        // ever seen the menu. The tour walks them to Settings itself (step 2) and
        // asks for the username there (step 3), so the prompt is not lost; it just
        // arrives after an introduction rather than instead of one.
        setUsername(DEFAULT_USERNAME);
        fullDownload(
          DEFAULT_USERNAME,
          { perSpecies: ps, locale: loc, researchGrade: rg, speciesOnly: so, namedOnly: no },
          { landOn: 'menu' }
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
      setHistoryCounts(seed.historyCounts || []);
      setStreak(seed.streak);
      if (seed.confusions) confusionRef.current = seed.confusions;
      loadConfusionNotes().then((n) => setConfusionNotes(displayNotes(n)));
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
  const startRound = useCallback((cards, m, label = '', pool = null, planner = null, afterPlan = null) => {
    if (!cards || cards.length === 0) return;
    finishedRef.current = false;
    // Drop any deltas left by a round the player abandoned. Those cards were
    // never persisted locally either (tallies are saved at finishRound), so
    // carrying them into the next round would sync answers the phone itself
    // doesn't have.
    roundDeltaRef.current = {};
    confusionDeltaRef.current = {};
    formatDeltaRef.current = {};
    setMode(m);
    setRoundLabel(label);
    const shuffled = shuffle(cards);
    setDeck(shuffled);
    // The planner sees the deck in play order, which is the only order the
    // plan can be aligned to.
    const plan = planner ? planner(shuffled) : null;
    setFormatPlan(plan);
    setRoundPool(pool && pool.length ? pool : cards);
    setIndex(0);
    setCorrectCount(0);
    setMissed([]);
    setLives(SPEEDRUN_LIVES);
    setLoopNonce(0);
    setScreen('study');
    if (afterPlan) afterPlan(shuffled, plan);
  }, []);

  // --- mode launchers (each records how to replay itself) ---
  const startSpeedrun = useCallback(() => {
    replayRef.current = startSpeedrun;
    startRound(playableDeck, 'speedrun', '');
  }, [playableDeck, startRound]);

  // Shared by Custom (multiple-choice) and Flash cards (self-grade): both pick a
  // count of cards from the chosen groups; only the play `mode` differs.
  // `flaggedOnly` further restricts the pool to flagged species.
  const startPicked = useCallback(
    (groups, count, mode, label, flaggedOnly) => {
      let pool =
        groups && groups.length
          ? playableDeck.filter((c) => groups.includes(groupKey(c.iconic)))
          : playableDeck;
      if (flaggedOnly) {
        const set = flagsRef.current;
        pool = pool.filter((c) => set.has(String(c.taxonId)));
      }
      // Spaced-repetition input: bias the sample so unresolved mix-ups (and their
      // look-alike partner) resurface, interleaved among fresh cards — instead of
      // a plain random draw. Degrades to random when there are no due pairs.
      const cards = scheduleDeck(pool, {
        confusions: confusionRef.current,
        wins: confusionWinsRef.current,
        size: count,
      });
      // Distractors come from the whole (playable) deck, not just the picked subset.
      const run = () => startRound(cards, mode, label, playableDeck);
      replayRef.current = run;
      run();
    },
    [playableDeck, startRound]
  );

  // Flash cards: the same picker Smart play uses, but played as a self-grade
  // round (reveal the answer, then "I knew it" / "Missed it") instead of
  // choices.
  const startFlash = useCallback(
    (groups, count, flaggedOnly, _types, setup) => {
      rememberSetup('flash', setup);
      startPicked(groups, count, 'flash', 'Flash cards', flaggedOnly);
    },
    [startPicked, rememberSetup]
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
  // `only: true` tries EXACTLY the card at startIdx instead of scanning forward
  // for the first one that works. Smart play needs that: it decided this card's
  // question format in advance, so silently jumping to a different card would
  // desync the plan from the deck. The caller handles the failure by asking a
  // different question about the same card instead.
  const prepPickRound = useCallback(async (roundDeck, startIdx, onExhausted, { only = false } = {}) => {
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

    const lastIdx = only ? startIdx : roundDeck.length - 1;
    for (let i = startIdx; i <= lastIdx; i++) {
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
    confusionDeltaRef.current = {};
    formatDeltaRef.current = {};

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

  // Look-alikes this player has actually confused with a species. Declared
  // HERE, above its first consumer: planSmart and pairPartnerFor both list it in
  // their dependency arrays, which are evaluated during render, so declaring it
  // further down left those reads inside its temporal dead zone. It only worked
  // because Babel transpiles the block scoping away — a toolchain detail, not a
  // guarantee.
  const nemesisPartnersFor = useCallback(
    (key) => nemesisPartners(confusionRef.current, key).map((p) => p.partner),
    []
  );

  // Smart play: one round, four question formats, chosen per card by what the
  // tallies say about that species (src/smartmode.js).
  //
  // The plan is built here rather than inside smartmode so the exclusions stay
  // where the facts are: PICTURE needs four other species' curated photos
  // fetched live, so it is impossible offline, and PAIR needs the partner card
  // to actually be in this round's pool.
  const planSmart = useCallback(
    (cards, chosenTypes = null) => {
      const lifetimeRateNow = lifetimeRate(lifetimeRef.current);
      const byKey = new Map(cards.map((c) => [speciesKey(c), c]));
      return cards.map((card) => {
        const key = speciesKey(card);
        const entry = speciesRef.current[key] || { known: 0, missed: 0 };
        const evidence = (entry.known || 0) + (entry.missed || 0);
        // The SHRUNK rate, not the raw one: a species answered right once is
        // not a species known at 100%, and it must not be promoted straight to
        // typed recall on that evidence (src/accuracy.js).
        const rate = shrunkRate(entry, lifetimeRateNow);
        // A look-alike this player actually confuses it with, present in this
        // round — otherwise there is no pair to ask about.
        const partner = (nemesisPartnersFor(key) || [])
          .map((k) => byKey.get(String(k)))
          .find((c) => c && speciesKey(c) !== key);
        // Three filters, and they are different in kind. The player's choice is
        // a preference; offline and "no partner in this deck" are facts about
        // what can actually be rendered. Applying them together here keeps
        // chooseFormat free of both.
        const wanted = chosenTypes && chosenTypes.length ? new Set(chosenTypes) : null;
        const allow = ALL_FORMATS.filter(
          (f) =>
            (!wanted || wanted.has(f)) &&
            !(f === FORMAT.PICTURE && offlineRef.current) &&
            !(f === FORMAT.PAIR && !partner)
        );
        return chooseFormat({ evidence, rate, hasPartner: !!partner, allow });
      });
    },
    [nemesisPartnersFor]
  );

  // Send card `i` to whichever screen its planned format needs. Smart play is
  // the only mode whose screen can change between cards.
  //
  // If the photo grid cannot be built for that card (too few look-alikes with
  // curated photos), the format is DOWNGRADED to a name list for that card
  // rather than skipping to another one — skipping is what prepPickRound does
  // by default, and it would silently pull the deck out of step with the plan.
  // The look-alike to put opposite this card in a PAIR question: a species the
  // player actually confuses it with, and one that is in this round's pool so
  // it can be shown. Same lookup the planner used to decide the format.
  const pairPartnerFor = useCallback(
    (card) => {
      if (!card) return null;
      const key = speciesKey(card);
      const partners = (nemesisPartnersFor(key) || []).map(String);
      if (!partners.length) return null;
      const pool = roundPoolRef.current || [];
      return pool.find((c) => partners.includes(speciesKey(c)) && speciesKey(c) !== key) || null;
    },
    [nemesisPartnersFor]
  );

  const routeSmart = useCallback(
    (i, roundDeck) => {
      const cards = roundDeck || deckRef.current;
      const fmt = formatPlanRef.current ? formatPlanRef.current[i] : null;
      if (fmt !== FORMAT.PICTURE) {
        setScreen('study');
        return;
      }
      setScreen('pick');
      prepPickRound(cards, i, () => {
        // Downgrade this one card and hand it back to the study screen.
        const plan = [...(formatPlanRef.current || [])];
        plan[i] = FORMAT.NAME;
        setFormatPlan(plan);
        setScreen('study');
      }, { only: true });
    },
    [prepPickRound]
  );

  const startSmart = useCallback(
    (groups, count, flaggedOnly, chosenTypes, setup) => {
      rememberSetup('smart', setup);
      let pool =
        groups && groups.length
          ? playableDeck.filter((c) => groups.includes(groupKey(c.iconic)))
          : playableDeck;
      if (flaggedOnly) {
        const set = flagsRef.current;
        pool = pool.filter((c) => set.has(String(c.taxonId)));
      }
      const cards = scheduleDeck(pool, {
        confusions: confusionRef.current,
        wins: confusionWinsRef.current,
        size: count,
      });
      const plan = (shuffled) => planSmart(shuffled, chosenTypes);
      const run = () =>
        startRound(cards, 'smart', 'Smart play', playableDeck, plan, (shuffled, builtPlan) => {
          // startRound has already put us on 'study'; correct it if card 1 is a
          // photo question. Passed the fresh deck and plan directly, because the
          // state holding them has not re-rendered yet.
          formatPlanRef.current = builtPlan;
          deckRef.current = shuffled;
          routeSmart(0, shuffled);
        });
      replayRef.current = run;
      run();
    },
    [playableDeck, startRound, planSmart, rememberSetup]
  );

  const onSelectMode = useCallback(
    (m) => {
      if (m === 'speedrun') startSpeedrun();
      else if (m === 'pick') startPick();
      else if (m === 'flash') setScreen('flash');
      else if (m === 'nearby') setScreen('nearby');
      else if (m === 'smart') setScreen('smart');
    },
    [startSpeedrun, startPick]
  );

  const finishRound = useCallback(async (finalCorrect, finalMissed, total) => {
    if (finishedRef.current) return; // already finishing this round — ignore
    finishedRef.current = true;
    const updated = await addToStats(total, finalCorrect);
    setLifetime(updated);
    // Persist the per-species tallies accumulated during the round.
    saveSpeciesStats(speciesRef.current);
    setSpeciesStats({ ...speciesRef.current });
    // Persist any confusions recorded during the round (mixed-up look-alikes).
    saveConfusions(confusionRef.current);
    // Record this game's accuracy for the menu chart, and count today toward
    // the daily streak (both skip empty rounds).
    // Kept as a promise because the chart bar it creates has to ride along on the
    // event queued below: the bar's id is decided HERE, and every other device
    // adopts it rather than inventing one, which is what stops the same round
    // being drawn twice on someone else's chart.
    let newBar = Promise.resolve(null);
    if (total > 0) {
      newBar = addGameResult((finalCorrect / total) * 100, total).then((h) => {
        setHistory(h.history);
        setHistoryCounts(h.counts);
        return h.bar;
      });
      recordStreakDay().then(setStreak);
      addActiveDay();
    }
    // Queue the round for other devices. Local storage is already written
    // above, so this is purely additive and safe to fail — an offline round
    // still counts here and uploads whenever the network returns.
    const delta = roundDeltaRef.current;
    roundDeltaRef.current = {};
    const confDelta = confusionDeltaRef.current;
    confusionDeltaRef.current = {};
    const fmtDelta = formatDeltaRef.current;
    formatDeltaRef.current = {};
    // Persist the per-format split alongside the blended totals. Written before
    // the upload for the same reason everything else here is: local storage is
    // authoritative, and the network is allowed to fail.
    if (Object.keys(fmtDelta).length) addToStatsByFormat(fmtDelta).then(setStatsByFormat);
    if (total > 0) {
      // Queue, then flush. recordEvent only writes to the outbox; without this
      // the round would sit there until the next cold launch, which looks
      // exactly like sync being broken. Not awaited — the results screen must
      // never wait on the network.
      newBar
        .then((bar) =>
          recordEvent({
            answered: total,
            correct: finalCorrect,
            pct: (finalCorrect / total) * 100,
            n: total,
            species: delta,
            formats: fmtDelta,
            confusions: confDelta,
            bars: bar ? [bar] : [],
          })
        )
        .then(() => syncCloud());
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
  // `ms` is how long the answer took, when the screen was able to time it (see
  // src/recall.js). Nothing reads it yet — it is recorded because retrieval
  // history is the one thing a future scheduler cannot backfill.
  // Which question format each fixed mode asks in. Recorded on every answer so
  // the lifetime accuracy stays interpretable once Smart play starts mixing
  // formats of very different difficulty inside one round — a blended number
  // would drift as the mix shifts, with no change in what the player knows.
  const formatForCard = useCallback(
    (i = index) => {
      if (formatPlan && formatPlan[i]) return formatPlan[i];
      if (mode === 'pick') return FORMAT.PICTURE;
      if (mode === 'flash') return FORMAT.FLASH;
      return FORMAT.NAME;
    },
    [mode, formatPlan, index]
  );

  const recordResult = useCallback((card, correct, { track = true, ms = 0, format = null } = {}) => {
    if (!card) return null;
    // Same helper the study screen uses to ask "is this mastered?" — one rule,
    // so a lookup can never miss a tally it wrote itself.
    const key = speciesKey(card);
    // One `at` for both folds, so the stored tally and the synced delta can
    // never disagree about when this answer happened.
    const at = Date.now();
    const fmt = format;
    const prev = speciesRef.current[key];
    speciesRef.current[key] = {
      name: card.common || card.scientific,
      sci: card.scientific,
      // Thumbnail for the per-species stats list (kept so it shows even when the
      // species isn't in the current deck, e.g. Nearby rounds).
      image: card.image || (prev && prev.image) || null,
      ...recordRecall(prev, { correct, ms, at, score: fmt ? scoreDelta(fmt, correct) : null }),
    };
    if (track) {
      const d = roundDeltaRef.current[key];
      roundDeltaRef.current[key] = {
        name: card.common || card.scientific,
        sci: card.scientific,
        image: card.image || (d && d.image) || null,
        ...recordRecall(d, { correct, ms, at, score: fmt ? scoreDelta(fmt, correct) : null }),
      };
    }
    if (track && format) {
      const f = formatDeltaRef.current[format] || { answered: 0, correct: 0 };
      formatDeltaRef.current[format] = {
        answered: f.answered + 1,
        correct: f.correct + (correct ? 1 : 0),
      };
    }
    return key;
  }, []);

  // Record one wrong pick into the confusion matrix: the round's card was
  // `correctCard`, the player instead chose `chosenCard`. Only the multiple-
  // choice modes supply a chosen option (self-graded Flash cards don't), and a
  // self-pair is ignored by addConfusion. Persisted with the round (finishRound).
  const recordConfusion = useCallback((correctCard, chosenCard) => {
    if (!correctCard || !chosenCard) return;
    // speciesKey, not a local copy: confusion keys must match the per-species
    // tally keys or the stats screen can't resolve a pair back to its cards.
    const ck = speciesKey(correctCard);
    const chk = speciesKey(chosenCard);
    confusionRef.current = addConfusion(confusionRef.current, ck, chk);
    confusionDeltaRef.current = addConfusion(confusionDeltaRef.current, ck, chk);
    // Relapse on this pair — the fix isn't holding, so drop any recovery run.
    confusionWinsRef.current = recordVerifyMiss(confusionWinsRef.current, pairKey(ck, chk));
    saveConfusionWins(confusionWinsRef.current);
  }, []);

  // Live symmetric confusion count for a pair, for the just-in-time play callout.
  // Reads the ref so it's always current within a round (state props can be stale).
  const confusionCount = useCallback((a, b) => pairCount(confusionRef.current, a, b), []);

  // Whether a species is mastered (src/mastery.js). Reads the live per-species
  // ref so a card mastered earlier this round already counts. Drives the optional
  // fresh-photo swap on the study screen.
  const isSpeciesMastered = useCallback((key) => isMastered(speciesRef.current[key]), []);

  // "Verify the fix" helpers, read from the refs so they stay current mid-round.
  // - partners: the former-nemesis keys for a species, so StudyScreen can seed
  //   the old look-alike back in as a distractor.
  // - streak: the current recovery run for a pair, for the celebratory callout.
  // - win: a correct answer over a seeded old look-alike extends the run.
  const verifyStreakFor = useCallback((pk) => verifyStreak(confusionWinsRef.current, pk), []);
  const recordVerifyWinFor = useCallback((pk) => {
    if (!pk) return;
    confusionWinsRef.current = recordVerifyWin(confusionWinsRef.current, pk);
    saveConfusionWins(confusionWinsRef.current);
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
            const h = await addGameResult((r.correct / r.total) * 100, r.total);
            setHistory(h.history);
            setHistoryCounts(h.counts);
            // The finished wrist round as a chart point. Its cards were already
            // counted one by one above, so this carries pct only — but `n` still
            // rides along, because the bar needs a weight even though the round
            // must not add to the totals a second time.
            recordEvent({
              pct: (r.correct / r.total) * 100,
              n: r.total,
              ts: r.ts || Date.now(),
              bars: h.bar ? [h.bar] : [],
            });
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
    (correct, chosen, verifyPairKey, ms = 0) => {
      const card = deck[index];
      recordResult(card, correct, { ms, format: formatForCard() });
      // A wrong multiple-choice pick is a confusion signal (correct card vs. the
      // option they chose). `chosen` is absent for self-graded Flash cards.
      if (!correct && chosen) recordConfusion(card, chosen);
      // A correct answer over a re-seeded old look-alike extends the recovery run.
      if (correct && verifyPairKey) recordVerifyWinFor(verifyPairKey);
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
        // Smart play is the only mode where the NEXT card may belong on a
        // different screen.
        if (mode === 'smart') routeSmart(index + 1);
      }
    },
    [deck, index, correctCount, missed, mode, lives, finishRound, recordResult, recordConfusion, recordVerifyWinFor, routeSmart, formatForCard]
  );

  // Grade a tap in "Pick the right one" (tally only; advancing waits for Next).
  const handlePickGrade = useCallback(
    (correct, chosen) => {
      const card = deck[index];
      recordResult(card, correct, { format: formatForCard() });
      if (!correct && chosen) recordConfusion(card, chosen);
      if (correct) setCorrectCount((c) => c + 1);
      else setMissed((m) => [...m, card]);
    },
    [deck, index, recordResult, recordConfusion, formatForCard]
  );

  // Advance to the next pick round (or finish when the deck is done).
  const handlePickNext = useCallback(() => {
    const total = correctCount + missed.length;
    if (index + 1 >= deck.length) {
      finishRound(correctCount, missed, total);
      return;
    }
    // Smart play owns its own routing: the next card may not be a photo
    // question at all, so hand it back to the router rather than preparing
    // another pick round here.
    if (mode === 'smart') {
      setIndex(index + 1);
      routeSmart(index + 1);
      return;
    }
    prepPickRound(deck, index + 1, () =>
      finishRound(correctCount, missed, total)
    );
  }, [deck, index, correctCount, missed, mode, finishRound, prepPickRound, routeSmart]);

  // The side-by-side comparison overlay. Rendered on top of whatever screen is
  // showing (Stats, or mid-round from the just-in-time callout), so it lives in
  // a helper reused by every return branch below.
  const renderCompareOverlay = () => (
    <SafeAreaView style={styles.detailOverlay} edges={['top', 'bottom']}>
      <SwipeBackView style={styles.flex} onBack={() => setComparePair(null)}>
        <Appear style={styles.flex} offset={40} duration={300}>
          <CompareScreen
            pair={comparePair}
            initialNote={confusionNotes[comparePair.pairKey] || ''}
            onSaveNote={(pairKey, text) => {
              // Persist (stamped now) then mirror to the settings row so the note
              // syncs across devices. pushSettings is a no-op when sync is off.
              saveConfusionNote(pairKey, text).then(() =>
                pushSettings({ perSpecies, locale, researchGrade, speciesOnly, namedOnly, freshPhotos, themeMode }, username)
              );
              setConfusionNotes((prev) => {
                const next = { ...prev };
                const t = (text || '').trim();
                if (t) next[pairKey] = t;
                else delete next[pairKey];
                return next;
              });
            }}
            onDrill={(p) => {
              setComparePair(null);
              setDuelPair(p);
            }}
            onClose={() => setComparePair(null)}
          />
        </Appear>
      </SwipeBackView>
    </SafeAreaView>
  );

  // The A/B duel drill, opened from the comparison's "Drill this pair". Same
  // overlay-on-top-of-any-screen pattern as the comparison, so it's reachable
  // both from Stats and mid-round.
  const renderDuelOverlay = () => (
    <SafeAreaView style={styles.detailOverlay} edges={['top', 'bottom']}>
      <SwipeBackView style={styles.flex} onBack={() => setDuelPair(null)}>
        <Appear style={styles.flex} offset={40} duration={300}>
          <DuelScreen
            pair={duelPair}
            note={confusionNotes[duelPair.pairKey] || ''}
            onClose={() => setDuelPair(null)}
          />
        </Appear>
      </SwipeBackView>
    </SafeAreaView>
  );

  // Back navigation for the screen currently showing. Derived once, from the one
  // map in src/navigation.js, and handed to BOTH the screen's own header chevron
  // and the edge swipe-back gesture — so the two can never disagree about where
  // back goes, or about whether it exists at all (null disables both).
  const target = backTarget(screen);
  const navBack = useMemo(
    () => (target ? () => setScreen(target) : null),
    [target]
  );

  // Settings is the one screen with work to do on the way out: `leave` applies
  // any pending field edits (see its registerLeave), so the gesture must go
  // through it rather than navigating straight away. It also has nowhere to go
  // until a deck exists — the first run parks you here until you pick an account.
  const swipeBack =
    screen === 'settings'
      ? fullDeck.length > 0
        ? () => (settingsLeaveRef.current || navBack || (() => {}))()
        : null
      : navBack;

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
      <TutorialProvider screen={screen} state={tutorial} onChange={changeTutorial}>
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
            choiceMode={['all', 'speedrun', 'nearby'].includes(mode)}
            answerMode={
              mode === 'smart'
                ? formatForCard() === FORMAT.TYPED
                  ? 'typed'
                  : 'choice'
                : null
            }
            pairWith={
              mode === 'smart' && formatForCard() === FORMAT.PAIR
                ? pairPartnerFor(deck[index])
                : null
            }
            choicePool={roundPool}
            flags={flags}
            onToggleFlag={toggleFlag}
            onGrade={handleGrade}
            onConfusionCount={confusionCount}
            onNemesisPartners={nemesisPartnersFor}
            onVerifyStreak={verifyStreakFor}
            onCompare={(item) => setComparePair(item)}
            freshPhotos={freshPhotos}
            onIsMastered={isSpeciesMastered}
            offline={offline}
            onQuit={() =>
              finishRound(correctCount, missed, correctCount + missed.length)
            }
          />
        </Appear>
        {comparePair && renderCompareOverlay()}
        {duelPair && renderDuelOverlay()}
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
        <TutorialOverlay />
      </TutorialProvider>
      </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  // "Pick the right one" renders full-bleed (it owns its insets), like study.
  if (screen === 'pick') {
    return (
      <ThemeProvider value={theme}>
      <SafeAreaProvider>
      <TutorialProvider screen={screen} state={tutorial} onChange={changeTutorial}>
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
            onConfusionCount={confusionCount}
            onCompare={(item) => setComparePair(item)}
            onQuit={() =>
              finishRound(correctCount, missed, correctCount + missed.length)
            }
          />
        </Appear>
        {comparePair && renderCompareOverlay()}
        {duelPair && renderDuelOverlay()}
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
        <TutorialOverlay />
      </TutorialProvider>
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
        <TutorialProvider screen={screen} state={tutorial} onChange={changeTutorial}>
          <Appear style={styles.menuRoot} offset={0} duration={320}>
            <StatusBar style="light" />
            <MenuScreen
              username={username}
              deckCount={playableDeck.length}
              lifetime={lifetime}
              history={history}
              historyCounts={historyCounts}
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
              offline={offline}
            />
          </Appear>
          {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
          <SupportModal visible={showSupport} onClose={() => setShowSupport(false)} />
          <TutorialOverlay />
        </TutorialProvider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={theme}>
    <SafeAreaProvider>
    <TutorialProvider screen={screen} state={tutorial} onChange={changeTutorial}>
      <SafeAreaView style={styles.safe}>
        <StatusBar style={statusBarStyle} />

        {/* Swipe-right-from-the-left-edge to go back — the same action as the
            screen's own header chevron, from the same source (see swipeBack
            above). Screens with no back pass null, which disables the gesture. */}
        <SwipeBackView style={styles.flex} onBack={swipeBack}>
        {/* Keyed on `screen` so each of these non-full-bleed screens fades +
            slides in when navigated to. */}
        <Appear key={screen} style={styles.flex} offset={10} duration={300}>
        {screen === 'loading' && (
          <View style={styles.center}>
            {/* The gote newt rather than a system spinner: this screen is the
                first thing a new install sits on, sometimes for half a minute.
                Teal artwork because it sits on the app's own background, where
                the white newt every other spinner uses would vanish in the
                light theme. Spinner falls back to an ActivityIndicator until
                the GIF has decoded, which matters here — SpinnerWarmup lives on
                the menu, and on a first launch this screen comes first. */}
            <Spinner size={72} teal color={colors.primary} />
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
            {/* Says the same thing as the hint under the username field in
                Settings, and for the same reason: a big account stops well
                short of its real total (MAX_CACHE in src/api.js), and without
                this the count above looks like the load gave up. Not shown for
                "nearby", which is a different query with its own limit. */}
            {!loadingNearby && (
              <Text style={styles.loadingNote}>
                Only the ~1,000 most recent observations are loaded.
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
            namedOnly={namedOnly}
            freshPhotos={freshPhotos}
            themeMode={themeMode}
            onThemeModeChange={onThemeModeChange}
            error={error}
            sync={sync}
            offline={offline}
            onUpdateNow={
              username ? () => syncNow(username, locale) : null
            }
            onChangelog={() => setScreen('changelog')}
            onLegal={() => setScreen('legal')}
            onSync={SYNC_ENABLED ? () => setScreen('sync') : null}
            onTutorial={restartTutorial}
            onBack={fullDeck.length > 0 ? navBack : null}
            registerLeave={(fn) => { settingsLeaveRef.current = fn; }}
            onSave={(name, prefs) => {
              setPerSpecies(prefs.perSpecies);
              setLocale(prefs.locale);
              setResearchGrade(prefs.researchGrade);
              setSpeciesOnly(prefs.speciesOnly);
              setNamedOnly(!!prefs.namedOnly);
              setFreshPhotos(!!prefs.freshPhotos);
              // Keep the ref current immediately (a re-download triggers a sync
              // that filters via prefsRef before this render's state commits).
              prefsRef.current = {
                perSpecies: prefs.perSpecies,
                researchGrade: prefs.researchGrade,
                speciesOnly: prefs.speciesOnly,
                namedOnly: !!prefs.namedOnly,
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

        {screen === 'smart' && (
          <CustomScreen
            deck={fullDeck}
            title="Smart play"
            flags={flags}
            questionTypes={SMART_QUESTION_TYPES}
            // The screenshots build always opens on the defaults: those runs
            // reuse a cached install rather than a fresh one, so a setup left
            // behind by the previous run would quietly change what gets
            // captured. Same reason the tour does not auto-start there.
            initial={IS_SHOTS ? null : roundSetup.smart}
            onStart={startSmart}
            onBack={navBack}
          />
        )}

        {screen === 'flash' && (
          <CustomScreen
            deck={fullDeck}
            title="Flash cards"
            flags={flags}
            initial={IS_SHOTS ? null : roundSetup.flash}
            onStart={startFlash}
            onBack={navBack}
          />
        )}

        {screen === 'nearby' && (
          <NearbyConfigScreen
            onStart={startNearby}
            onBack={navBack}
          />
        )}

        {screen === 'stats' && (
          <StatsScreen
            species={speciesStats}
            cards={fullDeck}
            confusions={confusionRef.current}
            confusionNotes={confusionNotes}
            onCompare={(item) => setComparePair(item)}
            lifetime={lifetime}
            statsByFormat={statsByFormat}
            history={history}
            historyCounts={historyCounts}
            streak={streakStatus(streak)}
            flags={flags}
            onToggleFlag={toggleFlag}
            onBack={navBack}
            onSelect={(card) => setDetailCard(card)}
            onReset={async () => {
              // Clears the confusion matrix and the recovery streaks as well —
              // both are derived from play — and tombstones the player's pair
              // notes. Only the in-memory mirrors are left to us.
              await resetStatistics();
              speciesRef.current = {};
              setSpeciesStats({});
              confusionRef.current = {};
              confusionWinsRef.current = {};
              setConfusionNotes({});
              // The note deletions live in the settings row, so they only reach
              // the player's other devices if we push. A no-op when sync is off.
              pushSettings({ perSpecies, locale, researchGrade, speciesOnly, namedOnly, freshPhotos, themeMode }, username);
              setLifetime({ answered: 0, correct: 0 });
              setStatsByFormat({});
              setHistory([]);
              setHistoryCounts([]);
              setStreak({ current: 0, longest: 0, lastActiveDay: null });
            }}
          />
        )}

        {screen === 'changelog' && (
          <ChangelogScreen onBack={navBack} />
        )}

        {screen === 'legal' && (
          <LegalScreen onBack={navBack} />
        )}

        {screen === 'lexicon' && (
          <LexiconScreen
            cards={fullDeck}
            speciesStats={speciesStats}
            flags={flags}
            onToggleFlag={toggleFlag}
            onBack={navBack}
            onSelect={(card) => setDetailCard(card)}
          />
        )}

        {screen === 'sync' && (
          <SyncScreen
            onBack={navBack}
            // Signing in can fold in a whole other device's history AND its
            // settings, so adopt both immediately rather than waiting for a
            // relaunch. afterAuthChange returns { merged, settings }.
            onSynced={(res) => {
              if (!res) return;
              const merged = res.merged;
              if (merged) {
                setLifetime(merged.lifetime);
                if (merged.formats) setStatsByFormat(merged.formats);
                speciesRef.current = merged.species;
                setSpeciesStats({ ...merged.species });
                setHistory(merged.history);
                setHistoryCounts(merged.historyCounts || []);
                setStreak(merged.streak);
                if (merged.confusions) confusionRef.current = merged.confusions;
              }
              if (res.settings) applyRemoteSettings(res.settings);
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
                  offline={offline}
                  onBack={() => setDetailCard(null)}
                />
              </Appear>
            </SwipeBackView>
          </SafeAreaView>
        )}

        {/* Side-by-side comparison for a confused pair — opened from the
            "Species you mix up" list (and the in-round callout). */}
        {comparePair && renderCompareOverlay()}
        {duelPair && renderDuelOverlay()}
      </SafeAreaView>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} onLayout={hideNativeSplash} />}
      <SupportModal visible={showSupport} onClose={() => setShowSupport(false)} />
      <TutorialOverlay />
    </TutorialProvider>
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
  // Smaller than the count it sits under: a standing fact about the account,
  // not part of the progress. Matches Settings' accountHint.
  loadingNote: { marginTop: 10, fontSize: 12.5, color: colors.muted, textAlign: 'center' },
  loadingCancel: { marginTop: 28, paddingVertical: 8, paddingHorizontal: 16 },
  loadingCancelText: { fontSize: 15, fontWeight: '700', color: colors.muted },
});
