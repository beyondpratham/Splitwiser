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
