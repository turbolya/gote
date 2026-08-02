// Image preloading for upcoming cards, and the offline photo pack.
//
// Two jobs, and they are no longer the same mechanism:
//
//   1. Warm the next few cards so a transition is instant. Image.prefetch is
//      right for this — it is only ever a speed optimisation.
//   2. Build the OFFLINE pack. This writes real files through src/photocache.js,
//      because "will this photo render with no connection?" has to be a fact
//      about the filesystem. It used to be a remembered list of prefetched URLs,
//      but prefetch only warms the OS cache, which evicts silently and can't be
//      queried — so offline decks served cards whose photos were gone and every
//      card showed a broken-image placeholder.

import { Image } from 'react-native';
import { clearDownloadedImages } from './storage';
import {
  initPhotoCache,
  isCached,
  cachePhotos,
  clearPhotoCache,
} from './photocache';

// URLs we've already asked the OS to warm this session (dedupe requests).
const requested = new Set();

// Read the on-disk pack once at startup, before anything filters a deck for
// offline play.
export async function initDownloadedImages() {
  await initPhotoCache();
  // One-time tidy-up: the old AsyncStorage manifest is no longer consulted
  // (the filesystem is the truth now), so stop carrying it around.
  clearDownloadedImages().catch(() => {});
}

// Is this photo actually available offline? Backed by the file cache.
export function isImageDownloaded(url) {
  return isCached(url);
}

// Forget every downloaded photo. Called when the user empties the photo cache,
// so the offline deck doesn't claim images the user just deleted.
export async function clearDownloadedManifest() {
  requested.clear();
  await clearPhotoCache();
}

// Warm the OS image cache (speed only — never counted as offline-ready).
export function prefetchImages(urls) {
  for (const url of urls || []) {
    if (!url || requested.has(url)) continue;
    requested.add(url);
    Image.prefetch(url).catch(() => {
      requested.delete(url); // allow a later retry
    });
  }
}

// Prefetch the next `count` cards' images in a deck, starting after `index`.
// Wraps around for endless modes (speedrun) so the loop's start is warm too.
// Also files them into the offline pack, so simply playing builds it up.
export function prefetchUpcoming(deck, index, count = 3) {
  if (!Array.isArray(deck) || deck.length === 0) return;
  const urls = [];
  for (let i = 1; i <= count; i++) {
    const card = deck[(index + i) % deck.length];
    if (card && card.image) urls.push(card.image);
  }
  prefetchImages(urls);
  cachePhotos(urls).catch(() => {});
}

// Build the offline pack: after a deck loads online, download a capped slice of
// its photos to disk. `count` cards is plenty for an offline session; ongoing
// play adds the rest via prefetchUpcoming.
export function prefetchDeck(deck, { count = 120 } = {}) {
  if (!Array.isArray(deck)) return;
  const urls = [];
  for (const c of deck) {
    if (c && c.image) urls.push(c.image);
    if (urls.length >= count) break;
  }
  cachePhotos(urls).catch(() => {});
}
