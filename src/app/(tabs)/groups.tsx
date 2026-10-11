import { router, Stack } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';
import { BalanceSummary } from '@/components/BalanceSummary';
import { EmojiTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Row, Section } from '@/components/List';
import { EmptyState, Button, FloatingButton, HeaderButton, Screen } from '@/components/ui';
import { useGroups, useMyBalances } from '@/lib/api';
import { entries, summarizeBalances } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { useTheme } from '@/theme';

export default function Groups() {
  const t = useTheme();
  const groups = useGroups();
  const balances = useMyBalances();
  const summary = summarizeBalances(balances.data ?? []);
  const nonGroup = summary.byGroup.get('none');

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen options={{ headerRight: () => <HeaderButton icon="plus" onPress={() => router.push('/new-group')} /> }} />
      <Screen
        refreshControl={
          <RefreshControl
            refreshing={groups.isRefetching || balances.isRefetching}
            onRefresh={() => {
              groups.refetch();
              balances.refetch();
            }}
          />
        }
      >
        <BalanceSummary {...summary} />

        {groups.data && groups.data.length === 0 ? (
          <EmptyState
            icon="person.3.fill"
            title="No groups yet"
            message="Create a group for your home, a trip, or anything you share costs for."
            action={<Button title="Start a group" icon="plus" onPress={() => router.push('/new-group')} />}
          />
        ) : (
          <Section title="Your groups">
            {(groups.data ?? []).map((g) => {
              const bal = entries(summary.byGroup.get(g.id));
              return (
                <Row
                  key={g.id}
                  left={<EmojiTile emoji={g.emoji} />}
                  title={g.name}
                  subtitle={
                    bal.length === 0 ? (
                      <Text style={{ color: t.secondary, fontSize: 14 }}>settled up</Text>
                    ) : (
                      <Text style={{ fontSize: 14, color: bal[0][1] > 0 ? t.owed : t.owe }} numberOfLines={1}>
                        {bal[0][1] > 0 ? 'you are owed ' : 'you owe '}
                        {bal.map(([c, v]) => formatMoney(Math.abs(v), c)).join(' + ')}
                      </Text>
                    )
                  }
                  detail={`${g.group_members.length}`}
                  right={<Icon name="person.fill" size={12} color={t.tertiary} />}
                  chevron
                  onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
                />
              );
            })}
            <Row
              left={<Icon name="plus.circle.fill" size={28} color={t.accent} />}
              title="Start a new group"
              tint
              onPress={() => router.push('/new-group')}
            />
          </Section>
        )}

        {nonGroup && (
          <Section footer="Expenses with friends outside any group live on each friend’s page.">
            <Row
              left={<EmojiTile emoji="🤝" />}
              title="Non-group expenses"
              subtitle={entries(nonGroup).map(([c, v]) => `${v > 0 ? 'owed' : 'owe'} ${formatMoney(Math.abs(v), c)}`).join(' · ')}
              chevron
              onPress={() => router.navigate('/friends')}
            />
          </Section>
        )}
      </Screen>
      <FloatingButton title="Add expense" onPress={() => router.push('/add-expense')} />
    </View>
  );
}
