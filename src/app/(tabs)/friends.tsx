import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Avatar } from '@/components/Avatar';
import { BalanceSummary } from '@/components/BalanceSummary';
import { Button, Chip } from '@/components/Controls';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { AmountLabel, EmptyState } from '@/components/ui';
import { useFriends, useGroups, useMyBalances } from '@/lib/api';
import { entries, summarizeBalances, type CurrencyMap } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { Profile } from '@/lib/types';
import { space } from '@/theme';

type Filter = 'all' | 'outstanding' | 'owe' | 'owed';
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'owe', label: 'You owe' },
  { value: 'owed', label: 'Owes you' },
];

export default function Friends() {
  const { friends, refetch, isRefetching, data } = useFriends();
  const balances = useMyBalances();
  const groupsData = useGroups().data;
  const summary = summarizeBalances(balances.data ?? []);
  const groupNames = useMemo(() => new Map((groupsData ?? []).map((g) => [g.id, g.name])), [groupsData]);
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [showSettled, setShowSettled] = useState(false);

  const { outstanding, settled } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const net = (f: Profile) => entries(summary.byFriend.get(f.id))[0]?.[1] ?? 0;
    const list = friends.filter((f) => !q || f.name.toLowerCase().includes(q) || f.email?.toLowerCase().includes(q));
    const open = list
      .filter((f) => net(f) !== 0)
      .filter((f) => filter === 'all' || filter === 'outstanding' || (filter === 'owe' ? net(f) < 0 : net(f) > 0))
      .sort((a, b) => Math.abs(net(b)) - Math.abs(net(a)));
    return { outstanding: open, settled: filter === 'all' || q ? list.filter((f) => net(f) === 0) : [] };
  }, [friends, summary.byFriend, query, filter]);

  const row = (f: Profile) => {
    const bal = entries(summary.byFriend.get(f.id));
    const perGroup = [...(summary.byFriendGroup.get(f.id)?.entries() ?? [])].filter(([, m]) => entries(m).length);
    return (
      <ListItem
        key={f.id}
        left={<Avatar name={f.name} color={f.avatar_color} avatar={f.avatar} />}
        title={f.name}
        subtitle={
          bal.length === 0 ? (f.user_id ? 'settled up' : 'invited · settled up') : perGroup.length > 1 ? <Breakdown lines={perGroup} groupNames={groupNames} /> : undefined
        }
        right={
          bal.length ? (
            <View style={{ alignItems: 'flex-end' }}>
              <AmountLabel amount={bal[0][1]} currency={bal[0][0]} positiveLabel="owes you" negativeLabel="you owe" />
              {bal.length > 1 && (
                <T variant="caption" tone="faint">
                  + {bal.length - 1} more {bal.length === 2 ? 'currency' : 'currencies'}
                </T>
              )}
            </View>
          ) : undefined
        }
        chevron={!bal.length}
        onPress={() => router.push({ pathname: '/friend/[id]', params: { id: f.id } })}
      />
    );
  };

  return (
    <Page
      title="Friends"
      variant="large"
      inTabs
      actions={[{ icon: 'account-plus-outline', label: 'Add friend', onPress: () => router.push('/add-friend') }]}
      search={{ value: query, onChange: setQuery, placeholder: 'Search by name or email', label: 'Search friends' }}
      fab={{ label: 'Add expense', icon: 'plus', onPress: () => router.push('/add-expense') }}
      refreshing={isRefetching}
      onRefresh={() => {
        refetch();
        balances.refetch();
      }}
    >
      {!query && <BalanceSummary {...summary} />}

      {data && friends.length === 0 ? (
        <EmptyState
          icon="account-heart-outline"
          title="Add your first friend"
          message="Add friends by email. They don’t need an account yet — they’ll see everything once they sign up."
          action={<Button title="Add a friend" icon="account-plus" onPress={() => router.push('/add-friend')} />}
        />
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {FILTERS.map((f) => (
              <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
            ))}
          </ScrollView>

          {outstanding.length > 0 ? (
            <ListGroup animateIndex={1}>{outstanding.map(row)}</ListGroup>
          ) : (
            filter !== 'all' && (
              <T variant="body" tone="dim" style={styles.none}>
                {filter === 'owe' ? 'You don’t owe anyone.' : filter === 'owed' ? 'Nobody owes you right now.' : 'Everyone is settled up.'}
              </T>
            )
          )}

          {settled.length > 0 && (
            <>
              <View style={styles.toggle}>
                <Button
                  title={showSettled ? 'Hide settled-up friends' : `Show ${settled.length} settled-up ${settled.length === 1 ? 'friend' : 'friends'}`}
                  variant="glass"
                  size="sm"
                  icon={showSettled ? 'eye-off-outline' : 'eye-outline'}
                  onPress={() => setShowSettled(!showSettled)}
                />
              </View>
              {(showSettled || !!query) && (
                <Animated.View entering={FadeIn.duration(220)}>
                  <ListGroup title="Settled up">{settled.map(row)}</ListGroup>
                </Animated.View>
              )}
            </>
          )}
        </>
      )}
    </Page>
  );
}

/** Splitwise-style breakdown under a friend: one line per group. */
function Breakdown({ lines, groupNames }: { lines: [string | null, CurrencyMap][]; groupNames: Map<string, string> }) {
  return (
    <View style={{ gap: 1 }}>
      {lines.slice(0, 2).map(([gid, map]) => {
        const [cur, v] = entries(map)[0];
        return (
          <T key={gid ?? 'none'} variant="caption" tone="dim" numberOfLines={1}>
            {gid ? groupNames.get(gid) ?? 'A group' : 'Non-group'}
            {': '}
            <T variant="caption" tone={v > 0 ? 'owed' : 'owe'}>
              {v > 0 ? '+' : '−'}
              {formatMoney(Math.abs(v), cur)}
            </T>
          </T>
        );
      })}
      {lines.length > 2 && (
        <T variant="caption" tone="faint">
          plus {lines.length - 2} more
        </T>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.lg },
  toggle: { alignItems: 'center', marginBottom: space.lg },
  none: { textAlign: 'center', marginBottom: space.xl, paddingHorizontal: space.xl },
});
