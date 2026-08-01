-- gote — carry the accuracy chart and the day-by-day streak in the sync baseline.
--
-- Idempotent. See docs/SCHEMA-CHANGELOG.md for the running record.
--
-- The problem: when a device that played for a while BEFORE turning sync on joins
-- an account, `uploadBaseline` collapsed its whole past into a single totals-only
-- event (`pct` null, one `local_day`). Lifetime totals reached the other device,
-- but the accuracy-chart bars (one per finished round) and the active-day
-- calendar the streak is built from did not — so a joining device showed the
-- right lifetime number over an empty chart and a reset streak.
--
-- The fix carries both in the baseline event:
--   • `history` — the array of per-round accuracy percents (the chart's bars),
--   • `days`    — the set of local YYYY-MM-DD days the streak is computed from.
-- A normal round leaves both empty and keeps riding its single `pct` / `local_day`.
--
-- Additive / expand-only, exactly like the `confusions` column (v3): nullable
-- with a default, so it is backward-compatible with every client in the field. An
-- older client inserts an event without these and gets `[]`; an older reader
-- selects the columns it knows and ignores them; only a new reader folds them in.
-- No RLS or grant change — the existing owner-only policies and table-level grants
-- already cover new columns.

alter table public.events
  add column if not exists history jsonb not null default '[]'::jsonb,
  add column if not exists days    jsonb not null default '[]'::jsonb;
