import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { EmojiTile } from '@/components/Avatar';
import { BalanceSummary } from '@/components/BalanceSummary';
import { Button, Chip } from '@/components/Controls';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { AmountLabel, EmptyState } from '@/components/ui';
import { useGroups, useMe, useMyBalances, usePeople } from '@/lib/api';
import { entries, firstName, summarizeBalances } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { BalanceRow } from '@/lib/types';
import { space, useTheme } from '@/theme';

type Filter = 'all' | 'outstanding' | 'owe' | 'owed';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'owe', label: 'You owe' },
  { value: 'owed', label: 'You are owed' },
];

export default function Groups() {
  const t = useTheme();
  const groups = useGroups();
  const balances = useMyBalances();
  const me = useMe().data;
  const { byId } = usePeople();
  const summary = summarizeBalances(balances.data ?? []);
  const nonGroup = entries(summary.byGroup.get('none'));
  const [filter, setFilter] = useState<Filter>('all');
  const [showSettled, setShowSettled] = useState(false);
  const [query, setQuery] = useState('');

  // per group: who owes me / whom I owe, biggest first
  const lines = useMemo(() => {
    const map = new Map<string, BalanceRow[]>();
    for (const r of balances.data ?? []) {
      if (!r.group_id || Math.abs(Number(r.balance)) < 0.005) continue;
      map.set(r.group_id, [...(map.get(r.group_id) ?? []), r]);
    }
    for (const list of map.values()) list.sort((a, b) => Math.abs(Number(b.balance)) - Math.abs(Number(a.balance)));
    return map;
  }, [balances.data]);

  const q = query.trim().toLowerCase();
  const all = (groups.data ?? []).filter((g) => !q || g.name.toLowerCase().includes(q));
  const net = (id: string) => entries(summary.byGroup.get(id))[0]?.[1] ?? 0;
  const open = all.filter((g) => net(g.id) !== 0 && (filter === 'all' || filter === 'outstanding' || (filter === 'owe' ? net(g.id) < 0 : net(g.id) > 0)));
  const settled = filter === 'all' || q ? all.filter((g) => net(g.id) === 0) : [];

  const row = (g: (typeof all)[number]) => {
    const bal = entries(summary.byGroup.get(g.id));
    const people = lines.get(g.id) ?? [];
    return (
      <ListItem
        key={g.id}
        left={<EmojiTile emoji={g.emoji} />}
        title={g.name}
        subtitle={
          people.length ? (
            <View style={{ gap: 1 }}>
              {people.slice(0, 2).map((r) => {
                const v = Number(r.balance);
                const who = firstName(byId.get(r.other_id), me?.id);
                return (
                  <T key={`${r.other_id}${r.currency}`} variant="caption" tone="dim" numberOfLines={1}>
                    {v > 0 ? `${who} owes you ` : `You owe ${who} `}
                    <T variant="caption" tone={v > 0 ? 'owed' : 'owe'}>
                      {formatMoney(Math.abs(v), r.currency)}
                    </T>
                  </T>
                );
              })}
              {people.length > 2 && (
                <T variant="caption" tone="faint">
                  plus {people.length - 2} more {people.length - 2 === 1 ? 'balance' : 'balances'}
                </T>
              )}
            </View>
          ) : (
            `settled up · ${g.group_members.length} people`
          )
        }
        right={bal.length ? <AmountLabel amount={bal[0][1]} currency={bal[0][0]} positiveLabel="you are owed" negativeLabel="you owe" /> : undefined}
        chevron={!bal.length}
        onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
      />
    );
  };

  return (
    <Page
      title="Groups"
      variant="large"
      inTabs
      actions={[{ icon: 'account-multiple-plus-outline', label: 'New group', onPress: () => router.push('/new-group') }]}
      search={{ value: query, onChange: setQuery, placeholder: 'Search groups', label: 'Search groups' }}
      fab={{ label: 'Add expense', icon: 'plus', onPress: () => router.push('/add-expense') }}
      refreshing={groups.isRefetching || balances.isRefetching}
      onRefresh={() => {
        groups.refetch();
        balances.refetch();
      }}
    >
      {!q && <BalanceSummary {...summary} />}

      {groups.data && groups.data.length === 0 ? (
        <EmptyState
          icon="account-group-outline"
          title="No groups yet"
          message="Create a group for your home, a trip, or anything you share costs for."
          action={<Button title="Start a group" icon="plus" onPress={() => router.push('/new-group')} />}
        />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ScrollView>

          {open.length > 0 ? (
            <ListGroup animateIndex={1}>{open.map(row)}</ListGroup>
          ) : (
            filter !== 'all' && (
              <T variant="body" tone="dim" style={styles.none}>
                Nothing here — every group matching this filter is settled.
              </T>
            )
          )}

          {q && all.length === 0 && (
            <T variant="body" tone="dim" style={styles.none}>
              No groups match “{query}”.
            </T>
          )}

          {!q && nonGroup.length > 0 && (filter === 'all' || filter === 'outstanding' || (filter === 'owe' ? nonGroup[0][1] < 0 : nonGroup[0][1] > 0)) && (
            <ListGroup animateIndex={2}>
              <ListItem
                left={<EmojiTile emoji="🤝" />}
                title="Non-group expenses"
                subtitle="Expenses with friends outside any group"
                right={<AmountLabel amount={nonGroup[0][1]} currency={nonGroup[0][0]} positiveLabel="you are owed" negativeLabel="you owe" />}
                onPress={() => router.navigate('/friends')}
              />
            </ListGroup>
          )}

          {settled.length > 0 && (
            <>
              <View style={styles.toggle}>
                <Button
                  title={showSettled ? 'Hide settled-up groups' : `Show ${settled.length} settled-up ${settled.length === 1 ? 'group' : 'groups'}`}
                  variant="glass"
                  size="sm"
                  icon={showSettled ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowSettled(!showSettled)}
                />
              </View>
              {(showSettled || !!q) && (
                <Animated.View entering={FadeIn.duration(220)}>
                  <ListGroup title="Settled up">{settled.map(row)}</ListGroup>
                </Animated.View>
              )}
            </>
          )}

          {filter === 'all' && !q && (
            <Glass variant="pane" style={styles.newGroup} onPress={() => router.push('/new-group')} accessibilityLabel="Start a new group" contentStyle={styles.newGroupInner}>
              <Icon name="plus-circle" size={26} color={t.accent} />
              <T variant="bodyStrong" tone="accent">
                Start a new group
              </T>
            </Glass>
          )}
        </>
      )}
    </Page>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
  toggle: { alignItems: 'center', marginBottom: space.lg },
  none: { textAlign: 'center', marginBottom: space.xl, paddingHorizontal: space.xl },
  newGroup: { marginHorizontal: space.lg, marginBottom: space.xl },
  newGroupInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, height: 60 },
});
