-- gote — cap the size of a synced row, and clear out abandoned anonymous accounts.
--
-- Idempotent. See docs/SCHEMA-CHANGELOG.md for the running record.
--
-- Anonymous sign-ins are on and the publishable key ships in the app, so anyone
-- can mint an account (30 an hour per IP) and write rows to it. RLS keeps those
-- rows private; nothing kept them SMALL, or kept them from piling up.
--
-- 1. SIZE. Every jsonb column on `events` was unbounded, so one row could carry
--    megabytes. The cap below is far above anything the app writes — a baseline
--    for a player with a thousand species and a full chart is a few hundred KB —
--    and exists only so the free-tier database cannot be filled a row at a time.
--    `not valid`: rows already written are not re-checked, only new ones.
--
--    A row over the cap is refused with 23514, which the client treats as
--    permanent and drops (src/sync/index.js isPermanentReject). That is the
--    intended outcome for an abusive row; a genuine one cannot get near it.
--
-- 2. ABANDONED ANONYMOUS ACCOUNTS. Two ordinary paths leave one behind: signing
--    in with email on a device (its anonymous account is left for the one it
--    joins), and turning sync off. Neither is ever used again, and nothing
--    deleted them — so their rows stayed on the server indefinitely, which is
--    neither tidy nor what the privacy policy promises.
--
--    delete_stale_anonymous_users() removes anonymous accounts with no activity
--    (no new event, no settings write, no sign-in) for `older_than`, 90 days by
--    default; the cascade from auth.users takes their rows with them. An account
--    still in use is untouched, because use means new events. And if a device
--    does come back to a deleted account after months away, its session no
--    longer refreshes, it signs in anonymously afresh, and it re-sends its whole
--    history as a baseline (src/sync/index.js reconcileAccount) — nothing is
--    lost from the device.
--
--    Scheduled weekly with pg_cron when the extension is enabled (Dashboard ▸
--    Database ▸ Extensions); without it the function exists and can be run by
--    hand. EXECUTE is revoked from the API roles, like the other SECURITY
--    DEFINER functions (see 20260809120000_revoke_public_function_execute.sql).

alter table public.events drop constraint if exists events_payload_size;
alter table public.events add constraint events_payload_size check (
  octet_length(species::text)
  + octet_length(formats::text)
  + octet_length(confusions::text)
  + octet_length(bars::text)
  + octet_length(history::text)
  + octet_length(counts::text)
  + octet_length(days::text)
  <= 2000000
) not valid;

alter table public.settings drop constraint if exists settings_data_size;
alter table public.settings add constraint settings_data_size check (
  octet_length(data::text) <= 1000000
) not valid;

create or replace function public.delete_stale_anonymous_users(
  older_than interval default interval '90 days'
)
returns integer
language plpgsql
security definer set search_path = ''
as $$
declare
  removed integer;
begin
  delete from auth.users u
  where u.is_anonymous
    and u.created_at < now() - older_than
    and coalesce(u.last_sign_in_at, u.created_at) < now() - older_than
    and not exists (
      select 1 from public.events e
      where e.user_id = u.id and e.created_at >= now() - older_than
    )
    and not exists (
      select 1 from public.settings s
      where s.user_id = u.id and s.updated_at >= now() - older_than
    );
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke execute on function public.delete_stale_anonymous_users(interval) from public;
revoke execute on function public.delete_stale_anonymous_users(interval) from anon;
revoke execute on function public.delete_stale_anonymous_users(interval) from authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job
      where jobname = 'gote-delete-stale-anonymous-users';
    perform cron.schedule(
      'gote-delete-stale-anonymous-users',
      '17 3 * * 0',
      'select public.delete_stale_anonymous_users()'
    );
  end if;
end;
$$;
