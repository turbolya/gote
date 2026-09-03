// What the round picker remembers between visits. Pure, so
// scripts/test-roundsetup.js can exercise it in plain node.
//
// Smart play absorbed "By name", which used to be a single tap on the menu:
// photo → name, whole deck, go. Reaching that same round through the picker
// means choosing a question type and a size, and doing it again every single
// time is the cost of the menu entry going away. So the picker reopens where
// the player left it.
//
// Remembered on START, never on merely opening the screen. Backing out of a
// picker you were only looking at should not change what you play next time —
// and it keeps a test (or a curious tap) from silently rewriting the setup.
//
// The subtlety is that two of the four choices are relative to a deck that
// moves under them: a new username, a display filter, or a sync can change
// which groups exist and how many cards there are. "Every group" and "the whole
// deck" are therefore stored as INTENTIONS rather than as the values they had
// on the day — null groups and a 'max' count re-resolve against whatever the
// deck holds now. Store the values instead and a round that meant "all of it"
// quietly becomes "those 143 cards" the moment the deck grows.

// The count the picker opens on when nothing is remembered.
export const DEFAULT_COUNT = 16;

// Stored in place of a number to mean "however many there are".
export const MAX = 'max';

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : null);

// Which groups to select, given everything the deck currently offers.
//
// A remembered group that the deck no longer has is dropped; if that leaves
// nothing, we fall back to all of them rather than opening on a picker that
// says "Select a group" and looks broken.
export function restoreGroups(saved, allGroups = []) {
  const all = list(allGroups) || [];
  const want = saved ? list(saved.groups) : null;
  if (!want) return all; // null/absent = every group, including ones added since
  const kept = want.filter((k) => all.includes(k));
  return kept.length ? kept : all;
}

// Same, for the question types. `allTypes` is empty for the modes that ask one
// kind of question by definition, and then there is nothing to restore.
//
// `unavailable` is for types that cannot run right now for a reason that has
// nothing to do with what the player wants — offline, where the photo grid
// needs four other species' pictures fetched live. Those are dropped from the
// restored set rather than silently kept, because a selection that cannot
// produce the round it names is worse than no selection: the round starts and
// quietly asks something else.
export function restoreTypes(saved, allTypes = [], unavailable = []) {
  const off = new Set(list(unavailable) || []);
  const all = (list(allTypes) || []).filter((k) => !off.has(k));
  const want = saved ? list(saved.types) : null;
  if (!want) return all;
  const kept = want.filter((k) => all.includes(k));
  return kept.length ? kept : all;
}

// The card count, clamped to what the restored selection can actually offer.
// Never returns 0: a picker showing zero cards has no legal Start.
export function restoreCount(saved, available = 0) {
  const cap = Math.max(1, Math.floor(Number(available) || 0));
  const want = saved ? saved.count : null;
  if (want === MAX) return cap;
  const n = Math.floor(Number(want));
  if (!Number.isFinite(n) || n < 1) return Math.min(DEFAULT_COUNT, cap);
  return Math.min(n, cap);
}

// The persistable form of what the picker is showing right now.
//
// Selections that cover everything collapse to null / 'max' — see the note at
// the top about why these are stored as intentions.
export function packSetup({
  groups = [],
  allGroups = [],
  types = [],
  allTypes = [],
  count = 0,
  available = 0,
  flaggedOnly = false,
} = {}) {
  const g = list(groups) || [];
  const ag = list(allGroups) || [];
  const t = list(types) || [];
  const at = list(allTypes) || [];
  const cap = Math.max(1, Math.floor(Number(available) || 0));
  const n = Math.max(1, Math.min(Math.floor(Number(count) || 1), cap));
  return {
    // An empty "all" list means the deck has not offered any yet (or this mode
    // has no types to choose): nothing to remember, which is null, not [].
    groups: !ag.length || g.length >= ag.length ? null : g,
    types: !at.length || t.length >= at.length ? null : t,
    count: n >= cap ? MAX : n,
    flaggedOnly: !!flaggedOnly,
  };
}
