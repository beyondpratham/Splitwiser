import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { space, useTheme } from '@/theme';
import { Button, haptic, IconButton } from './Controls';
import { Sheet, useSheet } from './Sheet';
import { T } from './Text';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Glass month calendar in a sheet. Future dates are disabled. */
export function DateSheet({ visible, value, onClose, onSelect }: { visible: boolean; value: Date; onClose: () => void; onSelect: (d: Date) => void }) {
  return (
    <Sheet visible={visible} title="Date" onClose={onClose}>
      <Calendar value={value} onSelect={onSelect} />
    </Sheet>
  );
}

function Calendar({ value, onSelect }: { value: Date; onSelect: (d: Date) => void }) {
  const t = useTheme();
  const { close } = useSheet();
  const [month, setMonth] = useState(new Date(value.getFullYear(), value.getMonth(), 1));
  const today = new Date();
  const first = (month.getDay() + 6) % 7; // Monday-first
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => new Date(month.getFullYear(), month.getMonth(), i + 1, 12))];
  const isCurrentMonth = month.getFullYear() === today.getFullYear() && month.getMonth() === today.getMonth();

  const pick = (d: Date) => {
    haptic.tap();
    onSelect(d);
    close();
  };

  return (
    <View style={{ paddingHorizontal: space.lg, gap: space.md }}>
      <View style={styles.monthRow}>
        <IconButton icon="chevron-left" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} />
        <T variant="subhead">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</T>
        <IconButton
          icon="chevron-right"
          label="Next month"
          onPress={() => !isCurrentMonth && setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          color={isCurrentMonth ? t.inkFaint : undefined}
        />
      </View>
      <View style={styles.grid}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={styles.cell}>
            <T variant="caption" tone="faint">
              {w}
            </T>
          </View>
        ))}
        {cells.map((d, i) => {
          if (!d) return <View key={i} style={styles.cell} />;
          const selected = sameDay(d, value);
          const isToday = sameDay(d, today);
          const future = d > today && !isToday;
          return (
            <Pressable key={i} disabled={future} onPress={() => pick(d)} style={styles.cell} accessibilityRole="button" accessibilityLabel={d.toDateString()}>
              <View
                style={[
                  styles.day,
                  selected && { backgroundColor: t.accent },
                  !selected && isToday && { borderWidth: 1.5, borderColor: t.accent },
                ]}
              >
                <T variant="label" numeric style={{ color: selected ? t.accentInk : future ? t.inkFaint : t.ink }}>
                  {d.getDate()}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
      <Button title="Today" variant="glass" size="sm" onPress={() => pick(new Date())} style={{ alignSelf: 'center' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
