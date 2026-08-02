// A real, app-owned cache of card photos on disk.
//
// Why this exists: offline play used to rely on Image.prefetch() plus a
// remembered list of URLs. But prefetch only warms the OS/URL cache, which the
// system may evict at any time and which we cannot query — so the list was a
// GUESS. Offline, the deck happily served cards whose photos were long gone and
// every one of them rendered as a broken-image placeholder.
//
// Here the files are ours: downloaded into the app's cache directory under a
// deterministic name, so "is this photo available offline?" is answered by the
// filesystem rather than by a hopeful record. Cards are then filtered on that,
// and offline rendering reads the local file instead of the network.
//
// It still lives under Paths.cache (not document storage): these are
// re-downloadable copies of iNaturalist photos, so the OS is welcome to reclaim
// them under storage pressure — we just find out honestly when it does.

import { Directory, File, Paths } from 'expo-file-system';

const DIR_NAME = 'gote-photos';

// Filenames present in the cache directory. Populated once at startup by
// listing the directory, then kept in step as downloads land — so the hot path
// (`isCached`, called per card while filtering a deck) is a plain Set lookup
// rather than a native filesystem call per photo.
const names = new Set();
// URLs currently downloading, so a card that appears twice isn't fetched twice.
const inflight = new Set();
let ready = false;

function dirRef() {
  return new Directory(Paths.cache, DIR_NAME);
}

// FNV-1a over the URL, plus its length, as the filename. Deterministic (the
// same photo always maps to the same file, across launches) and dependency-free
// — these are cache keys, not secrets, so a cryptographic hash would buy
// nothing. The length suffix makes an accidental collision vanishingly rare.
function fileNameFor(url) {
  let h = 0x811c9dc5;
  for (let i = 0; i < url.length; i++) {
    h ^= url.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const ext = /\.png(\?|$)/i.test(url) ? 'png' : 'jpg';
  return `${h.toString(36)}-${url.length.toString(36)}.${ext}`;
}

// Read the directory once so isCached() can answer synchronously afterwards.
// Safe to call repeatedly.
export async function initPhotoCache() {
  if (ready) return;
  ready = true;
  try {
    const dir = dirRef();
    if (!dir.exists) {
      dir.create({ intermediates: true, idempotent: true });
      return;
    }
    for (const entry of dir.list()) {
      if (entry && entry.name) names.add(entry.name);
    }
  } catch {
    /* best-effort: an unreadable cache just means nothing is offline-ready */
  }
}

// Is this photo on disk right now? The whole point of the module: this is a
// fact about the filesystem, not a remembered intention.
export function isCached(url) {
  return !!url && names.has(fileNameFor(url));
}

// The local file:// URI for a cached photo, or null. Callers render this
// instead of the remote URL so the photo works with no connection.
export function cachedUri(url) {
  if (!isCached(url)) return null;
  try {
    return new File(dirRef(), fileNameFor(url)).uri;
  } catch {
    return null;
  }
}

// What an <Image> should load for a card photo: the local copy when we have
// one, otherwise the network. Preferring the file is also simply faster.
export function photoSource(url) {
  if (!url) return null;
  return { uri: cachedUri(url) || url };
}

// Download one photo into the cache. Resolves true if it is on disk afterwards.
export async function cachePhoto(url) {
  if (!url || isCached(url) || inflight.has(url)) return isCached(url);
  inflight.add(url);
  try {
    const dir = dirRef();
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    const name = fileNameFor(url);
    await File.downloadFileAsync(url, new File(dir, name));
    names.add(name);
    return true;
  } catch {
    return false; // offline, 404, out of space — just not available offline
  } finally {
    inflight.delete(url);
  }
}

// Download many, a few at a time. Sequential chunks rather than one big burst:
// a deck is hundreds of photos and firing them all at once starves the fetches
// the visible card is waiting on.
export async function cachePhotos(urls, { concurrency = 4 } = {}) {
  const queue = (urls || []).filter((u) => u && !isCached(u));
  let i = 0;
  const worker = async () => {
    while (i < queue.length) {
      const url = queue[i];
      i += 1;
      await cachePhoto(url);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
}

// How many photos are available offline (for the Settings copy).
export function cachedCount() {
  return names.size;
}

// Drop every cached photo. Used by Settings → Empty, so the offline deck stops
// claiming photos whose bytes the user just deleted.
export async function clearPhotoCache() {
  names.clear();
  inflight.clear();
  try {
    const dir = dirRef();
    if (dir.exists) dir.delete();
    dirRef().create({ intermediates: true, idempotent: true });
  } catch {
    /* best-effort */
  }
}
