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
