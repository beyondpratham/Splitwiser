import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { space, useTheme } from '@/theme';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { T } from './Text';

/** A glass pane holding rows separated by hairlines, with an optional small heading. */
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
  animateIndex?: number;
}) {
  const t = useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  const body = (
    <View style={[styles.group, style]}>
      {(title || action) && (
        <View style={styles.titleRow}>
          {title ? (
            <T variant="overline" tone="dim">
              {title}
            </T>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      <Glass variant="pane">
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {child}
            {i < items.length - 1 && <View style={[styles.sep, { backgroundColor: t.line }]} />}
          </Fragment>
        ))}
      </Glass>
      {footer && (
        <T variant="caption" tone="dim" style={styles.footer}>
          {footer}
        </T>
      )}
    </View>
  );
  if (animateIndex == null) return body;
  return <Animated.View entering={FadeInDown.delay(Math.min(animateIndex, 8) * 50).springify().damping(18)}>{body}</Animated.View>;
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
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  detail?: string;
  onPress?: () => void;
  onLongPress?: () => void;
  chevron?: boolean;
  tone?: 'default' | 'accent' | 'danger';
  disabled?: boolean;
}) {
  const t = useTheme();
  const color = tone === 'danger' ? 'danger' : tone === 'accent' ? 'accent' : 'ink';
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || (!onPress && !onLongPress)}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.glassPressed }, disabled && { opacity: 0.4 }]}
    >
      {left && <View style={styles.left}>{left}</View>}
      <View style={styles.body}>
        {typeof title === 'string' ? (
          <T variant="bodyStrong" tone={color} numberOfLines={1}>
            {title}
          </T>
        ) : (
          title
        )}
        {subtitle != null &&
          (typeof subtitle === 'string' ? (
            <T variant="caption" tone="dim" numberOfLines={2}>
              {subtitle}
            </T>
          ) : (
            subtitle
          ))}
      </View>
      {detail != null && (
        <T variant="label" tone="dim" numberOfLines={1} style={{ maxWidth: '45%' }}>
          {detail}
        </T>
      )}
      {right}
      {chevron && <Icon name="chevron-right" size={20} color={t.inkFaint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: { marginHorizontal: space.lg, marginBottom: space.xl },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm, marginBottom: space.sm, minHeight: 22 },
  sep: { height: StyleSheet.hairlineWidth, marginLeft: 72 },
  footer: { marginTop: space.sm, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 64, paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  left: { minWidth: 42, alignItems: 'center' },
  body: { flex: 1, gap: 2 },
});
