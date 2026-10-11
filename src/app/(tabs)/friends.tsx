import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Searchbar, Text } from 'react-native-paper';
import { Avatar } from '@/components/Avatar';
import { BalanceSummary } from '@/components/BalanceSummary';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { EmptyState } from '@/components/ui';
import { useFriends, useMyBalances } from '@/lib/api';
import { entries, summarizeBalances } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { Profile } from '@/lib/types';
import { space, useTheme } from '@/theme';

export default function Friends() {
  const t = useTheme();
  const { friends, refetch, isRefetching, data } = useFriends();
  const balances = useMyBalances();
  const summary = summarizeBalances(balances.data ?? []);
  const [query, setQuery] = useState('');

  const [outstanding, settled] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = friends.filter((f) => !q || f.name.toLowerCase().includes(q) || f.email?.includes(q));
    const size = (f: Profile) => Math.abs(entries(summary.byFriend.get(f.id))[0]?.[1] ?? 0);
    const withBal = list.filter((f) => size(f) > 0).sort((a, b) => size(b) - size(a));
    return [withBal, list.filter((f) => size(f) === 0)];
  }, [friends, summary.byFriend, query]);

  const renderFriend = (f: Profile) => {
    const bal = entries(summary.byFriend.get(f.id));
    return (
      <ListItem
        key={f.id}
        left={<Avatar name={f.name} color={f.avatar_color} />}
        title={f.name}
        subtitle={
          bal.length === 0 ? (
            <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>
              {f.user_id ? 'settled up' : 'invited · settled up'}
            </Text>
          ) : (
            <Text variant="bodyMedium" style={{ color: bal[0][1] > 0 ? t.colors.owed : t.colors.owe }} numberOfLines={1}>
              {bal[0][1] > 0 ? 'owes you ' : 'you owe '}
              {bal.map(([c, v]) => formatMoney(Math.abs(v), c)).join(' + ')}
            </Text>
          )
        }
        chevron
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
      fab={{ label: 'Add expense', icon: 'plus', onPress: () => router.push('/add-expense') }}
      refreshing={isRefetching}
      onRefresh={() => {
        refetch();
        balances.refetch();
      }}
    >
      {friends.length > 4 && (
        <View style={{ paddingHorizontal: space.lg, marginBottom: space.lg }}>
          <Searchbar value={query} onChangeText={setQuery} placeholder="Search friends" mode="bar" />
        </View>
      )}
      {!query && <BalanceSummary {...summary} />}
      {data && friends.length === 0 ? (
        <EmptyState
          icon="account-heart"
          title="Add your first friend"
          message="Add friends by email. They don’t need an account yet — they’ll see everything once they sign up."
          action={
            <Button mode="contained-tonal" icon="account-plus" onPress={() => router.push('/add-friend')}>
              Add a friend
            </Button>
          }
        />
      ) : (
        <>
          {outstanding.length > 0 && (
            <ListGroup title="Outstanding" animateIndex={1}>
              {outstanding.map(renderFriend)}
            </ListGroup>
          )}
          {settled.length > 0 && (
            <ListGroup title="Settled up" animateIndex={2}>
              {settled.map(renderFriend)}
            </ListGroup>
          )}
        </>
      )}
    </Page>
  );
}
