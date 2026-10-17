import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { R, useTheme } from '@/theme';
import { Icon } from './Icon';

/** A coffee cup that tilts and steams each time the screen comes into focus. */
export function CoffeeCup({ size = 52 }: { size?: number }) {
  const t = useTheme();
  const tilt = useSharedValue(0);
  const steam = [useSharedValue(0), useSharedValue(0), useSharedValue(0)];

  useFocusEffect(
    useCallback(() => {
      tilt.set(withSequence(withTiming(-14, { duration: 180 }), withSpring(10, { dampingRatio: 0.4, duration: 500 }), withSpring(0, { dampingRatio: 0.6, duration: 600 })));
      steam.forEach((s, i) => {
        s.set(0);
        s.set(withDelay(250 + i * 180, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) })));
      });
      // shared values are stable refs
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const cup = useAnimatedStyle(() => ({ transform: [{ rotate: `${tilt.get()}deg` }] }));

  return (
    <View style={[styles.wrap, { width: size, height: size, backgroundColor: t.accentSoft }]}>
      <View style={styles.steamRow}>
        {steam.map((s, i) => (
          <Wisp key={i} progress={s} color={t.accentText} offset={(i - 1) * 7} />
        ))}
      </View>
      <Animated.View style={[cup, { transformOrigin: 'bottom' }]}>
        <Icon name="coffee" size={size * 0.52} color={t.accentText} />
      </Animated.View>
    </View>
  );
}

function Wisp({ progress, color, offset }: { progress: SharedValue<number>; color: string; offset: number }) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: p === 0 ? 0 : Math.sin(Math.PI * p) * 0.8,
      transform: [{ translateY: -p * 14 }, { translateX: offset + Math.sin(p * Math.PI * 2) * 2 }, { scaleY: 0.6 + p * 0.6 }],
    };
  });
  return <Animated.View style={[styles.wisp, { backgroundColor: color }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { borderRadius: R, alignItems: 'center', justifyContent: 'center' },
  steamRow: { position: 'absolute', top: 6, height: 12, width: '100%', alignItems: 'center' },
  wisp: { position: 'absolute', width: 2.5, height: 9, borderRadius: 2 },
});
