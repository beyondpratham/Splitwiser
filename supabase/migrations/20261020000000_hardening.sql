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
alter table public.profiles add constraint profiles_name_length check (length(name) between 1 and 80) not valid;
alter table public.groups add constraint groups_name_length check (length(name) <= 80) not valid,
                          add constraint groups_emoji_length check (length(emoji) <= 16) not valid;
alter table public.expenses add constraint expenses_description_length check (length(description) <= 300) not valid,
                            add constraint expenses_notes_length check (notes is null or length(notes) <= 2000) not valid,
                            add constraint expenses_currency_format check (currency ~ '^[A-Z]{3}$') not valid,
                            add constraint expenses_category_length check (length(category) <= 40) not valid;
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
alter table public.notification_outbox add column attempts int not null default 0;

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
