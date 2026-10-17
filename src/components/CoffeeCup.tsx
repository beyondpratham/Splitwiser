import { useFocusEffect } from 'expo-router';
import LottieView from 'lottie-react-native';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme';

const animation = require('../../assets/animations/hot-coffee.json');

/** A steaming cup of coffee; the animation restarts each time the screen comes into focus. */
export function CoffeeCup({ size = 56 }: { size?: number }) {
  const t = useTheme();
  // remounting restarts the animation; this works the same on native and web
  const [run, setRun] = useState(0);

  useFocusEffect(
    useCallback(() => {
      setRun((n) => n + 1);
    }, []),
  );

  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: t.accentSoft }]}>
      <LottieView key={run} source={animation} autoPlay loop style={{ width: size * 1.2, height: size * 1.2 }} webStyle={{ width: size * 1.2, height: size * 1.2 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
