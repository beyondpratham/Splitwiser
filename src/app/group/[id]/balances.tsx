import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Controls';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
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
                      'settled up'
                    ) : (
                      <View>
                        {rows.map((b) => {
                          const v = Number(b.balance);
                          return (
                            <T key={b.currency} variant="caption" tone={v > 0 ? 'owed' : 'owe'}>
                              {v > 0 ? 'gets back ' : 'owes '}
                              {formatMoney(Math.abs(v), b.currency)}
                            </T>
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
              <ListItem left={<Icon name="check-decagram" size={30} color={t.accent} />} title="Everyone is settled up" />
            ) : (
              debts.map((d, i) => {
                const from = byId.get(d.from);
                const to = byId.get(d.to);
                return (
                  <ListItem
                    key={i}
                    left={<Avatar name={from?.name ?? '?'} color={from?.avatar_color ?? '#999'} />}
                    title={`${firstName(from, me?.id)} ${d.from === me?.id ? 'owe' : 'owes'} ${firstName(to, me?.id).replace(/^You$/, 'you')}`}
                    subtitle={
                      <T variant="label" numeric tone={d.to === me?.id ? 'owed' : d.from === me?.id ? 'owe' : 'dim'}>
                        {formatMoney(d.amount, d.currency)}
                      </T>
                    }
                    right={
                      <Button
                        title="Settle"
                        size="sm"
                        variant="glass"
                        onPress={() =>
                          router.push({ pathname: '/settle-up', params: { groupId: g.id, from: d.from, to: d.to, amount: String(d.amount), currency: d.currency } })
                        }
                      />
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
