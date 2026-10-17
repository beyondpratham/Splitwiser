import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { createContext, useContext, type ReactNode, type RefObject } from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion, R, useTheme } from '@/theme';

/** Android only blurs content inside a BlurTargetView; screens provide theirs through this context. */
export const BlurTargetContext = createContext<RefObject<View | null> | null>(null);

export type GlassVariant = 'card' | 'pane' | 'pill' | 'chrome';

interface GlassProps {
  children?: ReactNode;
  variant?: GlassVariant;
  /** Real backdrop blur (use for floating chrome; plain cards look the same without it). */
  blur?: boolean;
  /** Denser tint, e.g. for sheets and dialogs. */
  strong?: boolean;
  radius?: number;
  onPress?: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'tab' | 'link' | 'none';
  accessibilityState?: { selected?: boolean; disabled?: boolean; checked?: boolean };
  /** Extra layer painted under the content (e.g. a selected tint). */
  tint?: string;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Liquid glass surface, after the portfolio's `.lg` component: translucent tint, a rim that is bright
 * on top and dark on the flanks, a top sheen plus a diagonal band, and a soft drop shadow. Pressable
 * glass sinks slightly while held.
 */
export function Glass({
  children,
  variant = 'card',
  blur,
  strong,
  radius,
  onPress,
  onLongPress,
  disabled,
  style,
  contentStyle,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  tint,
}: GlassProps) {
  const t = useTheme();
  const target = useContext(BlurTargetContext);
  const pressed = useSharedValue(0);
  const r = radius ?? R;

  const drop =
    variant === 'pane' || variant === 'chrome'
      ? `0px 1px 2px rgba(0,0,0,0.05), 0px 10px 22px -10px ${t.drop}, 0px 28px 48px -32px ${t.drop}`
      : `0px 1px 2px rgba(0,0,0,0.05), 0px 8px 18px -12px ${t.drop}`;

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.get() * 0.035 }],
  }));
  const pressTint = useAnimatedStyle(() => ({ opacity: pressed.get() }));

  // Android needs a target to blur; without one, a denser tint keeps text legible.
  const canBlur = blur && (Platform.OS !== 'android' || !!target);
  const base = strong || (blur && !canBlur) ? t.glassStrong : t.glassTint;

  const surface = (
    <View
      style={[
        styles.surface,
        {
          borderRadius: r,
          backgroundColor: canBlur ? 'transparent' : base,
          borderTopColor: t.rimTop,
          borderLeftColor: t.rimSide,
          borderRightColor: t.rimSide,
          borderBottomColor: t.rimBottom,
        },
      ]}
    >
      {canBlur && (
        <>
          <BlurView
            intensity={variant === 'chrome' ? 60 : 40}
            tint={t.blurTint}
            style={StyleSheet.absoluteFill}
            {...(Platform.OS === 'android' && target ? { blurTarget: target, blurMethod: 'dimezisBlurViewSdk31Plus' as const } : {})}
          />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: strong ? t.glassStrong : t.glassTint }]} />
        </>
      )}
      {tint && <View style={[StyleSheet.absoluteFill, { backgroundColor: tint }]} />}
      <LinearGradient pointerEvents="none" colors={[t.sheen, 'transparent']} locations={[0, 0.32]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        pointerEvents="none"
        colors={['transparent', t.sheenDiag, 'transparent']}
        start={{ x: 0, y: 0.15 }}
        end={{ x: 1, y: 0.85 }}
        style={StyleSheet.absoluteFill}
      />
      {(onPress || onLongPress) && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.glassPressed }, pressTint]} />}
      <View style={contentStyle}>{children}</View>
    </View>
  );

  if (!onPress && !onLongPress) {
    return <View style={[{ borderRadius: r, boxShadow: drop }, style]}>{surface}</View>;
  }
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={() => pressed.set(withSpring(1, motion.press))}
      onPressOut={() => pressed.set(withSpring(0, motion.press))}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityRole ?? 'button'}
      accessibilityState={{ disabled, ...accessibilityState }}
      style={[{ borderRadius: r, boxShadow: drop, opacity: disabled ? 0.45 : 1 }, animated, style]}
    >
      {surface}
    </AnimatedPressable>
  );
}

/** The solid app background the glass sits on: very light green (light) or deep green (dark). */
export function Backdrop() {
  const t = useTheme();
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: t.bg }]} />;
}

const styles = StyleSheet.create({
  surface: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2 },
});
