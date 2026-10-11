import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatMoney } from '@/lib/money';
import { radius, space, useTheme } from '@/theme';
import { Icon, type SF } from './Icon';

export const haptic = {
  tap: () => {
    if (Platform.OS === 'ios') Haptics.selectionAsync();
  },
  success: () => {
    if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: () => {
    if (Platform.OS === 'ios') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
};

/** A scroll view that lets the native large-title header collapse correctly. */
export function Screen({ children, contentContainerStyle, ...rest }: ScrollViewProps & { children: ReactNode }) {
  const t = useTheme();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={[{ paddingTop: space.md, paddingBottom: 120 }, contentContainerStyle]}
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

type ButtonKind = 'filled' | 'tinted' | 'plain' | 'gray';

export function Button({
  title,
  onPress,
  kind = 'filled',
  icon,
  loading,
  disabled,
  destructive,
  style,
  size = 'large',
}: {
  title: string;
  onPress?: () => void;
  kind?: ButtonKind;
  icon?: SF;
  loading?: boolean;
  disabled?: boolean;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
  size?: 'large' | 'small';
}) {
  const t = useTheme();
  const base = destructive ? t.danger : t.accent;
  const bg = { filled: base, tinted: destructive ? 'rgba(255,59,48,0.12)' : t.accentSoft, plain: 'transparent', gray: t.fill }[kind];
  const fg = kind === 'filled' ? (destructive ? '#fff' : t.onAccent) : kind === 'gray' ? t.text : base;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress?.();
      }}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        size === 'small' && styles.buttonSmall,
        { backgroundColor: bg, opacity: disabled ? 0.4 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === 'small' ? 15 : 18} color={fg} weight="semibold" />}
          <Text style={[styles.buttonText, size === 'small' && { fontSize: 15 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

/** Pill-shaped floating action button that sits above the tab bar. */
export function FloatingButton({ title, icon = 'plus', onPress }: { title: string; icon?: SF; onPress: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.fabWrap, { bottom: Math.max(insets.bottom, 12) + (Platform.OS === 'ios' ? 64 : 16) }]}>
      <Pressable
        onPress={() => {
          haptic.tap();
          onPress();
        }}
        style={({ pressed }) => [styles.fab, { backgroundColor: t.accent, transform: [{ scale: pressed ? 0.96 : 1 }] }]}
      >
        <Icon name={icon} size={18} color={t.onAccent} weight="bold" />
        <Text style={[styles.fabText, { color: t.onAccent }]}>{title}</Text>
      </Pressable>
    </View>
  );
}

export function HeaderButton({ title, icon, onPress, bold, disabled }: { title?: string; icon?: SF; onPress: () => void; bold?: boolean; disabled?: boolean }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={12} style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.5 : 1, paddingHorizontal: 4 })}>
      {icon ? (
        <Icon name={icon} size={22} color={t.accent} />
      ) : (
        <Text style={{ color: t.accent, fontSize: 17, fontWeight: bold ? '600' : '400' }}>{title}</Text>
      )}
    </Pressable>
  );
}

export function Field({ style, ...props }: TextInputProps & { style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return (
    <TextInput
      placeholderTextColor={t.tertiary}
      selectionColor={t.accent}
      style={[styles.field, { color: t.text }, style]}
      {...props}
    />
  );
}

export function Muted({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  const t = useTheme();
  return <Text style={[{ color: t.secondary, fontSize: 15 }, style]}>{children}</Text>;
}

export function EmptyState({ icon, title, message, action }: { icon: SF; title: string; message?: string; action?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: t.accentSoft }]}>
        <Icon name={icon} size={30} color={t.accent} />
      </View>
      <Text style={[styles.emptyTitle, { color: t.text }]}>{title}</Text>
      {message && <Text style={[styles.emptyMessage, { color: t.secondary }]}>{message}</Text>}
      {action}
    </View>
  );
}

