import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text as RNText, View } from 'react-native';
import { CATEGORIES } from '@/lib/categories';
import { CURRENCIES } from '@/lib/currencies';
import { space, useTheme, withAlpha } from '@/theme';
import { Field, haptic } from './Controls';
import { Glass } from './Glass';
import { Icon } from './Icon';
import { ListGroup, ListItem } from './List';
import { Sheet, useSheet } from './Sheet';
import { T } from './Text';

interface PickerProps<V> {
  visible: boolean;
  value: V;
  onClose: () => void;
  onSelect: (v: V) => void;
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
      <View style={{ paddingHorizontal: space.lg, marginBottom: space.lg }}>
        <Field icon="magnify" placeholder="Search currencies" value={q} onChangeText={setQ} autoCorrect={false} />
      </View>
      <ListGroup>
        {list.map((c) => (
          <ListItem
            key={c.code}
            left={<RNText style={{ fontSize: 26 }}>{c.flag}</RNText>}
            title={c.code}
            subtitle={c.name}
            right={c.code === value ? <Icon name="check-circle" color={t.accent} /> : undefined}
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
          <T variant="overline" tone="dim" style={{ marginBottom: space.sm, marginLeft: space.xs }}>
            {g}
          </T>
          <View style={styles.grid}>
            {CATEGORIES.filter((c) => c.group === g).map((c) => {
              const on = c.id === value;
              return (
                <Glass
                  key={c.id}
                  radius={20}
                  style={styles.catCell}
                  tint={on ? t.accentSoft : undefined}
                  onPress={() => {
                    haptic.tap();
                    onSelect(c.id);
                    close();
                  }}
                  accessibilityLabel={c.label}
                  accessibilityState={{ selected: on }}
                  contentStyle={styles.catInner}
                >
                  <View style={[styles.catIcon, { backgroundColor: withAlpha(c.color, t.dark ? 0.24 : 0.16) }]}>
                    <Icon name={c.icon} size={22} color={c.color} />
                  </View>
                  <T variant="caption" numberOfLines={1} style={{ color: on ? t.accentText : t.ink }}>
                    {c.label}
                  </T>
                </Glass>
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
          accessibilityRole="button"
          accessibilityLabel={e}
          onPress={() => {
            haptic.tap();
            onSelect(e);
            close();
          }}
          style={[styles.emoji, { backgroundColor: e === value ? t.accentSoft : t.glassTint, borderColor: e === value ? t.accent : t.rimTop }]}
        >
          <RNText style={{ fontSize: 30 }}>{e}</RNText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  catGroup: { paddingHorizontal: space.lg, marginBottom: space.xl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  catCell: { width: '31.6%' },
  catInner: { alignItems: 'center', gap: space.sm, paddingVertical: space.md, paddingHorizontal: space.xs },
  catIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emoji: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2 },
});
