-- Notifications. Every kind of notification can go by push, email, both, or be switched off, per person.
-- Events queue a row in notification_outbox; the `notify` edge function (supabase/functions/notify)
-- writes the message and delivers it. A database webhook on the outbox calls that function.

-- ─── Settings ────────────────────────────────────────────────────────────────

create table if not exists public.notification_prefs (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  expenses   text not null default 'push'  check (expenses  in ('off', 'push', 'email', 'both')),
  payments   text not null default 'both'  check (payments  in ('off', 'push', 'email', 'both')),
  comments   text not null default 'push'  check (comments  in ('off', 'push', 'email', 'both')),
  friends    text not null default 'push'  check (friends   in ('off', 'push', 'email', 'both')),
  reminders  text not null default 'both'  check (reminders in ('off', 'push', 'email', 'both')),
  weekly     text not null default 'email' check (weekly    in ('off', 'push', 'email', 'both')),
  updated_at timestamptz not null default now()
);
alter table public.notification_prefs enable row level security;
drop policy if exists "see own notification prefs" on public.notification_prefs;
create policy "see own notification prefs" on public.notification_prefs for select using (profile_id = public.me());
revoke insert, update, delete on public.notification_prefs from anon, authenticated;
grant select on public.notification_prefs to authenticated;

-- My settings, with defaults when I've never changed anything.
create or replace function public.my_notification_prefs()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  p public.notification_prefs;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  select * into p from public.notification_prefs where profile_id = me_id;
  if not found then
    p.profile_id := me_id;
    p.expenses := 'push'; p.payments := 'both'; p.comments := 'push';
    p.friends := 'push'; p.reminders := 'both'; p.weekly := 'email';
    p.updated_at := now();
  end if;
  return to_jsonb(p) - 'profile_id' - 'updated_at';
end
$$;

