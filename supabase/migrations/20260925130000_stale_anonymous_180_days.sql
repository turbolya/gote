-- gote — anonymous-account cleanup: 180 days, and actually scheduled.
--
-- Idempotent. See docs/SCHEMA-CHANGELOG.md for the running record.
--
-- Supersedes two details of 20260925120000_payload_cap_and_stale_anonymous.sql:
--
--   • The idle threshold is 180 days, not 90. Half a year is a gentler reading
--     of "abandoned" for a hobby played in seasons — migration spring to
--     migration autumn is longer than 90 days.
--   • pg_cron is enabled here, so the weekly run is scheduled rather than
--     depending on someone having switched the extension on beforehand. The
--     privacy policy promises this deletion; it must not hinge on a dashboard
--     toggle.
--
-- The function is dropped and recreated rather than replaced, so its default
-- is unambiguously the new one. The job passes the interval explicitly as well,
-- so what runs does not depend on the default at all.

create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

drop function if exists public.delete_stale_anonymous_users(interval);

create function public.delete_stale_anonymous_users(
  older_than interval default interval '180 days'
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

-- Sundays 03:17 UTC. Unschedule-then-schedule keeps a re-run from adding a
-- second copy of the job.
select cron.unschedule(jobid) from cron.job
  where jobname = 'gote-delete-stale-anonymous-users';
select cron.schedule(
  'gote-delete-stale-anonymous-users',
  '17 3 * * 0',
  $job$select public.delete_stale_anonymous_users(interval '180 days')$job$
);
