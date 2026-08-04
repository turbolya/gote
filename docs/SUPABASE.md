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

SQL Editor ▸ New query ▸ paste all of [`supabase/migrations/20260724120000_init.sql`](../supabase/migrations/20260724120000_init.sql)
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
policy in the migration is scoped by `auth.uid()` for exactly this reason, and
any table you add later must be too.

**Email** should also be on (it is by default) — that covers step 6.

### Email must send a CODE, not a link (this bit the first TestFlight build)

gote's link/sign-in flow confirms with a **typed 6-digit code** (`verifyOtp`).
Two hosted-project defaults break that, and both are fixed in the dashboard with
**no app rebuild** — they change already-installed builds immediately:

1. **Email templates.** The stock "Magic Link" and "Change Email Address"
   templates send `{{ .ConfirmationURL }}` — a link — which gives the user
   nothing to type, and the link points at the Site URL (`localhost` by
   default), so it's dead on a phone. Authentication ▸ Emails ▸ edit both
   templates to contain **`{{ .Token }}`**. The versions in
   `supabase/templates/` are what to paste (they drive the local stack via
   `config.toml`); `magic_link.html` → "Magic Link", `email_change.html` →
   "Change Email Address".

2. **Confirm email must be ON.** With it off, `updateUser({email})` links the
   anonymous account *immediately*, so the app shows "Connected" before the user
   ever enters a code — ownership is never proven. Authentication ▸ Providers ▸
   Email ▸ **Confirm email** ▸ on.

If you have the project linked (`supabase link`), `supabase config push` can
send the `[auth]` config and templates from `config.toml` instead of clicking
through the dashboard. It writes to your live project, so review the diff first.

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

For EAS builds, the credentials live in the **`production`** profile, which
`testflight` extends — so both carry sync:

```bash
eas build -p ios --profile testflight   # sync ON — internal TestFlight
eas build -p ios --profile production   # sync ON — App Store
```

The two profiles now differ only by EAS Update `channel`, which is why
`testflight` still exists rather than being dropped: it keeps internal builds on
their own update channel.

**History, because the shape here is deliberate.** The credentials used to sit in
`testflight` *only*, as an interlock: internal TestFlight needs no privacy
policy, no nutrition label and no Beta App Review, so sync could be tested on
real devices immediately — while an App Store build that collects data first
needed in-app account deletion (guideline 5.1.1(v)) and privacy disclosures.
Keeping the keys out of `production` meant that could not happen by forgetting.
Both prerequisites shipped (`deleteAccount()` → the `delete-account` edge
function, and the sync sections of PRIVACY.md), so the interlock was retired on
2026-08-03.

The failure mode it caused on the way out is worth knowing, because it is
silent: a build made from a profile with no credentials has `SYNC_ENABLED` false,
so App.js passes `onSync={null}` and **Settings hides the sync row entirely** —
no error, no disabled state, the option is simply absent. If sync "disappears"
from a build, check which profile built it before looking at any code.

> Keep the App Store Connect **privacy nutrition label** in step with what sync
> actually stores (see "What your synced play history actually contains" in
> PRIVACY.md). Now that every store build carries sync, the label is the only
> remaining gate, and nothing in this repo can enforce it.

`preview` and `development` still carry no credentials, so sync is absent there
by default; add the same `env` block to a profile if you need to exercise sync
from it. Local development reads `.env` instead (above).

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

Linking an email is what makes them the same person. **Settings ▸ Devices ▸ Sync
across devices** (`src/screens/SyncScreen.js`) does this — email plus a 6-digit
code, no password and no account to create up front.

The screen offers two paths, because the two cases behave differently
underneath:

- **"This is my first device"** → `linkEmail`. Attaches the address to the
  anonymous account this device already has. The user id does not change, so
  all of its history stays put. Lossless.
- **"I already have gote elsewhere"** → `signInWithEmail`. Joins an account
  created on another device, so the user id *changes*. `afterAuthChange()`
  handles the consequences: it resets the pull watermark (which describes the
  old account and would otherwise make the app skip the new one's entire
  history) and re-sends this device's totals as one baseline event, so joining
  contributes its progress instead of abandoning it. A device skips its own
  rows on pull, so that baseline can never double-count locally.

`signInWithEmail` passes `shouldCreateUser: false` on purpose: an unknown
address must fail loudly rather than silently mint a third empty account, which
would look exactly like data loss.

Known limitation: one event carries one local day, so a baseline merges totals
and per-species tallies but not the day-by-day streak calendar from before the
switch. Preserving that would mean a row per active day.

