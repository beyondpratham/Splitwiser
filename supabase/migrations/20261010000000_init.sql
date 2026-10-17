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
