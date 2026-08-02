-- gote — carry how many cards each accuracy-chart bar covered.
--
-- Idempotent. See docs/SCHEMA-CHANGELOG.md for the running record.
--
-- The problem: an event recorded a finished round's accuracy as a percentage and
-- nothing else, so every aggregate over the chart had to treat rounds as equals.
-- A 1-card round answered correctly counted exactly as much as a 100-card one —
-- which is why the "lifetime accuracy" trend line drifted away from the lifetime
-- accuracy printed beside it (that figure was always correct/answered, i.e.
-- already weighted). Losing the sample size at write time made it impossible to
-- fix on the reading side.
--
-- The fix carries the size with the point:
--   • `n`      — cards in the round this event's `pct` summarises,
--   • `counts` — baseline only: cards per bar, right-aligned with `history`
--                (shorter when a device has bars from before sizes were recorded).
--
-- `n` is separate from `answered` on purpose. A round played on the Apple Watch
-- banks its cards one at a time as they are answered and then sends the finished
-- round with `answered: 0` to avoid double-counting — but it still draws a bar,
-- and that bar still needs a weight.
--
-- Additive / expand-only, exactly like `confusions` (v3) and `history`/`days`
-- (v4): defaulted, so it is backward-compatible with every client in the field.
-- An older client inserts without these and gets 0 / '[]'; an older reader
-- selects the columns it knows and ignores them; only a new reader weights by
-- them, and a 0 simply means "size unknown" (the client falls back to the
-- player's own mean round length). No RLS or grant change — the existing
-- owner-only policies and table-level grants already cover new columns.

alter table public.events
  add column if not exists n      integer not null default 0,
  add column if not exists counts jsonb   not null default '[]'::jsonb;
