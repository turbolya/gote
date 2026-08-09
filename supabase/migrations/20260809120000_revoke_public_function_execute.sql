-- Take EXECUTE on the SECURITY DEFINER functions away from the API roles.
--
-- Postgres grants EXECUTE on a new function to PUBLIC by default, and anon /
-- authenticated inherit it — so both functions below were reachable as RPC
-- (POST /rest/v1/rpc/<name>) by anyone holding the publishable key. That is
-- what the database linter flags (0028 / 0029).
--
-- Exploitability here is close to nil: both are `returns trigger`, and Postgres
-- refuses to call a trigger function outside a trigger. But "it errors out" is
-- not an access control, and these run as SECURITY DEFINER — i.e. with the
-- owner's rights, not the caller's. Removing a grant nothing needs is free.
--
-- Safe for the trigger: Postgres checks EXECUTE on a trigger function when the
-- TRIGGER IS CREATED, not each time it fires, and the owner keeps EXECUTE
-- regardless of what PUBLIC has. on_auth_user_created keeps working, and a
-- later re-run of the init migration (which recreates the trigger as the owner)
-- still succeeds.
--
-- Both statements are guarded, so this migration is safe on a project where a
-- function is absent — notably rls_auto_enable, which no migration in this repo
-- creates. It exists on the deployed database only, so it was added out of band
-- (dashboard SQL editor or similar). Guarding rather than naming it outright
-- keeps a from-scratch `supabase db reset` working.

do $$
begin
  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'handle_new_user'
  ) then
    -- Run through EXECUTE so the statement is never parsed on a database where
    -- the function is absent.
    execute 'revoke execute on function public.handle_new_user() from public, anon, authenticated';
  end if;

  if exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Deliberately NOT addressed, so nobody "fixes" them later and breaks sync:
--
-- 0012 auth_allow_anonymous_sign_ins (events, profiles, settings)
--   Anonymous identity is the product, not an oversight. gote has always been
--   playable with no account; an anonymous user is just a stable id to hang
--   rows off, and asking players to sign up before they can keep their own
--   statistics would be a worse app. Every policy on these tables is
--   `to authenticated using (auth.uid() = <owner column>)`, and a Supabase
--   anonymous user holds the `authenticated` role with is_anonymous = true in
--   its JWT — so it reaches its OWN rows and nothing else. Excluding anonymous
--   users, which is what the lint suggests, would turn sync off for the default
--   way the app is used.
--
-- auth_leaked_password_protection
--   There are no passwords to protect. Auth is anonymous sign-in plus email
--   OTP; the app never collects, sends or stores one. Enabling the setting is
--   harmless future-proofing but changes nothing today.
-- ---------------------------------------------------------------------------
