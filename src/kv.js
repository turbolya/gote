// The app's key-value store, behind one thin indirection.
//
// Everything persistent in gote — the observation cache, statistics, streak,
// preferences, the sync outbox, the Supabase session — goes through here rather
// than importing AsyncStorage directly.
//
// Why bother: AsyncStorage only exists inside a React Native runtime, which
// means any module that imports it cannot be loaded by a plain Node script. The
// sync layer was exactly that shape, so the only part of it that could be tested
// was the pure merge function — and the two bugs that reached a device were both
// in the wiring around it, not in the merge. This seam lets a Node test swap in
// an in-memory backend and drive the real push/pull code against a real
// database.
//
// The default backend is AsyncStorage, so nothing changes at runtime.

import AsyncStorage from '@react-native-async-storage/async-storage';

let backend = AsyncStorage;

// Swap the backend. Tests only — pass an object with the four methods below,
// then call again with no argument to restore AsyncStorage.
export function setKvBackend(next) {
  backend = next || AsyncStorage;
}

export async function getItem(key) {
  return backend.getItem(key);
}

export async function setItem(key, value) {
  return backend.setItem(key, value);
}

export async function removeItem(key) {
  return backend.removeItem(key);
}

export async function multiRemove(keys) {
  if (backend.multiRemove) return backend.multiRemove(keys);
  // An in-memory stub need not implement the batch form.
  await Promise.all(keys.map((k) => backend.removeItem(k)));
  return undefined;
}

// Every key currently stored. Needed because the pull watermark is kept per
// account (`…/lastPulledAt:<userId>`), so clearing "all of them" means matching
// a prefix rather than naming one key. Returns [] on a backend that cannot
// enumerate, which degrades to "clear nothing" — safe, since the only caller
// (resetPullState) is a cleanup path.
export async function getAllKeys() {
  try {
    if (backend.getAllKeys) return (await backend.getAllKeys()) || [];
  } catch {
    /* fall through */
  }
  return [];
}

// supabase-js wants a storage object rather than functions, for its session.
// Handing it this adapter (instead of AsyncStorage) means a test's in-memory
// backend holds the session too, so two simulated devices get genuinely
// separate accounts.
export const storageAdapter = {
  getItem: (k) => getItem(k),
  setItem: (k, v) => setItem(k, v),
  removeItem: (k) => removeItem(k),
};

// A ready-made in-memory backend, for tests and for a "device" in the
// integration suite. Each instance is independent.
export function createMemoryKv() {
  const map = new Map();
  return {
    getItem: async (k) => (map.has(k) ? map.get(k) : null),
    setItem: async (k, v) => {
      map.set(k, String(v));
    },
    removeItem: async (k) => {
      map.delete(k);
    },
    multiRemove: async (keys) => {
      keys.forEach((k) => map.delete(k));
    },
    getAllKeys: async () => [...map.keys()],
    // Test helpers.
    _dump: () => Object.fromEntries(map),
    _clear: () => map.clear(),
  };
}
