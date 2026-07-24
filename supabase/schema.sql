-- gote — Supabase schema.
--
-- Run this once in the SQL editor of a fresh project (see docs/SUPABASE.md).
-- It is idempotent: safe to re-run.
--
-- DESIGN
-- ------
-- The phone is the source of truth for what the user sees. Every screen reads
-- local AsyncStorage, so the app works with no network and no account, exactly
-- as it did before. This schema is a SYNC substrate, not a read path.
--
-- The only stats table is `events`: an append-only log of deltas. One row is
-- "+N answered, +M correct, this local day, these per-species tallies". A
-- finished round is one row; a single watch answer is one row.
--
-- Append-only is what makes concurrent devices safe. Lifetime totals are
-- COUNTERS, and counters cannot be synced by overwriting a row — play on the
-- iPad while the iPhone is offline and whichever syncs last would erase the
-- other's rounds, silently. Rows that are only ever inserted have no such
-- conflict: each device inserts its own, and every device sums the union.
--
-- Idempotency comes from `id` being generated on the CLIENT. A retried push
-- re-uses the id, so it upserts onto itself instead of double-counting. This
-- mirrors how watch results are already deduped by `rid` on the phone.
--
-- Everything the app shows is derived from this one log:
--   lifetime totals  sum(answered), sum(correct)
--   accuracy chart   pct, ordered by ts (rows where pct is not null)
--   daily streak     the set of distinct local_day values
--   per-species      fold the `species` jsonb objects together
--
-- `local_day` is computed on the device from its LOCAL calendar, not derived
-- from `ts` here. A streak is a human "did I play today", and deriving it from
-- a UTC timestamp server-side would break it for anyone not on UTC.

-- ---------------------------------------------------------------------------
-- profiles — one row per user.
-- ---------------------------------------------------------------------------
-- Not needed for stats sync (auth.uid() is enough for that). It exists now
-- because shared decks will need an author identity that is safe to show to
-- OTHER users: auth.users holds the email and must never be world-readable, so
-- a shared deck cannot join against it. Creating the table now means deck
-- sharing is additive later instead of a migration of existing rows.
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Readable by any signed-in user (a future shared deck shows its author's
-- name); writable only by the owner.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (true);

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
  for insert to authenticated with check (auth.uid() = id);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Give every new auth user a profile row automatically, including anonymous
-- ones, so nothing has to remember to create it.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- events — append-only stat deltas. The whole of stats sync.
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  -- Generated on the device. The idempotency key: a retried push upserts onto
  -- itself rather than counting twice.
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  -- Which device produced this. Only for debugging and for skipping our own
  -- rows on pull; never used for merging.
  device_id  text not null,
  ts         timestamptz not null,
  -- The device's LOCAL calendar day (YYYY-MM-DD). Streaks are computed from
  -- the set of these, so they survive timezones and travel.
  local_day  date not null,
  answered   integer not null default 0 check (answered >= 0),
  correct    integer not null default 0 check (correct >= 0),
  -- 0-100 for a finished round (feeds the accuracy chart); null for a single
  -- answer, which is not a round and must not appear as a point on the chart.
  pct        integer check (pct is null or (pct >= 0 and pct <= 100)),
  -- { "<taxonId>": { "name": …, "sci": …, "known": n, "missed": n } }
  species    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- The pull query is "my rows I haven't seen yet", newest-first.
create index if not exists events_user_created_idx
  on public.events (user_id, created_at desc);

alter table public.events enable row level security;

-- Owner-only, all four verbs. NOTE: without RLS these rows would be readable
-- and writable by anyone holding the anon key — which ships inside the app and
-- sits in a public repo. RLS is the only thing protecting this table.
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated with check (auth.uid() = user_id);

-- History is append-only by design: no update or delete policy, so even a
-- compromised client cannot rewrite past rounds. Account deletion still works
-- because the foreign key cascades from auth.users.

-- ---------------------------------------------------------------------------
-- settings — last-write-wins preferences.
-- ---------------------------------------------------------------------------
-- Unlike counters, settings genuinely are last-write-wins: losing a stale
-- theme choice is harmless, so one row per user with a timestamp is enough.
create table if not exists public.settings (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.settings enable row level security;

drop policy if exists settings_select on public.settings;
create policy settings_select on public.settings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists settings_upsert on public.settings;
create policy settings_upsert on public.settings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists settings_update on public.settings;
create policy settings_update on public.settings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- FUTURE: shared decks. Deliberately NOT created yet.
-- ---------------------------------------------------------------------------
-- Sketched here so the shape is on record, and because it is the reason
-- `profiles` exists and the reason this is Postgres rather than a key-value
-- store: sharing is a row-visibility rule, which RLS expresses directly.
--
--   decks (
--     id uuid primary key, owner uuid references auth.users,
--     title text, description text,
--     visibility text check (visibility in ('private','unlisted','public')),
--     share_code text unique, created_at, updated_at
--   )
--   deck_species ( deck_id uuid references decks on delete cascade,
--                  taxon_id bigint, name text, sci text,
--                  primary key (deck_id, taxon_id) )
--
-- The whole sharing model is then one policy — app code cannot leak a private
-- deck by forgetting a filter, because the database refuses to return the row:
--
--   create policy decks_select on decks for select to authenticated
--     using (owner = auth.uid() or visibility in ('public','unlisted'));
--
-- Writes stay `owner = auth.uid()`. Add the tables when the feature is built.
