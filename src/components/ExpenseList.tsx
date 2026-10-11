import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { firstName, myImpact, payersLabel } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import type { Expense, Profile } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';
import { CategoryTile } from './Avatar';

function monthKey(d: string) {
  return d.slice(0, 7);
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  const thisYear = new Date().getFullYear() === y;
  return date.toLocaleDateString(undefined, { month: 'long', year: thisYear ? undefined : 'numeric' });
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
    const k = monthKey(e.spent_on);
    if (months.at(-1)?.[0] !== k) months.push([k, []]);
    months.at(-1)![1].push(e);
  }

  return (
    <>
      {months.map(([k, list]) => (
        <View key={k} style={styles.month}>
          <Text style={[styles.monthLabel, { color: t.text }]}>{monthLabel(k)}</Text>
          <View style={[styles.card, { backgroundColor: t.card }]}>
            {list.map((e, i) => (
              <ExpenseRow key={e.id} e={e} people={people} meId={meId} last={i === list.length - 1} groupName={e.group_id ? groupNames?.get(e.group_id) : groupNames ? 'Non-group' : undefined} />
            ))}
          </View>
        </View>
      ))}
    </>
  );
}

function ExpenseRow({ e, people, meId, last, groupName }: { e: Expense; people: Map<string, Profile>; meId?: string; last: boolean; groupName?: string }) {
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

  const right = e.is_payment ? (
    <Text style={[styles.paymentAmount, { color: t.secondary }]}>{formatMoney(Number(e.amount), e.currency)}</Text>
  ) : !impact.involved || Math.abs(impact.net) < 0.005 ? (
    <Text style={{ color: t.tertiary, fontSize: 13 }}>{impact.involved ? 'no balance' : 'not involved'}</Text>
  ) : (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ fontSize: 12, color: impact.net > 0 ? t.owed : t.owe }}>{impact.net > 0 ? 'you lent' : 'you borrowed'}</Text>
      <Text style={{ fontSize: 16, fontWeight: '600', color: impact.net > 0 ? t.owed : t.owe, fontVariant: ['tabular-nums'] }}>
        {formatMoney(Math.abs(impact.net), e.currency)}
      </Text>
    </View>
  );

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/expense/[id]', params: { id: e.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.fill }]}
    >
      <View style={styles.date}>
        <Text style={[styles.dateMonth, { color: t.secondary }]}>{day.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</Text>
        <Text style={[styles.dateDay, { color: t.text }]}>{day.getDate()}</Text>
      </View>
      <CategoryTile category={e.category} payment={e.is_payment} size={38} />
      <View style={[styles.body, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.separator }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[styles.title, { color: t.text }]} numberOfLines={1}>
            {e.is_payment ? 'Payment' : e.description}
          </Text>
          <Text style={[styles.subtitle, { color: t.secondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
        {right}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  month: { marginHorizontal: space.lg, marginBottom: space.xl },
  monthLabel: { fontSize: 20, fontWeight: '700', marginBottom: space.sm, marginLeft: space.xs },
  card: { borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: space.md, gap: space.md },
  date: { width: 30, alignItems: 'center' },
  dateMonth: { fontSize: 11, fontWeight: '600' },
  dateDay: { fontSize: 18, fontWeight: '600', fontVariant: ['tabular-nums'] },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingRight: space.lg, minHeight: 64 },
  title: { fontSize: 16, fontWeight: '500' },
  subtitle: { fontSize: 13 },
  paymentAmount: { fontSize: 15, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
