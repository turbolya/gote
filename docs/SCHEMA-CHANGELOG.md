# Data & schema changelog

The versioned record of everything that persists or crosses the network —
**separate from the user-facing app changelog** (`src/changelog.js`). When a
data shape changes, add an entry here and bump the matching version constant.

There are **three independent version numbers**, because they govern three
different things that move at different times:

| Version | Constant | Lives in | Governs |
|---|---|---|---|
| **DB schema** | migration filenames | `supabase/migrations/` | the Postgres tables, policies, triggers |
| **Settings payload** | `SETTINGS_PAYLOAD_VERSION` | `src/sync/merge.js` | the `settings.data` jsonb blob that syncs across devices |
| **Local data** | `DATA_VERSION` | `src/storage.js` | the on-device AsyncStorage shapes |

(A fourth, `CACHE_VERSION` in `src/storage.js`, governs only the *disposable*
observation cache — a mismatch just forces a re-download, so it is not tracked
here.)

## Compatibility rules

The app is distributed through app stores, so **many versions run at once** and
old binaries linger for years. Two rules keep them all interoperable:

1. **Additive / expand-contract only.** New feature ⇒ a new table or a new
   *nullable/defaulted* column. Never rename, repurpose, or drop a column a
   shipped client reads or writes. Only "contract" (remove the old) long after
   the last client that used it is gone — in practice, almost never.
2. **Version is a reader hint, never a gate.** Nothing rejects a payload for
   version mismatch. New readers *upcast* old shapes in memory; old readers
   ignore fields they don't know. The one thing an old writer must not do —
   erase a newer key — is prevented server-side (see DB v2).

The append-only `events` log needs neither rule bent: every client only ever
*inserts*, so no write can overwrite another's, regardless of version.

---

## DB schema

### v5 — 2026-08-02 — `20260802120000_events_round_size.sql`
- Added two columns to `public.events`: `n integer not null default 0` and
  `counts jsonb not null default '[]'`. `n` is how many cards the round this
  event's `pct` summarises covered; `counts` is the baseline's per-bar equivalent,
  right-aligned with `history`. Without the sample size every aggregate over the
  chart had to treat a 1-card round as the equal of a 100-card one, which is why
  the "lifetime accuracy" trend line drifted off the lifetime accuracy printed
  beside it (that figure is `correct/answered` and was always weighted).
  `n` is deliberately separate from `answered`: an Apple Watch round banks its
  cards one at a time and reports `answered: 0` to avoid double-counting, yet
  still draws a bar that needs a weight. Additive/expand-only like v3 and v4 —
  old clients insert without them and get `0` / `[]`, old readers ignore them,
  and `0` reads as "size unknown" on the client (which falls back to the player's
  own mean round length). No RLS or grant change.

### v4 — 2026-08-01 — `20260801120000_events_baseline_history.sql`
- Added two nullable columns to `public.events`: `history jsonb not null default
  '[]'` and `days jsonb not null default '[]'`. The first-sync **baseline** now
  carries the accuracy-chart bars (`history` = per-round pct array) and the
  active-day set the streak is built from (`days` = YYYY-MM-DD list), so a device
  joining an existing account rebuilds the whole hero — not just the lifetime
  total over an empty chart and a reset streak. A normal round leaves both empty
  and keeps riding its single `pct` / `local_day`. Additive/expand-only exactly
  like `confusions` (v3): old clients insert without them and get `[]`, old
  readers ignore them; no RLS or grant change.

### v3 — 2026-07-28 — `20260728120000_events_confusions.sql`
- Added a nullable `confusions jsonb not null default '{}'` column to
  `public.events`. Confusion counts (which look-alikes the player mixes up) are
  counters, so they ride the append-only log like `species`: each round carries a
  delta, every device sums the union. Additive/expand-only — old clients insert
  without it and get `{}`, old readers ignore it; no RLS or grant change (the
  table-level grants already cover new columns).

### v2 — 2026-07-27 — `20260727120000_settings_merge.sql`
- Added a `before update` trigger on `public.settings` that **shallow-merges**
  `data` (`old.data || new.data`) instead of replacing it. An older client that
  writes the blob back can no longer erase top-level keys it doesn't know about.
- Consequence for payload design: every independently-evolving setting must be
  its **own top-level key** in `settings.data` (the merge is shallow).

