-- Paste into SQL Editor and Run: every row should say true. Read-only; changes nothing.
select item, ok from (values
  ('1 init: tables and balances',            to_regclass('public.pair_debts') is not null),
  ('1 init: live activity updates',          exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'activity')),
  ('2 account deletion',                     to_regprocedure('public.delete_my_account()') is not null),
  ('3 remove friend',                        to_regprocedure('public.remove_friend(uuid)') is not null),
  ('4 profile extras: phone and avatar',     exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'avatar')),
  ('4 profile extras: one device per user',  to_regclass('public.active_devices') is not null),
  ('5 notifications',                        to_regclass('public.notification_outbox') is not null),
  ('5 notifications: trigger on activity',   exists (select 1 from pg_trigger where tgname = 'on_activity_notify')),
  ('6 phone privacy',                        to_regprocedure('public.my_private_profile()') is not null),
  ('7 hardening: confirmed-email claim',     exists (select 1 from pg_trigger where tgname = 'on_auth_user_confirmed')),
  ('7 hardening: leave group checks',        to_regprocedure('public.leave_group(uuid)') is not null),
  ('7 hardening: retry limit',               exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'notification_outbox' and column_name = 'attempts')),
  ('every app table has row level security', not exists (
     select 1 from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity))
) as checks (item, ok);
