import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { space, useTheme } from '@/theme';
import { Backdrop, Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

export { haptic } from './Controls';

export function Loading() {
  const t = useTheme();
  return (
    <View style={styles.center}>
      <Backdrop />
      <ActivityIndicator size="large" color={t.accent} />
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
      <Animated.View entering={ZoomIn.springify().damping(13)}>
        <Glass variant="pill" tint={t.accentSoft} contentStyle={styles.emptyIcon}>
          <Icon name={icon} size={34} color={t.accentText} />
        </Glass>
      </Animated.View>
      <T variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </T>
      {message && (
        <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
          {message}
        </T>
      )}
      {action && <View style={{ marginTop: space.sm }}>{action}</View>}
    </Animated.View>
  );
}

/** Animates a number from its previous value to the new one (ease-out cubic). */
export function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    const t0 = Date.now();
    let frame = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - t0) / duration);
      setValue(start + (target - start) * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = target;
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      from.current = target;
    };
  }, [target, duration]);
  return value;
}

export function AnimatedMoney({ amount, currency, style }: { amount: number; currency: string; style?: StyleProp<TextStyle> }) {
  const value = useCountUp(amount);
  return (
    <T variant="display" numeric numberOfLines={1} adjustsFontSizeToFit style={style}>
      {formatMoney(value, currency)}
    </T>
  );
}

/** Right-aligned "owes you / you owe" amount used in lists. Positive = good for me. */
export function AmountLabel({ amount, currency, positiveLabel, negativeLabel }: { amount: number; currency: string; positiveLabel: string; negativeLabel: string }) {
  if (Math.abs(amount) < 0.005)
    return (
      <T variant="caption" tone="faint">
        settled up
      </T>
    );
  const tone = amount > 0 ? 'owed' : 'owe';
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <T variant="caption" tone={tone}>
        {amount > 0 ? positiveLabel : negativeLabel}
      </T>
      <T variant="subhead" tone={tone} numeric>
        {formatMoney(Math.abs(amount), currency)}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingVertical: 40, gap: space.md },
  emptyIcon: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
});
