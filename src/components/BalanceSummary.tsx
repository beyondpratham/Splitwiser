import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { entries, type CurrencyMap } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { AnimatedMoney } from './ui';

/** Headline card: overall net balance plus the owed / owe split. */
export function BalanceSummary({ total, owedToMe, iOwe }: { total: CurrencyMap; owedToMe: CurrencyMap; iOwe: CurrencyMap }) {
  const t = useTheme();
  const net = entries(total);
  const primary = net[0];
  const positive = primary ? primary[1] > 0 : true;
  const container = !primary ? t.colors.surfaceContainerHigh : positive ? t.colors.owedContainer : t.colors.oweContainer;
  const onContainer = !primary ? t.colors.onSurface : positive ? t.colors.onOwedContainer : t.colors.onOweContainer;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={[styles.card, { backgroundColor: container }]}>
      <Text variant="labelLarge" style={{ color: onContainer, opacity: 0.8 }}>
        {!primary ? 'You’re all settled up' : positive ? 'Overall, you are owed' : 'Overall, you owe'}
      </Text>
      {primary ? (
        <>
          <AnimatedMoney amount={Math.abs(primary[1])} currency={primary[0]} style={[styles.amount, { color: onContainer }]} />
          {net.slice(1).map(([cur, v]) => (
            <Text key={cur} variant="titleMedium" style={{ color: onContainer, fontVariant: ['tabular-nums'] }}>
              {v > 0 ? '+ ' : '− '}
              {formatMoney(Math.abs(v), cur)}
            </Text>
          ))}
        </>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
          <Icon name="check-decagram" size={32} color={t.colors.primary} />
          <Text variant="headlineSmall" style={{ color: onContainer }}>
            Nothing to settle
          </Text>
        </View>
      )}
      <View style={styles.chips}>
        <Stat label="You are owed" map={owedToMe} icon="arrow-bottom-left" color={t.colors.owed} />
        <Stat label="You owe" map={iOwe} icon="arrow-top-right" color={t.colors.owe} />
      </View>
    </Animated.View>
  );
}

function Stat({ label, map, icon, color }: { label: string; map: CurrencyMap; icon: 'arrow-bottom-left' | 'arrow-top-right'; color: string }) {
  const t = useTheme();
  const list = entries(map);
  return (
    <View style={[styles.stat, { backgroundColor: t.colors.surfaceContainerLowest }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name={icon} size={16} color={color} />
        <Text variant="labelMedium" style={{ color: t.colors.onSurfaceVariant }}>
          {label}
        </Text>
      </View>
      <Text variant="titleMedium" numberOfLines={1} style={{ color: list.length ? color : t.colors.onSurfaceVariant, fontVariant: ['tabular-nums'] }}>
        {list.length === 0 ? '—' : list.slice(0, 2).map(([cur, v]) => formatMoney(Math.abs(v), cur)).join(' + ')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: space.lg, marginBottom: space.xl, borderRadius: 28, padding: space.xl, gap: 2 },
  amount: { fontSize: 44, lineHeight: 52, fontWeight: '600', letterSpacing: -0.5 },
  chips: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  stat: { flex: 1, borderRadius: 16, paddingHorizontal: space.md, paddingVertical: space.md, gap: 2 },
});
