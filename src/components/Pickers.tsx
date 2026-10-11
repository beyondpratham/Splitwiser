import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { Searchbar, Text } from 'react-native-paper';
import { CATEGORIES } from '@/lib/categories';
import { CURRENCIES } from '@/lib/currencies';
import { hexAlpha, space, useTheme } from '@/theme';
import { Icon } from './Icon';
import { ListGroup, ListItem } from './List';
import { Sheet, useSheet } from './Sheet';
import { haptic } from './ui';

interface PickerProps<T> {
  visible: boolean;
  value: T;
  onClose: () => void;
  onSelect: (v: T) => void;
}

export function CurrencyPicker(props: PickerProps<string>) {
  return (
    <Sheet visible={props.visible} title="Currency" onClose={props.onClose}>
      <CurrencyList {...props} />
    </Sheet>
  );
}

function CurrencyList({ value, onSelect }: PickerProps<string>) {
  const t = useTheme();
  const { close } = useSheet();
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return CURRENCIES.filter((c) => !s || c.code.toLowerCase().includes(s) || c.name.toLowerCase().includes(s));
  }, [q]);
  return (
    <>
      <Searchbar value={q} onChangeText={setQ} placeholder="Search currencies" style={styles.search} mode="bar" />
      <ListGroup>
        {list.map((c) => (
          <ListItem
            key={c.code}
            left={<RNText style={{ fontSize: 28 }}>{c.flag}</RNText>}
            title={c.code}
            subtitle={c.name}
            right={c.code === value ? <Icon name="check" color={t.colors.primary} /> : undefined}
            onPress={() => {
              haptic.tap();
              onSelect(c.code);
              close();
            }}
          />
        ))}
      </ListGroup>
    </>
  );
}

export function CategoryPicker(props: PickerProps<string>) {
  return (
    <Sheet visible={props.visible} title="Category" onClose={props.onClose}>
      <CategoryGrid {...props} />
    </Sheet>
  );
}

function CategoryGrid({ value, onSelect }: PickerProps<string>) {
  const t = useTheme();
  const { close } = useSheet();
  const groups = ['Food', 'Home', 'Transport', 'Life', 'Other'] as const;
  return (
    <>
      {groups.map((g) => (
        <View key={g} style={styles.catGroup}>
          <Text variant="titleSmall" style={{ color: t.colors.primary, marginBottom: space.sm, marginLeft: space.xs }}>
            {g}
          </Text>
          <View style={styles.grid}>
            {CATEGORIES.filter((c) => c.group === g).map((c) => {
              const on = c.id === value;
              return (
                <View key={c.id} style={[styles.catCell, { backgroundColor: on ? t.colors.secondaryContainer : t.colors.surfaceContainerHigh }]}>
                  <Pressable
                    android_ripple={{ color: hexAlpha(t.colors.onSurface, 0.12) }}
                    style={styles.catInner}
                    onPress={() => {
                      haptic.tap();
                      onSelect(c.id);
                      close();
                    }}
                  >
                    <View style={[styles.catIcon, { backgroundColor: hexAlpha(c.color, t.dark ? 0.26 : 0.18) }]}>
                      <Icon name={c.icon} size={22} color={c.color} />
                    </View>
                    <Text variant="labelMedium" numberOfLines={1} style={{ color: on ? t.colors.onSecondaryContainer : t.colors.onSurface }}>
                      {c.label}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ))}
    </>
  );
}

export const GROUP_EMOJIS = [
  '👥', '🏠', '✈️', '🏖️', '🏔️', '🚗', '🍕', '🍻', '☕️', '🎉',
  '💑', '👨‍👩‍👧', '🎓', '💼', '⚽️', '🎮', '🎵', '🏕️', '🛒', '🎁',
  '🌴', '🗽', '🗼', '🚢', '🏟️', '🎿', '🐶', '💡', '🧾', '❤️',
];

export function EmojiPicker(props: PickerProps<string>) {
  return (
    <Sheet visible={props.visible} title="Group icon" onClose={props.onClose}>
      <EmojiGrid {...props} />
    </Sheet>
  );
}

function EmojiGrid({ value, onSelect }: PickerProps<string>) {
  const t = useTheme();
  const { close } = useSheet();
  return (
    <View style={[styles.grid, { paddingHorizontal: space.lg, justifyContent: 'center' }]}>
      {GROUP_EMOJIS.map((e) => (
        <Pressable
          key={e}
          onPress={() => {
            haptic.tap();
            onSelect(e);
            close();
          }}
          style={[styles.emoji, { backgroundColor: e === value ? t.colors.primaryContainer : t.colors.surfaceContainerHigh }]}
        >
          <RNText style={{ fontSize: 30 }}>{e}</RNText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  search: { marginHorizontal: space.lg, marginBottom: space.lg },
  catGroup: { paddingHorizontal: space.lg, marginBottom: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catCell: { width: '31.6%', borderRadius: 16, overflow: 'hidden' },
  catInner: { alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xs },
  catIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
