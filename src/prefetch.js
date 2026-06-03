// Image preloading: warm the native image cache with upcoming photos so the
// next card appears instantly and the bytes are reused next time (less
// bandwidth). RN's Image.prefetch downloads into the same on-disk cache the
// <Image> component reads from.

import { Image } from 'react-native';

// Remember what we've already asked for this session so we never issue a
// duplicate network request for the same URL.
const requested = new Set();

// Prefetch a list of image URLs (best-effort; failures are ignored). Skips
// blanks and anything already requested.
export function prefetchImages(urls) {
  for (const url of urls || []) {
    if (!url || requested.has(url)) continue;
    requested.add(url);
    // Fire and forget; swallow rejections so a dead URL never bubbles up.
    Image.prefetch(url).catch(() => {});
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