To test both sides you need two installs. On a simulator, deleting the app and
reinstalling gives you a fresh anonymous account to sign in with.

## 7. Deploy the account-deletion function

Required before shipping to the App Store — guideline 5.1.1(v) says an app that
lets people create an account must let them delete it in-app.

```bash
npx supabase login
npx supabase link --project-ref gpnmouedaccoexfqvmkh
npx supabase functions deploy delete-account
```

No secrets to configure: `SUPABASE_URL`, `SUPABASE_ANON_KEY` and
`SUPABASE_SERVICE_ROLE_KEY` are injected into edge functions by the platform.

It has to be a function rather than client code because deleting an auth user
needs the **service-role** key, which bypasses RLS and can never ship in an app.
The function takes the id to delete from the caller's **verified JWT**, never
from the request body — accepting a body parameter would turn it into "any user
can delete any other user".

Deletion cascades: `events`, `settings` and `profiles` all reference
`auth.users` with `on delete cascade`, so one call removes everything. Any table
added later is covered automatically as long as it carries the same cascade.

In the app: **Settings ▸ Devices ▸ Sync across devices ▸ Delete synced account**.
It is offered to anonymous accounts too — an anonymous user still has rows on
the server, and deletion should not require signing in first.

Verify it with the [Users list](https://supabase.com/dashboard/project/_/auth/users):
delete from the app and the row disappears, along with that user's `events`.

> **TypeScript warning.** This function is the only `.ts` file in an otherwise
> all-JavaScript project, and Expo's CLI reacts to it: on the next `expo export`
> it auto-creates `tsconfig.json` and installs `typescript` — picking **7.x**,
> whose API Expo's own tsconfig reader cannot read, which breaks the bundler
> with `Cannot read properties of undefined (reading 'getCurrentDirectory')`.
> `typescript` is therefore pinned to `^5.9.3` in devDependencies. Do not let it
> float to 7 until Expo supports it.

## 8. Testing sync

`npm test` covers the merge logic (`scripts/test-sync.js`, 40 cases). That
passed the entire time two sync bugs were shipping, because both lived in the
wiring *around* the merge — a queued event that was never flushed, and a stale
pull watermark after switching accounts. Neither is reachable without a
database.

So there is a second suite that drives the real push/pull code against a real
Postgres with RLS on:

```bash
npx supabase start        # Docker; applies supabase/migrations/
npm run test:sync
npx supabase stop
```

It runs against the **local** stack, so the cloud project is never touched. If
no instance is reachable it skips with exit code 0 rather than failing, so a
machine without Docker is fine.

A "device" in these tests is an independent in-memory kv backend plus its own
Supabase client — which is exactly what separates two installs, since identity
and the outbox live in key-value storage. That makes a second device free and
the tests deterministic, with no simulator involved.

What it covers: anonymous sign-in; two devices getting different accounts; a
round reaching the database; the outbox emptying; repeat syncs not duplicating;
a device not re-applying its own rows; **RLS actually isolating two users** (read
and forged write); history being append-only; the full two-device link-and-merge;
the account switch not double-counting; and deletion cascading.

The emailed code is minted with `auth.admin.generateLink`, which returns the
same OTP the email would carry — no inbox, no polling, no flake.

`src/kv.js` is what makes this possible: storage goes through it rather than
importing AsyncStorage directly, so these modules load under plain Node.

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
| `supabase/migrations/` | tables, RLS policies, future-decks sketch |
| `src/sync/config.js` | credentials + the single on/off switch |
| `src/sync/client.js` | lazily-created Supabase client |
| `src/sync/auth.js` | anonymous session, email linking |
| `src/sync/outbox.js` | offline queue, applied-id ledger, device id |
| `src/sync/merge.js` | **pure** merge logic (tested) |
| `src/sync/index.js` | push/pull orchestration — the only file App.js imports |
| `src/screens/SyncScreen.js` | the UI: link, sign in, sign out, delete |
| `supabase/functions/delete-account/` | edge function for account deletion |
| `scripts/test-sync.js` | 40 tests over the merge |

## Not built yet

Deliberately out of scope, with the groundwork in place:

- **Deck sharing.** `profiles` exists so a shared deck has an author that is
  safe to show other users (`auth.users` holds emails and must never be
  world-readable). The table sketch and the one RLS policy that implements
  sharing are commented at the bottom of the migration.
- **Privacy policy updates.** Sync means you now hold data: an anonymous user
  id, gameplay counts, and an email if the user links one. This has to appear in
  the privacy policy, Apple's nutrition label and Play's Data Safety form before
  a build that has sync enabled ships.
