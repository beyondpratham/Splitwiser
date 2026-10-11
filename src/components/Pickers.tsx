import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CATEGORIES } from '@/lib/categories';
import { CURRENCIES } from '@/lib/currencies';
import { radius, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { Row, Section } from './List';
import { Field, haptic, Sheet } from './ui';

export function CurrencyPicker({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (code: string) => void;
}) {
  const t = useTheme();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CURRENCIES.filter((c) => !s || c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
  }, [q]);
  return (
    <Sheet visible={visible} title="Currency" onClose={onClose}>
      <View style={[styles.search, { backgroundColor: t.fill }]}>
        <Icon name="magnifyingglass" size={16} color={t.secondary} />
        <Field value={q} onChangeText={setQ} placeholder="Search" autoCorrect={false} style={styles.searchField} />
      </View>
      <Section>
        {list.map((c) => (
          <Row
            key={c.code}
            left={<Text style={{ fontSize: 26 }}>{c.flag}</Text>}
            title={c.code}
            subtitle={c.name}
            right={c.code === value ? <Icon name="checkmark" size={18} color={t.accent} weight="semibold" /> : undefined}
            onPress={() => {
              haptic.tap();
              onSelect(c.code);
              onClose();
            }}
          />
        ))}
      </Section>
    </Sheet>
  );
}

export function CategoryPicker({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  const groups = ['Food', 'Home', 'Transport', 'Life', 'Other'] as const;
  return (
    <Sheet visible={visible} title="Category" onClose={onClose}>
      {groups.map((g) => (
        <View key={g} style={styles.catGroup}>
          <Text style={[styles.catHeader, { color: t.secondary }]}>{g.toUpperCase()}</Text>
          <View style={styles.grid}>
            {CATEGORIES.filter((c) => c.group === g).map((c) => {
              const on = c.id === value;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    haptic.tap();
                    onSelect(c.id);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.cat,
                    { backgroundColor: t.card, borderColor: on ? t.accent : 'transparent', opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={[styles.catIcon, { backgroundColor: c.color }]}>
                    <Icon name={c.sf} md={c.md} size={20} color="#fff" />
                  </View>
                  <Text style={[styles.catLabel, { color: t.text }]} numberOfLines={1}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: space.lg,
    marginBottom: space.lg,
    borderRadius: 10,
    paddingLeft: space.md,
    height: 40,
  },
  searchField: { flex: 1, paddingVertical: 0, minHeight: 40, paddingHorizontal: space.sm },
  catGroup: { paddingHorizontal: space.lg, marginBottom: space.xl },
  catHeader: { fontSize: 13, fontWeight: '600', marginBottom: space.sm, marginLeft: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cat: {
    width: '31.5%',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    borderWidth: 2,
  },
  catIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  catLabel: { fontSize: 13, fontWeight: '500' },
});