### v1 — 2026-07-24 — `20260724120000_init.sql`
- Initial schema. `profiles` (one row per user, created eagerly so deck
  authorship is additive later), `events` (append-only stat deltas — the whole
  of stats sync), `settings` (last-write-wins prefs blob). RLS owner-only on all
  three; `events` has no update/delete (history is immutable). Shared-deck
  tables (`decks`, `deck_species`) are sketched in comments, deliberately not
  created until the feature is built.

## Settings payload (`settings.data`)

### v2 — 2026-07-28
Two device-local concerns join the blob, each as its **own top-level key family**
so the DB v2 shallow-merge keeps every entry independent (a single `notes`/`flags`
object would let one device's edit clobber another's). Both merge **per entry by
`t`** — NOT by the whole-blob last-write-wins that governs `prefs` — so an edit on
another device is adopted even when this device's prefs are newer. No DB migration
(additive top-level keys on the existing row).

- **"My tell" notes** — key `n:<pairKey>` = `{ text, t }` (t = last-edit ms; empty
  `text` is a tombstone so a delete propagates). Spread by `buildSettingsPayload`,
  read by `notesFromPayload`, merged by `mergeNotes`; `displayNotes` gives the
  `{ pairKey: text }` the UI reads. Legacy bare-string notes upcast to `{ text, t: 0 }`.
- **Flags** — key `f:<username>:<taxonId>` = `{ on, t }` (t = last-toggle ms;
  on:false is a tombstone so an *un*flag propagates). Scoped by username (flags are
  per-account) so switching accounts on a device never cross-contaminates. Read by
  `flagsFromPayload(data, username)`, merged by `mergeFlags` (tie → keep the flag);
  `flaggedIds` gives the id list. Legacy array/boolean forms upcast to `{ on, t: 0 }`.

### v1 — 2026-07-27
- Introduced the `v` version marker. Shape: `{ v: 1, prefs: {...}, username }`.
- `prefs` = `{ perSpecies, locale, researchGrade, speciesOnly, namedOnly, freshPhotos, themeMode }`.
  (`freshPhotos` added 2026-07-29, `namedOnly` added 2026-08-01 — additive prefs
  keys, no payload-version bump: the whole `prefs` object is one top-level key and
  syncs last-write-wins, and an older client omitting a key just leaves the default.)
- Built by `buildSettingsPayload()`, read through `upgradeSettingsPayload()`.

### v0 — before 2026-07-27 (implicit)
- The original unversioned blob: `{ prefs, username }`, no `v`. Still readable —
  `upgradeSettingsPayload()` treats a missing `v` as v0 and upcasts to v1.

## Events payload (`events` row)

