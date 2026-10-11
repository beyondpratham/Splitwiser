import { router, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Row, Section } from '@/components/List';
import { Button, Screen } from '@/components/ui';
import { useGroup, useGroupBalances, useGroupPairDebts, useMe, usePeople } from '@/lib/api';
import { firstName, groupDebts } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { space, useTheme } from '@/theme';

export default function GroupBalances() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = useGroup(id).data;
  const balances = useGroupBalances(id).data ?? [];
  const pairs = useGroupPairDebts(id).data ?? [];
  const me = useMe().data;
  const { byId } = usePeople();
  if (!g) return null;

  const debts = groupDebts(balances, pairs, g.simplify_debts);

  return (
    <Screen>
      <Section title="Members">
        {g.group_members.map(({ profile_id }) => {
          const p = byId.get(profile_id);
          const rows = balances.filter((b) => b.profile_id === profile_id && Math.abs(Number(b.balance)) >= 0.005);
          return (
            <Row
              key={profile_id}
              left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} />}
              title={profile_id === me?.id ? `${p?.name ?? 'You'} (you)` : p?.name ?? '…'}
              subtitle={
                rows.length === 0 ? (
                  <Text style={{ color: t.secondary, fontSize: 14 }}>settled up</Text>
                ) : (
                  <View>
                    {rows.map((b) => {
                      const v = Number(b.balance);
                      return (
                        <Text key={b.currency} style={{ fontSize: 14, color: v > 0 ? t.owed : t.owe }}>
                          {v > 0 ? 'gets back ' : 'owes '}
                          {formatMoney(Math.abs(v), b.currency)}
                        </Text>
                      );
                    })}
                  </View>
                )
              }
            />
          );
        })}
      </Section>

      <Section
        title={g.simplify_debts ? 'Suggested payments' : 'Who owes whom'}
        footer={g.simplify_debts ? 'Debts are simplified to the fewest payments. Change this in group settings.' : 'Debt simplification is off for this group.'}
      >
        {debts.length === 0 ? (
          <Row left={<Icon name="checkmark.circle.fill" size={28} color={t.owed} />} title="Everyone is settled up" />
        ) : (
          debts.map((d, i) => {
            const from = byId.get(d.from);
            const to = byId.get(d.to);
            return (
              <Row
                key={i}
                left={<Avatar name={from?.name ?? '?'} color={from?.avatar_color ?? '#999'} size={36} />}
                title={
                  <Text style={{ fontSize: 16, color: t.text }}>
                    <Text style={{ fontWeight: '600' }}>{firstName(from, me?.id)}</Text>
                    {d.from === me?.id ? ' owe ' : ' owes '}
                    <Text style={{ fontWeight: '600' }}>{firstName(to, me?.id).replace(/^You$/, 'you')}</Text>
                  </Text>
                }
                subtitle={
                  <Text style={{ fontSize: 15, fontWeight: '600', color: d.to === me?.id ? t.owed : d.from === me?.id ? t.owe : t.secondary }}>
                    {formatMoney(d.amount, d.currency)}
                  </Text>
                }
                right={
                  <Button
                    title="Settle"
                    kind="tinted"
                    size="small"
                    onPress={() =>
                      router.push({
                        pathname: '/settle-up',
                        params: { groupId: g.id, from: d.from, to: d.to, amount: String(d.amount), currency: d.currency },
                      })
                    }
                  />
                }
              />
            );
          })
        )}
      </Section>
      <View style={{ height: space.xl }} />
    </Screen>
  );
}
