import { router } from 'expo-router';
import { Fragment } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { firstName, myImpact, payersLabel } from '@/lib/balances';
import { dayToDate, formatMoney } from '@/lib/money';
import type { Expense, Profile } from '@/lib/types';
import { space, useTheme } from '@/theme';
import { CategoryTile } from './Avatar';
import { Glass } from './Glass';
import { T } from './Text';

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  const thisYear = new Date().getFullYear() === y;
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: thisYear ? undefined : 'numeric' });
}

/** Expenses grouped by month, each month a glass pane — like Splitwise's list. */
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
    const k = String(e.spent_on).slice(0, 7);
    if (months.at(-1)?.[0] !== k) months.push([k, []]);
    months.at(-1)![1].push(e);
  }

  return (
    <>
      {months.map(([k, list], mi) => (
        <Animated.View key={k} entering={FadeInDown.delay(Math.min(mi, 4) * 60).springify().damping(18)} style={styles.month}>
          <T variant="overline" tone="dim" style={styles.monthLabel}>
            {monthLabel(k)}
          </T>
          <Glass variant="pane" radius={26}>
            {list.map((e, i) => (
              <Fragment key={e.id}>
                <ExpenseRow e={e} people={people} meId={meId} groupName={e.group_id ? groupNames?.get(e.group_id) : groupNames ? 'Non-group' : undefined} />
                {i < list.length - 1 && <View style={[styles.sep, { backgroundColor: t.line }]} />}
              </Fragment>
            ))}
          </Glass>
        </Animated.View>
      ))}
    </>
  );
}

function ExpenseRow({ e, people, meId, groupName }: { e: Expense; people: Map<string, Profile>; meId?: string; groupName?: string }) {
  const t = useTheme();
  const impact = myImpact(e, meId);
  const day = dayToDate(e.spent_on);

  let subtitle: string;
  if (e.is_payment) {
    const from = e.expense_shares.find((s) => Number(s.paid) > 0);
    const to = e.expense_shares.find((s) => Number(s.owed) > 0);
    subtitle = `${firstName(people.get(from?.profile_id ?? ''), meId)} paid ${firstName(people.get(to?.profile_id ?? ''), meId).replace(/^You$/, 'you')}`;
  } else {
    subtitle = `${payersLabel(e, people, meId)} paid ${formatMoney(Number(e.amount), e.currency)}`;
  }
  if (groupName) subtitle += ` · ${groupName}`;

  const tone = impact.net > 0 ? 'owed' : 'owe';
  const right = e.is_payment ? (
    <T variant="label" tone="dim" numeric>
      {formatMoney(Number(e.amount), e.currency)}
    </T>
  ) : !impact.involved || Math.abs(impact.net) < 0.005 ? (
    <T variant="caption" tone="faint">
      {impact.involved ? 'no balance' : 'not involved'}
    </T>
  ) : (
    <View style={{ alignItems: 'flex-end' }}>
      <T variant="caption" tone={tone}>
        {impact.net > 0 ? 'you lent' : 'you borrowed'}
      </T>
      <T variant="subhead" tone={tone} numeric>
        {formatMoney(Math.abs(impact.net), e.currency)}
      </T>
    </View>
  );

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/expense/[id]', params: { id: e.id } })}
      accessibilityRole="button"
      accessibilityLabel={e.is_payment ? 'Payment' : e.description}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.glassPressed }]}
    >
      <View style={styles.date}>
        <T variant="caption" tone="dim" style={{ fontSize: 11 }}>
          {day.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}
        </T>
        <T variant="subhead" numeric>
          {day.getDate()}
        </T>
      </View>
      <CategoryTile category={e.category} payment={e.is_payment} size={42} />
      <View style={{ flex: 1, gap: 2 }}>
        <T variant="bodyStrong" numberOfLines={1}>
          {e.is_payment ? 'Payment' : e.description}
        </T>
        <T variant="caption" tone="dim" numberOfLines={1}>
          {subtitle}
        </T>
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  month: { marginHorizontal: space.lg, marginBottom: space.xl },
  monthLabel: { marginBottom: space.sm, marginLeft: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.md, minHeight: 72 },
  date: { width: 34, alignItems: 'center' },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 108 },
});
