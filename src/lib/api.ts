import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';
import { useAuth } from './auth';
import { supabase } from './supabase';
import type {
  Activity,
  BalanceRow,
  Comment,
  Expense,
  Group,
  GroupBalanceRow,
  PairDebt,
  Profile,
  SaveExpensePayload,
} from './types';

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

const EXPENSE_SELECT = '*, expense_shares(*)';

// ─── Queries ────────────────────────────────────────────────────────────────

export function useMe() {
  const { session } = useAuth();
  const uid = session?.user.id;
  return useQuery({
    queryKey: ['me', uid],
    enabled: !!uid,
    queryFn: () => unwrap<Profile>(supabase.from('profiles').select('*').eq('user_id', uid!).single()),
  });
}

/** Every profile I'm allowed to see, keyed by id. */
export function usePeople() {
  const q = useQuery({
    queryKey: ['profiles'],
    queryFn: () => unwrap<Profile[]>(supabase.from('profiles').select('*')),
  });
  const byId = useMemo(() => new Map((q.data ?? []).map((p) => [p.id, p])), [q.data]);
  return { ...q, byId };
}

export function useFriends() {
  const me = useMe().data;
  const { byId } = usePeople();
  const q = useQuery({
    queryKey: ['friends', me?.id],
    enabled: !!me,
    queryFn: async () =>
      (await unwrap<{ friend_id: string }[]>(supabase.from('friendships').select('friend_id').eq('profile_id', me!.id))).map(
        (f) => f.friend_id,
      ),
  });
  const friends = useMemo(
    () =>
      (q.data ?? [])
        .map((id) => byId.get(id))
        .filter((p): p is Profile => !!p)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [q.data, byId],
  );
  return { ...q, friends };
}

export type GroupWithMembers = Group & { group_members: { profile_id: string }[] };

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () =>
      unwrap<GroupWithMembers[]>(
        supabase.from('groups').select('*, group_members(profile_id)').order('created_at', { ascending: false }),
      ),
  });
}

export function useGroup(id: string | undefined) {
  const groups = useGroups();
  return { ...groups, data: groups.data?.find((g) => g.id === id) };
}

export function useMyBalances() {
  return useQuery({
    queryKey: ['balances'],
    queryFn: () => unwrap<BalanceRow[]>(supabase.from('my_balances').select('*')),
  });
}

export function useGroupBalances(groupId: string | undefined) {
  return useQuery({
    queryKey: ['group-balances', groupId],
    enabled: !!groupId,
    queryFn: () => unwrap<GroupBalanceRow[]>(supabase.from('group_balances').select('*').eq('group_id', groupId!)),
  });
}

export function useGroupPairDebts(groupId: string | undefined) {
  return useQuery({
    queryKey: ['pair-debts', groupId],
    enabled: !!groupId,
    queryFn: () => unwrap<PairDebt[]>(supabase.from('pair_debts').select('*').eq('group_id', groupId!)),
  });
}

export function useGroupExpenses(groupId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', 'group', groupId],
    enabled: !!groupId,
    queryFn: () =>
      unwrap<Expense[]>(
        supabase
          .from('expenses')
          .select(EXPENSE_SELECT)
          .eq('group_id', groupId!)
          .is('deleted_at', null)
          .order('spent_on', { ascending: false })
          .order('created_at', { ascending: false }),
      ),
  });
}

/** Every expense (any group) shared between me and a friend. */
export function useFriendExpenses(friendId: string | undefined) {
  const me = useMe().data;
  return useQuery({
    queryKey: ['expenses', 'friend', friendId, me?.id],
    enabled: !!friendId && !!me,
    queryFn: async () => {
      const ids = await unwrap<{ expense_id: string }[]>(
        supabase.from('expense_shares').select('expense_id').eq('profile_id', friendId!),
      );
      if (!ids.length) return [];
      const expenses = await unwrap<Expense[]>(
        supabase
          .from('expenses')
          .select(EXPENSE_SELECT)
          .in('id', ids.map((r) => r.expense_id))
          .is('deleted_at', null)
          .order('spent_on', { ascending: false })
          .order('created_at', { ascending: false }),
      );
      return expenses.filter((e) => e.expense_shares.some((s) => s.profile_id === me!.id));
    },
  });
}

