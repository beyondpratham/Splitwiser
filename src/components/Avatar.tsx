import { StyleSheet, Text, View } from 'react-native';
import { categoryById, PAYMENT_CATEGORY } from '@/lib/categories';
import { Icon } from './Icon';

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export function Avatar({ name, color, size = 40 }: { name: string; color: string; size?: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.initials, { fontSize: size * 0.38 }]} allowFontScaling={false}>
        {initials(name)}
      </Text>
    </View>
  );
}

export function EmojiTile({ emoji, size = 44, tint = 'rgba(120,120,128,0.14)' }: { emoji: string; size?: number; tint?: string }) {
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: tint }]}>
      <Text style={{ fontSize: size * 0.5 }} allowFontScaling={false}>
        {emoji}
      </Text>
    </View>
  );
}

export function CategoryTile({ category, payment, size = 40 }: { category: string; payment?: boolean; size?: number }) {
  const c = payment ? PAYMENT_CATEGORY : categoryById(category);
  return (
    <View style={[styles.tile, { width: size, height: size, borderRadius: size * 0.28, backgroundColor: c.color }]}>
      <Icon name={c.sf} md={c.md} size={size * 0.5} color="#FFFFFF" />
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#FFFFFF', fontWeight: '600', letterSpacing: 0.3 },
  tile: { alignItems: 'center', justifyContent: 'center', borderCurve: 'continuous' },
});