create or replace function public.set_notification_pref(category text, channel text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if category not in ('expenses', 'payments', 'comments', 'friends', 'reminders', 'weekly') then raise exception 'unknown notification type'; end if;
  if channel not in ('off', 'push', 'email', 'both') then raise exception 'unknown notification channel'; end if;
  insert into public.notification_prefs (profile_id) values (me_id) on conflict do nothing;
  execute format('update public.notification_prefs set %I = $1, updated_at = now() where profile_id = $2', category) using channel, me_id;
end
$$;

-- ─── Push tokens (one row per device; a token moves with whoever signs in on it) ───

create table if not exists public.push_tokens (
  token      text primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  platform   text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_profile_idx on public.push_tokens (profile_id);
alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from anon, authenticated;

create or replace function public.register_push_token(push_token text, device_platform text default 'android')
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if push_token is null or length(push_token) < 10 or length(push_token) > 400 then raise exception 'invalid push token'; end if;
  insert into public.push_tokens (token, profile_id, platform) values (push_token, me_id, coalesce(device_platform, 'android'))
  on conflict (token) do update set profile_id = excluded.profile_id, platform = excluded.platform, updated_at = now();
end
$$;

create or replace function public.unregister_push_token(push_token text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_tokens where token = push_token and profile_id = public.me();
$$;

-- ─── Outbox ──────────────────────────────────────────────────────────────────

create table if not exists public.notification_outbox (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  category    text not null, -- expenses | payments | comments | friends | reminders | weekly
  channels    text[] not null,
  actor_id    uuid references public.profiles (id) on delete set null,
  activity_id uuid references public.activity (id) on delete cascade,
  data        jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  sent_at     timestamptz,
  error       text
);
create index if not exists notification_outbox_unsent_idx on public.notification_outbox (created_at) where sent_at is null;
alter table public.notification_outbox enable row level security; -- no policies: only the edge function reads it
revoke all on public.notification_outbox from anon, authenticated;

create or replace function public.channels_for(pid uuid, category text) returns text[]
language plpgsql stable security definer set search_path = public as $$
declare
  choice text;
begin
  execute format('select %I from public.notification_prefs where profile_id = $1', category) into choice using pid;
  choice := coalesce(choice, case category when 'payments' then 'both' when 'reminders' then 'both' when 'weekly' then 'email' else 'push' end);
  return case choice when 'both' then array['push', 'email'] when 'off' then '{}'::text[] else array[choice] end;
end
$$;

-- Queue a notification for someone with an account, if they want this kind.
create or replace function public.queue_notification(pid uuid, category text, actor uuid, activity uuid, payload jsonb default '{}')
returns void language plpgsql security definer set search_path = public as $$
declare
  chans text[];
begin
  if pid is null or pid = actor then return; end if;
  if not exists (select 1 from public.profiles where id = pid and user_id is not null) then return; end if;
  chans := public.channels_for(pid, category);
  if cardinality(chans) = 0 then return; end if;
  insert into public.notification_outbox (profile_id, category, channels, actor_id, activity_id, data)
  values (pid, category, chans, actor, activity, coalesce(payload, '{}'));
end
$$;

-- Turns new activity into notifications for the people it's about (never the person who did it).
create or replace function public.notify_activity() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  snap jsonb := coalesce(new.data -> 'after', new.data -> 'before');
  category text;
  pid uuid;
begin
  if new.kind = 'member_added' then
    perform public.queue_notification((new.data ->> 'member_id')::uuid, 'friends', new.actor_id, new.id);
    return new;
  end if;
  if new.kind = 'group_created' then
    foreach pid in array new.involved loop
      perform public.queue_notification(pid, 'friends', new.actor_id, new.id);
    end loop;
    return new;
  end if;

  category := case
    when new.kind = 'comment_added' then 'comments'
    when coalesce((snap ->> 'is_payment')::boolean, false) then 'payments'
    else 'expenses'
  end;
  -- only the people in the expense (before or after an edit), not the whole group
  for pid in
    select distinct (s ->> 'profile_id')::uuid from jsonb_array_elements(
      coalesce(new.data -> 'after' -> 'shares', '[]') || coalesce(new.data -> 'before' -> 'shares', '[]')) s
    union
    select x from unnest(new.involved) x where new.kind = 'comment_added'
  loop
    perform public.queue_notification(pid, category, new.actor_id, new.id);
  end loop;
  return new;
end
$$;

drop trigger if exists on_activity_notify on public.activity;
create trigger on_activity_notify after insert on public.activity
for each row execute function public.notify_activity();

-- ─── Friend added ────────────────────────────────────────────────────────────

create or replace function public.add_friend(friend_email text, friend_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  fid uuid;
  clean_email text := lower(trim(friend_email));
  is_new boolean;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if clean_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email'; end if;

  select id into fid from public.profiles where email = clean_email;
  if fid is null then
    insert into public.profiles (email, name, avatar_color)
    values (
      clean_email,
      coalesce(nullif(trim(friend_name), ''), split_part(clean_email, '@', 1)),
      (array['#34C759','#007AFF','#FF9500','#AF52DE','#FF2D55','#5AC8FA','#FFCC00','#5856D6'])[1 + floor(random() * 8)::int]
    )
    returning id into fid;
  end if;
  if fid = me_id then raise exception 'you cannot add yourself'; end if;

  is_new := not exists (select 1 from public.friendships where profile_id = me_id and friend_id = fid);
  perform public.befriend(me_id, fid);
  if is_new then perform public.queue_notification(fid, 'friends', me_id, null, jsonb_build_object('event', 'friend_added')); end if;
  return fid;
end
$$;

create or replace function public.add_friend_by_phone(friend_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  fid uuid;
  is_new boolean;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  select id into fid from public.profiles where phone = friend_phone and user_id is not null;
  if fid is null then raise exception 'nobody on SplitWiser has that phone number yet'; end if;
  if fid = me_id then raise exception 'you cannot add yourself'; end if;
  is_new := not exists (select 1 from public.friendships where profile_id = me_id and friend_id = fid);
  perform public.befriend(me_id, fid);
  if is_new then perform public.queue_notification(fid, 'friends', me_id, null, jsonb_build_object('event', 'friend_added')); end if;
  return fid;
end
$$;

-- ─── Reminders ───────────────────────────────────────────────────────────────

-- Nudge a friend who owes me. At most one reminder per friend every 12 hours.
create or replace function public.send_reminder(fid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  owed jsonb;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if not exists (select 1 from public.friendships where profile_id = me_id and friend_id = fid) then raise exception 'unknown person'; end if;
  if not exists (select 1 from public.profiles where id = fid and user_id is not null) then
    raise exception 'they haven’t joined SplitWiser yet — share a reminder message instead';
  end if;
  if exists (select 1 from public.notification_outbox where profile_id = fid and actor_id = me_id and category = 'reminders'
             and created_at > now() - interval '12 hours') then
    raise exception 'you already reminded them today';
  end if;

  select jsonb_agg(jsonb_build_object('currency', currency, 'amount', amount)) into owed from (
    select currency, round(sum(amount), 2) as amount from (
      select currency, amount from public.pair_debts where creditor = me_id and debtor = fid
      union all
      select currency, -amount from public.pair_debts where creditor = fid and debtor = me_id
    ) x group by currency having round(sum(amount), 2) > 0
  ) t;
  if owed is null then raise exception 'they don’t owe you anything'; end if;

  perform public.queue_notification(fid, 'reminders', me_id, null, jsonb_build_object('event', 'reminder', 'owed', owed));
end
$$;

-- ─── Weekly summary (called by the notify function on a schedule) ────────────

create or replace function public.weekly_summaries()
returns table (profile_id uuid, channels text[], owed jsonb, owe jsonb, new_expenses int)
language sql stable security definer set search_path = public as $$
  with people as (
    select p.id, public.channels_for(p.id, 'weekly') as chans from public.profiles p where p.user_id is not null
  ),
  nets as (
    select creditor as pid, currency, amount from public.pair_debts
    union all
    select debtor, currency, -amount from public.pair_debts
  ),
  totals as (
    select pid, currency, round(sum(amount), 2) as total from nets group by pid, currency
  )
  select pe.id, pe.chans,
         coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', total)) from totals where pid = pe.id and total > 0), '[]'),
         coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', -total)) from totals where pid = pe.id and total < 0), '[]'),
         (select count(*)::int from public.activity a
           where pe.id = any (a.involved) and a.actor_id is distinct from pe.id
             and a.kind in ('expense_added', 'payment_added') and a.created_at > now() - interval '7 days')
  from people pe
  where cardinality(pe.chans) > 0
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────

revoke execute on function public.my_notification_prefs() from public, anon;
revoke execute on function public.set_notification_pref(text, text) from public, anon;
revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
revoke execute on function public.send_reminder(uuid) from public, anon;
revoke execute on function public.channels_for(uuid, text) from public, anon, authenticated;
revoke execute on function public.queue_notification(uuid, text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.notify_activity() from public, anon, authenticated;
revoke execute on function public.weekly_summaries() from public, anon, authenticated;
grant execute on function public.my_notification_prefs() to authenticated;
grant execute on function public.set_notification_pref(text, text) to authenticated;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.send_reminder(uuid) to authenticated;

-- ─── Account deletion also forgets devices and notification settings ─────────

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  uid uuid := auth.uid();
begin
  if me_id is null or uid is null then raise exception 'not signed in'; end if;
  delete from public.friendships where profile_id = me_id or friend_id = me_id;
  delete from public.comments where author_id = me_id;
  delete from public.active_devices where profile_id = me_id;
  delete from public.push_tokens where profile_id = me_id;
  delete from public.notification_prefs where profile_id = me_id;
  delete from public.notification_outbox where profile_id = me_id;
  update public.activity set data = data - 'body' where actor_id = me_id and kind = 'comment_added';
  update public.profiles
     set name = 'Deleted user', email = null, phone = null, avatar = null, user_id = null, avatar_color = '#9E9E9E'
   where id = me_id;
  delete from auth.users where id = uid;
end
$$;

-- The notify edge function runs as service_role (the role only exists on Supabase, not in local tests).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.weekly_summaries() to service_role;
    grant select, insert, update, delete on public.notification_outbox, public.push_tokens to service_role;
    grant select on public.profiles, public.activity to service_role;
  end if;
end
$$;
