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
- `prefs` = `{ perSpecies, locale, researchGrade, speciesOnly, freshPhotos, themeMode }`.
  (`freshPhotos` added 2026-07-29 — an additive prefs key, no payload-version bump:
  the whole `prefs` object is one top-level key and syncs last-write-wins, and an
  older client omitting `freshPhotos` just leaves the default.)
- Built by `buildSettingsPayload()`, read through `upgradeSettingsPayload()`.

### v0 — before 2026-07-27 (implicit)
- The original unversioned blob: `{ prefs, username }`, no `v`. Still readable —
  `upgradeSettingsPayload()` treats a missing `v` as v0 and upcasts to v1.

## Events payload (`events` row)

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
  timestamped LWW is a future task).

---

## Current server schema (summary)

Authoritative source: `supabase/migrations/`. Reproduced here for reference.

- **`profiles`** — `id` (PK → auth.users, cascade), `display_name`, `created_at`.
  Auto-created for every new auth user by the `on_auth_user_created` trigger.
- **`events`** — append-only stat deltas (columns under *Events payload* above).
  Owner-only select/insert; **no update/delete**. Indexed on
  `(user_id, created_at desc)` for the "my rows since last pull" query.
- **`settings`** — `user_id` (PK → auth.users, cascade), `data` jsonb,
  `updated_at`. Owner-only; update shallow-merges `data` (DB v2).
- **RLS** everywhere, scoped by `auth.uid()` — anonymous sign-ins carry the
  `authenticated` role, so `to authenticated` means "anyone who asked". Account
  deletion runs through the edge function + the `auth.users` cascade.
- **Not yet created:** `decks`, `deck_species` (shared decks) — sketched in the
  init migration; add when the feature ships. Purely additive.
