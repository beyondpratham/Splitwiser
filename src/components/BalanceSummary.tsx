import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { entries, type CurrencyMap } from '@/lib/balances';
import { formatMoney } from '@/lib/money';
import { usePrefs } from '@/lib/prefs';
import { space, useTheme } from '@/theme';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { T } from './Text';
import { AnimatedMoney } from './ui';

const MASK = '••••••';

/** Headline pane: overall net balance plus what you're owed and what you owe. Respects "Hide balances". */
export function BalanceSummary({ total, owedToMe, iOwe }: { total: CurrencyMap; owedToMe: CurrencyMap; iOwe: CurrencyMap }) {
  const t = useTheme();
  const { prefs } = usePrefs();
  const [revealed, setRevealed] = useState(false);
  const hidden = prefs.privacy.hideBalances && !revealed;
  const net = entries(total);
  const primary = net[0];
  const positive = primary ? primary[1] > 0 : true;

  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.wrap}>
      <Glass
        variant="pane"
        contentStyle={styles.card}
        onPress={prefs.privacy.hideBalances ? () => setRevealed(!revealed) : undefined}
        accessibilityLabel={hidden ? 'Show balances' : undefined}
      >
        <View style={styles.headRow}>
          <T variant="label" tone="dim" style={{ flex: 1 }}>
            {!primary ? 'You’re all settled up' : positive ? 'Overall, you are owed' : 'Overall, you owe'}
          </T>
          {prefs.privacy.hideBalances && <Icon name={hidden ? 'eye-off-outline' : 'eye-outline'} size={18} color={t.inkDim} />}
        </View>
        {primary ? (
          hidden ? (
            <T variant="display" style={{ color: positive ? t.owed : t.owe, fontSize: 40, lineHeight: 48 }}>
              {MASK}
            </T>
          ) : (
            <Animated.View entering={FadeIn.duration(200)}>
              <AnimatedMoney amount={Math.abs(primary[1])} currency={primary[0]} style={{ color: positive ? t.owed : t.owe, fontSize: 40, lineHeight: 48 }} />
              {net.slice(1).map(([cur, v]) => (
                <T key={cur} variant="subhead" numeric tone={v > 0 ? 'owed' : 'owe'}>
                  {v > 0 ? '+ ' : '− '}
                  {formatMoney(Math.abs(v), cur)}
                </T>
              ))}
            </Animated.View>
          )
        ) : (
          <View style={styles.settled}>
            <Icon name="check-decagram" size={30} color={t.accent} />
            <T variant="title">Nothing to settle</T>
          </View>
        )}
        <View style={styles.stats}>
          <Stat label="You are owed" map={owedToMe} icon="arrow-bottom-left" tone="owed" hidden={hidden} />
          <View style={[styles.divider, { backgroundColor: t.line }]} />
          <Stat label="You owe" map={iOwe} icon="arrow-top-right" tone="owe" hidden={hidden} />
        </View>
        {hidden && (
          <T variant="caption" tone="faint">
            Tap to show
          </T>
        )}
      </Glass>
    </Animated.View>
  );
}

function Stat({ label, map, icon, tone, hidden }: { label: string; map: CurrencyMap; icon: 'arrow-bottom-left' | 'arrow-top-right'; tone: 'owed' | 'owe'; hidden: boolean }) {
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
      ) : hidden ? (
        <T variant="subhead" tone={tone}>
          {MASK}
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
  headRow: { flexDirection: 'row', alignItems: 'center' },
  settled: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.sm },
  stats: { flexDirection: 'row', marginTop: space.lg, alignItems: 'stretch' },
  divider: { width: StyleSheet.hairlineWidth, marginHorizontal: space.lg },
  stat: { flex: 1, gap: 2 },
});
