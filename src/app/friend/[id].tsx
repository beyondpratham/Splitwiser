import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Controls';
import { ExpenseList } from '@/components/ExpenseList';
import { useFeedback } from '@/components/Feedback';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { EmptyState, Loading } from '@/components/ui';
import { useFriendExpenses, useGroups, useMe, useMyBalances, usePeople, useRemoveFriend } from '@/lib/api';
import { entries, summarizeBalances } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { space } from '@/theme';

export default function FriendScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  const { byId, isLoading } = usePeople();
  const friend = byId.get(id);
  const expenses = useFriendExpenses(id);
  const balances = useMyBalances();
  const groupsData = useGroups().data;
  const removeFriend = useRemoveFriend();
  const { confirm, toast, fail } = useFeedback();
  const summary = summarizeBalances(balances.data ?? []);
  const total = entries(summary.byFriend.get(id));
  const perGroup = summary.byFriendGroup.get(id);
  const groupNames = useMemo(() => new Map((groupsData ?? []).map((g) => [g.id, g.name])), [groupsData]);

  if (!friend) return isLoading ? <Loading /> : <EmptyState icon="account-question-outline" title="Friend not found" />;
  const first = friend.name.split(' ')[0];
  const theyOwe = total.filter(([, v]) => v > 0);

  const remind = async () => {
    const amounts = theyOwe.map(([c, v]) => formatMoney(v, c)).join(' and ');
    const message = `Hi ${first}! Friendly reminder from SplitWiser: you owe me ${amounts}. Thanks! 🙂`;
    try {
      await Share.share({ message });
    } catch {
      toast('Sharing isn’t available here.');
    }
  };

  return (
    <Page
      title={friend.name}
      variant="hero"
      back
      menu={[
        {
          label: 'Remove friend',
          icon: 'account-remove-outline',
          destructive: true,
          onPress: async () => {
            if (!(await confirm({ title: `Remove ${first}?`, message: 'You can add them again any time by email.', confirmLabel: 'Remove', destructive: true }))) return;
            removeFriend
              .mutateAsync(id)
              .then(() => {
                toast(`${first} removed`);
                router.back();
              })
              .catch(fail);
          },
        },
      ]}
      fab={{ label: 'Add expense', icon: 'plus', onPress: () => router.push({ pathname: '/add-expense', params: { friendId: id } }) }}
      refreshing={expenses.isRefetching}
      onRefresh={() => {
        expenses.refetch();
        balances.refetch();
      }}
    >
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Avatar name={friend.name} color={friend.avatar_color} avatar={friend.avatar} size={92} />
        </Animated.View>
        <T variant="title" style={{ marginTop: space.md, textAlign: 'center' }}>
          {friend.name}
        </T>
        <T variant="caption" tone="dim">
          {friend.email}
          {!friend.user_id && ' · hasn’t joined yet'}
        </T>
        <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginTop: space.md, alignItems: 'center', gap: 2 }}>
          {total.length === 0 ? (
            <T variant="subhead" tone="dim">
              You are settled up
            </T>
          ) : (
            total.map(([c, v]) => (
              <T key={c} variant="subhead" tone={v > 0 ? 'owed' : 'owe'}>
                {v > 0 ? `${first} owes you ` : `You owe ${first} `}
                <T variant="subhead" tone={v > 0 ? 'owed' : 'owe'} numeric style={{ fontFamily: 'Inter_700Bold' }}>
                  {formatMoney(Math.abs(v), c)}
                </T>
              </T>
            ))
          )}
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <Button
          title="Settle up"
          icon="cash-check"
          disabled={total.length === 0}
          style={{ flex: 1 }}
          onPress={() => {
            const [c, v] = total[0];
            router.push({ pathname: '/settle-up', params: { from: v > 0 ? id : me!.id, to: v > 0 ? me!.id : id, amount: String(Math.abs(v)), currency: c } });
          }}
        />
        <Button title="Remind" icon="bell-ring-outline" variant="glass" disabled={theyOwe.length === 0} style={{ flex: 1 }} onPress={remind} />
      </View>

      {perGroup && perGroup.size > 1 && (
        <ListGroup title="Balances by group" animateIndex={1}>
          {[...perGroup.entries()].map(([gid, map]) => (
            <ListItem
              key={gid ?? 'none'}
              title={gid ? groupNames.get(gid) ?? 'Group' : 'Non-group expenses'}
              subtitle={entries(map)
                .map(([c, v]) => `${v > 0 ? 'owes you' : 'you owe'} ${formatMoney(Math.abs(v), c)}`)
                .join(' · ')}
              chevron={!!gid}
              onPress={gid ? () => router.push({ pathname: '/group/[id]', params: { id: gid } }) : undefined}
            />
          ))}
        </ListGroup>
      )}

      {expenses.data && expenses.data.length === 0 ? (
        <EmptyState icon="receipt-text-outline" title="No shared expenses" message={`Add an expense with ${first} to get started.`} />
      ) : (
        <ExpenseList expenses={expenses.data ?? []} people={byId} meId={me?.id} groupNames={groupNames} />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 2, paddingHorizontal: space.xl, marginBottom: space.xl },
  actions: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, marginBottom: space.xl },
});
