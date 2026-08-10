-- Identified accuracy-chart points.
--
-- The chart used to cross the wire as `history` — a bare array of percentages —
-- with `counts` alongside it. Nothing in that shape can tell two copies of one
-- round apart, so folding it was an APPEND, and any event that carried a bar
-- the account already had drew a round that never happened. Three separate
-- mechanisms existed on the client to compensate (a positional trim of queued
-- rounds, a value-matching removal, and bespoke accounting in the repair path)
-- and a bug slipped between them three times.
--
-- A bar is now a record: { id, pct, n, at }. Folding is a union by id, which
-- makes re-sending one a no-op, and ordering by `at` (when the round was
-- played) rather than by arrival is what finally lets two devices draw the same
-- chart — appending in pull order meant they could hold identical rounds in
-- different sequences even with no bug at all.
--
-- Additive, like every other change to this table: `history`/`counts` stay, so
-- a client that predates bars keeps working. Such a client cannot dedupe, so
-- newer clients deliberately stop sending it a whole chart in one event (see
-- uploadBaseline) — it still receives per-round `pct` events, which are safe.
-- No RLS or grant change: the existing owner-only policies and table-level
-- grants already cover new columns.

alter table public.events
  add column if not exists bars jsonb not null default '[]'::jsonb;

comment on column public.events.bars is
  'Accuracy-chart points as [{id, pct, n, at}]. Folds by union on id; ordered by at (play time). Supersedes history/counts, which remain for older clients.';
