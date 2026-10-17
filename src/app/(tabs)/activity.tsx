import { router } from 'expo-router';
import { Fragment, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Avatar, CategoryTile, EmojiTile } from '@/components/Avatar';
import { Field } from '@/components/Controls';
import { Glass } from '@/components/Glass';
import { Icon } from '@/components/Icon';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { EmptyState } from '@/components/ui';
import { describeActivity, snapshotImpact, timeAgo } from '@/lib/activity';
import { useActivity, useGroups, useMe, usePeople } from '@/lib/api';
import { formatMoney } from '@/lib/money';
import type { Activity, Profile } from '@/lib/types';
import { space, useTheme } from '@/theme';

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, today)) return 'Today';
  if (same(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
}

export default function ActivityFeed() {
  const t = useTheme();
  const activity = useActivity();
  const me = useMe().data;
  const { byId } = usePeople();
  const groups = useGroups().data ?? [];
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');

  const days = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: [string, Activity[]][] = [];
    for (const a of activity.data ?? []) {
      if (q) {
        const text = describeActivity(a, byId, me?.id).map((s) => s.text).join('') + (a.data.body ?? '');
        if (!text.toLowerCase().includes(q)) continue;
      }
      const label = dayLabel(a.created_at);
      if (out.at(-1)?.[0] !== label) out.push([label, []]);
      out.at(-1)![1].push(a);
    }
    return out;
  }, [activity.data, query, byId, me?.id]);

  return (
    <Page
      title="Activity"
      variant="large"
      inTabs
      actions={[{ icon: searching ? 'close' : 'magnify', label: searching ? 'Close search' : 'Search activity', onPress: () => (setSearching(!searching), setQuery('')) }]}
      refreshing={activity.isRefetching}
      onRefresh={() => activity.refetch()}
    >
      {searching && (
        <Animated.View entering={FadeInDown.springify().damping(18)} exiting={FadeOut.duration(150)} style={styles.search}>
          <Field icon="magnify" placeholder="Search activity" value={query} onChangeText={setQuery} autoFocus autoCorrect={false} />
        </Animated.View>
      )}
      {activity.data && days.length === 0 ? (
        query ? (
          <T variant="body" tone="dim" style={{ textAlign: 'center', marginTop: space.xl }}>
            Nothing matches “{query}”.
          </T>
        ) : (
          <EmptyState icon="lightning-bolt-outline" title="Nothing yet" message="Expenses, payments and comments from you and your friends will show up here." />
        )
      ) : (
        days.map(([label, items], di) => (
          <Animated.View key={label} entering={FadeInDown.delay(Math.min(di, 5) * 50).springify().damping(18)} style={styles.day}>
            <T variant="overline" tone="dim" style={styles.dayLabel}>
              {label}
            </T>
            <Glass variant="pane">
              {items.map((a, i) => (
                <Fragment key={a.id}>
                  <ActivityRow a={a} meId={me?.id} people={byId} groupEmoji={groups.find((g) => g.id === a.group_id)?.emoji} />
                  {i < items.length - 1 && <View style={[styles.sep, { backgroundColor: t.line }]} />}
                </Fragment>
              ))}
            </Glass>
          </Animated.View>
        ))
      )}
    </Page>
  );
}

function ActivityRow({ a, meId, people, groupEmoji }: { a: Activity; meId?: string; people: Map<string, Profile>; groupEmoji?: string }) {
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
      <View style={[styles.commentTile, { backgroundColor: t.accentSoft }]}>
        <Icon name="comment-text-outline" size={22} color={t.accentText} />
      </View>
    );

  const onPress = a.expense_id
    ? () => router.push({ pathname: '/expense/[id]', params: { id: a.expense_id! } })
    : a.group_id
      ? () => router.push({ pathname: '/group/[id]', params: { id: a.group_id! } })
      : undefined;

  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.glassPressed }]}>
      <View>
        {leading}
        {actor && (
          <View style={styles.badge}>
            <Avatar name={actor.name} color={actor.avatar_color} avatar={actor.avatar} size={22} />
          </View>
        )}
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <T variant="label" style={[{ fontWeight: '400' }, a.kind === 'expense_deleted' && styles.strike]}>
          {segments.map((s, i) => (
            <T key={i} variant="label" style={s.bold ? { fontFamily: 'Inter_600SemiBold' } : { fontFamily: 'Inter_400Regular' }}>
              {s.text}
            </T>
          ))}
        </T>
        {a.kind === 'comment_added' && a.data.body && (
          <T variant="caption" tone="dim" numberOfLines={2} style={{ fontStyle: 'italic' }}>
            “{a.data.body}”
          </T>
        )}
        {impact != null && snap && !snap.is_payment && (
          <T variant="caption" tone={impact > 0 ? 'owed' : impact < 0 ? 'owe' : 'dim'} style={{ fontFamily: 'Inter_600SemiBold' }}>
            {impact > 0 ? `You get back ${formatMoney(impact, snap.currency)}` : impact < 0 ? `You owe ${formatMoney(-impact, snap.currency)}` : 'You don’t owe anything'}
          </T>
        )}
        <T variant="caption" tone="faint">
          {timeAgo(a.created_at)}
        </T>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  search: { paddingHorizontal: space.lg, marginBottom: space.lg },
  day: { marginHorizontal: space.lg, marginBottom: space.xl },
  dayLabel: { marginBottom: space.sm, marginLeft: space.sm },
  row: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, alignItems: 'flex-start' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  strike: { textDecorationLine: 'line-through' },
  badge: { position: 'absolute', right: -6, bottom: -6 },
  commentTile: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
