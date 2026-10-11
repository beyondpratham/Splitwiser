import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CategoryTile } from '@/components/Avatar';
import { EmptyState, haptic, Screen, Segmented } from '@/components/ui';
import { useGroup, useGroupExpenses, useMe, useMyExpenses } from '@/lib/api';
import { categoryById } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import type { Expense } from '@/lib/types';
import { radius, space, useTheme } from '@/theme';

type Measure = 'mine' | 'total';

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Insights() {
  const t = useTheme();
  const { groupId } = useLocalSearchParams<{ groupId?: string }>();
  const me = useMe().data;
  const group = useGroup(groupId).data;
  const mine = useMyExpenses();
  const groupExp = useGroupExpenses(groupId);
  const source = (groupId ? groupExp.data : mine.data) ?? [];
  const [measure, setMeasure] = useState<Measure>('mine');
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const expenses = source.filter((e) => !e.is_payment);
  const currencies = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of expenses) counts.set(e.currency, (counts.get(e.currency) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [expenses]);
  const [currencyChoice, setCurrency] = useState<string | null>(null);
  const currency = currencyChoice ?? currencies[0] ?? me?.default_currency ?? 'USD';

  const data = useMemo(() => {
    const value = (e: Expense) =>
      measure === 'total' ? Number(e.amount) : Number(e.expense_shares.find((s) => s.profile_id === me?.id)?.owed ?? 0);
    const list = expenses.filter((e) => e.currency === currency);
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)));
    const byMonth = new Map(months.map((m) => [m, 0]));
    const byCategory = new Map<string, number>();
    let total = 0;
    for (const e of list) {
      const v = value(e);
      total += v;
      const m = e.spent_on.slice(0, 7);
      if (byMonth.has(m)) byMonth.set(m, byMonth.get(m)! + v);
      byCategory.set(e.category, (byCategory.get(e.category) ?? 0) + v);
    }
    return {
      total,
      months: [...byMonth.entries()],
      categories: [...byCategory.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
    };
  }, [expenses, currency, measure, me?.id]);

  const thisMonth = data.months[5]?.[1] ?? 0;
  const lastMonth = data.months[4]?.[1] ?? 0;
  const change = lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null;
  const maxMonth = Math.max(...data.months.map(([, v]) => v), 1);
  const maxCat = data.categories[0]?.[1] ?? 1;
  const shown = selectedMonth ?? data.months[5]?.[0];

  return (
    <Screen>
      <Stack.Screen options={{ title: group ? `${group.name} totals` : 'Insights' }} />
      {expenses.length === 0 ? (
        <EmptyState icon="chart.bar.fill" title="No spending yet" message="Insights appear once you have a few expenses." />
      ) : (
        <>
          <View style={styles.controls}>
            {groupId && (
              <Segmented
                options={[
                  { value: 'mine', label: 'My share' },
                  { value: 'total', label: 'Group spending' },
                ]}
                value={measure}
                onChange={setMeasure}
              />
            )}
            {currencies.length > 1 && (
              <Segmented options={currencies.slice(0, 4).map((c) => ({ value: c, label: c }))} value={currency} onChange={setCurrency} />
            )}
          </View>

          {/* Headline */}
          <View style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.label, { color: t.secondary }]}>
              {measure === 'mine' ? 'Your share' : 'Group spending'} · all time
            </Text>
            <Text style={[styles.hero, { color: t.text }]} adjustsFontSizeToFit numberOfLines={1}>
              {formatMoney(data.total, currency)}
            </Text>
            <Text style={{ color: t.secondary, fontSize: 15 }}>
              {formatMoney(thisMonth, currency)} this month
              {change != null && (
                <Text style={{ color: t.text, fontWeight: '600' }}>
                  {'  '}
                  {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change)}% vs last month
                </Text>
              )}
            </Text>
          </View>

          {/* Monthly trend */}
          <View style={[styles.card, { backgroundColor: t.card }]}>
            <View style={styles.cardHeader}>
              <Text style={[styles.title, { color: t.text }]}>Last 6 months</Text>
              {shown && (
                <Text style={{ color: t.secondary, fontSize: 14, fontVariant: ['tabular-nums'] }}>
                  {new Date(`${shown}-15`).toLocaleDateString(undefined, { month: 'short' })} ·{' '}
                  <Text style={{ color: t.text, fontWeight: '600' }}>
                    {formatMoney(data.months.find(([m]) => m === shown)?.[1] ?? 0, currency)}
                  </Text>
                </Text>
              )}
            </View>
            <View style={styles.chart} accessibilityRole="summary">
              {data.months.map(([m, v]) => {
                const active = m === shown;
                return (
                  <Pressable
                    key={m}
                    style={styles.barCol}
                    onPress={() => {
                      haptic.tap();
                      setSelectedMonth(m);
                    }}
                    accessibilityLabel={`${m}: ${formatMoney(v, currency)}`}
                  >
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.bar,
                          { height: `${Math.max((v / maxMonth) * 100, v > 0 ? 3 : 0)}%`, backgroundColor: t.accent, opacity: active ? 1 : 0.45 },
                        ]}
                      />
                    </View>
                    <Text style={[styles.barLabel, { color: active ? t.text : t.secondary, fontWeight: active ? '600' : '400' }]}>
                      {new Date(`${m}-15`).toLocaleDateString(undefined, { month: 'narrow' })}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* By category */}
          <View style={[styles.card, { backgroundColor: t.card }]}>
            <Text style={[styles.title, { color: t.text, marginBottom: space.md }]}>By category</Text>
            {data.categories.map(([id, v]) => {
              const c = categoryById(id);
              const pct = data.total > 0 ? Math.round((v / data.total) * 100) : 0;
              return (
                <View key={id} style={styles.catRow}>
                  <CategoryTile category={id} size={32} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <View style={styles.catText}>
                      <Text style={{ color: t.text, fontSize: 15, fontWeight: '500' }}>{c.label}</Text>
                      <Text style={{ color: t.text, fontSize: 15, fontVariant: ['tabular-nums'] }}>
                        {formatMoney(v, currency)}
                        <Text style={{ color: t.secondary }}>  {pct}%</Text>
                      </Text>
                    </View>
                    <View style={[styles.hTrack, { backgroundColor: t.fill }]}>
                      <View style={[styles.hBar, { width: `${(v / maxCat) * 100}%`, backgroundColor: t.accent }]} />
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: space.lg, gap: space.sm, marginBottom: space.lg },
  card: { marginHorizontal: space.lg, marginBottom: space.lg, borderRadius: radius.xl, borderCurve: 'continuous', padding: space.xl },
  label: { fontSize: 14, fontWeight: '500' },
  hero: { fontSize: 44, fontWeight: '700', letterSpacing: -1, marginVertical: 2, fontVariant: ['tabular-nums'] },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.lg },
  title: { fontSize: 17, fontWeight: '600' },
  chart: { flexDirection: 'row', height: 150, gap: 2 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { flex: 1, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '62%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  barLabel: { fontSize: 12, marginTop: 6 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  catText: { flexDirection: 'row', justifyContent: 'space-between' },
  hTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  hBar: { height: 6, borderRadius: 3 },
});
