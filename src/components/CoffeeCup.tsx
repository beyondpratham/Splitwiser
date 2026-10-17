import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

/** A takeaway coffee cup on a soft circle. */
export function CoffeeCup({ size = 56 }: { size?: number }) {
  const t = useTheme();
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accentSoft }]}>
      <Image source={require('../../assets/images/coffee-cup.png')} style={{ width: size * 0.78, height: size * 0.78 }} contentFit="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
});
