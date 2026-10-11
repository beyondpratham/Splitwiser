import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { formatMoney } from '@/lib/money';
import { space, useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

export const haptic = {
  tap: () => {
    Haptics.selectionAsync().catch(() => {});
  },
  success: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  error: () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
};

export function Loading() {
  const t = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: t.colors.surface }]}>
      <ActivityIndicator size="large" />
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.empty}>
      <Animated.View entering={ZoomIn.springify().damping(12)} style={[styles.emptyIcon, { backgroundColor: t.colors.primaryContainer }]}>
        <Icon name={icon} size={36} color={t.colors.onPrimaryContainer} />
      </Animated.View>
      <Text variant="titleLarge" style={{ textAlign: 'center', color: t.colors.onSurface }}>
        {title}
      </Text>
      {message && (
        <Text variant="bodyMedium" style={{ textAlign: 'center', color: t.colors.onSurfaceVariant, marginBottom: space.sm }}>
          {message}
        </Text>
      )}
      {action}
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
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(start + (target - start) * eased);
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
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]} numberOfLines={1} adjustsFontSizeToFit>
      {formatMoney(value, currency)}
    </Text>
  );
}

/** Right-aligned two-line amount label used in lists. Positive = good for me. */
export function AmountLabel({ amount, currency, positiveLabel, negativeLabel }: { amount: number; currency: string; positiveLabel: string; negativeLabel: string }) {
  const t = useTheme();
  if (Math.abs(amount) < 0.005)
    return (
      <Text variant="labelMedium" style={{ color: t.colors.onSurfaceVariant }}>
        settled
      </Text>
    );
  const color = amount > 0 ? t.colors.owed : t.colors.owe;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text variant="labelSmall" style={{ color }}>
        {amount > 0 ? positiveLabel : negativeLabel}
      </Text>
      <Text variant="titleSmall" style={{ color, fontVariant: ['tabular-nums'] }}>
        {formatMoney(Math.abs(amount), currency)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingVertical: 48, gap: space.md },
  emptyIcon: { width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
});
