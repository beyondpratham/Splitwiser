import { StyleSheet, Text, View } from 'react-native';
import { categoryById, PAYMENT_CATEGORY } from '@/lib/categories';
import { font, useTheme, withAlpha } from '@/theme';
import { Glass } from './Glass';
import { Icon } from './Icon';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ name, color, size = 42 }: { name: string; color: string; size?: number }) {
  return (
    <View
      style={[
        styles.center,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.35)' },
      ]}
    >
      <Text style={[styles.initials, { fontSize: size * 0.36 }]} allowFontScaling={false}>
        {initials(name)}
      </Text>
    </View>
  );
}

/** Group icon: an emoji on a small glass squircle. */
export function EmojiTile({ emoji, size = 46 }: { emoji: string; size?: number }) {
  return (
    <Glass radius={size * 0.32} contentStyle={[styles.center, { width: size, height: size }]}>
      <Text style={{ fontSize: size * 0.5 }} allowFontScaling={false}>
        {emoji}
      </Text>
    </Glass>
  );
}

/** Category icon on a tinted squircle. */
export function CategoryTile({ category, payment, size = 44 }: { category: string; payment?: boolean; size?: number }) {
  const t = useTheme();
  const c = payment ? PAYMENT_CATEGORY : categoryById(category);
  return (
    <View
      style={[
        styles.center,
        {
          width: size,
          height: size,
          borderRadius: size * 0.32,
          backgroundColor: withAlpha(c.color, t.dark ? 0.22 : 0.16),
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: withAlpha(c.color, 0.25),
        },
      ]}
    >
      <Icon name={c.icon} size={size * 0.5} color={c.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontFamily: font.semibold, letterSpacing: 0.3 },
});
