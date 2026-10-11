import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { EmojiTile } from '@/components/Avatar';
import { ExpenseList } from '@/components/ExpenseList';
import { Page } from '@/components/Page';
import { EmptyState, Loading } from '@/components/ui';
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

  if (!group.data) return group.isLoading ? <Loading /> : <EmptyState icon="account-group" title="Group not found" />;
  const g = group.data;

  const debts = groupDebts(balances.data ?? [], pairs.data ?? [], g.simplify_debts);
  const mine = debts.filter((d) => d.from === me?.id || d.to === me?.id);
  const others = debts.length - mine.length;

  return (
    <Page
      title={g.name}
      variant="hero"
      back
      actions={[{ icon: 'cog-outline', label: 'Group settings', onPress: () => router.push({ pathname: '/group/[id]/settings', params: { id: g.id } }) }]}
      fab={{ label: 'Add expense', icon: 'plus', onPress: () => router.push({ pathname: '/add-expense', params: { groupId: g.id } }) }}
      refreshing={expenses.isRefetching}
      onRefresh={() => {
        expenses.refetch();
        balances.refetch();
        pairs.refetch();
      }}
    >
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <EmojiTile emoji={g.emoji} size={88} />
        </Animated.View>
        <Text variant="headlineMedium" style={{ color: t.colors.onSurface, textAlign: 'center', marginTop: space.md }}>
          {g.name}
        </Text>
        <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>
          {g.group_members.map((m) => firstName(byId.get(m.profile_id), me?.id)).join(', ')}
        </Text>
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.summary}>
        {mine.length === 0 ? (
          <Text variant="bodyLarge" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>
            {expenses.data?.length ? 'You are all settled up in this group.' : 'No expenses yet.'}
          </Text>
        ) : (
          mine.map((d, i) => {
            const owedToMe = d.to === me?.id;
            const other = byId.get(owedToMe ? d.from : d.to);
            return (
              <Text key={i} variant="bodyLarge" style={{ color: owedToMe ? t.colors.owed : t.colors.owe, textAlign: 'center' }}>
                {owedToMe ? `${firstName(other)} owes you ` : `You owe ${firstName(other)} `}
                <Text style={{ fontWeight: '700' }}>{formatMoney(d.amount, d.currency)}</Text>
              </Text>
            );
          })
        )}
        {others > 0 && (
          <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant, textAlign: 'center' }}>
            + {others} other {others === 1 ? 'balance' : 'balances'} between members
          </Text>
        )}
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
        <Button mode="contained" icon="cash-fast" onPress={() => router.push({ pathname: '/settle-up', params: { groupId: g.id } })}>
          Settle up
        </Button>
        <Button mode="contained-tonal" icon="scale-balance" onPress={() => router.push({ pathname: '/group/[id]/balances', params: { id: g.id } })}>
          Balances
        </Button>
        <Button mode="contained-tonal" icon="chart-donut" onPress={() => router.push({ pathname: '/insights', params: { groupId: g.id } })}>
          Totals
        </Button>
        <Button mode="contained-tonal" icon="account-plus" onPress={() => router.push({ pathname: '/group/[id]/settings', params: { id: g.id } })}>
          Add people
        </Button>
      </ScrollView>

      {expenses.data && expenses.data.length === 0 ? (
        <EmptyState icon="creation" title="Fresh start" message="Add the first expense and SplitWiser will keep track of who owes what." />
      ) : (
        <ExpenseList expenses={expenses.data ?? []} people={byId} meId={me?.id} />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: space.xl, marginBottom: space.lg, gap: 2 },
  summary: { alignItems: 'center', gap: 4, paddingHorizontal: space.xl, marginBottom: space.lg },
  actions: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xl },
});
