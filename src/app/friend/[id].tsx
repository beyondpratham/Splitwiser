import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { ExpenseList } from '@/components/ExpenseList';
import { Row, Section } from '@/components/List';
import { Button, EmptyState, FloatingButton, Loading, Screen } from '@/components/ui';
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

  if (!friend) return isLoading ? <Loading /> : <EmptyState icon="person.fill" title="Friend not found" />;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ title: friend.name }} />
      <Screen refreshControl={<RefreshControl refreshing={expenses.isRefetching} onRefresh={() => { expenses.refetch(); balances.refetch(); }} />}>
        <View style={styles.hero}>
          <Avatar name={friend.name} color={friend.avatar_color} size={80} />
          <Text style={[styles.name, { color: t.text }]}>{friend.name}</Text>
          <Text style={{ color: t.secondary, fontSize: 14 }}>
            {friend.email}
            {!friend.user_id && ' · hasn’t joined yet'}
          </Text>
          <View style={{ marginTop: space.md, alignItems: 'center', gap: 2 }}>
            {total.length === 0 ? (
              <Text style={[styles.balance, { color: t.secondary }]}>You are settled up</Text>
            ) : (
              total.map(([c, v]) => (
                <Text key={c} style={[styles.balance, { color: v > 0 ? t.owed : t.owe }]}>
                  {v > 0 ? `${friend.name.split(' ')[0]} owes you ` : `You owe ${friend.name.split(' ')[0]} `}
                  <Text style={{ fontWeight: '700' }}>{formatMoney(Math.abs(v), c)}</Text>
                </Text>
              ))
            )}
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            title="Settle up"
            icon="banknote.fill"
            disabled={total.length === 0}
            style={{ flex: 1 }}
            onPress={() => {
              const [c, v] = total[0];
              router.push({
                pathname: '/settle-up',
                params: { from: v > 0 ? id : me!.id, to: v > 0 ? me!.id : id, amount: String(Math.abs(v)), currency: c },
              });
            }}
          />
        </View>

        {perGroup && perGroup.size > 1 && (
          <Section title="Breakdown">
            {[...perGroup.entries()].map(([gid, map]) => (
              <Row
                key={gid ?? 'none'}
                title={gid ? groupNames.get(gid) ?? 'Group' : 'Non-group expenses'}
                subtitle={
                  <Text style={{ fontSize: 14 }}>
                    {entries(map).map(([c, v]) => (
                      <Text key={c} style={{ color: v > 0 ? t.owed : t.owe }}>
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
          </Section>
        )}

        {expenses.data && expenses.data.length === 0 ? (
          <EmptyState icon="sparkles" title="No shared expenses" message={`Add an expense with ${friend.name.split(' ')[0]} to get started.`} />
        ) : (
          <ExpenseList expenses={expenses.data ?? []} people={byId} meId={me?.id} groupNames={groupNames} />
        )}
      </Screen>
      <FloatingButton title="Add expense" onPress={() => router.push({ pathname: '/add-expense', params: { friendId: id } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 4, paddingHorizontal: space.xl, marginBottom: space.xl },
  name: { fontSize: 26, fontWeight: '700', marginTop: space.md },
  balance: { fontSize: 17 },
  actions: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, marginBottom: space.xl },
});
