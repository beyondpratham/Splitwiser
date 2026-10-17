import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';
import { Icon, type IconName } from './Icon';

/** Small tinted icon tile for list rows. */
export function Tile({ icon, danger }: { icon: IconName; danger?: boolean }) {
  const t = useTheme();
  return (
    <View style={[styles.tile, { backgroundColor: danger ? t.dangerSoft : t.accentSoft }]}>
      <Icon name={icon} size={20} color={danger ? t.danger : t.accentText} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
});
