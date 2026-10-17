import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { font, motion, space, useTheme, R, PILL } from '@/theme';
import { Glass } from './Glass';
import { Icon, type IconName } from './Icon';
import { T } from './Text';

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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Shared press-down spring for non-glass pressables. */
function usePress() {
  const p = useSharedValue(0);
  // scale only: opacity stays free for the disabled state
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 - p.get() * 0.035 }] }));
  return {
    style,
    onPressIn: () => p.set(withSpring(1, motion.press)),
    onPressOut: () => p.set(withSpring(0, motion.press)),
  };
}

type ButtonVariant = 'primary' | 'glass' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  size = 'md',
  loading,
  disabled,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const press = usePress();
  const height = { sm: 38, md: 48, lg: 56 }[size];
  const fg = variant === 'primary' ? t.accentInk : variant === 'danger' ? t.danger : variant === 'ghost' ? t.accentText : t.ink;
  const handle = () => {
    haptic.tap();
    onPress?.();
  };
  const content = (
    <View style={[styles.buttonInner, { height, paddingHorizontal: size === 'sm' ? 14 : 22 }]}>
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'sm' ? 16 : 19} color={fg} />}
          <T variant={size === 'sm' ? 'label' : 'bodyStrong'} style={{ color: fg, fontFamily: font.semibold }}>
            {title}
          </T>
        </>
      )}
    </View>
  );

  if (variant === 'glass' || variant === 'danger') {
    return (
      <Glass variant="pill" onPress={handle} disabled={disabled || loading} style={style} accessibilityLabel={title} tint={variant === 'danger' ? t.dangerSoft : undefined}>
        {content}
      </Glass>
    );
  }
  if (variant === 'ghost') {
    return (
      <AnimatedPressable onPress={handle} disabled={disabled || loading} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={title} style={[press.style, { opacity: disabled ? 0.45 : 1 }, style]}>
        {content}
      </AnimatedPressable>
    );
  }
  // primary: solid green pill with the same sheen + rim as glass
  return (
    <AnimatedPressable
      onPress={handle}
      disabled={disabled || loading}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || loading }}
      style={[
        styles.primary,
        { backgroundColor: t.accent, borderColor: 'rgba(255,255,255,0.35)', boxShadow: `0px 8px 18px -8px ${t.accent}`, opacity: disabled ? 0.45 : 1 },
        press.style,
        style,
      ]}
    >
      <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.32)', 'rgba(255,255,255,0)']} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      {content}
    </AnimatedPressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  size = 40,
  plain,
  color,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  plain?: boolean;
  color?: string;
}) {
  const t = useTheme();
  const press = usePress();
  const handle = () => {
    haptic.tap();
    onPress();
  };
  if (plain) {
    return (
      <AnimatedPressable onPress={handle} hitSlop={8} onPressIn={press.onPressIn} onPressOut={press.onPressOut} accessibilityRole="button" accessibilityLabel={label} style={[styles.center, { width: size, height: size }, press.style]}>
        <Icon name={icon} size={size * 0.55} color={color ?? t.ink} />
      </AnimatedPressable>
    );
  }
  return (
    <Glass variant="pill" onPress={handle} accessibilityLabel={label} contentStyle={[styles.center, { width: size, height: size }]}>
      <Icon name={icon} size={size * 0.5} color={color ?? t.ink} />
    </Glass>
  );
}

type FieldProps = TextInputProps & {
  label?: string;
  icon?: IconName;
  right?: ReactNode;
  error?: string | null;
  hint?: string;
  big?: boolean;
};

export const Field = forwardRef<TextInput, FieldProps>(function Field({ label, icon, right, error, hint, big, style, onFocus, onBlur, multiline, ...rest }, ref) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      {label && (
        <T variant="label" tone="dim" style={{ marginLeft: 6 }}>
          {label}
        </T>
      )}
      <Glass radius={multiline ? R : PILL} tint={focused ? t.accentSoft : undefined} style={focused ? { boxShadow: `0px 0px 0px 1.5px ${t.accent}` } : undefined}>
        <View style={[styles.field, multiline && { alignItems: 'flex-start', paddingVertical: 12 }]}>
          {icon && <Icon name={icon} size={20} color={focused ? t.accentText : t.inkDim} />}
          <TextInput
            ref={ref}
            placeholderTextColor={t.inkFaint}
            selectionColor={t.accent}
            cursorColor={t.accent}
            multiline={multiline}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[
              styles.input,
              { color: t.ink, fontFamily: big ? font.semibold : font.regular, fontSize: big ? 22 : 16 },
              multiline && { minHeight: 64, textAlignVertical: 'top' },
              style,
            ]}
            {...rest}
          />
          {right}
        </View>
      </Glass>
      {(error || hint) && (
        <T variant="caption" tone={error ? 'danger' : 'dim'} style={{ marginLeft: 6 }}>
          {error ?? hint}
        </T>
      )}
    </View>
  );
});

