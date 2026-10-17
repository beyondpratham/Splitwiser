import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { CategoryTile } from '@/components/Avatar';
import { Segmented } from '@/components/Controls';
import { Glass } from '@/components/Glass';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { AnimatedMoney, EmptyState, haptic } from '@/components/ui';
import { useGroup, useGroupExpenses, useMe, useMyExpenses } from '@/lib/api';
import { categoryById } from '@/lib/categories';
import { formatMoney } from '@/lib/money';
import type { Expense } from '@/lib/types';
import { motion, space, useTheme } from '@/theme';

type Measure = 'mine' | 'total';
const CHART_HEIGHT = 150;

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
    <Page title={group ? `${group.name} totals` : 'Insights'} back variant="large">
      {expenses.length === 0 ? (
        <EmptyState icon="chart-bar" title="No spending yet" message="Insights appear once you have a few expenses." />
      ) : (
        <>
          <View style={styles.controls}>
            {groupId && (
              <Segmented<Measure>
                value={measure}
                onChange={setMeasure}
                options={[
                  { value: 'mine', label: 'My share', icon: 'account-outline' },
                  { value: 'total', label: 'Group spending', icon: 'account-group-outline' },
                ]}
              />
            )}
            {currencies.length > 1 && <Segmented value={currency} onChange={setCurrency} options={currencies.slice(0, 4).map((c) => ({ value: c, label: c }))} />}
          </View>

          <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.section}>
            <Glass variant="pane" tint={t.accentSoft} contentStyle={styles.card}>
              <T variant="label" tone="dim">
                {measure === 'mine' ? 'Your share' : 'Group spending'} · all time
              </T>
              <AnimatedMoney amount={data.total} currency={currency} style={{ fontSize: 40, lineHeight: 48, color: t.accentText }} />
              <T variant="caption" tone="dim">
                {formatMoney(thisMonth, currency)} this month
                {change != null && (
                  <T variant="caption" style={{ fontFamily: 'Inter_600SemiBold' }}>
                    {'  '}
                    {change > 0 ? '▲' : change < 0 ? '▼' : ''} {Math.abs(change)}% vs last month
                  </T>
                )}
              </T>
            </Glass>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={styles.section}>
            <Glass variant="pane" contentStyle={styles.card}>
              <View style={styles.cardHeader}>
                <T variant="subhead">Last 6 months</T>
                {shown && (
                  <T variant="caption" tone="dim" numeric>
                    {new Date(`${shown}-15`).toLocaleDateString(undefined, { month: 'short' })} ·{' '}
                    <T variant="caption" numeric style={{ fontFamily: 'Inter_700Bold' }}>
                      {formatMoney(data.months.find(([m]) => m === shown)?.[1] ?? 0, currency)}
                    </T>
                  </T>
                )}
              </View>
              <View style={styles.chart}>
                {data.months.map(([m, v], i) => (
                  <MonthBar
                    key={m}
                    label={new Date(`${m}-15`).toLocaleDateString(undefined, { month: 'narrow' })}
                    height={v > 0 ? Math.max((v / maxMonth) * CHART_HEIGHT, 4) : 0}
                    active={m === shown}
                    delay={i * 50}
                    accessibilityLabel={`${m}: ${formatMoney(v, currency)}`}
                    onPress={() => {
                      haptic.tap();
                      setSelectedMonth(m);
                    }}
                  />
                ))}
              </View>
            </Glass>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(160).springify().damping(18)} style={styles.section}>
            <Glass variant="pane" contentStyle={styles.card}>
              <T variant="subhead" style={{ marginBottom: space.sm }}>
                By category
              </T>
              {data.categories.map(([id, v], i) => {
                const pct = data.total > 0 ? Math.round((v / data.total) * 100) : 0;
                return (
                  <View key={id} style={styles.catRow}>
                    <CategoryTile category={id} size={36} />
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={styles.catText}>
                        <T variant="label">{categoryById(id).label}</T>
                        <T variant="label" numeric>
                          {formatMoney(v, currency)}
                          <T variant="caption" tone="dim">
                            {' '}
                            {pct}%
                          </T>
                        </T>
                      </View>
                      <CategoryBar fraction={v / maxCat} delay={i * 60} />
                    </View>
                  </View>
                );
              })}
            </Glass>
          </Animated.View>
        </>
      )}
    </Page>
  );
}

function MonthBar({
  label,
  height,
  active,
  delay,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  height: number;
  active: boolean;
  delay: number;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const t = useTheme();
  const h = useSharedValue(0);
  const on = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    h.set(withDelay(delay, withSpring(height, motion.smooth)));
  }, [height, delay, h]);
  useEffect(() => {
    on.set(withTiming(active ? 1 : 0, { duration: 200 }));
  }, [active, on]);
  const style = useAnimatedStyle(() => ({ height: h.get(), opacity: 0.45 + 0.55 * on.get() }));
  return (
    <Pressable style={styles.barCol} onPress={onPress} accessibilityLabel={accessibilityLabel}>
      <View style={styles.barTrack}>
        <Animated.View style={[styles.bar, { backgroundColor: t.accent }, style]} />
      </View>
      <T variant="caption" style={{ marginTop: 6, color: active ? t.ink : t.inkDim, fontFamily: active ? 'Inter_700Bold' : 'Inter_400Regular' }}>
        {label}
      </T>
    </Pressable>
  );
}

function CategoryBar({ fraction, delay }: { fraction: number; delay: number }) {
  const t = useTheme();
  const w = useSharedValue(0);
  useEffect(() => {
    w.set(withDelay(delay, withSpring(fraction, motion.smooth)));
  }, [fraction, delay, w]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleX: w.get() }] }));
  return (
    <View style={[styles.hTrack, { backgroundColor: (t.dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.07)') }]}>
      <Animated.View style={[styles.hBar, { backgroundColor: t.accent }, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { paddingHorizontal: space.lg, gap: space.sm, marginBottom: space.lg },
  section: { marginHorizontal: space.lg, marginBottom: space.lg },
  card: { padding: space.xl },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: space.lg },
  chart: { flexDirection: 'row', height: CHART_HEIGHT + 24, gap: 2 },
  barCol: { flex: 1, alignItems: 'center' },
  barTrack: { height: CHART_HEIGHT, width: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '58%', borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  catText: { flexDirection: 'row', justifyContent: 'space-between' },
  hTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  hBar: { height: 8, borderRadius: 4, width: '100%', transformOrigin: 'left' },
});
