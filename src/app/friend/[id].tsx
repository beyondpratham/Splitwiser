import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { ExpenseList } from '@/components/ExpenseList';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { EmptyState, Loading } from '@/components/ui';
import { useFriendExpenses, useGroups, useMe, useMyBalances, usePeople } from '@/lib/api';
import { entries, summarizeBalances } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { space, useTheme } from '@/theme';

export default function FriendScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe().data;
  const { byId, isLoading } = usePeople();
  const friend = byId.get(id);
  const expenses = useFriendExpenses(id);
  const balances = useMyBalances();
  const groupsData = useGroups().data;
  const summary = summarizeBalances(balances.data ?? []);
  const total = entries(summary.byFriend.get(id));
  const perGroup = summary.byFriendGroup.get(id);
  const groupNames = useMemo(() => new Map((groupsData ?? []).map((g) => [g.id, g.name])), [groupsData]);

  if (!friend) return isLoading ? <Loading /> : <EmptyState icon="account" title="Friend not found" />;
  const first = friend.name.split(' ')[0];

  return (
    <Page
      title={friend.name}
      variant="hero"
      back
      fab={{ label: 'Add expense', icon: 'plus', onPress: () => router.push({ pathname: '/add-expense', params: { friendId: id } }) }}
      refreshing={expenses.isRefetching}
      onRefresh={() => {
        expenses.refetch();
        balances.refetch();
      }}
    >
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Avatar name={friend.name} color={friend.avatar_color} size={88} />
        </Animated.View>
        <Text variant="headlineMedium" style={{ color: t.colors.onSurface, marginTop: space.md }}>
          {friend.name}
        </Text>
        <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>
          {friend.email}
          {!friend.user_id && ' · hasn’t joined yet'}
        </Text>
        <Animated.View entering={FadeInDown.delay(80).springify()} style={{ marginTop: space.md, alignItems: 'center', gap: 2 }}>
          {total.length === 0 ? (
            <Text variant="titleMedium" style={{ color: t.colors.onSurfaceVariant }}>
              You are settled up
            </Text>
          ) : (
            total.map(([c, v]) => (
              <Text key={c} variant="titleMedium" style={{ color: v > 0 ? t.colors.owed : t.colors.owe }}>
                {v > 0 ? `${first} owes you ` : `You owe ${first} `}
                <Text style={{ fontWeight: '700' }}>{formatMoney(Math.abs(v), c)}</Text>
              </Text>
            ))
          )}
        </Animated.View>
      </View>

      <View style={styles.actions}>
        <Button
          mode="contained"
          icon="cash-fast"
          disabled={total.length === 0}
          style={{ flex: 1 }}
          contentStyle={{ height: 48 }}
          onPress={() => {
            const [c, v] = total[0];
            router.push({
              pathname: '/settle-up',
              params: { from: v > 0 ? id : me!.id, to: v > 0 ? me!.id : id, amount: String(Math.abs(v)), currency: c },
            });
          }}
        >
          Settle up
        </Button>
      </View>

      {perGroup && perGroup.size > 1 && (
        <ListGroup title="Breakdown" animateIndex={1}>
          {[...perGroup.entries()].map(([gid, map]) => (
            <ListItem
              key={gid ?? 'none'}
              title={gid ? groupNames.get(gid) ?? 'Group' : 'Non-group expenses'}
              subtitle={
                <Text variant="bodyMedium">
                  {entries(map).map(([c, v]) => (
                    <Text key={c} style={{ color: v > 0 ? t.colors.owed : t.colors.owe }}>
                      {v > 0 ? 'owes you ' : 'you owe '}
                      {formatMoney(Math.abs(v), c)}{' '}
                    </Text>
                  ))}
                </Text>
              }
              chevron={!!gid}
              onPress={gid ? () => router.push({ pathname: '/group/[id]', params: { id: gid } }) : undefined}
            />
          ))}
        </ListGroup>
      )}

      {expenses.data && expenses.data.length === 0 ? (
        <EmptyState icon="creation" title="No shared expenses" message={`Add an expense with ${first} to get started.`} />
      ) : (
        <ExpenseList expenses={expenses.data ?? []} people={byId} meId={me?.id} groupNames={groupNames} />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 2, paddingHorizontal: space.xl, marginBottom: space.xl },
  actions: { flexDirection: 'row', paddingHorizontal: space.lg, marginBottom: space.xl },
});
