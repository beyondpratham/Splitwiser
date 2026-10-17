import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { BackendForm } from '@/components/BackendForm';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { space } from '@/theme';

export default function Setup() {
  return (
    <Page title="Connect" variant="hero" form>
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(120).springify()} style={{ alignItems: 'center', gap: space.sm }}>
          <T variant="title">Connect your server</T>
          <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
            SplitWiser keeps your groups and expenses in your own free Supabase project.
          </T>
        </Animated.View>
      </View>
      <Animated.View entering={FadeInDown.delay(220).springify()}>
        <BackendForm />
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.xl, marginBottom: space.xl },
  logo: { width: 96, height: 96, borderRadius: 24 },
});
