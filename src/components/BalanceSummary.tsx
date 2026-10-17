import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { entries, type CurrencyMap } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { space, useTheme } from '@/theme';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { T } from './Text';
import { AnimatedMoney } from './ui';

/** Headline pane: overall net balance plus what you're owed and what you owe. */
export function BalanceSummary({ total, owedToMe, iOwe }: { total: CurrencyMap; owedToMe: CurrencyMap; iOwe: CurrencyMap }) {
  const t = useTheme();
  const net = entries(total);
  const primary = net[0];
  const positive = primary ? primary[1] > 0 : true;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.wrap}>
      <Glass variant="pane" contentStyle={styles.card}>
        <T variant="label" tone="dim">
          {!primary ? 'You’re all settled up' : positive ? 'Overall, you are owed' : 'Overall, you owe'}
        </T>
        {primary ? (
          <>
            <AnimatedMoney amount={Math.abs(primary[1])} currency={primary[0]} style={{ color: positive ? t.owed : t.owe, fontSize: 40, lineHeight: 48 }} />
            {net.slice(1).map(([cur, v]) => (
              <T key={cur} variant="subhead" numeric tone={v > 0 ? 'owed' : 'owe'}>
                {v > 0 ? '+ ' : '− '}
                {formatMoney(Math.abs(v), cur)}
              </T>
            ))}
          </>
        ) : (
          <View style={styles.settled}>
            <Icon name="check-decagram" size={30} color={t.accent} />
            <T variant="title">Nothing to settle</T>
          </View>
        )}
        <View style={styles.stats}>
          <Stat label="You are owed" map={owedToMe} icon="arrow-bottom-left" tone="owed" />
          <View style={[styles.divider, { backgroundColor: t.line }]} />
          <Stat label="You owe" map={iOwe} icon="arrow-top-right" tone="owe" />
        </View>
      </Glass>
    </Animated.View>
  );
}

function Stat({ label, map, icon, tone }: { label: string; map: CurrencyMap; icon: 'arrow-bottom-left' | 'arrow-top-right'; tone: 'owed' | 'owe' }) {
  const t = useTheme();
  const list = entries(map);
  return (
    <View style={styles.stat}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name={icon} size={15} color={tone === 'owed' ? t.owed : t.owe} />
        <T variant="caption" tone="dim">
          {label}
        </T>
      </View>
      {list.length === 0 ? (
        <T variant="subhead" tone="faint">
          —
        </T>
      ) : (
        list.slice(0, 3).map(([cur, v]) => (
          <T key={cur} variant="subhead" numeric numberOfLines={1} adjustsFontSizeToFit tone={tone}>
            {formatMoney(Math.abs(v), cur)}
          </T>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginHorizontal: space.lg, marginBottom: space.xl },
  card: { padding: space.xl, gap: 2 },
  settled: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.sm },
  stats: { flexDirection: 'row', marginTop: space.lg, alignItems: 'stretch' },
  divider: { width: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
  stat: { flex: 1, gap: 2 },
});