export function Loading() {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.background }}>
      <ActivityIndicator />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: SF }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.segmented, { backgroundColor: t.fill }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              haptic.tap();
              onChange(o.value);
            }}
            style={[styles.segment, active && [styles.segmentActive, { backgroundColor: t.elevated }]]}
          >
            {o.icon && <Icon name={o.icon} size={13} color={active ? t.text : t.secondary} weight="semibold" />}
            <Text style={{ fontSize: 13, fontWeight: active ? '600' : '500', color: active ? t.text : t.secondary }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Colored "you owe / you are owed" text. `amount` is from my perspective: positive = owed to me. */
export function BalanceText({
  amount,
  currency,
  style,
  prefix = true,
}: {
  amount: number;
  currency: string;
  style?: StyleProp<TextStyle>;
  prefix?: boolean;
}) {
  const t = useTheme();
  if (Math.abs(amount) < 0.005) return <Text style={[{ color: t.secondary, fontSize: 14 }, style]}>settled up</Text>;
  const owed = amount > 0;
  return (
    <Text style={[{ color: owed ? t.owed : t.owe, fontSize: 14, fontWeight: '500' }, style]}>
      {prefix ? (owed ? 'owes you ' : 'you owe ') : ''}
      {formatMoney(Math.abs(amount), currency)}
    </Text>
  );
}

/** Right-aligned two-line amount label used in lists. */
export function AmountLabel({ amount, currency, positiveLabel, negativeLabel }: { amount: number; currency: string; positiveLabel: string; negativeLabel: string }) {
  const t = useTheme();
  if (Math.abs(amount) < 0.005) return <Text style={{ color: t.tertiary, fontSize: 13 }}>settled</Text>;
  const color = amount > 0 ? t.owed : t.owe;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <Text style={{ color, fontSize: 12 }}>{amount > 0 ? positiveLabel : negativeLabel}</Text>
      <Text style={{ color, fontSize: 16, fontWeight: '600', fontVariant: ['tabular-nums'] }}>{formatMoney(Math.abs(amount), currency)}</Text>
    </View>
  );
}

/** Native iOS page sheet with a small nav bar. */
export function Sheet({
  visible,
  title,
  onClose,
  onDone,
  doneDisabled,
  children,
  scroll = true,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  onDone?: () => void;
  doneDisabled?: boolean;
  children: ReactNode;
  scroll?: boolean;
}) {
  const t = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <View style={[styles.sheetBar, { borderBottomColor: t.separator }]}>
          <View style={{ width: 80 }}>
            <HeaderButton title={onDone ? 'Cancel' : 'Close'} onPress={onClose} />
          </View>
          <Text style={[styles.sheetTitle, { color: t.text }]} numberOfLines={1}>
            {title}
          </Text>
          <View style={{ width: 80, alignItems: 'flex-end' }}>
            {onDone && <HeaderButton title="Done" bold onPress={onDone} disabled={doneDisabled} />}
          </View>
        </View>
        {scroll ? (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: space.lg, paddingBottom: 60 }}>
            {children}
          </ScrollView>
        ) : (
          children
        )}
      </View>
    </Modal>
  );
}

export function Check({ on }: { on: boolean }) {
  const t = useTheme();
  return <Icon name={on ? 'checkmark.circle.fill' : 'circle'} size={24} color={on ? t.accent : t.tertiary} />;
}

const styles = StyleSheet.create({
  button: {
    height: 52,
    borderRadius: 14,
    borderCurve: 'continuous',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xl,
  },
  buttonSmall: { height: 36, borderRadius: 18, paddingHorizontal: space.lg },
  buttonText: { fontSize: 17, fontWeight: '600' },
  fabWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 22,
    height: 50,
    borderRadius: 25,
    boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
  },
  fabText: { fontSize: 17, fontWeight: '600' },
  field: { fontSize: 17, paddingVertical: 14, paddingHorizontal: space.lg, minHeight: 52 },
  empty: { alignItems: 'center', paddingHorizontal: space.xxl, paddingVertical: 48, gap: space.md },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: space.xs },
  emptyTitle: { fontSize: 20, fontWeight: '600', textAlign: 'center' },
  emptyMessage: { fontSize: 15, textAlign: 'center', lineHeight: 21, marginBottom: space.sm },
  segmented: { flexDirection: 'row', borderRadius: 9, padding: 2, borderCurve: 'continuous' },
  segment: { flex: 1, flexDirection: 'row', gap: 4, alignItems: 'center', justifyContent: 'center', paddingVertical: 7, borderRadius: 7 },
  segmentActive: { boxShadow: '0 1px 3px rgba(0,0,0,0.12)' },
  sheetBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
});

export { radius };
