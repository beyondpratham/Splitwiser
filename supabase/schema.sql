-- SplitWiser database: the complete setup in one file.
-- Paste all of it into Supabase → SQL Editor → New query, and press Run.
-- Safe to run again: it only adds what's missing and refreshes the functions and rules.
-- Generated from supabase/migrations by `npm run db:schema`; don't edit this file by hand.

-- ════════ 20261010000000_init.sql ════════

-- SplitWiser initial schema
-- Model: every person is a `profile`. A profile may be a placeholder (no auth user yet, e.g. a
-- friend added by email); when that person signs up with the same email the profile is claimed.
-- Every expense stores, per participant, how much they PAID and how much they OWE. Settle-ups are
-- just expenses with is_payment = true. Balances are derived, never stored.


-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.profiles (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid unique references auth.users (id) on delete set null,
  email            text unique,
  name             text not null,
  avatar_color     text not null default '#34C759',
  default_currency text not null default 'USD',
  created_at       timestamptz not null default now()
);

create table if not exists public.friendships (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  friend_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, friend_id),
  check (profile_id <> friend_id)
);

create table if not exists public.groups (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (length(trim(name)) > 0),
  emoji            text not null default '👥',
  kind             text not null default 'other' check (kind in ('home', 'trip', 'couple', 'other')),
  default_currency text not null default 'USD',
  simplify_debts   boolean not null default true,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id   uuid not null references public.groups (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (group_id, profile_id)
);

create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid references public.groups (id) on delete cascade,
  description text not null check (length(trim(description)) > 0),
  amount      numeric(14, 2) not null check (amount > 0),
  currency    text not null default 'USD',
  category    text not null default 'general',
  split_type  text not null default 'equal' check (split_type in ('equal', 'exact', 'percent', 'shares')),
  is_payment  boolean not null default false,
  spent_on    date not null default current_date,
  notes       text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists expenses_group_idx on public.expenses (group_id, spent_on desc);

create table if not exists public.expense_shares (
  expense_id  uuid not null references public.expenses (id) on delete cascade,
  profile_id  uuid not null references public.profiles (id) on delete cascade,
  paid        numeric(14, 2) not null default 0 check (paid >= 0),
  owed        numeric(14, 2) not null default 0 check (owed >= 0),
  split_value numeric(14, 4), -- raw input for percent / shares splits, for re-editing
  primary key (expense_id, profile_id)
);
create index if not exists expense_shares_profile_idx on public.expense_shares (profile_id);

create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now()
);
create index if not exists comments_expense_idx on public.comments (expense_id, created_at);