/** All non-deleted expenses I'm part of — used for insights. */
export function useMyExpenses() {
  const me = useMe().data;
  return useQuery({
    queryKey: ['expenses', 'mine', me?.id],
    enabled: !!me,
    queryFn: async () => {
      const ids = await unwrap<{ expense_id: string }[]>(
        supabase.from('expense_shares').select('expense_id').eq('profile_id', me!.id),
      );
      if (!ids.length) return [];
      return unwrap<Expense[]>(
        supabase
          .from('expenses')
          .select(EXPENSE_SELECT)
          .in('id', ids.map((r) => r.expense_id))
          .is('deleted_at', null)
          .order('spent_on', { ascending: false }),
      );
    },
  });
}

export function useExpense(id: string | undefined) {
  return useQuery({
    queryKey: ['expense', id],
    enabled: !!id,
    queryFn: () => unwrap<Expense>(supabase.from('expenses').select(EXPENSE_SELECT).eq('id', id!).single()),
  });
}

export function useComments(expenseId: string | undefined) {
  return useQuery({
    queryKey: ['comments', expenseId],
    enabled: !!expenseId,
    queryFn: () =>
      unwrap<Comment[]>(
        supabase.from('comments').select('*').eq('expense_id', expenseId!).order('created_at', { ascending: true }),
      ),
  });
}

export function useExpenseHistory(expenseId: string | undefined) {
  return useQuery({
    queryKey: ['history', expenseId],
    enabled: !!expenseId,
    queryFn: () =>
      unwrap<Activity[]>(
        supabase
          .from('activity')
          .select('*')
          .eq('expense_id', expenseId!)
          .neq('kind', 'comment_added')
          .order('created_at', { ascending: true }),
      ),
  });
}

export function useActivity() {
  return useQuery({
    queryKey: ['activity'],
    queryFn: () =>
      unwrap<Activity[]>(supabase.from('activity').select('*').order('created_at', { ascending: false }).limit(150)),
  });
}

/** Refetch everything whenever something relevant to me happens (another device or a friend). */
export function useRealtimeSync() {
  const qc = useQueryClient();
  const me = useMe().data;
  useEffect(() => {
    if (!me) return;
    const channel = supabase
      .channel('activity-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity' }, () => qc.invalidateQueries())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [me, qc]);
}

// ─── Mutations ──────────────────────────────────────────────────────────────

function useAction<TArgs, TResult>(fn: (args: TArgs) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}

export const useSaveExpense = () =>
  useAction((payload: SaveExpensePayload) => unwrap<string>(supabase.rpc('save_expense', { payload })));

export const useDeleteExpense = () =>
  useAction((eid: string) => unwrap<null>(supabase.rpc('delete_expense', { eid })));

export const useRestoreExpense = () =>
  useAction((eid: string) => unwrap<null>(supabase.rpc('restore_expense', { eid })));

export const useAddComment = () =>
  useAction(({ expenseId, body }: { expenseId: string; body: string }) =>
    unwrap<string>(supabase.rpc('add_comment', { eid: expenseId, comment_body: body })),
  );

export const useDeleteComment = () =>
  useAction((id: string) => unwrap<null>(supabase.from('comments').delete().eq('id', id)));

export const useAddFriend = () =>
  useAction(({ email, name }: { email: string; name?: string }) =>
    unwrap<string>(supabase.rpc('add_friend', { friend_email: email, friend_name: name ?? null })),
  );

export const useCreateGroup = () =>
  useAction((g: { name: string; emoji: string; kind: string; currency: string; memberIds: string[] }) =>
    unwrap<string>(
      supabase.rpc('create_group', {
        group_name: g.name,
        group_emoji: g.emoji,
        group_kind: g.kind,
        currency: g.currency,
        member_ids: g.memberIds,
      }),
    ),
  );

export const useAddGroupMember = () =>
  useAction(({ groupId, profileId }: { groupId: string; profileId: string }) =>
    unwrap<null>(supabase.rpc('add_group_member', { gid: groupId, member_id: profileId })),
  );

export const useUpdateGroup = () =>
  useAction(({ id, ...patch }: Partial<Group> & { id: string }) =>
    unwrap<null>(supabase.from('groups').update(patch).eq('id', id)),
  );

export const useLeaveGroup = () =>
  useAction(({ groupId, profileId }: { groupId: string; profileId: string }) =>
    unwrap<null>(supabase.from('group_members').delete().eq('group_id', groupId).eq('profile_id', profileId)),
  );

export const useDeleteGroup = () =>
  useAction((id: string) => unwrap<null>(supabase.from('groups').delete().eq('id', id)));

export const useUpdateProfile = () =>
  useAction(({ id, ...patch }: Partial<Pick<Profile, 'name' | 'avatar_color' | 'default_currency'>> & { id: string }) =>
    unwrap<null>(supabase.from('profiles').update(patch).eq('id', id)),
  );
