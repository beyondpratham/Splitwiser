import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { Avatar, EmojiTile } from '@/components/Avatar';
import { Button } from '@/components/Controls';
import { ExpenseList } from '@/components/ExpenseList';
import { useFeedback } from '@/components/Feedback';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
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
  const { toast } = useFeedback();

  if (!group.data) return group.isLoading ? <Loading /> : <EmptyState icon="account-group-outline" title="Group not found" />;
  const g = group.data;

  const debts = groupDebts(balances.data ?? [], pairs.data ?? [], g.simplify_debts);
  const mine = debts.filter((d) => d.from === me?.id || d.to === me?.id);
  const others = debts.length - mine.length;

  const share = async () => {
    const lines = debts.length
      ? debts.map((d) => `• ${firstName(byId.get(d.from))} owes ${firstName(byId.get(d.to))} ${formatMoney(d.amount, d.currency)}`).join('\n')
      : 'Everyone is settled up 🎉';
    try {
      await Share.share({ message: `${g.emoji} ${g.name} — balances\n${lines}\n\nSent from SplitWiser` });
    } catch {
      toast('Sharing isn’t available here.');
    }
  };

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
          <EmojiTile emoji={g.emoji} size={92} />
        </Animated.View>
        <T variant="title" style={{ textAlign: 'center', marginTop: space.md }}>
          {g.name}
        </T>
        <View style={styles.members}>
          {g.group_members.slice(0, 6).map((m, i) => {
            const p = byId.get(m.profile_id);
            return (
              <View key={m.profile_id} style={{ marginLeft: i ? -10 : 0, borderRadius: 16, borderWidth: 2, borderColor: t.bg }}>
                <Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} avatar={p?.avatar} size={28} />
              </View>
            );
          })}
          <T variant="caption" tone="dim" style={{ marginLeft: space.sm }}>
            {g.group_members.length} {g.group_members.length === 1 ? 'person' : 'people'}
          </T>
        </View>
      </View>

      <Animated.View entering={FadeInDown.delay(80).springify()} style={styles.summary}>
        {mine.length === 0 ? (
          <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
            {expenses.data?.length ? 'You are all settled up in this group.' : 'No expenses yet.'}
          </T>
        ) : (
          mine.map((d, i) => {
            const owedToMe = d.to === me?.id;
            const other = byId.get(owedToMe ? d.from : d.to);
            return (
              <T key={i} variant="subhead" tone={owedToMe ? 'owed' : 'owe'} style={{ textAlign: 'center' }}>
                {owedToMe ? `${firstName(other)} owes you ` : `You owe ${firstName(other)} `}
                <T variant="subhead" tone={owedToMe ? 'owed' : 'owe'} numeric style={{ fontFamily: 'Inter_700Bold' }}>
                  {formatMoney(d.amount, d.currency)}
                </T>
              </T>
            );
          })
        )}
        {others > 0 && (
          <T variant="caption" tone="dim" style={{ textAlign: 'center' }}>
            + {others} other {others === 1 ? 'balance' : 'balances'} between members
          </T>
        )}
      </Animated.View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions}>
        <Button title="Settle up" icon="cash-check" size="sm" onPress={() => router.push({ pathname: '/settle-up', params: { groupId: g.id } })} />
        <Button title="Balances" icon="scale-balance" size="sm" variant="glass" onPress={() => router.push({ pathname: '/group/[id]/balances', params: { id: g.id } })} />
        <Button title="Totals" icon="chart-donut" size="sm" variant="glass" onPress={() => router.push({ pathname: '/insights', params: { groupId: g.id } })} />
        <Button title="Share" icon="export-variant" size="sm" variant="glass" onPress={share} />
      </ScrollView>

      {expenses.data && expenses.data.length === 0 ? (
        <EmptyState icon="receipt-text-outline" title="Fresh start" message="Add the first expense and SplitWiser keeps track of who owes what." />
      ) : (
        <ExpenseList expenses={expenses.data ?? []} people={byId} meId={me?.id} />
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingHorizontal: space.xl, marginBottom: space.lg, gap: 4 },
  members: { flexDirection: 'row', alignItems: 'center', marginTop: space.sm },
  summary: { alignItems: 'center', gap: 4, paddingHorizontal: space.xl, marginBottom: space.lg },
  actions: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.xs },
});
