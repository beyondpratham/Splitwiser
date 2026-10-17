import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn } from 'react-native-reanimated';
import { Button, Field, haptic, IconButton, Segmented } from '@/components/Controls';
import { Glass } from '@/components/Glass';
import { Page } from '@/components/Page';
import { T } from '@/components/Text';
import { friendlyError, supabase } from '@/lib/supabase';
import { space } from '@/theme';

export default function SignIn() {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const valid = /\S+@\S+\.\S+/.test(email) && password.length >= 6 && (mode === 'in' || name.trim().length > 0);

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim() } } });
        if (error) throw error;
        if (!data.session) setNotice('Check your inbox to confirm your email, then sign in.');
      }
      haptic.success();
    } catch (e) {
      haptic.error();
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="SplitWiser" variant="hero" form>
      <View style={styles.hero}>
        <Animated.View entering={ZoomIn.springify().damping(11)}>
          <Image source={require('../../assets/icon.png')} style={styles.logo} />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(100).springify()} style={{ alignItems: 'center', gap: space.xs }}>
          <T variant="display">SplitWiser</T>
          <T variant="body" tone="dim" style={{ textAlign: 'center' }}>
            Split bills with friends. No ads, no limits.
          </T>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInDown.delay(200).springify()} layout={LinearTransition.springify()} style={styles.section}>
        <Glass variant="pane" contentStyle={styles.card}>
          <Segmented
            value={mode}
            onChange={(v) => {
              setMode(v);
              setError(null);
            }}
            options={[
              { value: 'in', label: 'Sign in' },
              { value: 'up', label: 'Create account' },
            ]}
          />
          {mode === 'up' && (
            <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
              <Field label="Your name" placeholder="Full name" value={name} onChangeText={setName} autoComplete="name" icon="account-outline" />
            </Animated.View>
          )}
          <Animated.View layout={LinearTransition.springify()} style={{ gap: space.md }}>
            <Field
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              icon="email-outline"
            />
            <Field
              label="Password"
              placeholder={mode === 'up' ? 'At least 6 characters' : 'Your password'}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
              onSubmitEditing={() => valid && submit()}
              icon="lock-outline"
              right={<IconButton plain icon={showPassword ? 'eye-off-outline' : 'eye-outline'} label={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(!showPassword)} size={32} />}
              error={error}
              hint={notice ?? undefined}
            />
            <Button title={mode === 'in' ? 'Sign in' : 'Create account'} size="lg" onPress={submit} loading={busy} disabled={!valid || busy} style={{ marginTop: space.sm }} />
          </Animated.View>
        </Glass>
      </Animated.View>
    </Page>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: space.lg, paddingHorizontal: space.xl, marginTop: space.lg, marginBottom: space.xxl },
  logo: { width: 100, height: 100, borderRadius: 28 },
  section: { marginHorizontal: space.lg },
  card: { padding: space.lg, gap: space.lg },
});
