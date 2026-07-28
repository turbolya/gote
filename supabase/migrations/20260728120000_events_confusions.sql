-- gote — sync the confusion matrix.
--
-- Idempotent. See docs/SCHEMA-CHANGELOG.md for the running record.
--
-- Which look-alike species the player mixes up is a COUNTER, so it rides the
-- append-only `events` log exactly like `species`: each round carries a delta,
-- and every device sums the union. This adds the column that delta lives in.
--
-- Additive / expand-only, so it is backward-compatible with every client already
-- in the field: a nullable-with-default column. An older client inserts an event
-- without `confusions` and gets `{}`; an older reader selects the columns it
-- knows and ignores this one; only a new reader folds it in. No RLS or grant
-- change is needed — the existing owner-only policies and the table-level
-- select/insert grants already cover new columns.

alter table public.events
  add column if not exists confusions jsonb not null default '{}'::jsonb;