create table if not exists public.activity (
  id         uuid primary key default gen_random_uuid(),
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null, -- expense_added | expense_updated | expense_deleted | payment_added | comment_added | group_created | member_added
  group_id   uuid references public.groups (id) on delete cascade,
  expense_id uuid references public.expenses (id) on delete cascade,
  involved   uuid[] not null default '{}',
  data       jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activity_involved_idx on public.activity using gin (involved);
create index if not exists activity_expense_idx on public.activity (expense_id, created_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Helpers (security definer so RLS policies can call them without recursion)
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.me() returns uuid
language sql stable security definer set search_path = public as $$
  select id from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_group_member(gid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = gid and profile_id = public.me())
$$;

create or replace function public.can_see_expense(eid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.expenses e
    where e.id = eid
      and (
        (e.group_id is not null and public.is_group_member(e.group_id))
        or exists (select 1 from public.expense_shares s where s.expense_id = e.id and s.profile_id = public.me())
      )
  )
$$;

create or replace function public.can_see_profile(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select pid = public.me()
    or exists (select 1 from public.friendships f where f.profile_id = public.me() and f.friend_id = pid)
    or exists (
      select 1 from public.group_members a
      join public.group_members b on a.group_id = b.group_id
      where a.profile_id = public.me() and b.profile_id = pid
    )
    or exists (
      select 1 from public.expense_shares a
      join public.expense_shares b on a.expense_id = b.expense_id
      where a.profile_id = public.me() and b.profile_id = pid
    )
$$;

create or replace function public.befriend(a uuid, b uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.friendships (profile_id, friend_id)
  select x, y from (values (a, b), (b, a)) v (x, y)
  where a <> b
  on conflict do nothing
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Auth: create or claim a profile when someone signs up
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  display_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));
begin
  update public.profiles set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;

  if not found then
    insert into public.profiles (user_id, email, name, avatar_color)
    values (
      new.id, lower(new.email), display_name,
      (array['#34C759','#007AFF','#FF9500','#AF52DE','#FF2D55','#5AC8FA','#FFCC00','#5856D6'])[1 + floor(random() * 8)::int]
    );
  end if;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.friendships    enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.expenses       enable row level security;
alter table public.expense_shares enable row level security;
alter table public.comments       enable row level security;
alter table public.activity       enable row level security;

drop policy if exists "see related profiles" on public.profiles;
create policy "see related profiles" on public.profiles for select using (public.can_see_profile(id));
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile"   on public.profiles for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships"    on public.friendships for select using (profile_id = public.me());
drop policy if exists "remove own friendships" on public.friendships;
create policy "remove own friendships" on public.friendships for delete using (profile_id = public.me() or friend_id = public.me());

drop policy if exists "members see groups" on public.groups;
create policy "members see groups"    on public.groups for select using (public.is_group_member(id) or created_by = public.me());
drop policy if exists "members update groups" on public.groups;
create policy "members update groups" on public.groups for update using (public.is_group_member(id));
drop policy if exists "creator deletes group" on public.groups;
create policy "creator deletes group" on public.groups for delete using (created_by = public.me());

drop policy if exists "members see members" on public.group_members;
create policy "members see members" on public.group_members for select using (public.is_group_member(group_id));
drop policy if exists "leave group" on public.group_members;
create policy "leave group"         on public.group_members for delete using (profile_id = public.me());

drop policy if exists "see expenses" on public.expenses;
create policy "see expenses"    on public.expenses       for select using (public.can_see_expense(id));
drop policy if exists "see shares" on public.expense_shares;
create policy "see shares"      on public.expense_shares for select using (public.can_see_expense(expense_id));
drop policy if exists "see comments" on public.comments;
create policy "see comments"    on public.comments       for select using (public.can_see_expense(expense_id));
drop policy if exists "delete own comment" on public.comments;
create policy "delete own comment" on public.comments    for delete using (author_id = public.me());
drop policy if exists "see activity" on public.activity;
create policy "see activity"    on public.activity       for select using (public.me() = any (involved));

-- Writes for groups / members / expenses / comments go through the RPCs below.

-- ─────────────────────────────────────────────────────────────────────────────
-- Derived balances
-- For each expense, every net debtor (owed > paid) owes each net creditor proportionally.
-- security_invoker makes the views respect the caller's RLS.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.pair_debts with (security_invoker = true) as
with nets as (
  select e.id as expense_id, e.group_id, e.currency, s.profile_id, (s.paid - s.owed) as net
  from public.expenses e
  join public.expense_shares s on s.expense_id = e.id
  where e.deleted_at is null
),
pos as (
  select expense_id, sum(net) as total from nets where net > 0 group by expense_id
)
select d.expense_id, d.group_id, d.currency,
       d.profile_id as debtor, c.profile_id as creditor,
       round((-d.net) * c.net / p.total, 4) as amount
from nets d
join nets c on c.expense_id = d.expense_id and c.net > 0
join pos p on p.expense_id = d.expense_id
where d.net < 0;

-- Net balance between me and each other person, per group (null = non-group) and currency.
-- Positive = they owe me.
create or replace view public.my_balances with (security_invoker = true) as
select other_id, group_id, currency, round(sum(amount), 2) as balance
from (
  select creditor as me_id, debtor as other_id, group_id, currency, amount from public.pair_debts
  union all
  select debtor, creditor, group_id, currency, -amount from public.pair_debts
) x
where me_id = public.me()
group by other_id, group_id, currency
having round(sum(amount), 2) <> 0;

-- Each member's net position in a group, per currency. Positive = is owed.
create or replace view public.group_balances with (security_invoker = true) as
select e.group_id, e.currency, s.profile_id, round(sum(s.paid - s.owed), 2) as balance
from public.expenses e
join public.expense_shares s on s.expense_id = e.id
where e.deleted_at is null and e.group_id is not null
group by e.group_id, e.currency, s.profile_id;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPCs
-- ─────────────────────────────────────────────────────────────────────────────

-- Find (or create a placeholder) profile by email and make them my friend.
create or replace function public.add_friend(friend_email text, friend_name text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  fid uuid;
  clean_email text := lower(trim(friend_email));
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

  perform public.befriend(me_id, fid);
  return fid;
end
$$;

create or replace function public.create_group(
  group_name text, group_emoji text default '👥', group_kind text default 'other',
  currency text default 'USD', member_ids uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  gid uuid;
  m uuid;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  insert into public.groups (name, emoji, kind, default_currency, created_by)
  values (trim(group_name), coalesce(group_emoji, '👥'), coalesce(group_kind, 'other'), coalesce(currency, 'USD'), me_id)
  returning id into gid;

  insert into public.group_members (group_id, profile_id) values (gid, me_id);
  foreach m in array coalesce(member_ids, '{}') loop
    if m <> me_id and exists (select 1 from public.friendships where profile_id = me_id and friend_id = m) then
      insert into public.group_members (group_id, profile_id) values (gid, m) on conflict do nothing;
    end if;
  end loop;

  insert into public.activity (actor_id, kind, group_id, involved, data)
  select me_id, 'group_created', gid, array_agg(profile_id), jsonb_build_object('group_name', trim(group_name))
  from public.group_members where group_id = gid;
  return gid;
end
$$;

create or replace function public.add_group_member(gid uuid, member_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  m record;
begin
  if not public.is_group_member(gid) then raise exception 'not a member of this group'; end if;
  if not public.can_see_profile(member_id) then raise exception 'unknown person'; end if;

  insert into public.group_members (group_id, profile_id) values (gid, member_id) on conflict do nothing;
  for m in select profile_id from public.group_members where group_id = gid loop
    perform public.befriend(m.profile_id, member_id);
  end loop;

  insert into public.activity (actor_id, kind, group_id, involved, data)
  select me_id, 'member_added', gid, array_agg(gm.profile_id),
         jsonb_build_object('member_id', member_id, 'member_name', (select name from public.profiles where id = member_id),
                            'group_name', (select name from public.groups where id = gid))
  from public.group_members gm where gm.group_id = gid;
end
$$;

create or replace function public.expense_snapshot(eid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'description', e.description, 'amount', e.amount, 'currency', e.currency, 'category', e.category,
    'split_type', e.split_type, 'spent_on', e.spent_on, 'notes', e.notes, 'is_payment', e.is_payment,
    'group_name', g.name,
    'shares', coalesce((
      select jsonb_agg(jsonb_build_object('profile_id', s.profile_id, 'name', p.name, 'paid', s.paid, 'owed', s.owed) order by p.name)
      from public.expense_shares s join public.profiles p on p.id = s.profile_id
      where s.expense_id = e.id
    ), '[]'::jsonb)
  )
  from public.expenses e left join public.groups g on g.id = e.group_id
  where e.id = eid
$$;

-- Create or update an expense (or payment) together with its shares, atomically.
-- payload: { id?, group_id?, description, amount, currency, category, split_type, is_payment,
--            spent_on, notes, shares: [{ profile_id, paid, owed, split_value? }] }
create or replace function public.save_expense(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  eid uuid := nullif(payload ->> 'id', '')::uuid;
  gid uuid := nullif(payload ->> 'group_id', '')::uuid;
  amt numeric(14, 2) := (payload ->> 'amount')::numeric;
  total_paid numeric; total_owed numeric;
  people uuid[];
  before jsonb;
  is_pay boolean := coalesce((payload ->> 'is_payment')::boolean, false);
  a uuid; b uuid;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if amt is null or amt <= 0 then raise exception 'amount must be positive'; end if;

  select coalesce(sum((s ->> 'paid')::numeric), 0), coalesce(sum((s ->> 'owed')::numeric), 0),
         array_agg(distinct (s ->> 'profile_id')::uuid)
    into total_paid, total_owed, people
  from jsonb_array_elements(payload -> 'shares') s;

  if people is null or array_length(people, 1) < 2 then raise exception 'an expense needs at least two people'; end if;
  if abs(total_paid - amt) > 0.01 then raise exception 'paid amounts (%) must add up to %', total_paid, amt; end if;
  if abs(total_owed - amt) > 0.01 then raise exception 'owed amounts (%) must add up to %', total_owed, amt; end if;

  if gid is not null then
    if not public.is_group_member(gid) then raise exception 'not a member of this group'; end if;
    if exists (select 1 from unnest(people) p where not exists (
      select 1 from public.group_members where group_id = gid and profile_id = p)) then
      raise exception 'everyone in the expense must be in the group';
    end if;
  else
    if not (me_id = any (people)) then raise exception 'you must be part of a non-group expense'; end if;
    if exists (select 1 from unnest(people) p where p <> me_id and not public.can_see_profile(p)) then
      raise exception 'unknown person in expense';
    end if;
  end if;

  if eid is null then
    insert into public.expenses (group_id, description, amount, currency, category, split_type, is_payment, spent_on, notes, created_by)
    values (gid, trim(payload ->> 'description'), amt, coalesce(payload ->> 'currency', 'USD'),
            coalesce(payload ->> 'category', 'general'), coalesce(payload ->> 'split_type', 'equal'), is_pay,
            coalesce((payload ->> 'spent_on')::date, current_date), nullif(trim(payload ->> 'notes'), ''), me_id)
    returning id into eid;
  else
    if not public.can_see_expense(eid) then raise exception 'expense not found'; end if;
    before := public.expense_snapshot(eid);
    update public.expenses set
      group_id = gid, description = trim(payload ->> 'description'), amount = amt,
      currency = coalesce(payload ->> 'currency', currency), category = coalesce(payload ->> 'category', category),
      split_type = coalesce(payload ->> 'split_type', split_type), is_payment = is_pay,
      spent_on = coalesce((payload ->> 'spent_on')::date, spent_on), notes = nullif(trim(payload ->> 'notes'), ''),
      updated_at = now()
    where id = eid and deleted_at is null;
    delete from public.expense_shares where expense_id = eid;
  end if;

  insert into public.expense_shares (expense_id, profile_id, paid, owed, split_value)
  select eid, (s ->> 'profile_id')::uuid, coalesce((s ->> 'paid')::numeric, 0), coalesce((s ->> 'owed')::numeric, 0),
         nullif(s ->> 'split_value', '')::numeric
  from jsonb_array_elements(payload -> 'shares') s
  where coalesce((s ->> 'paid')::numeric, 0) > 0 or coalesce((s ->> 'owed')::numeric, 0) > 0;

  -- people who share an expense become friends
  foreach a in array people loop
    foreach b in array people loop
      if a < b then perform public.befriend(a, b); end if;
    end loop;
  end loop;

  insert into public.activity (actor_id, kind, group_id, expense_id, involved, data)
  values (
    me_id,
    case when before is not null then 'expense_updated' when is_pay then 'payment_added' else 'expense_added' end,
    gid, eid,
    (select array_agg(distinct x) from unnest(
       people || coalesce((select array_agg(profile_id) from public.group_members where group_id = gid), '{}')
       || coalesce((select array_agg((s ->> 'profile_id')::uuid) from jsonb_array_elements(before -> 'shares') s), '{}')
     ) x),
    jsonb_build_object('after', public.expense_snapshot(eid)) || coalesce(jsonb_build_object('before', before), '{}')
  );
  return eid;
end
$$;

create or replace function public.delete_expense(eid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  gid uuid;
begin
  if not public.can_see_expense(eid) then raise exception 'expense not found'; end if;
  update public.expenses set deleted_at = now(), updated_at = now() where id = eid and deleted_at is null
  returning group_id into gid;

  insert into public.activity (actor_id, kind, group_id, expense_id, involved, data)
  select me_id, 'expense_deleted', gid, eid,
         array(select distinct x from unnest(
           array(select profile_id from public.expense_shares where expense_id = eid)
           || coalesce((select array_agg(profile_id) from public.group_members where group_id = gid), '{}')) x),
         jsonb_build_object('before', public.expense_snapshot(eid));
end
$$;

create or replace function public.restore_expense(eid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.can_see_expense(eid) then raise exception 'expense not found'; end if;
  update public.expenses set deleted_at = null, updated_at = now() where id = eid;
  insert into public.activity (actor_id, kind, group_id, expense_id, involved, data)
  select public.me(), 'expense_restored', e.group_id, eid,
         array(select profile_id from public.expense_shares where expense_id = eid),
         jsonb_build_object('after', public.expense_snapshot(eid))
  from public.expenses e where e.id = eid;
end
$$;

create or replace function public.add_comment(eid uuid, comment_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  cid uuid;
begin
  if not public.can_see_expense(eid) then raise exception 'expense not found'; end if;
  insert into public.comments (expense_id, author_id, body) values (eid, me_id, trim(comment_body)) returning id into cid;

  insert into public.activity (actor_id, kind, group_id, expense_id, involved, data)
  select me_id, 'comment_added', e.group_id, eid,
         array(select profile_id from public.expense_shares where expense_id = eid),
         jsonb_build_object('body', left(trim(comment_body), 140), 'description', e.description)
  from public.expenses e where e.id = eid;
  return cid;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants & realtime
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.befriend(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant select on public.pair_debts, public.my_balances, public.group_balances to authenticated;

-- Direct updates are limited to harmless columns (email / user_id are never client-writable).
revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_color, default_currency) on public.profiles to authenticated;
revoke update on public.groups from anon, authenticated;
grant update (name, emoji, kind, default_currency, simplify_debts) on public.groups to authenticated;
revoke insert on public.profiles, public.friendships, public.groups, public.group_members,
  public.expenses, public.expense_shares, public.comments, public.activity from anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'activity') then
    alter publication supabase_realtime add table public.activity;
  end if;
end
$$;

-- ════════ 20261011000000_account_deletion.sql ════════

-- Account deletion (required by Google Play for apps with sign-up).
-- Removes the login, friendships and comments, and anonymizes the profile. Shared expense rows stay,
-- because they are also the other members' financial history; they now show "Deleted user".

create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  uid uuid := auth.uid();
begin
  if me_id is null or uid is null then raise exception 'not signed in'; end if;

  delete from public.friendships where profile_id = me_id or friend_id = me_id;
  delete from public.comments where author_id = me_id;
  update public.activity set data = data - 'body' where actor_id = me_id and kind = 'comment_added';
  update public.profiles
     set name = 'Deleted user', email = null, user_id = null, avatar_color = '#9E9E9E'
   where id = me_id;
  delete from auth.users where id = uid;
end
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ════════ 20261015000000_remove_friend.sql ════════

-- Remove a friend (both directions). Only allowed when you're settled up with them and don't share
-- a group — otherwise their shared expenses would lose context.

create or replace function public.remove_friend(fid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if exists (select 1 from public.my_balances where other_id = fid) then
    raise exception 'settle up with them before removing them';
  end if;
  if exists (
    select 1 from public.group_members a join public.group_members b on a.group_id = b.group_id
    where a.profile_id = me_id and b.profile_id = fid
  ) then
    raise exception 'you share a group with them — leave it or remove them from it first';
  end if;
  delete from public.friendships
   where (profile_id = me_id and friend_id = fid) or (profile_id = fid and friend_id = me_id);
end
$$;

revoke execute on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ════════ 20261017000000_profile_extras.sql ════════

-- Profile extras: phone number (one per account), avatar (preset or small photo), one active device
-- per user, and contact matching for "sync contacts".

alter table public.profiles
  add column if not exists phone text,
  add column if not exists avatar text;

-- One phone number per account (emails are already unique).
create unique index if not exists profiles_phone_key on public.profiles (phone) where phone is not null;
alter table public.profiles drop constraint if exists profiles_phone_format;
alter table public.profiles drop constraint if exists profiles_avatar_size;
alter table public.profiles
  add constraint profiles_phone_format check (phone is null or phone ~ '^\+[1-9][0-9]{6,14}$'),
  -- "emoji:<key>" for preset avatars, or a small data: URI photo (resized on the device)
  add constraint profiles_avatar_size check (avatar is null or length(avatar) <= 200000);

revoke update on public.profiles from anon, authenticated;
grant update (name, avatar_color, default_currency, phone, avatar) on public.profiles to authenticated;

-- One device per user: the device that signed in most recently wins; the others sign out.
create table if not exists public.active_devices (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  device_id  text not null,
  claimed_at timestamptz not null default now()
);
alter table public.active_devices enable row level security;
drop policy if exists "see own device" on public.active_devices;
create policy "see own device" on public.active_devices for select using (profile_id = public.me());
revoke insert, update, delete on public.active_devices from anon, authenticated;

create or replace function public.claim_device(device text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if device is null or length(device) < 8 then raise exception 'invalid device id'; end if;
  insert into public.active_devices (profile_id, device_id) values (me_id, device)
  on conflict (profile_id) do update set device_id = excluded.device_id, claimed_at = now();
end
$$;

-- Which of these emails / phone numbers belong to SplitWiser users? Returns only the matches.
create or replace function public.find_users_by_contacts(emails text[], phones text[])
returns table (id uuid, name text, email text, phone text, avatar text, avatar_color text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email, p.phone, p.avatar, p.avatar_color
  from public.profiles p
  where p.user_id is not null
    and p.id <> public.me()
    and public.me() is not null
    and (lower(p.email) = any (select lower(e) from unnest(coalesce(emails, '{}')) e)
         or p.phone = any (coalesce(phones, '{}')))
  limit 500
$$;

-- Add a friend who already has an account, by phone number.
create or replace function public.add_friend_by_phone(friend_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  fid uuid;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  select id into fid from public.profiles where phone = friend_phone and user_id is not null;
  if fid is null then raise exception 'nobody on SplitWiser has that phone number yet'; end if;
  if fid = me_id then raise exception 'you cannot add yourself'; end if;
  perform public.befriend(me_id, fid);
  return fid;
end
$$;

revoke execute on function public.claim_device(text) from public, anon;
revoke execute on function public.find_users_by_contacts(text[], text[]) from public, anon;
revoke execute on function public.add_friend_by_phone(text) from public, anon;
grant execute on function public.claim_device(text) to authenticated;
grant execute on function public.find_users_by_contacts(text[], text[]) to authenticated;
grant execute on function public.add_friend_by_phone(text) to authenticated;
grant select on public.active_devices to authenticated;

-- Account deletion also forgets the phone number and avatar.
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
  update public.activity set data = data - 'body' where actor_id = me_id and kind = 'comment_added';
  update public.profiles
     set name = 'Deleted user', email = null, phone = null, avatar = null, user_id = null, avatar_color = '#9E9E9E'
   where id = me_id;
  delete from auth.users where id = uid;
end
$$;

-- ════════ 20261018000000_notifications.sql ════════

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

-- ════════ 20261019000000_phone_privacy.sql ════════

-- Phone numbers are private: only you can read yours. Others can only use it to find you (sync contacts,
-- add by phone), and only while you allow that.

alter table public.profiles add column if not exists phone_discoverable boolean not null default true;

-- Every profile column except phone / phone_discoverable stays readable (row level security still decides
-- which rows). Your own phone comes from my_private_profile().
revoke select on public.profiles from anon, authenticated;
grant select (id, user_id, email, name, avatar_color, default_currency, created_at, avatar) on public.profiles to authenticated;
grant update (phone_discoverable) on public.profiles to authenticated;
-- the app's "is this a SplitWiser server?" check reads one id while signed out (row level security returns no rows)
grant select (id) on public.profiles to anon;

create or replace function public.my_private_profile()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('phone', phone, 'phone_discoverable', phone_discoverable)
  from public.profiles where id = public.me()
$$;

-- Contact matching: a phone number only matches people who allow it, and a number is only returned to
-- someone who already had it.
create or replace function public.find_users_by_contacts(emails text[], phones text[])
returns table (id uuid, name text, email text, phone text, avatar text, avatar_color text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.email,
         case when p.phone_discoverable and p.phone = any (coalesce(phones, '{}')) then p.phone end,
         p.avatar, p.avatar_color
  from public.profiles p
  where p.user_id is not null
    and p.id <> public.me()
    and public.me() is not null
    and (lower(p.email) = any (select lower(e) from unnest(coalesce(emails, '{}')) e)
         or (p.phone_discoverable and p.phone = any (coalesce(phones, '{}'))))
  limit 500
$$;

create or replace function public.add_friend_by_phone(friend_phone text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  fid uuid;
  is_new boolean;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  select id into fid from public.profiles where phone = friend_phone and user_id is not null and phone_discoverable;
  if fid is null then raise exception 'nobody on SplitWiser has that phone number yet'; end if;
  if fid = me_id then raise exception 'you cannot add yourself'; end if;
  is_new := not exists (select 1 from public.friendships where profile_id = me_id and friend_id = fid);
  perform public.befriend(me_id, fid);
  if is_new then perform public.queue_notification(fid, 'friends', me_id, null, jsonb_build_object('event', 'friend_added')); end if;
  return fid;
end
$$;

revoke execute on function public.my_private_profile() from public, anon;
grant execute on function public.my_private_profile() to authenticated;

-- ════════ 20261020000000_hardening.sql ════════

-- Hardening after a review of the earlier migrations.

-- ─── 1. Invited profiles are only claimed by a confirmed email ──────────────
-- Friends can add someone by email before they join; signing up with that email takes over the profile
-- and its shared history. Only do that once the email is confirmed, so nobody can sign up with another
-- person's address and read their expenses. (With "Confirm email" off, Supabase confirms instantly, so
-- turn it on in Authentication → Providers → Email.) The name chosen at sign-up replaces the name the
-- inviter typed.

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  display_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1));
begin
  if new.email_confirmed_at is null then return new; end if; -- runs again when the email is confirmed
  if exists (select 1 from public.profiles where user_id = new.id) then return new; end if;

  update public.profiles
     set user_id = new.id,
         name = coalesce(left(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), 80), name)
   where lower(email) = lower(new.email) and user_id is null;

  if not found then
    insert into public.profiles (user_id, email, name, avatar_color)
    values (
      new.id, lower(new.email), left(display_name, 80),
      (array['#34C759','#007AFF','#FF9500','#AF52DE','#FF2D55','#5AC8FA','#FFCC00','#5856D6'])[1 + floor(random() * 8)::int]
    );
  end if;
  return new;
end
$$;

drop trigger if exists on_auth_user_confirmed on auth.users;
create trigger on_auth_user_confirmed
  after update of email_confirmed_at on auth.users
  for each row when (old.email_confirmed_at is null and new.email_confirmed_at is not null)
  execute function public.handle_new_user();

-- ─── 2. Internal helpers aren't callable from the app ───────────────────────
-- expense_snapshot returns any expense's details without checking access; only other database functions
-- need it.
revoke execute on function public.expense_snapshot(uuid) from public, anon, authenticated;

-- ─── 3. Sensible size limits (stop huge strings being stored) ───────────────
-- NOT VALID: checked for every new or edited row, without re-checking what's already stored.
alter table public.profiles drop constraint if exists profiles_name_length;
alter table public.profiles add constraint profiles_name_length check (length(name) between 1 and 80) not valid;
alter table public.groups drop constraint if exists groups_name_length;
alter table public.groups drop constraint if exists groups_emoji_length;
alter table public.groups add constraint groups_name_length check (length(name) <= 80) not valid,
                          add constraint groups_emoji_length check (length(emoji) <= 16) not valid;
alter table public.expenses drop constraint if exists expenses_description_length;
alter table public.expenses drop constraint if exists expenses_notes_length;
alter table public.expenses drop constraint if exists expenses_currency_format;
alter table public.expenses drop constraint if exists expenses_category_length;
alter table public.expenses add constraint expenses_description_length check (length(description) <= 300) not valid,
                            add constraint expenses_notes_length check (notes is null or length(notes) <= 2000) not valid,
                            add constraint expenses_currency_format check (currency ~ '^[A-Z]{3}$') not valid,
                            add constraint expenses_category_length check (length(category) <= 40) not valid;
alter table public.comments drop constraint if exists comments_body_length;
alter table public.comments add constraint comments_body_length check (length(body) <= 2000) not valid;

-- ─── 4. Leaving groups and removing friends go through checked functions ────
-- The direct delete rules let people leave a group while they still owe money, or drop a friend without
-- the "settle up first" check in remove_friend().
drop policy if exists "leave group" on public.group_members;
drop policy if exists "remove own friendships" on public.friendships;

create or replace function public.leave_group(gid uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if not public.is_group_member(gid) then raise exception 'not a member of this group'; end if;
  if exists (select 1 from public.group_balances where group_id = gid and profile_id = me_id and balance <> 0) then
    raise exception 'settle up in this group before leaving it';
  end if;
  delete from public.group_members where group_id = gid and profile_id = me_id;
end
$$;

-- ─── 5. Editing an expense that was deleted meanwhile fails cleanly ──────────
create or replace function public.save_expense(payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me_id uuid := public.me();
  eid uuid := nullif(payload ->> 'id', '')::uuid;
  gid uuid := nullif(payload ->> 'group_id', '')::uuid;
  amt numeric(14, 2) := (payload ->> 'amount')::numeric;
  total_paid numeric; total_owed numeric;
  people uuid[];
  before jsonb;
  is_pay boolean := coalesce((payload ->> 'is_payment')::boolean, false);
  a uuid; b uuid;
begin
  if me_id is null then raise exception 'not signed in'; end if;
  if amt is null or amt <= 0 then raise exception 'amount must be positive'; end if;

  select coalesce(sum((s ->> 'paid')::numeric), 0), coalesce(sum((s ->> 'owed')::numeric), 0),
         array_agg(distinct (s ->> 'profile_id')::uuid)
    into total_paid, total_owed, people
  from jsonb_array_elements(payload -> 'shares') s;

  if people is null or array_length(people, 1) < 2 then raise exception 'an expense needs at least two people'; end if;
  if array_length(people, 1) > 200 then raise exception 'an expense can have at most 200 people'; end if;
  if abs(total_paid - amt) > 0.01 then raise exception 'paid amounts (%) must add up to %', total_paid, amt; end if;
  if abs(total_owed - amt) > 0.01 then raise exception 'owed amounts (%) must add up to %', total_owed, amt; end if;

  if gid is not null then
    if not public.is_group_member(gid) then raise exception 'not a member of this group'; end if;
    if exists (select 1 from unnest(people) p where not exists (
      select 1 from public.group_members where group_id = gid and profile_id = p)) then
      raise exception 'everyone in the expense must be in the group';
    end if;
  else
    if not (me_id = any (people)) then raise exception 'you must be part of a non-group expense'; end if;
    if exists (select 1 from unnest(people) p where p <> me_id and not public.can_see_profile(p)) then
      raise exception 'unknown person in expense';
    end if;
  end if;

  if eid is null then
    insert into public.expenses (group_id, description, amount, currency, category, split_type, is_payment, spent_on, notes, created_by)
    values (gid, trim(payload ->> 'description'), amt, coalesce(payload ->> 'currency', 'USD'),
            coalesce(payload ->> 'category', 'general'), coalesce(payload ->> 'split_type', 'equal'), is_pay,
            coalesce((payload ->> 'spent_on')::date, current_date), nullif(trim(payload ->> 'notes'), ''), me_id)
    returning id into eid;
  else
    if not public.can_see_expense(eid) then raise exception 'expense not found'; end if;
    before := public.expense_snapshot(eid);
    update public.expenses set
      group_id = gid, description = trim(payload ->> 'description'), amount = amt,
      currency = coalesce(payload ->> 'currency', currency), category = coalesce(payload ->> 'category', category),
      split_type = coalesce(payload ->> 'split_type', split_type), is_payment = is_pay,
      spent_on = coalesce((payload ->> 'spent_on')::date, spent_on), notes = nullif(trim(payload ->> 'notes'), ''),
      updated_at = now()
    where id = eid and deleted_at is null;
    if not found then raise exception 'this expense was deleted; restore it before editing'; end if;
    delete from public.expense_shares where expense_id = eid;
  end if;

  insert into public.expense_shares (expense_id, profile_id, paid, owed, split_value)
  select eid, (s ->> 'profile_id')::uuid, coalesce((s ->> 'paid')::numeric, 0), coalesce((s ->> 'owed')::numeric, 0),
         nullif(s ->> 'split_value', '')::numeric
  from jsonb_array_elements(payload -> 'shares') s
  where coalesce((s ->> 'paid')::numeric, 0) > 0 or coalesce((s ->> 'owed')::numeric, 0) > 0;

  -- people who share an expense become friends
  foreach a in array people loop
    foreach b in array people loop
      if a < b then perform public.befriend(a, b); end if;
    end loop;
  end loop;

  insert into public.activity (actor_id, kind, group_id, expense_id, involved, data)
  values (
    me_id,
    case when before is not null then 'expense_updated' when is_pay then 'payment_added' else 'expense_added' end,
    gid, eid,
    (select array_agg(distinct x) from unnest(
       people || coalesce((select array_agg(profile_id) from public.group_members where group_id = gid), '{}')
       || coalesce((select array_agg((s ->> 'profile_id')::uuid) from jsonb_array_elements(before -> 'shares') s), '{}')
     ) x),
    jsonb_build_object('after', public.expense_snapshot(eid)) || coalesce(jsonb_build_object('before', before), '{}')
  );
  return eid;
end
$$;

-- ─── 6. Contact matching can't be used to scan for numbers in bulk ─────────
create or replace function public.find_users_by_contacts(emails text[], phones text[])
returns table (id uuid, name text, email text, phone text, avatar text, avatar_color text)
language plpgsql stable security definer set search_path = public as $$
begin
  if public.me() is null then raise exception 'not signed in'; end if;
  if coalesce(cardinality(emails), 0) + coalesce(cardinality(phones), 0) > 3000 then
    raise exception 'too many contacts at once';
  end if;
  return query
    select p.id, p.name, p.email,
           case when p.phone_discoverable and p.phone = any (coalesce(phones, '{}')) then p.phone end,
           p.avatar, p.avatar_color
    from public.profiles p
    where p.user_id is not null
      and p.id <> public.me()
      and (lower(p.email) = any (select lower(e) from unnest(coalesce(emails, '{}')) e)
           or (p.phone_discoverable and p.phone = any (coalesce(phones, '{}'))))
    limit 500;
end
$$;

-- ─── 7. Notifications: give up after a few failed tries; no empty weekly emails ───
alter table public.notification_outbox add column if not exists attempts int not null default 0;

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
  ),
  rows as (
    select pe.id, pe.chans,
           coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', total)) from totals where pid = pe.id and total > 0), '[]') as owed,
           coalesce((select jsonb_agg(jsonb_build_object('currency', currency, 'amount', -total)) from totals where pid = pe.id and total < 0), '[]') as owe,
           (select count(*)::int from public.activity a
             where pe.id = any (a.involved) and a.actor_id is distinct from pe.id
               and a.kind in ('expense_added', 'payment_added') and a.created_at > now() - interval '7 days') as new_expenses
    from people pe
    where cardinality(pe.chans) > 0
  )
  -- only people with something to report
  select * from rows where owed <> '[]' or owe <> '[]' or new_expenses > 0
$$;

-- ─── Grants ──────────────────────────────────────────────────────────────────
revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;
revoke execute on function public.find_users_by_contacts(text[], text[]) from public, anon;
grant execute on function public.find_users_by_contacts(text[], text[]) to authenticated;
revoke execute on function public.weekly_summaries() from public, anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on function public.weekly_summaries() to service_role;
  end if;
end
$$;
