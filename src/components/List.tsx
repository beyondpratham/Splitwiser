import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Text } from 'react-native-paper';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { hexAlpha, space, useTheme } from '@/theme';
import { Icon } from './Icon';

type Position = 'single' | 'first' | 'middle' | 'last';

const OUTER = 20;
const INNER = 4;

function corners(position: Position) {
  const top = position === 'single' || position === 'first' ? OUTER : INNER;
  const bottom = position === 'single' || position === 'last' ? OUTER : INNER;
  return { borderTopLeftRadius: top, borderTopRightRadius: top, borderBottomLeftRadius: bottom, borderBottomRightRadius: bottom };
}

/** Material 3 expressive grouped list: segmented rounded container with small gaps. */
export function ListGroup({
  title,
  footer,
  action,
  children,
  style,
  animateIndex,
}: {
  title?: string;
  footer?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** stagger order for the entrance animation */
  animateIndex?: number;
}) {
  const t = useTheme();
  const items = Children.toArray(children).filter(isValidElement) as ReactElement<{ position?: Position }>[];
  const body = (
    <View style={[styles.group, style]}>
      {(title || action) && (
        <View style={styles.titleRow}>
          {title ? (
            <Text variant="titleSmall" style={{ color: t.colors.primary }}>
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      <View style={{ gap: 2 }}>
        {items.map((child, i) =>
          cloneElement(child, {
            key: child.key ?? i,
            position: items.length === 1 ? 'single' : i === 0 ? 'first' : i === items.length - 1 ? 'last' : 'middle',
          }),
        )}
      </View>
      {footer && (
        <Text variant="bodySmall" style={[styles.footer, { color: t.colors.onSurfaceVariant }]}>
          {footer}
        </Text>
      )}
    </View>
  );
  if (animateIndex == null) return body;
  return <Animated.View entering={FadeInDown.delay(Math.min(animateIndex, 8) * 45).springify().damping(18)}>{body}</Animated.View>;
}

export function ListItem({
  title,
  subtitle,
  left,
  right,
  detail,
  onPress,
  onLongPress,
  chevron,
  tone = 'default',
  disabled,
  position = 'single',
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  detail?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  tone?: 'default' | 'primary' | 'error';
  disabled?: boolean;
  position?: Position;
  children?: ReactNode;
}) {
  const t = useTheme();
  const color = tone === 'error' ? t.colors.error : tone === 'primary' ? t.colors.primary : t.colors.onSurface;
  return (
    <View style={[corners(position), { overflow: 'hidden', backgroundColor: t.colors.surfaceContainerLow }]}>
      <Pressable
        onPress={onPress}
        onLongPress={onLongPress}
        disabled={disabled || (!onPress && !onLongPress)}
        android_ripple={{ color: hexAlpha(t.colors.onSurface, 0.12) }}
        style={({ pressed }) => [styles.row, disabled && { opacity: 0.38 }, pressed && process.env.EXPO_OS !== 'android' && { backgroundColor: hexAlpha(t.colors.onSurface, 0.08) }]}
      >
        {left && <View style={styles.left}>{left}</View>}
        <View style={styles.body}>
          {typeof title === 'string' ? (
            <Text variant="bodyLarge" style={{ color }} numberOfLines={1}>
              {title}
            </Text>
          ) : (
            title
          )}
          {subtitle != null &&
            (typeof subtitle === 'string' ? (
              <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant }} numberOfLines={2}>
                {subtitle}
              </Text>
            ) : (
              subtitle
            ))}
        </View>
        {detail != null && (
          <Text variant="bodyMedium" style={{ color: t.colors.onSurfaceVariant, maxWidth: '45%' }} numberOfLines={1}>
            {detail}
          </Text>
        )}
        {right}
        {chevron && <Icon name="chevron-right" size={22} color={t.colors.onSurfaceVariant} />}
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { marginHorizontal: space.lg, marginBottom: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs, marginBottom: space.sm, minHeight: 24 },
  footer: { marginTop: space.sm, paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.lg },
  left: { minWidth: 40, alignItems: 'center' },
  body: { flex: 1, gap: 2 },
});
