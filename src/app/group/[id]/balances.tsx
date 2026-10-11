import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { Avatar } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { useGroup, useGroupBalances, useGroupPairDebts, useMe, usePeople } from '@/lib/api';
import { firstName, groupDebts } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme';

export default function GroupBalances() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const g = useGroup(id).data;
  const balances = useGroupBalances(id).data ?? [];
  const pairs = useGroupPairDebts(id).data ?? [];
  const me = useMe().data;
  const { byId } = usePeople();

  const debts = g ? groupDebts(balances, pairs, g.simplify_debts) : [];

  return (
    <Page title="Balances" back variant="large">
      {g && (
        <>
          <ListGroup title="Members" animateIndex={0}>
            {g.group_members.map(({ profile_id }) => {
              const p = byId.get(profile_id);
              const rows = balances.filter((b) => b.profile_id === profile_id && Math.abs(Number(b.balance)) >= 0.005);
              return (
                <ListItem
                  key={profile_id}
                  left={<Avatar name={p?.name ?? '?'} color={p?.avatar_color ?? '#999'} />}
                  title={profile_id === me?.id ? `${p?.name ?? 'You'} (you)` : p?.name ?? '…'}
                  subtitle={
                    rows.length === 0 ? (
                      <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>
                        settled up
                      </Text>
                    ) : (
                      <View>
                        {rows.map((b) => {
                          const v = Number(b.balance);
                          return (
                            <Text key={b.currency} variant="bodyMedium" style={{ color: v > 0 ? t.colors.owed : t.colors.owe }}>
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
          </ListGroup>

          <ListGroup
            title={g.simplify_debts ? 'Suggested payments' : 'Who owes whom'}
            footer={g.simplify_debts ? 'Debts are simplified to the fewest payments. Change this in group settings.' : 'Debt simplification is off for this group.'}
            animateIndex={1}
          >
            {debts.length === 0 ? (
              <ListItem left={<Icon name="check-decagram" size={32} color={t.colors.owed} />} title="Everyone is settled up" />
            ) : (
              debts.map((d, i) => {
                const from = byId.get(d.from);
                const to = byId.get(d.to);
                return (
                  <ListItem
                    key={i}
                    left={<Avatar name={from?.name ?? '?'} color={from?.avatar_color ?? '#999'} />}
                    title={
                      <Text variant="bodyLarge" style={{ color: t.colors.onSurface }}>
                        <Text style={{ fontWeight: '700' }}>{firstName(from, me?.id)}</Text>
                        {d.from === me?.id ? ' owe ' : ' owes '}
                        <Text style={{ fontWeight: '700' }}>{firstName(to, me?.id).replace(/^You$/, 'you')}</Text>
                      </Text>
                    }
                    subtitle={
                      <Text
                        variant="titleSmall"
                        style={{ color: d.to === me?.id ? t.colors.owed : d.from === me?.id ? t.colors.owe : t.colors.onSurfaceVariant }}
                      >
                        {formatMoney(d.amount, d.currency)}
                      </Text>
                    }
                    right={
                      <Button
                        mode="contained-tonal"
                        compact
                        onPress={() =>
                          router.push({
                            pathname: '/settle-up',
                            params: { groupId: g.id, from: d.from, to: d.to, amount: String(d.amount), currency: d.currency },
                          })
                        }
                      >
                        Settle
                      </Button>
                    }
                  />
                );
              })
            )}
          </ListGroup>
        </>
      )}
    </Page>
  );
}
