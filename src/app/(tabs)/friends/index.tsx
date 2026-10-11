import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import { RefreshControl, Text, View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { BalanceSummary } from '@/components/BalanceSummary';
import { Row, Section } from '@/components/List';
import { Button, EmptyState, FloatingButton, HeaderButton, Screen } from '@/components/ui';
import { useFriends, useMyBalances } from '@/lib/api';
import { entries, summarizeBalances } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme';

export default function Friends() {
  const t = useTheme();
  const { friends, refetch, isRefetching, data } = useFriends();
  const balances = useMyBalances();
  const summary = summarizeBalances(balances.data ?? []);
  const [query, setQuery] = useState('');

  const [outstanding, settled] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = friends.filter((f) => !q || f.name.toLowerCase().includes(q) || f.email?.includes(q));
    const withBal = list.filter((f) => entries(summary.byFriend.get(f.id)).length > 0);
    // largest balances first
    withBal.sort((a, b) => Math.abs(entries(summary.byFriend.get(b.id))[0][1]) - Math.abs(entries(summary.byFriend.get(a.id))[0][1]));
    return [withBal, list.filter((f) => entries(summary.byFriend.get(f.id)).length === 0)];
  }, [friends, summary.byFriend, query]);

  const renderFriend = (f: (typeof friends)[number]) => {
    const bal = entries(summary.byFriend.get(f.id));
    return (
      <Row
        key={f.id}
        left={<Avatar name={f.name} color={f.avatar_color} />}
        title={f.name}
        subtitle={
          bal.length === 0 ? (
            <Text style={{ color: t.secondary, fontSize: 14 }}>{f.user_id ? 'settled up' : 'invited · settled up'}</Text>
          ) : (
            <Text style={{ fontSize: 14, color: bal[0][1] > 0 ? t.owed : t.owe }} numberOfLines={1}>
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
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          headerRight: () => <HeaderButton icon="person.badge.plus" onPress={() => router.push('/add-friend')} />,
          headerSearchBarOptions: { placeholder: 'Search friends', onChangeText: (e) => setQuery(e.nativeEvent.text), hideWhenScrolling: true },
        }}
      />
      <Screen refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => { refetch(); balances.refetch(); }} />}>
        {!query && <BalanceSummary {...summary} />}
        {data && friends.length === 0 ? (
          <EmptyState
            icon="person.2.fill"
            title="Add your first friend"
            message="Add friends by email. They don’t need an account yet — they’ll see everything once they sign up."
            action={<Button title="Add a friend" icon="person.badge.plus" onPress={() => router.push('/add-friend')} />}
          />
        ) : (
          <>
            {outstanding.length > 0 && <Section title="Outstanding">{outstanding.map(renderFriend)}</Section>}
            {settled.length > 0 && <Section title="Settled up">{settled.map(renderFriend)}</Section>}
          </>
        )}
      </Screen>
      <FloatingButton title="Add expense" onPress={() => router.push('/add-expense')} />
    </View>
  );
}
