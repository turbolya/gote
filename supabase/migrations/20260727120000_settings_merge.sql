-- gote — settings payload forward-compatibility.
--
-- Idempotent: safe to re-run. See docs/SCHEMA-CHANGELOG.md for the running
-- record of payload/DB schema versions and the compatibility rules.
--
-- WHY
-- ---
-- `settings.data` is one jsonb blob synced last-write-wins. As the app grows,
-- new top-level keys join it (custom-deck prefs, deck-sharing options, …). The
-- danger is an OLDER client — one shipped before a key existed — writing the
-- blob back and silently ERASING that key, because a plain upsert replaces the
-- whole column with only the keys the old client knows.
--
-- Fix it once, in the database, so every client (including ones already in the
-- field years from now) is covered without shipping new code: shallow-merge
-- `data` on update instead of replacing it. A writer then only ever contributes
-- the keys it sent; keys it omitted are preserved.
--
-- Shallow, on purpose: `old.data || new.data` overrides at the TOP LEVEL only.
-- So every independently-evolving concern must be its own top-level key — never
-- bury a new toggle inside an existing nested object, or an old client that
-- rewrites that object would still clobber the nested addition.
--
-- Insert is untouched (there is no prior row to preserve). Last-write-wins is
-- unchanged: `updated_at` still comes from the client and still drives the pull
-- watermark; the merge only decides which KEYS survive, not which WRITE is newer.

create or replace function public.merge_settings_data()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.data := coalesce(old.data, '{}'::jsonb) || coalesce(new.data, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists settings_merge_data on public.settings;
create trigger settings_merge_data
  before update on public.settings
  for each row execute function public.merge_settings_data();
