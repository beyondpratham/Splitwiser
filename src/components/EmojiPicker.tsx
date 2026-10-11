import { Pressable, StyleSheet, Text, View } from 'react-native';
import { radius, space, useTheme } from '@/theme';
import { haptic, Sheet } from './ui';

export const GROUP_EMOJIS = [
  '👥', '🏠', '✈️', '🏖️', '🏔️', '🚗', '🍕', '🍻', '☕️', '🎉',
  '💑', '👨‍👩‍👧', '🎓', '💼', '⚽️', '🎮', '🎵', '🏕️', '🛒', '🎁',
  '🌴', '🗽', '🗼', '🚢', '🏟️', '🎿', '🐶', '💡', '🧾', '❤️',
];

export function EmojiPicker({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onSelect: (e: string) => void;
}) {
  const t = useTheme();
  return (
    <Sheet visible={visible} title="Group icon" onClose={onClose}>
      <View style={styles.grid}>
        {GROUP_EMOJIS.map((e) => (
          <Pressable
            key={e}
            onPress={() => {
              haptic.tap();
              onSelect(e);
              onClose();
            }}
            style={[styles.cell, { backgroundColor: e === value ? t.accentSoft : t.card, borderColor: e === value ? t.accent : 'transparent' }]}
          >
            <Text style={{ fontSize: 30 }}>{e}</Text>
          </Pressable>
        ))}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, justifyContent: 'center' },
  cell: { width: 58, height: 58, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderCurve: 'continuous' },
});
