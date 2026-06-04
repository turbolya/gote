// Gote — a card-based learning game built on the iNaturalist API.
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
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import {
  fetchCards,
  fetchUpdatedCards,
  fetchTaxonPhotos,
  fetchTaxonPhotosByIds,
  fetchSimilarSpecies,
  applyFilters,
  mergeCards,
  newestUpdatedAt,
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
} from './src/storage';
import { SPEEDRUN_LIVES, DEFAULT_LOCALE } from './src/constants';
import { buildPickRound } from './src/quiz';
import { prefetchImages } from './src/prefetch';
import { groupKey } from './src/theme';
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
import SplashScreen from './src/components/SplashScreen';
import { colors } from './src/theme';

const pickRandom = (cards, n) => shuffle(cards).slice(0, n);

export default function App() {
  // loading | settings | menu | custom | study | results
  const [screen, setScreen] = useState('loading');
  // Branded launch splash overlay; dismissed (faded out) after a moment.
  const [showSplash, setShowSplash] = useState(true);
  const [username, setUsername] = useState('');
  const [perSpecies, setPerSpecies] = useState(true);
  const [locale, setLocale] = useState(DEFAULT_LOCALE);
  const [researchGrade, setResearchGrade] = useState(false);
  const [speciesOnly, setSpeciesOnly] = useState(false);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState({ loaded: 0, total: 0 });
  const [lifetime, setLifetime] = useState({ answered: 0, correct: 0 });

  // Raw cached cards (unfiltered) for the current account, kept in a ref so sync
  // can read/merge without re-renders. `fullDeck` is the filtered view shown to
  // the game (perSpecies/researchGrade applied locally).
  const rawCardsRef = useRef([]);
  const watermarkRef = useRef(null);
  const [fullDeck, setFullDeck] = useState([]);
  // Sync status for the Settings UI: { state: idle|syncing|done|error, syncedAt, message }
  const [sync, setSync] = useState({ state: 'idle', syncedAt: null, message: null });
  // The card whose detail page is open (from the Lexicon).
  const [selectedCard, setSelectedCard] = useState(null);
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

  // The pool of candidate cards for multiple-choice distractors ("All cards"
  // mode). Passed as full cards so StudyScreen can pick taxonomically similar
  // distractors using each card's ancestry.
  const choicePool = fullDeck;

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
          applyCurrentFilters({ perSpecies, researchGrade, speciesOnly });
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
    [perSpecies, researchGrade, speciesOnly, applyCurrentFilters, persistCache]
  );

  // Full download for a brand-new account (or forced refresh). Shows the loading
  // screen, replaces the cache, then lands on the menu.
  const fullDownload = useCallback(
    async (name, prefs) => {
      setError(null);
      setProgress({ loaded: 0, total: 0 });
      // Set the username up front so the loading screen shows the NEW user, not
      // the previous one.
      setUsername(name);
      setScreen('loading');
      try {
        const cards = await fetchCards(name, {
          locale: prefs.locale,
          onProgress: (loaded, total) => setProgress({ loaded, total }),
        });
        rawCardsRef.current = cards;
        watermarkRef.current = newestUpdatedAt(cards);
        applyCurrentFilters(prefs);
        await saveUsername(name);
        const syncedAt = persistCache(name, prefs.locale);
        setSync({ state: 'done', syncedAt, message: null });
        setScreen('menu');
      } catch (e) {
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
      const [savedUser, savedStats, savedPrefs, savedSpecies, savedCache] =
        await Promise.all([
          loadUsername(),
          loadStats(),
          loadPrefs(),
          loadSpeciesStats(),
          loadCache(),
        ]);
      if (savedStats) setLifetime(savedStats);
      speciesRef.current = savedSpecies || {};
      setSpeciesStats(speciesRef.current);
      const ps = savedPrefs && typeof savedPrefs.perSpecies === 'boolean'
        ? savedPrefs.perSpecies
        : true;
      const loc = (savedPrefs && savedPrefs.locale) || DEFAULT_LOCALE;
      const rg = !!(savedPrefs && savedPrefs.researchGrade);
      const so = !!(savedPrefs && savedPrefs.speciesOnly);
      setPerSpecies(ps);
      setLocale(loc);
      setResearchGrade(rg);
      setSpeciesOnly(so);
      if (savedUser) {
        setUsername(savedUser);
        loadAccount(
          savedUser,
          { perSpecies: ps, locale: loc, researchGrade: rg, speciesOnly: so },
          savedCache
        );
      } else {
        setScreen('settings');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Start a fresh round from a set of cards.
  const startRound = useCallback((cards, m, label = '') => {
    setMode(m);
    setRoundLabel(label);
    setDeck(shuffle(cards));
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

  const startCustom = useCallback(
    (groups, count) => {
      const pool =
        groups && groups.length
          ? fullDeck.filter((c) => groups.includes(groupKey(c.iconic)))
          : fullDeck;
      const run = () =>
        startRound(pickRandom(pool, count), 'custom', 'Custom game');
      replayRef.current = run;
      run();
    },
    [fullDeck, startRound]
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
    },
    [startAll, startSpeedrun, startPick]
  );

  const finishRound = useCallback(async (finalCorrect, finalMissed, total) => {
    const updated = await addToStats(total, finalCorrect);
    setLifetime(updated);
    // Persist the per-species tallies accumulated during the round.
    saveSpeciesStats(speciesRef.current);
    setSpeciesStats({ ...speciesRef.current });
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
  // The study screen renders full-bleed (its blurred photo backdrop must reach
  // the very top/bottom edges), so it lives OUTSIDE the SafeAreaView and applies
  // insets internally to just its chrome.
  if (screen === 'study' && deck.length > 0) {
    return (
      <SafeAreaProvider>
        <View style={styles.studyRoot}>
          <StatusBar style="light" />
          <StudyScreen
            deck={deck}
            index={index}
            correctCount={correctCount}
            roundLabel={roundLabel}
            speedrun={mode === 'speedrun'}
            lives={lives}
            choiceMode={mode === 'all'}
            choicePool={choicePool}
            onGrade={handleGrade}
            onQuit={() =>
              finishRound(correctCount, missed, correctCount + missed.length)
            }
          />
        </View>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      </SafeAreaProvider>
    );
  }

  // "Pick the right one" renders full-bleed (it owns its insets), like study.
  if (screen === 'pick') {
    return (
      <SafeAreaProvider>
        <View style={styles.pickRoot}>
          <StatusBar style="dark" />
          <PickImageScreen
            round={pickRound}
            index={index}
            total={deck.length}
            correctCount={correctCount}
            loading={pickLoading}
            error={pickError}
            onPick={handlePickGrade}
            onNext={handlePickNext}
            onQuit={() =>
              finishRound(correctCount, missed, correctCount + missed.length)
            }
          />
        </View>
        {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <StatusBar style="dark" />

        {screen === 'loading' && (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              Loading observations{username ? ` for ${username}` : ''}…
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
              savePrefs(prefs);
              // Re-download only when the account identity changes (username or
              // language). The toggles are local filters, so just re-derive the
              // deck and stay put — no network needed.
              const accountChanged =
                name !== username || prefs.locale !== locale;
              if (accountChanged) {
                loadAccount(name, prefs);
              } else {
                applyCurrentFilters(prefs);
                setScreen('menu');
              }
            }}
          />
        )}

        {screen === 'menu' && (
          <MenuScreen
            username={username}
            deckCount={fullDeck.length}
            lifetime={lifetime}
            onSelectMode={onSelectMode}
            onLexicon={() => setScreen('lexicon')}
            onStats={() => setScreen('stats')}
            onSettings={() => {
              setError(null);
              setScreen('settings');
            }}
          />
        )}

        {screen === 'custom' && (
          <CustomScreen
            deck={fullDeck}
            onStart={startCustom}
            onBack={() => setScreen('menu')}
          />
        )}

        {screen === 'stats' && (
          <StatsScreen
            species={speciesStats}
            lifetime={lifetime}
            onBack={() => setScreen('menu')}
            onReset={async () => {
              await resetStatistics();
              speciesRef.current = {};
              setSpeciesStats({});
              setLifetime({ answered: 0, correct: 0 });
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
            onBack={() => setScreen('menu')}
            onSelect={(card) => {
              setSelectedCard(card);
              setScreen('detail');
            }}
          />
        )}

        {screen === 'detail' && selectedCard && (
          <DetailScreen
            card={selectedCard}
            locale={locale}
            onBack={() => setScreen('lexicon')}
          />
        )}

        {screen === 'results' && (
          <ResultsScreen
            mode={mode}
            total={correctCount + missed.length}
            correct={correctCount}
            missed={missed}
            lifetime={lifetime}
            onRevisitMissed={() =>
              startRound(missed, 'all', 'Revisiting missed cards')
            }
            onPlayAgain={() => replayRef.current()}
            onMenu={() => setScreen('menu')}
          />
        )}
      </SafeAreaView>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  // The study screen is full-bleed: its photo backdrop must reach every edge,
  // so no safe-area padding here (StudyScreen insets its own chrome).
  studyRoot: { flex: 1, backgroundColor: '#1A1D1A' },
  // Pick-the-right-one owns its own insets too.
  pickRoot: { flex: 1, backgroundColor: colors.bg },
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
