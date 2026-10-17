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
