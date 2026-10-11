import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';

/** iOS inset-grouped section. */
export function Section({
  title,
  footer,
  children,
  style,
  action,
}: {
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  action?: ReactNode;
}) {
  const t = useTheme();
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[styles.section, style]}>
      {(title || action) && (
        <View style={styles.headerRow}>
          {title ? <Text style={[styles.header, { color: t.text }]}>{title}</Text> : <View />}
          {action}
        </View>
      )}
      <View style={[styles.card, { backgroundColor: t.card }]}>
        {items.map((child, i) => (
          <Fragment key={child.key ?? i}>
            {child}
            {i < items.length - 1 && <View style={[styles.separator, { backgroundColor: t.separator }]} />}
          </Fragment>
        ))}
      </View>
      {typeof footer === 'string' ? <Text style={[styles.footer, { color: t.secondary }]}>{footer}</Text> : footer}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  left,
  right,
  detail,
  onPress,
  onLongPress,
  chevron,
  destructive,
  tint,
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
  destructive?: boolean;
  tint?: boolean;
  disabled?: boolean;
}) {
  const t = useTheme();
  const color = destructive ? t.danger : tint ? t.accent : t.text;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled || (!onPress && !onLongPress)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: t.fill }, disabled && { opacity: 0.4 }]}
    >
      {left && <View style={styles.left}>{left}</View>}
      <View style={styles.body}>
        {typeof title === 'string' ? (
          <Text style={[styles.title, { color }]} numberOfLines={1}>
            {title}
          </Text>
        ) : (
          title
        )}
        {subtitle != null &&
          (typeof subtitle === 'string' ? (
            <Text style={[styles.subtitle, { color: t.secondary }]} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : (
            subtitle
          ))}
      </View>
      {detail != null && (
        <Text style={[styles.detail, { color: t.secondary }]} numberOfLines={1}>
          {detail}
        </Text>
      )}
      {right}
      {chevron && <Icon name="chevron.right" size={13} color={t.tertiary} weight="semibold" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginHorizontal: space.lg, marginBottom: space.xl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.xs, marginBottom: space.sm },
  header: { fontSize: 20, fontWeight: '700', letterSpacing: 0.2 },
  card: { borderRadius: radius.lg, borderCurve: 'continuous', overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 68 },
  footer: { fontSize: 13, marginTop: space.sm, paddingHorizontal: space.lg, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: space.lg, paddingVertical: 10, gap: space.md },
  left: { width: 40, alignItems: 'center' },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 17 },
  subtitle: { fontSize: 14 },
  detail: { fontSize: 17, maxWidth: '50%' },
});
