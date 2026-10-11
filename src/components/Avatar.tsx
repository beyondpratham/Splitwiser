import { StyleSheet, Text, View } from 'react-native';
import { categoryById, PAYMENT_CATEGORY } from '@/lib/categories';
import { hexAlpha, shape, useTheme } from '@/theme';
import { Icon } from './Icon';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]} allowFontScaling={false}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function EmojiTile({ emoji, size = 48 }: { emoji: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.center, { width: size, height: size, borderRadius: size * 0.32, backgroundColor: t.colors.secondaryContainer }]}>
      <Text style={{ fontSize: size * 0.5 }} allowFontScaling={false}>
        {emoji}
      </Text>
    </View>
  );
}

/** Tonal category tile: tinted container with the category's color for the glyph. */
export function CategoryTile({ category, payment, size = 44 }: { category: string; payment?: boolean; size?: number }) {
  const t = useTheme();
  const c = payment ? PAYMENT_CATEGORY : categoryById(category);
  return (
    <View
      style={[
        styles.center,
        { width: size, height: size, borderRadius: Math.min(shape.md, size * 0.3), backgroundColor: hexAlpha(c.color, t.dark ? 0.24 : 0.16) },
      ]}
    >
      <Icon name={c.icon} size={size * 0.52} color={c.color} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '600', letterSpacing: 0.3 },
});
