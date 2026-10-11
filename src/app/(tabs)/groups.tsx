import { router } from 'expo-router';
import { Button, Text } from 'react-native-paper';
import { EmojiTile } from '@/components/Avatar';
import { BalanceSummary } from '@/components/BalanceSummary';
import { Icon } from '@/components/Icon';
import { ListGroup, ListItem } from '@/components/List';
import { Page } from '@/components/Page';
import { EmptyState } from '@/components/ui';
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
    <Page
      title="Groups"
      variant="large"
      inTabs
      actions={[{ icon: 'account-multiple-plus-outline', label: 'New group', onPress: () => router.push('/new-group') }]}
      fab={{ label: 'Add expense', icon: 'plus', onPress: () => router.push('/add-expense') }}
      refreshing={groups.isRefetching || balances.isRefetching}
      onRefresh={() => {
        groups.refetch();
        balances.refetch();
      }}
    >
      <BalanceSummary {...summary} />

      {groups.data && groups.data.length === 0 ? (
        <EmptyState
          icon="account-group"
          title="No groups yet"
          message="Create a group for your home, a trip, or anything you share costs for."
          action={
            <Button mode="contained-tonal" icon="plus" onPress={() => router.push('/new-group')}>
              Start a group
            </Button>
          }
        />
      ) : (
        <ListGroup title="Your groups" animateIndex={1}>
          {(groups.data ?? []).map((g) => {
            const bal = entries(summary.byGroup.get(g.id));
            return (
              <ListItem
                key={g.id}
                left={<EmojiTile emoji={g.emoji} />}
                title={g.name}
                subtitle={
                  bal.length === 0 ? (
                    <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }}>
                      settled up · {g.group_members.length} people
                    </Text>
                  ) : (
                    <Text variant="bodyMedium" style={{ color: bal[0][1] > 0 ? t.colors.owed : t.colors.owe }} numberOfLines={1}>
                      {bal[0][1] > 0 ? 'you are owed ' : 'you owe '}
                      {bal.map(([c, v]) => formatMoney(Math.abs(v), c)).join(' + ')}
                    </Text>
                  )
                }
                chevron
                onPress={() => router.push({ pathname: '/group/[id]', params: { id: g.id } })}
              />
            );
          })}
          <ListItem
            left={<Icon name="plus-circle" size={32} color={t.colors.primary} />}
            title="Start a new group"
            tone="primary"
            onPress={() => router.push('/new-group')}
          />
        </ListGroup>
      )}

      {nonGroup && (
        <ListGroup footer="Expenses with friends outside any group live on each friend’s page." animateIndex={2}>
          <ListItem
            left={<EmojiTile emoji="🤝" />}
            title="Non-group expenses"
            subtitle={entries(nonGroup)
              .map(([c, v]) => `${v > 0 ? 'owed' : 'owe'} ${formatMoney(Math.abs(v), c)}`)
              .join(' · ')}
            chevron
            onPress={() => router.navigate('/friends')}
          />
        </ListGroup>
      )}
    </Page>
  );
}
