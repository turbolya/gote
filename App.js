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
  ActivityIndicator,
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
} from './src/storage';
import { SPEEDRUN_LIVES, DEFAULT_LOCALE, SUPPORT_PROMPT_CHANCE, DEFAULT_USERNAME } from './src/constants';
import { buildPickRound } from './src/quiz';
import { prefetchImages } from './src/prefetch';
import { groupKey, ThemeProvider, themeFor, resolveScheme } from './src/theme';
import { IS_E2E } from './src/e2e/testMode';
import { E2E_CARDS } from './src/e2e/fixtures';
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
import NearbyConfigScreen from './src/screens/NearbyConfigScreen';
import SplashScreen from './src/components/SplashScreen';
import SupportModal from './src/components/SupportModal';
import SwipeBackView from './src/components/SwipeBackView';
import { Appear } from './src/components/anim';

const pickRandom = (cards, n) => shuffle(cards).slice(0, n);

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
  // Show a blurred random-card photo behind the main menu.
  const [menuPhotoBackdrop, setMenuPhotoBackdrop] = useState(true);

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
      savePrefs({ perSpecies, locale, researchGrade, speciesOnly, themeMode: mode, menuPhotoBackdrop });
    },
    [perSpecies, locale, researchGrade, speciesOnly, menuPhotoBackdrop]
  );

  // Toggle + persist the menu photo backdrop (applies immediately).
  const onMenuBackdropChange = useCallback(
    (enabled) => {
      setMenuPhotoBackdrop(enabled);
      savePrefs({ perSpecies, locale, researchGrade, speciesOnly, themeMode, menuPhotoBackdrop: enabled });
    },
    [perSpecies, locale, researchGrade, speciesOnly, themeMode]
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

  // How to restart the current mode (used by the "Play again" button).
  const replayRef = useRef(() => {});

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
        if (updated.length > 0) {
          rawCardsRef.current = mergeCards(rawCardsRef.current, updated);
          const newWatermark = newestUpdatedAt(rawCardsRef.current);
          if (newWatermark) watermarkRef.current = newWatermark;
          applyCurrentFilters(prefsRef.current);
        }
        const syncedAt = persistCache(name, loc);
        setSync({
          state: 'done',
          syncedAt,
          message:
            updated.length > 0
              ? `Updated ${updated.length} observation${updated.length === 1 ? '' : 's'}.`
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
      try {
        const cards = await fetchCards(name, {
          locale: prefs.locale,
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
        setError(e.message || 'Something went wrong. Please try again.');
        setScreen('settings');
      }
    },
    [applyCurrentFilters, persistCache]
  );

  // Decide how to load an account: use the cache if it matches (instant, then
  // background sync), otherwise do a full download.
  const loadAccount = useCallback(
    async (name, prefs, cache) => {
      const usable = cache || (await loadCache());
      if (cacheMatches(usable, name, prefs.locale)) {
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
      const [savedUser, savedStats, savedPrefs, savedSpecies, savedCache, savedHistory, savedStreak] =
        await Promise.all([
          loadUsername(),
          loadStats(),
          loadPrefs(),
          loadSpeciesStats(),
          loadCache(),
          loadHistory(),
          loadStreak(),
        ]);
      if (savedStats) setLifetime(savedStats);
      if (savedHistory && savedHistory.length) setHistory(savedHistory);
      if (savedStreak) setStreak(savedStreak);
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
      // Default the menu backdrop on unless explicitly disabled.
      const mb = !(savedPrefs && savedPrefs.menuPhotoBackdrop === false);
      setPerSpecies(ps);
      setLocale(loc);
      setResearchGrade(rg);
      setSpeciesOnly(so);
      setThemeMode(tm);
      setMenuPhotoBackdrop(mb);
      // Seed the ref now: the startup background sync fires before React re-renders
      // with these values, and must filter by the saved prefs, not the defaults.
      prefsRef.current = { perSpecies: ps, researchGrade: rg, speciesOnly: so };
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

  // Start a fresh round from a set of cards. `pool` is the distractor pool for
  // multiple-choice (defaults to the round's own cards). An empty set is a
  // no-op: the study screen requires a non-empty deck, and starting without one
  // (e.g. "Research grade only" filtering everything out) would dead-end on a
  // blank screen.
  const startRound = useCallback((cards, m, label = '', pool = null) => {
    if (!cards || cards.length === 0) return;
    setMode(m);
    setRoundLabel(label);
    setDeck(shuffle(cards));
    setRoundPool(pool && pool.length ? pool : cards);
    setIndex(0);
    setCorrectCount(0);
    setMissed([]);
    setLives(SPEEDRUN_LIVES);
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
      try {
        const cards = await fetchNearbyCards({
          lat: config.lat,
          lng: config.lng,
          radius: config.radius,
          iconicTaxa: config.iconicTaxa,
          locale,
          onProgress: (loaded, total) => setProgress({ loaded, total }),
        });
        const run = () => startRound(cards, 'nearby', 'Nearby species');
        replayRef.current = run;
        run();
      } catch (e) {
        setError(e.message || 'Could not load nearby species.');
        setScreen('nearby');
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

    for (let i = startIdx; i < roundDeck.length; i++) {
      const card = roundDeck[i];
      const [correctPhotos, similar] = await Promise.all([
        fetchTaxonPhotos(card.taxonId),
        fetchSimilarSpecies(card.taxonId, locale),
      ]);
      if (pickReqRef.current !== reqId) return; // superseded — bail

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
    // Ran out of usable cards.
    setPickLoading(false);
    if (onExhausted) onExhausted();
  }, [locale]);

  const startPick = useCallback(() => {
    replayRef.current = startPick;
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
    }
    setMissed(finalMissed);
    setCorrectCount(finalCorrect);
    setScreen('results');
  }, []);

  // Record a single card's outcome into the per-species tallies.
  const recordResult = useCallback((card, correct) => {
    if (!card) return;
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
  }, []);

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
              cards={fullDeck}
              photoBackdrop={menuPhotoBackdrop}
              lifetime={lifetime}
              history={history}
              streak={streakStatus(streak)}
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
              settings: fullDeck.length > 0 ? () => setScreen('menu') : null,
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
            menuPhotoBackdrop={menuPhotoBackdrop}
            onMenuBackdropChange={onMenuBackdropChange}
            error={error}
            sync={sync}
            onUpdateNow={
              username ? () => syncNow(username, locale) : null
            }
            onChangelog={() => setScreen('changelog')}
            onLegal={() => setScreen('legal')}
            onBack={fullDeck.length > 0 ? () => setScreen('menu') : null}
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
              savePrefs({ ...prefs, themeMode, menuPhotoBackdrop });
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
});
