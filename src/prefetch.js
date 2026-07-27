// Image preloading + a downloaded-photo manifest.
//
// Two jobs:
//   1. Warm the native image cache with upcoming photos so the next card
//      appears instantly and the bytes are reused later (RN's Image.prefetch
//      downloads into the same on-disk cache <Image> reads from).
//   2. Remember which URLs we successfully prefetched, persisted across launches
//      (src/storage.js), so an OFFLINE session can be limited to cards whose
//      photos will actually render. The OS image cache isn't queryable, so this
//      manifest is our proxy for "downloaded". It's approximate — an entry may
//      have been evicted — so it's a play-time hint, not a hard guarantee.

import { Image } from 'react-native';
import {
  loadDownloadedImages,
  addDownloadedImages,
  clearDownloadedImages,
} from './storage';

// URLs we've already issued a prefetch for this session (dedupe requests).
const requested = new Set();
// URLs known downloaded (seeded from storage, grown as prefetches resolve).
const downloaded = new Set();

// Resolved-but-not-yet-persisted URLs, flushed in a batch so we don't hit
// storage once per image.
let pending = [];
let flushTimer = null;
let seeded = false;

// Seed the downloaded set from the persisted manifest. Call once at startup,
// before anything reads isImageDownloaded for an offline deck.
export async function initDownloadedImages() {
  if (seeded) return;
  seeded = true;
  try {
    for (const u of await loadDownloadedImages()) downloaded.add(u);
  } catch {
    /* best-effort */
  }
}

export function isImageDownloaded(url) {
  return !!url && downloaded.has(url);
}

function recordDownloaded(url) {
  if (!url || downloaded.has(url)) return;
  downloaded.add(url);
  pending.push(url);
  if (!flushTimer) flushTimer = setTimeout(flushDownloaded, 1500);
}

// Persist the pending batch. Safe to call directly (e.g. on backgrounding).
export async function flushDownloaded() {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  try {
    await addDownloadedImages(batch);
  } catch {
    /* best-effort — try again on the next flush */
  }
}

// Forget every downloaded photo (in-memory + persisted). Called when the user
// empties the photo cache, so the offline deck doesn't claim evicted images.
export async function clearDownloadedManifest() {
  downloaded.clear();
  requested.clear();
  pending = [];
  await clearDownloadedImages();
}

// Prefetch a list of image URLs (best-effort). A resolved prefetch is recorded
// as downloaded. Skips blanks and anything already requested this session.
export function prefetchImages(urls) {
  for (const url of urls || []) {
    if (!url || requested.has(url)) continue;
    requested.add(url);
    Image.prefetch(url)
      .then(() => recordDownloaded(url))
      .catch(() => {
        // Failed to fetch — allow a later retry by forgetting the request.
        requested.delete(url);
      });
  }
}

// Prefetch the next `count` cards' images in a deck, starting after `index`.
// Wraps around for endless modes (speedrun) so the loop's start is warm too.
export function prefetchUpcoming(deck, index, count = 3) {
  if (!Array.isArray(deck) || deck.length === 0) return;
  const urls = [];
  for (let i = 1; i <= count; i++) {
    const card = deck[(index + i) % deck.length];
    if (card && card.image) urls.push(card.image);
  }
  prefetchImages(urls);
}

// Proactively build an offline pack: after a deck loads online, warm (and
// record) a capped slice of its photos, spread over time so we don't fire
// hundreds of concurrent downloads at once. `count` cards is plenty for an
// offline session; ongoing play warms the rest via prefetchUpcoming.
export function prefetchDeck(deck, { count = 120, chunk = 8, gapMs = 400 } = {}) {
  if (!Array.isArray(deck)) return;
  const urls = [];
  for (const c of deck) {
    if (c && c.image) urls.push(c.image);
    if (urls.length >= count) break;
  }
  let i = 0;
  const step = () => {
    if (i >= urls.length) return;
    prefetchImages(urls.slice(i, i + chunk));
    i += chunk;
    if (i < urls.length) setTimeout(step, gapMs);
  };
  step();
}
