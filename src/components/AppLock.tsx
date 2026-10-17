import * as LocalAuthentication from 'expo-local-authentication';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { usePrefs } from '@/lib/prefs';
import { space, useTheme } from '@/theme';
import { Button } from './Controls';
import { Backdrop, Glass } from './Glass';
import { Icon } from './Icon';
import { T } from './Text';

/** Can this phone lock the app with fingerprint / face / device PIN? */
export async function canUseAppLock() {
  if (Platform.OS === 'web') return false;
  return (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync());
}

export async function confirmIdentity(reason = 'Unlock SplitWiser') {
  const r = await LocalAuthentication.authenticateAsync({ promptMessage: reason });
  return r.success;
}

/** Covers the app until the owner unlocks it, on launch and when coming back from the background. */
export function AppLock() {
  const t = useTheme();
  const { prefs, atLaunch } = usePrefs();
  const enabled = prefs.privacy.appLock && Platform.OS !== 'web';
  // 'launch' = follow the setting saved when the app opened; then explicit locks / unlocks
  const [state, setState] = useState<'launch' | 'locked' | 'open'>('launch');
  const locked = enabled && (state === 'locked' || (state === 'launch' && !!atLaunch?.privacy.appLock));
  const backgroundedAt = useRef<number | null>(null);

  const unlock = useCallback(async () => {
    if (await confirmIdentity()) setState('open');
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') backgroundedAt.current = Date.now();
      // lock again if the app was away for more than a few seconds
      if (state === 'active' && backgroundedAt.current && Date.now() - backgroundedAt.current > 5000) setState('locked');
    });
    return () => sub.remove();
  }, [enabled]);

  // ask for fingerprint / face as soon as the lock screen appears
  useEffect(() => {
    if (!enabled || !locked) return;
    let alive = true;
    confirmIdentity().then((ok) => {
      if (alive && ok) setState('open');
    });
    return () => {
      alive = false;
    };
  }, [enabled, locked]);

  if (!enabled || !locked) return null;
  return (
    <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(250)} style={StyleSheet.absoluteFill}>
      <Backdrop />
      <View style={styles.center}>
        <Animated.View entering={ZoomIn.springify().damping(12)}>
          <Glass tint={t.accentSoft} contentStyle={styles.icon}>
            <Icon name="lock-outline" size={40} color={t.accentText} />
          </Glass>
        </Animated.View>
        <T variant="title">SplitWiser is locked</T>
        <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
          Unlock with your fingerprint, face or phone PIN.
        </T>
        <Button title="Unlock" icon="fingerprint" size="lg" onPress={unlock} style={{ alignSelf: 'stretch', marginTop: space.md }} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xxl },
  icon: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center' },
});
