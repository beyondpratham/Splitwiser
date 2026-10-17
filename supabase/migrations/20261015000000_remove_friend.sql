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