### v4 — 2026-08-02
- Added `n` (int, cards in the round this event's `pct` summarises) and `counts`
  (baseline only: cards per bar, right-aligned with `history` — shorter when the
  device has bars from before sizes were recorded). Folded in `applyEvent`, which
  keeps `counts` the SAME LENGTH as `history` (0 = unknown), padding before each
  append so a point from an older client can't shift every later size one slot.
  The baseline nets `counts` against still-queued rounds by dropping the same
  trailing entries as `history`, then clamps to the netted bar count. Additive;
  older events omit both and read as unknown.

### v3 — 2026-08-01
- Added `history` (per-round pct array) and `days` (YYYY-MM-DD array) jsonb
  deltas, both `[]` on a normal round. The first-sync baseline fills them with the
  device's whole accuracy chart and active-day set, so `uploadBaseline` no longer
  strands the chart and streak on the origin device. Folded in `applyEvent`:
  `history` appends its bars (then any single `pct`), `days` unions into the day
  set (so a day shared by a baseline and a later round counts once). The baseline
  nets `history` against still-queued rounds by dropping that many trailing bars
  (they ride as their own `pct` events); `days` needs no netting — it is a set.
  Additive; older events simply omit both.

### v2 — 2026-07-28
- Added the `confusions` jsonb delta (`{ [correctKey]: { [chosenKey]: count } }`)
  — which look-alikes were mixed up this round. Folded via `mergeConfusions`;
  the baseline nets it against still-queued deltas via `subtractConfusions`.
  Additive; older events simply omit it.

### v1 — 2026-07-24 (baseline)
- Fixed columns: `id` (client-generated, idempotency key), `user_id`,
  `device_id`, `ts`, `local_day`, `answered`, `correct`, `pct`
  (null = single answer, not a round), and `species` jsonb
  (`{ "<taxonId>": { name, sci, known, missed } }`), plus `created_at`.
- Growth is additive: future event kinds (e.g. a custom-deck round) add nullable
  columns or extra `species`/meta keys that older readers ignore.

## Local data (`@gote/*`)

### v1 — 2026-07-27 (baseline)
- First tracked version. Establishes `runDataMigrations()` (forward-only, run at
  startup) and the `@gote/dataVersion` marker. No shapes changed; existing
  devices and fresh installs are both the v1 baseline.
- Keys: `username`, `stats`, `prefs`, `species`, `obscache`, `flags`, `history`,
  `streak`, `activeDays`, `watchResultIds`, `watchTipDismissed`, `settingsStamp`,
  `downloadedImages` (offline photo manifest — added additively 2026-07-27, no
  version bump; it self-heals if absent),
  `confusions` (confusion matrix `{ [correctKey]: { [chosenKey]: count } }` —
  added additively 2026-07-27; **now synced** via the events `confusions` delta,
  DB v3 / events payload v2, 2026-07-28),
  `confusionNotes` (`{ [pairKey]: text }` — the player's "my tell" notes, added
  additively 2026-07-28, **device-local** — deliberately not synced; per-note
  timestamped LWW is a future task),
  `historyCounts` (cards per finished round, parallel to `history` and
  **right-aligned** with it — added additively 2026-08-02, no version bump; a
  device with rounds from before it simply has a shorter array, and the missing
  entries read as "size unknown". Kept as a parallel array rather than folded
  into `history` because `history` is also a sync wire format: a parallel array
  is something an older client ignores, whereas changing the element type would
  make it read every bar as `NaN`. **Now synced** via the events `n` / `counts`
  fields, DB v5 / events payload v4).

### Sync-private keys (`@gote/sync/*`) — 2026-08-03

Not part of `DATA_VERSION`: these are the sync layer's own bookkeeping, never
read by a screen, and they self-heal when absent. Recorded here because two of
them changed shape in a way that matters.

- `sync/lastPulledAt` → **`sync/lastPulledAt:<userId>`** — the pull watermark is
  now **per account**. It was one value, which forced an account switch to
  discard it, which forced a re-read of the account from the beginning. That
  re-read was only safe if every event in it was recognised as already applied,
  putting the entire burden on the capped applied-id ledger. Keyed by account,
  signing back in resumes where that account left off and re-reads nothing.
  - *Upgrade behaviour:* the old un-suffixed key is not migrated, so the first
    sync after updating re-reads the account once. That is safe **because the
    ledger now survives** — every event is recognised and skipped. `resetPullState`
    clears both the legacy key and all per-account ones.
- `sync/baselineUserId` (new) — the account this device has already sent its
  baseline to. Turning sync off and on is two account switches (out to a
  throwaway anonymous account, back to the real one), and each one used to
  re-send a full baseline that every *other* device then added to its totals.

The related fix is not a key at all: **`resetPullState` no longer clears the
applied-id ledger.** The rollups are a cumulative fold with no way to un-apply an
event, so the ledger is the only thing preventing a re-read from double-counting.
Event ids are UUIDs; an id applied once must never be applied again, whichever
account it arrives from.

---

## Current server schema (summary)

Authoritative source: `supabase/migrations/`. Reproduced here for reference.

- **`profiles`** — `id` (PK → auth.users, cascade), `display_name`, `created_at`.
  Auto-created for every new auth user by the `on_auth_user_created` trigger.
- **`events`** — append-only stat deltas (columns under *Events payload* above).
  Owner-only select/insert; **no update/delete**. Indexed on
  `(user_id, created_at desc)` for the "my rows since last pull" query.
  Round sizes ride in `n` (per round) and `counts` (baseline) as of v5.
- **`settings`** — `user_id` (PK → auth.users, cascade), `data` jsonb,
  `updated_at`. Owner-only; update shallow-merges `data` (DB v2).
- **RLS** everywhere, scoped by `auth.uid()` — anonymous sign-ins carry the
  `authenticated` role, so `to authenticated` means "anyone who asked". Account
  deletion runs through the edge function + the `auth.users` cascade.
- **Not yet created:** `decks`, `deck_species` (shared decks) — sketched in the
  init migration; add when the feature ships. Purely additive.
