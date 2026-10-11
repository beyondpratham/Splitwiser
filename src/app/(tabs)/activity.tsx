import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Avatar, CategoryTile, EmojiTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { EmptyState } from '@/components/ui';
import { describeActivity, snapshotImpact, timeAgo } from '@/lib/activity';
import { useActivity, useGroups, useMe, usePeople } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import type { Activity, Profile } from '@/lib/types';
import { hexAlpha, space, useTheme } from '@/theme';

export default function ActivityFeed() {
  const activity = useActivity();
  const me = useMe().data;
  const { byId } = usePeople();
  const groups = useGroups().data ?? [];
  const items = activity.data ?? [];

  return (
    <Page title="Activity" variant="large" inTabs refreshing={activity.isRefetching} onRefresh={() => activity.refetch()}>
      {activity.data && items.length === 0 ? (
        <EmptyState icon="lightning-bolt" title="Nothing yet" message="Expenses, payments and comments from you and your friends will show up here." />
      ) : (
        <View style={styles.list}>
          {items.map((a, i) => (
            <ActivityRow
              key={a.id}
              a={a}
              index={i}
              first={i === 0}
              last={i === items.length - 1}
              meId={me?.id}
              people={byId}
              groupEmoji={groups.find((g) => g.id === a.group_id)?.emoji}
            />
          ))}
        </View>
      )}
    </Page>
  );
}

function ActivityRow({
  a,
  index,
  first,
  last,
  meId,
  people,
  groupEmoji,
}: {
  a: Activity;
  index: number;
  first: boolean;
  last: boolean;
  meId?: string;
  people: Map<string, Profile>;
  groupEmoji?: string;
}) {
  const t = useTheme();
  const segments = describeActivity(a, people, meId);
  const snap = a.data.after ?? a.data.before;
  const impact = a.kind === 'expense_deleted' ? null : snapshotImpact(a.data.after, meId);
  const actor = people.get(a.actor_id ?? '');

  const leading =
    a.kind === 'group_created' || a.kind === 'member_added' ? (
      <EmojiTile emoji={groupEmoji ?? '👥'} size={44} />
    ) : snap ? (
      <CategoryTile category={snap.category} payment={snap.is_payment} size={44} />
    ) : (
      <View style={[styles.commentTile, { backgroundColor: t.colors.tertiaryContainer }]}>
        <Icon name="comment-text" size={22} color={t.colors.onTertiaryContainer} />
      </View>
    );

  const onPress = a.expense_id
    ? () => router.push({ pathname: '/expense/[id]', params: { id: a.expense_id! } })
    : a.group_id
      ? () => router.push({ pathname: '/group/[id]', params: { id: a.group_id! } })
      : undefined;

  const r = (on: boolean) => (on ? 20 : 4);
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 12) * 30).springify().damping(18)}
      style={{
        overflow: 'hidden',
        backgroundColor: t.colors.surfaceContainerLow,
        borderTopLeftRadius: r(first),
        borderTopRightRadius: r(first),
        borderBottomLeftRadius: r(last),
        borderBottomRightRadius: r(last),
      }}
    >
      <Pressable onPress={onPress} android_ripple={{ color: hexAlpha(t.colors.onSurface, 0.12) }} style={styles.row}>
        <View>
          {leading}
          {actor && (
            <View style={[styles.badge, { borderColor: t.colors.surfaceContainerLow }]}>
              <Avatar name={actor.name} color={actor.avatar_color} size={20} />
            </View>
          )}
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="bodyMedium" style={[{ color: t.colors.onSurface }, a.kind === 'expense_deleted' && styles.strike]}>
            {segments.map((s, i) => (
              <Text key={i} style={s.bold ? { fontWeight: '700' } : undefined}>
                {s.text}
              </Text>
            ))}
          </Text>
          {a.kind === 'comment_added' && a.data.body && (
            <Text variant="bodyMedium" numberOfLines={2} style={{ color: t.colors.onSurfaceVariant, fontStyle: 'italic' }}>
              “{a.data.body}”
            </Text>
          )}
          {impact != null && snap && !snap.is_payment && (
            <Text
              variant="labelLarge"
              style={{ color: impact > 0 ? t.colors.owed : impact < 0 ? t.colors.owe : t.colors.onSurfaceVariant }}
            >
              {impact > 0
                ? `You get back ${formatMoney(impact, snap.currency)}`
                : impact < 0
                  ? `You owe ${formatMoney(-impact, snap.currency)}`
                  : 'You don’t owe anything'}
            </Text>
          )}
          <Text variant="labelSmall" style={{ color: t.colors.outline }}>
            {timeAgo(a.created_at)}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: space.lg, gap: 2 },
  row: { flexDirection: 'row', gap: space.lg, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'flex-start' },
  strike: { textDecorationLine: 'line-through' },
  badge: { position: 'absolute', right: -6, bottom: -6, borderWidth: 2, borderRadius: 12 },
  commentTile: { width: 44, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
});
