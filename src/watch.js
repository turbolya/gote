// Apple Watch sync (iOS-only). Pushes a small snapshot — lifetime accuracy,
// daily streak, and a mini-deck of cards — to the paired watch whenever the
// app's stats or deck change. The watch app (targets/watch) renders the stats,
// serves a 4-choice picture quiz from the mini-deck, and feeds the watch-face
// complication (targets/watch-widget).
//
// Everything is best-effort: a silent no-op on Android/web/tests (no native
// module) and on iPhones without a paired watch.

import { Platform } from 'react-native';
import {
  updateWatchContext,
  subscribeWatchResults as subscribeNative,
} from '../modules/watch-bridge';
import { toSmallPhoto } from './api';

// How many cards to send. WatchConnectivity's application context should stay
// small (~64 KB); two dozen id+name+URL entries is a few KB and plenty for a
// wrist-sized quiz session.
const DECK_LIMIT = 24;

// The last snapshot sent, as JSON — dedupe so unrelated re-renders (or the
// same deck re-applying) don't re-send an identical context.
let lastSent = null;

// Build and push the watch snapshot. `streak` is the DISPLAY streak (from
// streakStatus: { count, longest }), so a lapsed streak shows 0 on the wrist
// just like it does on the phone.
export function pushWatchSnapshot({ lifetime, streak, deck }) {
  if (Platform.OS !== 'ios') return;

  const answered = (lifetime && lifetime.answered) || 0;
  const correct = (lifetime && lifetime.correct) || 0;

  const cards = (deck || [])
    .filter((c) => c && c.taxonId != null && c.image)
    .slice(0, DECK_LIMIT)
    .map((c) => ({
      id: c.taxonId,
      name: c.common || c.scientific,
      sci: c.scientific || '',
      image: toSmallPhoto(c.image),
    }));

  const context = {
    v: 1,
    correct,
    answered,
    streak: (streak && streak.count) || 0,
    streakBest: (streak && streak.longest) || 0,
    deck: cards,
  };
  // Only set accuracy once something has been played — the watch shows a
  // placeholder until then (mirrors the phone hero's behaviour).
  if (answered > 0) context.accuracy = Math.round((correct / answered) * 100);

  const json = JSON.stringify(context);
  if (json === lastSent) return;
  lastSent = json;
  updateWatchContext(context);
}

// Subscribe to game results played on the watch (answers + finished rounds).
// `onResult` receives each raw payload: { kind: 'answer', id, name, sci,
// image, correct, ts } or { kind: 'round', correct, total, ts }. Returns an
// unsubscribe function; a no-op off iOS.
export function subscribeWatchResults(onResult) {
  if (Platform.OS !== 'ios') return () => {};
  return subscribeNative(onResult);
}
