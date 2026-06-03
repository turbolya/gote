// Local cache helpers built on expo-file-system's cache directory — the place
// the OS and image loader stash downloaded photos. We expose its total size and
// a way to empty it (used by the Settings screen).

import { Paths } from 'expo-file-system';

// Total bytes currently used under the app's cache directory (recursive).
// Best-effort: returns 0 if anything is unreadable.
export async function getCacheSize() {
  try {
    const dir = Paths.cache;
    if (!dir || !dir.exists) return 0;
    return dir.size || 0;
  } catch {
    return 0;
  }
}

// Delete everything inside the cache directory, leaving the directory itself.
// Returns the number of entries removed.
export async function clearCache() {
  let removed = 0;
  try {
    const dir = Paths.cache;
    if (!dir || !dir.exists) return 0;
    for (const entry of dir.list()) {
      try {
        entry.delete();
        removed += 1;
      } catch {
        /* skip entries that are locked / in use */
      }
    }
  } catch {
    /* ignore — cache clearing is best-effort */
  }
  return removed;
}

// Human-readable byte count, e.g. "0 B", "812 KB", "13.4 MB".
export function formatBytes(bytes) {
  if (!bytes || bytes < 1) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(
    units.length - 1,
    Math.floor(Math.log(bytes) / Math.log(1024))
  );
  const value = bytes / Math.pow(1024, i);
  const rounded = i === 0 ? value : Math.round(value * 10) / 10;
  return `${rounded} ${units[i]}`;
}
