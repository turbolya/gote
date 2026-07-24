# Supabase setup

Cross-device sync for stats and settings. Everything in the app is already
written — this is the one-time server side, about 15 minutes.

**Until you finish step 4, nothing changes.** `SYNC_ENABLED` is false without
credentials, so the app builds and runs exactly as it did before: local storage
only, no account, no network beyond iNaturalist. There is no half-configured
state to get stuck in.

---

## 1. Create the project

Dashboard ▸ New project.

- **Name:** `gote`
- **Region:** closest to your users — this is fixed at creation and sets their
  latency
- **Database password:** generate one and store it in a password manager

Free tier: 500 MB database, 50k monthly active users, 5 GB egress, 2 projects.
**Projects pause after a week of inactivity** and do *not* wake on traffic — you
restore them by hand in the dashboard. That only bites before launch; once real
users exist the clock keeps resetting.

## 2. Run the schema

SQL Editor ▸ New query ▸ paste all of [`supabase/schema.sql`](../supabase/schema.sql)
▸ Run.

It is idempotent, so re-running it after an edit is safe. It creates:

| Table | Holds |
|---|---|
| `events` | append-only stat deltas — the whole of stats sync |
| `settings` | one preferences row per user, last-write-wins |
| `profiles` | one row per user; exists for future deck sharing |

and a trigger that gives every new user a `profiles` row automatically.

**Verify RLS is on** — Table Editor ▸ each table should show *RLS enabled*. This
matters more than it looks: the `anon` key ships inside the app binary and sits
in a public GitHub repo, exactly as designed. Row-level security is the only
thing between that key and your users' data. A table with RLS off is readable
and writable by anyone who downloads gote.

## 3. Turn on anonymous sign-ins

Authentication ▸ Providers ▸ **Anonymous sign-ins** ▸ enable.

Direct link (the sidebar label has changed over time — it is currently
**Sign In / Providers**, and the anonymous toggle is not a provider card but a
separate switch further down the page):

    https://supabase.com/dashboard/project/<project-ref>/auth/providers

This is what lets sync work without asking anyone to create an account. On first
sync the app signs in anonymously and gets a stable user id to hang rows off.

**Read the warning the dashboard shows you — it is not boilerplate.** An
anonymous user carries the `authenticated` role, and *anyone* can mint one with
a single unauthenticated API call. So `to authenticated` does not mean "a real
signed-up person", it means "anyone who asked", and a policy written
`to authenticated using (true)` publishes that table to the internet. Every
policy in `schema.sql` is scoped by `auth.uid()` for exactly this reason, and
any table you add later must be too.

**Email** should also be on (it is by default) — that covers step 6.

## 4. Put the credentials in the build

Settings ▸ API gives you the **Project URL** and the client key. New projects
issue a **publishable** key (`sb_publishable_…`); older ones an **anon** JWT
(`eyJhbGciOi…`). They are interchangeable — the app accepts either.

Local development — create `.env` in the repo root (gitignored):

```
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
# or, on an older project:
# EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi…
```

For EAS builds, add the same two under `env` in each `eas.json` profile that
should sync. Leave them out of a profile and that build simply has sync off.

> Never put the **secret** key (`sb_secret_…`, formerly `service_role`) anywhere
> in this repo or in the app. It bypasses RLS entirely. The publishable/anon key
> is the only one that belongs in a client.

## 5. Check that it works

```bash
npx expo start --clear
```

`--clear` matters: `EXPO_PUBLIC_*` values are inlined into the bundle at build
time, so a warm Metro cache will keep serving a build that has no credentials.

Then:

1. Play a round.
2. Dashboard ▸ Table Editor ▸ `events` — one new row, with your card counts and
   a `species` blob.
3. Authentication ▸ Users — one anonymous user.

If `events` stays empty, the usual causes are Metro cache (step 5), anonymous
sign-ins still off (step 3), or RLS enabled with the policies not created —
check Logs ▸ Postgres for a policy violation.

## 6. Two devices, one account

Anonymous accounts are **per device**. Two devices signing in anonymously become
two unrelated users with two separate piles of stats — anonymous auth gives
identity without friction, not sync.

Linking an email is what makes them the same person. The functions are ready in
`src/sync/auth.js`; the UI for them is not built yet:

- `linkEmail(email)` on the first device — attaches the address to the existing
  anonymous account, **keeping its id and all its history**
- `signInWithEmail(email)` on the second — deliberately fails if the address is
  unknown, rather than silently creating a third empty account and looking like
  data loss
- `verifyCode(email, code)` confirms either

Until that UI exists, sync backs up one device and prepares the ground.

---

## How it works

```
play a round ──▶ local storage (instant, offline, authoritative)
             └─▶ outbox ──▶ events ──▶ other devices pull and fold in
```

Local storage stays the source of truth for every screen. The server is a sync
substrate, never a read path, so the app keeps working with no signal — which is
the whole point of an app people use in the field.

**Why append-only.** Lifetime totals are counters, and counters cannot be synced
by overwriting a row. Play on the iPad while the iPhone is offline, and a
last-write-wins design silently erases whichever device syncs first. Rows that
are only ever inserted have no conflict: each device inserts its own and
everyone sums the union. Order does not matter, and neither does arrival time.

**Why ids come from the client.** A retried upload reuses its id and upserts
onto itself instead of counting twice. It is the same trick the watch already
uses with `rid`.

**Derived, not stored:** lifetime totals are `sum(answered)`/`sum(correct)`; the
accuracy chart is the `pct` values in time order; the streak is the set of
distinct `local_day`s. Storing a streak *count* would be unmergeable — two
devices cannot agree on a number neither has the full history for — whereas a
set of days merges by union and is always right.

`local_day` is computed on the device from its local calendar, never derived
from the timestamp server-side, so a streak survives timezones and travel.

## Files

| Path | What |
|---|---|
| `supabase/schema.sql` | tables, RLS policies, future-decks sketch |
| `src/sync/config.js` | credentials + the single on/off switch |
| `src/sync/client.js` | lazily-created Supabase client |
| `src/sync/auth.js` | anonymous session, email linking |
| `src/sync/outbox.js` | offline queue, applied-id ledger, device id |
| `src/sync/merge.js` | **pure** merge logic (tested) |
| `src/sync/index.js` | push/pull orchestration — the only file App.js imports |
| `scripts/test-sync.js` | 40 tests over the merge |

## Not built yet

Deliberately out of scope, with the groundwork in place:

- **Deck sharing.** `profiles` exists so a shared deck has an author that is
  safe to show other users (`auth.users` holds emails and must never be
  world-readable). The table sketch and the one RLS policy that implements
  sharing are commented at the bottom of `schema.sql`.
- **Sign-in UI** for the email linking described in step 6.
- **Account deletion.** App Store guideline 5.1.1(v) requires it in-app once you
  offer accounts. Every table cascades from `auth.users`, so deleting the user
  deletes the data — it needs a UI and an edge function to call.
- **Privacy policy updates.** Sync means you now hold data: an anonymous user
  id, gameplay counts, and an email if the user links one. This has to appear in
  the privacy policy, Apple's nutrition label and Play's Data Safety form before
  a build that has sync enabled ships.