/** Glass segmented control with a sliding thumb. */
export function Segmented<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; icon?: IconName }[];
  value: V;
  onChange: (v: V) => void;
}) {
  const t = useTheme();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const seg = width ? (width - 8) / options.length : 0;
  const x = useSharedValue(0);
  useEffect(() => {
    if (seg) x.set(withSpring(index * seg, motion.snappy));
  }, [seg, index, x]);
  const thumb = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));

  return (
    <Glass variant="pill" contentStyle={{ padding: 4 }}>
      <View style={styles.segRow} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width + 8)}>
        {seg > 0 && (
          <Animated.View
            style={[
              styles.segThumb,
              { width: seg, backgroundColor: t.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.92)', boxShadow: `0px 2px 8px -2px ${t.drop}`, borderColor: t.rimTop },
              thumb,
            ]}
          />
        )}
        {options.map((o) => {
          const on = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={o.label}
              onPress={() => {
                if (!on) haptic.tap();
                onChange(o.value);
              }}
              style={styles.segItem}
            >
              {o.icon && <Icon name={o.icon} size={16} color={on ? t.ink : t.inkDim} />}
              <T variant="label" style={{ color: on ? t.ink : t.inkDim, fontFamily: on ? font.semibold : font.medium }} numberOfLines={1}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </Glass>
  );
}

export function Switch({ value, onValueChange, label }: { value: boolean; onValueChange: (v: boolean) => void; label?: string }) {
  const t = useTheme();
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.set(withSpring(value ? 1 : 0, motion.snappy));
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: 2 + x.get() * 20 }] }));
  const track = useAnimatedStyle(() => ({ opacity: x.get() }));
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => {
        haptic.tap();
        onValueChange(!value);
      }}
      style={[styles.switch, { backgroundColor: t.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.10)' }]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: t.accent, borderRadius: 16 }, track]} />
      <Animated.View style={[styles.knob, { boxShadow: '0px 2px 6px rgba(0,0,0,0.25)' }, knob]} />
    </Pressable>
  );
}

/** Round check (multi-select) or radio (single-select). */
export function Check({ checked, onPress, radio, label }: { checked: boolean; onPress?: () => void; radio?: boolean; label?: string }) {
  const t = useTheme();
  const body = (
    <View
      style={[
        styles.check,
        checked
          ? { backgroundColor: t.accent, borderColor: t.accent }
          : { borderColor: t.dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)', backgroundColor: t.glassTint },
      ]}
    >
      {checked && (radio ? <View style={[styles.radioDot, { backgroundColor: t.accentInk }]} /> : <Icon name="check-bold" size={14} color={t.accentInk} />)}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable hitSlop={10} onPress={onPress} accessibilityRole={radio ? 'radio' : 'checkbox'} accessibilityState={{ checked }} accessibilityLabel={label}>
      {body}
    </Pressable>
  );
}

export function Chip({
  label,
  icon,
  leading,
  selected,
  onPress,
}: {
  label: string;
  icon?: IconName;
  leading?: ReactNode;
  selected?: boolean;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Glass
      variant="pill"
      onPress={
        onPress &&
        (() => {
          haptic.tap();
          onPress();
        })
      }
      tint={selected ? t.accentSoft : undefined}
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      contentStyle={styles.chip}
    >
      {leading}
      {icon && <Icon name={icon} size={16} color={selected ? t.accentText : t.inkDim} />}
      <T variant="label" style={{ color: selected ? t.accentText : t.ink, fontFamily: font.semibold }} numberOfLines={1}>
        {label}
      </T>
    </Glass>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  primary: { borderRadius: PILL, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth * 2 },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.xl, minHeight: 52 },
  input: { flex: 1, paddingVertical: 12, outlineStyle: 'none' } as never,
  segRow: { flexDirection: 'row' },
  segThumb: { position: 'absolute', top: 0, bottom: 0, left: 0, borderRadius: PILL, borderWidth: StyleSheet.hairlineWidth },
  segItem: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 38, paddingHorizontal: 6 },
  switch: { width: 50, height: 30, borderRadius: 16, justifyContent: 'center', overflow: 'hidden' },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#FFFFFF' },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 9, height: 9, borderRadius: 5 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36 },
});
