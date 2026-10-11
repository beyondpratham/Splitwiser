import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EmojiTile } from '@/components/Avatar';
import { ExpenseList } from '@/components/ExpenseList';
import { Icon, type SF } from '@/components/Icon';
import { EmptyState, FloatingButton, HeaderButton, Loading, Screen } from '@/components/ui';
import { useGroup, useGroupBalances, useGroupExpenses, useGroupPairDebts, useMe, usePeople } from '@/lib/api';
import { firstName, groupDebts } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { space, useTheme } from '@/theme';

export default function GroupScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const group = useGroup(id);
  const expenses = useGroupExpenses(id);
  const balances = useGroupBalances(id);
  const pairs = useGroupPairDebts(id);
  const me = useMe().data;
  const { byId } = usePeople();

  if (!group.data) return group.isLoading ? <Loading /> : <EmptyState icon="person.3.fill" title="Group not found" />;
  const g = group.data;

  const debts = groupDebts(balances.data ?? [], pairs.data ?? [], g.simplify_debts);
  const mine = debts.filter((d) => d.from === me?.id || d.to === me?.id);
  const others = debts.length - mine.length;

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: g.name,
          headerRight: () => (
            <HeaderButton icon="gearshape" onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id: g.id } })} />
          ),
        }}
      />
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={expenses.isRefetching}
            onRefresh={() => {
              expenses.refetch();
              balances.refetch();
              pairs.refetch();
            }}
          />
        }
      >
        <View style={styles.hero}>
          <EmojiTile emoji={g.emoji} size={72} tint={t.card} />
          <Text style={[styles.name, { color: t.text }]}>{g.name}</Text>
          <Text style={{ color: t.secondary, fontSize: 14 }}>
            {g.group_members.map((m) => firstName(byId.get(m.profile_id), me?.id)).join(', ')}
          </Text>
        </View>

        <View style={styles.summary}>
          {mine.length === 0 ? (
            <Text style={[styles.summaryLine, { color: t.secondary }]}>
              {expenses.data?.length ? 'You are all settled up in this group.' : 'No expenses yet.'}
            </Text>
          ) : (
            mine.map((d, i) => {
              const owedToMe = d.to === me?.id;
              const other = byId.get(owedToMe ? d.from : d.to);
              return (
                <Text key={i} style={[styles.summaryLine, { color: owedToMe ? t.owed : t.owe }]}>
                  {owedToMe ? `${firstName(other)} owes you ` : `You owe ${firstName(other)} `}
                  <Text style={{ fontWeight: '700' }}>{formatMoney(d.amount, d.currency)}</Text>
                </Text>
              );
            })
          )}
          {others > 0 && (
            <Text style={[styles.summaryLine, { color: t.secondary, fontSize: 14 }]}>
              + {others} other {others === 1 ? 'balance' : 'balances'} between members
            </Text>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
          <Action icon="banknote.fill" label="Settle up" primary onPress={() => router.push({ pathname: '/settle-up', params: { groupId: g.id } })} />
          <Action icon="arrow.left.arrow.right" label="Balances" onPress={() => router.push({ pathname: '/group/[id]/balances', params: { id: g.id } })} />
          <Action icon="chart.pie.fill" label="Totals" onPress={() => router.push({ pathname: '/insights', params: { groupId: g.id } })} />
          <Action icon="person.badge.plus" label="Add people" onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id: g.id } })} />
        </ScrollView>

        {expenses.data && expenses.data.length === 0 ? (
          <EmptyState icon="sparkles" title="Fresh start" message="Add the first expense and SplitWiser will keep track of who owes what." />
        ) : (
          <ExpenseList expenses={expenses.data ?? []} people={byId} meId={me?.id} />
        )}
      </Screen>
      <FloatingButton title="Add expense" onPress={() => router.push({ pathname: '/add-expense', params: { groupId: g.id } })} />
    </View>
  );
}

function Action({ icon, label, onPress, primary }: { icon: SF; label: string; onPress: () => void; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.action, { backgroundColor: primary ? t.accent : t.card, opacity: pressed ? 0.7 : 1 }]}
    >
      <Icon name={icon} size={16} color={primary ? t.onAccent : t.accent} />
      <Text style={{ color: primary ? t.onAccent : t.text, fontWeight: '600', fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 6, paddingHorizontal: space.xl, marginBottom: space.lg },
  name: { fontSize: 28, fontWeight: '700', marginTop: space.sm, textAlign: 'center' },
  summary: { alignItems: 'center', gap: 4, paddingHorizontal: space.xl, marginBottom: space.lg },
  summaryLine: { fontSize: 16, textAlign: 'center' },
  actions: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xl },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, height: 40, borderRadius: 20, borderCurve: 'continuous' },
});
