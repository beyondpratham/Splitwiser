import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { firstName, myImpact, payersLabel } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { Expense, Profile } from '@/lib/types';
import { hexAlpha, space, useTheme } from '@/theme';
import { CategoryTile } from './Avatar';

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  const thisYear = new Date().getFullYear() === y;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: thisYear ? undefined : 'numeric' });
}

export function ExpenseList({
  expenses,
  people,
  meId,
  groupNames,
}: {
  expenses: Expense[];
  people: Map<string, Profile>;
  meId?: string;
  /** when given, rows show which group each expense belongs to */
  groupNames?: Map<string, string>;
}) {
  const t = useTheme();
  const months: [string, Expense[]][] = [];
  for (const e of expenses) {
    const k = e.spent_on.slice(0, 7);
    if (months.at(-1)?.[0] !== k) months.push([k, []]);
    months.at(-1)![1].push(e);
  }

  let n = 0;
  return (
    <>
      {months.map(([k, list]) => (
        <View key={k} style={styles.month}>
          <Text variant="titleSmall" style={[styles.monthLabel, { color: t.colors.primary }]}>
            {monthLabel(k)}
          </Text>
          <View style={{ gap: 2 }}>
            {list.map((e, i) => (
              <ExpenseRow
                key={e.id}
                e={e}
                people={people}
                meId={meId}
                index={n++}
                first={i === 0}
                last={i === list.length - 1}
                groupName={e.group_id ? groupNames?.get(e.group_id) : groupNames ? 'Non-group' : undefined}
              />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function ExpenseRow({
  e,
  people,
  meId,
  index,
  first,
  last,
  groupName,
}: {
  e: Expense;
  people: Map<string, Profile>;
  meId?: string;
  index: number;
  first: boolean;
  last: boolean;
  groupName?: string;
}) {
  const t = useTheme();
  const impact = myImpact(e, meId);
  const day = new Date(`${e.spent_on}T12:00:00`);

  let subtitle: string;
  if (e.is_payment) {
    const from = e.expense_shares.find((s) => Number(s.paid) > 0);
    const to = e.expense_shares.find((s) => Number(s.owed) > 0);
    subtitle = `${firstName(people.get(from?.profile_id ?? ''), meId)} paid ${firstName(people.get(to?.profile_id ?? ''), meId).replace(/^You$/, 'you')}`;
  } else {
    subtitle = `${payersLabel(e, people, meId)} paid ${formatMoney(Number(e.amount), e.currency)}`;
  }
  if (groupName) subtitle += ` · ${groupName}`;

  const color = impact.net > 0 ? t.colors.owed : t.colors.owe;
  const right = e.is_payment ? (
    <Text variant="titleSmall" style={{ color: t.colors.onSurfaceVariant, fontVariant: ['tabular-nums'] }}>
      {formatMoney(Number(e.amount), e.currency)}
    </Text>
  ) : !impact.involved || Math.abs(impact.net) < 0.005 ? (
    <Text variant="labelMedium" style={{ color: t.colors.onSurfaceVariant }}>
      {impact.involved ? 'no balance' : 'not involved'}
    </Text>
  ) : (
    <View style={{ alignItems: 'flex-end' }}>
      <Text variant="labelSmall" style={{ color }}>
        {impact.net > 0 ? 'you lent' : 'you borrowed'}
      </Text>
      <Text variant="titleSmall" style={{ color, fontVariant: ['tabular-nums'] }}>
        {formatMoney(Math.abs(impact.net), e.currency)}
      </Text>
    </View>
  );

  const r = (on: boolean) => (on ? 20 : 4);
  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 10) * 35).springify().damping(18)}
      style={{
        overflow: 'hidden',
        backgroundColor: t.colors.surfaceContainerLow,
        borderTopLeftRadius: r(first),
        borderTopRightRadius: r(first),
        borderBottomLeftRadius: r(last),
        borderBottomRightRadius: r(last),
      }}
    >
      <Pressable
        onPress={() => router.push({ pathname: '/expense/[id]', params: { id: e.id } })}
        android_ripple={{ color: hexAlpha(t.colors.onSurface, 0.12) }}
        style={styles.row}
      >
        <View style={styles.date}>
          <Text variant="labelSmall" style={{ color: t.colors.onSurfaceVariant }}>
            {day.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
          </Text>
          <Text variant="titleMedium" style={{ color: t.colors.onSurface, fontVariant: ['tabular-nums'] }}>
            {day.getDate()}
          </Text>
        </View>
        <CategoryTile category={e.category} payment={e.is_payment} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="bodyLarge" numberOfLines={1} style={{ color: t.colors.onSurface }}>
            {e.is_payment ? 'Payment' : e.description}
          </Text>
          <Text variant="bodySmall" numberOfLines={1} style={{ color: t.colors.onSurfaceVariant }}>
            {subtitle}
          </Text>
        </View>
        {right}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  month: { marginHorizontal: space.lg, marginBottom: space.xl },
  monthLabel: { marginBottom: space.sm, marginLeft: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 72 },
  date: { width: 32, alignItems: 'center' },
});
