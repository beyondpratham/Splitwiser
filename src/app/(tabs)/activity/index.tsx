import { router } from 'expo-router';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar, CategoryTile, EmojiTile } from '@/components/Avatar';
import { Icon } from '@/components/Icon';
import { EmptyState, Screen } from '@/components/ui';
import { describeActivity, snapshotImpact, timeAgo } from '@/lib/activity';
import { useActivity, useGroups, useMe, usePeople } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import type { Activity } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

export default function ActivityFeed() {
  const t = useTheme();
  const activity = useActivity();
  const me = useMe().data;
  const { byId } = usePeople();
  const groups = useGroups().data ?? [];

  const items = activity.data ?? [];

  return (
    <Screen refreshControl={<RefreshControl refreshing={activity.isRefetching} onRefresh={() => activity.refetch()} />}>
      {activity.data && items.length === 0 ? (
        <EmptyState icon="bolt.fill" title="Nothing yet" message="Expenses, payments and comments from you and your friends will show up here." />
      ) : (
        <View style={[styles.card, { backgroundColor: t.card }]}>
          {items.map((a, i) => (
            <ActivityRow
              key={a.id}
              a={a}
              last={i === items.length - 1}
              meId={me?.id}
              people={byId}
              groupEmoji={groups.find((g) => g.id === a.group_id)?.emoji}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

function ActivityRow({
  a,
  last,
  meId,
  people,
  groupEmoji,
}: {
  a: Activity;
  last: boolean;
  meId?: string;
  people: ReturnType<typeof usePeople>['byId'];
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
      <View style={[styles.commentTile, { backgroundColor: t.fill }]}>
        <Icon name="bubble.left.fill" size={20} color={t.secondary} />
      </View>
    );

  const onPress = a.expense_id
    ? () => router.push({ pathname: '/expense/[id]', params: { id: a.expense_id! } })
    : a.group_id
      ? () => router.push({ pathname: '/group/[id]', params: { id: a.group_id! } })
      : undefined;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.fill }]}>
      <View style={{ marginTop: space.md }}>
        {leading}
        {actor && (
          <View style={[styles.badge, { borderColor: t.card }]}>
            <Avatar name={actor.name} color={actor.avatar_color} size={20} />
          </View>
        )}
      </View>
      <View style={[styles.body, !last && { borderBottomColor: t.separator, borderBottomWidth: StyleSheet.hairlineWidth }]}>
        <Text style={[styles.text, { color: t.text }, a.kind === 'expense_deleted' && styles.strike]}>
          {segments.map((s, i) => (
            <Text key={i} style={s.bold ? { fontWeight: '600' } : undefined}>
              {s.text}
            </Text>
          ))}
        </Text>
        {a.kind === 'comment_added' && a.data.body && (
          <Text style={[styles.quote, { color: t.secondary }]} numberOfLines={2}>
            “{a.data.body}”
          </Text>
        )}
        {impact != null && snap && !snap.is_payment && (
          <Text style={{ fontSize: 14, fontWeight: '500', color: impact > 0 ? t.owed : impact < 0 ? t.owe : t.secondary }}>
            {impact > 0
              ? `You get back ${formatMoney(impact, snap.currency)}`
              : impact < 0
                ? `You owe ${formatMoney(-impact, snap.currency)}`
                : 'You don’t owe anything'}
          </Text>
        )}
        <Text style={[styles.time, { color: t.tertiary }]}>{timeAgo(a.created_at)}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', paddingLeft: space.lg, gap: space.md, alignItems: 'flex-start' },
  body: { flex: 1, paddingVertical: space.md, paddingRight: space.lg, gap: 3 },
  text: { fontSize: 15, lineHeight: 20 },
  strike: { textDecorationLine: 'line-through' },
  quote: { fontSize: 14, fontStyle: 'italic' },
  time: { fontSize: 12, marginTop: 1 },
  badge: { position: 'absolute', right: -5, bottom: -5, borderWidth: 2, borderRadius: 12 },
  commentTile: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
