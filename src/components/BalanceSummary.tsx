import { StyleSheet, Text, View } from 'react-native';
import { entries, type CurrencyMap } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { radius, space, useTheme } from '@/theme';

/** Big headline card: total net balance plus the owed / owe split. */
export function BalanceSummary({ total, owedToMe, iOwe }: { total: CurrencyMap; owedToMe: CurrencyMap; iOwe: CurrencyMap }) {
  const t = useTheme();
  const net = entries(total);
  const primary = net[0];
  const headline = !primary
    ? 'You’re all settled up'
    : primary[1] > 0
      ? 'Overall, you are owed'
      : 'Overall, you owe';

  return (
    <View style={[styles.card, { backgroundColor: t.card }]}>
      <Text style={[styles.label, { color: t.secondary }]}>{headline}</Text>
      {primary ? (
        <>
          <Text
            style={[styles.amount, { color: primary[1] > 0 ? t.owed : t.owe }]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatMoney(Math.abs(primary[1]), primary[0])}
          </Text>
          {net.slice(1).map(([cur, v]) => (
            <Text key={cur} style={[styles.extra, { color: v > 0 ? t.owed : t.owe }]}>
              {v > 0 ? '+ ' : '− '}
              {formatMoney(Math.abs(v), cur)}
            </Text>
          ))}
        </>
      ) : (
        <Text style={[styles.amount, { color: t.text }]}>🎉</Text>
      )}
      <View style={[styles.split, { borderTopColor: t.separator }]}>
        <Stat label="You are owed" map={owedToMe} color={t.owed} muted={t.secondary} />
        <View style={[styles.divider, { backgroundColor: t.separator }]} />
        <Stat label="You owe" map={iOwe} color={t.owe} muted={t.secondary} />
      </View>
    </View>
  );
}

function Stat({ label, map, color, muted }: { label: string; map: CurrencyMap; color: string; muted: string }) {
  const list = entries(map);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color: muted }]}>{label}</Text>
      {list.length === 0 ? (
        <Text style={[styles.statValue, { color: muted }]}>—</Text>
      ) : (
        list.slice(0, 2).map(([cur, v]) => (
          <Text key={cur} style={[styles.statValue, { color }]} numberOfLines={1}>
            {formatMoney(Math.abs(v), cur)}
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, marginBottom: space.xl, borderRadius: radius.xl, borderCurve: 'continuous', paddingTop: space.xl, overflow: 'hidden' },
  label: { fontSize: 15, fontWeight: '500', paddingHorizontal: space.xl },
  amount: { fontSize: 44, fontWeight: '700', letterSpacing: -1, paddingHorizontal: space.xl, marginTop: 2, fontVariant: ['tabular-nums'] },
  extra: { fontSize: 17, fontWeight: '600', paddingHorizontal: space.xl, fontVariant: ['tabular-nums'] },
  split: { flexDirection: 'row', marginTop: space.xl, borderTopWidth: StyleSheet.hairlineWidth },
  divider: { width: StyleSheet.hairlineWidth },
  stat: { flex: 1, paddingVertical: space.lg, paddingHorizontal: space.xl, gap: 2 },
  statLabel: { fontSize: 13, fontWeight: '500' },
  statValue: { fontSize: 17, fontWeight: '600', fontVariant: ['tabular-nums'] },
});
